"""End-to-end smoke test on a tiny synthetic dataset: train → evaluate → calibrate → export → ONNX parity."""

import json

import numpy as np
import pytest

torch = pytest.importorskip("torch")
pytest.importorskip("timm")
pytest.importorskip("onnxruntime")

from PIL import Image  # noqa: E402

from leafdoc_train import calibrate, evaluate, export_onnx, train  # noqa: E402
from leafdoc_train.data import Sample, stratified_split, write_manifest  # noqa: E402
from leafdoc_train.labels import plantvillage_labels  # noqa: E402


@pytest.fixture(scope="module")
def tiny_splits(tmp_path_factory):
    root = tmp_path_factory.mktemp("data")
    rng = np.random.default_rng(0)
    samples = []
    for ci, label in enumerate(plantvillage_labels()[:4]):
        d = root / label
        d.mkdir()
        for i in range(10):
            colour = np.array([60 * ci, 255 - 50 * ci, 40 + 30 * ci])
            img = np.clip(colour + rng.normal(0, 20, (64, 64, 3)), 0, 255).astype(np.uint8)
            p = d / f"{i}.png"
            Image.fromarray(img).save(p)
            samples.append(Sample(str(p), label, "plantvillage"))
    splits = stratified_split(samples, 0.2, 0.2, seed=0)
    out = root / "splits"
    for name, items in splits.items():
        write_manifest(out / f"{name}.csv", items)
    return out


def test_full_pipeline(tiny_splits, tmp_path):
    run = tmp_path / "run"
    common = ["--workers", "0", "--device", "cpu"]
    train.main(
        [
            "--splits",
            str(tiny_splits),
            "--out",
            str(run),
            "--arch",
            "mobilenetv3_small_050",
            "--img-size",
            "64",
            "--batch-size",
            "8",
            "--head-epochs",
            "1",
            "--epochs",
            "1",
            "--no-pretrained",
            *common,
        ]
    )
    ckpt = run / "best.pt"
    assert ckpt.exists()

    calibrate.main(["--checkpoint", str(ckpt), "--splits", str(tiny_splits), "--source", "val", *common])
    cal = json.loads((run / "calibration.json").read_text())
    assert cal["temperature"] > 0

    evaluate.main(["--checkpoint", str(ckpt), "--splits", str(tiny_splits), *common])
    report = json.loads((run / "eval" / "report.json").read_text())
    assert "test" in report
    assert (run / "eval" / "test" / "confusion_matrix.png").exists()

    export_onnx.main(["--checkpoint", str(ckpt), "--version", "smoke"])
    meta = json.loads((run / "export" / "model-meta.json").read_text())
    assert meta["labels"] == plantvillage_labels()
    assert meta["inputSize"] == 64 and meta["calibrated"] is True
    assert meta["metrics"]["plantVillageTestAccuracy"] == report["test"]["accuracy"]
    assert (run / "export" / "leafdoc.onnx").stat().st_size > 0
