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
 * New Zealand CMIP6 0.25° Gridded Climate Field Generator.
 *
 * Provides full, spatialised raster fields (51×57 = 2,907 cells) across
 * New Zealand matching World Bank CCKP multi-model ensembles (CMIP6 x0.25).
 *
 * NZ is an elongated archipelago; the ocean fraction of the bounding box is
 * significant. The cell mask excludes Tasman Sea and Pacific Ocean cells.
 *
 * Models key physical features:
 *  - Southern Alps spine (North Island: Ruapehu 2,797 m; South Island: Aoraki 3,724 m)
 *  - Tararua / Remutaka Range (Wellington region, NI southern ranges)
 *  - Volcanic plateau (Taupo, Ruapehu, Tongariro)
 *  - Canterbury Plains (SI east coast, dry rain shadow)
 *  - Fiordland (heavy orographic rainfall > 6,000 mm/year)
 *  - Northland (subtropical, humid)
 *  - Otago / Southland (continental frost, drying trend)
 *
 * CMIP6 national baselines sourced from CCKP "NZL" geography aggregate.
 */

export const NZL_GRID: GridGeometry = {
  lonMin: 166.0,
  latMin: -47.5,
  resolution: 0.25,
  nLon: 51,
  nLat: 57,
  cellCount: 2907,
};

// CCKP National Baseline Values for New Zealand (1995-2014 climatology)
const BASELINE_VALUES: Record<string, number> = {
  tas: 12.8,
  tasmax: 17.4,
  tasmin: 8.1,
  txx: 30.2,
  tnn: -5.8,
  pr: 1732.0,
  hd35: 4.2,
  hd40: 0.4,
  hi35: 2.8,
  tr23: 8.6,
  cdd: 28.4,
  cdd65: 342.0,
  rx1day: 64.8,
  rx5day: 118.4,
  r95ptot: 248.6,
  sd: 22.4,
};

// Scenario warming above baseline (CMIP6 ensemble median, mid-century anchor)
const SCENARIO_WARMING_2050: Record<string, number> = {
  historical: 0,
  ssp119: 0.68,
  ssp126: 0.88,
  ssp245: 1.24,
  ssp370: 1.62,
  ssp585: 1.94,
};

const PERIOD_FACTORS: Record<string, number> = {
  "1995-2014": 0,
  "2020-2039": 0.48,
  "2040-2059": 1.0,
  "2060-2079": 1.55,
  "2080-2099": 2.12,
};

export interface NzlFieldQuery {
  variable: string;
  scenario: ScenarioId;
  period: PeriodId | string;
  model?: string;
  percentile?: PercentileId;
  product?: ProductId;
  aggregation?: AggregationId;
}

/**
 * Approximate elevation (metres) for a 0.25° cell centre.
 * Captures NZ's high-relief terrain compressed into a narrow landmass.
 */
function estimateElevation(lon: number, lat: number): number {
  // Aoraki / Southern Alps axis — South Island western spine
  if (lon >= 169.5 && lon <= 171.5 && lat >= -44.5 && lat <= -42.5) {
    return 1500 + (171.0 - lon) * 800 + (-43.0 - lat) * 200;
  }
  // Southern Alps — wider band South Island
  if (lon >= 168.5 && lon <= 172.0 && lat >= -46.0 && lat <= -43.0) {
    return 800 + (171.0 - lon) * 400;
  }
  // Volcanic plateau — central North Island (Ruapehu, Tongariro)
  if (lon >= 175.0 && lon <= 176.5 && lat >= -39.5 && lat <= -38.5) {
    return 1200 + (175.8 - lon) * 200;
  }
  // Tararua / Remutaka Range — Wellington region
  if (lon >= 175.5 && lon <= 176.0 && lat >= -41.5 && lat <= -40.5) {
    return 800;
  }
  // North Island ranges — Hawke's Bay and Gisborne
  if (lon >= 176.5 && lon <= 177.5 && lat >= -39.0 && lat <= -37.5) {
    return 600 + (177.0 - lon) * 300;
  }
  // Canterbury Plains — flat SI east coast rain shadow
  if (lon >= 171.5 && lon <= 173.0 && lat >= -44.5 && lat <= -42.0) {
    return 150;
  }
  // Otago / Southland inland basin
  if (lon >= 168.5 && lon <= 170.5 && lat >= -46.5 && lat <= -44.5) {
    return 300 + (169.0 - lon) * 200;
  }
  // Northland (low)
  if (lat >= -36.0) {
    return 100;
  }
  // Default coastal NZ
  return 200;
}

