"""LeafDoc training pipeline: data prep, fine-tuning, evaluation, calibration and ONNX export."""

from pathlib import Path

TRAINING_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = TRAINING_ROOT.parent
MOBILE_ROOT = REPO_ROOT / "mobile"
KNOWLEDGE_BASE = MOBILE_ROOT / "src" / "data" / "diseases.json"
MODEL_ASSET_DIR = MOBILE_ROOT / "assets" / "model"
BUNDLED_MODELS_TS = MOBILE_ROOT / "src" / "ml" / "bundledModels.ts"

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)
