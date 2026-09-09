/**
 * Build official administrative boundaries for every supported country.
 *
 * The boundaries this replaces were severe simplifications — Australia was a
 * 147-vertex outline, New Zealand 121 — so the climate raster, which is
 * clipped to them, had an edge that visibly disagreed with the coastline drawn
 * by the basemap underneath. This fetches authoritative geometry, simplifies it
 * to a *vertex budget* rather than a fixed tolerance, and recomputes which
 * climate-grid cells fall inside each administrative unit.
 *
 * Sources, all open-licence:
 *
 *   Pakistan     geoBoundaries gbOpen ADM0/ADM1, extended to the official
 *                Pakistani claim (see `buildPakistanClaim` below)
 *   Uzbekistan   geoBoundaries gbOpen (OpenStreetMap / Wambacher)
 *   Australia    geoBoundaries gbOpen (Australian Bureau of Statistics)
 *   New Zealand  geoBoundaries gbOpen (NZ Stats)
 *
 * Usage:  npm run geo:build [-- --country=PAK] [-- --skip-download]
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import difference from "@turf/difference";
import union from "@turf/union";
import { featureCollection } from "@turf/helpers";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";

// ---------------------------------------------------------------------------
// Grid lattices — must match the app exactly
// ---------------------------------------------------------------------------

/**
 * Cell membership is only meaningful against the same lattice the climate
 * values are stored on. These mirror `UZB_GRID` / `AUS_GRID` / `NZL_GRID` in
 * `src/lib/climate/*-grid.ts` and, for Pakistan, the `grid` block written into
 * every extracted field document.
 *
 * The convention throughout is: cell (row, col) has its centre at
 * `lonMin + (col + 0.5) * resolution`, and its index is `row * nLon + col`
 * counting from the south-west corner — identical to `cellAt()` in
 * `src/lib/climate/grid.ts`.
 */
interface GridLattice {
  lonMin: number;
  latMin: number;
  resolution: number;
  nLon: number;
  nLat: number;
}

const GRIDS: Record<string, GridLattice> = {
  PAK: { lonMin: 60.375, latMin: 23.375, resolution: 0.25, nLon: 71, nLat: 56 },
  UZB: { lonMin: 56.0, latMin: 37.0, resolution: 0.25, nLon: 69, nLat: 35 },
  AUS: { lonMin: 112.0, latMin: -44.0, resolution: 0.25, nLon: 168, nLat: 139 },
  NZL: { lonMin: 166.0, latMin: -47.5, resolution: 0.25, nLon: 51, nLat: 57 },
};

// ---------------------------------------------------------------------------
// Output targets — the existing paths, so countries.ts needs no change
// ---------------------------------------------------------------------------

interface CountryTarget {
  iso: string;
  name: string;
  /** Output filenames under public/geo/ */
  country: string;
  level1: string;
  level2: string;
  /** Sidecars of admin-unit → grid cell indices, under data/geo/ */
  level1Cells: string;
  level2Cells: string;
  /** Vertex budget for the national outline after simplification. */
  budgetAdm0: number;
  /** Vertex budget for each first-level unit. */
  budgetAdm1: number;
  /**
   * Vertex budget per second-level unit. These are the polygons the
   * choropleth actually paints, and there are hundreds of them, so the budget
   * is deliberately tight — a district is a few pixels across at country zoom.
   */
  budgetAdm2: number;
}

