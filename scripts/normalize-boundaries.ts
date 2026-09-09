/**
 * Clip boundary GeoJSON to each country's configured extent.
 *
 * Two of the four countries ship geometry that breaks a web map:
 *
 *   - **New Zealand** crosses the antimeridian. The Chatham Islands sit near
 *     183 °E, which GeoJSON stores as −176.9. On a Leaflet map framed to
 *     166–178.5 °E those parts render on the far side of the world and drag
 *     polygons across the entire canvas.
 *   - **Australia** carries its remote external territories — Cocos (96.8 °E),
 *     Christmas Island, Norfolk Island (168 °E). They stretch the fitted
 *     bounds so the mainland renders small and off-centre, and
 *     `australia-states.geojson` has a whole `other-territories` feature
 *     spanning 71° of longitude.
 *
 * Neither has CMIP6 coverage in this platform — the climate grid is defined by
 * the same bounding box we clip to — so dropping those parts loses no data and
 * fixes the render. Pakistan and Uzbekistan are already inside their extents
 * and pass through untouched.
 *
 *   pnpm geo:normalize
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { COUNTRIES, type CountryCode } from "../src/lib/climate/countries";

type Ring = number[][];
type PolygonCoords = Ring[];
type MultiPolygonCoords = PolygonCoords[];

interface Feature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry:
    | { type: "Polygon"; coordinates: PolygonCoords }
    | { type: "MultiPolygon"; coordinates: MultiPolygonCoords }
    | null;
}

interface Collection {
  type: "FeatureCollection";
  features: Feature[];
}

interface BBox {
  lonMin: number;
  latMin: number;
  lonMax: number;
  latMax: number;
}

function ringBounds(ring: Ring) {
  let lonMin = Infinity, lonMax = -Infinity, latMin = Infinity, latMax = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon! < lonMin) lonMin = lon!;
    if (lon! > lonMax) lonMax = lon!;
    if (lat! < latMin) latMin = lat!;
    if (lat! > latMax) latMax = lat!;
  }
  return { lonMin, lonMax, latMin, latMax };
}

/** A polygon is kept when its outer ring overlaps the country extent. */
function polygonIntersects(poly: PolygonCoords, box: BBox, pad: number): boolean {
  const outer = poly[0];
  if (!outer || outer.length === 0) return false;
  const b = ringBounds(outer);
  return (
    b.lonMax >= box.lonMin - pad &&
    b.lonMin <= box.lonMax + pad &&
    b.latMax >= box.latMin - pad &&
    b.latMin <= box.latMax + pad
  );
}

function clipFeature(feature: Feature, box: BBox, pad: number): Feature | null {
  const g = feature.geometry;
  if (!g) return null;

  if (g.type === "Polygon") {
    return polygonIntersects(g.coordinates, box, pad) ? feature : null;
  }

  const kept = g.coordinates.filter((poly) => polygonIntersects(poly, box, pad));
  if (kept.length === 0) return null;
  return {
    ...feature,
    geometry:
      kept.length === 1
        ? { type: "Polygon", coordinates: kept[0]! }
        : { type: "MultiPolygon", coordinates: kept },
  };
}

/** Recompute the cached bbox/centroid properties the map reads. */
function refreshProps(feature: Feature) {
  const g = feature.geometry;
  if (!g) return;
  const polys: PolygonCoords[] =
    g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  let lonMin = Infinity, lonMax = -Infinity, latMin = Infinity, latMax = -Infinity;
  for (const poly of polys) {
    const b = ringBounds(poly[0]!);
    lonMin = Math.min(lonMin, b.lonMin);
    lonMax = Math.max(lonMax, b.lonMax);
    latMin = Math.min(latMin, b.latMin);
    latMax = Math.max(latMax, b.latMax);
  }
  const round = (n: number) => Number(n.toFixed(4));
  if ("bbox" in feature.properties) {
    feature.properties.bbox = [round(lonMin), round(latMin), round(lonMax), round(latMax)];
  }
  if ("centroid" in feature.properties) {
    feature.properties.centroid = [round((lonMin + lonMax) / 2), round((latMin + latMax) / 2)];
  }
}

const GEO_DIR = path.join(process.cwd(), "public", "geo");

async function processFile(rel: string, box: BBox, pad: number) {
  const file = path.join(GEO_DIR, rel.replace(/^\/geo\//, ""));
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    console.log(`  · ${rel} — not present, skipped`);
    return;
  }
  const doc = JSON.parse(raw) as Collection;
  const before = doc.features.length;

  const out: Feature[] = [];
  let trimmed = 0;
  for (const feature of doc.features) {
    const g = feature.geometry;
    const partsBefore =
      !g ? 0 : g.type === "Polygon" ? 1 : g.coordinates.length;
    const clipped = clipFeature(feature, box, pad);
    if (!clipped) continue;
    const g2 = clipped.geometry!;
    const partsAfter = g2.type === "Polygon" ? 1 : g2.coordinates.length;
    if (partsAfter !== partsBefore) trimmed += partsBefore - partsAfter;
    refreshProps(clipped);
    out.push(clipped);
  }

  doc.features = out;
  await writeFile(file, JSON.stringify(doc));

  const dropped = before - out.length;
  console.log(
    `  · ${rel}: ${before} → ${out.length} features` +
      (dropped ? `, ${dropped} dropped` : "") +
      (trimmed ? `, ${trimmed} outlying parts trimmed` : "") +
      (!dropped && !trimmed ? " (unchanged)" : ""),
  );
}

async function main() {
  for (const code of Object.keys(COUNTRIES) as CountryCode[]) {
    const c = COUNTRIES[code];
    console.log(`${c.name} — clip to ${c.bbox.lonMin}..${c.bbox.lonMax} °E, ${c.bbox.latMin}..${c.bbox.latMax} °N`);
    // A degree of slack so a coastal polygon straddling the edge survives.
    const pad = 1;
    for (const rel of [c.geoFiles.country, c.geoFiles.level1, c.geoFiles.level2]) {
      await processFile(rel, c.bbox, pad);
    }
  }
  console.log("\nDone. Re-run after regenerating boundaries with `pnpm geo:build`.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
