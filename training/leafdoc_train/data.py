"""Dataset discovery, stratified splitting and CSV manifests (no torch dependency)."""

from __future__ import annotations

import csv
import random
from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

from .labels import plantdoc_to_plantvillage, plantvillage_labels

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


@dataclass(frozen=True)
class Sample:
    path: str
    label: str
    source: str  # "plantvillage" | "plantdoc" | "custom"


def _images(folder: Path) -> Iterable[Path]:
    for p in sorted(folder.rglob("*")):
        if p.is_file() and p.suffix.lower() in IMAGE_EXTS:
            yield p


def discover_plantvillage(root: str | Path) -> list[Sample]:
    """`root` holds one folder per class, named like `Tomato___Late_blight` (e.g. PlantVillage `raw/color`)."""
    root = Path(root)
    known = set(plantvillage_labels())
    samples: list[Sample] = []
    missing = sorted(known - {d.name for d in root.iterdir() if d.is_dir()})
    if missing:
        raise ValueError(f"PlantVillage folder {root} is missing classes: {missing}")
    for d in sorted(root.iterdir()):
        if d.is_dir() and d.name in known:
            samples += [Sample(str(p), d.name, "plantvillage") for p in _images(d)]
    return samples


def discover_plantdoc(root: str | Path) -> tuple[list[Sample], list[str]]:
    """
    Map PlantDoc class folders (e.g. `PlantDoc-Dataset/test`) onto PlantVillage labels.
    Returns the samples plus the folder names that were skipped for having no equivalent.
    """
    root = Path(root)
    samples: list[Sample] = []
    skipped: list[str] = []
    for d in sorted(root.iterdir()):
        if not d.is_dir():
            continue
        label = plantdoc_to_plantvillage(d.name)
        if label is None:
            skipped.append(d.name)
            continue
        samples += [Sample(str(p), label, "plantdoc") for p in _images(d)]
    return samples, skipped


def discover_custom(root: str | Path) -> list[Sample]:
    """Your own phone photos, arranged in PlantVillage-named class folders."""
    root = Path(root)
    known = set(plantvillage_labels())
    out: list[Sample] = []
    for d in sorted(root.iterdir()):
        if d.is_dir():
            if d.name not in known:
                raise ValueError(f"Unknown class folder {d.name!r} in {root}")
            out += [Sample(str(p), d.name, "custom") for p in _images(d)]
    return out


def stratified_split(
    samples: list[Sample], val: float = 0.1, test: float = 0.1, seed: int = 42
) -> dict[str, list[Sample]]:
    """Per-class shuffle and split so every class keeps the same proportions in each split."""
    if not 0 <= val < 1 or not 0 <= test < 1 or val + test >= 1:
        raise ValueError("val and test must be fractions that sum to less than 1")
    by_class: dict[str, list[Sample]] = defaultdict(list)
    for s in samples:
        by_class[s.label].append(s)
    rng = random.Random(seed)
    splits: dict[str, list[Sample]] = {"train": [], "val": [], "test": []}
    for label in sorted(by_class):
        items = sorted(by_class[label], key=lambda s: s.path)
        rng.shuffle(items)
        n = len(items)
        n_test = round(n * test)
        n_val = round(n * val)
        if n >= 3:
            n_test, n_val = max(n_test, 1 if test else 0), max(n_val, 1 if val else 0)
        splits["test"] += items[:n_test]
        splits["val"] += items[n_test : n_test + n_val]
        splits["train"] += items[n_test + n_val :]
    return splits


def write_manifest(path: str | Path, samples: Iterable[Sample]) -> int:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["path", "label", "source"])
        for s in samples:
            w.writerow([s.path, s.label, s.source])
            n += 1
    return n


def read_manifest(path: str | Path) -> list[Sample]:
    with open(path, newline="", encoding="utf-8") as f:
        return [Sample(r["path"], r["label"], r.get("source", "")) for r in csv.DictReader(f)]


def class_counts(samples: Iterable[Sample]) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    for s in samples:
        counts[s.label] += 1
    return dict(sorted(counts.items()))
