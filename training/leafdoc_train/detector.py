"""
Optional YOLOv8n leaf detector: crops the leaf first when a photo shows the whole plant.

Train on any single-class "leaf" dataset in YOLO format (e.g. PlantDoc's bounding
boxes with all classes merged into one, or your own labelled photos):

    pip install ultralytics
    python -m leafdoc_train.detector train --data data/leaves.yaml --epochs 60
    python -m leafdoc_train.detector export --weights runs/detect/train/weights/best.pt --install

The app reads the raw `[1, 5, N]` output (cx, cy, w, h, score) and keeps the best box.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .install import install

IMG_SIZE = 320


def train(args) -> None:
    from ultralytics import YOLO

    YOLO(args.base).train(
        data=args.data, imgsz=IMG_SIZE, epochs=args.epochs, batch=args.batch, single_cls=True, project=args.project
    )


def export(args) -> None:
    import numpy as np
    import onnxruntime as ort
    from ultralytics import YOLO

    weights = Path(args.weights)
    onnx_path = Path(YOLO(str(weights)).export(format="onnx", imgsz=IMG_SIZE, opset=12, simplify=True, nms=False))

    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    inp, out = sess.get_inputs()[0], sess.get_outputs()[0]
    y = sess.run(None, {inp.name: np.zeros((1, 3, IMG_SIZE, IMG_SIZE), np.float32)})[0]
    if y.ndim != 3 or y.shape[1] != 5:
        raise SystemExit(f"Expected a single-class [1, 5, N] output, got {y.shape}. Train with single_cls=True.")

    meta = {
        "schemaVersion": 1,
        "modelVersion": args.version or weights.parent.parent.name,
        "architecture": "yolov8n",
        "inputName": inp.name,
        "outputName": out.name,
        "inputSize": IMG_SIZE,
        "scoreThreshold": args.score_threshold,
        "boxPadding": 0.08,
        "minBoxFraction": 0.15,
    }
    meta_path = onnx_path.with_name("detector-meta.json")
    meta_path.write_text(json.dumps(meta, indent=2) + "\n")
    print(f"Exported {onnx_path} ({onnx_path.stat().st_size / 1e6:.1f} MB), output {y.shape}")
    if args.install:
        install(onnx_path, meta_path, kind="detector")


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    t = sub.add_parser("train")
    t.add_argument("--data", required=True, help="YOLO dataset YAML")
    t.add_argument("--base", default="yolov8n.pt")
    t.add_argument("--epochs", type=int, default=60)
    t.add_argument("--batch", type=int, default=32)
    t.add_argument("--project", default="runs/detect")
    e = sub.add_parser("export")
    e.add_argument("--weights", required=True)
    e.add_argument("--version")
    e.add_argument("--score-threshold", type=float, default=0.35)
    e.add_argument("--install", action="store_true")
    args = ap.parse_args(argv)
    {"train": train, "export": export}[args.cmd](args)


if __name__ == "__main__":
    main()
