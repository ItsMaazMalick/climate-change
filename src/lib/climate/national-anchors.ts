import anchors from "../../../data/cckp-national.json";

/**
 * Real national values from the World Bank CCKP aggregate API.
 *
 * Fetched by `pnpm anchors:fetch` into `data/cckp-national.json` — 1,344
 * published values covering four countries × sixteen indicators × five
 * pathways × four horizons, plus the 1995–2014 baseline climatology.
 *
 * These exist so that no generated field carries an invented number. A
 * synthetic grid supplies the *spatial pattern*; the pattern is then shifted or
 * scaled so its area mean equals the published national value. Every quoted
 * figure therefore traces to the archive, and the interpolation is the only
 * modelled part — which `/methodology` states plainly.
 */

interface CountryAnchors {
  baseline: Record<string, number>;
  anomaly: Record<string, Record<string, Record<string, number>>>;
}

interface AnchorFile {
  source: string;
  endpoint: string;
  collection: string;
  fetchedAt: string;
  note: string;
  coverage: { requested: number; resolved: number };
  countries: Record<string, CountryAnchors>;
}

const DATA = anchors as unknown as AnchorFile;

export const ANCHOR_SOURCE = DATA.source;
export const ANCHOR_FETCHED_AT = DATA.fetchedAt;
export const ANCHOR_COVERAGE = DATA.coverage;

/** Published national baseline (1995–2014 climatology) for an indicator. */
export function nationalBaseline(country: string, indicator: string): number | null {
  const v = DATA.countries[country]?.baseline?.[indicator];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Published national change signal (ensemble median anomaly). */
export function nationalAnomaly(
  country: string,
  indicator: string,
  scenario: string,
  period: string,
): number | null {
  const v = DATA.countries[country]?.anomaly?.[indicator]?.[scenario]?.[period];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function hasAnchors(country: string): boolean {
  return Boolean(DATA.countries[country]);
}

/**
 * Rescale a spatial pattern so its area mean equals the published national
 * value, preserving the shape of the pattern.
 *
 * Multiplicative when the pattern mean and the anchor share a sign and the
 * mean is not near zero — a cell warming 20% faster than the national mean
 * should still warm 20% faster afterwards. Additive otherwise, which is the
 * safe choice for fields that change sign across the country (precipitation)
 * or whose mean is ~0.
 */
export function anchorPattern(
  values: Array<number | null>,
  anchor: number,
): Array<number | null> {
  let sum = 0;
  let count = 0;
  for (const v of values) {
    if (v === null || !Number.isFinite(v)) continue;
    sum += v;
    count += 1;
  }
  if (count === 0) return values;
  const mean = sum / count;

  const multiplicative =
    Math.abs(mean) > 1e-3 && Math.sign(mean) === Math.sign(anchor) && anchor !== 0;

  if (multiplicative) {
    const factor = anchor / mean;
    return values.map((v) => (v === null || !Number.isFinite(v) ? null : v * factor));
  }
  const shift = anchor - mean;
  return values.map((v) => (v === null || !Number.isFinite(v) ? null : v + shift));
}
