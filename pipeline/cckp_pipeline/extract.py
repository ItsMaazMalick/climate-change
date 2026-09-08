"""
Download CCKP gridded NetCDF fields and reduce them to a Pakistan subset.

The upstream files are global 0.25 degree rasters (1440 x 721) weighing ~8 MB
each.  Pakistan occupies roughly 70 x 56 cells, so the subset is three orders
of magnitude smaller.  We therefore download, slice, and discard.

Output is a compact JSON document per field, plus a manifest describing the
grid geometry once for the whole collection.  Those documents are what the
loader pushes into PostGIS and what the web app can serve directly when no
database is configured.
"""

from __future__ import annotations

import concurrent.futures
import gzip
import json
import logging
import math
import os
import tempfile
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import netCDF4
import numpy as np

from .catalog import (
    GRID_RESOLUTION,
    PAKISTAN_BBOX,
    BBox,
    netcdf_key,
    netcdf_url,
)

log = logging.getLogger("cckp.extract")

USER_AGENT = "climate-pakistan-pipeline/1.0 (+https://github.com/)"
MAX_RETRIES = 4


# --------------------------------------------------------------------------


@dataclass(frozen=True)
class FieldSpec:
    """One rasterised field in the archive."""

    variable: str
    model: str
    scenario: str
    product: str
    aggregation: str
    percentile: str
    period: str
    statistic: str = "mean"

    @property
    def key(self) -> str:
        return netcdf_key(
            variable=self.variable,
            model=self.model,
            scenario=self.scenario,
            product=self.product,  # type: ignore[arg-type]
            aggregation=self.aggregation,  # type: ignore[arg-type]
            statistic=self.statistic,
            percentile=self.percentile,  # type: ignore[arg-type]
            period=self.period,
        )

    @property
    def url(self) -> str:
        return netcdf_url(
            variable=self.variable,
            model=self.model,
            scenario=self.scenario,
            product=self.product,  # type: ignore[arg-type]
            aggregation=self.aggregation,  # type: ignore[arg-type]
            statistic=self.statistic,
            percentile=self.percentile,  # type: ignore[arg-type]
            period=self.period,
        )

    @property
    def slug(self) -> str:
        return "_".join(
            [
                self.variable,
                self.product,
                self.aggregation,
                self.scenario,
                self.model,
                self.percentile,
                self.period,
            ]
        )


@dataclass
class GridGeometry:
    """Row/column geometry of the extracted subset."""

    lon_min: float
    lat_min: float
    resolution: float
    n_lon: int
    n_lat: int

    def to_dict(self) -> dict:
        return {
            "lonMin": round(self.lon_min, 4),
            "latMin": round(self.lat_min, 4),
            "resolution": self.resolution,
            "nLon": self.n_lon,
            "nLat": self.n_lat,
            "cellCount": self.n_lon * self.n_lat,
        }

    def cell_centre(self, index: int) -> tuple[float, float]:
        row, col = divmod(index, self.n_lon)
        return (
            self.lon_min + (col + 0.5) * self.resolution,
            self.lat_min + (row + 0.5) * self.resolution,
        )


# --------------------------------------------------------------------------


def _download(url: str, dest: Path) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    last: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                dest.write_bytes(response.read())
            return
        except (urllib.error.URLError, TimeoutError, OSError) as exc:  # pragma: no cover
            last = exc
            if isinstance(exc, urllib.error.HTTPError) and exc.code in (403, 404):
                raise FileNotFoundError(url) from exc
            log.debug("retry %s/%s for %s (%s)", attempt + 1, MAX_RETRIES, url, exc)
    raise RuntimeError(f"failed to download {url}") from last


def _principal_variable(ds: netCDF4.Dataset, spec: FieldSpec) -> str:
    """
    Pick the payload variable inside a CCKP NetCDF file.

    Files are named ``{product}-{variable}-{aggregation}-{statistic}`` and the
    payload variable repeats that name.  Some anomaly files also carry a
    ``anomalysignificance-*`` companion recording model agreement, which we
    must not mistake for the payload.
    """
    expected = f"{spec.product}-{spec.variable}-{spec.aggregation}-{spec.statistic}"
    if expected in ds.variables:
        return expected
    coords = {"time", "lat", "lon", "bnds", "lat_bnds", "lon_bnds"}
    candidates = [
        name
        for name, var in ds.variables.items()
        if name not in coords
        and not name.startswith("anomalysignificance")
        and var.ndim >= 2
    ]
    if not candidates:
        raise ValueError(f"no payload variable in {spec.key}")
    return candidates[0]


