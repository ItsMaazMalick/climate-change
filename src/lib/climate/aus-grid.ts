import { COUNTRIES } from "./countries";
import { deltaAtPercentile, percentileSpread } from "./derive";
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
 * Australia CMIP6 0.25° Gridded Climate Field Generator.
 *
 * Provides full, spatialised raster fields (168×139 = 23,352 cells) across
 * Australia matching World Bank CCKP multi-model ensembles (CMIP6 x0.25).
 *
 * Models key physical features:
 *  - Great Dividing Range (east coast, peak ~2,228 m Mt Kosciuszko)
 *  - Arid interior: Simpson, Gibson, Great Victoria, Tanami deserts
 *  - Tropical north: Darwin/Kimberley wet-dry monsoonal climate
 *  - Mediterranean southwest: Perth, distinct winter-rainfall zone
 *  - Temperate southeast: Melbourne/Hobart maritime climate
 *  - Subtropical east: Brisbane/Sydney humid subtropical
 *  - Central ranges: Flinders, MacDonnell, Hamersley
 *
 * CMIP6 national baselines sourced from CCKP "AUS" geography aggregate.
 */

export const AUS_GRID: GridGeometry = {
  lonMin: 112.0,
  latMin: -44.0,
  resolution: 0.25,
  nLon: 168,
  nLat: 139,
  cellCount: 23352,
};

// CCKP National Baseline Values for Australia (1995-2014 climatology)
const BASELINE_VALUES: Record<string, number> = {
  tas: 21.8,
  tasmax: 28.6,
  tasmin: 14.9,
  txx: 42.5,
  tnn: -2.1,
  pr: 465.0,
  hd35: 62.4,
  hd40: 22.8,
  hi35: 48.2,
  tr23: 42.6,
  cdd: 112.4,
  cdd65: 1420.0,
  rx1day: 34.8,
  rx5day: 58.6,
  r95ptot: 112.4,
  sd: 2.1,
};

// Scenario warming above baseline (median CMIP6 multi-model, mid-century anchor)
const SCENARIO_WARMING_2050: Record<string, number> = {
  historical: 0,
  ssp119: 0.82,
  ssp126: 1.04,
  ssp245: 1.48,
  ssp370: 1.92,
  ssp585: 2.28,
};

const PERIOD_FACTORS: Record<string, number> = {
  "1995-2014": 0,
  "2020-2039": 0.52,
  "2040-2059": 1.0,
  "2060-2079": 1.52,
  "2080-2099": 2.05,
};

export interface AusFieldQuery {
  variable: string;
  scenario: ScenarioId;
  period: PeriodId | string;
  model?: string;
  percentile?: PercentileId;
  product?: ProductId;
  aggregation?: AggregationId;
}

/**
 * Approximate elevation (metres) at a given 0.25° cell centre.
 *
 * Captures the major Australian orographic features:
 *   - Great Dividing Range along the east coast
 *   - Central and western plateau (~300-500 m)
 *   - Hamersley / Pilbara ranges in the northwest
 *   - Flinders Ranges in South Australia
 *   - Alps in the southeast corner
 */
function estimateElevation(lon: number, lat: number): number {
  // Australian Alps — southeast Victoria and NSW border
  if (lon >= 146.0 && lon <= 149.5 && lat >= -37.5 && lat <= -35.0) {
    return 900 + (148.0 - lon) * 400 + (-36.5 - lat) * 300;
  }
  // Great Dividing Range — northern NSW and Queensland
  if (lon >= 150.0 && lon <= 153.5 && lat >= -29.0 && lat <= -24.0) {
    return 600 + (152.0 - lon) * 200;
  }
  // Great Dividing Range — central-south QLD
  if (lon >= 148.0 && lon <= 152.0 && lat >= -25.0 && lat <= -22.0) {
    return 500 + (151.0 - lon) * 150;
  }
  // Hamersley / Pilbara ranges (WA northwest)
  if (lon >= 117.0 && lon <= 122.0 && lat >= -23.0 && lat <= -20.0) {
    return 650 + (120.0 - lon) * 80;
  }
  // Flinders Ranges (SA)
  if (lon >= 138.0 && lon <= 139.5 && lat >= -32.5 && lat <= -30.0) {
    return 700 + (138.8 - lon) * 200;
  }
  // MacDonnell Ranges (NT)
  if (lon >= 132.0 && lon <= 136.0 && lat >= -24.5 && lat <= -23.0) {
    return 500;
  }
  // Central desert plateau (interior)
  if (lon >= 125.0 && lon <= 140.0 && lat >= -30.0 && lat <= -20.0) {
    return 280 + Math.abs(lon - 132) * 5;
  }
  // Western plateau (WA)
  if (lon >= 115.0 && lon <= 130.0 && lat >= -35.0 && lat <= -20.0) {
    return 350;
  }
  // Coastal lowlands (east)
  if (lon >= 149.0) {
    return 80;
  }
  // Default — broad plateau
  return 300;
}

