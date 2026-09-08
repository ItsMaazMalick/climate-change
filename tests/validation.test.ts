import { describe, expect, it } from "vitest";

import {
  fieldQuerySchema,
  parseSearchParams,
  pointQuerySchema,
  spreadQuerySchema,
} from "@/lib/validation";

const params = (query: string) => new URLSearchParams(query);

describe("query validation", () => {
  it("applies documented defaults for an empty query", () => {
    const parsed = parseSearchParams(fieldQuerySchema, params(""));
    expect(parsed).toMatchObject({
      indicator: "tas",
      scenario: "ssp245",
      period: "2040-2059",
      model: "ensemble-all",
      product: "anomaly",
      aggregation: "annual",
    });
  });

  it("coerces numeric coordinates from strings", () => {
    const parsed = parseSearchParams(pointQuerySchema, params("lat=33.68&lon=73.05"));
    expect(parsed.lat).toBeCloseTo(33.68);
    expect(parsed.lon).toBeCloseTo(73.05);
  });

  it("rejects an unknown scenario rather than silently defaulting", () => {
    expect(() =>
      parseSearchParams(fieldQuerySchema, params("scenario=rcp85")),
    ).toThrow();
  });

  it("rejects an unknown indicator", () => {
    expect(() =>
      parseSearchParams(fieldQuerySchema, params("indicator=nonsense")),
    ).toThrow();
  });

  it("rejects out-of-range coordinates", () => {
    expect(() =>
      parseSearchParams(pointQuerySchema, params("lat=200&lon=73")),
    ).toThrow();
  });

  it("reads the string \"false\" as false", () => {
    // Boolean coercion would make "false" truthy — the single most likely
    // value a client sends when it means the opposite.
    expect(parseSearchParams(spreadQuerySchema, params("models=false")).models).toBe(false);
    expect(parseSearchParams(spreadQuerySchema, params("models=true")).models).toBe(true);
    expect(parseSearchParams(spreadQuerySchema, params("")).models).toBe(false);
  });
});

describe("semantic guards", () => {
  it("does not accept a product on point or area queries", () => {
    // Both handlers return baseline, projection and change together, so an
    // accepted-then-ignored `product` would be a silent lie.
    const parsed = parseSearchParams(pointQuerySchema, params("lat=33&lon=73&product=anomaly"));
    expect("product" in parsed).toBe(false);
  });
});
