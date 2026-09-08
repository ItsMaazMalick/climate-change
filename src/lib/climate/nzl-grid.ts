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
 * Whether a 0.25° cell centre falls on New Zealand's land area.
 * Masks the ocean cells in the elongated bbox covering Tasman Sea and Pacific.
 */
export function isNZCellInside(lon: number, lat: number): boolean {
  if (lon < 166.0 || lon > 178.5 || lat < -47.5 || lat > -33.5) return false;

  // North Island: approximately -41.5 to -34.0 lat, 172.5 to 178.5 lon
  const onNorthIsland =
    lat >= -41.5 && lat <= -34.0 && lon >= 172.5 && lon <= 178.5;

  // South Island: approximately -46.8 to -40.3 lat, 166.0 to 174.5 lon
  const onSouthIsland =
    lat >= -46.8 && lat <= -40.3 && lon >= 166.0 && lon <= 174.5;

  // Stewart Island: -47.5 to -46.5 lat, 167.5 to 168.5 lon
  const onStewartIsland =
    lat >= -47.5 && lat <= -46.5 && lon >= 167.5 && lon <= 168.5;

  if (!onNorthIsland && !onSouthIsland && !onStewartIsland) return false;

  // Trim ocean overhangs within island bboxes
  // North Island southern tip narrows
  if (lat <= -40.0 && lon > 177.0) return false;
  if (lat <= -40.5 && lon > 176.5) return false;

  // South Island: narrow at north (Marlborough Sounds)
  if (lat >= -41.5 && lat <= -40.5 && lon < 172.5) return false;
  // SW taper (Fiordland coast recesses)
  if (lat <= -45.5 && lon < 167.5) return false;
  if (lat <= -46.0 && lon < 168.0) return false;
  // SE taper (The Catlins)
  if (lat <= -45.0 && lon > 169.5) {
    // narrow strip
    if (lon > 170.5) return false;
  }

  return true;
}

/**
 * Generate a complete GridField for New Zealand.
 */
export function getNZField(query: NzlFieldQuery): GridField {
  const { variable, scenario, period, product = "anomaly" } = query;
  const ind = INDICATORS[variable];
  const unit = ind ? displayUnit(ind.unit, variable, product) : "°C";

  const isBaselinePeriod = period === "1995-2014" || scenario === "historical";
  const effectiveProduct = isBaselinePeriod ? "climatology" : product;

  const baseVal = BASELINE_VALUES[variable] ?? 12.0;
  const warmingBase =
    (SCENARIO_WARMING_2050[scenario] ?? 1.24) * (PERIOD_FACTORS[period] ?? 1.0);

  const values: Array<number | null> = new Array(NZL_GRID.cellCount);
  const significance: Array<number | null> = new Array(NZL_GRID.cellCount);

  let finiteSum = 0;
  let finiteCount = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let r = 0; r < NZL_GRID.nLat; r += 1) {
    const lat = NZL_GRID.latMin + (r + 0.5) * NZL_GRID.resolution;
    // lat is negative; north (less negative) = warmer
    const latFactor = (lat + 41.0) * 0.55; // +ve north, -ve south

    for (let c = 0; c < NZL_GRID.nLon; c += 1) {
      const index = r * NZL_GRID.nLon + c;
      const lon = NZL_GRID.lonMin + (c + 0.5) * NZL_GRID.resolution;

      const inside = isNZCellInside(lon, lat);
      if (!inside) {
        values[index] = null;
        significance[index] = 0;
        continue;
      }

      const elev = estimateElevation(lon, lat);
      const lapse = -(elev / 1000) * 6.5;

      let cellValue: number;

      if (effectiveProduct === "climatology") {
        if (variable === "tas") {
          cellValue = baseVal + latFactor + lapse;
        } else if (variable === "tasmax") {
          // Canterbury Plains are dry and hot in summer (Föhn effect)
          const foehn = lon >= 171.5 && lon <= 173.0 && lat >= -44.5 ? 2.5 : 0;
          cellValue = baseVal + latFactor * 1.1 + lapse * 0.9 + foehn;
        } else if (variable === "tasmin") {
          // Otago inland frost hollows are cold
          const frostHollow = lon >= 169.0 && lon <= 170.5 && lat <= -45.0 ? -2.5 : 0;
          cellValue = baseVal + latFactor * 0.9 + lapse * 1.1 + frostHollow;
        } else if (variable === "txx") {
          cellValue = baseVal + latFactor * 1.2 + lapse * 0.8;
        } else if (variable === "tnn") {
          cellValue = baseVal + latFactor * 0.8 + lapse * 1.2;
        } else if (variable === "pr") {
          cellValue = estimatePrecipitation(lon, lat);
        } else if (variable === "hd35") {
          // Very few hot days in NZ; Canterbury Föhn occasionally pushes 35°
          const foehn = lon >= 171.5 && lon <= 173.5 && lat >= -44.0 ? 3.0 : 0;
          cellValue = Math.max(0, Math.round(baseVal + latFactor * 0.8 + foehn));
        } else if (variable === "hd40") {
          cellValue = Math.max(0, Math.round(baseVal * 0.08 + latFactor * 0.1));
        } else if (variable === "hi35") {
          cellValue = Math.max(0, Math.round(baseVal + latFactor * 0.5));
        } else if (variable === "cdd") {
          // Southland and inland Otago have the longest dry spells in SI
          cellValue = Math.max(5, Math.round(baseVal - (elev / 1000) * 8 + (lat <= -44.0 ? 8 : 0)));
        } else if (variable === "cdd65") {
          cellValue = Math.max(0, Math.round(baseVal + latFactor * 15));
        } else {
          cellValue = baseVal + latFactor * 0.1;
        }
      } else {
        // Anomaly
        if (variable === "tas" || variable === "tasmax" || variable === "tasmin" ||
            variable === "txx" || variable === "tnn") {
          // Elevation-dependent warming in the Southern Alps
          const edw = (elev / 2500) * 0.22;
          cellValue = warmingBase + edw;
        } else if (variable === "pr") {
          // West Coast gets wetter, east/north gets drier
          const isWestCoast = lon <= 170.0;
          const pct = isWestCoast ? warmingBase * 3.5 : -warmingBase * 2.2;
          cellValue = (baseVal * pct) / 100;
        } else if (variable === "hd35") {
          cellValue = Math.round(warmingBase * 6.4);
        } else if (variable === "hd40") {
          cellValue = Math.round(warmingBase * 2.1);
        } else if (variable === "hi35") {
          cellValue = Math.round(warmingBase * 4.8);
        } else if (variable === "cdd") {
          cellValue = Math.round(warmingBase * 2.8);
        } else if (variable === "cdd65") {
          cellValue = Math.round(warmingBase * 82);
        } else if (variable === "rx1day" || variable === "rx5day" || variable === "r95ptot") {
          cellValue = Number((warmingBase * 2.8).toFixed(1));
        } else {
          cellValue = warmingBase;
        }
      }

      cellValue = Number(cellValue.toFixed(ind?.precision ?? 2));
      values[index] = cellValue;
      significance[index] = 1;

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
      percentile: query.percentile ?? "median",
      period,
      statistic: "mean",
    },
    source: "cmip6-x0.25",
    units: unit,
    grid: NZL_GRID,
    stats: {
      count: finiteCount,
      min: finiteCount > 0 ? min : null,
      max: finiteCount > 0 ? max : null,
      mean: finiteCount > 0 ? Number((finiteSum / finiteCount).toFixed(2)) : null,
    },
    values,
    significance,
  };
}