const TARGETS: CountryTarget[] = [
  {
    iso: "PAK",
    name: "Pakistan",
    country: "pakistan.geojson",
    level1: "provinces.geojson",
    level2: "districts.geojson",
    level1Cells: "provinces-cells.json",
    level2Cells: "districts-cells.json",
    budgetAdm0: 9000,
    budgetAdm1: 1400,
    budgetAdm2: 400,
  },
  {
    iso: "UZB",
    name: "Uzbekistan",
    country: "uzbekistan.geojson",
    level1: "uzbekistan-regions.geojson",
    level2: "uzbekistan-districts.geojson",
    level1Cells: "uzb-regions-cells.json",
    level2Cells: "uzb-districts-cells.json",
    budgetAdm0: 7000,
    budgetAdm1: 1200,
    budgetAdm2: 300,
  },
  {
    iso: "AUS",
    name: "Australia",
    country: "australia.geojson",
    level1: "australia-states.geojson",
    level2: "australia-lgas.geojson",
    level1Cells: "aus-states-cells.json",
    level2Cells: "aus-lgas-cells.json",
    budgetAdm0: 12000,
    budgetAdm1: 2000,
    budgetAdm2: 70,
  },
  {
    iso: "NZL",
    name: "New Zealand",
    country: "new-zealand.geojson",
    level1: "new-zealand-regions.geojson",
    level2: "new-zealand-districts.geojson",
    level1Cells: "nzl-regions-cells.json",
    level2Cells: "nzl-districts-cells.json",
    budgetAdm0: 9000,
    budgetAdm1: 1200,
    budgetAdm2: 150,
  },
];

const ROOT = process.cwd();
const PUBLIC_GEO = path.join(ROOT, "public", "geo");
const DATA_GEO = path.join(ROOT, "data", "geo");
const CACHE = path.join(ROOT, "data", "geo", ".cache");

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

type AnyPolygon = Polygon | MultiPolygon;
type PolyFeature = Feature<AnyPolygon, Record<string, unknown>>;

interface FeatureCollectionLike {
  type: "FeatureCollection";
  features: PolyFeature[];
}

/**
 * Download a geoBoundaries layer, caching the raw response.
 *
 * The archive is large and the tolerance search below is iterative, so a rerun
 * while tuning budgets should not re-download 100 MB of coastline.
 */
async function fetchGeoBoundaries(
  iso: string,
  level: "ADM0" | "ADM1" | "ADM2",
): Promise<FeatureCollectionLike> {
  await mkdir(CACHE, { recursive: true });
  const cached = path.join(CACHE, `${iso}-${level}.geojson`);

  if (existsSync(cached)) {
    return JSON.parse(await readFile(cached, "utf8")) as FeatureCollectionLike;
  }

  const metaUrl = `https://www.geoboundaries.org/api/current/gbOpen/${iso}/${level}/`;
  const meta = (await (await fetch(metaUrl)).json()) as {
    gjDownloadURL: string;
    boundarySource: string;
  };

  process.stdout.write(
    `    ${iso} ${level}  source: ${meta.boundarySource}\n`,
  );

  const response = await fetch(meta.gjDownloadURL);
  if (!response.ok) {
    throw new Error(`${iso} ${level}: HTTP ${response.status}`);
  }
  const body = await response.text();
  await writeFile(cached, body, "utf8");
  return JSON.parse(body) as FeatureCollectionLike;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function polygonsOf(geometry: AnyPolygon): Position[][][] {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

function countVertices(geometry: AnyPolygon): number {
  let total = 0;
  for (const rings of polygonsOf(geometry)) {
    for (const ring of rings) total += ring.length;
  }
  return total;
}

function boundsOf(geometry: AnyPolygon): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const rings of polygonsOf(geometry)) {
    for (const ring of rings) {
      for (const [x, y] of ring) {
        if (x! < minX) minX = x!;
        if (x! > maxX) maxX = x!;
        if (y! < minY) minY = y!;
        if (y! > maxY) maxY = y!;
      }
    }
  }
  return [minX, minY, maxX, maxY];
}

/** Signed shoelace area of a ring; positive is counter-clockwise. */
function ringArea(ring: Position[]): number {
  let total = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[i + 1]!;
    total += x1! * y2! - x2! * y1!;
  }
  return total / 2;
}

/**
 * Area-weighted centroid.
 *
 * Signed weighting means holes subtract and small islands cannot drag the
 * label off the mainland — which matters for Australia and New Zealand, whose
 * outlines carry hundreds of offshore islands.
 */
