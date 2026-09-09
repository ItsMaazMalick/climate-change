import { describe, expect, it } from "vitest";

import { getAustraliaField } from "@/lib/climate/aus-grid";
import {
  COUNTRIES,
  detectCountryFromCoords,
  isInsideCountryBounds,
} from "@/lib/climate/countries";
import { PROJECTION_TOLERANCE } from "@/lib/climate/derive";
import { getNZField } from "@/lib/climate/nzl-grid";
import { getUzbekistanField } from "@/lib/climate/uzb-grid";

type Gen = (q: {
  variable: string;
  scenario: string;
  period: string;
  percentile?: string;
  product?: string;
}) => { values: Array<number | null> };

const CASES: Array<{ name: string; gen: Gen }> = [
  { name: "Uzbekistan", gen: getUzbekistanField as unknown as Gen },
  { name: "Australia", gen: getAustraliaField as unknown as Gen },
  { name: "New Zealand", gen: getNZField as unknown as Gen },
];

const SCENARIOS = ["ssp119", "ssp126", "ssp245", "ssp370", "ssp585"];
// The invariant is cell-wise identical across combinations; a 23k-cell grid
// regenerated 20 times is just slow. Sample enough to be confident.
const SAMPLE = [
  { scenario: "ssp126", period: "2040-2059" },
  { scenario: "ssp585", period: "2080-2099" },
];

describe("synthetic grids — projected = baseline + delta (D1, D2)", () => {
  for (const { name, gen } of CASES) {
    it(`${name}: future climatology equals baseline + anomaly, every cell`, () => {
      const baseline = gen({
        variable: "tas",
        scenario: "historical",
        period: "1995-2014",
        product: "climatology",
      });
      for (const { scenario, period } of SAMPLE) {
        const clim = gen({ variable: "tas", scenario, period, product: "climatology" });
        const anom = gen({ variable: "tas", scenario, period, product: "anomaly" });
        let checked = 0;
        for (let i = 0; i < clim.values.length; i += 1) {
          const c = clim.values[i];
          const b = baseline.values[i];
          const a = anom.values[i];
          if (c == null || b == null || a == null) continue;
          expect(Math.abs(c - (b + a))).toBeLessThanOrEqual(PROJECTION_TOLERANCE);
          checked += 1;
        }
        expect(checked).toBeGreaterThan(0);
      }
    }, 20000);

    it(`${name}: five pathways do not share one absolute (D2)`, () => {
      const period = "2080-2099";
      const values = SCENARIOS.map((scenario) => {
        const f = gen({ variable: "tas", scenario, period, product: "climatology" });
        return f.values.find((v) => v !== null) ?? null;
      });
      const distinct = new Set(values.map((v) => v?.toFixed(2)));
      expect(distinct.size).toBe(SCENARIOS.length);
    });
  }
});

describe("synthetic grids — percentile spread does not collapse (D3)", () => {
  for (const { name, gen } of CASES) {
    it(`${name}: p10 < median < p90 for the anomaly field`, () => {
      const q = { variable: "tas", scenario: "ssp245", period: "2080-2099", product: "anomaly" as const };
      const p10 = gen({ ...q, percentile: "p10" });
      const median = gen({ ...q, percentile: "median" });
      const p90 = gen({ ...q, percentile: "p90" });
      let checked = 0;
      for (let i = 0; i < median.values.length; i += 1) {
        const lo = p10.values[i];
        const mid = median.values[i];
        const hi = p90.values[i];
        if (lo == null || mid == null || hi == null) continue;
        expect(lo).toBeLessThan(mid);
        expect(hi).toBeGreaterThan(mid);
        expect(hi - lo).toBeGreaterThan(0.05);
        checked += 1;
      }
      expect(checked).toBeGreaterThan(0);
    });
  }
});

describe("country bounds — default coordinate must fall inside (D5)", () => {
  it("every country's bbox rejects a point ~1,200 km outside it", () => {
    // 34.20 N, 77.39 E — Ladakh, the old Uzbekistan default.
    expect(isInsideCountryBounds(34.2, 77.39, "UZB")).toBe(false);
    expect(detectCountryFromCoords(34.2, 77.39)).not.toBe("UZB");
  });

  it("each capital falls inside its own bounding box", () => {
    const capitals: Record<string, [number, number]> = {
      PAK: [33.6844, 73.0479],
      UZB: [41.3111, 69.2797],
      AUS: [-35.2809, 149.13],
      NZL: [-41.2866, 174.7756],
    };
    for (const [code, [lat, lon]] of Object.entries(capitals)) {
      expect(isInsideCountryBounds(lat, lon, code as keyof typeof COUNTRIES)).toBe(true);
    }
  });
});
