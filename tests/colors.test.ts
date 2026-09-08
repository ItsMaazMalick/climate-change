import { describe, expect, it } from "vitest";

import { agreementOpacity, buildScale, rampFor } from "@/lib/colors";

describe("ramp selection", () => {
  it("uses a diverging ramp for anomalies and a sequential one for absolutes", () => {
    expect(rampFor("tas", "anomaly")).toBe("diverging-warm");
    expect(rampFor("tas", "climatology")).toBe("sequential-heat");
  });

  it("gives moisture its own diverging ramp", () => {
    // A precipitation anomaly drawn on the temperature ramp is the most
    // common misreading of a climate map.
    expect(rampFor("pr", "anomaly")).toBe("diverging-moisture");
    expect(rampFor("rx5day", "anomaly")).toBe("diverging-moisture");
    expect(rampFor("cdd", "anomaly")).toBe("diverging-moisture");
  });
});

describe("colour scales", () => {
  it("forces diverging domains to be symmetric about zero", () => {
    // An asymmetric diverging scale exaggerates whichever arm has the larger
    // extreme, so +1 °C and −1 °C would render at different saturations.
    const scale = buildScale({ min: -0.5, max: 4, indicatorId: "tas", product: "anomaly" });
    expect(scale.domain[0]).toBe(-4);
    expect(scale.domain[1]).toBe(4);
    expect(scale(1)).not.toBe(scale(-1));
    expect(scale(0)).toBe(scale(0));
  });

  it("leaves sequential domains alone", () => {
    const scale = buildScale({ min: 10, max: 30, indicatorId: "tas", product: "climatology" });
    expect(scale.domain).toEqual([10, 30]);
  });

  it("renders a missing value as the no-data colour, not as zero", () => {
    const scale = buildScale({ min: -2, max: 2, indicatorId: "tas", product: "anomaly" });
    expect(scale(null)).not.toBe(scale(0));
    expect(scale(Number.NaN)).toBe(scale(null));
  });

  it("clamps values beyond the domain instead of wrapping", () => {
    const scale = buildScale({ min: -2, max: 2, indicatorId: "tas", product: "anomaly" });
    expect(scale(100)).toBe(scale(2));
    expect(scale(-100)).toBe(scale(-2));
  });

  it("produces the requested number of legend ticks", () => {
    const scale = buildScale({ min: 0, max: 10, indicatorId: "hd35", product: "climatology" });
    expect(scale.ticks(5)).toHaveLength(5);
  });
});

describe("agreementOpacity", () => {
  it("fades cells where models conflict on the sign", () => {
    expect(agreementOpacity(2)).toBeLessThan(1);
  });

  it("hides cells with no data entirely", () => {
    expect(agreementOpacity(0)).toBe(0);
  });

  it("draws robust and unclassified cells at full opacity", () => {
    expect(agreementOpacity(1)).toBe(1);
    expect(agreementOpacity(null)).toBe(1);
  });
});
