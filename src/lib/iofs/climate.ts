import { fetchCckp, fetchTimeseries } from "@/lib/climate/cckp";
import {
  ENSEMBLE_ID,
  FUTURE_PERIOD_IDS,
  type PeriodId,
  type ScenarioId,
} from "@/lib/climate/taxonomy";

/**
 * Per-country climate change, 1950–2099, for any World Bank CCKP geography —
 * which includes every IOFS member (verified live against the archive for
 * all 43 before this module was written; see `lib/iofs/members.ts`).
 *
 * This is deliberately a thin wrapper around `lib/climate/cckp.ts`'s own
 * `fetchCckp`/`fetchTimeseries` — the exact functions the rest of the
 * platform already uses for Pakistan, Uzbekistan, Australia and New Zealand.
 * An IOFS member with no local grid still gets the real national CMIP6
 * aggregate; it only loses the sub-national choropleth, which this page never
 * draws.
 */

export interface SeriesPoint {
  year: number;
  value: number | null;
}

export interface CountryClimate {
  iso3: string;
  indicator: string;
  /** 1995–2014 historical climatology, ensemble median. */
  baseline: number | null;
  /** Ensemble-median anomaly vs baseline, by scenario and future horizon. */
  anomalies: Partial<Record<ScenarioId, Partial<Record<PeriodId, number | null>>>>;
  /** Full 1950–2099 annual trace per scenario (each already splices in the shared 1950–2014 historical run). */
  series: Partial<Record<ScenarioId, SeriesPoint[]>>;
}

export async function fetchCountryClimate(
  iso3: string,
  indicator: string,
  scenarios: ScenarioId[],
): Promise<CountryClimate> {
  const baselineResult = await fetchCckp({
    geography: iso3,
    variable: indicator,
    product: "climatology",
    aggregation: "annual",
    period: "1995-2014",
    percentile: "median",
    scenario: "historical",
    model: ENSEMBLE_ID,
  });

  const anomalies: CountryClimate["anomalies"] = {};
  const series: CountryClimate["series"] = {};

  await Promise.all(
    scenarios.map(async (scenario) => {
      const [periodEntries, timeseries] = await Promise.all([
        Promise.all(
          FUTURE_PERIOD_IDS.map(async (period) => {
            const result = await fetchCckp({
              geography: iso3,
              variable: indicator,
              product: "anomaly",
              aggregation: "annual",
              period,
              percentile: "median",
              scenario,
              model: ENSEMBLE_ID,
            });
            return [period, result?.value ?? null] as const;
          }),
        ),
        fetchTimeseries({ geography: iso3, variable: indicator, scenario }),
      ]);

      anomalies[scenario] = Object.fromEntries(periodEntries) as Partial<
        Record<PeriodId, number | null>
      >;
      series[scenario] = timeseries.map((p) => ({ year: p.year, value: p.value }));
    }),
  );

  return {
    iso3,
    indicator,
    baseline: baselineResult?.value ?? null,
    anomalies,
    series,
  };
}
