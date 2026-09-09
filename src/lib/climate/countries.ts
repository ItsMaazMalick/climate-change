/**
 * Multi-country configuration and geographic registry.
 *
 * Defines the spatial lattice, bounding boxes, standard parallels, and
 * administrative hierarchy for each supported country.
 */

export type CountryCode = "PAK" | "UZB" | "AUS" | "NZL";

export interface CountryConfig {
  code: CountryCode;
  name: string;
  shortName: string;
  flag: string;
  bbox: {
    lonMin: number;
    latMin: number;
    lonMax: number;
    latMax: number;
  };
  /**
   * Plate-carrée standard parallel (approximate latitude center)
   * used for equirectangular map projection scaling.
   */
  standardParallelLat: number;
  grid: {
    resolution: number;
    nLon: number;
    nLat: number;
    cellCount: number;
  };
  adminLevels: {
    level0: string;
    level1: string;
    level2: string;
  };
  geoFiles: {
    country: string;
    level1: string;
    level2: string;
    level1Cells: string;
    level2Cells: string;
  };
  defaultCityId: string;
  description: string;
}

export const COUNTRIES: Record<CountryCode, CountryConfig> = {
  PAK: {
    code: "PAK",
    name: "Pakistan",
    shortName: "Pakistan",
    flag: "🇵🇰",
    bbox: {
      lonMin: 60.5,
      latMin: 23.5,
      lonMax: 78.0,
      latMax: 37.25,
    },
    standardParallelLat: 30.4,
    grid: {
      resolution: 0.25,
      nLon: 56,
      nLat: 71,
      cellCount: 3976,
    },
    adminLevels: {
      level0: "Country",
      level1: "Provinces & Territories",
      level2: "Districts",
    },
    geoFiles: {
      country: "/geo/pakistan.geojson",
      level1: "/geo/provinces.geojson",
      level2: "/geo/districts.geojson",
      level1Cells: "provinces-cells.json",
      level2Cells: "districts-cells.json",
    },
    defaultCityId: "islamabad",
    description:
      "Indus Basin, Hindu Kush–Karakoram–Himalaya cryosphere, and Arabian Sea coastline.",
  },
  UZB: {
    code: "UZB",
    name: "Uzbekistan",
    shortName: "Uzbekistan",
    flag: "🇺🇿",
    bbox: {
      lonMin: 55.0,
      latMin: 36.5,
      lonMax: 74.0,
      latMax: 46.2,
    },
    standardParallelLat: 41.3,
    grid: {
      resolution: 0.25,
      nLon: 69,
      nLat: 35,
      cellCount: 2415,
    },
    adminLevels: {
      level0: "Country",
      level1: "Regions (Viloyatlar) & Republic",
      level2: "Districts (Tumanlar)",
    },
    geoFiles: {
      country: "/geo/uzbekistan.geojson",
      level1: "/geo/uzbekistan-regions.geojson",
      level2: "/geo/uzbekistan-districts.geojson",
      level1Cells: "uzb-regions-cells.json",
      level2Cells: "uzb-districts-cells.json",
    },
    defaultCityId: "tashkent",
    description:
      "Central Asian double-landlocked nation: Aral Sea basin, Kyzylkum desert, Fergana Valley, and Tien Shan foothill oases.",
  },
  AUS: {
    code: "AUS",
    name: "Australia",
    shortName: "Australia",
    flag: "🇦🇺",
    bbox: {
      lonMin: 112.0,
      latMin: -44.0,
      lonMax: 154.0,
      latMax: -9.5,
    },
    standardParallelLat: -25.0,
    grid: {
      resolution: 0.25,
      nLon: 168,
      nLat: 139,
      cellCount: 23352,
    },
    adminLevels: {
      level0: "Country",
      level1: "States & Territories",
      level2: "Local Government Areas",
    },
    geoFiles: {
      country: "/geo/australia.geojson",
      level1: "/geo/australia-states.geojson",
      level2: "/geo/australia-lgas.geojson",
      level1Cells: "aus-states-cells.json",
      level2Cells: "aus-lgas-cells.json",
    },
    defaultCityId: "canberra",
    description:
      "World's largest arid zone, Great Barrier Reef, Great Dividing Range, and highly variable ENSO-driven rainfall patterns.",
  },
  NZL: {
    code: "NZL",
    name: "New Zealand",
    shortName: "New Zealand",
    flag: "🇳🇿",
    bbox: {
      lonMin: 166.0,
      latMin: -47.5,
      lonMax: 178.5,
      latMax: -33.5,
    },
    standardParallelLat: -41.0,
    grid: {
      resolution: 0.25,
      nLon: 51,
      nLat: 57,
      cellCount: 2907,
    },
    adminLevels: {
      level0: "Country",
      level1: "Regions",
      level2: "Territorial Authorities",
    },
    geoFiles: {
      country: "/geo/new-zealand.geojson",
      level1: "/geo/new-zealand-regions.geojson",
      level2: "/geo/new-zealand-districts.geojson",
      level1Cells: "nzl-regions-cells.json",
      level2Cells: "nzl-districts-cells.json",
    },
    defaultCityId: "wellington",
    description:
      "Tectonically active archipelago across the Roaring Forties: Southern Alps glaciers, volcanic plateau, and maritime westerly climate.",
  },
};

export const COUNTRY_CODES: CountryCode[] = ["UZB", "PAK", "AUS", "NZL"];

export const DEFAULT_COUNTRY: CountryCode = "UZB";

export function getCountry(code: string | null | undefined): CountryConfig {
  if (!code) return COUNTRIES[DEFAULT_COUNTRY];
  const upper = code.toUpperCase() as CountryCode;
  return COUNTRIES[upper] ?? COUNTRIES[DEFAULT_COUNTRY];
}

export function isInsideCountryBounds(
  lat: number,
  lon: number,
  countryCode: CountryCode = DEFAULT_COUNTRY,
): boolean {
  const c = COUNTRIES[countryCode];
  return (
    lat >= c.bbox.latMin &&
    lat <= c.bbox.latMax &&
    lon >= c.bbox.lonMin &&
    lon <= c.bbox.lonMax
  );
}

export function detectCountryFromCoords(lat: number, lon: number): CountryCode {
  if (isInsideCountryBounds(lat, lon, "AUS")) return "AUS";
  if (isInsideCountryBounds(lat, lon, "NZL")) return "NZL";
  if (isInsideCountryBounds(lat, lon, "UZB")) return "UZB";
  if (isInsideCountryBounds(lat, lon, "PAK")) return "PAK";
  return DEFAULT_COUNTRY;
}
