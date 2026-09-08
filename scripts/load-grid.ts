import "dotenv/config";

import { gunzipSync } from "node:zlib";
import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../src/generated/prisma/client";

/**
 * Load rasterised climate fields into PostgreSQL.
 *
 * The database stores two things per field: an area-level aggregate row for
 * every province and district, and — only when asked — the per-cell values.
 *
 * The aggregates are the point of the exercise. They turn "mean projected
 * warming across every district in Sindh" from 126 array scans into one
 * indexed query, and they let the data be joined against anything else that
 * is keyed by administrative unit. The per-cell table exists for spatial SQL
 * that the flat arrays cannot answer, and is opt-in because it is roughly
 * three orders of magnitude larger.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL,
  }),
});

const GRID_DIR = path.join(process.cwd(), "data", "grid");
const INDEX_DIR = path.join(process.cwd(), "data", "geo");
const DATASET_ID = "cmip6-x0.25";

interface Field {
  spec: {
    variable: string;
    model: string;
    scenario: string;
    product: string;
    aggregation: string;
    percentile: string;
    period: string;
    statistic: string;
  };
  source: string;
  units: string;
  values: Array<number | null>;
  significance: Array<number | null> | null;
}

function readField(file: string): Field {
  const raw = readFileSync(path.join(GRID_DIR, file));
  const json = file.endsWith(".gz") ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
  return JSON.parse(json) as Field;
}

function readCellIndex(): Map<string, number[]> {
  const index = new Map<string, number[]>();
  for (const file of ["provinces-cells.json", "districts-cells.json"]) {
    try {
      const raw = readFileSync(path.join(INDEX_DIR, file), "utf8");
      for (const [id, cells] of Object.entries(JSON.parse(raw) as Record<string, number[]>)) {
        index.set(id, cells);
      }
    } catch {
      // A missing sidecar just means that level cannot be aggregated.
    }
  }
  return index;
}

interface Aggregate {
  mean: number | null;
  min: number | null;
  max: number | null;
  count: number;
  agreement: number | null;
}

function aggregate(field: Field, cells: number[]): Aggregate {
  let sum = 0;
  let count = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let robust = 0;
  let classified = 0;

  for (const index of cells) {
    const value = field.values[index];
    if (value === null || value === undefined) continue;
    sum += value;
    count += 1;
    if (value < min) min = value;
    if (value > max) max = value;

    const flag = field.significance?.[index];
    if (flag !== null && flag !== undefined) {
      classified += 1;
      // 2 means the models conflict on the sign of the change.
      if (flag !== 2) robust += 1;
    }
  }

  return {
    mean: count ? sum / count : null,
    min: count ? min : null,
    max: count ? max : null,
    count,
    agreement: classified ? robust / classified : null,
  };
}

/**
 * Collision-resistant id in the same shape Prisma's `cuid()` produces, so
 * rows written through raw SQL are indistinguishable from rows written
 * through the client.
 */
function createId(): string {
  return `c${Date.now().toString(36)}${randomBytes(8).toString("hex")}`;
}

/**
 * Per-cell values for the national row.
 *
 * Written against the country projection only — repeating them for each
 * province and district would store every cell three times over for no
 * additional information.
 */
async function loadCells(field: Field, spec: Field["spec"]): Promise<void> {
  const projection = await prisma.projection.findUnique({
    where: {
      projection_identity: {
        datasetId: DATASET_ID,
        indicatorId: spec.variable,
        scenarioId: spec.scenario,
        modelId: spec.model,
        periodId: spec.period,
        product: spec.product,
        aggregation: spec.aggregation,
        percentile: spec.percentile,
        areaId: "pakistan",
      },
    },
    select: { id: true },
  });
  if (!projection) return;

  const rows = field.values.flatMap((value, cellIndex) =>
    value === null || value === undefined
      ? []
      : [
          {
            projectionId: projection.id,
            cellIndex,
            value,
            significance: field.significance?.[cellIndex] ?? null,
          },
        ],
  );

  await prisma.projectionValue.deleteMany({ where: { projectionId: projection.id } });
  for (let offset = 0; offset < rows.length; offset += 1000) {
    await prisma.projectionValue.createMany({
      data: rows.slice(offset, offset + 1000),
      skipDuplicates: true,
    });
  }
}

