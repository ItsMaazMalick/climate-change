import { env, hasDatabase } from "@/lib/env";
import { ApiError } from "@/lib/errors";

import { fetchCckp, fetchTimeseries, type CckpSeries } from "./cckp";
import {
  aggregateCells,
  assertEnsemblePercentile,
  cellAt,
  cellCentre,
  cycleAt,
  layerAt,
  layerForMonth,
  loadCellIndex,
  loadField,
  nearestValued,
  type GridField,
} from "./grid";
import { lookupArea } from "./db-store";
import {
  CountryCode,
  detectCountryFromCoords,
  getCountry,
  isInsideCountryBounds,
} from "./countries";
import { getUzbekistanField } from "./uzb-grid";
import { getAustraliaField } from "./aus-grid";
import { getNZField } from "./nzl-grid";
import {
  BASELINE_PERIOD,
  ENSEMBLE_ID,
  INDICATORS,
  type AggregationId,
  type PercentileId,
  type PeriodId,
  type ProductId,
  type ScenarioId,
} from "./taxonomy";

/**
 * The query resolver.
 *
 * Every climate question in the application reduces to one shape, and this
 * module answers it from whichever source can. The resolution order is
 * deliberate:
 *
 *   1. **Local grid** — a rasterised Pakistan subset. Sub-millisecond, and
 *      the only source that can answer "what is the value *at this point*".
 *   2. **Upstream aggregate API** — authoritative for any combination in the
 *      full catalogue, but only at whole-geography resolution and slow.
 *
 * Which source answered is always reported back, because a value averaged
 * over the whole country is a different claim from a value at a 25 km cell,
 * and the UI must not present them identically.
 */

export type SourceKind = "grid" | "upstream" | "database";

export interface ResolutionMeta {
  source: SourceKind;
  /**
   * `point`     — read from a locally rasterised 0.25° cell.
   * `interpolated` — spatial pattern interpolated from elevation/latitude and
   *                  anchored to the published national aggregate. Real
   *                  magnitude, modelled spatial detail.
   * `area`      — mean of the cells inside an admin unit.
   * `national`  — the published country-wide aggregate, unmodified.
   */
  spatialScope: "point" | "interpolated" | "area" | "national";
  /**
   * Set when the nearest valued cell was not the cell containing the request
   * point (coastline, model land mask). Distance in whole grid cells.
   */
  offsetCells?: number;
  /** Fraction of models agreeing on the sign of change, where published. */
  agreement?: number | null;
  note?: string;
}

export interface ClimateQuery {
  indicator: string;
  scenario: ScenarioId;
  period: PeriodId;
  model?: string;
  percentile?: PercentileId;
  product?: ProductId;
  aggregation?: AggregationId;
}

export interface PointQuery extends ClimateQuery {
  lat: number;
  lon: number;
  /** For monthly and seasonal fields: which month to read (1–12). */
  month?: number;
}

export interface AreaQuery extends ClimateQuery {
  /** Admin unit id from the geo layer, e.g. `punjab` or `larkana`. */
  areaId: string;
}

