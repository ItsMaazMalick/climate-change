"""
Generate simplified Uzbekistan administrative GeoJSON layers and grid cell indexes.

Uzbekistan lattice:
lat: 37.0 to 45.75 (step 0.25 -> 35 rows)
lon: 56.0 to 73.25 (step 0.25 -> 69 cols)
Total cells = 2,415
"""

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_GEO = ROOT / "public" / "geo"
DATA_GEO = ROOT / "data" / "geo"

PUBLIC_GEO.mkdir(parents=True, exist_ok=True)
DATA_GEO.mkdir(parents=True, exist_ok=True)

# Uzbekistan 14 Level-1 Administrative Divisions (12 Viloyats + 1 Republic + 1 Capital City)
UZB_REGIONS = [
    {
        "id": "tashkent-city",
        "name": "Tashkent City",
        "level": 1,
        "centroid": [69.2401, 41.2995],
        "bbox": [69.12, 41.18, 69.40, 41.42],
        "poly": [
            [69.12, 41.25], [69.18, 41.38], [69.32, 41.42], [69.40, 41.34],
            [69.36, 41.21], [69.22, 41.18], [69.12, 41.25]
        ]
    },
    {
        "id": "tashkent-region",
        "name": "Tashkent Region",
        "level": 1,
        "centroid": [69.75, 41.20],
        "bbox": [68.50, 40.55, 70.85, 42.30],
        "poly": [
            [68.55, 40.85], [68.90, 41.40], [69.20, 41.65], [69.95, 42.30],
            [70.85, 41.95], [70.50, 41.30], [70.10, 40.90], [69.10, 40.55],
            [68.55, 40.85]
        ]
    },
    {
        "id": "samarkand",
        "name": "Samarkand Region",
        "level": 1,
        "centroid": [66.60, 39.70],
        "bbox": [65.30, 39.10, 67.45, 40.40],
        "poly": [
            [65.35, 39.50], [65.80, 40.25], [66.85, 40.40], [67.45, 39.85],
            [67.20, 39.15], [66.10, 39.10], [65.35, 39.50]
        ]
    },
    {
        "id": "bukhara",
        "name": "Bukhara Region",
        "level": 1,
        "centroid": [64.00, 40.00],
        "bbox": [62.20, 38.80, 65.50, 41.60],
        "poly": [
            [62.25, 39.40], [63.10, 40.90], [64.20, 41.60], [65.45, 40.70],
            [64.80, 39.40], [63.60, 38.85], [62.25, 39.40]
        ]
    },
    {
        "id": "karakalpakstan",
        "name": "Republic of Karakalpakstan",
        "level": 1,
        "centroid": [58.50, 43.50],
        "bbox": [56.00, 41.10, 62.30, 45.65],
        "poly": [
            [56.00, 41.30], [56.00, 45.60], [58.80, 45.65], [61.80, 44.50],
            [62.30, 43.20], [61.10, 41.50], [59.20, 41.10], [56.80, 41.15],
            [56.00, 41.30]
        ]
    },
    {
        "id": "andijan",
        "name": "Andijan Region",
        "level": 1,
        "centroid": [72.35, 40.75],
        "bbox": [71.80, 40.40, 73.15, 41.10],
        "poly": [
            [71.85, 40.65], [72.20, 41.05], [73.15, 40.90], [72.90, 40.45],
            [72.25, 40.40], [71.85, 40.65]
        ]
    },
    {
        "id": "fergana",
        "name": "Fergana Region",
        "level": 1,
        "centroid": [71.50, 40.40],
        "bbox": [70.40, 39.85, 72.05, 40.95],
        "poly": [
            [70.45, 40.25], [70.90, 40.90], [71.95, 40.80], [72.05, 40.35],
            [71.50, 39.85], [70.75, 40.00], [70.45, 40.25]
        ]
    },
    {
        "id": "namangan",
        "name": "Namangan Region",
        "level": 1,
        "centroid": [71.40, 41.10],
        "bbox": [70.50, 40.70, 72.20, 41.65],
        "poly": [
            [70.55, 41.05], [71.10, 41.65], [72.15, 41.35], [71.85, 40.75],
            [70.90, 40.80], [70.55, 41.05]
        ]
    },
    {
        "id": "qashqadaryo",
        "name": "Qashqadaryo Region",
        "level": 1,
        "centroid": [66.00, 38.85],
        "bbox": [64.80, 38.00, 67.50, 39.50],
        "poly": [
            [64.85, 38.75], [65.40, 39.45], [67.10, 39.40], [67.50, 38.80],
            [66.80, 38.05], [65.50, 38.10], [64.85, 38.75]
        ]
    },
    {
        "id": "surxondaryo",
        "name": "Surxondaryo Region",
        "level": 1,
        "centroid": [67.50, 38.00],
        "bbox": [66.50, 37.15, 68.40, 38.80],
        "poly": [
            [66.55, 37.85], [67.05, 38.75], [68.35, 38.45], [68.10, 37.20],
            [66.90, 37.15], [66.55, 37.85]
        ]
    },
    {
        "id": "khorezm",
        "name": "Khorezm Region",
        "level": 1,
        "centroid": [60.60, 41.50],
        "bbox": [59.90, 40.90, 62.00, 42.00],
        "poly": [
            [59.95, 41.35], [60.45, 41.95], [61.95, 41.70], [61.70, 41.00],
            [60.50, 40.95], [59.95, 41.35]
        ]
    },
    {
        "id": "navoiy",
        "name": "Navoiy Region",
        "level": 1,
        "centroid": [64.50, 42.20],
        "bbox": [62.00, 39.80, 67.20, 44.50],
        "poly": [
            [62.05, 41.80], [63.20, 44.45], [66.80, 43.80], [67.15, 41.20],
            [65.70, 39.85], [64.20, 40.30], [63.10, 41.50], [62.05, 41.80]
        ]
    },
    {
        "id": "jizzakh",
        "name": "Jizzakh Region",
        "level": 1,
        "centroid": [67.80, 40.30],
        "bbox": [66.80, 39.60, 68.90, 41.25],
        "poly": [
            [66.85, 40.25], [67.30, 41.20], [68.85, 40.80], [68.60, 39.70],
            [67.50, 39.60], [66.85, 40.25]
        ]
    },
    {
        "id": "sirdaryo",
        "name": "Sirdaryo Region",
        "level": 1,
        "centroid": [68.75, 40.50],
        "bbox": [68.20, 40.05, 69.30, 41.00],
        "poly": [
            [68.25, 40.45], [68.65, 40.95], [69.25, 40.70], [69.10, 40.10],
            [68.40, 40.05], [68.25, 40.45]
        ]
    },
]

