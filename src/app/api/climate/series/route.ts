import { CCKP_CITATION, handler, searchParams } from "@/lib/api";
import { resolveSeries } from "@/lib/climate/store";
import { INDICATORS, type ScenarioId } from "@/lib/climate/taxonomy";
import { parseSearchParams, seriesQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * Year-by-year trace, 1950–2100.
 *
 * Optionally smoothed with a centred moving average. Smoothing is offered
 * because interannual variability genuinely obscures the forced trend at
 * these magnitudes — but it is opt-in and reported, never applied silently.
 */
export const GET = handler(async (request) => {
  const query = parseSearchParams(seriesQuerySchema, searchParams(request));

  const series = await resolveSeries({
    indicator: query.indicator,
    scenario: query.scenario as ScenarioId,
    model: query.model,
    percentile: query.percentile,
    geography: query.geography,
  });

  const points =
    query.smooth > 1 ? movingAverage(series.points, query.smooth) : series.points;

  return {
    data: {
      indicator: INDICATORS[query.indicator]!,
      scenario: query.scenario,
      model: query.model,
      geography: query.geography,
      unit: series.unit,
      smoothingYears: query.smooth > 1 ? query.smooth : null,
      points,
      /** Where the historical run hands over to the scenario run. */
      scenarioStartYear: 2015,
      meta: series.meta,
    },
    meta: { source: "upstream", dataset: "cmip6-x0.25", citation: CCKP_CITATION },
  };
});

/**
 * Centred moving average that shortens the window at the ends rather than
 * dropping them, so the trace still reaches 1950 and 2100.
 */
function movingAverage(
  points: Array<{ year: number; value: number | null }>,
  window: number,
) {
  const half = Math.floor(window / 2);
  return points.map((point, index) => {
    let sum = 0;
    let count = 0;
    for (let offset = -half; offset <= half; offset += 1) {
      const neighbour = points[index + offset];
      if (!neighbour || neighbour.value === null) continue;
      sum += neighbour.value;
      count += 1;
    }
    return {
      year: point.year,
      value: count ? Number((sum / count).toFixed(3)) : null,
      raw: point.value,
    };
  });
}