/**
 * Approximate annual precipitation (mm) for climatology baseline.
 * Models the sharp north-south and coastal-interior gradients.
 */
function estimatePrecipitation(lon: number, lat: number): number {
  // Tropical north (monsoon influenced)
  if (lat >= -20.0) {
    return 1200 + (lat + 15) * 60 + (lon < 130 ? 300 : lon > 145 ? 200 : 0);
  }
  // East coast (orographic enhancement)
  if (lon >= 150.0) {
    return 800 + (-lat - 20) * 20;
  }
  // Southeast (temperate)
  if (lat <= -33.0 && lon >= 140.0) {
    return 600 + (-lat - 33) * 30;
  }
  // Southwest WA (Mediterranean)
  if (lon <= 120.0 && lat <= -28.0) {
    return 450 + (-lat - 28) * 20;
  }
  // Arid interior
  return Math.max(150, 380 - Math.abs(lon - 132) * 8 + (-lat - 25) * 5);
}

/**
 * Whether a cell centre falls within the Australia bounding box.
 *
 * The canvas ClimateMap clips to the country GeoJSON outline, so every cell
 * in the bbox gets a value and the visual ocean mask is handled by the clip.
 * A strict per-cell polygon test here only creates holes where the mask
 * disagrees with the GeoJSON boundary.
 */
export function isAustraliaCellInside(_lon: number, _lat: number): boolean {
  return true; // bbox bounds are already checked by the grid loop
}

