"""Accuracy, confusion matrix and the most-confused pairs (pure numpy)."""

from __future__ import annotations

import numpy as np


def accuracy(logits: np.ndarray, labels: np.ndarray) -> float:
    return float((logits.argmax(axis=1) == labels).mean()) if len(labels) else 0.0


def topk_accuracy(logits: np.ndarray, labels: np.ndarray, k: int = 3) -> float:
    if not len(labels):
        return 0.0
    top = np.argsort(-logits, axis=1)[:, :k]
    return float((top == labels[:, None]).any(axis=1).mean())


def confusion_matrix(preds: np.ndarray, labels: np.ndarray, n_classes: int) -> np.ndarray:
    cm = np.zeros((n_classes, n_classes), dtype=np.int64)
    np.add.at(cm, (labels, preds), 1)
    return cm


def per_class_recall(cm: np.ndarray) -> np.ndarray:
    support = cm.sum(axis=1)
    with np.errstate(invalid="ignore", divide="ignore"):
        return np.where(support > 0, np.diag(cm) / support, np.nan)


def top_confusions(cm: np.ndarray, class_names: list[str], k: int = 10) -> list[dict]:
    """Largest off-diagonal cells: which true disease gets mistaken for which."""
    off = cm.copy()
    np.fill_diagonal(off, 0)
    flat = np.argsort(-off, axis=None)[:k]
    out = []
    for idx in flat:
        i, j = np.unravel_index(idx, off.shape)
        if off[i, j] == 0:
            break
        out.append(
            {
                "true": class_names[i],
                "predicted": class_names[j],
                "count": int(off[i, j]),
                "rate": float(off[i, j] / max(1, cm[i].sum())),
            }
        )
    return out
