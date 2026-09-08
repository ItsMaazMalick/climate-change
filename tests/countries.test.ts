import { describe, expect, it } from "vitest";

import {
  COUNTRIES,
  COUNTRY_CODES,
  detectCountryFromCoords,
  getCountry,
  isInsideCountryBounds,
} from "@/lib/climate/countries";

describe("country configurations", () => {
  it("defines both Pakistan and Uzbekistan", () => {
    expect(COUNTRY_CODES).toContain("PAK");
    expect(COUNTRY_CODES).toContain("UZB");
    expect(COUNTRIES.PAK).toBeDefined();
    expect(COUNTRIES.UZB).toBeDefined();
  });

  it("retrieves country configs by code case-insensitively", () => {
    expect(getCountry("pak").code).toBe("PAK");
    expect(getCountry("UZB").code).toBe("UZB");
    expect(getCountry("uzb").name).toBe("Uzbekistan");
  });

  it("correctly detects country from coordinates", () => {
    // Islamabad (33.68, 73.05) -> PAK
    expect(detectCountryFromCoords(33.68, 73.05)).toBe("PAK");
    // Tashkent (41.30, 69.24) -> UZB
    expect(detectCountryFromCoords(41.30, 69.24)).toBe("UZB");
    // Samarkand (39.65, 66.96) -> UZB
    expect(detectCountryFromCoords(39.65, 66.96)).toBe("UZB");
    // Karachi (24.86, 67.00) -> PAK
    expect(detectCountryFromCoords(24.86, 67.00)).toBe("PAK");
  });

  it("verifies bounding boxes correctly", () => {
    expect(isInsideCountryBounds(31.52, 74.35, "PAK")).toBe(true); // Lahore
    expect(isInsideCountryBounds(41.30, 69.24, "PAK")).toBe(false); // Tashkent is not in PAK
    expect(isInsideCountryBounds(41.30, 69.24, "UZB")).toBe(true); // Tashkent is in UZB
  });
});