export interface ClimateValue {
  value: number | null;
  unit: string;
  indicator: string;
  scenario: ScenarioId;
  period: PeriodId;
  model: string;
  percentile: PercentileId;
  product: ProductId;
  aggregation: AggregationId;
  meta: ResolutionMeta;
  /** Present for area queries. */
  spread?: { min: number | null; max: number | null; cells: number };
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

function normalise(query: ClimateQuery) {
  const indicator = INDICATORS[query.indicator];
  if (!indicator) {
    throw ApiError.badRequest(`Unknown indicator "${query.indicator}".`);
  }

  const model = query.model ?? ENSEMBLE_ID;
  const product = query.product ?? "climatology";
  const aggregation = query.aggregation ?? "annual";
  const percentile: PercentileId =
    query.percentile ?? (model === ENSEMBLE_ID ? "median" : "mean");

  assertEnsemblePercentile(model, percentile);

  if (query.period === BASELINE_PERIOD && query.scenario !== "historical") {
    // The baseline window belongs to the historical run regardless of which
    // pathway the user is exploring — the scenarios have not diverged yet.
    return {
      indicator,
      model,
      product,
      aggregation,
      percentile,
      scenario: "historical" as ScenarioId,
      period: query.period,
    };
  }

  if (product === "anomaly" && query.period === BASELINE_PERIOD) {
    throw ApiError.unsupported(
      "An anomaly against the baseline period is zero by definition.",
      "Choose a future period, or switch to the absolute climatology.",
    );
  }

  return {
    indicator,
    model,
    product,
    aggregation,
    percentile,
    scenario: query.scenario,
    period: query.period,
  };
}

function unitOf(indicatorId: string, product: ProductId): string {
  const indicator = INDICATORS[indicatorId];
  if (!indicator) return "";
  if (product === "anomaly" && indicator.anomalyUnit) return indicator.anomalyUnit;
  return indicator.unit;
}

// ---------------------------------------------------------------------------
// Point queries
// ---------------------------------------------------------------------------

/**
 * Value at a specific coordinate.
 *
 * Only the local grid can answer this honestly. When the field has not been
 * rasterised we fall back to the national aggregate and say so, rather than
 * silently presenting a country-wide mean as a local value.
 */
export async function resolvePoint(query: PointQuery): Promise<ClimateValue> {
  const n = normalise(query);

  const country = detectCountryFromCoords(query.lat, query.lon);
  if (!isInsideCountryBounds(query.lat, query.lon, country)) {
    throw ApiError.badRequest(
      "Coordinates fall outside supported country extents (Pakistan, Uzbekistan, Australia and New Zealand).",
      { coordinates: { lat: query.lat, lon: query.lon } },
    );
  }

  const countryConfig = getCountry(country);
  const base = {
    unit: unitOf(n.indicator.id, n.product),
    indicator: n.indicator.id,
    scenario: n.scenario,
    period: n.period as PeriodId,
    model: n.model,
    percentile: n.percentile,
    product: n.product,
    aggregation: n.aggregation,
  };

  // Synthetic grid resolution for countries that use generated fields
  const syntheticField =
    country === "UZB"
      ? getUzbekistanField({ variable: n.indicator.id, scenario: n.scenario, period: n.period, model: n.model, percentile: n.percentile, product: n.product, aggregation: n.aggregation })
      : country === "AUS"
        ? getAustraliaField({ variable: n.indicator.id, scenario: n.scenario, period: n.period, model: n.model, percentile: n.percentile, product: n.product, aggregation: n.aggregation })
        : country === "NZL"
          ? getNZField({ variable: n.indicator.id, scenario: n.scenario, period: n.period, model: n.model, percentile: n.percentile, product: n.product, aggregation: n.aggregation })
          : null;

  if (syntheticField) {
    const hit = nearestValued(syntheticField, query.lon, query.lat);
    if (hit) {
      // Honest label: the magnitude is the published CCKP national value
      // (see lib/climate/national-anchors.ts), but the spatial detail is an
      // elevation/latitude interpolation, not a rasterised grid cell.
      return {
        ...base,
        value: hit.value,
        meta: {
          source: "grid",
          spatialScope: "interpolated",
          agreement: 1,
          note: `Anchored to the published ${countryConfig.name} national value for this indicator, pathway and horizon; the variation within the country is interpolated from elevation and latitude, not read from a rasterised grid cell.`,
        },
      };
    }
  }

  if (env.CLIMATE_STORE_MODE !== "upstream") {
    const field = await loadField({
      variable: n.indicator.id,
      product: n.product,
      aggregation: n.aggregation,
      scenario: n.scenario,
      model: n.model,
      percentile: n.percentile,
      period: n.period,
    });
    if (field) {
      // Monthly and seasonal fields stack twelve or four lattices; pick the
      // requested slice before anything downstream sees a layer axis.
      const slice =
        query.month !== undefined
          ? layerAt(field, layerForMonth(field, query.month) ?? 0)
          : layerAt(field, 0);
      const hit = nearestValued(slice, query.lon, query.lat);
      if (hit) {
        const flag = slice.significance?.[hit.cell.index] ?? null;
        return {
          ...base,
          value: hit.value,
          meta: {
            source: "grid",
            spatialScope: "point",
            ...(hit.offsetCells > 0 ? { offsetCells: hit.offsetCells } : {}),
            agreement: flag === null ? null : flag === 2 ? 0 : 1,
            ...(hit.offsetCells > 0
              ? {
                  note: `The model grid has no value at this exact point; showing the nearest cell with data, ${hit.offsetCells} cell${hit.offsetCells > 1 ? "s" : ""} away.`,
                }
              : {}),
          },
        };
      }
    }
    if (env.CLIMATE_STORE_MODE === "grid") {
      throw ApiError.unsupported(
        "This indicator and scenario combination has not been rasterised locally.",
        "Run the extraction pipeline for a wider plan, or enable upstream fallback.",
      );
    }
  }

  const upstream = await fetchCckp({
    geography: country,
    variable: n.indicator.id,
    product: n.product,
    aggregation: n.aggregation,
    period: n.period,
    percentile: n.percentile,
    scenario: n.scenario,
    model: n.model,
  });

  if (!upstream) {
    throw ApiError.unsupported(
      `The archive does not publish ${n.indicator.label} for ${n.scenario} over ${n.period} for ${countryConfig.name}.`,
      "Not every indicator is released for every pathway. Try SSP2-4.5, or a different indicator.",
    );
  }

  return {
    ...base,
    value: upstream.value,
    meta: {
      source: "upstream",
      spatialScope: "national",
      note: `Averaged over all of ${countryConfig.name} — this indicator has not been rasterised locally, so a point value is not available.`,
    },
  };
}

// ---------------------------------------------------------------------------
// Area queries
// ---------------------------------------------------------------------------

export async function resolveArea(query: AreaQuery): Promise<ClimateValue> {
  const n = normalise(query);

  // An unknown area id must be an error, not a national average wearing the
  // area's name. Silently widening the spatial scope is the single most
  // misleading thing this function could do.
  const known = await loadCellIndex();
  if (!known.has(query.areaId)) {
    throw ApiError.notFound(
      `No administrative unit with id "${query.areaId}".`,
    );
  }
  const base = {
    unit: unitOf(n.indicator.id, n.product),
    indicator: n.indicator.id,
    scenario: n.scenario,
    period: n.period as PeriodId,
    model: n.model,
    percentile: n.percentile,
    product: n.product,
    aggregation: n.aggregation,
  };

  // The database first: it holds the same aggregate the grid would compute,
  // already reduced, and it is the only path that survives a deployment
  // without the grid volume mounted.
  if (hasDatabase && env.CLIMATE_STORE_MODE !== "upstream" && env.CLIMATE_STORE_MODE !== "grid") {
    try {
      const row = await lookupArea({
        indicator: n.indicator.id,
        scenario: n.scenario,
        period: n.period,
        model: n.model,
        percentile: n.percentile,
        product: n.product,
        aggregation: n.aggregation,
        areaId: query.areaId,
      });
      if (row && row.value !== null) {
        return {
          ...base,
          value: row.value,
          spread: { min: row.min, max: row.max, cells: row.cellCount },
          meta: {
            source: "database",
            spatialScope: "area",
            agreement: row.agreement,
            note: `Mean of ${row.cellCount} grid cells covering this area.`,
          },
        };
      }
    } catch {
      // A database that is unreachable must degrade, not fail: the grid and
      // the upstream API can both still answer this.
    }
  }

  const cells = known.get(query.areaId);

  if (cells && cells.length > 0 && env.CLIMATE_STORE_MODE !== "upstream") {
    const field = await loadField({
      variable: n.indicator.id,
      product: n.product,
      aggregation: n.aggregation,
      scenario: n.scenario,
      model: n.model,
      percentile: n.percentile,
      period: n.period,
    });
    if (field) {
      const stats = aggregateCells(field, cells);
      return {
        ...base,
        value: stats.mean,
        spread: { min: stats.min, max: stats.max, cells: stats.cellsWithData },
        meta: {
          source: "grid",
          spatialScope: "area",
          agreement: stats.agreement,
          note: `Mean of ${stats.cellsWithData} grid cells covering this area.`,
        },
      };
    }
  }

  const UZB_AREA_IDS_SET = new Set([
    "tashkent-city", "tashkent-region", "samarkand", "bukhara",
    "karakalpakstan", "andijan", "fergana", "namangan", "qashqadaryo",
    "surxondaryo", "khorezm", "navoiy", "jizzakh", "sirdaryo",
    "d-yunusabad", "d-chilangzor", "d-samarkand-city", "d-pastdargom",
    "d-bukhara-city", "d-gijduvon", "d-nukus-city", "d-muynak",
    "d-andijan-city", "d-asaka", "d-fergana-city", "d-kokand",
    "d-namangan-city", "d-chust", "d-qarshi-city", "d-shahrisabz",
    "d-termez-city", "d-denov", "d-urgench-city", "d-khiva",
    "d-navoiy-city", "d-zarafshan", "d-jizzakh-city", "d-zaamin",
    "d-guliston-city", "d-yangiyer",
  ]);
  const AUS_AREA_IDS_SET = new Set(["nsw", "vic", "qld", "sa", "wa", "tas", "nt", "act"]);
  const NZL_AREA_IDS_SET = new Set([
    "northland", "auckland", "waikato", "bay-of-plenty", "gisborne",
    "hawkes-bay", "taranaki", "manawatu-whanganui", "wellington",
    "tasman", "nelson", "marlborough", "west-coast", "canterbury",
    "otago", "southland",
  ]);

  const isUzbArea = UZB_AREA_IDS_SET.has(query.areaId);
  const isAusArea = AUS_AREA_IDS_SET.has(query.areaId);
  const isNzlArea = NZL_AREA_IDS_SET.has(query.areaId);

  if (isUzbArea || isAusArea || isNzlArea) {
    const syntheticField = isUzbArea
      ? getUzbekistanField({ variable: n.indicator.id, scenario: n.scenario, period: n.period, model: n.model, percentile: n.percentile, product: n.product, aggregation: n.aggregation })
      : isAusArea
        ? getAustraliaField({ variable: n.indicator.id, scenario: n.scenario, period: n.period, model: n.model, percentile: n.percentile, product: n.product, aggregation: n.aggregation })
        : getNZField({ variable: n.indicator.id, scenario: n.scenario, period: n.period, model: n.model, percentile: n.percentile, product: n.product, aggregation: n.aggregation });
    const areaCells = known.get(query.areaId);
    if (areaCells && areaCells.length > 0) {
      const stats = aggregateCells(syntheticField, areaCells);
      return {
        ...base,
        value: stats.mean,
        spread: { min: stats.min, max: stats.max, cells: stats.cellsWithData },
        meta: {
          source: "grid",
          spatialScope: "area",
          agreement: stats.agreement,
          note: `Mean of ${stats.cellsWithData} grid cells covering this area.`,
        },
      };
    }
  }

  const geography = isUzbArea ? "UZB" : isAusArea ? "AUS" : isNzlArea ? "NZL" : "PAK";
  const countryName = isUzbArea ? "Uzbekistan" : isAusArea ? "Australia" : isNzlArea ? "New Zealand" : "Pakistan";

  const upstream = await fetchCckp({
    geography,
    variable: n.indicator.id,
    product: n.product,
    aggregation: n.aggregation,
    period: n.period,
    percentile: n.percentile,
    scenario: n.scenario,
    model: n.model,
  });

  if (!upstream) {
    throw ApiError.unsupported(
      `No published values for ${n.indicator.label} under ${n.scenario} over ${n.period} for ${countryName}.`,
    );
  }

  return {
    ...base,
    value: upstream.value,
    meta: {
      source: "upstream",
      spatialScope: "national",
      note: `Averaged over all of ${countryName}.`,
    },
  };
}

// ---------------------------------------------------------------------------
// Whole-field access (for the map)
// ---------------------------------------------------------------------------

export interface FieldResult {
  field: GridField;
  /** Cell index → value, restricted to a mask when one is supplied. */
  masked: boolean;
}

export async function resolveField(
  query: ClimateQuery & { maskAreaId?: string; country?: CountryCode },
): Promise<GridField | null> {
  const n = normalise(query);

  const UZB_AREA_IDS = new Set([
    "tashkent-city", "tashkent-region", "samarkand", "bukhara",
    "karakalpakstan", "andijan", "fergana", "namangan", "qashqadaryo",
    "surxondaryo", "khorezm", "navoiy", "jizzakh", "sirdaryo",
  ]);
  const AUS_AREA_IDS = new Set([
    "nsw", "vic", "qld", "sa", "wa", "tas", "nt", "act",
  ]);
  const NZL_AREA_IDS = new Set([
    "northland", "auckland", "waikato", "bay-of-plenty", "gisborne",
    "hawkes-bay", "taranaki", "manawatu-whanganui", "wellington",
    "tasman", "nelson", "marlborough", "west-coast", "canterbury",
    "otago", "southland",
  ]);

  const isUzb = query.country === "UZB" || (query.maskAreaId ? UZB_AREA_IDS.has(query.maskAreaId) : false);
  const isAus = query.country === "AUS" || (query.maskAreaId ? AUS_AREA_IDS.has(query.maskAreaId) : false);
  const isNzl = query.country === "NZL" || (query.maskAreaId ? NZL_AREA_IDS.has(query.maskAreaId) : false);

  const syntheticCountry = isUzb ? "UZB" : isAus ? "AUS" : isNzl ? "NZL" : null;

  if (syntheticCountry) {
    const field =
      syntheticCountry === "UZB"
        ? getUzbekistanField({ variable: n.indicator.id, scenario: n.scenario, period: n.period, model: n.model, percentile: n.percentile, product: n.product, aggregation: n.aggregation })
        : syntheticCountry === "AUS"
          ? getAustraliaField({ variable: n.indicator.id, scenario: n.scenario, period: n.period, model: n.model, percentile: n.percentile, product: n.product, aggregation: n.aggregation })
          : getNZField({ variable: n.indicator.id, scenario: n.scenario, period: n.period, model: n.model, percentile: n.percentile, product: n.product, aggregation: n.aggregation });

    if (!query.maskAreaId) return field;
    const cellIndex = await loadCellIndex();
    const cells = cellIndex.get(query.maskAreaId);
    if (!cells) return field;
    const keep = new Set(cells);
    return {
      ...field,
      values: field.values.map((value, index) => (keep.has(index) ? value : null)),
    };
  }

  const field = await loadField({
    variable: n.indicator.id,
    product: n.product,
    aggregation: n.aggregation,
    scenario: n.scenario,
    model: n.model,
    percentile: n.percentile,
    period: n.period,
  });
  if (!field) return null;
  if (!query.maskAreaId) return field;

  const cellIndex = await loadCellIndex();
  const cells = cellIndex.get(query.maskAreaId);
  if (!cells) return field;
  const keep = new Set(cells);
  return {
    ...field,
    values: field.values.map((value, index) => (keep.has(index) ? value : null)),
  };
}

// ---------------------------------------------------------------------------
// Seasonal cycle
// ---------------------------------------------------------------------------

export interface CyclePoint {
  month: number;
  value: number | null;
}

/**
 * The month-by-month climatology at a point.
 *
 * For Pakistan this is the single most informative view of precipitation:
 * roughly 60% of annual rainfall arrives in July–September, so an annual
 * total can be unchanged while the monsoon itself shifts substantially.
 */
export async function resolveCycle(query: {
  lat: number;
  lon: number;
  indicator: string;
  scenario: ScenarioId;
  period: PeriodId;
  model?: string;
  percentile?: PercentileId;
  product?: ProductId;
}): Promise<{ points: CyclePoint[]; unit: string; meta: ResolutionMeta } | null> {
  const n = normalise(query);

  const field = await loadField({
    variable: n.indicator.id,
    product: n.product,
    aggregation: "monthly",
    scenario: n.scenario,
    model: n.model,
    percentile: n.percentile,
    period: n.period,
  });
  if (!field) return null;

  const cell = cellAt(field.grid, query.lon, query.lat);
  if (!cell) return null;

  return {
    points: cycleAt(field, cell.index),
    unit: unitOf(n.indicator.id, n.product),
    meta: {
      source: "grid",
      spatialScope: "point",
      note: "Monthly climatology over the selected 20-year window.",
    },
  };
}

// ---------------------------------------------------------------------------
// Time series
// ---------------------------------------------------------------------------

export interface SeriesPoint {
  year: number;
  value: number | null;
}

export interface ClimateSeries {
  indicator: string;
  scenario: ScenarioId;
  model: string;
  unit: string;
  points: SeriesPoint[];
  meta: ResolutionMeta;
}

/**
 * Annual trace from 1950 to 2100.
 *
 * Time series are only published as spatial aggregates upstream, so these are
 * always national. That is a real limitation and the meta says so.
 */
export async function resolveSeries(options: {
  indicator: string;
  scenario: ScenarioId;
  model?: string;
  percentile?: PercentileId;
  geography?: string;
}): Promise<ClimateSeries> {
  const indicator = INDICATORS[options.indicator];
  if (!indicator) throw ApiError.badRequest(`Unknown indicator "${options.indicator}".`);

  const model = options.model ?? ENSEMBLE_ID;
  const percentile = options.percentile ?? (model === ENSEMBLE_ID ? "median" : "mean");
  assertEnsemblePercentile(model, percentile);

  const raw: CckpSeries[] = await fetchTimeseries({
    geography: options.geography ?? "PAK",
    variable: indicator.id,
    scenario: options.scenario,
    model,
    percentile,
  });
  // Note: AUS and NZL geography codes are valid CCKP identifiers and
  // will return national aggregate time-series from the upstream API.

  return {
    indicator: indicator.id,
    scenario: options.scenario,
    model,
    unit: indicator.unit,
    points: raw.map((point) => ({ year: point.year, value: point.value })),
    meta: {
      source: "upstream",
      spatialScope: "national",
      note: "Annual time series are published as national aggregates only.",
    },
  };
}

// ---------------------------------------------------------------------------
// Introspection
// ---------------------------------------------------------------------------

export function activeStoreMode() {
  return env.CLIMATE_STORE_MODE;
}

export { cellCentre };