function centroidOf(geometry: AnyPolygon): [number, number] {
  let cx = 0;
  let cy = 0;
  let area = 0;
  for (const rings of polygonsOf(geometry)) {
    for (const ring of rings) {
      const a = ringArea(ring);
      if (a === 0) continue;
      let rx = 0;
      let ry = 0;
      for (let i = 0; i < ring.length - 1; i += 1) {
        const [x1, y1] = ring[i]!;
        const [x2, y2] = ring[i + 1]!;
        const cross = x1! * y2! - x2! * y1!;
        rx += (x1! + x2!) * cross;
        ry += (y1! + y2!) * cross;
      }
      cx += (rx / (6 * a)) * a;
      cy += (ry / (6 * a)) * a;
      area += a;
    }
  }
  if (area === 0) {
    const [minX, minY, maxX, maxY] = boundsOf(geometry);
    return [(minX + maxX) / 2, (minY + maxY) / 2];
  }
  return [cx / area, cy / area];
}

/** Even-odd ray casting against a single ring. */
function pointInRing(x: number, y: number, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi! > y !== yj! > y) {
      const cross = ((xj! - xi!) * (y - yi!)) / (yj! - yi!) + xi!;
      if (cross > x) inside = !inside;
    }
  }
  return inside;
}

/** Inside the outer ring of any polygon, and outside all of that polygon's holes. */
function pointInGeometry(x: number, y: number, geometry: AnyPolygon): boolean {
  for (const rings of polygonsOf(geometry)) {
    const outer = rings[0];
    if (!outer || !pointInRing(x, y, outer)) continue;
    let inHole = false;
    for (let h = 1; h < rings.length; h += 1) {
      if (pointInRing(x, y, rings[h]!)) {
        inHole = true;
        break;
      }
    }
    if (!inHole) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Simplification to a vertex budget
// ---------------------------------------------------------------------------

/**
 * Simplify until the geometry fits `budget` vertices.
 *
 * A fixed tolerance is what produced the boundaries this script replaces: the
 * same 0.010° that is reasonable for Pakistan reduced Australia's coastline to
 * a triangle. Searching for the tolerance that hits a vertex budget adapts to
 * however convoluted a given coastline happens to be, so every country comes
 * out at a comparable on-screen fidelity.
 */
/** Longest side of a ring's bounding box, in degrees. */
function ringExtent(ring: Position[]): number {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x! < minX) minX = x!;
    if (x! > maxX) maxX = x!;
    if (y! < minY) minY = y!;
    if (y! > maxY) maxY = y!;
  }
  return Math.max(maxX - minX, maxY - minY);
}

/**
 * Rings smaller than this across are dropped before simplification.
 *
 * The climate data is on a 0.25° grid, so nothing above about zoom 8 is
 * meaningful; one pixel there is roughly 0.005°. A 0.02° ring is at most four
 * pixels and cannot be read. The Australian Bureau of Statistics coastline
 * carries several thousand such specks — keeping them costs most of the vertex
 * budget and renders as noise, while dropping them leaves every island a reader
 * could actually identify (Tasmania, Kangaroo, Melville, Stewart) intact.
 */
const MIN_RING_EXTENT_DEG = 0.02;

/** Iterative Douglas-Peucker. Iterative because some coastal rings run to
 *  100,000+ points and a recursive implementation blows the stack. */
function simplifyRing(ring: Position[], tolerance: number): Position[] {
  const n = ring.length;
  if (n < 5) return ring;

  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;

  const stack: Array<[number, number]> = [[0, n - 1]];
  const tol2 = tolerance * tolerance;

  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    if (last <= first + 1) continue;

    const [ax, ay] = ring[first]!;
    const [bx, by] = ring[last]!;
    const dx = bx! - ax!;
    const dy = by! - ay!;
    const span = dx * dx + dy * dy;

    let worst = 0;
    let worstIndex = -1;

    for (let i = first + 1; i < last; i += 1) {
      const [px, py] = ring[i]!;
      let d2: number;
      if (span === 0) {
        const ex = px! - ax!;
        const ey = py! - ay!;
        d2 = ex * ex + ey * ey;
      } else {
        // Squared perpendicular distance from the point to segment a→b.
        const cross = dy * px! - dx * py! + bx! * ay! - by! * ax!;
        d2 = (cross * cross) / span;
      }
      if (d2 > worst) {
        worst = d2;
        worstIndex = i;
      }
    }

    if (worst > tol2 && worstIndex !== -1) {
      keep[worstIndex] = 1;
      stack.push([first, worstIndex], [worstIndex, last]);
    }
  }

  const out: Position[] = [];
  for (let i = 0; i < n; i += 1) if (keep[i]) out.push(ring[i]!);

  // A polygon ring needs four positions and must close on itself.
  if (out.length < 4) return [];
  const [fx, fy] = out[0]!;
  const [lx, ly] = out[out.length - 1]!;
  if (fx !== lx || fy !== ly) out.push([fx!, fy!]);
  return out;
}