def _significance_variable(ds: netCDF4.Dataset) -> str | None:
    for name in ds.variables:
        if name.startswith("anomalysignificance"):
            return name
    return None


def _time_labels(ds: netCDF4.Dataset, count: int) -> list[int]:
    """
    Month numbers for each layer of a field.

    CCKP stamps monthly climatologies on the first of each month and seasonal
    ones on the first month of each season (1, 4, 7, 10), all in the first
    year of the period. Only the month is meaningful — the year is the window
    label, not an actual date — so that is what we keep.
    """
    try:
        variable = ds.variables["time"]
        stamps = netCDF4.num2date(
            variable[:count], variable.units, getattr(variable, "calendar", "standard")
        )
        return [int(stamp.month) for stamp in np.atleast_1d(stamps)]
    except Exception:  # pragma: no cover - defensive
        if count == 12:
            return list(range(1, 13))
        if count == 4:
            return [1, 4, 7, 10]
        return [7] * count


def _slice_indices(
    coords: np.ndarray, lo: float, hi: float
) -> tuple[int, int]:
    """Inclusive index range of ``coords`` values falling within ``[lo, hi]``."""
    mask = (coords >= lo) & (coords <= hi)
    idx = np.flatnonzero(mask)
    if idx.size == 0:
        raise ValueError("bounding box does not intersect the grid")
    return int(idx[0]), int(idx[-1])


def extract_field(
    spec: FieldSpec,
    *,
    bbox: BBox = PAKISTAN_BBOX,
    workdir: Path | None = None,
) -> dict:
    """
    Download one field and return a JSON-ready subset document.

    The returned ``values`` array is stacked layer-major and, within a layer,
    row-major from the south-west corner: index
    ``layer * nLat * nLon + row * nLon + col``, where row 0 is the
    southernmost band.  Annual fields have a single layer; monthly fields
    have twelve and seasonal fields four, labelled by ``times``.  Missing
    cells (ocean, outside the model domain) are ``None``.
    """
    workdir = workdir or Path(tempfile.gettempdir())
    workdir.mkdir(parents=True, exist_ok=True)

    with tempfile.NamedTemporaryFile(
        suffix=".nc", dir=workdir, delete=False
    ) as handle:
        tmp = Path(handle.name)
    try:
        _download(spec.url, tmp)
        with netCDF4.Dataset(tmp) as ds:
            lats = np.asarray(ds.variables["lat"][:], dtype="float64")
            lons = np.asarray(ds.variables["lon"][:], dtype="float64")

            # CCKP publishes longitudes on -180..180; normalise defensively.
            if lons.max() > 180.0:
                lons = ((lons + 180.0) % 360.0) - 180.0

            lat_lo, lat_hi = _slice_indices(lats, bbox.lat_min, bbox.lat_max)
            lon_lo, lon_hi = _slice_indices(lons, bbox.lon_min, bbox.lon_max)

            payload_name = _principal_variable(ds, spec)
            payload = ds.variables[payload_name]
            window = payload[..., lat_lo : lat_hi + 1, lon_lo : lon_hi + 1]
            data = np.ma.masked_invalid(np.ma.asarray(window))

            # Annual fields carry a singleton time axis; monthly and seasonal
            # fields carry a real one (12 months, 4 seasons). Collapse the
            # former and keep the latter as stacked layers, because the
            # seasonal cycle is the whole point of those products in a
            # monsoon climate — the annual mean hides it completely.
            while data.ndim > 3 and data.shape[0] == 1:
                data = data[0]
            if data.ndim == 3 and data.shape[0] == 1:
                data = data[0]
            if data.ndim == 2:
                data = data[np.newaxis, :, :]
            if data.ndim != 3:
                raise ValueError(
                    f"unexpected payload shape {data.shape} for {spec.key}"
                )

            times = _time_labels(ds, int(data.shape[0]))

            sub_lats = lats[lat_lo : lat_hi + 1]
            ascending = bool(sub_lats[0] < sub_lats[-1])
            if not ascending:
                data = data[:, ::-1, :]
                sub_lats = sub_lats[::-1]

            significance: list[int | None] | None = None
            sig_name = _significance_variable(ds)
            if sig_name is not None:
                sig_window = ds.variables[sig_name][
                    ..., lat_lo : lat_hi + 1, lon_lo : lon_hi + 1
                ]
                sig = np.ma.masked_invalid(np.ma.asarray(sig_window))
                while sig.ndim > 3 and sig.shape[0] == 1:
                    sig = sig[0]
                if sig.ndim == 2:
                    sig = sig[np.newaxis, :, :]
                if not ascending:
                    sig = sig[:, ::-1, :]
                significance = [
                    None if v is np.ma.masked else int(v) for v in sig.ravel()
                ]

            units = getattr(payload, "units", "")

        values: list[float | None] = []
        for value in data.ravel():
            if value is np.ma.masked or (
                isinstance(value, float) and math.isnan(value)
            ):
                values.append(None)
            else:
                values.append(round(float(value), 3))

        geometry = GridGeometry(
            lon_min=float(lons[lon_lo] - GRID_RESOLUTION / 2),
            lat_min=float(min(sub_lats) - GRID_RESOLUTION / 2),
            resolution=GRID_RESOLUTION,
            n_lon=int(data.shape[2]),
            n_lat=int(data.shape[1]),
        )

        finite = [v for v in values if v is not None]
        return {
            "spec": {
                "variable": spec.variable,
                "model": spec.model,
                "scenario": spec.scenario,
                "product": spec.product,
                "aggregation": spec.aggregation,
                "percentile": spec.percentile,
                "period": spec.period,
                "statistic": spec.statistic,
            },
            "source": spec.url,
            "units": units,
            "grid": geometry.to_dict(),
            # Layer labels for multi-step products. Length 1 for annual
            # fields, 12 for monthly, 4 for seasonal. ``values`` is stacked
            # layer-major: layer * (nLat * nLon) + row * nLon + col.
            "times": times,
            "nTime": len(times),
            "stats": {
                "count": len(finite),
                "min": round(min(finite), 3) if finite else None,
                "max": round(max(finite), 3) if finite else None,
                "mean": round(sum(finite) / len(finite), 3) if finite else None,
            },
            "values": values,
            "significance": significance,
        }
    finally:
        tmp.unlink(missing_ok=True)


