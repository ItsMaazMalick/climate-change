/**
 * Projection and viewport maths for the Pakistan map.
 *
 * We use a plate-carrée projection with a latitude-dependent horizontal
 * scaling — an equirectangular projection standardised at the centre of the
 * country. Over a 17° × 14° extent this keeps shape distortion below what a
 * reader can see, and it has one decisive advantage over a proper conformal
 * projection here: the climate grid is defined on exactly this lattice, so
 * every 0.25° cell stays an axis-aligned rectangle and 4,000 of them can be
 * drawn as filled rects in a single canvas pass.
 */

export interface BBox {
  lonMin: number;
  latMin: number;
  lonMax: number;
  latMax: number;
}

export interface Viewport {
  width: number;
  height: number;
  /** Fractional centre within the bbox, 0–1. */
  centerX: number;
  centerY: number;
  zoom: number;
}

export interface Projection {
  toScreen(lon: number, lat: number): [number, number];
  toGeo(x: number, y: number): [number, number];
  /** Pixels per degree of longitude at the current zoom. */
  scaleX: number;
  scaleY: number;
  width: number;
  height: number;
}

export function createProjection(bbox: BBox, viewport: Viewport): Projection {
  const lonSpan = bbox.lonMax - bbox.lonMin;
  const latSpan = bbox.latMax - bbox.latMin;
  const midLat = (bbox.latMin + bbox.latMax) / 2;
  const cosPhi = Math.cos((midLat * Math.PI) / 180);

  // Fit the extent with comfortable breathing room so the country map
  // is never clipped by top banners, control widgets, or bottom legends.
  const fitX = (viewport.width * 0.90) / (lonSpan * cosPhi);
  const fitY = (viewport.height * 0.88) / latSpan;
  const base = Math.min(fitX, fitY);

  const scaleX = base * cosPhi * viewport.zoom;
  const scaleY = base * viewport.zoom;

  const centerLon = bbox.lonMin + lonSpan * viewport.centerX;
  const centerLat = bbox.latMin + latSpan * (1 - viewport.centerY);

  const originX = viewport.width / 2 - centerLon * scaleX;
  // Screen y grows downward; latitude grows upward.
  const originY = viewport.height / 2 + centerLat * scaleY;

  return {
    scaleX,
    scaleY,
    width: viewport.width,
    height: viewport.height,
    toScreen(lon, lat) {
      return [originX + lon * scaleX, originY - lat * scaleY];
    },
    toGeo(x, y) {
      return [(x - originX) / scaleX, (originY - y) / scaleY];
    },
  };
}

export function clampViewport(viewport: Viewport): Viewport {
  const zoom = Math.min(24, Math.max(1, viewport.zoom));
  // At zoom 1 the extent exactly fills the frame, so panning is pinned.
  // Beyond that, allow the centre to travel far enough to reach the corners
  // but no further, so the country can never be dragged off screen.
  const margin = 0.5 / zoom;
  const clamp = (v: number) => Math.min(1 - margin, Math.max(margin, v));
  return {
    ...viewport,
    zoom,
    centerX: zoom <= 1 ? 0.5 : clamp(viewport.centerX),
    centerY: zoom <= 1 ? 0.5 : clamp(viewport.centerY),
  };
}

/** Zoom about a fixed screen point, so the geography under the cursor stays put. */
export function zoomAbout(
  bbox: BBox,
  viewport: Viewport,
  factor: number,
  screenX: number,
  screenY: number,
): Viewport {
  const before = createProjection(bbox, viewport);
  const [lon, lat] = before.toGeo(screenX, screenY);

  const next = clampViewport({ ...viewport, zoom: viewport.zoom * factor });
  const after = createProjection(bbox, next);
  const [screenXAfter, screenYAfter] = after.toScreen(lon, lat);

  const lonSpan = bbox.lonMax - bbox.lonMin;
  const latSpan = bbox.latMax - bbox.latMin;

  return clampViewport({
    ...next,
    centerX: next.centerX + (screenXAfter - screenX) / after.scaleX / lonSpan,
    centerY: next.centerY + (screenYAfter - screenY) / after.scaleY / latSpan,
  });
}

export function panBy(
  bbox: BBox,
  viewport: Viewport,
  dxPixels: number,
  dyPixels: number,
): Viewport {
  const projection = createProjection(bbox, viewport);
  const lonSpan = bbox.lonMax - bbox.lonMin;
  const latSpan = bbox.latMax - bbox.latMin;
  return clampViewport({
    ...viewport,
    centerX: viewport.centerX - dxPixels / projection.scaleX / lonSpan,
    centerY: viewport.centerY - dyPixels / projection.scaleY / latSpan,
  });
}

/** Viewport that frames a bounding box with a little breathing room. */
export function fitBounds(
  bbox: BBox,
  target: [number, number, number, number],
  viewport: Viewport,
  padding = 1.15,
): Viewport {
  const [minLon, minLat, maxLon, maxLat] = target;
  const lonSpan = bbox.lonMax - bbox.lonMin;
  const latSpan = bbox.latMax - bbox.latMin;

  const zoomX = lonSpan / Math.max(maxLon - minLon, 0.1);
  const zoomY = latSpan / Math.max(maxLat - minLat, 0.1);

  return clampViewport({
    ...viewport,
    zoom: Math.min(zoomX, zoomY) / padding,
    centerX: ((minLon + maxLon) / 2 - bbox.lonMin) / lonSpan,
    centerY: 1 - ((minLat + maxLat) / 2 - bbox.latMin) / latSpan,
  });
}

export type GeoJsonGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

export interface GeoFeature {
  type: "Feature";
  properties: {
    id: string;
    name: string;
    level: number;
    centroid: [number, number];
    bbox: [number, number, number, number];
  };
  geometry: GeoJsonGeometry;
}

export interface GeoCollection {
  type: "FeatureCollection";
  features: GeoFeature[];
}

/** Build an SVG path string for a feature under a projection. */
export function featurePath(
  geometry: GeoJsonGeometry,
  projection: Projection,
): string {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const parts: string[] = [];

  for (const rings of polygons) {
    for (const ring of rings) {
      if (ring.length < 3) continue;
      let d = "";
      let previous: [number, number] | null = null;
      for (const position of ring) {
        const [x, y] = projection.toScreen(position[0]!, position[1]!);
        // Drop vertices that land on the same device pixel; at country zoom
        // this removes most of the path without any visible change.
        if (previous && Math.abs(x - previous[0]) < 0.4 && Math.abs(y - previous[1]) < 0.4) {
          continue;
        }
        d += `${d ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
        previous = [x, y];
      }
      if (d) parts.push(`${d}Z`);
    }
  }

  return parts.join("");
}

/**
 * The same path as :func:`featurePath`, as a `Path2D` for canvas clipping.
 *
 * Built separately rather than from the SVG string because `new Path2D(d)`
 * has to re-parse the path text on every repaint, and this runs inside the
 * field draw loop.
 */
export function featurePath2D(
  geometry: GeoJsonGeometry,
  projection: Projection,
): Path2D {
  const path = new Path2D();
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;

  for (const rings of polygons) {
    for (const ring of rings) {
      if (ring.length < 3) continue;
      let started = false;
      for (const position of ring) {
        const [x, y] = projection.toScreen(position[0]!, position[1]!);
        if (started) path.lineTo(x, y);
        else {
          path.moveTo(x, y);
          started = true;
        }
      }
      path.closePath();
    }
  }
  return path;
}