function simplifyGeometry(geometry: AnyPolygon, tolerance: number): AnyPolygon {
  const polygons: Position[][][] = [];

  for (const rings of polygonsOf(geometry)) {
    const outer = rings[0];
    if (!outer || ringExtent(outer) < MIN_RING_EXTENT_DEG) continue;

    const simplifiedOuter = simplifyRing(outer, tolerance);
    if (simplifiedOuter.length < 4) continue;

    const kept: Position[][] = [simplifiedOuter];
    // Holes follow the same rules; a hole too small to see is not worth cutting.
    for (let h = 1; h < rings.length; h += 1) {
      const hole = rings[h]!;
      if (ringExtent(hole) < MIN_RING_EXTENT_DEG) continue;
      const simplifiedHole = simplifyRing(hole, tolerance);
      if (simplifiedHole.length >= 4) kept.push(simplifiedHole);
    }
    polygons.push(kept);
  }

  if (polygons.length === 1) {
    return { type: "Polygon", coordinates: polygons[0]! };
  }
  return { type: "MultiPolygon", coordinates: polygons };
}

/**
 * Simplify until the geometry fits `budget` vertices.
 *
 * A fixed tolerance is what produced the boundaries this script replaces: the
 * same 0.010° that is reasonable for Pakistan reduced Australia's coastline to
 * a triangle. Searching for the tolerance that hits a vertex budget adapts to
 * however convoluted a given coastline happens to be, so every country comes
 * out at a comparable on-screen fidelity.
 */
function simplifyToBudget(geometry: AnyPolygon, budget: number): AnyPolygon {
  // One cheap pass first: dropping sub-pixel rings removes most of the work
  // before the search begins.
  const pruned = simplifyGeometry(geometry, 0);
  if (countVertices(pruned) <= budget) return roundGeometry(pruned);

  let lo = 0.000005;
  let hi = 1;
  let best = pruned;

  for (let step = 0; step < 18; step += 1) {
    const mid = Math.sqrt(lo * hi); // geometric bisection — tolerance is log-scaled
    const candidate = simplifyGeometry(pruned, mid);
    const n = countVertices(candidate);

    if (n > budget) {
      lo = mid;
    } else {
      best = candidate;
      hi = mid;
      // Close enough to the budget that further refinement is not worth it.
      if (n > budget * 0.85) break;
    }
  }

  return roundGeometry(best);
}

/** Round to 5 decimal places (~1 m) — sub-pixel at every zoom this app renders. */
function roundGeometry(geometry: AnyPolygon): AnyPolygon {
  const round = (v: number) => Math.round(v * 1e5) / 1e5;
  const mapRings = (rings: Position[][]) =>
    rings
      .map((ring) => ring.map(([x, y]) => [round(x!), round(y!)] as Position))
      .filter((ring) => ring.length >= 4);

  if (geometry.type === "Polygon") {
    return { type: "Polygon", coordinates: mapRings(geometry.coordinates) };
  }
  return {
    type: "MultiPolygon",
    coordinates: geometry.coordinates
      .map(mapRings)
      .filter((rings) => rings.length > 0),
  };
}

// ---------------------------------------------------------------------------
// Pakistan: the official claim
// ---------------------------------------------------------------------------