async function loadField(
  file: string,
  cellIndex: Map<string, number[]>,
  areaIds: Set<string>,
  withCells: boolean,
): Promise<number> {
  const field = readField(file);
  const { spec } = field;
  let written = 0;

  // Only annual fields are aggregated into the warehouse.
  //
  // A monthly field stacks twelve lattices, and collapsing them into one
  // area mean would silently average January into July — for a monsoon
  // climate that is not a summary, it is a fabrication. The fact table has
  // no month discriminator, so the seasonal cycle is served from the grid
  // documents, which keep the layers intact.
  if (spec.aggregation !== "annual") return 0;

  // Every row is attributed to an area, including the national one. The
  // country's cells are the union of the provinces' rather than the whole
  // lattice, so the national mean is over Pakistan and not over the
  // rectangle that contains it — which would drag in Iran and India.
  const targets: Array<{ areaId: string; cells: number[] }> = [];
  for (const [areaId, cells] of cellIndex) {
    if (areaIds.has(areaId) && cells.length > 0) targets.push({ areaId, cells });
  }
  const national = [...new Set(targets.filter((t) => !t.areaId.startsWith("d-")).flatMap((t) => t.cells))];
  if (areaIds.has("pakistan") && national.length > 0) {
    targets.unshift({ areaId: "pakistan", cells: national });
  }

  // One statement per field rather than one per area.
  //
  // A field produces 134 rows (country + 7 provinces + 126 districts). Sending
  // those as individual upserts means 134 round trips to a pooled Neon
  // endpoint, which dominates the runtime completely — the aggregation itself
  // is microseconds. A single multi-row INSERT ... ON CONFLICT collapses that
  // to one, and stays idempotent so a re-run updates rather than duplicates.
  const rows = targets.flatMap((target) => {
    const stats = aggregate(field, target.cells);
    if (stats.count === 0) return [];
    return [
      {
        areaId: target.areaId,
        value: stats.mean,
        minValue: stats.min,
        maxValue: stats.max,
        cellCount: stats.count,
        agreement: stats.agreement,
      },
    ];
  });

  if (rows.length === 0) return 0;

  const values = Prisma.join(
    rows.map(
      (row) => Prisma.sql`(
        ${createId()},
        ${DATASET_ID}, ${spec.variable}, ${spec.scenario}, ${spec.model},
        ${spec.period}, ${row.areaId},
        ${spec.product}, ${spec.aggregation}, ${spec.percentile},
        ${row.value}, ${field.units}, ${row.minValue}, ${row.maxValue},
        ${row.cellCount}, ${row.agreement}, ${field.source}, NOW(), NOW()
      )`,
    ),
  );

  await prisma.$executeRaw`
    INSERT INTO projections (
      id, "datasetId", "indicatorId", "scenarioId", "modelId",
      "periodId", "areaId", product, aggregation, percentile,
      value, unit, "minValue", "maxValue", "cellCount", agreement,
      "sourceUrl", "createdAt", "updatedAt"
    )
    VALUES ${values}
    ON CONFLICT ("datasetId", "indicatorId", "scenarioId", "modelId",
                 "periodId", product, aggregation, percentile, "areaId")
    DO UPDATE SET
      value       = EXCLUDED.value,
      unit        = EXCLUDED.unit,
      "minValue"  = EXCLUDED."minValue",
      "maxValue"  = EXCLUDED."maxValue",
      "cellCount" = EXCLUDED."cellCount",
      agreement   = EXCLUDED.agreement,
      "sourceUrl" = EXCLUDED."sourceUrl",
      "updatedAt" = NOW()
  `;
  written = rows.length;

  if (withCells) {
    await loadCells(field, spec);
  }

  return written;
}

async function main() {
  const withCells = process.argv.includes("--cells");
  const only = process.argv.find((arg) => arg.startsWith("--only="))?.slice(7);

  const files = readdirSync(GRID_DIR)
    .filter((file) => file.endsWith(".json.gz") || (file.endsWith(".json") && file !== "manifest.json"))
    .filter((file) => (only ? file.startsWith(only) : true))
    .sort();

  if (files.length === 0) {
    console.error(`no grid files in ${GRID_DIR}; run the extraction pipeline first`);
    process.exit(1);
  }

  const run = await prisma.ingestionRun.create({
    data: { plan: only ?? "all", status: "running" },
  });

  const cellIndex = readCellIndex();
  const areaIds = new Set((await prisma.area.findMany({ select: { id: true } })).map((a) => a.id));

  console.log(
    `loading ${files.length} fields into ${areaIds.size} areas` +
      `${withCells ? " (with per-cell values)" : ""}`,
  );

  let ok = 0;
  let failed = 0;
  const startedAt = Date.now();

  for (const [position, file] of files.entries()) {
    try {
      const rows = await loadField(file, cellIndex, areaIds, withCells);
      ok += 1;
      if ((position + 1) % 25 === 0 || position === files.length - 1) {
        const elapsed = (Date.now() - startedAt) / 1000;
        console.log(
          `  ${position + 1}/${files.length}  ${rows} rows  ${elapsed.toFixed(0)}s`,
        );
      }
    } catch (error) {
      failed += 1;
      console.error(`  failed ${file}: ${(error as Error).message}`);
    }
  }

  await prisma.ingestionRun.update({
    where: { id: run.id },
    data: {
      status: failed === 0 ? "succeeded" : "partial",
      finishedAt: new Date(),
      fieldsOk: ok,
      fieldsFailed: failed,
    },
  });

  const total = await prisma.projection.count();
  console.log(`done — ${ok} fields loaded, ${failed} failed, ${total} projection rows total`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
