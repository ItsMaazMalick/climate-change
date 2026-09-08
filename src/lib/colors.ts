import { interpolateRgbBasis } from "d3-interpolate";

import { INDICATORS, SCENARIOS, type ScenarioId } from "./climate/taxonomy";

/**
 * Colour for climate fields.
 *
 * Two families, chosen for different jobs:
 *
 * - **Diverging** ramps for anomalies, where zero is a meaningful midpoint
 *   and the reader needs to see sign at a glance. The scale is forced to be
 *   symmetric about zero so that a +2 °C cell and a −2 °C cell are equally
 *   saturated; an asymmetric diverging scale silently exaggerates whichever
 *   side has the larger extreme.
 * - **Sequential** ramps for absolute climatologies, where there is no
 *   natural midpoint.
 *
 * Both are perceptually ordered (lightness increases monotonically along each
 * arm) so the map is still readable in greyscale and to viewers with the
 * common forms of colour vision deficiency.
 */

// Warm-cool diverging, blue → neutral → red. Deuteranopia-safe: the arms
// differ in lightness as well as hue.
const DIVERGING_WARM = [
  "#2166ac", "#4393c3", "#92c5de", "#d1e5f0",
  "#f7f7f7",
  "#fddbc7", "#f4a582", "#d6604d", "#b2182b",
];

// Brown → neutral → teal, the convention for moisture anomalies. Reversed
// relative to temperature so "more" reads as wetter rather than hotter.
const DIVERGING_MOISTURE = [
  "#8c510a", "#bf812d", "#dfc27d", "#f6e8c3",
  "#f5f5f5",
  "#c7eae5", "#80cdc1", "#35978f", "#01665e",
];

const SEQUENTIAL_HEAT = [
  "#fff7ec", "#fee8c8", "#fdd49e", "#fdbb84",
  "#fc8d59", "#ef6548", "#d7301f", "#b30000", "#7f0000",
];

const SEQUENTIAL_WATER = [
  "#f7fbff", "#deebf7", "#c6dbef", "#9ecae1",
  "#6baed6", "#4292c6", "#2171b5", "#08519c", "#08306b",
];

const SEQUENTIAL_COLD = [
  "#ffffff", "#e0f3f8", "#abd9e9", "#74add1",
  "#4575b4", "#313695", "#1a1a5e",
];

export type RampKind = "diverging-warm" | "diverging-moisture" | "sequential-heat" | "sequential-water" | "sequential-cold";

const RAMPS: Record<RampKind, string[]> = {
  "diverging-warm": DIVERGING_WARM,
  "diverging-moisture": DIVERGING_MOISTURE,
  "sequential-heat": SEQUENTIAL_HEAT,
  "sequential-water": SEQUENTIAL_WATER,
  "sequential-cold": SEQUENTIAL_COLD,
};

/**
 * Pick a ramp from the indicator and the product.
 *
 * The moisture family gets its own diverging ramp so that a precipitation
 * anomaly is never mistaken for a temperature anomaly at a glance — the
 * single most common misreading of climate maps.
 */
export function rampFor(indicatorId: string, product: string): RampKind {
  const indicator = INDICATORS[indicatorId];
  const family = indicator?.family ?? "temperature";
  const isAnomaly = product === "anomaly";

  if (isAnomaly) {
    return family === "precipitation" || family === "flood" || family === "drought" || family === "cryosphere"
      ? "diverging-moisture"
      : "diverging-warm";
  }

  switch (family) {
    case "precipitation":
    case "flood":
      return "sequential-water";
    case "cryosphere":
      return "sequential-cold";
    case "drought":
      return "sequential-heat";
    default:
      return "sequential-heat";
  }
}

export interface ColorScale {
  /** Map a value to a hex colour. */
  (value: number | null | undefined): string;
  domain: [number, number];
  diverging: boolean;
  ramp: RampKind;
  /** Evenly spaced sample points, for the legend. */
  ticks: (count: number) => Array<{ value: number; color: string }>;
}

// No-data cells sit on a light ground now, so they must read as "absent"
// rather than as the dark end of a sequential ramp.
const NO_DATA = "#e8ece4";

export function buildScale(options: {
  min: number;
  max: number;
  indicatorId: string;
  product: string;
}): ColorScale {
  const ramp = rampFor(options.indicatorId, options.product);
  const diverging = ramp.startsWith("diverging");
  const interpolate = interpolateRgbBasis(RAMPS[ramp]);

  let [lo, hi] = [options.min, options.max];

  if (diverging) {
    // Symmetric about zero, so sign is read from hue and magnitude from
    // saturation without one arm being compressed.
    const extent = Math.max(Math.abs(lo), Math.abs(hi)) || 1;
    lo = -extent;
    hi = extent;
  }

  if (hi === lo) hi = lo + 1;

  const scale = ((value: number | null | undefined) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return NO_DATA;
    const t = Math.min(1, Math.max(0, (value - lo) / (hi - lo)));
    return interpolate(t);
  }) as ColorScale;

  scale.domain = [lo, hi];
  scale.diverging = diverging;
  scale.ramp = ramp;
  scale.ticks = (count: number) =>
    Array.from({ length: count }, (_, i) => {
      const value = lo + ((hi - lo) * i) / (count - 1);
      return { value, color: scale(value) };
    });

  return scale;
}

export function scenarioColor(id: ScenarioId): string {
  return SCENARIOS[id]?.color ?? "#6b7280";
}

export const NO_DATA_COLOR = NO_DATA;

/**
 * Stipple pattern opacity for cells where models disagree on the sign of the
 * change. Rendering disagreement as reduced opacity rather than as a separate
 * overlay keeps the map to one visual channel per fact.
 */
export function agreementOpacity(flag: number | null | undefined): number {
  if (flag === null || flag === undefined) return 1;
  if (flag === 0) return 0; // no data
  if (flag === 2) return 0.35; // conflicting signal between models
  return 1;
}
