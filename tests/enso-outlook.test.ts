import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildOutlookSeasons,
  parseCpcTable,
  parseHistoricChances,
  seasonLabels,
} from "@/lib/iofs/enso-outlook";

const fx = (name: string) => readFileSync(resolve(__dirname, "fixtures", name), "utf8");
// Real NOAA CPC pages saved on 2026-10-09 (bulletin issued 8 October 2026)
const probs = parseCpcTable(fx("cpc-probabilities.html"), "probabilities-table");
const strengths = parseCpcTable(fx("cpc-strengths.html"), "probabilities-table");
const roni = parseCpcTable(fx("cpc-outlook.html"), "outlook-table");
const bulletin = fx("ensodisc-2026-10-08.txt");

describe("NOAA CPC ENSO outlook (October 2026 issue)", () => {
  it("reads nine seasons from each table", () => {
    expect([probs.length, strengths.length, roni.length]).toEqual([9, 9, 9]);
  });

  it("labels seasons by the year of their middle month, rolling over at the new year", () => {
    expect(
      seasonLabels(
        probs.map((r) => r.abbr),
        "2026-10-08",
      ),
    ).toEqual(["SON 2026", "OND 2026", "NDJ 2026", "DJF 2027", "JFM 2027", "FMA 2027", "MAM 2027", "AMJ 2027", "MJJ 2027"]);
  });

  const seasons = buildOutlookSeasons(probs, strengths, roni, "2026-10-08");

  it("Oct–Dec 2026 matches NOAA: El Niño 100 %, very strong 100 %, median RONI +2.74 °C (2.25 to 3.23)", () => {
    expect(seasons.find((s) => s.season === "OND 2026")).toEqual({
      season: "OND 2026",
      elNino: 100,
      neutral: 0,
      laNina: 0,
      veryStrong: 100,
      roniMedian: 2.74,
      roniP5: 2.25,
      roniP95: 3.23,
    });
  });

  it("keeps NOAA's uncertainty for later seasons instead of rounding it away", () => {
    expect(seasons.find((s) => s.season === "JFM 2027")).toMatchObject({ elNino: 100, veryStrong: 46, roniMedian: 1.9 });
    expect(seasons.find((s) => s.season === "MJJ 2027")).toMatchObject({ elNino: 17, neutral: 70, laNina: 13 });
  });

  it("the historic-event chance (3-month RONI ≥ +2.5 °C) comes from the bulletin sentence: 54 / 83 / 70 %", () => {
    expect(parseHistoricChances(bulletin, "2026-10-08")).toEqual([
      { season: "SON 2026", pct: 54 },
      { season: "OND 2026", pct: 83 },
      { season: "NDJ 2026", pct: 70 },
    ]);
  });

  it("returns nothing — not a guess — when the markup or the sentence is missing", () => {
    expect(parseCpcTable("<html></html>", "outlook-table")).toEqual([]);
    expect(buildOutlookSeasons([], [], [], "2026-10-08")).toEqual([]);
    expect(parseHistoricChances("no probabilities here", "2026-10-08")).toBeNull();
  });
});
