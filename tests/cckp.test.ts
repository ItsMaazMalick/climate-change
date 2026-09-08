import { describe, expect, it } from "vitest";

import { buildCckpPath, splitModel } from "@/lib/climate/cckp";

describe("CCKP URL construction", () => {
  it("builds the eleven-slot path for an ensemble climatology", () => {
    // Verified against the live API: this exact path returns 22.22 °C for PAK.
    expect(
      buildCckpPath({
        geography: "PAK",
        variable: "tas",
        product: "climatology",
        aggregation: "annual",
        period: "2040-2059",
        percentile: "median",
        scenario: "ssp245",
        model: "ensemble-all",
      }),
    ).toBe(
      "cmip6-x0.25_climatology_tas_climatology_annual_2040-2059_median_ssp245_ensemble_all_mean",
    );
  });

  it("uses the timeseries product type only for the timeseries product", () => {
    const anomaly = buildCckpPath({
      geography: "PAK",
      variable: "pr",
      product: "anomaly",
      aggregation: "annual",
      period: "2080-2099",
      percentile: "median",
      scenario: "ssp585",
      model: "ensemble-all",
    });
    expect(anomaly.split("_")[1]).toBe("climatology");

    const series = buildCckpPath({
      geography: "PAK",
      variable: "pr",
      product: "timeseries",
      aggregation: "annual",
      period: "2015-2100",
      percentile: "median",
      scenario: "ssp585",
      model: "ensemble-all",
    });
    expect(series.split("_")[1]).toBe("timeseries");
  });

  it("splits an individual model into its model and variant slots", () => {
    // The archive's directory name is one token; the API wants two.
    expect(splitModel("access-cm2-r1i1p1f1")).toEqual(["access-cm2", "r1i1p1f1"]);
    expect(splitModel("cnrm-esm2-1-r1i1p1f2")).toEqual(["cnrm-esm2-1", "r1i1p1f2"]);
    expect(splitModel("ensemble-all")).toEqual(["ensemble", "all"]);
  });

  it("produces exactly eleven underscore-separated slots", () => {
    const path = buildCckpPath({
      geography: "PAK",
      variable: "hd35",
      product: "anomaly",
      aggregation: "annual",
      period: "2060-2079",
      percentile: "mean",
      scenario: "ssp370",
      model: "miroc6-r1i1p1f1",
    });
    expect(path.split("_")).toHaveLength(11);
  });
});