/**
 * Pakistan's boundary as officially claimed.
 *
 * geoBoundaries — like every neutral international dataset — publishes the
 * *administered* extent, stopping at the Line of Control around lon 77.1. Maps
 * published in Pakistan are required to show the whole of Jammu & Kashmir, so
 * the national outline here is the union of that administered extent with the
 * Indian-administered portions of the former princely state, taken from
 * geoBoundaries' India ADM1 layer.
 *
 * The result is cross-checked against Natural Earth's purpose-built Pakistan
 * point-of-view dataset (`ne_10m_admin_0_countries_pak`), which spans
 * lon 60.84–79.62. If the union comes out materially short of that, the fetch
 * or the name matching below has gone wrong and the run fails loudly rather
 * than silently shipping the administered boundary.
 */
/**
 * Upstream spellings carry diacritics inconsistently — geoBoundaries writes
 * "Jammu and Kashmīr" with a macron — so every name comparison in this script
 * goes through here first.
 */
function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Indian-administered units making up the remainder of the former princely
 * state. This dataset predates the 2019 reorganisation, so "Jammu and Kashmir"
 * is a single polygon that already contains Ladakh; the other spellings are
 * listed so a future dataset refresh that splits them still matches.
 */
const KASHMIR_UNITS = ["jammu and kashmir", "jammu & kashmir", "ladakh"];

/**
 * Label for the claimed territory no province covers. Named as disputed rather
 * than assigned to either administration — that is the standard cartographic
 * treatment and matches Pakistan's own position that the status of Jammu &
 * Kashmir is unresolved.
 */
const CLAIM_REMAINDER_ID = "jammu-kashmir-disputed";
const CLAIM_REMAINDER_NAME = "Jammu & Kashmir (disputed)";

async function buildPakistanClaim(adm0: FeatureCollectionLike): Promise<AnyPolygon> {
  const base = adm0.features[0];
  if (!base) throw new Error("PAK ADM0 is empty");

  const india = await fetchGeoBoundaries("IND", "ADM1");
  const kashmir = india.features.filter((f) =>
    KASHMIR_UNITS.includes(normalizeName(String(f.properties.shapeName ?? ""))),
  );

  if (kashmir.length === 0) {
    const available = india.features
      .map((f) => String(f.properties.shapeName ?? ""))
      .filter((n) => /kashmir|ladakh|jammu/i.test(n));
    throw new Error(
      `No Jammu & Kashmir / Ladakh unit found in IND ADM1. Near matches: ${
        available.join(", ") || "(none)"
      }`,
    );
  }

  process.stdout.write(
    `    claim union with: ${kashmir
      .map((f) => f.properties.shapeName)
      .join(", ")}\n`,
  );

  let merged: PolyFeature = {
    type: "Feature",
    properties: {},
    geometry: base.geometry,
  };

  for (const piece of kashmir) {
    const next = union(
      featureCollection([merged, { ...piece, properties: {} }] as never),
    );
    if (!next) throw new Error("union returned null");
    merged = next as PolyFeature;
  }

  const [minX, , maxX] = boundsOf(merged.geometry);
  if (maxX < 79) {
    throw new Error(
      `Claim boundary only reaches lon ${maxX.toFixed(2)}; expected ~79.6. ` +
        `The Kashmir union did not take effect.`,
    );
  }
  process.stdout.write(
    `    claim extent: lon ${minX.toFixed(2)}..${maxX.toFixed(2)}\n`,
  );

  return merged.geometry;
}

/**
 * The part of the national claim that no first-level unit covers.
 *
 * Pakistan's official boundary takes in the whole of Jammu & Kashmir, but its
 * provinces only cover the part Pakistan administers. That leaves a wedge on
 * the India–China side — roughly lon 77.8 to 80.3 — inside the national border
 * yet belonging to no province. Painted regions alone would leave it as a hole,
 * so it reads as though it were outside the country.
 *
 * Subtracting the administered union from the claim yields that wedge, which is
 * then added as a unit in its own right so the country renders as one piece.
 */
