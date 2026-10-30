# LeafDoc training pipeline

Fine-tunes a small ImageNet backbone (MobileNetV3-Large by default, ~5M params / ~17 MB ONNX) to classify
38 PlantVillage crop/disease classes. It then evaluates the model on real field photos, calibrates its confidence
and exports an ONNX model that the mobile app runs fully offline.

```
data ─► prepare_data ─► train (head → full) ─► calibrate ─► evaluate ─► export_onnx --install ─► mobile app
                                                                         (optional) detector ─┘
```

## 0. Setup

```bash
cd training
python -m venv .venv
source .venv/bin/activate
```

```bash
pip install -r requirements-dev.txt
```

A GPU is strongly recommended for training (a free Colab/Kaggle T4 trains in about 1–2 hours). Everything
else runs fine on CPU.

## 1. Dataset

```bash
./scripts/download_data.sh data
```

```bash
python -m leafdoc_train.prepare_data \
  --plantvillage data/PlantVillage-Dataset/raw/color \
  --plantdoc data/PlantDoc-Dataset \
  --out data/splits
```

- **PlantVillage** (~54k lab photos, 38 classes) is split 80/10/10 per class (stratified, seeded).
- **PlantDoc** has real field photos and is much harder. Its classes are mapped onto PlantVillage labels in
  `leafdoc_train/labels.py`; classes with no equivalent are skipped and listed in `data/splits/summary.json`.
  - `plantdoc_train.csv` is used for calibration and, optionally, mixed into training.
  - `plantdoc_test.csv` is **never** trained or calibrated on. It is the honest real-world score.
- Your own phone photos go in PlantVillage-named class folders, passed with `--custom path/`. They're added as
  `custom_test.csv`.

Class names come from the app's knowledge base (`mobile/src/data/diseases.json`), so the model and the app
always agree on labels.

## 2. Transfer learning

```bash
python -m leafdoc_train.train --splits data/splits --out runs/mnv3 --balanced --plantdoc-mix 3
```

- Loads `timm` `mobilenetv3_large_100` with ImageNet weights and replaces the classifier with a fresh
  38-way head.
- **Phase 1**: backbone frozen, head only, 3 epochs at `1e-3`.
- **Phase 2**: everything unfrozen at a low LR (`2e-4`, head ×5) with warm-up and cosine decay, AdamW,
  label smoothing 0.1 and early stopping on validation accuracy.
- `--arch efficientnet_b0` swaps the backbone. `--balanced` evens out class sizes, which range from about
  150 to about 5,500 images. `--plantdoc-mix N` repeats PlantDoc train photos N× to close the
  lab-to-field gap.

## 3. Augmentation

`leafdoc_train/transforms.py` uses random resized crops (35–100% zoom), flips, rotations, colour jitter,
Gaussian blur, perspective changes and random erasing. Real photos are messier than PlantVillage's uniform
backgrounds.

The eval transform (`Resize(256) → CenterCrop(224)`, ImageNet normalisation) is reproduced exactly by the app
(`mobile/src/ml/preprocess.ts`).

## 4. Calibration

```bash
python -m leafdoc_train.calibrate --checkpoint runs/mnv3/best.pt --splits data/splits
```

- Fits a single **temperature** `T` that minimises NLL (Guo et al., 2017), so 80% confidence really means
  about 80% correct. It reports ECE before and after and writes `reliability.png`.
- Chooses the **"not sure" threshold**: the lowest calibrated confidence at which answers are at least 90%
  correct (`--target-accuracy`). Below it the app says *"not sure — retake photo"*.
- Uses PlantDoc train (field photos) when available, otherwise PlantVillage val.

## 5. Honest evaluation

```bash
python -m leafdoc_train.evaluate --checkpoint runs/mnv3/best.pt --splits data/splits
```

For PlantVillage test, PlantDoc test and your own photos, this writes the following to `runs/mnv3/eval/<split>/`:

- accuracy, top-3 accuracy and balanced accuracy, plus calibrated ECE
- per-class recall
- `confusion_matrix.png` / `.csv`
- `top_confusions`: which diseases get mixed up, e.g. early blight vs target spot, or late blight vs leaf mould

Expect around 99% on PlantVillage and a much lower score on PlantDoc. The PlantDoc number is the one that
matters, and the app shows both in **Settings → Model**.

## 6. Export to ONNX and install in the app

```bash
python -m leafdoc_train.export_onnx --checkpoint runs/mnv3/best.pt --install
```

- Exports with a dynamic batch dimension (opset 18) and checks the graph.
- Verifies ONNX Runtime output against PyTorch (max abs diff below `1e-3`).
- Writes `model-meta.json` with the labels in logit order, normalisation, temperature, threshold and metrics.
- `--install` copies both files to `mobile/assets/model/` and switches `mobile/src/ml/bundledModels.ts` to
  bundle the model. Rebuild the app afterwards.

Instead of bundling, you can host `leafdoc.onnx` + `model-meta.json` and set `expo.extra.model.remoteUrl`,
`remoteMetaUrl` and, optionally, `sha256` in `mobile/app.json`. The app downloads them once, verifies the
hash and works offline from then on.

## 7. Optional: YOLOv8n leaf detector (~6 MB)

This crops the leaf first when the photo shows a whole plant. Train it on any single-class leaf dataset in
YOLO format, for example PlantDoc's bounding boxes with all classes merged:

```bash
pip install ultralytics
```

```bash
python -m leafdoc_train.detector train --data data/leaves.yaml --epochs 60
```

```bash
python -m leafdoc_train.detector export --weights runs/detect/train/weights/best.pt --install
```

When it's installed, the app runs the detector first and classifies a padded square around the best leaf. If
it finds no leaf, the app falls back to the centre crop.

## Tests

```bash
pytest -q
```

```bash
ruff check .
```

The numpy core (splits, calibration, metrics, install) is tested without torch. `test_pipeline_smoke.py` runs
train → calibrate → evaluate → export → ONNX parity on a tiny synthetic dataset when torch is installed.
