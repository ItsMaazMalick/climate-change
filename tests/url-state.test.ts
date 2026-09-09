import { describe, expect, it } from "vitest";

import { mergeSearchParams } from "@/lib/hooks";

/**
 * Regression guard for the defect that stopped the guided tour from ever
 * starting: `useUrlState` rebuilt the query string from only its own keys and
 * called `history.replaceState`, so `?tour=1` (and `?present=1`, and
 * `?country=`) were wiped the instant the Explorer hydrated.
 */
describe("mergeSearchParams", () => {
  const explorerState = {
    indicator: "tas",
    scenario: "ssp245",
    period: "2040-2059",
    level: "2",
  };

  it("preserves parameters owned by other components", () => {
    const out = new URLSearchParams(
      mergeSearchParams("?tour=1&country=uz&present=1", explorerState),
    );
    expect(out.get("tour")).toBe("1");
    expect(out.get("country")).toBe("uz");
    expect(out.get("present")).toBe("1");
  });

  it("writes its own keys", () => {
    const out = new URLSearchParams(mergeSearchParams("?tour=1", explorerState));
    expect(out.get("indicator")).toBe("tas");
    expect(out.get("level")).toBe("2");
  });

  it("overwrites a stale value for a key it owns", () => {
    const out = new URLSearchParams(
      mergeSearchParams("?scenario=ssp119&tour=1", explorerState),
    );
    expect(out.get("scenario")).toBe("ssp245");
    expect(out.get("tour")).toBe("1");
  });

  it("drops its own empty keys without touching foreign ones", () => {
    const out = new URLSearchParams(
      mergeSearchParams("?lat=41.3&tour=1", { ...explorerState, lat: "" }),
    );
    expect(out.has("lat")).toBe(false);
    expect(out.get("tour")).toBe("1");
  });

  it("works from an empty query string", () => {
    const out = new URLSearchParams(mergeSearchParams("", explorerState));
    expect(out.get("indicator")).toBe("tas");
    expect(out.has("tour")).toBe(false);
  });
});
