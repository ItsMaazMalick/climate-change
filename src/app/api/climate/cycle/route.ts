import { z } from "zod";

import { CCKP_CITATION, handler, searchParams } from "@/lib/api";
import { resolveCycle } from "@/lib/climate/store";
import { INDICATORS, MONTH_LABELS, type PeriodId, type ScenarioId } from "@/lib/climate/taxonomy";
import { ApiError } from "@/lib/errors";
import {
  indicatorSchema,
  latSchema,
  lonSchema,
  parseSearchParams,
  periodSchema,
  scenarioSchema,
} from "@/lib/validation";

export const runtime = "nodejs";

const querySchema = z.object({
  lat: latSchema,
  lon: lonSchema,
  indicator: indicatorSchema.default("pr"),
  scenario: scenarioSchema.default("ssp245"),
  period: periodSchema.default("2040-2059"),
});

/**
 * The seasonal cycle at a point, baseline against projection.
 *
 * Annual totals are close to useless for Pakistani precipitation: about 60%
 * of the country's rain falls in the July–September monsoon, so the annual
 * mean can hold steady while the shape of the year changes completely. This
 * endpoint returns both curves so the shift itself is visible.
 */
export const GET = handler(async (request) => {
  const query = parseSearchParams(querySchema, searchParams(request));

  const [projected, baseline] = await Promise.all([
    resolveCycle({
      lat: query.lat,
      lon: query.lon,
      indicator: query.indicator,
      scenario: query.scenario as ScenarioId,
      period: query.period as PeriodId,
      product: "climatology",
    }),
    resolveCycle({
      lat: query.lat,
      lon: query.lon,
      indicator: query.indicator,
      scenario: "historical",
      period: "1995-2014",
      product: "climatology",
    }),
  ]);

  if (!projected && !baseline) {
    throw ApiError.unsupported(
      `No monthly climatology rasterised for ${query.indicator}.`,
      "Run the `seasonal` extraction plan to enable the seasonal-cycle view for this indicator.",
    );
  }

  const months = MONTH_LABELS.map((label, index) => ({
    month: index + 1,
    label,
    baseline: baseline?.points.find((p) => p.month === index + 1)?.value ?? null,
    projected: projected?.points.find((p) => p.month === index + 1)?.value ?? null,
  }));

  // A sum over twelve missing months is not zero, it is unknown. Returning 0
  // would render as "no rain all year" rather than "not available".
  const indicator = INDICATORS[query.indicator]!;

  // Only accumulating indicators have a meaningful annual total. Summing
  // twelve monthly temperatures produces a number with no referent, and a
  // "share of the annual temperature" is not a fact about anything.
  const sum = (key: "baseline" | "projected"): number | null => {
    if (!indicator.accumulates) return null;
    const present = months.filter((m) => m[key] !== null);
    if (present.length === 0) return null;
    return Number(
      present.reduce((total, m) => total + (m[key] as number), 0).toFixed(2),
    );
  };

  // For a non-accumulating indicator the useful yearly summaries are the
  // extremes and the range, not a total.
  const extremes = (key: "baseline" | "projected") => {
    const present = months
      .map((m) => m[key])
      .filter((v): v is number => v !== null);
    if (present.length === 0) return null;
    const min = Math.min(...present);
    const max = Math.max(...present);
    return {
      min: Number(min.toFixed(2)),
      max: Number(max.toFixed(2)),
      range: Number((max - min).toFixed(2)),
      warmestMonth: months.find((m) => m[key] === max)?.label ?? null,
      coolestMonth: months.find((m) => m[key] === min)?.label ?? null,
    };
  };

  // Monsoon share: how concentrated the year is, before and after. For
  // precipitation this often moves far more than the annual total does.
  const monsoonShare = (key: "baseline" | "projected") => {
    const total = sum(key);
    if (total === null || total === 0) return null;
    const monsoon = months
      .filter((m) => m.month >= 7 && m.month <= 9)
      .reduce((acc, m) => acc + (m[key] ?? 0), 0);
    return Number(((monsoon / total) * 100).toFixed(1));
  };

  return {
    data: {
      indicator,
      location: { lat: query.lat, lon: query.lon },
      scenario: query.scenario,
      period: query.period,
      unit: projected?.unit ?? baseline?.unit ?? "",
      months,
      accumulates: indicator.accumulates,
      annual: indicator.accumulates
        ? { baseline: sum("baseline"), projected: sum("projected") }
        : null,
      extremes: indicator.accumulates
        ? null
        : { baseline: extremes("baseline"), projected: extremes("projected") },
      monsoonSharePercent: indicator.accumulates
        ? { baseline: monsoonShare("baseline"), projected: monsoonShare("projected") }
        : null,
      meta: (projected ?? baseline)?.meta ?? null,
    },
    meta: { source: "grid", dataset: "cmip6-x0.25", citation: CCKP_CITATION },
  };
});