# --------------------------------------------------------------------------


def write_field(document: dict, out_dir: Path, *, compress: bool = True) -> Path:
    spec = document["spec"]
    slug = "_".join(
        [
            spec["variable"],
            spec["product"],
            spec["aggregation"],
            spec["scenario"],
            spec["model"],
            spec["percentile"],
            spec["period"],
        ]
    )
    out_dir.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(document, separators=(",", ":")).encode()
    if compress:
        path = out_dir / f"{slug}.json.gz"
        path.write_bytes(gzip.compress(payload, 6))
    else:
        path = out_dir / f"{slug}.json"
        path.write_bytes(payload)
    return path


def extract_many(
    specs: list[FieldSpec],
    out_dir: Path,
    *,
    bbox: BBox = PAKISTAN_BBOX,
    workers: int = 6,
    compress: bool = True,
    skip_existing: bool = True,
) -> dict[str, str]:
    """
    Extract many fields concurrently.  Returns ``{slug: status}``.

    Missing upstream combinations are recorded as ``missing`` rather than
    raising — the archive legitimately does not publish every cross-product
    (e.g. SSP1-1.9 is only available for a subset of variables).
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    results: dict[str, str] = {}

    def task(spec: FieldSpec) -> tuple[str, str]:
        suffix = ".json.gz" if compress else ".json"
        if skip_existing and (out_dir / f"{spec.slug}{suffix}").exists():
            return spec.slug, "cached"
        try:
            document = extract_field(spec, bbox=bbox)
        except FileNotFoundError:
            return spec.slug, "missing"
        except Exception as exc:  # pragma: no cover - network variance
            log.warning("failed %s: %s", spec.slug, exc)
            return spec.slug, f"error: {exc}"
        write_field(document, out_dir, compress=compress)
        return spec.slug, "ok"

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        for slug, status in pool.map(task, specs):
            results[slug] = status
            if status not in ("ok", "cached"):
                log.info("%-70s %s", slug, status)
    return results


def default_workdir() -> Path:
    return Path(os.environ.get("CCKP_WORKDIR", tempfile.gettempdir()))
