import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { COUNTRIES, type CountryCode } from "@/lib/climate/countries";

/**
 * Boundary geometry must stay inside the country's configured extent.
 *
 * Two real defects motivated this: New Zealand's Chatham Islands sit near
 * 183 °E, stored as −176.9, which smeared polygons across the whole map; and
 * Australia shipped Cocos (96.8 °E) and Norfolk (168 °E), which stretched the
 * fitted bounds so the mainland rendered small and off-centre. Pakistan and
 * Uzbekistan were unaffected, which is exactly why only two of the four maps
 * looked wrong.
 *
 * `pnpm geo:normalize` clips the files; this keeps them clipped.
 */

type Ring = number[][];
interface Geometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: Ring[] | Ring[][];
}
interface Feature {
  properties: Record<string, unknown>;
  geometry: Geometry | null;
}

function load(rel: string): Feature[] {
  const file = path.join(process.cwd(), "public", "geo", rel.replace(/^\/geo\//, ""));
  return (JSON.parse(readFileSync(file, "utf8")) as { features: Feature[] }).features;
}

function* points(g: Geometry): Generator<number[]> {
  if (g.type === "Polygon") {
    for (const ring of g.coordinates as Ring[]) yield* ring;
  } else {
    for (const poly of g.coordinates as Ring[][]) for (const ring of poly) yield* ring;
  }
}

// A degree of slack: `geo:normalize` keeps coastal polygons that straddle the edge.
const PAD = 1.5;

describe("boundary geometry stays inside each country's extent", () => {
  for (const code of Object.keys(COUNTRIES) as CountryCode[]) {
    const c = COUNTRIES[code];
    const files = [c.geoFiles.country, c.geoFiles.level1, c.geoFiles.level2];

    for (const rel of files) {
      it(`${c.name} · ${rel.split("/").pop()} is within the configured bbox`, () => {
        const features = load(rel);
        expect(features.length).toBeGreaterThan(0);

        let lonMin = Infinity, lonMax = -Infinity, latMin = Infinity, latMax = -Infinity;
        for (const f of features) {
          if (!f.geometry) continue;
          for (const [lon, lat] of points(f.geometry)) {
            lonMin = Math.min(lonMin, lon!);
            lonMax = Math.max(lonMax, lon!);
            latMin = Math.min(latMin, lat!);
            latMax = Math.max(latMax, lat!);
          }
        }

        expect(lonMin).toBeGreaterThanOrEqual(c.bbox.lonMin - PAD);
        expect(lonMax).toBeLessThanOrEqual(c.bbox.lonMax + PAD);
        expect(latMin).toBeGreaterThanOrEqual(c.bbox.latMin - PAD);
        expect(latMax).toBeLessThanOrEqual(c.bbox.latMax + PAD);
      });

      it(`${c.name} · ${rel.split("/").pop()} has no antimeridian-spanning feature`, () => {
        for (const f of load(rel)) {
          if (!f.geometry) continue;
          let lo = Infinity;
          let hi = -Infinity;
          for (const [lon] of points(f.geometry)) {
            lo = Math.min(lo, lon!);
            hi = Math.max(hi, lon!);
          }
          // No single admin unit legitimately spans more than 60° of longitude
          // here; a larger span means geometry wrapped across ±180.
          expect(hi - lo).toBeLessThan(60);
        }
      });
    }
  }
});
