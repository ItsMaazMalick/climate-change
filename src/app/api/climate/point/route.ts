import { CCKP_CITATION, handler, searchParams } from "@/lib/api";
import {
  assertProjectionInvariant,
  deriveProjected,
  PROJECTION_TOLERANCE,
} from "@/lib/climate/derive";
import { nearestPlace } from "@/lib/climate/places";
import { resolvePoint } from "@/lib/climate/store";
import { INDICATORS } from "@/lib/climate/taxonomy";
import { ApiError } from "@/lib/errors";
import { parseSearchParams, pointQuerySchema } from "@/lib/validation";

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
 * The value of one indicator at one coordinate.
 *
 * This is the endpoint behind clicking the map. It returns the absolute
 * climatology *and* the change signal together, because either alone is
 * misleading: the absolute value hides how much has changed, and the anomaly
 * hides what is actually being lived through.
 */
export const GET = handler(async (request) => {
  const query = parseSearchParams(pointQuerySchema, searchParams(request));

  const [projected, anomaly, baseline] = await Promise.all([
    optional(resolvePoint({ ...query, product: "climatology" })),
    query.period === "1995-2014"
      ? Promise.resolve(null)
      : optional(resolvePoint({ ...query, product: "anomaly" })),
    optional(
      resolvePoint({
        ...query,
        product: "climatology",
        period: "1995-2014",
        scenario: "historical",
      }),
    ),
  ]);

  const nearest = nearestPlace({ lat: query.lat, lon: query.lon });
  const indicator = INDICATORS[query.indicator]!;

  // D1/D2: the projected absolute is `baseline + delta`, derived here in the
  // one place, never an independently fetched future climatology that can
  // silently disagree. The separately resolved `projected` is used only as a
  // fallback when the baseline or the delta is unavailable.
  const isBaselineWindow = query.period === "1995-2014";
  const derivedProjected = isBaselineWindow
    ? (baseline?.value ?? null)
    : deriveProjected(baseline?.value ?? null, anomaly?.value ?? null);
  const projectedValue = derivedProjected ?? projected?.value ?? null;
  const projectedUnit = projected?.unit ?? baseline?.unit ?? anomaly?.unit ?? indicator.unit;

  // Dev-mode contract: throws if the numbers we are about to render contradict
  // each other. Silent in production so a data hiccup degrades, not 500s.
  if (!isBaselineWindow) {
    assertProjectionInvariant({
      indicator: query.indicator,
      baseline: baseline?.value ?? null,
      projected: projectedValue,
      delta: anomaly?.value ?? null,
      context: `point ${query.lat.toFixed(2)},${query.lon.toFixed(2)} ${query.indicator}/${query.scenario}/${query.period}`,
      tolerance: PROJECTION_TOLERANCE,
    });
  }

  return {
    data: {
      location: {
        lat: query.lat,
        lon: query.lon,
        nearestPlace: nearest
          ? { ...nearest.place, distanceKm: Math.round(nearest.distanceKm) }
          : null,
      },
      indicator,
      scenario: query.scenario,
      period: query.period,
      model: query.model,
      baseline: baseline
        ? { value: baseline.value, unit: baseline.unit, period: "1995-2014" }
        : null,
      projected:
        projectedValue !== null ? { value: projectedValue, unit: projectedUnit } : null,
      anomaly: anomaly ? { value: anomaly.value, unit: anomaly.unit } : null,
      meta: (projected ?? anomaly ?? baseline)?.meta ?? null,
    },
    meta: {
      source: (projected ?? anomaly ?? baseline)?.meta.source,
      dataset: "cmip6-x0.25",
      citation: CCKP_CITATION,
    },
  };
});