function claimRemainder(
  claim: AnyPolygon,
  units: PolyFeature[],
): AnyPolygon | null {
  let administered: PolyFeature | null = null;
  for (const unit of units) {
    const piece: PolyFeature = {
      type: "Feature",
      properties: {},
      geometry: unit.geometry,
    };
    if (!administered) {
      administered = piece;
      continue;
    }
    const merged = union(featureCollection([administered, piece] as never));
    if (merged) administered = merged as PolyFeature;
  }
  if (!administered) return null;

  const remainder = difference(
    featureCollection([
      { type: "Feature", properties: {}, geometry: claim },
      administered,
    ] as never),
  );
  if (!remainder) return null;

  // Slivers along the shared border are artefacts of the two datasets being
  // digitised separately, not real territory. Only keep a remainder big enough
  // to be a genuine gap.
  const [minX, minY, maxX, maxY] = boundsOf(remainder.geometry as AnyPolygon);
  if (Math.max(maxX - minX, maxY - minY) < 0.5) return null;

  return remainder.geometry as AnyPolygon;
}

// ---------------------------------------------------------------------------
// Grid cell membership
// ---------------------------------------------------------------------------

/**
 * Indices of the climate-grid cells whose centre lies inside `geometry`.
 *
 * Deliberately tests the *unsimplified* geometry, so simplification can never
 * drop a border cell out of a province's aggregate.
 */
function cellsInside(geometry: AnyPolygon, grid: GridLattice): number[] {
  const [minX, minY, maxX, maxY] = boundsOf(geometry);
  const res = grid.resolution;
  const cells: number[] = [];

  for (let row = 0; row < grid.nLat; row += 1) {
    const lat = grid.latMin + (row + 0.5) * res;
    if (lat < minY - res || lat > maxY + res) continue;
    for (let col = 0; col < grid.nLon; col += 1) {
      const lon = grid.lonMin + (col + 0.5) * res;
      if (lon < minX - res || lon > maxX + res) continue;
      if (pointInGeometry(lon, lat, geometry)) cells.push(row * grid.nLon + col);
    }
  }
  return cells;
}

/**
 * Cells for one administrative unit, with a fallback for small ones.
 *
 * A 0.25° cell covers roughly 700 km² at these latitudes, so a compact city
 * unit — Tashkent City, Islamabad, the ACT — can be entirely contained within a
 * single cell without ever containing that cell's *centre*. Strict
 * point-in-polygon then yields an empty list and the unit reads as "no data",
 * which is wrong: there is data there, the unit is just smaller than the
 * sampling grid. In that case fall back to the cell its centroid sits in.
 */
function cellsForUnit(
  geometry: AnyPolygon,
  grid: GridLattice,
): { cells: number[]; viaCentroid: boolean } {
  const strict = cellsInside(geometry, grid);
  if (strict.length > 0) return { cells: strict, viaCentroid: false };

  const [cx, cy] = centroidOf(geometry);
  const col = Math.floor((cx - grid.lonMin) / grid.resolution);
  const row = Math.floor((cy - grid.latMin) / grid.resolution);
  if (col < 0 || col >= grid.nLon || row < 0 || row >= grid.nLat) {
    return { cells: [], viaCentroid: false };
  }
  return { cells: [row * grid.nLon + col], viaCentroid: true };
}

// ---------------------------------------------------------------------------
// Slugs
// ---------------------------------------------------------------------------

/**
 * Slugs must keep matching the ids already referenced by `countries.ts`,
 * `explorer.tsx`'s region chips, and the seeded database rows — so the upstream
 * names are mapped explicitly rather than hoping a generic slugifier lands on
 * the same string. Anything not listed falls through to `slugify` below, which
 * strips the administrative suffix ("… Region", "… Province") first.
 *
 * Keyed by ISO because the same word means different things in different
 * countries: "Tashkent" is the city, "Tashkent Region" the surrounding oblast.
 */
