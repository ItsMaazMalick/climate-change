import { describe, expect, it } from "vitest";

import {
  assertProjectionInvariant,
  coherentDisplay,
  deltaAtPercentile,
  deriveDelta,
  deriveProjected,
  DEGENERATE_SPREAD_EPS,
  isDegenerateSpread,
  percentileSpread,
  ProjectionInvariantError,
  roundForDisplay,
  spreadFamilyFor,
} from "@/lib/climate/derive";

describe("deriveProjected / deriveDelta", () => {
  it("composes baseline + delta", () => {
    expect(deriveProjected(10.4, 1.8)).toBeCloseTo(12.2, 10);
  });

  it("is the exact inverse of deriveDelta", () => {
    const baseline = 13.31;
    const delta = 2.54;
    const projected = deriveProjected(baseline, delta)!;
    expect(deriveDelta(baseline, projected)).toBeCloseTo(delta, 10);
  });

  it("returns null when either input is missing or non-finite", () => {
    expect(deriveProjected(null, 1.8)).toBeNull();
    expect(deriveProjected(10, undefined)).toBeNull();
    expect(deriveProjected(10, Number.NaN)).toBeNull();
  });
});

describe("percentileSpread", () => {
  it("never collapses onto the median (D3)", () => {
    const band = percentileSpread(1.8, "tas");
    expect(band.p10).not.toBeNull();
    expect(band.p90).not.toBeNull();
    expect(band.p90! - band.p10!).toBeGreaterThan(DEGENERATE_SPREAD_EPS);
    expect(band.p10!).toBeLessThan(1.8);
    expect(band.p90!).toBeGreaterThan(1.8);
  });

  it("keeps a spread even for a near-zero signal via the floor", () => {
    const band = percentileSpread(0.01, "tas");
    expect(band.p90! - band.p10!).toBeGreaterThan(0.3);
  });

  it("does not flip the sign of a temperature change", () => {
    const band = percentileSpread(0.4, "tas");
    expect(band.p10!).toBeGreaterThanOrEqual(0);
  });

  it("allows a precipitation band to straddle zero", () => {
    const band = percentileSpread(2, "pr");
    expect(band.p10!).toBeLessThan(0);
    expect(band.p90!).toBeGreaterThan(0);
  });

  it("returns nulls for a missing median", () => {
    expect(percentileSpread(null, "tas")).toEqual({ p10: null, p90: null });
  });
});

describe("deltaAtPercentile", () => {
  it("returns the median unchanged for median/mean", () => {
    expect(deltaAtPercentile(1.8, "tas", "median")).toBe(1.8);
    expect(deltaAtPercentile(1.8, "tas", "mean")).toBe(1.8);
  });

  it("orders p10 < median < p90", () => {
    const p10 = deltaAtPercentile(1.8, "tas", "p10")!;
    const p90 = deltaAtPercentile(1.8, "tas", "p90")!;
    expect(p10).toBeLessThan(1.8);
    expect(p90).toBeGreaterThan(1.8);
  });
});

describe("isDegenerateSpread", () => {
  it("flags an identical p10 and p90 (the D3 bug signature)", () => {
    expect(isDegenerateSpread(3.4, 3.4)).toBe(true);
    expect(isDegenerateSpread(1.8, 1.82)).toBe(true);
  });

  it("does not flag a real band", () => {
    expect(isDegenerateSpread(1.1, 2.8)).toBe(false);
  });

  it("treats a missing endpoint as honest absence, not degeneracy", () => {
    expect(isDegenerateSpread(null, 2.8)).toBe(false);
    expect(isDegenerateSpread(1.1, null)).toBe(false);
  });
});

describe("assertProjectionInvariant", () => {
  it("passes when projected == baseline + delta", () => {
    expect(() =>
      assertProjectionInvariant({
        indicator: "tas",
        baseline: 10.4,
        projected: 12.2,
        delta: 1.8,
      }),
    ).not.toThrow();
  });

  it("throws on the D1 signature: real delta, unchanged absolute", () => {
    expect(() =>
      assertProjectionInvariant({
        indicator: "tas",
        baseline: 10.4,
        projected: 10.4,
        delta: 1.8,
      }),
    ).toThrow(ProjectionInvariantError);
  });

  it("throws when the three numbers disagree beyond tolerance", () => {
    expect(() =>
      assertProjectionInvariant({
        indicator: "tas",
        baseline: 10.4,
        projected: 15.0,
        delta: 1.8,
      }),
    ).toThrow(ProjectionInvariantError);
  });

  it("tolerates sub-0.05 rounding noise", () => {
    expect(() =>
      assertProjectionInvariant({
        indicator: "tas",
        baseline: 10.4,
        projected: 12.24,
        delta: 1.8,
      }),
    ).not.toThrow();
  });
});

describe("roundForDisplay", () => {
  it("rounds to the requested precision without mutating intent", () => {
    expect(roundForDisplay(1.849, 1)).toBe(1.8);
    expect(roundForDisplay(1.85, 1)).toBe(1.9);
    expect(roundForDisplay(44.6, 0)).toBe(45);
  });

  it("returns null for non-finite input", () => {
    expect(roundForDisplay(null, 1)).toBeNull();
    expect(roundForDisplay(Number.NaN, 1)).toBeNull();
  });
});

describe("spreadFamilyFor", () => {
  it("maps indicators to a family", () => {
    expect(spreadFamilyFor("tas")).toBe("temperature");
    expect(spreadFamilyFor("hd35")).toBe("heatDays");
    expect(spreadFamilyFor("pr")).toBe("precip");
    expect(spreadFamilyFor("rx5day")).toBe("floodRain");
    expect(spreadFamilyFor("cdd")).toBe("drySpell");
    expect(spreadFamilyFor("cdd65")).toBe("degreeDays");
    expect(spreadFamilyFor("spei12")).toBe("drySpell");
  });
});

describe("coherentDisplay", () => {
  it("makes baseline + change equal projected on screen (D7)", () => {
    // The exact readout defect: 24.45 + 1.46 = 25.91 rendered as
    // "24.5 + 1.5 = 25.9".
    const s = coherentDisplay(24.45, 1.46, "tas");
    expect(s.baseline).toBe(24.5);
    expect(s.delta).toBe(1.5);
    expect(s.projected).toBe(26.0);
    expect(s.baseline! + s.delta!).toBeCloseTo(s.projected!, 10);
  });

  it("kills binary floating-point tails in the sum", () => {
    const s = coherentDisplay(24.5, 1.5, "tas");
    expect(s.projected).toBe(26);
  });

  it("respects the indicator's precision (day counts are integers)", () => {
    const s = coherentDisplay(44.6, 11.7, "hd35");
    expect(s.baseline).toBe(45);
    expect(s.delta).toBe(12);
    expect(s.projected).toBe(57);
  });

  it("propagates nulls", () => {
    expect(coherentDisplay(null, 1.5, "tas").projected).toBeNull();
    expect(coherentDisplay(24.5, null, "tas").projected).toBeNull();
  });
});
