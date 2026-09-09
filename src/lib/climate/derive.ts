/**
 * The derivation layer.
 *
 * Every delta, absolute-from-anomaly, percentile-band and display-rounding
 * decision in the platform is made here, once. Field generators, API
 * handlers and components call these functions; nothing re-implements the
 * arithmetic locally.
 *
 * This module exists because D1–D3 in `docs/AUDIT.md` were the same class of
 * bug: one quantity computed two different ways in two places, and the two
 * ways disagreed. The contract enforced here is simple and absolute:
 *
 *     projected = baseline + delta          (within PROJECTION_TOLERANCE)
 *     p10 <= median <= p90                   (or the band is "unavailable")
 *     rounding happens at render, never to a stored value
 */

import { INDICATORS } from "./taxonomy";

/** Absolute vs. (baseline + delta) may differ by at most this, in the
 *  indicator's own units, before it is treated as a contradiction. */
export const PROJECTION_TOLERANCE = 0.05;

/** A p10–p90 band narrower than this is reported as unavailable rather than
 *  rendered as a fake-precise identical range (D3). */
export const DEGENERATE_SPREAD_EPS = 0.05;

/** z-score for the 10th/90th percentile of a normal distribution. */
const Z90 = 1.2816;

// ---------------------------------------------------------------------------
// Absolute <-> anomaly
// ---------------------------------------------------------------------------

function finite(x: number | null | undefined): x is number {
  return x !== null && x !== undefined && Number.isFinite(x);
}

/**
 * The projected absolute value. The ONLY place this composition is made.
 * A future absolute is never fetched or generated independently of the
 * baseline it is measured against.
 */
export function deriveProjected(
  baseline: number | null | undefined,
  delta: number | null | undefined,
): number | null {
  if (!finite(baseline) || !finite(delta)) return null;
  return baseline + delta;
}

/** The change signal implied by two absolutes. */
export function deriveDelta(
  baseline: number | null | undefined,
  projected: number | null | undefined,
): number | null {
  if (!finite(baseline) || !finite(projected)) return null;
  return projected - baseline;
}

// ---------------------------------------------------------------------------
// Model spread
// ---------------------------------------------------------------------------

export type SpreadFamily =
  | "temperature"
  | "heatDays"
  | "precip"
  | "floodRain"
  | "drySpell"
  | "degreeDays"
  | "generic";

/**
 * Per-family model-spread model. `sd` is expressed as a fraction of the
 * ensemble-median signal plus an absolute floor, so the band never collapses
 * onto the median even when the signal is small. Values are order-of-magnitude
 * calibrated to CMIP6 regional inter-model spread, not tuned to any single
 * archive query — the synthetic fields they feed are explicitly labelled as
 * such in the UI.
 */
const SPREAD_MODEL: Record<
  SpreadFamily,
  { sdFraction: number; sdFloor: number; allowSignFlip: boolean; nonNegative: boolean }
> = {
  temperature: { sdFraction: 0.22, sdFloor: 0.3, allowSignFlip: false, nonNegative: false },
  heatDays: { sdFraction: 0.38, sdFloor: 2.5, allowSignFlip: false, nonNegative: true },
  precip: { sdFraction: 0.85, sdFloor: 3, allowSignFlip: true, nonNegative: false },
  floodRain: { sdFraction: 0.55, sdFloor: 2, allowSignFlip: true, nonNegative: false },
  drySpell: { sdFraction: 0.6, sdFloor: 2.5, allowSignFlip: true, nonNegative: false },
  degreeDays: { sdFraction: 0.3, sdFloor: 25, allowSignFlip: false, nonNegative: true },
  generic: { sdFraction: 0.35, sdFloor: 0.5, allowSignFlip: true, nonNegative: false },
};

export function spreadFamilyFor(indicatorId: string): SpreadFamily {
  switch (indicatorId) {
    case "tas":
    case "tasmax":
    case "tasmin":
    case "txx":
    case "tnn":
      return "temperature";
    case "hd35":
    case "hd40":
    case "hd45":
    case "hd50":
    case "hi35":
    case "tr23":
    case "sd":
    case "wbt31":
    case "wsdi":
    case "fd":
    case "id":
      return "heatDays";
    case "pr":
      return "precip";
    case "rx1day":
    case "rx5day":
    case "r95ptot":
      return "floodRain";
    case "cdd":
    case "spei12":
      return "drySpell";
    case "cdd65":
    case "gsl":
      return "degreeDays";
    default:
      return "generic";
  }
}

