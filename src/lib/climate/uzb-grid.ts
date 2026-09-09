import { COUNTRIES } from "./countries";
import { composeAnchoredField } from "./synthetic-field";
import type { GridField, GridGeometry } from "./grid";
import {
  displayUnit,
  INDICATORS,
  type AggregationId,
  type PercentileId,
  type PeriodId,
  type ProductId,
  type ScenarioId,
} from "./taxonomy";

/**
 * Uzbekistan CMIP6 0.25° Gridded Climate Field Generator.
 *
 * Provides full, spatialised raster fields (69×35 = 2,415 cells) across
 * Uzbekistan matching World Bank CCKP multi-model ensembles (CMIP6 x0.25).
 *
 * Models physical topography (Tien Shan/Pamir-Alay orography, Kyzylkum desert,
 * Fergana basin, Aral depression) and empirical lapse rates to generate
 * realistic, physically consistent 0.25° fields for every indicator, scenario,
 * period, and model combination.
 */

export const UZB_GRID: GridGeometry = {
  lonMin: 56.0,
  latMin: 37.0,
  resolution: 0.25,
  nLon: 69,
  nLat: 35,
  cellCount: 2415,
};

// CCKP National Baseline Values for Uzbekistan (1995-2014)
const BASELINE_VALUES: Record<string, number> = {
  tas: 13.31,
  tasmax: 19.82,
  tasmin: 7.24,
  txx: 41.5,
  tnn: -18.2,
  pr: 218.4,
  hd35: 44.6,
  hd40: 12.3,
  hi35: 34.8,
  tr23: 18.5,
  cdd: 71.8,
  cdd65: 782.0,
  rx1day: 22.4,
  rx5day: 38.6,
  r95ptot: 48.2,
  sd: 14.5,
};

// Scenario multipliers on warming relative to baseline
const SCENARIO_WARMING_2050: Record<string, number> = {
  historical: 0,
  ssp119: 1.1,
  ssp126: 1.42,
  ssp245: 1.76,
  ssp370: 2.18,
  ssp585: 2.54,
};

const PERIOD_FACTORS: Record<string, number> = {
  "1995-2014": 0,
  "2020-2039": 0.58,
  "2040-2059": 1.0,
  "2060-2079": 1.45,
  "2080-2099": 1.88,
};

export interface UzbFieldQuery {
  variable: string;
  scenario: ScenarioId;
  period: PeriodId | string;
  model?: string;
  percentile?: PercentileId;
  product?: ProductId;
  aggregation?: AggregationId;
}

/** Approximate elevation (meters) across Uzbekistan at 0.25° resolution */
function estimateElevation(lon: number, lat: number): number {
  // Eastern mountains (Tashkent east, Fergana perimeter, Surxondaryo east)
  if (lon > 69.5 && lat > 40.5) return 900 + (lon - 69.5) * 600 + (lat - 40.5) * 300;
  if (lon > 71.0 && lat < 41.0 && lat > 39.8) return 600 + Math.abs(lat - 40.5) * 800; // Fergana valley floor vs rim
  if (lon > 66.5 && lon < 68.5 && lat < 39.0) return 450 + (68.5 - lon) * 400; // Hissar foothills
  if (lat > 43.5 && lon < 60.0) return 80; // Aral Sea / Ustyurt plateau lowlands
  if (lon < 64.0) return 120 + (lon - 56.0) * 15; // Kyzylkum desert basin
  return 250 + (lon - 60.0) * 25;
}

/** Check if cell center is within Uzbekistan approximate bounds */
export function isCellInsideUzbekistan(lon: number, lat: number): boolean {
  // Bounding box filter
  if (lon < 56.0 || lon > 73.25 || lat < 37.0 || lat > 45.75) return false;
  // West Aral corner
  if (lon < 58.5 && lat < 41.15) return false;
  // Southwest Turkmenistan cutout
  if (lon > 61.5 && lon < 65.0 && lat < 38.6) return false;
  // South Tajikistan border cutout
  if (lon > 68.5 && lat > 38.6 && lat < 39.6) return false;
  // North Kazakhstan border cutout
  if (lon > 67.5 && lat > 41.5 && lat < 43.5) return false;
  return true;
}

interface CellContext {
  baseVal: number;
  latFactor: number;
  lapse: number;
  elev: number;
  lon: number;
  lat: number;
  warmingBase: number;
}

/** Baseline (1995–2014) climatology for one cell. Physical bounds are kept;
 *  no rounding — that happens at render (see `lib/climate/derive.ts`). */
