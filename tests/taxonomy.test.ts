import { describe, expect, it } from "vitest";

import {
  ENSEMBLE_ID,
  FUTURE_PERIOD_IDS,
  GRIDDED_INDICATOR_IDS,
  INDICATORS,
  MODELS,
  PERIODS,
  SCENARIOS,
  SSP_IDS,
  formatValue,
  unitFor,
} from "@/lib/climate/taxonomy";

describe("scenario taxonomy", () => {
  it("orders SSPs by radiative forcing", () => {
    const forcings = SSP_IDS.map((id) => SCENARIOS[id].forcing!);
    expect(forcings).toEqual([...forcings].sort((a, b) => a - b));
  });

  it("ranks scenarios consistently with their forcing", () => {
    const ranks = SSP_IDS.map((id) => SCENARIOS[id].rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("gives the historical run no forcing target", () => {
    // The historical run is driven by observed forcing; assigning it a 2100
    // target would make it look like a pathway, which is the exact confusion
    // the interface exists to prevent.
    expect(SCENARIOS.historical.forcing).toBeNull();
    expect(SCENARIOS.historical.globalWarming2100).toBeNull();
  });

  it("gives every SSP a distinct colour", () => {
    const colors = SSP_IDS.map((id) => SCENARIOS[id].color);
    expect(new Set(colors).size).toBe(colors.length);
  });
});

describe("period taxonomy", () => {
  it("has exactly one baseline", () => {
    const baselines = Object.values(PERIODS).filter((p) => p.isBaseline);
    expect(baselines).toHaveLength(1);
    expect(baselines[0]!.id).toBe("1995-2014");
  });

  it("uses non-overlapping twenty-year windows for the future", () => {
    const windows = FUTURE_PERIOD_IDS.map((id) => PERIODS[id]);
    for (const period of windows) {
      expect(period.endYear - period.startYear).toBe(19);
    }
    for (let i = 1; i < windows.length; i += 1) {
      expect(windows[i]!.startYear).toBeGreaterThan(windows[i - 1]!.endYear);
    }
  });
});

describe("model taxonomy", () => {
  it("has exactly one ensemble entry", () => {
    const ensembles = Object.values(MODELS).filter((m) => m.isEnsemble);
    expect(ensembles).toHaveLength(1);
    expect(ensembles[0]!.id).toBe(ENSEMBLE_ID);
  });

  it("keeps every published ECS inside the AR6 assessed range", () => {
    for (const model of Object.values(MODELS)) {
      if (model.ecs === null) continue;
      expect(model.ecs).toBeGreaterThan(1.0);
      expect(model.ecs).toBeLessThan(7.0);
    }
  });
});

describe("indicators", () => {
  it("only marks indicators as gridded when they are in the gridded list", () => {
    for (const id of GRIDDED_INDICATOR_IDS) {
      expect(INDICATORS[id]!.gridded).toBe(true);
    }
  });

  it("reports precipitation anomalies in millimetres, matching the archive", () => {
    // Regression: this was declared as a percentage, which mislabelled every
    // rainfall change by two orders of magnitude. CCKP publishes
    // `anomaly-pr` in mm; the percent form is a separate variable.
    expect(unitFor("pr", "climatology")).toBe("mm");
    expect(unitFor("pr", "anomaly")).toBe("mm");
  });

  it("matches the units the source NetCDF files actually declare", () => {
    // Each of these was verified against the `units` attribute of the
    // extracted field. Three of them were wrong on first pass, so they are
    // pinned here rather than left to inspection.
    expect(unitFor("sd", "climatology")).toBe("days");       // ETCCDI summer days, not snow depth
    expect(unitFor("r95ptot", "climatology")).toBe("%");     // a share of annual rainfall, not a total
    expect(unitFor("cdd65", "climatology")).toBe("°F-days"); // base 65 °F, published in Fahrenheit
    expect(unitFor("cdd", "climatology")).toBe("days");
    expect(unitFor("tas", "climatology")).toBe("°C");
    expect(unitFor("rx5day", "climatology")).toBe("mm");
  });

  it("does not file summer days under the cryosphere", () => {
    // `sd` reads like "snow depth" and is not. Getting this wrong attached a
    // whole Indus-meltwater narrative to a warm-day counter.
    expect(INDICATORS.sd!.family).toBe("heat");
    expect(INDICATORS.sd!.label).toMatch(/summer days/i);
  });

  it("keeps temperature units identical across products", () => {
    expect(unitFor("tas", "climatology")).toBe("°C");
    expect(unitFor("tas", "anomaly")).toBe("°C");
  });
});

describe("formatValue", () => {
  it("signs anomalies and leaves absolutes unsigned", () => {
    expect(formatValue(1.8, "tas", "anomaly")).toBe("+1.8°C");
    expect(formatValue(21.1, "tas", "climatology")).toBe("21.1°C");
  });

  it("uses a true minus sign rather than a hyphen", () => {
    expect(formatValue(-2.4, "tas", "anomaly")).toBe("−2.4°C");
  });

  it("rounds day counts to whole days", () => {
    expect(formatValue(33.22, "hd35", "anomaly")).toBe("+33 days");
  });

  it("renders a missing value as an em dash rather than zero", () => {
    // Rendering null as 0 would assert "no change", which is a different and
    // much stronger claim than "no data".
    expect(formatValue(null, "tas")).toBe("—");
    expect(formatValue(Number.NaN, "tas")).toBe("—");
  });
});

describe("accumulation semantics", () => {
  it("marks fluxes and counts as accumulating", () => {
    for (const id of ["pr", "hd35", "hd40", "rx5day", "cdd", "cdd65", "sd", "tr23"]) {
      expect(INDICATORS[id]!.accumulates).toBe(true);
    }
  });

  it("does not mark temperatures as accumulating", () => {
    // Summing twelve monthly temperatures produces a number with no referent,
    // and "31% of the annual temperature falls in the monsoon" is not a fact.
    for (const id of ["tas", "tasmax", "tasmin", "txx", "tnn"]) {
      expect(INDICATORS[id]!.accumulates).toBe(false);
    }
  });
});
