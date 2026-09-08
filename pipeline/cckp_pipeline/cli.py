"""Command line entry point for the CCKP extraction pipeline."""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from collections import Counter
from pathlib import Path

from . import plan as plans
from .catalog import PAKISTAN_BBOX, VARIABLES
from .extract import GridGeometry, extract_many

DEFAULT_OUT = Path(__file__).resolve().parents[2] / "data" / "grid"


def _configure_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(message)s",
        datefmt="%H:%M:%S",
    )


def cmd_extract(args: argparse.Namespace) -> int:
    specs = plans.resolve(args.plan)
    out_dir = Path(args.out)
    logging.info("plan %r -> %d fields into %s", args.plan, len(specs), out_dir)
    if args.dry_run:
        for spec in specs[: args.limit or len(specs)]:
            print(spec.url)
        return 0
    if args.limit:
        specs = specs[: args.limit]

    started = time.time()
    results = extract_many(
        specs,
        out_dir,
        bbox=PAKISTAN_BBOX,
        workers=args.workers,
        compress=not args.no_compress,
        skip_existing=not args.force,
    )
    tally = Counter(
        status if status in ("ok", "cached", "missing") else "error"
        for status in results.values()
    )
    logging.info(
        "finished in %.1fs — %s",
        time.time() - started,
        ", ".join(f"{k}={v}" for k, v in sorted(tally.items())),
    )
    write_manifest(out_dir)
    return 0 if tally["error"] == 0 else 1


def write_manifest(out_dir: Path) -> Path:
    """
    Summarise what has actually been extracted so the web app can advertise
    its gridded coverage without stat-ing thousands of files at request time.
    """
    entries: list[dict] = []
    geometry: dict | None = None
    for path in sorted(out_dir.glob("*.json*")):
        if path.name == "manifest.json":
            continue
        slug = path.name.split(".json")[0]
        parts = slug.split("_")
        if len(parts) != 7:
            continue
        variable, product, aggregation, scenario, model, percentile, period = parts
        entries.append(
            {
                "slug": slug,
                "file": path.name,
                "variable": variable,
                "product": product,
                "aggregation": aggregation,
                "scenario": scenario,
                "model": model,
                "percentile": percentile,
                "period": period,
                "bytes": path.stat().st_size,
            }
        )
        if geometry is None:
            import gzip

            raw = (
                gzip.decompress(path.read_bytes())
                if path.suffix == ".gz"
                else path.read_bytes()
            )
            geometry = json.loads(raw)["grid"]

    manifest = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "collection": "cmip6-x0.25",
        "bbox": {
            "lonMin": PAKISTAN_BBOX.lon_min,
            "latMin": PAKISTAN_BBOX.lat_min,
            "lonMax": PAKISTAN_BBOX.lon_max,
            "latMax": PAKISTAN_BBOX.lat_max,
        },
        "grid": geometry,
        "fieldCount": len(entries),
        "totalBytes": sum(e["bytes"] for e in entries),
        "variables": sorted({e["variable"] for e in entries}),
        "scenarios": sorted({e["scenario"] for e in entries}),
        "periods": sorted({e["period"] for e in entries}),
        "models": sorted({e["model"] for e in entries}),
        "fields": entries,
    }
    path = out_dir / "manifest.json"
    path.write_text(json.dumps(manifest, indent=2))
    logging.info("manifest: %d fields, %.1f MB", len(entries), manifest["totalBytes"] / 1e6)
    return path


def cmd_manifest(args: argparse.Namespace) -> int:
    write_manifest(Path(args.out))
    return 0


def cmd_plans(_: argparse.Namespace) -> int:
    for name in sorted(plans.PLANS):
        try:
            count = len(plans.resolve(name))
        except Exception as exc:  # pragma: no cover
            count = -1
            logging.warning("%s: %s", name, exc)
        print(f"{name:<14} {count:>6} fields")
    return 0


def cmd_variables(_: argparse.Namespace) -> int:
    for code, variable in sorted(VARIABLES.items(), key=lambda kv: (kv[1].family, kv[0])):
        print(f"{code:<12} {variable.family:<14} {variable.unit:<9} {variable.label}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="cckp",
        description="Extract World Bank CCKP CMIP6 0.25° fields for Pakistan.",
    )
    parser.add_argument("-v", "--verbose", action="store_true")
    sub = parser.add_subparsers(dest="command", required=True)

    extract = sub.add_parser("extract", help="download and subset a plan")
    extract.add_argument("plan", choices=sorted(plans.PLANS))
    extract.add_argument("--out", default=str(DEFAULT_OUT))
    extract.add_argument("--workers", type=int, default=6)
    extract.add_argument("--limit", type=int, default=0)
    extract.add_argument("--force", action="store_true", help="re-extract cached fields")
    extract.add_argument("--no-compress", action="store_true")
    extract.add_argument("--dry-run", action="store_true", help="print URLs only")
    extract.set_defaults(func=cmd_extract)

    manifest = sub.add_parser("manifest", help="rebuild manifest.json")
    manifest.add_argument("--out", default=str(DEFAULT_OUT))
    manifest.set_defaults(func=cmd_manifest)

    sub.add_parser("plans", help="list extraction plans").set_defaults(func=cmd_plans)
    sub.add_parser("variables", help="list catalogue variables").set_defaults(
        func=cmd_variables
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    _configure_logging(args.verbose)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
