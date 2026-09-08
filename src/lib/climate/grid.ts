import { gunzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { cached } from "@/lib/cache";
import { ApiError } from "@/lib/errors";

import {
  ENSEMBLE_ID,
  type AggregationId,
  type PercentileId,
  type ProductId,
  type ScenarioId,
} from "./taxonomy";

/**
 * Access layer for the pre-rasterised Pakistan climate grid.
 *
 * The pipeline writes one gzipped JSON document per field. Each holds a flat
 * row-major array of values over a fixed 0.25° lattice, indexed from the
 * south-west corner: `row * nLon + col`. Keeping the geometry out of the
 * per-field payload — it is identical for every field — is what lets a full
 * national field compress to ~11 KB.
 *
 * This is the fast path. When a requested field was never rasterised, the
 * caller falls back to the aggregate API.
 */

const GRID_DIR = path.join(process.cwd(), "data", "grid");
const GEO_DIR = path.join(process.cwd(), "data", "geo");

export interface GridGeometry {
  lonMin: number;
  latMin: number;
  resolution: number;
  nLon: number;
  nLat: number;
  cellCount: number;
}

export interface GridField {
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
  grid: GridGeometry;
  /**
   * Layer labels: month numbers. Length 1 for annual fields, 12 for monthly,
   * 4 for seasonal. Older extractions predate this field and are treated as
   * single-layer.
   */
  times?: number[];
  nTime?: number;
  stats: { count: number; min: number | null; max: number | null; mean: number | null };
  /**
   * Stacked layer-major, row-major within a layer:
   * `layer * nLat * nLon + row * nLon + col`, counting from the south-west.
   */
  values: Array<number | null>;
  /**
   * Model-agreement classification published alongside anomaly fields.
   * `null` where absent; otherwise 0 = no data, 1 = no change, 2 = models
   * disagree on the sign, and a missing entry means the signal is robust.
   */
  significance: Array<number | null> | null;
}

export interface GridManifestEntry {
  slug: string;
  file: string;
  variable: string;
  product: string;
  aggregation: string;
  scenario: string;
  model: string;
  percentile: string;
  period: string;
  bytes: number;
}

export interface GridManifest {
  generatedAt: string;
  collection: string;
  bbox: { lonMin: number; latMin: number; lonMax: number; latMax: number };
  grid: GridGeometry | null;
  fieldCount: number;
  totalBytes: number;
  variables: string[];
  scenarios: string[];
  periods: string[];
  models: string[];
  fields: GridManifestEntry[];
}

const EMPTY_MANIFEST: GridManifest = {
  generatedAt: new Date(0).toISOString(),
  collection: "cmip6-x0.25",
  bbox: { lonMin: 60.5, latMin: 23.5, lonMax: 78, latMax: 37.25 },
  grid: null,
  fieldCount: 0,
  totalBytes: 0,
  variables: [],
  scenarios: [],
  periods: [],
  models: [],
  fields: [],
};

// ---------------------------------------------------------------------------
// Field identity
// ---------------------------------------------------------------------------

export interface FieldKey {
  variable: string;
  product: ProductId;
  aggregation: AggregationId;
  scenario: ScenarioId;
  model: string;
  percentile: PercentileId;
  period: string;
}

export function fieldSlug(key: FieldKey): string {
  return [
    key.variable,
    key.product,
    key.aggregation,
    key.scenario,
    key.model,
    key.percentile,
    key.period,
  ].join("_");
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/**
 * The manifest is read once per process and refreshed on a short TTL, so a
 * pipeline run that lands new fields becomes visible without a redeploy.
 */
export async function loadManifest(): Promise<GridManifest> {
  return cached(
    "grid:manifest",
    async () => {
      try {
        const raw = await readFile(path.join(GRID_DIR, "manifest.json"), "utf8");
        return JSON.parse(raw) as GridManifest;
      } catch {
        return EMPTY_MANIFEST;
      }
    },
    { ttlMs: 60_000, memoryOnly: true },
  );
}

async function readField(file: string): Promise<GridField> {
  const full = path.join(GRID_DIR, file);
  const buffer = await readFile(full);
  const json = file.endsWith(".gz") ? gunzipSync(buffer).toString("utf8") : buffer.toString("utf8");
  return JSON.parse(json) as GridField;
}

/**
 * Load one rasterised field, or `null` if it was never extracted.
 *
 * Fields are cached in memory only: a national field is ~30 KB decoded, and
 * round-tripping that through the disk cache would be slower than re-reading
 * the source file.
 */
export async function loadField(key: FieldKey): Promise<GridField | null> {
  const slug = fieldSlug(key);
  return cached(
    `grid:field:${slug}`,
    async () => {
      const manifest = await loadManifest();
      const entry = manifest.fields.find((field) => field.slug === slug);
      if (!entry) return null;
      try {
        return await readField(entry.file);
      } catch {
        return null;
      }
    },
    { ttlMs: 60 * 60_000, memoryOnly: true },
  );
}

export async function hasField(key: FieldKey): Promise<boolean> {
  const manifest = await loadManifest();
  const slug = fieldSlug(key);
  return manifest.fields.some((field) => field.slug === slug);
}

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

export function layerCount(field: GridField): number {
  return field.nTime ?? 1;
}

/**
 * One time slice of a field as a plain single-layer field.
 *
 * Everything downstream — point lookup, area aggregation, the map — works on
 * a single lattice, so slicing here keeps that code free of a layer axis it
 * would otherwise have to thread through every call.
 */
export function layerAt(field: GridField, layer: number): GridField {
  const layers = layerCount(field);
  if (layers <= 1) return field;
  const size = field.grid.nLat * field.grid.nLon;
  const index = Math.min(Math.max(layer, 0), layers - 1);
  const start = index * size;
  const values = field.values.slice(start, start + size);
  const finite = values.filter((v): v is number => v !== null);
  return {
    ...field,
    times: field.times ? [field.times[index]!] : undefined,
    nTime: 1,
    values,
    significance: field.significance
      ? field.significance.slice(start, start + size)
      : null,
    stats: {
      count: finite.length,
      min: finite.length ? Math.min(...finite) : null,
      max: finite.length ? Math.max(...finite) : null,
      mean: finite.length ? finite.reduce((a, b) => a + b, 0) / finite.length : null,
    },
  };
}

/** Index of the layer whose month label matches, or `null`. */
export function layerForMonth(field: GridField, month: number): number | null {
  const index = field.times?.indexOf(month) ?? -1;
  return index === -1 ? null : index;
}

/**
 * The value at one cell across every layer — the seasonal cycle at a point.
 */
export function cycleAt(field: GridField, cellIndex: number): Array<{ month: number; value: number | null }> {
  const size = field.grid.nLat * field.grid.nLon;
  return Array.from({ length: layerCount(field) }, (_, layer) => ({
    month: field.times?.[layer] ?? 7,
    value: field.values[layer * size + cellIndex] ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Spatial indexing
// ---------------------------------------------------------------------------

export interface CellRef {
  index: number;
  row: number;
  col: number;
  lon: number;
  lat: number;
}

export function cellAt(grid: GridGeometry, lon: number, lat: number): CellRef | null {
  const col = Math.floor((lon - grid.lonMin) / grid.resolution);
  const row = Math.floor((lat - grid.latMin) / grid.resolution);
  if (col < 0 || col >= grid.nLon || row < 0 || row >= grid.nLat) return null;
  return {
    index: row * grid.nLon + col,
    row,
    col,
    lon: grid.lonMin + (col + 0.5) * grid.resolution,
    lat: grid.latMin + (row + 0.5) * grid.resolution,
  };
}

export function cellCentre(grid: GridGeometry, index: number): { lon: number; lat: number } {
  const row = Math.floor(index / grid.nLon);
  const col = index % grid.nLon;
  return {
    lon: grid.lonMin + (col + 0.5) * grid.resolution,
    lat: grid.latMin + (row + 0.5) * grid.resolution,
  };
}

/**
 * Nearest cell with data, searching outward in rings.
 *
 * A coastal or border point can land on a cell the model masks out; rather
 * than reporting "no data" for Gwadar, we walk outward up to `maxRings`
 * (2 cells ≈ 55 km) and report the offset so the UI can be honest about it.
 */
export function nearestValued(
  field: GridField,
  lon: number,
  lat: number,
  maxRings = 3,
): { cell: CellRef; value: number; offsetCells: number } | null {
  const origin = cellAt(field.grid, lon, lat);
  if (!origin) return null;
  for (let ring = 0; ring <= maxRings; ring += 1) {
    for (let dr = -ring; dr <= ring; dr += 1) {
      for (let dc = -ring; dc <= ring; dc += 1) {
        // Only the perimeter of this ring is new.
        if (ring > 0 && Math.abs(dr) !== ring && Math.abs(dc) !== ring) continue;
        const row = origin.row + dr;
        const col = origin.col + dc;
        if (row < 0 || row >= field.grid.nLat || col < 0 || col >= field.grid.nLon) continue;
        const index = row * field.grid.nLon + col;
        const value = field.values[index];
        if (value === null || value === undefined) continue;
        return {
          cell: {
            index,
            row,
            col,
            lon: field.grid.lonMin + (col + 0.5) * field.grid.resolution,
            lat: field.grid.latMin + (row + 0.5) * field.grid.resolution,
          },
          value,
          offsetCells: ring,
        };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Area aggregation
// ---------------------------------------------------------------------------

let cellIndexCache: Map<string, number[]> | null = null;

/**
 * Grid-cell membership per admin unit, precomputed by the pipeline.
 *
 * Doing point-in-polygon at request time for 126 districts × 3,976 cells
 * would be wasteful; the pipeline resolves it once against the *unsimplified*
 * boundaries, so border cells are never lost to simplification.
 */
export async function loadCellIndex(): Promise<Map<string, number[]>> {
  if (cellIndexCache) return cellIndexCache;
  const index = new Map<string, number[]>();
  for (const file of [
    "provinces-cells.json",
    "districts-cells.json",
    "uzb-regions-cells.json",
    "uzb-districts-cells.json",
    "aus-states-cells.json",
    "nzl-regions-cells.json",
  ]) {
    try {
      const raw = await readFile(path.join(GEO_DIR, file), "utf8");
      for (const [id, cells] of Object.entries(JSON.parse(raw) as Record<string, number[]>)) {
        index.set(id, cells);
      }
    } catch {
      // A missing sidecar simply means area aggregation is unavailable for
      // that level; point queries and the national API path still work.
    }
  }
  cellIndexCache = index;
  return index;
}

export interface AreaStats {
  mean: number | null;
  min: number | null;
  max: number | null;
  /** Population-free area weighting: every cell counts once. */
  cellsWithData: number;
  cellsTotal: number;
  /** Share of cells where models agree on the direction of change. */
  agreement: number | null;
}

/**
 * Aggregate a field over a set of cells.
 *
 * Cells are equal-weighted rather than area-weighted. At Pakistan's latitudes
 * a 0.25° cell varies in area by about 15% between Karachi and Gilgit; that
 * is small next to the model spread the UI already surfaces, and equal
 * weighting keeps the number reproducible against CCKP's own aggregates.
 */
export function aggregateCells(field: GridField, cells: number[]): AreaStats {
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
    if (field.significance) {
      const flag = field.significance[index];
      if (flag !== null && flag !== undefined) {
        classified += 1;
        // 2 = models disagree on the sign of the change.
        if (flag !== 2) robust += 1;
      }
    }
  }

  return {
    mean: count ? sum / count : null,
    min: count ? min : null,
    max: count ? max : null,
    cellsWithData: count,
    cellsTotal: cells.length,
    agreement: classified ? robust / classified : null,
  };
}

// ---------------------------------------------------------------------------
// Coverage reporting
// ---------------------------------------------------------------------------

export interface GridCoverage {
  available: boolean;
  fieldCount: number;
  variables: string[];
  scenarios: string[];
  periods: string[];
  models: string[];
  /** Variables rasterised at monthly resolution — the seasonal-cycle view. */
  monthlyVariables: string[];
  /** Variables rasterised for at least one individual model, not just the ensemble. */
  perModelVariables: string[];
  generatedAt: string;
  sizeMb: number;
}

export async function gridCoverage(): Promise<GridCoverage> {
  const manifest = await loadManifest();
  return {
    available: manifest.fieldCount > 0,
    fieldCount: manifest.fieldCount,
    variables: manifest.variables,
    scenarios: manifest.scenarios,
    periods: manifest.periods,
    models: manifest.models,
    monthlyVariables: [
      ...new Set(
        manifest.fields
          .filter((field) => field.aggregation === "monthly")
          .map((field) => field.variable),
      ),
    ].sort(),
    perModelVariables: [
      ...new Set(
        manifest.fields
          .filter((field) => field.model !== ENSEMBLE_ID)
          .map((field) => field.variable),
      ),
    ].sort(),
    generatedAt: manifest.generatedAt,
    sizeMb: Number((manifest.totalBytes / 1e6).toFixed(2)),
  };
}

/**
 * Explain, in the reader's terms, why a field is missing.
 *
 * "No gridded field for this combination" is true and useless: it does not
 * say which of the five dimensions is at fault, so the reader cannot fix it.
 * This walks the manifest one axis at a time and names the first one that
 * fails, which is almost always the actionable one.
 */
export async function explainMissingField(key: FieldKey): Promise<{
  reason: string;
  hint: string;
}> {
  const manifest = await loadManifest();

  if (manifest.fieldCount === 0) {
    return {
      reason: "No climate grid has been extracted for this deployment.",
      hint: "Run the extraction pipeline, then reload. Until then the map is unavailable, though point and national values still work.",
    };
  }

  if (!manifest.variables.includes(key.variable)) {
    return {
      reason: `The indicator "${key.variable}" has not been rasterised locally.`,
      hint: "Pick another indicator, or run the extraction pipeline for a wider plan.",
    };
  }

  if (key.model !== ENSEMBLE_ID && !manifest.models.includes(key.model)) {
    return {
      reason: `Individual model output is not rasterised for "${key.variable}".`,
      hint: "The map can draw the multi-model ensemble for this indicator. Switch the model back to the ensemble, or use the model-spread panel, which reads individual models from the upstream archive.",
    };
  }

  if (!manifest.scenarios.includes(key.scenario)) {
    return {
      reason: `The pathway "${key.scenario}" has not been rasterised locally.`,
      hint: "SSP1-1.9 is published for a narrower set of indicators upstream. Try SSP1-2.6, SSP2-4.5, SSP3-7.0 or SSP5-8.5.",
    };
  }

  if (!manifest.periods.includes(key.period)) {
    return {
      reason: `The period ${key.period} has not been rasterised locally.`,
      hint: "Choose another horizon.",
    };
  }

  if (key.aggregation === "monthly") {
    return {
      reason: `Monthly climatology is not rasterised for "${key.variable}".`,
      hint: "Run the `seasonal` extraction plan to enable the seasonal-cycle view for this indicator.",
    };
  }

  return {
    reason: "This exact combination is not published in the archive.",
    hint: "The CMIP6 collection is legitimately sparse — not every indicator exists for every pathway and horizon. Point and national values may still be available.",
  };
}

/**
 * A percentile only means something across an ensemble.
 *
 * This is a `bad_request` rather than an `unsupported_combination`: it is not
 * that the archive happens not to publish this, it is that the quantity does
 * not exist. The distinction matters because handlers tolerate sparsity and
 * must not tolerate this.
 */
export function assertEnsemblePercentile(model: string, percentile: PercentileId) {
  if (model !== ENSEMBLE_ID && percentile !== "mean") {
    throw ApiError.badRequest(
      `Percentile "${percentile}" is only defined for the multi-model ensemble.`,
      {
        model,
        percentile,
        hint: "A percentile describes spread across models. For a single model, ask for the mean.",
      },
    );
  }
}
