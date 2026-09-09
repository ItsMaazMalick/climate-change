import { z } from "zod";

import { CCKP_CITATION, handler, searchParams } from "@/lib/api";
import { getCountry } from "@/lib/climate/countries";
import { resolveSeries } from "@/lib/climate/store";
import {
  INDICATORS,
  SCENARIOS,
  SSP_IDS,
  type ScenarioId,
} from "@/lib/climate/taxonomy";
import {
  indicatorSchema,
  modelSchema,
  parseSearchParams,
} from "@/lib/validation";

export const runtime = "nodejs";

const querySchema = z.object({
  indicator: indicatorSchema.default("tas"),
  model: modelSchema,
  geography: z.string().min(2).max(16).default("PAK"),
  smooth: z.coerce.number().int().min(0).max(41).default(11),
});

/**
 * Every pathway's trajectory in one response.
 *
 * The alternative — one request per scenario from the client — costs five
 * round trips to render a single chart, and makes the component fetch inside
 * a loop. Fanning out on the server is both faster and lets the five upstream
 * calls share the connection semaphore.
 */
export const GET = handler(async (request) => {
  const query = parseSearchParams(querySchema, searchParams(request));

  const lines = await Promise.all(
    (SSP_IDS as readonly ScenarioId[]).map(async (scenario) => {
      const series = await resolveSeries({
        indicator: query.indicator,
        scenario,
        model: query.model,
        geography: query.geography,
      }).catch(() => null);

      const points = series
        ? query.smooth > 1
          ? smooth(series.points, query.smooth)
          : series.points
        : [];

      return {
        id: scenario,
        label: SCENARIOS[scenario].label,
        color: SCENARIOS[scenario].color,
        points,
      };
    }),
  );

  return {
    data: {
      indicator: INDICATORS[query.indicator]!,
      geography: query.geography,
      model: query.model,
      unit: INDICATORS[query.indicator]!.unit,
      smoothingYears: query.smooth > 1 ? query.smooth : null,
      scenarioStartYear: 2015,
      lines: lines.filter((line) => line.points.length > 0),
      note: `Annual time series are published as national spatial aggregates, so these lines describe ${getCountry(query.geography).name} as a whole rather than any single location.`,
    },
    meta: { source: "upstream", dataset: "cmip6-x0.25", citation: CCKP_CITATION },
  };
});

/** Centred moving average that shortens the window at the series ends. */
function smooth(
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
    };
  });
}