# Build National Outer Boundary for Uzbekistan
UZB_OUTER = [
    [56.00, 41.30], [56.00, 45.60], [58.80, 45.65], [61.80, 44.50],
    [63.20, 44.45], [66.80, 43.80], [67.30, 41.20], [69.95, 42.30],
    [70.85, 41.95], [72.15, 41.35], [73.15, 40.90], [72.05, 40.35],
    [71.50, 39.85], [70.45, 40.25], [68.60, 39.70], [68.35, 38.45],
    [68.10, 37.20], [66.90, 37.15], [65.50, 38.10], [64.80, 39.40],
    [63.60, 38.85], [62.25, 39.40], [60.50, 40.95], [59.20, 41.10],
    [56.80, 41.15], [56.00, 41.30]
]

# Lattice calculation helper
def grid_cells_in_poly(poly):
    lon_min, lat_min = 56.0, 37.0
    res = 0.25
    n_lon = 69
    n_lat = 35
    
    # Bounding box of poly
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    
    cells = []
    for row in range(n_lat):
        lat = lat_min + (row + 0.5) * res
        if lat < min_y - res or lat > max_y + res:
            continue
        for col in range(n_lon):
            lon = lon_min + (col + 0.5) * res
            if lon < min_x - res or lon > max_x + res:
                continue
            # Point in poly raycast
            inside = False
            n = len(poly)
            j = n - 1
            for i in range(n):
                xi, yi = poly[i]
                xj, yj = poly[j]
                if (yi > lat) != (yj > lat):
                    x_cross = (xj - xi) * (lat - yi) / (yj - yi) + xi
                    if x_cross > lon:
                        inside = not inside
                j = i
            if inside:
                cells.append(row * n_lon + col)
    return cells

# 1. Build uzbekistan.geojson
uzb_national = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {
                "id": "uzbekistan",
                "name": "Uzbekistan",
                "level": 0,
                "centroid": [64.5853, 41.3775],
                "bbox": [56.00, 37.00, 73.15, 45.65]
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [UZB_OUTER]
            }
        }
    ]
}

# 2. Build uzbekistan-regions.geojson & cells index
regions_features = []
regions_cells = {}

for reg in UZB_REGIONS:
    cells = grid_cells_in_poly(reg["poly"])
    regions_cells[reg["id"]] = cells
    regions_features.append({
        "type": "Feature",
        "properties": {
            "id": reg["id"],
            "name": reg["name"],
            "level": 1,
            "centroid": reg["centroid"],
            "bbox": reg["bbox"]
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": [reg["poly"]]
        }
    })

uzb_regions_fc = {
    "type": "FeatureCollection",
    "features": regions_features
}

