import { cached } from "@/lib/cache";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/errors";

import {
  ENSEMBLE_ID,
  type AggregationId,
  type ModelId,
  type PercentileId,
  type PeriodId,
  type ProductId,
  type ScenarioId,
} from "./taxonomy";

/**
 * Client for the World Bank Climate Change Knowledge Portal aggregate API.
 *
 * The endpoint encodes an entire query in one underscore-delimited path
 * segment of eleven slots:
 *
 *   {collection}_{type}_{variable}_{product}_{aggregation}_{period}
 *     _{percentile}_{scenario}_{model}_{modelCalculation}_{statistic}
 *
 * Two of those slots are quietly redundant — `type` is `timeseries` for the
 * timeseries product and `climatology` for everything else — and the model is
 * split across two slots, so the S3 code `access-cm2-r1i1p1f1` becomes
 * `access-cm2` + `r1i1p1f1` here. Getting either wrong returns HTTP 200 with
 * an empty `data` array rather than an error, which is why this module
 * validates the shape of every response instead of trusting the status code.
 */

const COLLECTION = "cmip6-x0.25";

export interface CckpQuery {
  geography: string;
  variable: string;
  product: ProductId;
  aggregation: AggregationId;
  period: string;
  percentile: PercentileId;
  scenario: ScenarioId;
  model: ModelId | string;
  statistic?: string;
  collection?: string;
}

interface CckpEnvelope {
  metadata?: { status?: string; messages?: unknown[]; message?: unknown[] };
  /**
   * `{ [geography]: { [timeKey]: value } }` on success, or `[]` when the
   * requested combination does not exist upstream.
   */
  data?: Record<string, Record<string, number | null>> | unknown[];
}

/** Split an S3-style model code into the API's model / variant slots. */
export function splitModel(model: string): [string, string] {
  if (model === ENSEMBLE_ID || model === "ensemble") return ["ensemble", "all"];
  const index = model.lastIndexOf("-");
  if (index === -1) return [model, "all"];
  return [model.slice(0, index), model.slice(index + 1)];
}

export function buildCckpPath(query: CckpQuery): string {
  const [modelCode, modelCalculation] = splitModel(query.model);
  const productType = query.product === "timeseries" ? "timeseries" : "climatology";
  return [
    query.collection ?? COLLECTION,
    productType,
    query.variable,
    query.product,
    query.aggregation,
    query.period,
    query.percentile,
    query.scenario,
    modelCode,
    modelCalculation,
    query.statistic ?? "mean",
  ].join("_");
}

export function buildCckpUrl(query: CckpQuery): string {
  const path = buildCckpPath(query);
  return `${env.CCKP_API_BASE}/${path}/${query.geography}?_format=json`;
}

// ---------------------------------------------------------------------------
// Concurrency control
// ---------------------------------------------------------------------------

/**
 * The upstream API is slow (1–3 s) and unmetered politeness matters, so all
 * outbound calls pass through a small semaphore. Without it, a scenario
 * comparison across five pathways and four periods would open twenty sockets
 * at once and reliably time out.
 */
let active = 0;
const queue: Array<() => void> = [];

async function withSlot<T>(work: () => Promise<T>): Promise<T> {
  if (active >= env.CLIMATE_UPSTREAM_CONCURRENCY) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  active += 1;
  try {
    return await work();
  } finally {
    active -= 1;
    queue.shift()?.();
  }
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

async function fetchEnvelope(url: string): Promise<CckpEnvelope> {
  return withSlot(async () => {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      env.CLIMATE_UPSTREAM_TIMEOUT_MS,
    );
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json", "User-Agent": "climate-pakistan/1.0" },
        // Immutable upstream data; our own cache layer owns freshness.
        cache: "no-store",
      });
      if (!response.ok) {
        throw new ApiError(
          "upstream_unavailable",
          `Climate data provider returned ${response.status}.`,
          { details: { url, status: response.status } },
        );
      }
      return (await response.json()) as CckpEnvelope;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if ((error as Error)?.name === "AbortError") {
        throw new ApiError("upstream_timeout", "Climate data provider timed out.", {
          details: { url },
        });
      }
      throw new ApiError("upstream_unavailable", "Could not reach the climate data provider.", {
        cause: error,
        details: { url },
      });
    } finally {
      clearTimeout(timer);
    }
  });
}

