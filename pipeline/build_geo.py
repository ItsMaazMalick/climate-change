import sys, json, time
from pathlib import Path
sys.setrecursionlimit(100000)
from cckp_pipeline.geo import build_admin_layer, write_json

root = Path(__file__).resolve().parents[1]
src, out = root / "data" / "geo", root / "public" / "geo"

jobs = [
    ("pak-ADM0.raw.geojson", "pakistan.geojson", 0, 0.010, False, ""),
    ("pak-ADM1.raw.geojson", "provinces.geojson", 1, 0.008, True, ""),
    ("pak-ADM2.raw.geojson", "districts.geojson", 2, 0.006, True, "d-"),
]
index = {}
for name, target, level, tol, cells, prefix in jobs:
    t = time.time()
    layer = build_admin_layer(
        src / name, level=level, tolerance=tol, with_grid_cells=cells, id_prefix=prefix
    )
    p = write_json(layer, out / target)
    print(f"{target:<22} {len(layer['features']):>4} features  {p.stat().st_size/1024:7.0f} KB  {time.time()-t:5.1f}s")
    if level > 0:
        index[["", "provinces", "districts"][level]] = [
            {k: v for k, v in f["properties"].items() if k != "cells"}
            for f in layer["features"]
        ]
        # cells kept in a sidecar so the client geojson stays lean
        write_json(
            {f["properties"]["id"]: f["properties"]["cells"] for f in layer["features"]},
            root / "data" / "geo" / f"{target.replace('.geojson','')}-cells.json",
        )
        for f in layer["features"]:
            f["properties"].pop("cells", None)
        write_json(layer, p)
write_json(index, root / "data" / "geo" / "admin-index.json")
print("done")
