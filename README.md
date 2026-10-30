# LeafDoc 🌿

**Photograph a sick leaf, get the likely disease and what to do.**

Home gardeners, terrace farmers and small farmers often see spots or yellowing without knowing the cause.
Experts aren't always available, and the wrong pesticide wastes money and harms the plant. LeafDoc is a
React Native (Expo) app that diagnoses 38 crop/disease classes **on the phone, offline**. It gives cause,
symptoms, organic and chemical remedies and prevention, and it says *"not sure — retake"* when it should.

| | |
|---|---|
| `mobile/` | Expo SDK 58 app (TypeScript, expo-router, ONNX Runtime React Native) |
| `training/` | PyTorch + timm pipeline: data prep, fine-tuning, honest evaluation, calibration, ONNX export |

## How it works

```
photo ─► (optional YOLOv8n leaf crop | centre crop) ─► 224×224, ImageNet-normalised
      ─► MobileNetV3-Large (ONNX, on-device) ─► logits ÷ T (temperature) ─► softmax ─► top-3
      ─► photo-quality + confidence gate ─┬─► confident: disease, cause, organic/chemical remedy, prevention
                                          └─► unsure / retake: closest matches + photo tips
```

- **Classifier**: MobileNetV3-Large (or EfficientNet-B0) fine-tuned on PlantVillage. Head-only training first,
  then full fine-tuning at a low LR, with heavy augmentation.
- **Honest evaluation** on PlantDoc field photos and your own photos, with a confusion matrix and the
  most-confused pairs.
- **Calibration**: temperature scaling, so 80% confidence ≈ 80% correct. The "not sure" threshold is chosen
  for ≥90% accuracy on the answers the app does give.
- **Photo-quality gate**: exposure, blur (Laplacian variance) and leaf coverage, so bad photos get
  *"retake"* instead of a guess.
- **Knowledge base**: `mobile/src/data/diseases.json` has an entry for every class. The training pipeline
  reads its labels too, so the model and the app can't drift apart.
- **Private and offline**: no network calls during diagnosis. History stays on the device and can be
  turned off.

## Quick start

### 1. Train and install a model (see `training/README.md`)

```bash
cd training
pip install -r requirements-dev.txt
```

```bash
./scripts/download_data.sh data
```

```bash
python -m leafdoc_train.prepare_data --plantvillage data/PlantVillage-Dataset/raw/color --plantdoc data/PlantDoc-Dataset
```

```bash
python -m leafdoc_train.train --balanced --plantdoc-mix 3
```

```bash
python -m leafdoc_train.calibrate --checkpoint runs/mobilenetv3/best.pt
```

```bash
python -m leafdoc_train.evaluate --checkpoint runs/mobilenetv3/best.pt
```

```bash
python -m leafdoc_train.export_onnx --checkpoint runs/mobilenetv3/best.pt --install
```

### 2. Run the app

ONNX Runtime is a native module, so use a development build. Expo Go won't work.

```bash
cd mobile
npm install
```

```bash
npx expo run:android
```

Or build in the cloud:

```bash
npx eas-cli@latest build --profile development --platform android
```

Without a model the app still runs: it shows "Model not installed" on the scan screen, and the disease guide
works.

### Checks

```bash
cd mobile && npx tsc --noEmit && npx eslint . && npx jest
```

```bash
cd training && ruff check . && pytest -q
```

CI (`.github/workflows/ci.yml`) runs both on every push.

## Release builds

```bash
cd mobile
npx eas-cli@latest build --profile production --platform all
```

```bash
npx eas-cli@latest submit --profile production
```

Bundle identifiers are `com.leafdoc.app` (change them in `mobile/app.json` before publishing).

## Disclaimer

LeafDoc gives a likely diagnosis from a photo, not a lab test. Confirm with a local agricultural extension
officer before spending on chemicals, and always follow the product label.