const NAME_TO_ID: Record<string, Record<string, string>> = {
  PAK: {
    "Islamabad Capital Territory": "islamabad",
    "Azad Kashmir": "azad-jammu-kashmir",
    "Azad Jammu and Kashmir": "azad-jammu-kashmir",
    "Khyber Pakhtunkhwa": "khyber-pakhtunkhwa",
    "Gilgit-Baltistan": "gilgit-baltistan",
  },
  UZB: {
    Tashkent: "tashkent-city",
    "Tashkent Region": "tashkent-region",
    "Republic of Karakalpakstan": "karakalpakstan",
    "Xorazm Region": "khorezm",
    "Samarqand Region": "samarkand",
  },
  AUS: {
    "New South Wales": "nsw",
    Victoria: "vic",
    Queensland: "qld",
    "South Australia": "sa",
    "Western Australia": "wa",
    Tasmania: "tas",
    "Northern Territory": "nt",
    "Australian Capital Territory": "act",
  },
  NZL: {
    "Manawatu-Wanganui": "manawatu-whanganui",
    "Hawke's Bay": "hawkes-bay",
  },
};

/** Administrative nouns that carry no identity and only bloat the slug. */
const ADMIN_SUFFIX = /\s+(region|province|oblast|viloyati|state|territory)$/i;