# 3. Build uzbekistan-districts.geojson
# Distribute key districts across the regions
UZB_DISTRICTS = [
    {"id": "d-yunusabad", "name": "Yunusabad (Tashkent)", "level": 2, "centroid": [69.28, 41.36], "bbox": [69.22, 41.32, 69.34, 41.40], "poly": [[69.22, 41.32], [69.26, 41.40], [69.34, 41.38], [69.30, 41.32], [69.22, 41.32]]},
    {"id": "d-chilangzor", "name": "Chilangzor (Tashkent)", "level": 2, "centroid": [69.20, 41.27], "bbox": [69.15, 41.23, 69.25, 41.31], "poly": [[69.15, 41.23], [69.20, 41.31], [69.25, 41.28], [69.22, 41.23], [69.15, 41.23]]},
    {"id": "d-samarkand-city", "name": "Samarkand City District", "level": 2, "centroid": [66.96, 39.65], "bbox": [66.88, 39.60, 67.04, 39.72], "poly": [[66.88, 39.60], [66.92, 39.72], [67.04, 39.68], [67.00, 39.60], [66.88, 39.60]]},
    {"id": "d-pastdargom", "name": "Pastdargom District", "level": 2, "centroid": [66.70, 39.60], "bbox": [66.50, 39.45, 66.85, 39.75], "poly": [[66.50, 39.45], [66.65, 39.75], [66.85, 39.68], [66.75, 39.45], [66.50, 39.45]]},
    {"id": "d-bukhara-city", "name": "Bukhara City District", "level": 2, "centroid": [64.43, 39.77], "bbox": [64.35, 39.72, 64.50, 39.84], "poly": [[64.35, 39.72], [64.40, 39.84], [64.50, 39.80], [64.46, 39.72], [64.35, 39.72]]},
    {"id": "d-gijduvon", "name": "Gijduvon District", "level": 2, "centroid": [64.67, 40.10], "bbox": [64.45, 39.95, 64.90, 40.25], "poly": [[64.45, 39.95], [64.60, 40.25], [64.90, 40.18], [64.75, 39.95], [64.45, 39.95]]},
    {"id": "d-nukus-city", "name": "Nukus City District", "level": 2, "centroid": [59.61, 42.46], "bbox": [59.50, 42.38, 59.75, 42.55], "poly": [[59.50, 42.38], [59.58, 42.55], [59.75, 42.50], [59.68, 42.38], [59.50, 42.38]]},
    {"id": "d-muynak", "name": "Muynak (Aral Sea Port)", "level": 2, "centroid": [59.03, 43.76], "bbox": [58.60, 43.40, 59.50, 44.10], "poly": [[58.60, 43.40], [58.90, 44.10], [59.50, 43.90], [59.20, 43.40], [58.60, 43.40]]},
    {"id": "d-andijan-city", "name": "Andijan City District", "level": 2, "centroid": [72.34, 40.78], "bbox": [72.25, 40.70, 72.45, 40.85], "poly": [[72.25, 40.70], [72.30, 40.85], [72.45, 40.82], [72.40, 40.70], [72.25, 40.70]]},
    {"id": "d-asaka", "name": "Asaka District", "level": 2, "centroid": [72.24, 40.64], "bbox": [72.10, 40.55, 72.38, 40.75], "poly": [[72.10, 40.55], [72.20, 40.75], [72.38, 40.70], [72.30, 40.55], [72.10, 40.55]]},
    {"id": "d-fergana-city", "name": "Fergana City District", "level": 2, "centroid": [71.78, 40.38], "bbox": [71.70, 40.30, 71.88, 40.45], "poly": [[71.70, 40.30], [71.75, 40.45], [71.88, 40.42], [71.82, 40.30], [71.70, 40.30]]},
    {"id": "d-kokand", "name": "Kokand City District", "level": 2, "centroid": [70.94, 40.53], "bbox": [70.85, 40.45, 71.05, 40.60], "poly": [[70.85, 40.45], [70.92, 40.60], [71.05, 40.56], [70.98, 40.45], [70.85, 40.45]]},
    {"id": "d-namangan-city", "name": "Namangan City District", "level": 2, "centroid": [71.67, 41.00], "bbox": [71.58, 40.92, 71.78, 41.08], "poly": [[71.58, 40.92], [71.65, 41.08], [71.78, 41.04], [71.72, 40.92], [71.58, 40.92]]},
    {"id": "d-chust", "name": "Chust District", "level": 2, "centroid": [71.23, 41.01], "bbox": [71.05, 40.90, 71.40, 41.15], "poly": [[71.05, 40.90], [71.20, 41.15], [71.40, 41.10], [71.30, 40.90], [71.05, 40.90]]},
    {"id": "d-qarshi-city", "name": "Qarshi City District", "level": 2, "centroid": [65.79, 38.86], "bbox": [65.70, 38.78, 65.90, 38.94], "poly": [[65.70, 38.78], [65.76, 38.94], [65.90, 38.90], [65.84, 38.78], [65.70, 38.78]]},
    {"id": "d-shahrisabz", "name": "Shahrisabz District", "level": 2, "centroid": [66.83, 39.05], "bbox": [66.65, 38.90, 67.05, 39.20], "poly": [[66.65, 38.90], [66.80, 39.20], [67.05, 39.15], [66.95, 38.90], [66.65, 38.90]]},
    {"id": "d-termez-city", "name": "Termez City District", "level": 2, "centroid": [67.28, 37.22], "bbox": [67.20, 37.15, 67.35, 37.30], "poly": [[67.20, 37.15], [67.25, 37.30], [67.35, 37.27], [67.30, 37.15], [67.20, 37.15]]},
    {"id": "d-denov", "name": "Denov District", "level": 2, "centroid": [67.90, 38.27], "bbox": [67.70, 38.10, 68.10, 38.45], "poly": [[67.70, 38.10], [67.85, 38.45], [68.10, 38.40], [68.00, 38.10], [67.70, 38.10]]},
    {"id": "d-urgench-city", "name": "Urgench City District", "level": 2, "centroid": [60.63, 41.55], "bbox": [60.55, 41.48, 60.72, 41.62], "poly": [[60.55, 41.48], [60.60, 41.62], [60.72, 41.58], [60.68, 41.48], [60.55, 41.48]]},
    {"id": "d-khiva", "name": "Khiva District", "level": 2, "centroid": [60.36, 41.38], "bbox": [60.20, 41.25, 60.50, 41.50], "poly": [[60.20, 41.25], [60.32, 41.50], [60.50, 41.45], [60.40, 41.25], [60.20, 41.25]]},
    {"id": "d-navoiy-city", "name": "Navoiy City District", "level": 2, "centroid": [65.38, 40.08], "bbox": [65.30, 40.02, 65.46, 40.16], "poly": [[65.30, 40.02], [65.35, 40.16], [65.46, 40.12], [65.42, 40.02], [65.30, 40.02]]},
    {"id": "d-zarafshan", "name": "Zarafshan Desert District", "level": 2, "centroid": [64.20, 41.57], "bbox": [63.90, 41.35, 64.50, 41.75], "poly": [[63.90, 41.35], [64.15, 41.75], [64.50, 41.70], [64.35, 41.35], [63.90, 41.35]]},
    {"id": "d-jizzakh-city", "name": "Jizzakh City District", "level": 2, "centroid": [67.84, 40.12], "bbox": [67.76, 40.05, 67.92, 40.18], "poly": [[67.76, 40.05], [67.80, 40.18], [67.92, 40.15], [67.88, 40.05], [67.76, 40.05]]},
    {"id": "d-zaamin", "name": "Zaamin Mountain District", "level": 2, "centroid": [68.32, 39.96], "bbox": [68.10, 39.75, 68.55, 40.15], "poly": [[68.10, 39.75], [68.25, 40.15], [68.55, 40.10], [68.45, 39.75], [68.10, 39.75]]},
    {"id": "d-guliston-city", "name": "Guliston City District", "level": 2, "centroid": [68.78, 40.49], "bbox": [68.70, 40.42, 68.86, 40.56], "poly": [[68.70, 40.42], [68.75, 40.56], [68.86, 40.52], [68.82, 40.42], [68.70, 40.42]]},
    {"id": "d-yangiyer", "name": "Yangiyer District", "level": 2, "centroid": [68.83, 40.27], "bbox": [68.72, 40.18, 68.95, 40.35], "poly": [[68.72, 40.18], [68.80, 40.35], [68.95, 40.30], [68.88, 40.18], [68.72, 40.18]]}
]

districts_features = []
districts_cells = {}

for dist in UZB_DISTRICTS:
    cells = grid_cells_in_poly(dist["poly"])
    districts_cells[dist["id"]] = cells
    districts_features.append({
        "type": "Feature",
        "properties": {
            "id": dist["id"],
            "name": dist["name"],
            "level": 2,
            "centroid": dist["centroid"],
            "bbox": dist["bbox"]
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": [dist["poly"]]
        }
    })

uzb_districts_fc = {
    "type": "FeatureCollection",
    "features": districts_features
}

# Write files
(PUBLIC_GEO / "uzbekistan.geojson").write_text(json.dumps(uzb_national, separators=(",", ":")))
(PUBLIC_GEO / "uzbekistan-regions.geojson").write_text(json.dumps(uzb_regions_fc, separators=(",", ":")))
(PUBLIC_GEO / "uzbekistan-districts.geojson").write_text(json.dumps(uzb_districts_fc, separators=(",", ":")))

(DATA_GEO / "uzb-regions-cells.json").write_text(json.dumps(regions_cells, separators=(",", ":")))
(DATA_GEO / "uzb-districts-cells.json").write_text(json.dumps(districts_cells, separators=(",", ":")))

print("Uzbekistan geo layers and cell indexes built successfully.")
