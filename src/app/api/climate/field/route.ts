import { CCKP_CITATION, handler, searchParams } from "@/lib/api";
import { explainMissingField } from "@/lib/climate/grid";
import { resolveField } from "@/lib/climate/store";
import { INDICATORS } from "@/lib/climate/taxonomy";
import { ApiError } from "@/lib/errors";
import { fieldQuerySchema, parseSearchParams } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * A whole rasterised field, for the map.
 *
 * The payload is the flat value array plus the grid geometry — not GeoJSON.
 * 3,976 polygons of GeoJSON is roughly 1.5 MB; the same information as a
 * typed array plus four numbers is around 25 KB, and the client can build
 * geometry from the lattice far faster than it can parse it.
 */
export const GET = handler(async (request) => {
  const query = parseSearchParams(fieldQuerySchema, searchParams(request));

  const field = await resolveField({
    indicator: query.indicator,
    scenario: query.scenario,
    period: query.period,
    model: query.model,
    percentile: query.percentile,
    product: query.product,
    aggregation: query.aggregation,
    maskAreaId: query.area,
    country: query.country,
  });

  if (!field) {
    // Say which dimension is missing, not merely that something is.
    const { reason, hint } = await explainMissingField({
      variable: query.indicator,
      product: query.product,
      aggregation: query.aggregation,
      scenario: query.scenario,
      model: query.model,
      percentile: query.percentile ?? (query.model === "ensemble-all" ? "median" : "mean"),
      period: query.period,
    });
    throw ApiError.unsupported(reason, hint);
  }

  // Percentile bounds computed over the finite values, so the map's colour
  // scale is not dominated by a handful of extreme mountain cells.
  const finite = field.values.filter((v): v is number => v !== null);
  const sorted = [...finite].sort((a, b) => a - b);
  const quantile = (q: number) =>
    sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]! : null;

  return {
    data: {
      indicator: INDICATORS[query.indicator]!,
      scenario: query.scenario,
      period: query.period,
      model: query.model,
      product: query.product,
      percentile: field.spec.percentile,
      unit: field.units,
      grid: field.grid,
      values: field.values,
      significance: field.significance,
      stats: {
        ...field.stats,
        p02: quantile(0.02),
        p98: quantile(0.98),
      },
      source: field.source,
    },
    meta: { source: "grid", dataset: "cmip6-x0.25", citation: CCKP_CITATION },
  };
});