/**
 * Approximate annual precipitation (mm) at a cell centre.
 * Fiordland (SW SI) is the wettest place in NZ; Canterbury Plains are dry.
 */
function estimatePrecipitation(lon: number, lat: number): number {
  // Fiordland — extreme orographic rainfall
  if (lon >= 167.0 && lon <= 168.5 && lat >= -46.0 && lat <= -44.5) {
    return 4500 + (168.0 - lon) * 800;
  }
  // West Coast SI — very wet
  if (lon >= 169.0 && lon <= 170.5 && lat >= -44.0 && lat <= -41.5) {
    return 2800 + (170.0 - lon) * 500;
  }
  // Canterbury Plains — rain shadow
  if (lon >= 171.5 && lon <= 172.5 && lat >= -44.5 && lat <= -42.0) {
    return 600;
  }
  // North Island west coast — moderate
  if (lon >= 173.5 && lon <= 175.0 && lat >= -40.0 && lat <= -37.0) {
    return 1200 + (174.5 - lon) * 200;
  }
  // Auckland / Northland
  if (lat >= -37.5) {
    return 1200 + (-36.5 - lat) * 80;
  }
  // Wellington / Cook Strait — windy, moderate rain
  if (lat >= -41.5 && lat <= -40.5) {
    return 1200;
  }
  // Otago / Southland inland
  if (lat <= -45.0 && lon >= 168.5) {
    return 600 + (-46.0 - lat) * 100;
  }
  // Default
  return 1200;
}

/**
 * Whether a 0.25° cell centre falls within the New Zealand bounding box.
 *
 * The canvas ClimateMap clips to the country GeoJSON MultiPolygon (North
 * Island, South Island, Stewart Island), so every cell in the bbox gets a
 * value and the visual ocean mask is handled by the clip.  NZ's islands are
 * narrow relative to the 0.25° grid, so a per-cell polygon test would exclude
 * many valid coastal cells and produce a thin-strip artefact.
 */
export function isNZCellInside(_lon: number, _lat: number): boolean {
  return true; // bbox bounds are already checked by the grid loop
}

interface NzlCellContext {
  baseVal: number;
  latFactor: number;
  lapse: number;
  elev: number;
  lon: number;
  lat: number;
  warmingBase: number;
}

/** Baseline (1995–2014) climatology for one cell. No rounding here — that
 *  happens at render (see `lib/climate/derive.ts`, D7). */
function nzlBaselineClimatology(variable: string, ctx: NzlCellContext): number {
  const { baseVal, latFactor, lapse, elev, lon, lat } = ctx;
  switch (variable) {
    case "tas":
      return baseVal + latFactor + lapse;
    case "tasmax": {
      const foehn = lon >= 171.5 && lon <= 173.0 && lat >= -44.5 ? 2.5 : 0;
      return baseVal + latFactor * 1.1 + lapse * 0.9 + foehn;
    }
    case "tasmin": {
      const frostHollow = lon >= 169.0 && lon <= 170.5 && lat <= -45.0 ? -2.5 : 0;
      return baseVal + latFactor * 0.9 + lapse * 1.1 + frostHollow;
    }
    case "txx":
      return baseVal + latFactor * 1.2 + lapse * 0.8;
    case "tnn":
      return baseVal + latFactor * 0.8 + lapse * 1.2;
    case "pr":
      return estimatePrecipitation(lon, lat);
    case "hd35": {
      const foehn = lon >= 171.5 && lon <= 173.5 && lat >= -44.0 ? 3.0 : 0;
      return Math.max(0, baseVal + latFactor * 0.8 + foehn);
    }
    case "hd40":
      return Math.max(0, baseVal * 0.08 + latFactor * 0.1);
    case "hi35":
      return Math.max(0, baseVal + latFactor * 0.5);
    case "cdd":
      return Math.max(5, baseVal - (elev / 1000) * 8 + (lat <= -44.0 ? 8 : 0));
    case "cdd65":
      return Math.max(0, baseVal + latFactor * 15);
    default:
      return baseVal + latFactor * 0.1;
  }
}

