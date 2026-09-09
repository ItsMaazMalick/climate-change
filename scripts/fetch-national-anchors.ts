/**
 * Fetch the REAL national values from the World Bank CCKP aggregate API and
 * write them to `data/cckp-national.json`.
 *
 * Why this exists: Uzbekistan, Australia and New Zealand have no locally
 * rasterised grid, so their map fields are generated. Those generators used to
 * carry hand-written warming numbers, which for Australia and New Zealand did
 * not match the archive (AUS SSP2-4.5 2040–2059: generator 1.48 °C vs CCKP
 * 1.27 °C). After this script, every generated field is *anchored* to the
 * published national value — the spatial pattern is an interpolation, but the
 * national mean is real and traceable.
 *
 *   pnpm anchors:fetch
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.CCKP_API_BASE ?? "https://cckpapi.worldbank.org/cckp/v1";
const COLLECTION = "cmip6-x0.25";

const COUNTRIES = ["PAK", "UZB", "AUS", "NZL"] as const;
const SCENARIOS = ["ssp119", "ssp126", "ssp245", "ssp370", "ssp585"] as const;
const PERIODS = ["2020-2039", "2040-2059", "2060-2079", "2080-2099"] as const;
const BASELINE = "1995-2014";
const INDICATORS = [
  "tas", "tasmax", "tasmin", "txx", "tnn",
  "pr", "rx1day", "rx5day", "r95ptot",
  "hd35", "hd40", "hi35", "tr23", "sd",
  "cdd", "cdd65",
] as const;

type Product = "anomaly" | "climatology";

function url(opts: {
  variable: string;
  product: Product;
  period: string;
  scenario: string;
  geography: string;
}) {
  const slug = [
    COLLECTION,
    "climatology",
    opts.variable,
    opts.product,
    "annual",
    opts.period,
    "median",
    opts.scenario,
    "ensemble",
    "all",
    "mean",
  ].join("_");
  return `${BASE}/${slug}/${opts.geography}?_format=json`;
}

async function fetchValue(u: string): Promise<number | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(u, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as {
        data?: Record<string, Record<string, number | null>> | unknown[];
      };
      const data = json.data;
      if (!data || Array.isArray(data)) return null;
      const geoBlock = Object.values(data)[0];
      if (!geoBlock || typeof geoBlock !== "object") return null;
      const v = Object.values(geoBlock)[0];
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    } catch {
      if (attempt === 2) return null;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  return null;
}

/** Bounded-concurrency map. The archive rate-limits aggressive fan-out. */
async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}

interface Job {
  country: string;
  indicator: string;
  scenario: string;
  period: string;
  product: Product;
}

async function main() {
  const jobs: Job[] = [];
  for (const country of COUNTRIES) {
    for (const indicator of INDICATORS) {
      // Baseline climatology (historical run).
      jobs.push({
        country,
        indicator,
        scenario: "historical",
        period: BASELINE,
        product: "climatology",
      });
      for (const scenario of SCENARIOS) {
        for (const period of PERIODS) {
          jobs.push({ country, indicator, scenario, period, product: "anomaly" });
        }
      }
    }
  }

  console.log(`Fetching ${jobs.length} national values from ${BASE} …`);
  let done = 0;
  const results = await pool(jobs, 8, async (job) => {
    const value = await fetchValue(
      url({
        variable: job.indicator,
        product: job.product,
        period: job.period,
        scenario: job.scenario,
        geography: job.country,
      }),
    );
    done += 1;
    if (done % 100 === 0) console.log(`  ${done}/${jobs.length}`);
    return { job, value };
  });

  // { [country]: { baseline: { [ind]: v }, anomaly: { [ind]: { [ssp]: { [period]: v } } } } }
  const out: Record<string, {
    baseline: Record<string, number>;
    anomaly: Record<string, Record<string, Record<string, number>>>;
  }> = {};

  for (const { job, value } of results) {
    if (value === null) continue;
    out[job.country] ??= { baseline: {}, anomaly: {} };
    const bucket = out[job.country]!;
    if (job.product === "climatology") {
      bucket.baseline[job.indicator] = value;
    } else {
      bucket.anomaly[job.indicator] ??= {};
      bucket.anomaly[job.indicator]![job.scenario] ??= {};
      bucket.anomaly[job.indicator]![job.scenario]![job.period] = value;
    }
  }

  const hits = results.filter((r) => r.value !== null).length;
  const payload = {
    source: "World Bank Climate Change Knowledge Portal — CMIP6 (0.25°) aggregate API",
    endpoint: BASE,
    collection: COLLECTION,
    fetchedAt: new Date().toISOString(),
    note:
      "National spatial aggregates, ensemble median for anomalies and ensemble mean for the baseline climatology. These are the real published values used to anchor generated fields.",
    coverage: { requested: jobs.length, resolved: hits },
    countries: out,
  };

  const dir = path.join(process.cwd(), "data");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, "cckp-national.json");
  await writeFile(file, JSON.stringify(payload, null, 2));
  console.log(`\nResolved ${hits}/${jobs.length}. Wrote ${file}`);
  for (const c of COUNTRIES) {
    const b = out[c];
    console.log(
      `  ${c}: baseline tas=${b?.baseline.tas ?? "—"}  ssp245/2040-2059 Δtas=${
        b?.anomaly.tas?.ssp245?.["2040-2059"] ?? "—"
      }`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
