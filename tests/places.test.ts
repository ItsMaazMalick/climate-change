import { describe, expect, it } from "vitest";

import {
  PLACES,
  getPlacesForCountry,
  haversineKm,
  isInsidePakistanBounds,
  isInsideUzbekistanBounds,
  nearestPlace,
  searchPlaces,
} from "@/lib/climate/places";

describe("place catalogue", () => {
  it("has unique ids", () => {
    expect(new Set(PLACES.map((p) => p.id)).size).toBe(PLACES.length);
  });

  it("places Pakistan entries inside the Pakistan grid extent", () => {
    const pakPlaces = getPlacesForCountry("PAK");
    expect(pakPlaces.length).toBeGreaterThanOrEqual(20);
    for (const place of pakPlaces) {
      expect(isInsidePakistanBounds(place.lat, place.lon)).toBe(true);
    }
  });

  it("places Uzbekistan entries inside the Uzbekistan grid extent", () => {
    const uzbPlaces = getPlacesForCountry("UZB");
    expect(uzbPlaces.length).toBeGreaterThanOrEqual(10);
    for (const place of uzbPlaces) {
      expect(isInsideUzbekistanBounds(place.lat, place.lon)).toBe(true);
    }
  });
});

describe("haversineKm", () => {
  it("matches the known Karachi–Lahore great-circle distance", () => {
    const distance = haversineKm(
      { lat: 24.8607, lon: 67.0011 },
      { lat: 31.5204, lon: 74.3587 },
    );
    expect(distance).toBeGreaterThan(1000);
    expect(distance).toBeLessThan(1060);
  });

  it("matches the known Tashkent–Samarkand great-circle distance", () => {
    const distance = haversineKm(
      { lat: 41.2995, lon: 69.2401 },
      { lat: 39.6542, lon: 66.9597 },
    );
    expect(distance).toBeGreaterThan(260);
    expect(distance).toBeLessThan(310);
  });

  it("is zero for a point against itself", () => {
    expect(haversineKm({ lat: 30, lon: 70 }, { lat: 30, lon: 70 })).toBe(0);
  });
});

describe("nearestPlace", () => {
  it("resolves a coordinate to Islamabad", () => {
    const hit = nearestPlace({ lat: 33.6844, lon: 73.0479 }, 150, "PAK")!;
    expect(hit.place.id).toBe("islamabad");
    expect(hit.distanceKm).toBeLessThan(1);
  });

  it("resolves a coordinate to Tashkent in Uzbekistan", () => {
    const hit = nearestPlace({ lat: 41.2995, lon: 69.2401 }, 150, "UZB")!;
    expect(hit.place.id).toBe("tashkent");
    expect(hit.distanceKm).toBeLessThan(1);
  });

  it("returns nothing rather than a distant city when far from anywhere", () => {
    expect(nearestPlace({ lat: 27.5, lon: 63.5 }, 50, "PAK")).toBeNull();
  });
});

describe("searchPlaces", () => {
  it("prefers prefix matches over substring matches", () => {
    const results = searchPlaces("lah", 8, "PAK");
    expect(results[0]!.id).toBe("lahore");
  });

  it("matches Uzbekistan cities when searching", () => {
    const results = searchPlaces("samar", 8, "UZB");
    expect(results[0]!.id).toBe("samarkand");
  });

  it("matches on province/region as well as name", () => {
    const results = searchPlaces("karakalpakstan", 8, "UZB");
    expect(results[0]!.name).toBe("Nukus");
  });

  it("returns the largest cities for an empty query per country", () => {
    const pakResults = searchPlaces("", 3, "PAK");
    expect(pakResults[0]!.id).toBe("karachi");
    expect(pakResults).toHaveLength(3);

    const uzbResults = searchPlaces("", 3, "UZB");
    expect(uzbResults[0]!.id).toBe("tashkent");
    expect(uzbResults).toHaveLength(3);
  });
});