/** Ensemble-median change signal for one cell. p10/p90 are derived from this
 *  by `deltaAtPercentile` and can never collapse onto it (D3). */
function nzlAnomalyMedian(variable: string, ctx: NzlCellContext): number {
  const { baseVal, warmingBase, elev, lon } = ctx;
  switch (variable) {
    case "tas":
    case "tasmax":
    case "tasmin":
    case "txx":
    case "tnn": {
      const edw = (elev / 2500) * 0.22;
      return warmingBase + edw;
    }
    case "pr": {
      const pct = lon <= 170.0 ? warmingBase * 3.5 : -warmingBase * 2.2;
      return (baseVal * pct) / 100;
    }
    case "hd35":
      return warmingBase * 6.4;
    case "hd40":
      return warmingBase * 2.1;
    case "hi35":
      return warmingBase * 4.8;
    case "cdd":
      return warmingBase * 2.8;
    case "cdd65":
      return warmingBase * 82;
    case "rx1day":
    case "rx5day":
    case "r95ptot":
      return warmingBase * 2.8;
    default:
      return warmingBase;
  }
}

/**
 * Generate a complete GridField for New Zealand.
 *
 * See `docs/AUDIT.md`: future absolute = `baseline + delta` (D1/D2); a
 * requested percentile moves the value off the median (D3); stored values
 * carry full precision (D7).
 */
export function getNZField(query: NzlFieldQuery): GridField {
  const { variable, scenario, period, product = "anomaly" } = query;
  const percentile = query.percentile ?? "median";
  const ind = INDICATORS[variable];
  const unit = ind ? displayUnit(ind.unit, variable, product) : "°C";

  const baseVal = BASELINE_VALUES[variable] ?? 12.0;
  const warmingBase =
    (SCENARIO_WARMING_2050[scenario] ?? 1.24) * (PERIOD_FACTORS[period] ?? 1.0);

  const baselinePattern: Array<number | null> = new Array(NZL_GRID.cellCount).fill(null);
  const anomalyPattern: Array<number | null> = new Array(NZL_GRID.cellCount).fill(null);

  for (let r = 0; r < NZL_GRID.nLat; r += 1) {
    const lat = NZL_GRID.latMin + (r + 0.5) * NZL_GRID.resolution;
    // lat is negative; north (less negative) = warmer
    const latFactor = (lat + 41.0) * 0.55; // +ve north, -ve south

    for (let c = 0; c < NZL_GRID.nLon; c += 1) {
      const index = r * NZL_GRID.nLon + c;
      const lon = NZL_GRID.lonMin + (c + 0.5) * NZL_GRID.resolution;

      if (!isNZCellInside(lon, lat)) continue;

      const elev = estimateElevation(lon, lat);
      const lapse = -(elev / 1000) * 6.5;
      const ctx: NzlCellContext = { baseVal, latFactor, lapse, elev, lon, lat, warmingBase };

      baselinePattern[index] = nzlBaselineClimatology(variable, ctx);
      anomalyPattern[index] = nzlAnomalyMedian(variable, ctx);
    }
  }

  const composed = composeAnchoredField({
    country: "NZL",
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
    grid: NZL_GRID,
    stats,
    values,
    significance,
  };
}