export interface CckpSeries {
  /** Time key as published upstream, e.g. `2040-07` or `1995-01`. */
  key: string;
  /** Calendar year parsed from the key. */
  year: number;
  /** Month number parsed from the key (1–12). */
  month: number;
  value: number | null;
}

export interface CckpResult {
  query: CckpQuery;
  url: string;
  geography: string;
  series: CckpSeries[];
  /** Convenience accessor for single-valued (climatology / anomaly) results. */
  value: number | null;
}

function parseEnvelope(
  envelope: CckpEnvelope,
  query: CckpQuery,
  url: string,
): CckpResult | null {
  const statusMessages = envelope.metadata?.message;
  if (Array.isArray(statusMessages) && statusMessages.length > 0) {
    throw new ApiError("bad_request", String(statusMessages[0]), { details: { url } });
  }

  const data = envelope.data;
  // An empty array is the archive's way of saying "no such combination".
  if (!data || Array.isArray(data)) return null;

  const record = data[query.geography] ?? Object.values(data)[0];
  if (!record || typeof record !== "object") return null;

  const series: CckpSeries[] = Object.entries(record)
    .map(([key, raw]) => {
      const [year, month] = key.split("-").map(Number);
      const value =
        raw === null || raw === undefined || !Number.isFinite(Number(raw))
          ? null
          : Number(raw);
      return { key, year: year ?? 0, month: month ?? 1, value };
    })
    .sort((a, b) => a.year - b.year || a.month - b.month);

  if (series.length === 0) return null;

  return {
    query,
    url,
    geography: query.geography,
    series,
    value: series.length === 1 ? (series[0]!.value ?? null) : null,
  };
}

/**
 * Fetch one CCKP query. Returns `null` — rather than throwing — when the
 * combination is simply not published, so callers can fall back or render a
 * gap without treating sparsity as failure.
 */
export async function fetchCckp(query: CckpQuery): Promise<CckpResult | null> {
  const url = buildCckpUrl(query);
  return cached(`cckp:${buildCckpPath(query)}:${query.geography}`, async () => {
    const envelope = await fetchEnvelope(url);
    return parseEnvelope(envelope, query, url);
  });
}

/** Fetch many queries, preserving order and tolerating individual gaps. */
export async function fetchCckpMany(
  queries: CckpQuery[],
): Promise<Array<CckpResult | null>> {
  return Promise.all(
    queries.map(async (query) => {
      try {
        return await fetchCckp(query);
      } catch (error) {
        if (error instanceof ApiError && error.code === "bad_request") return null;
        throw error;
      }
    }),
  );
}

/**
 * Continuous annual series for a scenario. The archive splits these into a
 * 1950–2014 historical run and a 2015–2100 projection run; this stitches the
 * two so a chart can draw an unbroken line through the present.
 */
export async function fetchTimeseries(options: {
  geography: string;
  variable: string;
  scenario: ScenarioId;
  model?: ModelId | string;
  percentile?: PercentileId;
  aggregation?: AggregationId;
  includeHistorical?: boolean;
}): Promise<CckpSeries[]> {
  const {
    geography,
    variable,
    scenario,
    model = ENSEMBLE_ID,
    percentile = model === ENSEMBLE_ID ? "median" : "mean",
    aggregation = "annual",
    includeHistorical = true,
  } = options;

  const requests: CckpQuery[] = [];
  if (includeHistorical && scenario !== "historical") {
    requests.push({
      geography,
      variable,
      product: "timeseries",
      aggregation,
      period: "1950-2014",
      percentile,
      scenario: "historical",
      model,
    });
  }
  requests.push({
    geography,
    variable,
    product: "timeseries",
    aggregation,
    period: scenario === "historical" ? "1950-2014" : "2015-2100",
    percentile,
    scenario,
    model,
  });

  const results = await fetchCckpMany(requests);
  const merged = new Map<string, CckpSeries>();
  for (const result of results) {
    for (const point of result?.series ?? []) merged.set(point.key, point);
  }
  return [...merged.values()].sort((a, b) => a.year - b.year || a.month - b.month);
}

export const PERIOD_KEYS: Record<PeriodId, string> = {
  "1995-2014": "1995-2014",
  "2020-2039": "2020-2039",
  "2040-2059": "2040-2059",
  "2060-2079": "2060-2079",
  "2080-2099": "2080-2099",
};
