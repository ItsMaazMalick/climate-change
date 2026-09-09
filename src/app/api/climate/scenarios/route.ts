import { CCKP_CITATION, handler, searchParams } from "@/lib/api";
import {
  assertProjectionInvariant,
  deriveProjected,
} from "@/lib/climate/derive";
import { scenarioDivergence } from "@/lib/climate/interpret";
import { resolveArea, resolvePoint } from "@/lib/climate/store";
import {
  INDICATORS,
  SCENARIOS,
  SSP_IDS,
  isValidScenario,
  type ScenarioId,
} from "@/lib/climate/taxonomy";
import { ApiError } from "@/lib/errors";
import { compareQuerySchema, parseSearchParams } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * The same indicator, same place, same period — across every emissions
 * pathway. This is the comparison that makes scenarios legible: it isolates
 * the one variable the world still controls.
 */
export const GET = handler(async (request) => {
  const query = parseSearchParams(compareQuerySchema, searchParams(request));

  const scenarios = query.scenarios.filter(isValidScenario) as ScenarioId[];
  if (scenarios.length === 0) {
    throw ApiError.badRequest("No valid scenarios requested.", {
      valid: SSP_IDS,
    });
  }

  const hasPoint = query.lat !== undefined && query.lon !== undefined;
  if (!hasPoint && !query.areaId) {
    throw ApiError.badRequest("Provide either lat/lon or areaId.");
  }

  const resolve = (scenario: ScenarioId, product: "climatology" | "anomaly") =>
    hasPoint
      ? resolvePoint({
          lat: query.lat!,
          lon: query.lon!,
          indicator: query.indicator,
          scenario,
          period: query.period,
          product,
        })
      : resolveArea({
          areaId: query.areaId!,
          indicator: query.indicator,
          scenario,
          period: query.period,
          product,
        });

  // One baseline for the place — scenario-independent, since the pathways
  // have not diverged over 1995–2014. Every pathway's absolute is this plus
  // its own delta (D2): five forcing pathways cannot share one absolute, and
  // they cannot each get an independently fetched one either.
  const baselineQuery = {
    indicator: query.indicator,
    scenario: "historical" as ScenarioId,
    period: "1995-2014" as const,
    product: "climatology" as const,
  };
  const baseline = await (hasPoint
    ? resolvePoint({ lat: query.lat!, lon: query.lon!, ...baselineQuery })
    : resolveArea({ areaId: query.areaId!, ...baselineQuery })
  ).catch(() => null);

  const results = await Promise.all(
    scenarios.map(async (scenario) => {
      const [anomaly, climatology] = await Promise.all([
        resolve(scenario, "anomaly").catch(() => null),
        resolve(scenario, "climatology").catch(() => null),
      ]);
      const value =
        deriveProjected(baseline?.value ?? null, anomaly?.value ?? null) ??
        climatology?.value ??
        null;
      assertProjectionInvariant({
        indicator: query.indicator,
        baseline: baseline?.value ?? null,
        projected: value,
        delta: anomaly?.value ?? null,
        context: `compare ${query.indicator}/${scenario}/${query.period}`,
      });
      return {
        scenario: SCENARIOS[scenario],
        anomaly: anomaly?.value ?? null,
        value,
        unit: anomaly?.unit ?? climatology?.unit ?? baseline?.unit ?? "",
        agreement: anomaly?.meta.agreement ?? null,
        source: (anomaly ?? climatology)?.meta.source ?? null,
      };
    }),
  );

  const byScenario = Object.fromEntries(
    results.map((r) => [r.scenario.id, r.anomaly]),
  ) as Partial<Record<ScenarioId, number | null>>;

  return {
    data: {
      indicator: INDICATORS[query.indicator]!,
      period: query.period,
      location: hasPoint
        ? { lat: query.lat, lon: query.lon }
        : { areaId: query.areaId },
      results: results.sort((a, b) => a.scenario.rank - b.scenario.rank),
      divergence: scenarioDivergence(byScenario, query.indicator),
    },
    meta: { dataset: "cmip6-x0.25", citation: CCKP_CITATION },
  };
});
