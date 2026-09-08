import { describe, expect, it } from "vitest";

import {
  analogueFor,
  describeSpread,
  MECHANISMS,
  mechanismsFor,
  signalToNoise,
} from "@/lib/climate/interpret";

describe("describeSpread", () => {
  it("says models agree on direction when the band excludes zero", () => {
    const text = describeSpread({ median: 1.8, p10: 1.1, p90: 2.8 }, "tas");
    expect(text).toContain("all agree on the direction");
    expect(text).toContain("+1.8°C");
  });

  it("says models disagree on sign when the band straddles zero", () => {
    const text = describeSpread({ median: 2, p10: -8, p90: 14 }, "pr");
    expect(text).toContain("disagree even on whether");
  });

  it("does not invent a range when percentiles are missing", () => {
    const text = describeSpread({ median: 1.5, p10: null, p90: null }, "tas");
    expect(text).toContain("not available");
    expect(text).not.toContain("80% of models");
  });

  it("reports absence rather than a number when there is no projection", () => {
    expect(describeSpread({ median: null, p10: null, p90: null }, "tas")).toBe(
      "No projection available.",
    );
  });
});

describe("signalToNoise", () => {
  it("calls a narrow, sign-consistent band strong", () => {
    expect(signalToNoise({ median: 3, p10: 2.5, p90: 3.5 })).toBe("strong");
  });

  it("calls a sign-consistent but wide band moderate", () => {
    expect(signalToNoise({ median: 1, p10: 0.2, p90: 4 })).toBe("moderate");
  });

  it("calls a sign-inconsistent band weak", () => {
    expect(signalToNoise({ median: 1, p10: -3, p90: 5 })).toBe("weak");
  });
});

describe("analogueFor", () => {
  it("declines to draw an analogy for a change below detection", () => {
    expect(analogueFor(0.2)).toBeNull();
    expect(analogueFor(null)).toBeNull();
  });

  it("expresses warming as a southward shift", () => {
    const result = analogueFor(2.1)!;
    expect(result.text).toContain("km south");
    expect(result.text).toContain("holding elevation constant");
  });
});

describe("mechanisms", () => {
  it("routes a heat indicator to the heat-stress chain", () => {
    expect(mechanismsFor("hd35").map((m) => m.id)).toContain("heat-stress");
  });

  it("routes extreme rainfall to flood hazard, not flood risk", () => {
    const chain = mechanismsFor("rx5day").find((m) => m.id === "extreme-rainfall")!;
    expect(chain.title).toContain("hazard");
    expect(chain.requires).toMatch(/hydrological/i);
  });

  it("states what every chain would need to be quantified", () => {
    // The platform must never imply it has modelled an impact it has not.
    for (const chain of MECHANISMS) {
      expect(chain.requires.length).toBeGreaterThan(20);
      expect(chain.steps.length).toBeGreaterThanOrEqual(3);
    }
  });
});
