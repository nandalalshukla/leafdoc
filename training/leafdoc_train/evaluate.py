"""
Evaluate honestly: PlantVillage test *and* real field photos (PlantDoc / your own).

    python -m leafdoc_train.evaluate --checkpoint runs/mnv3/best.pt --splits data/splits

For every manifest found (test, plantdoc_test, custom_test) this writes logits,
accuracy/top-3, per-class recall, the confusion matrix (CSV + PNG) and the most
confused disease pairs to <run>/eval/<split>/, plus a combined report.json.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

import numpy as np
import torch
from tqdm import tqdm

from .calibration import expected_calibration_error, softmax
from .data import read_manifest
from .metrics import accuracy, confusion_matrix, per_class_recall, top_confusions, topk_accuracy
from .model import load_checkpoint, pick_device
from .torch_data import ManifestDataset, make_loader
from .transforms import eval_transform

EVAL_SPLITS = ("val", "test", "plantdoc_train", "plantdoc_test", "custom_test")


@torch.no_grad()
def collect_logits(model, loader, device) -> tuple[np.ndarray, np.ndarray]:
    outs, ys = [], []
    for x, y in tqdm(loader, leave=False):
        outs.append(model(x.to(device)).float().cpu().numpy())
        ys.append(y.numpy())
    return np.concatenate(outs), np.concatenate(ys)


def logits_for_split(model, ckpt, manifest: Path, device, batch_size=128, workers=4, cache_dir: Path | None = None):
    cache = cache_dir / f"{manifest.stem}_logits.npz" if cache_dir else None
    if cache and cache.exists() and cache.stat().st_mtime > manifest.stat().st_mtime:
        d = np.load(cache)
        return d["logits"], d["labels"]
    ds = ManifestDataset(read_manifest(manifest), ckpt["labels"], eval_transform(ckpt["img_size"]))
    logits, labels = collect_logits(model, make_loader(ds, batch_size, workers, train=False), device)
    if cache:
        cache.parent.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(cache, logits=logits, labels=labels)
    return logits, labels


def plot_confusion(cm: np.ndarray, names: list[str], path: Path, title: str) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    with np.errstate(invalid="ignore", divide="ignore"):
        norm = np.nan_to_num(cm / cm.sum(axis=1, keepdims=True))
    short = [n.replace("___", ": ").replace("_", " ")[:38] for n in names]
    fig, ax = plt.subplots(figsize=(16, 14))
    im = ax.imshow(norm, cmap="Greens", vmin=0, vmax=1)
    ax.set_xticks(range(len(names)), short, rotation=90, fontsize=7)
    ax.set_yticks(range(len(names)), short, fontsize=7)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    ax.set_title(title)
    fig.colorbar(im, fraction=0.03)
    fig.tight_layout()
    fig.savefig(path, dpi=130)
    plt.close(fig)


def evaluate_split(name: str, logits: np.ndarray, labels: np.ndarray, names: list[str], out: Path, temperature=1.0):
    out.mkdir(parents=True, exist_ok=True)
    preds = logits.argmax(1)
    cm = confusion_matrix(preds, labels, len(names))
    recall = per_class_recall(cm)
    present = cm.sum(axis=1) > 0

    with open(out / "confusion_matrix.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["true\\pred", *names])
        for n, row in zip(names, cm, strict=True):
            w.writerow([n, *row.tolist()])
    plot_confusion(cm, names, out / "confusion_matrix.png", f"{name} (n={len(labels)})")

    result = {
        "n": int(len(labels)),
        "accuracy": accuracy(logits, labels),
        "top3_accuracy": topk_accuracy(logits, labels, 3),
        # Mean recall over classes present in this split — robust to class imbalance.
        "balanced_accuracy": float(np.nanmean(recall[present])) if present.any() else 0.0,
        "ece": expected_calibration_error(softmax(logits, temperature), labels),
        "temperature": temperature,
        "per_class_recall": {names[i]: float(recall[i]) for i in range(len(names)) if present[i]},
        "top_confusions": top_confusions(cm, names, 15),
    }
    (out / "metrics.json").write_text(json.dumps(result, indent=2))
    return result


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--splits", default="data/splits")
    ap.add_argument("--out", help="Defaults to <checkpoint dir>/eval")
    ap.add_argument("--calibration", help="calibration.json to report calibrated ECE (default: next to checkpoint)")
    ap.add_argument("--batch-size", type=int, default=128)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--device", default="auto")
    args = ap.parse_args(argv)

    device = pick_device(args.device)
    model, ckpt = load_checkpoint(args.checkpoint, device)
    run_dir = Path(args.checkpoint).parent
    out = Path(args.out) if args.out else run_dir / "eval"
    cal_path = Path(args.calibration) if args.calibration else run_dir / "calibration.json"
    temperature = json.loads(cal_path.read_text())["temperature"] if cal_path.exists() else 1.0

    report = {}
    for split in EVAL_SPLITS:
        manifest = Path(args.splits) / f"{split}.csv"
        if not manifest.exists() or split in {"val", "plantdoc_train"}:
            continue
        logits, labels = logits_for_split(
            model, ckpt, manifest, device, args.batch_size, args.workers, cache_dir=run_dir / "logits"
        )
        r = evaluate_split(split, logits, labels, ckpt["labels"], out / split, temperature)
        report[split] = {k: r[k] for k in ("n", "accuracy", "top3_accuracy", "balanced_accuracy", "ece")}
        print(f"{split:>14}: acc {r['accuracy']:.3f}  top3 {r['top3_accuracy']:.3f}  n={r['n']}")
        for c in r["top_confusions"][:5]:
            print(f"{'':>16}{c['true']} → {c['predicted']}: {c['count']} ({c['rate']:.0%})")

    (out / "report.json").write_text(json.dumps(report, indent=2))
    print(f"Report → {out / 'report.json'}")


if __name__ == "__main__":
    main()
