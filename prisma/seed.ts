import "dotenv/config";

/**
 * Seed the dimension tables and the spatial reference layer.
 *
 * Dimensions come from the TypeScript taxonomy rather than a separate SQL
 * fixture, so there is exactly one definition of what a scenario or an
 * indicator is, and the database cannot drift from the application's view of
 * the world.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

import { PLACES } from "../src/lib/climate/places";
import {
  DATASETS,
  INDICATORS,
  MODELS,
  PERIODS,
  SCENARIOS,
} from "../src/lib/climate/taxonomy";

// Seeding writes DDL-adjacent statements (extensions, GiST indexes) that a
// transaction-mode pooler will not accept, so this goes direct.
const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL,
  }),
});

// Simplified boundaries are published to public/ so the browser can fetch
// them directly; the grid-cell sidecars stay in data/ because they are a
// server-side index, not a client asset.
const GEO_DIR = path.join(process.cwd(), "public", "geo");
const INDEX_DIR = path.join(process.cwd(), "data", "geo");
const GRID = { lonMin: 60.375, latMin: 23.375, resolution: 0.25, nLon: 71, nLat: 56 };

interface Feature {
  properties: {
    id: string;
    name: string;
    level: number;
    centroid: [number, number];
    bbox: [number, number, number, number];
  };
  geometry: { type: string; coordinates: unknown };
}

function readCollection(file: string): Feature[] {
  try {
    return JSON.parse(readFileSync(path.join(GEO_DIR, file), "utf8")).features;
  } catch {
    return [];
  }
}

function readCells(file: string): Record<string, number[]> {
  try {
    return JSON.parse(readFileSync(path.join(INDEX_DIR, file), "utf8"));
  } catch {
    return {};
  }
}

async function seedDimensions() {
  for (const dataset of Object.values(DATASETS)) {
    await prisma.dataset.upsert({
      where: { id: dataset.id },
      create: dataset,
      update: dataset,
    });
  }

  for (const scenario of Object.values(SCENARIOS)) {
    const row = {
      id: scenario.id,
      label: scenario.label,
      shortLabel: scenario.shortLabel,
      forcing: scenario.forcing,
      narrative: scenario.narrative,
      summary: scenario.summary,
      globalWarming2100: scenario.globalWarming2100,
      rank: scenario.rank,
      color: scenario.color,
    };
    await prisma.scenario.upsert({ where: { id: row.id }, create: row, update: row });
  }

  for (const model of Object.values(MODELS)) {
    const row = {
      id: model.id,
      label: model.label,
      institution: model.institution,
      country: model.country,
      ecs: model.ecs as number | null,
      isEnsemble: model.isEnsemble as boolean,
    };
    await prisma.climateModel.upsert({ where: { id: row.id }, create: row, update: row });
  }

  for (const period of Object.values(PERIODS)) {
    const row = {
      id: period.id,
      label: period.label,
      shortLabel: period.shortLabel,
      startYear: period.startYear,
      endYear: period.endYear,
      isBaseline: period.isBaseline,
    };
    await prisma.period.upsert({ where: { id: row.id }, create: row, update: row });
  }

  for (const indicator of Object.values(INDICATORS)) {
    const row = {
      id: indicator.id,
      label: indicator.label,
      shortLabel: indicator.shortLabel,
      unit: indicator.unit,
      anomalyUnit: indicator.anomalyUnit ?? null,
      family: indicator.family,
      description: indicator.description,
      higherIsWorse: indicator.higherIsWorse,
      precision: indicator.precision,
      pakistanNote: indicator.countryNotes?.PAK ?? null,
    };
    await prisma.indicator.upsert({ where: { id: row.id }, create: row, update: row });
  }

  console.log(
    `dimensions: ${Object.keys(DATASETS).length} datasets, ` +
      `${Object.keys(SCENARIOS).length} scenarios, ${Object.keys(MODELS).length} models, ` +
      `${Object.keys(PERIODS).length} periods, ${Object.keys(INDICATORS).length} indicators`,
  );
}

async function seedAreas() {
  // Order matters: a child row cannot reference a parent that does not exist
  // yet, so the hierarchy is loaded top-down.
  const layers: Array<{ file: string; level: number; parent: string | null }> = [
    { file: "pakistan.geojson", level: 0, parent: null },
    { file: "provinces.geojson", level: 1, parent: "pakistan" },
    { file: "districts.geojson", level: 2, parent: "pakistan" },
  ];

  for (const layer of layers) {
    for (const feature of readCollection(layer.file)) {
      const { id, name, level, centroid, bbox } = feature.properties;
      const row = {
        id,
        name,
        level,
        parentId: layer.parent,
        centroidLon: centroid[0],
        centroidLat: centroid[1],
        bboxMinLon: bbox[0],
        bboxMinLat: bbox[1],
        bboxMaxLon: bbox[2],
        bboxMaxLat: bbox[3],
      };
      await prisma.area.upsert({ where: { id }, create: row, update: row });

      // Geometry goes in through raw SQL: Prisma models the column as
      // Unsupported, and ST_GeomFromGeoJSON is the only sane way to load it.
      const geojson = JSON.stringify(feature.geometry);
      await prisma.$executeRaw`
        UPDATE areas
        SET geometry = ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${geojson}::text), 4326))
        WHERE id = ${id}
      `;
    }
  }

  const count = await prisma.area.count();
  console.log(`areas: ${count}`);
}

async function seedGridCells() {
  const provinceCells = readCells("provinces-cells.json");
  const owner = new Map<number, string>();
  for (const [areaId, cells] of Object.entries(provinceCells)) {
    for (const index of cells) owner.set(index, areaId);
  }

  const rows: Array<{
    index: number; row: number; col: number; lat: number; lon: number; areaId: string | null;
  }> = [];

  for (let row = 0; row < GRID.nLat; row += 1) {
    for (let col = 0; col < GRID.nLon; col += 1) {
      const index = row * GRID.nLon + col;
      rows.push({
        index,
        row,
        col,
        lon: Number((GRID.lonMin + (col + 0.5) * GRID.resolution).toFixed(4)),
        lat: Number((GRID.latMin + (row + 0.5) * GRID.resolution).toFixed(4)),
        areaId: owner.get(index) ?? null,
      });
    }
  }

  await prisma.gridCell.deleteMany();
  // Chunked so a single statement never exceeds the pooled connection's
  // parameter limit.
  for (let offset = 0; offset < rows.length; offset += 500) {
    await prisma.gridCell.createMany({
      data: rows.slice(offset, offset + 500),
      skipDuplicates: true,
    });
  }

  await prisma.$executeRaw`
    UPDATE grid_cells
    SET point = ST_SetSRID(ST_MakePoint(lon, lat), 4326)
    WHERE point IS NULL
  `;

  console.log(`grid cells: ${rows.length} (${owner.size} inside Pakistan)`);
}

async function seedPlaces() {
  for (const place of PLACES) {
    const row = { ...place, note: place.note ?? null };
    await prisma.place.upsert({ where: { id: place.id }, create: row, update: row });
  }
  console.log(`places: ${PLACES.length}`);
}

async function createIndexes() {
  // Spatial indexes are what make "which cell contains this point" and
  // "which cells fall inside this province" fast. Prisma cannot express a
  // GiST index, so they are created here.
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS areas_geometry_idx ON areas USING GIST (geometry)`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS grid_cells_point_idx ON grid_cells USING GIST (point)`,
  );
  console.log("spatial indexes: ok");
}

async function main() {
  console.log("seeding…");
  await prisma.$executeRawUnsafe("CREATE EXTENSION IF NOT EXISTS postgis");
  await seedDimensions();
  await seedAreas();
  await seedGridCells();
  await seedPlaces();
  await createIndexes();
  console.log("done");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
