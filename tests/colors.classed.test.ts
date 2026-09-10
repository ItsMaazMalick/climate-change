import { describe, expect, it } from "vitest";

import { buildClassedScale } from "@/lib/colors";

/**
 * Regression guard for the flat-map defect.
 *
 * The continuous diverging scale was anchored symmetrically about zero. Every
 * region of a country shares the sign of the warming signal, so the data
 * occupied only 4–17% of the ramp and every map rendered as one block of
 * colour. Measured on SSP2-4.5 2040–2059 temperature anomaly:
 * PAK 16.6%, UZB 7.6%, AUS 4.1%, NZL 5.0%.
 */
describe("buildClassedScale", () => {
  // The real Uzbekistan district spread that rendered flat.
  const uzb = Array.from({ length: 195 }, (_, i) => 1.648 + (i / 194) * (1.943 - 1.648));

  it("gives an all-positive country real contrast", () => {
    const scale = buildClassedScale({ values: uzb, indicatorId: "tas", product: "anomaly" });
    const colors = new Set(uzb.map((v) => scale(v)));
    // Previously every district collapsed onto one or two colours.
    expect(colors.size).toBeGreaterThanOrEqual(5);
    expect(scale.breaks.length).toBe(7);
  });

  it("keeps one-sided data on a single arm of the diverging ramp", () => {
    const scale = buildClassedScale({ values: uzb, indicatorId: "tas", product: "anomaly" });
    // All-positive data must not report itself as spanning zero.
    expect(scale.diverging).toBe(false);
    expect(scale.breaks[0]!.from).toBeGreaterThan(0);
  });

  it("stays symmetric about zero when the data really straddles it", () => {
    const straddling = [-4, -2, -1, 0, 1, 2, 4];
    const scale = buildClassedScale({
      values: straddling,
      indicatorId: "pr",
      product: "anomaly",
    });
    expect(scale.diverging).toBe(true);
    const first = scale.breaks[0]!.from;
    const last = scale.breaks[scale.breaks.length - 1]!.to;
    expect(first).toBeCloseTo(-last, 6);
  });

  it("produces contiguous, ordered breaks", () => {
    const scale = buildClassedScale({ values: uzb, indicatorId: "tas", product: "anomaly" });
    for (let i = 1; i < scale.breaks.length; i += 1) {
      expect(scale.breaks[i]!.from).toBeCloseTo(scale.breaks[i - 1]!.to, 6);
      expect(scale.breaks[i]!.to).toBeGreaterThan(scale.breaks[i]!.from);
    }
  });

  it("covers the whole data range", () => {
    const scale = buildClassedScale({ values: uzb, indicatorId: "tas", product: "anomaly" });
    const lo = scale.breaks[0]!.from;
    const hi = scale.breaks[scale.breaks.length - 1]!.to;
    // p02/p98 trimming means the extremes clamp rather than fall outside.
    expect(scale(uzb[0]!)).toBe(scale.breaks[0]!.color);
    expect(scale(uzb[uzb.length - 1]!)).toBe(scale.breaks[scale.breaks.length - 1]!.color);
    expect(hi).toBeGreaterThan(lo);
  });

  it("survives a spatially uniform field without dividing by zero", () => {
    const flat = Array.from({ length: 50 }, () => 17.68);
    const scale = buildClassedScale({ values: flat, indicatorId: "pr", product: "anomaly" });
    expect(scale.breaks.length).toBe(7);
    expect(scale(17.68)).toMatch(/^(#|rgb)/);
  });

  it("returns no breaks and the no-data colour when nothing is valued", () => {
    const scale = buildClassedScale({
      values: [null, undefined, Number.NaN],
      indicatorId: "tas",
      product: "anomaly",
    });
    expect(scale.breaks).toEqual([]);
    expect(scale(1)).toMatch(/^#/);
  });

  it("maps a missing value to the no-data colour, never a class colour", () => {
    const scale = buildClassedScale({ values: uzb, indicatorId: "tas", product: "anomaly" });
    const classColors = new Set(scale.breaks.map((b) => b.color));
    expect(classColors.has(scale(null))).toBe(false);
  });
});
