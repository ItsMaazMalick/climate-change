/**
 * Pre-warm the on-disk CCKP cache for every IOFS member so the `/iofs` page
 * never pays the upstream archive's 1–3 s-per-call latency on a visitor's
 * first load.
 *
 * Calls the exact same `fetchCckp` / `fetchTimeseries` functions the app
 * uses at request time (`src/lib/climate/cckp.ts`), so whatever lands in
 * `.cache/climate/` is byte-identical to what a live request would have
 * produced — this script only changes *when* the upstream call happens, not
 * what it returns.
 *
 *   pnpm iofs:warm
 */

import { fetchCckp, fetchTimeseries } from "../src/lib/climate/cckp";
import { ENSEMBLE_ID, FUTURE_PERIOD_IDS, SSP_IDS } from "../src/lib/climate/taxonomy";
import { IOFS_MEMBERS } from "../src/lib/iofs/members";
import { getIofsRanking } from "../src/lib/iofs/ranking";

const INDICATORS = ["tas", "pr"] as const;

async function warmCountry(iso3: string) {
  const jobs: Array<Promise<unknown>> = [];

  for (const indicator of INDICATORS) {
    jobs.push(
      fetchCckp({
        geography: iso3,
        variable: indicator,
        product: "climatology",
        aggregation: "annual",
        period: "1995-2014",
        percentile: "median",
        scenario: "historical",
        model: ENSEMBLE_ID,
      }),
    );
    for (const scenario of SSP_IDS) {
      jobs.push(fetchTimeseries({ geography: iso3, variable: indicator, scenario }));
      for (const period of FUTURE_PERIOD_IDS) {
        jobs.push(
          fetchCckp({
            geography: iso3,
            variable: indicator,
            product: "anomaly",
            aggregation: "annual",
            period,
            percentile: "median",
            scenario,
            model: ENSEMBLE_ID,
          }),
        );
      }
    }
  }

  await Promise.all(jobs);
}

async function main() {
  console.log(`Warming CCKP cache for ${IOFS_MEMBERS.length} IOFS members …`);
  let done = 0;
  for (const member of IOFS_MEMBERS) {
    await warmCountry(member.iso3);
    done += 1;
    console.log(`  ${done}/${IOFS_MEMBERS.length}  ${member.flag} ${member.name}`);
  }

  console.log("Warming the ranking endpoint …");
  const ranking = await getIofsRanking();
  console.log(`  resolved ${ranking.filter((r) => r.baselineTas !== null).length}/${ranking.length} baselines`);

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
