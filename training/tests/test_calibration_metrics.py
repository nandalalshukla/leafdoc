import numpy as np

from leafdoc_train.calibration import (
    calibration_report,
    choose_threshold,
    expected_calibration_error,
    fit_temperature,
    softmax,
)
from leafdoc_train.metrics import accuracy, confusion_matrix, per_class_recall, top_confusions, topk_accuracy


def _overconfident(n=4000, k=10, true_t=2.5, seed=0):
    """Logits drawn from a calibrated model, then sharpened by `true_t` to make them overconfident."""
    rng = np.random.default_rng(seed)
    calibrated = rng.normal(0, 1.5, size=(n, k))
    probs = softmax(calibrated)
    labels = np.array([rng.choice(k, p=p) for p in probs])
    return calibrated * true_t, labels


def test_fit_temperature_recovers_known_sharpening():
    logits, labels = _overconfident(true_t=2.5)
    t = fit_temperature(logits, labels)
    assert abs(t - 2.5) < 0.25


def test_temperature_scaling_reduces_ece():
    logits, labels = _overconfident()
    t = fit_temperature(logits, labels)
    before = expected_calibration_error(softmax(logits), labels)
    after = expected_calibration_error(softmax(logits, t), labels)
    assert after < before / 2


def test_choose_threshold_meets_target_accuracy():
    rng = np.random.default_rng(1)
    n = 2000
    conf = rng.uniform(0.3, 1.0, n)
    labels = np.zeros(n, dtype=int)
    correct = rng.uniform(size=n) < conf  # calibrated by construction
    probs = np.stack([np.where(correct, conf, 1 - conf), np.where(correct, 1 - conf, conf)], axis=1)
    choice = choose_threshold(probs, labels, target_accuracy=0.9)
    mask = probs.max(1) >= choice.threshold
    assert (probs.argmax(1)[mask] == 0).mean() >= 0.9
    assert 0 < choice.coverage < 1


def test_calibration_report_fields():
    logits, labels = _overconfident(n=500)
    r = calibration_report(logits, labels)
    assert r["nll_after"] <= r["nll_before"] + 1e-9
    assert {"temperature", "ece_before", "ece_after", "threshold", "reliability_after"} <= r.keys()


def test_metrics():
    logits = np.array([[3, 1, 0], [0, 2, 1], [0, 1, 2], [2, 0, 1]], dtype=float)
    labels = np.array([0, 1, 1, 2])
    assert accuracy(logits, labels) == 0.5
    assert topk_accuracy(logits, labels, 2) == 1.0
    cm = confusion_matrix(logits.argmax(1), labels, 3)
    assert cm.tolist() == [[1, 0, 0], [0, 1, 1], [1, 0, 0]]
    assert np.allclose(per_class_recall(cm), [1.0, 0.5, 0.0])
    tc = top_confusions(cm, ["a", "b", "c"])
    assert {(c["true"], c["predicted"]) for c in tc} == {("b", "c"), ("c", "a")}
