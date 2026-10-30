"""
Export the classifier to ONNX, verify it against PyTorch with ONNX Runtime, and
write the metadata the app needs (labels, normalisation, temperature, threshold).

    python -m leafdoc_train.export_onnx --checkpoint runs/mnv3/best.pt --install

--install copies leafdoc.onnx + model-meta.json into mobile/assets/model and
switches mobile/src/ml/bundledModels.ts to bundle it.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from . import IMAGENET_MEAN, IMAGENET_STD
from .install import install


def build_meta(ckpt: dict, calibration: dict | None, eval_report: dict | None, version: str) -> dict:
    metrics: dict[str, float] = {}
    if eval_report:
        if "test" in eval_report:
            metrics["plantVillageTestAccuracy"] = eval_report["test"]["accuracy"]
        if "plantdoc_test" in eval_report:
            metrics["plantDocTestAccuracy"] = eval_report["plantdoc_test"]["accuracy"]
        if "custom_test" in eval_report:
            metrics["customTestAccuracy"] = eval_report["custom_test"]["accuracy"]
    if calibration:
        metrics["eceBefore"] = calibration["ece_before"]
        metrics["eceAfter"] = calibration["ece_after"]
        metrics["thresholdCoverage"] = calibration["threshold"]["coverage"]
        metrics["thresholdAccuracy"] = calibration["threshold"]["accuracy"]
    return {
        "schemaVersion": 1,
        "modelVersion": version,
        "architecture": ckpt["arch"],
        "inputName": "input",
        "outputName": "logits",
        "inputSize": ckpt["img_size"],
        "cropFraction": 0.875,
        "mean": list(IMAGENET_MEAN),
        "std": list(IMAGENET_STD),
        "temperature": calibration["temperature"] if calibration else 1.0,
        "confidenceThreshold": calibration["threshold"]["threshold"] if calibration else 0.6,
        "minMargin": 0.15,
        "calibrated": calibration is not None,
        "metrics": metrics or None,
        "labels": ckpt["labels"],
    }


def export(model, img_size: int, path: Path, opset: int = 17) -> None:
    import torch

    dummy = torch.randn(1, 3, img_size, img_size)
    kwargs = dict(
        input_names=["input"],
        output_names=["logits"],
        opset_version=opset,
        dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}},
    )
    try:
        torch.onnx.export(model, dummy, str(path), dynamo=False, **kwargs)
    except TypeError:  # older torch without the `dynamo` flag
        torch.onnx.export(model, dummy, str(path), **kwargs)


def verify(model, onnx_path: Path, img_size: int, atol: float = 1e-3) -> float:
    import onnx
    import onnxruntime as ort
    import torch

    onnx.checker.check_model(onnx.load(str(onnx_path)))
    x = torch.randn(2, 3, img_size, img_size)
    with torch.no_grad():
        ref = model(x).numpy()
    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    got = sess.run(["logits"], {"input": x.numpy()})[0]
    diff = float(np.abs(ref - got).max())
    if diff > atol:
        raise RuntimeError(f"ONNX output differs from PyTorch by {diff:.2e} (> {atol})")
    return diff


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--out", help="Output folder (default: <run>/export)")
    ap.add_argument("--version", help="Model version string (default: <arch>-<date>)")
    ap.add_argument("--opset", type=int, default=17)
    ap.add_argument("--install", action="store_true", help="Copy into the mobile app and enable bundling")
    ap.add_argument("--allow-uncalibrated", action="store_true")
    args = ap.parse_args(argv)

    from .model import load_checkpoint

    model, ckpt = load_checkpoint(args.checkpoint, "cpu")
    run_dir = Path(args.checkpoint).parent
    out = Path(args.out) if args.out else run_dir / "export"
    out.mkdir(parents=True, exist_ok=True)

    cal_path, eval_path = run_dir / "calibration.json", run_dir / "eval" / "report.json"
    calibration = json.loads(cal_path.read_text()) if cal_path.exists() else None
    eval_report = json.loads(eval_path.read_text()) if eval_path.exists() else None
    if calibration is None and not args.allow_uncalibrated:
        raise SystemExit("No calibration.json found. Run leafdoc_train.calibrate first or pass --allow-uncalibrated.")

    version = args.version or f"{ckpt['arch']}-{datetime.now(timezone.utc):%Y%m%d}"
    onnx_path, meta_path = out / "leafdoc.onnx", out / "model-meta.json"
    export(model, ckpt["img_size"], onnx_path, args.opset)
    diff = verify(model, onnx_path, ckpt["img_size"])
    meta_path.write_text(json.dumps(build_meta(ckpt, calibration, eval_report, version), indent=2) + "\n")
    size_mb = onnx_path.stat().st_size / 1e6
    print(f"Exported {onnx_path} ({size_mb:.1f} MB), max |torch-onnx| = {diff:.2e}")

    if args.install:
        install(onnx_path, meta_path, kind="classifier")


if __name__ == "__main__":
    main()
