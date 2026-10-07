import { CCKP_CITATION, handler, searchParams } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { fetchCountryClimate } from "@/lib/iofs/climate";
import { isIofsMember } from "@/lib/iofs/members";
import { isValidIndicator, isValidScenario, type ScenarioId } from "@/lib/climate/taxonomy";

export const runtime = "nodejs";

/**
 * `GET /api/iofs/climate?country=NER&indicator=tas&scenarios=ssp245,ssp585`
 *
 * Real CMIP6 national aggregates (World Bank CCKP) for one IOFS member:
 * 1950–2099 annual trace per scenario, plus the baseline and anomaly figures
 * the metric cards show. See `lib/iofs/climate.ts`.
 */
export const GET = handler(async (request) => {
  const params = searchParams(request);
  const country = (params.get("country") ?? "").toUpperCase();
  const indicator = params.get("indicator") ?? "tas";
  const scenarioParam = params.get("scenarios") ?? "ssp245,ssp585";

  if (!country) throw ApiError.badRequest("Query parameter 'country' (ISO3) is required.");
  if (!isIofsMember(country)) {
    throw ApiError.badRequest(`'${country}' is not an IOFS member country code.`);
  }
  if (!isValidIndicator(indicator)) {
    throw ApiError.badRequest(`Unknown indicator '${indicator}'.`);
  }

  const scenarios = scenarioParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const s of scenarios) {
    if (!isValidScenario(s)) throw ApiError.badRequest(`Unknown scenario '${s}'.`);
  }

  const climate = await fetchCountryClimate(country, indicator, scenarios as ScenarioId[]);

  return {
    data: climate,
    meta: { source: "upstream", dataset: "cmip6-x0.25", citation: CCKP_CITATION },
  };
});
