import pytest

from leafdoc_train import BUNDLED_MODELS_TS
from leafdoc_train.install import install, rewrite_bundled_models


def test_rewrite_enables_and_disables_models():
    src = BUNDLED_MODELS_TS.read_text()
    on = rewrite_bundled_models(src, classifier=True)
    assert "BUNDLED_CLASSIFIER: number | null = require('../../assets/model/leafdoc.onnx');" in on
    assert "BUNDLED_DETECTOR: number | null = null;" in on
    both = rewrite_bundled_models(on, detector=True)
    assert "require('../../assets/model/leaf-detector.onnx')" in both
    assert rewrite_bundled_models(both, classifier=False, detector=False) == src


def test_rewrite_fails_loudly_on_unexpected_source():
    with pytest.raises(ValueError):
        rewrite_bundled_models("export const X = 1;", classifier=True)


def test_install_copies_files_and_updates_ts(tmp_path):
    model, meta = tmp_path / "m.onnx", tmp_path / "meta.json"
    model.write_bytes(b"onnx")
    meta.write_text("{}")
    ts = tmp_path / "bundledModels.ts"
    ts.write_text(BUNDLED_MODELS_TS.read_text())
    assets = tmp_path / "assets"
    install(model, meta, kind="classifier", asset_dir=assets, ts_file=ts)
    assert (assets / "leafdoc.onnx").read_bytes() == b"onnx"
    assert (assets / "model-meta.json").exists()
    assert "require('../../assets/model/leafdoc.onnx')" in ts.read_text()