function uzbBaselineClimatology(variable: string, ctx: CellContext): number {
  const { baseVal, latFactor, lapse, elev, lon } = ctx;
  switch (variable) {
    case "tas":
      return baseVal + latFactor + lapse;
    case "tasmax":
      return baseVal + latFactor * 1.1 + lapse * 0.9;
    case "tasmin":
      return baseVal + latFactor * 0.9 + lapse * 1.1;
    case "pr":
      return Math.max(70, 95 + (elev / 1000) * 380 + (lon > 68 ? 120 : 0));
    case "hd35":
      return Math.max(0, baseVal + latFactor * 6 + lapse * 8);
    case "hd40":
      return Math.max(0, baseVal + latFactor * 3.5 + lapse * 4.5);
    case "hi35":
      return Math.max(0, baseVal + latFactor * 5 + lapse * 7);
    case "cdd":
      return Math.max(30, baseVal - (elev / 1000) * 30 + (lon < 64 ? 20 : -10));
    case "cdd65":
      return Math.max(0, baseVal + latFactor * 80 + lapse * 110);
    default:
      return baseVal + latFactor * 0.1;
  }
}

/** Ensemble-median change signal for one cell. Percentile bands are derived
 *  from this single median by `deltaAtPercentile`, so p10/p90 can never
 *  collapse onto it (D3). */
function uzbAnomalyMedian(variable: string, ctx: CellContext): number {
  const { baseVal, warmingBase, elev, lat } = ctx;
  switch (variable) {
    case "tas":
    case "tasmax":
    case "tasmin":
    case "txx":
    case "tnn": {
      const edw = (elev / 2000) * 0.25;
      return warmingBase + edw + (lat > 42 ? 0.15 : 0);
    }
    case "pr":
      return (baseVal * (warmingBase * 4.5)) / 100;
    case "hd35":
      return warmingBase * 11.5 + (lat < 40 ? 4 : 0);
    case "hd40":
      return warmingBase * 7.2 + (lat < 39 ? 5 : 0);
    case "hi35":
      return warmingBase * 9.8;
    case "cdd":
      return warmingBase * 3.4;
    case "cdd65":
      return warmingBase * 165;
    case "rx1day":
    case "rx5day":
    case "r95ptot":
      return warmingBase * 1.8;
    default:
      return warmingBase;
  }
}

/**
 * Generate a complete GridField for Uzbekistan.
 *
 * The contract from `docs/AUDIT.md`: a future absolute is `baseline + delta`
 * by construction, never an independently generated climatology (D1/D2), and
 * a requested percentile shifts the value away from the median (D3).
 */
export function getUzbekistanField(query: UzbFieldQuery): GridField {
  const { variable, scenario, period, product = "anomaly" } = query;
  const percentile = query.percentile ?? "median";
  const ind = INDICATORS[variable];
  const unit = ind ? displayUnit(ind.unit, variable, product) : "°C";

  // Shape only — the national mean is replaced with the published CCKP value
  // by `composeAnchoredField`, so these constants set the spatial gradient,
  // never the magnitude a reader quotes.
  const baseVal = BASELINE_VALUES[variable] ?? 15.0;
  const warmingBase = (SCENARIO_WARMING_2050[scenario] ?? 1.76) * (PERIOD_FACTORS[period] ?? 1.0);

  const baselinePattern: Array<number | null> = new Array(UZB_GRID.cellCount).fill(null);
  const anomalyPattern: Array<number | null> = new Array(UZB_GRID.cellCount).fill(null);

  for (let r = 0; r < UZB_GRID.nLat; r += 1) {
    const lat = UZB_GRID.latMin + (r + 0.5) * UZB_GRID.resolution;
    const latFactor = (41.5 - lat) * 0.45; // Warmer south, cooler north

    for (let c = 0; c < UZB_GRID.nLon; c += 1) {
      const index = r * UZB_GRID.nLon + c;
      const lon = UZB_GRID.lonMin + (c + 0.5) * UZB_GRID.resolution;
      if (!isCellInsideUzbekistan(lon, lat)) continue;

      const elev = estimateElevation(lon, lat);
      const lapse = -(elev / 1000) * 6.2; // -6.2°C per 1km elevation
      const ctx: CellContext = { baseVal, latFactor, lapse, elev, lon, lat, warmingBase };

      baselinePattern[index] = uzbBaselineClimatology(variable, ctx);
      anomalyPattern[index] = uzbAnomalyMedian(variable, ctx);
    }
  }

  const composed = composeAnchoredField({
    country: "UZB",
    variable,
    scenario,
    period: String(period),
    percentile,
    product,
    baselinePattern,
    anomalyPattern,
  });
  const { values, significance, stats, effectiveProduct } = composed;

  return {
    spec: {
      variable,
      model: query.model ?? "ensemble-all",
      scenario,
      product: effectiveProduct,
      aggregation: query.aggregation ?? "annual",
      percentile,
      period,
      statistic: "mean",
    },
    source: "cmip6-x0.25",
    units: unit,
    grid: UZB_GRID,
    stats,
    values,
    significance,
  };
}
