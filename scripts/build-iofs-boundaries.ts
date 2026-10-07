/**
 * Build `data/iofs/boundaries.json` — real country-outline polygons for
 * every IOFS member, so the overview map can paint an actual choropleth
 * instead of a dot at each centroid.
 *
 * Source: Natural Earth 1:50m Admin-0 Countries (public domain,
 * naturalearthdata.com), mirrored by the project maintainers on GitHub. Each
 * feature is simplified (Douglas–Peucker via @turf/simplify) since a 50 m
 * coastline is far more detail than a world-view choropleth needs — this
 * takes the filtered file from ~1.8 MB to well under 150 KB.
 *
 *   pnpm iofs:geo
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import simplify from "@turf/simplify";

import { IOFS_MEMBERS } from "../src/lib/iofs/members";

const SOURCE_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";

interface NeFeature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: GeoJSON.Geometry | null;
}

interface NeCollection {
  type: "FeatureCollection";
  features: NeFeature[];
}

async function main() {
  console.log(`Fetching ${SOURCE_URL} …`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching Natural Earth boundaries`);
  const source = (await res.json()) as NeCollection;
  console.log(`  ${source.features.length} world features`);

  const iso3Set = new Map(IOFS_MEMBERS.map((m) => [m.iso3, m]));
  const matched: GeoJSON.Feature[] = [];
  const missing = new Set(iso3Set.keys());

  for (const feature of source.features) {
    const iso3 = String(feature.properties.ISO_A3 ?? "");
    const member = iso3Set.get(iso3);
    if (!member || !feature.geometry) continue;
    missing.delete(iso3);

    const simplified = simplify(
      { type: "Feature", properties: {}, geometry: feature.geometry } as GeoJSON.Feature,
      { tolerance: 0.03, highQuality: false },
    );

    matched.push({
      type: "Feature",
      properties: { iso3: member.iso3, name: member.name },
      geometry: simplified.geometry,
    });
  }

  if (missing.size > 0) {
    console.warn(`  Missing boundaries for: ${[...missing].join(", ")}`);
  }

  const collection = { type: "FeatureCollection" as const, features: matched };
  const dir = path.join(process.cwd(), "data", "iofs");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, "boundaries.json");
  await writeFile(file, JSON.stringify(collection));

  console.log(`Wrote ${matched.length}/${IOFS_MEMBERS.length} boundaries to ${file}`);
  const sizeKb = Buffer.byteLength(JSON.stringify(collection)) / 1024;
  console.log(`  file size: ${sizeKb.toFixed(0)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
