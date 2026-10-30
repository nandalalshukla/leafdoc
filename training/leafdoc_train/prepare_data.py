"""
Build train/val/test manifests.

    python -m leafdoc_train.prepare_data \
        --plantvillage data/PlantVillage-Dataset/raw/color \
        --plantdoc data/PlantDoc-Dataset \
        --out data/splits

Writes:
    train.csv / val.csv / test.csv   PlantVillage, stratified 80/10/10
    plantdoc_train.csv               PlantDoc train (field photos) — optional training mix + calibration
    plantdoc_test.csv                PlantDoc test — the honest, real-world benchmark
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .data import (
    class_counts,
    discover_custom,
    discover_plantdoc,
    discover_plantvillage,
    stratified_split,
    write_manifest,
)


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--plantvillage", required=True, help="Folder of PlantVillage class folders (raw/color)")
    ap.add_argument("--plantdoc", help="PlantDoc-Dataset root containing train/ and test/")
    ap.add_argument("--custom", help="Your own photos in PlantVillage-named class folders (added to test)")
    ap.add_argument("--out", default="data/splits")
    ap.add_argument("--val", type=float, default=0.1)
    ap.add_argument("--test", type=float, default=0.1)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args(argv)

    out = Path(args.out)
    pv = discover_plantvillage(args.plantvillage)
    splits = stratified_split(pv, args.val, args.test, args.seed)
    summary: dict[str, object] = {}
    for name, items in splits.items():
        summary[name] = write_manifest(out / f"{name}.csv", items)

    if args.plantdoc:
        root = Path(args.plantdoc)
        for part in ("train", "test"):
            if (root / part).is_dir():
                items, skipped = discover_plantdoc(root / part)
                summary[f"plantdoc_{part}"] = write_manifest(out / f"plantdoc_{part}.csv", items)
                if skipped:
                    summary[f"plantdoc_{part}_skipped_classes"] = skipped

    if args.custom:
        summary["custom_test"] = write_manifest(out / "custom_test.csv", discover_custom(args.custom))

    summary["train_class_counts"] = class_counts(splits["train"])
    (out / "summary.json").write_text(json.dumps(summary, indent=2))
    print(json.dumps({k: v for k, v in summary.items() if k != "train_class_counts"}, indent=2))


if __name__ == "__main__":
    main()