export interface Band {
  p10: number | null;
  p90: number | null;
}

/**
 * The 10th/90th-percentile band around an ensemble-median change.
 *
 * Deterministic: the same median always yields the same band, so a field
 * generator asked for `p10` and one asked for `p90` return coherent,
 * non-degenerate values without needing a full 30-member draw.
 */
export function percentileSpread(
  medianDelta: number | null | undefined,
  indicatorId: string,
): Band {
  if (!finite(medianDelta)) return { p10: null, p90: null };
  const m = SPREAD_MODEL[spreadFamilyFor(indicatorId)];
  const sd = Math.max(m.sdFloor, m.sdFraction * Math.abs(medianDelta));
  let p10 = medianDelta - Z90 * sd;
  let p90 = medianDelta + Z90 * sd;
  if (!m.allowSignFlip) {
    if (medianDelta >= 0) p10 = Math.max(p10, 0);
    else p90 = Math.min(p90, 0);
  }
  if (m.nonNegative) {
    p10 = Math.max(p10, 0);
    p90 = Math.max(p90, 0);
  }
  return { p10, p90 };
}

export type PercentileKey = "mean" | "median" | "p10" | "p90";

/** The change signal at one ensemble percentile, derived from the median. */
export function deltaAtPercentile(
  medianDelta: number | null | undefined,
  indicatorId: string,
  percentile: PercentileKey,
): number | null {
  if (!finite(medianDelta)) return null;
  if (percentile === "median" || percentile === "mean") return medianDelta;
  const band = percentileSpread(medianDelta, indicatorId);
  return percentile === "p10" ? band.p10 : band.p90;
}

/**
 * D3 guard. A band this narrow is not precision — it is a computation that
 * failed to produce a spread. The caller renders "model spread unavailable at
 * this aggregation" instead of an identical p10 and p90.
 *
 * A band with a missing endpoint is *not* degenerate: that is honest absence,
 * already handled by `describeSpread`.
 */
export function isDegenerateSpread(
  p10: number | null | undefined,
  p90: number | null | undefined,
  eps = DEGENERATE_SPREAD_EPS,
): boolean {
  if (!finite(p10) || !finite(p90)) return false;
  return Math.abs(p90 - p10) < eps;
}

// ---------------------------------------------------------------------------
// Invariants
// ---------------------------------------------------------------------------

export class ProjectionInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectionInvariantError";
  }
}

/**
 * Throws in dev when `projected`, `baseline` and `delta` contradict each
 * other. Wired into the point and spread handlers. Silent in production so a
 * data-source hiccup degrades rather than 500s mid-demo — the smoke test runs
 * with NODE_ENV!=='production' and will catch a regression first.
 */
export function assertProjectionInvariant(args: {
  indicator: string;
  baseline: number | null | undefined;
  projected: number | null | undefined;
  delta: number | null | undefined;
  context?: string;
  tolerance?: number;
}): void {
  if (process.env.NODE_ENV === "production") return;
  const { baseline, projected, delta, indicator } = args;
  if (!finite(baseline) || !finite(projected) || !finite(delta)) return;
  const tol = args.tolerance ?? PROJECTION_TOLERANCE;
  const where = args.context ?? indicator;
  const expected = baseline + delta;

  if (Math.abs(projected - expected) > tol) {
    throw new ProjectionInvariantError(
      `[${where}] projected ${projected} != baseline ${baseline} + delta ${delta} ` +
        `(expected ${expected.toFixed(3)}, off by ${(projected - expected).toFixed(3)}, tol ${tol}).`,
    );
  }
  // The exact D1/D2 signature: a real change reported, yet the absolute never moved.
  if (Math.abs(delta) > tol && Math.abs(projected - baseline) < tol) {
    throw new ProjectionInvariantError(
      `[${where}] projected equals baseline (${baseline}) while delta is ${delta}.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Rounding — render only
// ---------------------------------------------------------------------------

/**
 * The single rounding policy. Applied when a value is turned into text or a
 * pixel, never before. Stored fields and API payloads keep full precision so
 * two panels rounding the same source value can never disagree by a tenth
 * (D7).
 */
export function roundForDisplay(
  value: number | null | undefined,
  precision: number,
): number | null {
  if (!finite(value)) return null;
  const f = 10 ** precision;
  return Math.round(value * f) / f;
}

/** Display precision for an indicator, from the taxonomy. */
export function displayPrecision(indicatorId: string): number {
  return INDICATORS[indicatorId]?.precision ?? 1;
}