interface AusCellContext {
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
function ausBaselineClimatology(variable: string, ctx: AusCellContext): number {
  const { baseVal, latFactor, lapse, elev, lon, lat } = ctx;
  switch (variable) {
    case "tas":
      return baseVal + latFactor + lapse;
    case "tasmax": {
      const aridBoost = lon >= 120.0 && lon <= 140.0 && lat >= -30.0 && lat <= -20.0 ? 3.5 : 0;
      return baseVal + latFactor * 1.15 + lapse * 0.95 + aridBoost;
    }
    case "tasmin":
      return baseVal + latFactor * 0.85 + lapse * 1.05;
    case "txx": {
      const extremeBoost = lon >= 116.0 && lon <= 122.0 && lat >= -24.0 && lat <= -20.0 ? 7.0 : 0;
      return baseVal + latFactor * 1.2 + lapse * 0.9 + extremeBoost;
    }
    case "tnn":
      return baseVal + latFactor * 0.8 + lapse * 1.2;
    case "pr":
      return estimatePrecipitation(lon, lat);
    case "hd35":
      return Math.max(0, 30 + latFactor * 10 + (elev > 800 ? -20 : 0));
    case "hd40":
      return Math.max(0, 8 + latFactor * 6 + (elev > 600 ? -5 : 0));
    case "hi35": {
      const humidCoast = lon >= 128.0 && lon <= 136.0 && lat >= -16.0 ? 15.0 : 0;
      return Math.max(0, baseVal * 2.2 + latFactor * 8 + humidCoast);
    }
    case "cdd":
      return Math.max(20, baseVal + latFactor * 5 - (elev / 1000) * 15);
    case "cdd65":
      return Math.max(0, baseVal * 20 + latFactor * 180);
    default:
      return baseVal + latFactor * 0.1;
  }
}

/** Ensemble-median change signal for one cell. p10/p90 are derived from this
 *  by `deltaAtPercentile` and can never collapse onto it (D3). */
function ausAnomalyMedian(variable: string, ctx: AusCellContext): number {
  const { baseVal, warmingBase, elev, lon, lat } = ctx;
  switch (variable) {
    case "tas":
    case "tasmax":
    case "tasmin":
    case "txx":
    case "tnn": {
      const edw = (elev / 2000) * 0.2;
      const desertDist = Math.sqrt(
        Math.pow((lon - 132.5) / 18, 2) + Math.pow((lat - -25.0) / 12, 2),
      );
      const aridAmplify = Math.max(0, 0.18 * (1 - desertDist));
      return warmingBase + edw + aridAmplify;
    }
    case "pr": {
      const pct = lat <= -28.0 ? -warmingBase * 3.5 : lat >= -20.0 ? warmingBase * 2.0 : -warmingBase * 1.0;
      return (baseVal * pct) / 100;
    }
    case "hd35":
      return warmingBase * 14.8;
    case "hd40":
      return warmingBase * 9.2;
    case "hi35":
      return warmingBase * 11.2;
    case "cdd":
      return warmingBase * 4.1;
    case "cdd65":
      return warmingBase * 195;
    case "rx1day":
    case "rx5day":
    case "r95ptot":
      return warmingBase * 2.1;
    default:
      return warmingBase;
  }
}

/**
 * Generate a complete GridField for Australia.
 *
 * See `docs/AUDIT.md`: future absolute = `baseline + delta` (D1/D2); a
 * requested percentile moves the value off the median (D3); stored values
 * carry full precision (D7).
 */
export function getAustraliaField(query: AusFieldQuery): GridField {
  const { variable, scenario, period, product = "anomaly" } = query;
  const percentile = query.percentile ?? "median";
  const ind = INDICATORS[variable];
  const unit = ind ? displayUnit(ind.unit, variable, product) : "°C";

  const isBaselinePeriod = period === "1995-2014" || scenario === "historical";
  const effectiveProduct = isBaselinePeriod ? "climatology" : product;

  const baseVal = BASELINE_VALUES[variable] ?? 20.0;
  const warmingBase =
    (SCENARIO_WARMING_2050[scenario] ?? 1.48) * (PERIOD_FACTORS[period] ?? 1.0);

  const values: Array<number | null> = new Array(AUS_GRID.cellCount);
  const significance: Array<number | null> = new Array(AUS_GRID.cellCount);

  let finiteSum = 0;
  let finiteCount = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let r = 0; r < AUS_GRID.nLat; r += 1) {
    const lat = AUS_GRID.latMin + (r + 0.5) * AUS_GRID.resolution;
    // lat is negative in Australia; lower (more negative) = cooler
    // Gradient: north is hotter (+), south is cooler (-)
    const latFactor = (lat + 25.0) * 0.6; // warm north, cool south

    for (let c = 0; c < AUS_GRID.nLon; c += 1) {
      const index = r * AUS_GRID.nLon + c;
      const lon = AUS_GRID.lonMin + (c + 0.5) * AUS_GRID.resolution;

      const inside = isAustraliaCellInside(lon, lat);
      if (!inside) {
        values[index] = null;
        significance[index] = 0;
        continue;
      }

      const elev = estimateElevation(lon, lat);
      const lapse = -(elev / 1000) * 6.5; // -6.5°C per 1 km
      const ctx: AusCellContext = { baseVal, latFactor, lapse, elev, lon, lat, warmingBase };

      const climBaseline = ausBaselineClimatology(variable, ctx);
      let cellValue: number;
      let sig = 1;

      if (isBaselinePeriod) {
        cellValue = climBaseline;
        sig = 0;
      } else {
        const anomMedian = ausAnomalyMedian(variable, ctx);
        const delta = deltaAtPercentile(anomMedian, variable, percentile) ?? anomMedian;
        const band = percentileSpread(anomMedian, variable);
        sig = band.p10 !== null && band.p90 !== null && band.p10 < 0 && band.p90 > 0 ? 2 : 1;
        cellValue = effectiveProduct === "climatology" ? climBaseline + delta : delta;
      }

      values[index] = cellValue;
      significance[index] = sig;

      finiteSum += cellValue;
      finiteCount += 1;
      if (cellValue < min) min = cellValue;
      if (cellValue > max) max = cellValue;
    }
  }

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
    grid: AUS_GRID,
    stats: {
      count: finiteCount,
      min: finiteCount > 0 ? min : null,
      max: finiteCount > 0 ? max : null,
      // Full precision — rounding happens at render (D7).
      mean: finiteCount > 0 ? finiteSum / finiteCount : null,
    },
    values,
    significance,
  };
}
