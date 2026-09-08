import "dotenv/config";

import { PLACES } from "../src/lib/climate/places";
import {
  FUTURE_PERIOD_IDS,
  HEADLINE_SCENARIO_IDS,
  GRIDDED_INDICATOR_IDS,
} from "../src/lib/climate/taxonomy";

/**
 * Pre-populate the response cache against a running instance.
 *
 * The upstream CCKP API takes one to three seconds per call, so the first
 * visitor to any uncached combination pays for it. Because climate
 * projections are immutable, that cost only ever needs to be paid once —
 * running this after a deploy moves it off the critical path entirely.
 *
 * Usage:  npx tsx scripts/warm-cache.ts [baseUrl] [--full]
 */

const BASE = process.argv[2]?.startsWith("http")
  ? process.argv[2]
  : "http://localhost:3000";
const FULL = process.argv.includes("--full");
const CONCURRENCY = 6;

function buildTargets(): string[] {
  const urls = new Set<string>();

  // The map fields: what the explorer loads on first paint.
  const indicators = FULL ? GRIDDED_INDICATOR_IDS : ["tas", "pr", "hd35", "hd40"];
  for (const indicator of indicators) {
    for (const scenario of HEADLINE_SCENARIO_IDS) {
      for (const period of FUTURE_PERIOD_IDS) {
        for (const product of ["anomaly", "climatology"]) {
          urls.add(
            `/api/climate/field?indicator=${indicator}&scenario=${scenario}` +
              `&period=${period}&product=${product}`,
          );
        }
      }
    }
  }

  // National trajectories: five upstream calls each, and the slowest thing
  // the application does.
  for (const indicator of indicators) {
    urls.add(`/api/climate/trajectory?indicator=${indicator}&smooth=11`);
  }

  // Story pages for the largest cities.
  const places = FULL ? PLACES : [...PLACES].sort((a, b) => b.population - a.population).slice(0, 8);
  for (const place of places) {
    for (const scenario of HEADLINE_SCENARIO_IDS) {
      urls.add(`/api/climate/story?place=${place.id}&scenario=${scenario}&period=2040-2059`);
    }
  }

  urls.add("/api/meta");
  return [...urls];
}

async function main() {
  const targets = buildTargets();
  console.log(`warming ${targets.length} responses against ${BASE}`);

  let done = 0;
  let failed = 0;
  const startedAt = Date.now();

  // A fixed pool rather than Promise.all: firing 400 requests at once would
  // simply queue behind the upstream semaphore while burning sockets.
  const queue = [...targets];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let url = queue.pop(); url; url = queue.pop()) {
        try {
          const response = await fetch(`${BASE}${url}`);
          if (!response.ok) failed += 1;
          await response.arrayBuffer();
        } catch {
          failed += 1;
        }
        done += 1;
        if (done % 25 === 0) {
          const elapsed = (Date.now() - startedAt) / 1000;
          console.log(`  ${done}/${targets.length}  ${elapsed.toFixed(0)}s`);
        }
      }
    }),
  );

  const elapsed = (Date.now() - startedAt) / 1000;
  console.log(
    `done — ${done - failed}/${done} warmed in ${elapsed.toFixed(0)}s` +
      (failed ? ` (${failed} unavailable upstream, which is expected for sparse combinations)` : ""),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
