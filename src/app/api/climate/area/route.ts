import { CCKP_CITATION, handler, searchParams } from "@/lib/api";
import { resolveArea } from "@/lib/climate/store";
import { INDICATORS } from "@/lib/climate/taxonomy";
import { ApiError } from "@/lib/errors";
import { areaQuerySchema, parseSearchParams } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * Swallow only "this combination is not published" style failures.
 *
 * The archive is legitimately sparse, so a missing cross-product is a gap to
 * render rather than a request to reject. A malformed request is not: letting
 * a 400 or a 404 collapse into `null` turns a clear error into a response
 * full of blanks that looks like missing data.
 */
function optional<T>(work: Promise<T>): Promise<T | null> {
  return work.catch((error: unknown) => {
    if (error instanceof ApiError && error.code === "unsupported_combination") {
      return null;
    }
    throw error;
  });
}


/**
 * An indicator aggregated over an administrative unit — a province or one of
 * the 126 districts.
 *
 * Unlike the point endpoint, this returns the internal spread across the
 * unit's grid cells. For Balochistan that range spans 522 cells and several
 * climate zones, and collapsing it to a mean without saying so would be the
 * single most misleading thing this API could do.
 */
export const GET = handler(async (request) => {
  const query = parseSearchParams(areaQuerySchema, searchParams(request));

  const [projected, anomaly, baseline] = await Promise.all([
    optional(resolveArea({ ...query, product: "climatology" })),
    query.period === "1995-2014"
      ? Promise.resolve(null)
      : optional(resolveArea({ ...query, product: "anomaly" })),
    optional(
      resolveArea({
        ...query,
        product: "climatology",
        period: "1995-2014",
        scenario: "historical",
      }),
    ),
  ]);

  return {
    data: {
      areaId: query.areaId,
      indicator: INDICATORS[query.indicator]!,
      scenario: query.scenario,
      period: query.period,
      model: query.model,
      baseline: baseline
        ? { value: baseline.value, unit: baseline.unit, spread: baseline.spread }
        : null,
      projected: projected
        ? { value: projected.value, unit: projected.unit, spread: projected.spread }
        : null,
      anomaly: anomaly
        ? { value: anomaly.value, unit: anomaly.unit, spread: anomaly.spread }
        : null,
      meta: (projected ?? anomaly ?? baseline)?.meta ?? null,
    },
    meta: {
      source: (projected ?? anomaly ?? baseline)?.meta.source,
      dataset: "cmip6-x0.25",
      citation: CCKP_CITATION,
    },
  };
});
