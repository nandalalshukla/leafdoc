"""Copy exported models into the mobile app and switch its bundled-model references on."""

from __future__ import annotations

import re
import shutil
from pathlib import Path

from . import BUNDLED_MODELS_TS, MODEL_ASSET_DIR

_CLASSIFIER_RE = re.compile(r"export const BUNDLED_CLASSIFIER: number \| null = .*?;")
_DETECTOR_RE = re.compile(r"export const BUNDLED_DETECTOR: number \| null = .*?;")


def rewrite_bundled_models(source: str, *, classifier: bool | None = None, detector: bool | None = None) -> str:
    """Return `bundledModels.ts` source with the requested entries switched to `require()` or `null`."""
    if classifier is not None:
        value = "require('../../assets/model/leafdoc.onnx')" if classifier else "null"
        source, n = _CLASSIFIER_RE.subn(f"export const BUNDLED_CLASSIFIER: number | null = {value};", source)
        if n != 1:
            raise ValueError("BUNDLED_CLASSIFIER declaration not found")
    if detector is not None:
        value = "require('../../assets/model/leaf-detector.onnx')" if detector else "null"
        source, n = _DETECTOR_RE.subn(f"export const BUNDLED_DETECTOR: number | null = {value};", source)
        if n != 1:
            raise ValueError("BUNDLED_DETECTOR declaration not found")
    return source


def install(
    model: Path, meta: Path, *, kind: str, asset_dir: Path = MODEL_ASSET_DIR, ts_file: Path = BUNDLED_MODELS_TS
) -> None:
    if kind not in {"classifier", "detector"}:
        raise ValueError(kind)
    asset_dir.mkdir(parents=True, exist_ok=True)
    model_name, meta_name = (
        ("leafdoc.onnx", "model-meta.json") if kind == "classifier" else ("leaf-detector.onnx", "detector-meta.json")
    )
    shutil.copyfile(model, asset_dir / model_name)
    shutil.copyfile(meta, asset_dir / meta_name)
    src = ts_file.read_text()
    ts_file.write_text(rewrite_bundled_models(src, **{kind: True}))
    print(f"Installed {kind} → {asset_dir / model_name} and enabled it in {ts_file.name}")
