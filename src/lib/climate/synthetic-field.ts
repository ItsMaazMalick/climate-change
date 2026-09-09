import { deltaAtPercentile, percentileSpread } from "./derive";
import {
  anchorPattern,
  nationalAnomaly,
  nationalBaseline,
} from "./national-anchors";
import type { PercentileId, ProductId } from "./taxonomy";

/**
 * Compose a generated field from a spatial *pattern* plus the real published
 * national value.
 *
 * The generators supply two dimensionless-ish patterns per cell — a baseline
 * climatology and an ensemble-median change — built from elevation, latitude
 * and known regional features. Neither is authoritative on its own. This
 * function shifts or scales each pattern so its area mean equals the CCKP
 * national aggregate, so the number a reader quotes is real even where the
 * spatial detail is interpolated.
 *
 * The D1–D3 contract is preserved by construction: the future absolute is
 * `anchoredBaseline + delta`, and `delta` moves with the requested percentile.
 */
export function composeAnchoredField(opts: {
  country: string;
  variable: string;
  scenario: string;
  period: string;
  percentile: PercentileId;
  product: ProductId;
  baselinePattern: Array<number | null>;
  anomalyPattern: Array<number | null>;
}): {
  values: Array<number | null>;
  significance: Array<number | null>;
  stats: { count: number; min: number | null; max: number | null; mean: number | null };
  /** True when both the baseline and the change were tied to a published value. */
  anchored: boolean;
  effectiveProduct: ProductId;
} {
  const { country, variable, scenario, period, percentile, product } = opts;

  const isBaselinePeriod = period === "1995-2014" || scenario === "historical";
  const effectiveProduct: ProductId = isBaselinePeriod ? "climatology" : product;

  const baseAnchor = nationalBaseline(country, variable);
  const anomAnchor = isBaselinePeriod
    ? null
    : nationalAnomaly(country, variable, scenario, period);

  const base =
    baseAnchor !== null
      ? anchorPattern(opts.baselinePattern, baseAnchor)
      : opts.baselinePattern;
  const anom =
    anomAnchor !== null
      ? anchorPattern(opts.anomalyPattern, anomAnchor)
      : opts.anomalyPattern;

  const n = opts.baselinePattern.length;
  const values: Array<number | null> = new Array(n);
  const significance: Array<number | null> = new Array(n);

  let sum = 0;
  let count = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < n; i += 1) {
    const b = base[i];
    if (b === null || b === undefined) {
      values[i] = null;
      significance[i] = 0;
      continue;
    }

    let value: number;
    let sig = 1;

    if (isBaselinePeriod) {
      value = b;
      sig = 0;
    } else {
      const median = anom[i];
      if (median === null || median === undefined) {
        values[i] = null;
        significance[i] = 0;
        continue;
      }
      const delta = deltaAtPercentile(median, variable, percentile) ?? median;
      const band = percentileSpread(median, variable);
      // Models disagree on the direction of change where the band straddles zero.
      sig = band.p10 !== null && band.p90 !== null && band.p10 < 0 && band.p90 > 0 ? 2 : 1;
      value = effectiveProduct === "climatology" ? b + delta : delta;
    }

    values[i] = value;
    significance[i] = sig;
    sum += value;
    count += 1;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  return {
    values,
    significance,
    stats: {
      count,
      min: count > 0 ? min : null,
      max: count > 0 ? max : null,
      // Full precision — rounding happens at render (D7).
      mean: count > 0 ? sum / count : null,
    },
    anchored: baseAnchor !== null && (isBaselinePeriod || anomAnchor !== null),
    effectiveProduct,
  };
}
