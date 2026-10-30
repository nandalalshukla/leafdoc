"""Class labels shared with the mobile app's knowledge base."""

from __future__ import annotations

import json
import re
from functools import lru_cache

from . import KNOWLEDGE_BASE


@lru_cache(maxsize=1)
def knowledge_base() -> dict:
    with open(KNOWLEDGE_BASE, encoding="utf-8") as f:
        return json.load(f)


def plantvillage_labels() -> list[str]:
    """All 38 PlantVillage folder names, sorted exactly like torchvision's ImageFolder."""
    return sorted(c["label"] for c in knowledge_base()["classes"])


# PlantDoc (Singh et al., 2020) uses its own folder names for real field photos.
# Map each one onto the PlantVillage label the app understands. PlantDoc classes
# with no PlantVillage equivalent are deliberately absent and skipped.
PLANTDOC_TO_PLANTVILLAGE: dict[str, str] = {
    "Apple Scab Leaf": "Apple___Apple_scab",
    "Apple leaf": "Apple___healthy",
    "Apple rust leaf": "Apple___Cedar_apple_rust",
    "Bell_pepper leaf": "Pepper,_bell___healthy",
    "Bell_pepper leaf spot": "Pepper,_bell___Bacterial_spot",
    "Blueberry leaf": "Blueberry___healthy",
    "Cherry leaf": "Cherry_(including_sour)___healthy",
    "Corn Gray leaf spot": "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
    "Corn leaf blight": "Corn_(maize)___Northern_Leaf_Blight",
    "Corn rust leaf": "Corn_(maize)___Common_rust_",
    "Peach leaf": "Peach___healthy",
    "Potato leaf early blight": "Potato___Early_blight",
    "Potato leaf late blight": "Potato___Late_blight",
    "Potato leaf": "Potato___healthy",
    "Raspberry leaf": "Raspberry___healthy",
    "Soyabean leaf": "Soybean___healthy",
    "Squash Powdery mildew leaf": "Squash___Powdery_mildew",
    "Strawberry leaf": "Strawberry___healthy",
    "Tomato Early blight leaf": "Tomato___Early_blight",
    "Tomato Septoria leaf spot": "Tomato___Septoria_leaf_spot",
    "Tomato leaf": "Tomato___healthy",
    "Tomato leaf bacterial spot": "Tomato___Bacterial_spot",
    "Tomato leaf late blight": "Tomato___Late_blight",
    "Tomato leaf mosaic virus": "Tomato___Tomato_mosaic_virus",
    "Tomato leaf yellow virus": "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
    "Tomato mold leaf": "Tomato___Leaf_Mold",
    "Tomato two spotted spider mites leaf": "Tomato___Spider_mites Two-spotted_spider_mite",
    "grape leaf": "Grape___healthy",
    "grape leaf black rot": "Grape___Black_rot",
}


def _norm(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", name.lower()).strip()


_PLANTDOC_NORMALISED = {_norm(k): v for k, v in PLANTDOC_TO_PLANTVILLAGE.items()}


def plantdoc_to_plantvillage(folder: str) -> str | None:
    """Resolve a PlantDoc folder name (case/spacing tolerant) to a PlantVillage label, if one exists."""
    return _PLANTDOC_NORMALISED.get(_norm(folder))
