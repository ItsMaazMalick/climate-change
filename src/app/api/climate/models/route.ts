import { CCKP_CITATION, handler, searchParams } from "@/lib/api";
import { fetchCckp } from "@/lib/climate/cckp";
import { detectCountryFromCoords } from "@/lib/climate/countries";
import { isDegenerateSpread } from "@/lib/climate/derive";
import { describeSpread, signalToNoise } from "@/lib/climate/interpret";
import { resolveArea, resolvePoint } from "@/lib/climate/store";
import {
  ENSEMBLE_ID,
  INDICATORS,
  INDIVIDUAL_MODEL_IDS,
  MODELS,
} from "@/lib/climate/taxonomy";
import { ApiError } from "@/lib/errors";
import { parseSearchParams, spreadQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

/**
 * Model uncertainty for one place, scenario and period.
 *
 * The ensemble median alone invites the reading "this is what will happen".
 * The p10–p90 envelope is what the archive actually supports, and with
 * `?models=true` the individual realisations are returned so a reader can see
 * that the spread is not an error bar around a truth — it is thirty
 * physically plausible worlds.
 */
export const GET = handler(async (request) => {
  const query = parseSearchParams(spreadQuerySchema, searchParams(request));

  const hasPoint = query.lat !== undefined && query.lon !== undefined;
  if (!hasPoint && !query.areaId) {
    throw ApiError.badRequest("Provide either lat/lon or areaId.");
  }

  const resolveEnsemble = (percentile: "median" | "p10" | "p90") =>
    hasPoint
      ? resolvePoint({
          lat: query.lat!,
          lon: query.lon!,
          indicator: query.indicator,
          scenario: query.scenario,
          period: query.period,
          model: ENSEMBLE_ID,
          percentile,
          product: "anomaly",
        })
      : resolveArea({
          areaId: query.areaId!,
          indicator: query.indicator,
          scenario: query.scenario,
          period: query.period,
          model: ENSEMBLE_ID,
          percentile,
          product: "anomaly",
        });

  const [median, p10, p90] = await Promise.all(
    (["median", "p10", "p90"] as const).map((p) =>
      resolveEnsemble(p).catch(() => null),
    ),
  );

  const rawSpread = {
    median: median?.value ?? null,
    p10: p10?.value ?? null,
    p90: p90?.value ?? null,
  };

  // D3 guard: a p10 and p90 this close together is a failed spread
  // computation, not fake-precise agreement. Drop the band; the UI renders
  // "model spread unavailable at this aggregation" rather than an identical
  // range. The individual-model list below still conveys the real spread.
  const spreadDegenerate = isDegenerateSpread(rawSpread.p10, rawSpread.p90);
  const spread = spreadDegenerate
    ? { median: rawSpread.median, p10: null, p90: null }
    : rawSpread;

  // D4: the individual-model list is a national aggregate — fetch it for the
  // active country, not a hardcoded "PAK".
  const geography =
    query.country ??
    (query.lat !== undefined && query.lon !== undefined
      ? detectCountryFromCoords(query.lat, query.lon)
      : "PAK");

  let members: Array<{ model: string; label: string; ecs: number | null; value: number | null }> = [];

  if (query.models) {
    // Individual realisations are only published as spatial aggregates in the
    // aggregate API, so this axis is national regardless of the point given.
    const responses = await Promise.all(
      INDIVIDUAL_MODEL_IDS.map(async (modelId) => {
        const result = await fetchCckp({
          geography,
          variable: query.indicator,
          product: "anomaly",
          aggregation: "annual",
          period: query.period,
          percentile: "mean",
          scenario: query.scenario,
          model: modelId,
        }).catch(() => null);
        const model = MODELS[modelId];
        return {
          model: modelId,
          label: model.label,
          ecs: model.ecs,
          value: result?.value ?? null,
        };
      }),
    );
    members = responses
      .filter((m) => m.value !== null)
      .sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
  }

  return {
    data: {
      indicator: INDICATORS[query.indicator]!,
      scenario: query.scenario,
      period: query.period,
      location: hasPoint ? { lat: query.lat, lon: query.lon } : { areaId: query.areaId },
      spread,
      spreadAvailable: !spreadDegenerate && spread.p10 !== null && spread.p90 !== null,
      unit: median?.unit ?? p10?.unit ?? "",
      confidence: signalToNoise(spread),
      description: describeSpread(spread, query.indicator, { degenerate: spreadDegenerate }),
      agreement: median?.meta.agreement ?? null,
      members,
      membersScope: query.models ? geography : null,
      source: median?.meta.source ?? null,
    },
    meta: { dataset: "cmip6-x0.25", citation: CCKP_CITATION },
  };
});
