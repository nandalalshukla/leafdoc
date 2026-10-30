"""
Temperature-scale the classifier so "80% confident" really means ~80% correct,
then pick the threshold below which the app says "not sure — retake".

    python -m leafdoc_train.calibrate --checkpoint runs/mnv3/best.pt --splits data/splits

Calibration data, in order of preference:
  * PlantDoc *train* field photos (closest to real use; PlantDoc *test* stays untouched)
  * PlantVillage val
Use --source to force one. Writes <run>/calibration.json and reliability.png.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from .calibration import calibration_report


def plot_reliability(bins: list[dict], path: Path, title: str) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    xs = [(b["lo"] + b["hi"]) / 2 for b in bins if b["count"]]
    acc = [b["accuracy"] for b in bins if b["count"]]
    fig, ax = plt.subplots(figsize=(5, 5))
    ax.plot([0, 1], [0, 1], "--", color="grey", label="perfect")
    ax.bar(xs, acc, width=1 / len(bins), edgecolor="black", alpha=0.75, color="#2E7D32", label="accuracy")
    ax.set_xlabel("Confidence")
    ax.set_ylabel("Accuracy")
    ax.set_title(title)
    ax.legend()
    fig.tight_layout()
    fig.savefig(path, dpi=130)
    plt.close(fig)


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--splits", default="data/splits")
    ap.add_argument("--source", choices=["auto", "val", "plantdoc_train", "both"], default="auto")
    ap.add_argument("--target-accuracy", type=float, default=0.9, help="Accuracy required above the threshold")
    ap.add_argument("--batch-size", type=int, default=128)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--device", default="auto")
    args = ap.parse_args(argv)

    # Torch-dependent imports kept local so the numpy core stays importable without torch.
    from .evaluate import logits_for_split
    from .model import load_checkpoint, pick_device

    device = pick_device(args.device)
    model, ckpt = load_checkpoint(args.checkpoint, device)
    run_dir = Path(args.checkpoint).parent
    splits = Path(args.splits)

    pd = splits / "plantdoc_train.csv"
    if args.source == "auto":
        sources = ["plantdoc_train"] if pd.exists() else ["val"]
    elif args.source == "both":
        sources = ["val", "plantdoc_train"]
    else:
        sources = [args.source]

    all_logits, all_labels = [], []
    for s in sources:
        lg, lb = logits_for_split(
            model, ckpt, splits / f"{s}.csv", device, args.batch_size, args.workers, cache_dir=run_dir / "logits"
        )
        all_logits.append(lg)
        all_labels.append(lb)
    logits, labels = np.concatenate(all_logits), np.concatenate(all_labels)

    report = calibration_report(logits, labels, args.target_accuracy)
    report["sources"] = sources
    (run_dir / "calibration.json").write_text(json.dumps(report, indent=2))
    plot_reliability(report["reliability_after"], run_dir / "reliability.png", f"After T={report['temperature']:.2f}")

    th = report["threshold"]
    print(f"Temperature: {report['temperature']:.3f}   ECE {report['ece_before']:.3f} → {report['ece_after']:.3f}")
    print(
        f"'Not sure' below {th['threshold']:.2f}: answers {th['coverage']:.0%} of photos "
        f"at {th['accuracy']:.1%} accuracy (target {th['target_accuracy']:.0%})"
    )


if __name__ == "__main__":
    main()