function slugify(name: string, iso?: string): string {
  const table = iso ? NAME_TO_ID[iso] : undefined;
  if (table) {
    const wanted = normalizeName(name);
    for (const [key, id] of Object.entries(table)) {
      if (normalizeName(key) === wanted) return id;
    }
  }

  // Diacritics are stripped so ids stay ASCII and stable across dataset
  // refreshes that change how a name is accented.
  return normalizeName(name)
    .replace(ADMIN_SUFFIX, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

interface OutFeature {
  type: "Feature";
  properties: {
    id: string;
    name: string;
    level: number;
    centroid: [number, number];
    bbox: [number, number, number, number];
  };
  geometry: AnyPolygon;
}

function round4(v: number): number {
  return Math.round(v * 1e4) / 1e4;
}

function toOutFeature(
  name: string,
  level: number,
  geometry: AnyPolygon,
  iso?: string,
): OutFeature {
  const centroid = centroidOf(geometry);
  const [minX, minY, maxX, maxY] = boundsOf(geometry);
  return {
    type: "Feature",
    properties: {
      id: slugify(name, iso),
      name,
      level,
      centroid: [round4(centroid[0]), round4(centroid[1])],
      bbox: [round4(minX), round4(minY), round4(maxX), round4(maxY)],
    },
    geometry,
  };
}

async function writeJson(payload: unknown, file: string): Promise<number> {
  await mkdir(path.dirname(file), { recursive: true });
  const body = JSON.stringify(payload);
  await writeFile(file, body, "utf8");
  return Buffer.byteLength(body);
}

async function buildCountry(target: CountryTarget): Promise<void> {
  const grid = GRIDS[target.iso]!;
  process.stdout.write(`\n  ${target.name} (${target.iso})\n`);

  // ---- national outline ---------------------------------------------------
  const adm0 = await fetchGeoBoundaries(target.iso, "ADM0");
  const rawCountry =
    target.iso === "PAK"
      ? await buildPakistanClaim(adm0)
      : (adm0.features[0]!.geometry as AnyPolygon);

  const simplified = simplifyToBudget(rawCountry, target.budgetAdm0);
  const countryFeature = toOutFeature(target.name, 0, simplified);
  const countryBytes = await writeJson(
    { type: "FeatureCollection", features: [countryFeature] },
    path.join(PUBLIC_GEO, target.country),
  );

  process.stdout.write(
    `    ${target.country.padEnd(26)} ${String(countVertices(rawCountry)).padStart(9)}` +
      ` → ${String(countVertices(simplified)).padStart(6)} verts  ${(countryBytes / 1024).toFixed(0)} KB\n`,
  );

  // ---- administrative levels ----------------------------------------------
  //
  // Level 2 is what the choropleth paints, so it matters most; level 1 is kept
  // for the region filter chips and for coarser aggregates.
  for (const level of [1, 2] as const) {
    const source = level === 1 ? "ADM1" : "ADM2";
    const outFile = level === 1 ? target.level1 : target.level2;
    const cellsFile = level === 1 ? target.level1Cells : target.level2Cells;
    const budget = level === 1 ? target.budgetAdm1 : target.budgetAdm2;

    const layer = await fetchGeoBoundaries(target.iso, source);
    const features: OutFeature[] = [];
    const cells: Record<string, number[]> = {};
    const viaCentroid: string[] = [];
    const seen = new Map<string, number>();

    for (const feature of layer.features) {
      const name = String(feature.properties.shapeName ?? "Unknown");
      const raw = feature.geometry as AnyPolygon;

      // Second-level names repeat across countries and sometimes within one
      // (Australia has several "Central Highlands"), so a colliding slug gets
      // a numeric suffix rather than silently overwriting its neighbour.
      let id = slugify(name, target.iso);
      const collisions = seen.get(id) ?? 0;
      seen.set(id, collisions + 1);
      if (collisions > 0) id = `${id}-${collisions + 1}`;

      const small = simplifyToBudget(raw, budget);
      if (countVertices(small) < 4) continue;

      const out = toOutFeature(name, level, small, target.iso);
      out.properties.id = id;
      features.push(out);

      // Membership from the full-resolution geometry, never the simplified
      // one, so simplification can never drop a border cell from an aggregate.
      const resolved = cellsForUnit(raw, grid);
      cells[id] = resolved.cells;
      if (resolved.viaCentroid) viaCentroid.push(id);
    }

    // Close the gap between the national claim and the administered units, so
    // the country paints as one piece rather than one with a bite taken out.
    const remainder = claimRemainder(rawCountry, layer.features);
    if (remainder) {
      const small = simplifyToBudget(remainder, target.budgetAdm1);
      const out = toOutFeature(CLAIM_REMAINDER_NAME, level, small, target.iso);
      out.properties.id = CLAIM_REMAINDER_ID;
      features.push(out);
      const resolved = cellsForUnit(remainder, grid);
      cells[CLAIM_REMAINDER_ID] = resolved.cells;
      process.stdout.write(
        `    · claim remainder added as "${CLAIM_REMAINDER_ID}"` +
          ` (${resolved.cells.length} grid cells)\n`,
      );
    }

    features.sort((a, b) => a.properties.name.localeCompare(b.properties.name));

    const geoBytes = await writeJson(
      { type: "FeatureCollection", features },
      path.join(PUBLIC_GEO, outFile),
    );
    const cellsBytes = await writeJson(cells, path.join(DATA_GEO, cellsFile));

    const totalCells = Object.values(cells).reduce((n, c) => n + c.length, 0);
    const empty = Object.entries(cells).filter(([, c]) => c.length === 0);
    const verts = features.reduce((n, f) => n + countVertices(f.geometry), 0);

    process.stdout.write(
      `    ${outFile.padEnd(28)} ${String(features.length).padStart(4)} units` +
        `  ${String(verts).padStart(7)} verts  ${(geoBytes / 1024).toFixed(0)} KB\n`,
    );
    process.stdout.write(
      `    ${cellsFile.padEnd(28)} ${String(totalCells).padStart(4)} cells` +
        ` of ${grid.nLon * grid.nLat}  ${(cellsBytes / 1024).toFixed(0)} KB\n`,
    );
    if (viaCentroid.length > 0) {
      process.stdout.write(
        `    · ${viaCentroid.length} unit(s) smaller than a grid cell, resolved` +
          ` by centroid\n`,
      );
    }
    if (empty.length > 0) {
      process.stdout.write(
        `    ⚠ ${empty.length} unit(s) outside the climate grid: ${empty
          .map(([id]) => id)
          .slice(0, 4)
          .join(", ")}\n`,
      );
    }
  }
}

async function main(): Promise<void> {
  const only = process.argv
    .find((a) => a.startsWith("--country="))
    ?.slice(10)
    .toUpperCase();

  const targets = only ? TARGETS.filter((t) => t.iso === only) : TARGETS;
  if (targets.length === 0) {
    throw new Error(`Unknown country ${only}; choose from ${TARGETS.map((t) => t.iso).join(", ")}`);
  }

  process.stdout.write("Building official boundaries\n");
  for (const target of targets) {
    await buildCountry(target);
  }
  process.stdout.write("\nDone.\n");
}

main().catch((error) => {
  console.error(`\n✗ ${(error as Error).message}`);
  process.exit(1);
});
