import { CCKP_CITATION, handler } from "@/lib/api";
import { gridCoverage } from "@/lib/climate/grid";
import { MECHANISMS } from "@/lib/climate/interpret";
import { PLACES } from "@/lib/climate/places";
import { activeStoreMode } from "@/lib/climate/store";
import {
  DATASETS,
  ENSEMBLE_PERCENTILES,
  FUTURE_PERIOD_IDS,
  HEADLINE_SCENARIO_IDS,
  INDICATORS,
  MODELS,
  PERCENTILES,
  PERIODS,
  RCP_SCENARIOS,
  SCENARIOS,
  SCENARIO_GENERATIONS,
  SSP_IDS,
  indicatorsByFamily,
} from "@/lib/climate/taxonomy";

export const runtime = "nodejs";
// Every route handler passes through the rate limiter, which reads request
// headers — so none of them can be prerendered. The long `s-maxage` set in
// `ok()` is what actually keeps this off the origin.
export const dynamic = "force-dynamic";

/**
 * The full vocabulary of the platform in one response.
 *
 * The client builds every control from this rather than hard-coding option
 * lists, so adding an indicator upstream is a server-side change only.
 */
export const GET = handler(async () => {
  const coverage = await gridCoverage();

  return {
    data: {
      datasets: Object.values(DATASETS),
      scenarios: {
        all: Object.values(SCENARIOS),
        ssp: SSP_IDS.map((id) => SCENARIOS[id]),
        headline: HEADLINE_SCENARIO_IDS,
        generations: SCENARIO_GENERATIONS,
        legacy: RCP_SCENARIOS,
      },
      periods: {
        all: Object.values(PERIODS),
        baseline: "1995-2014",
        future: FUTURE_PERIOD_IDS,
      },
      models: {
        all: Object.values(MODELS),
        ensemble: "ensemble-all",
        count: Object.keys(MODELS).length - 1,
      },
      percentiles: {
        all: Object.values(PERCENTILES),
        ensemble: ENSEMBLE_PERCENTILES,
      },
      indicators: {
        all: Object.values(INDICATORS),
        byFamily: indicatorsByFamily(),
        default: "tas",
      },
      mechanisms: MECHANISMS,
      places: PLACES,
      coverage: {
        grid: coverage,
        storeMode: activeStoreMode(),
      },
    },
    meta: { dataset: "cmip6-x0.25", citation: CCKP_CITATION },
  };
});
