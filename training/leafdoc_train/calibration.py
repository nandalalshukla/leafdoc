"""Temperature scaling, calibration error and the 'not sure' threshold (pure numpy)."""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass

import numpy as np


def softmax(logits: np.ndarray, temperature: float = 1.0) -> np.ndarray:
    z = logits.astype(np.float64) / temperature
    z -= z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)


def nll(logits: np.ndarray, labels: np.ndarray, temperature: float) -> float:
    z = logits.astype(np.float64) / temperature
    z -= z.max(axis=1, keepdims=True)
    log_probs = z - np.log(np.exp(z).sum(axis=1, keepdims=True))
    return float(-log_probs[np.arange(len(labels)), labels].mean())


def fit_temperature(logits: np.ndarray, labels: np.ndarray, lo: float = 0.05, hi: float = 20.0) -> float:
    """
    Find T minimising validation NLL (Guo et al., 2017). NLL is unimodal in log T,
    so a golden-section search over log T is exact enough and dependency-free.
    """
    if len(labels) == 0:
        return 1.0
    a, b = math.log(lo), math.log(hi)
    g = (math.sqrt(5) - 1) / 2
    c, d = b - g * (b - a), a + g * (b - a)
    fc, fd = nll(logits, labels, math.exp(c)), nll(logits, labels, math.exp(d))
    for _ in range(80):
        if fc < fd:
            b, d, fd = d, c, fc
            c = b - g * (b - a)
            fc = nll(logits, labels, math.exp(c))
        else:
            a, c, fc = c, d, fd
            d = a + g * (b - a)
            fd = nll(logits, labels, math.exp(d))
    return float(math.exp((a + b) / 2))


def expected_calibration_error(probs: np.ndarray, labels: np.ndarray, n_bins: int = 15) -> float:
    conf = probs.max(axis=1)
    correct = probs.argmax(axis=1) == labels
    edges = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    for lo, hi in zip(edges[:-1], edges[1:], strict=True):
        mask = (conf > lo) & (conf <= hi)
        if mask.any():
            ece += mask.mean() * abs(correct[mask].mean() - conf[mask].mean())
    return float(ece)


def reliability_bins(probs: np.ndarray, labels: np.ndarray, n_bins: int = 15):
    conf = probs.max(axis=1)
    correct = probs.argmax(axis=1) == labels
    edges = np.linspace(0, 1, n_bins + 1)
    rows = []
    for lo, hi in zip(edges[:-1], edges[1:], strict=True):
        mask = (conf > lo) & (conf <= hi)
        rows.append(
            {
                "lo": float(lo),
                "hi": float(hi),
                "count": int(mask.sum()),
                "confidence": float(conf[mask].mean()) if mask.any() else None,
                "accuracy": float(correct[mask].mean()) if mask.any() else None,
            }
        )
    return rows


@dataclass
class ThresholdChoice:
    threshold: float
    coverage: float  # fraction of photos that get a confident answer
    accuracy: float  # accuracy on those photos
    target_accuracy: float


def choose_threshold(
    probs: np.ndarray,
    labels: np.ndarray,
    target_accuracy: float = 0.9,
    floor: float = 0.4,
    ceiling: float = 0.95,
) -> ThresholdChoice:
    """
    Lowest confidence threshold such that predictions at or above it are at least
    `target_accuracy` correct. Below it the app says "not sure, retake".
    Falls back to `ceiling` if the target is unreachable.
    """
    conf = probs.max(axis=1)
    correct = probs.argmax(axis=1) == labels
    for t in np.round(np.arange(floor, ceiling + 1e-9, 0.01), 2):
        mask = conf >= t
        if mask.sum() == 0:
            break
        acc = float(correct[mask].mean())
        if acc >= target_accuracy:
            return ThresholdChoice(float(t), float(mask.mean()), acc, target_accuracy)
    mask = conf >= ceiling
    acc = float(correct[mask].mean()) if mask.any() else 0.0
    return ThresholdChoice(float(ceiling), float(mask.mean()), acc, target_accuracy)


def calibration_report(logits: np.ndarray, labels: np.ndarray, target_accuracy: float = 0.9) -> dict:
    t = fit_temperature(logits, labels)
    before = softmax(logits)
    after = softmax(logits, t)
    choice = choose_threshold(after, labels, target_accuracy)
    return {
        "temperature": t,
        "nll_before": nll(logits, labels, 1.0),
        "nll_after": nll(logits, labels, t),
        "ece_before": expected_calibration_error(before, labels),
        "ece_after": expected_calibration_error(after, labels),
        "threshold": asdict(choice),
        "reliability_after": reliability_bins(after, labels),
        "n": int(len(labels)),
    }
