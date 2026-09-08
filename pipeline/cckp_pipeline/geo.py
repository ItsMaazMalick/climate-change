"""
Prepare Pakistan administrative geometry for the web client.

geoBoundaries ships full-fidelity polygons (2.6 MB for ADM0 alone). The map
draws them at country scale, so we simplify with Ramer-Douglas-Peucker and
round coordinates to a fixed precision. Both operations are lossless at the
zoom levels the application actually renders, and together they cut payload
by roughly an order of magnitude.

We also derive, per admin unit:

* a bounding box and a representative point (for map fly-to and labels), and
* the list of climate-grid cell indices whose centres fall inside the unit,
  which is what lets the API aggregate a gridded field to a province or
  district without a spatial database.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any, Iterable, Sequence

from .catalog import GRID_RESOLUTION, PAKISTAN_BBOX

Point = tuple[float, float]
Ring = list[Point]


# --------------------------------------------------------------------------
# Simplification
# --------------------------------------------------------------------------


def _perpendicular_distance(p: Point, a: Point, b: Point) -> float:
    if a == b:
        return math.hypot(p[0] - a[0], p[1] - a[1])
    dx, dy = b[0] - a[0], b[1] - a[1]
    return abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / math.hypot(dx, dy)


def douglas_peucker(points: Sequence[Point], tolerance: float) -> list[Point]:
    if len(points) < 3:
        return list(points)
    first, last = points[0], points[-1]
    index, max_distance = 0, 0.0
    for i in range(1, len(points) - 1):
        distance = _perpendicular_distance(points[i], first, last)
        if distance > max_distance:
            index, max_distance = i, distance
    if max_distance <= tolerance:
        return [first, last]
    left = douglas_peucker(points[: index + 1], tolerance)
    right = douglas_peucker(points[index:], tolerance)
    return left[:-1] + right


def _simplify_ring(ring: Sequence[Sequence[float]], tolerance: float, precision: int) -> list[list[float]]:
    points: Ring = [(float(x), float(y)) for x, y in ring]
    simplified = douglas_peucker(points, tolerance)
    # A polygon ring needs at least four positions and must close on itself.
    if len(simplified) < 4:
        simplified = points[:: max(1, len(points) // 8)] or points
    if simplified[0] != simplified[-1]:
        simplified.append(simplified[0])
    return [[round(x, precision), round(y, precision)] for x, y in simplified]


def simplify_geometry(geometry: dict, tolerance: float, precision: int) -> dict:
    kind = geometry["type"]
    if kind == "Polygon":
        rings = [_simplify_ring(r, tolerance, precision) for r in geometry["coordinates"]]
        return {"type": "Polygon", "coordinates": [r for r in rings if len(r) >= 4]}
    if kind == "MultiPolygon":
        polygons = []
        for polygon in geometry["coordinates"]:
            rings = [_simplify_ring(r, tolerance, precision) for r in polygon]
            rings = [r for r in rings if len(r) >= 4]
            if rings:
                polygons.append(rings)
        return {"type": "MultiPolygon", "coordinates": polygons}
    return geometry


# --------------------------------------------------------------------------
# Geometry helpers
# --------------------------------------------------------------------------


def iter_rings(geometry: dict) -> Iterable[list[list[float]]]:
    if geometry["type"] == "Polygon":
        yield from geometry["coordinates"]
    elif geometry["type"] == "MultiPolygon":
        for polygon in geometry["coordinates"]:
            yield from polygon


def bounds_of(geometry: dict) -> tuple[float, float, float, float]:
    xs: list[float] = []
    ys: list[float] = []
    for ring in iter_rings(geometry):
        for x, y in ring:
            xs.append(x)
            ys.append(y)
    return min(xs), min(ys), max(xs), max(ys)


def _ring_area(ring: Sequence[Sequence[float]]) -> float:
    total = 0.0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]
        x2, y2 = ring[i + 1]
        total += x1 * y2 - x2 * y1
    return total / 2.0


def area_weighted_centroid(geometry: dict) -> Point:
    """
    Centroid weighted by signed ring area, so holes and small islands do not
    drag the label off the mainland.
    """
    cx = cy = total_area = 0.0
    for ring in iter_rings(geometry):
        area = _ring_area(ring)
        if area == 0:
            continue
        rx = ry = 0.0
        for i in range(len(ring) - 1):
            x1, y1 = ring[i]
            x2, y2 = ring[i + 1]
            cross = x1 * y2 - x2 * y1
            rx += (x1 + x2) * cross
            ry += (y1 + y2) * cross
        rx /= 6 * area
        ry /= 6 * area
        cx += rx * area
        cy += ry * area
        total_area += area
    if total_area == 0:
        min_x, min_y, max_x, max_y = bounds_of(geometry)
        return ((min_x + max_x) / 2, (min_y + max_y) / 2)
    return (cx / total_area, cy / total_area)


def point_in_ring(x: float, y: float, ring: Sequence[Sequence[float]]) -> bool:
    """Standard even-odd ray casting."""
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y):
            x_cross = (xj - xi) * (y - yi) / (yj - yi) + xi
            if x_cross > x:
                inside = not inside
        j = i
    return inside


def point_in_geometry(x: float, y: float, geometry: dict) -> bool:
    if geometry["type"] == "Polygon":
        polygons = [geometry["coordinates"]]
    elif geometry["type"] == "MultiPolygon":
        polygons = geometry["coordinates"]
    else:
        return False
    for rings in polygons:
        if not rings:
            continue
        if point_in_ring(x, y, rings[0]) and not any(
            point_in_ring(x, y, hole) for hole in rings[1:]
        ):
            return True
    return False


# --------------------------------------------------------------------------
# Grid membership
# --------------------------------------------------------------------------


def grid_cells_in(geometry: dict) -> list[int]:
    """
    Indices of climate-grid cells whose centre lies inside ``geometry``.

    Index convention matches the extractor: ``row * nLon + col`` counting from
    the south-west corner of :data:`PAKISTAN_BBOX`.
    """
    res = GRID_RESOLUTION
    lon_min = math.floor(PAKISTAN_BBOX.lon_min / res) * res
    lat_min = math.floor(PAKISTAN_BBOX.lat_min / res) * res
    n_lon = int(round((PAKISTAN_BBOX.lon_max - lon_min) / res))
    n_lat = int(round((PAKISTAN_BBOX.lat_max - lat_min) / res))

    min_x, min_y, max_x, max_y = bounds_of(geometry)
    cells: list[int] = []
    for row in range(n_lat):
        lat = lat_min + (row + 0.5) * res
        if lat < min_y - res or lat > max_y + res:
            continue
        for col in range(n_lon):
            lon = lon_min + (col + 0.5) * res
            if lon < min_x - res or lon > max_x + res:
                continue
            if point_in_geometry(lon, lat, geometry):
                cells.append(row * n_lon + col)
    return cells


# --------------------------------------------------------------------------
# Build
# --------------------------------------------------------------------------

SLUG_OVERRIDES = {
    "Islamabad Capital Territory": "islamabad",
    "Khyber Pakhtunkhwa": "khyber-pakhtunkhwa",
    "Azad Kashmir": "azad-jammu-kashmir",
    "Gilgit-Baltistan": "gilgit-baltistan",
}


def slugify(name: str) -> str:
    if name in SLUG_OVERRIDES:
        return SLUG_OVERRIDES[name]
    out = []
    for ch in name.lower():
        if ch.isalnum():
            out.append(ch)
        elif out and out[-1] != "-":
            out.append("-")
    return "".join(out).strip("-")


def build_admin_layer(
    source: Path,
    *,
    level: int,
    tolerance: float,
    precision: int = 4,
    with_grid_cells: bool = True,
    id_prefix: str = "",
) -> dict[str, Any]:
    raw = json.loads(source.read_text())
    features: list[dict] = []
    for feature in raw["features"]:
        props = feature["properties"]
        name = props.get("shapeName") or props.get("name") or "Unknown"
        geometry = simplify_geometry(feature["geometry"], tolerance, precision)
        centroid = area_weighted_centroid(geometry)
        min_x, min_y, max_x, max_y = bounds_of(geometry)
        out_props: dict[str, Any] = {
            # Ids are namespaced by level: a district and a province can share
            # a name (Islamabad is both), and they must not collide into one
            # row when the layers are loaded into the same table.
            "id": f"{id_prefix}{slugify(name)}",
            "name": name,
            "level": level,
            "centroid": [round(centroid[0], 4), round(centroid[1], 4)],
            "bbox": [
                round(min_x, 4),
                round(min_y, 4),
                round(max_x, 4),
                round(max_y, 4),
            ],
        }
        if with_grid_cells:
            # Membership is computed on the *unsimplified* geometry so that
            # simplification never silently drops a border cell.
            out_props["cells"] = grid_cells_in(feature["geometry"])
        features.append(
            {"type": "Feature", "properties": out_props, "geometry": geometry}
        )
    features.sort(key=lambda f: f["properties"]["name"])
    return {"type": "FeatureCollection", "features": features}


def write_json(payload: dict, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, separators=(",", ":")))
    return path
