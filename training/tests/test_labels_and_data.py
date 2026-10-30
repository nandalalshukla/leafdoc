from pathlib import Path

import pytest

from leafdoc_train.data import (
    Sample,
    class_counts,
    discover_plantdoc,
    read_manifest,
    stratified_split,
    write_manifest,
)
from leafdoc_train.labels import PLANTDOC_TO_PLANTVILLAGE, plantdoc_to_plantvillage, plantvillage_labels


def test_plantvillage_labels_match_knowledge_base():
    labels = plantvillage_labels()
    assert len(labels) == 38
    assert labels == sorted(labels)
    assert "Tomato___Late_blight" in labels


def test_every_plantdoc_mapping_targets_a_known_label():
    known = set(plantvillage_labels())
    assert set(PLANTDOC_TO_PLANTVILLAGE.values()) <= known


def test_plantdoc_lookup_is_case_and_spacing_tolerant():
    assert plantdoc_to_plantvillage("Tomato leaf late blight") == "Tomato___Late_blight"
    assert plantdoc_to_plantvillage("tomato_leaf_late_blight") == "Tomato___Late_blight"
    assert plantdoc_to_plantvillage("Unknown thing") is None


def _samples(n_per_class: dict[str, int]) -> list[Sample]:
    return [Sample(f"{c}/{i}.jpg", c, "plantvillage") for c, n in n_per_class.items() for i in range(n)]


def test_stratified_split_preserves_class_proportions_and_is_disjoint():
    samples = _samples({"A": 100, "B": 50, "C": 3})
    s = stratified_split(samples, 0.1, 0.1, seed=1)
    assert class_counts(s["test"]) == {"A": 10, "B": 5, "C": 1}
    assert class_counts(s["val"]) == {"A": 10, "B": 5, "C": 1}
    paths = [x.path for part in s.values() for x in part]
    assert len(paths) == len(set(paths)) == len(samples)


def test_stratified_split_is_deterministic():
    samples = _samples({"A": 40, "B": 40})
    assert stratified_split(samples, seed=7) == stratified_split(samples, seed=7)
    assert stratified_split(samples, seed=7) != stratified_split(samples, seed=8)


def test_stratified_split_rejects_bad_fractions():
    with pytest.raises(ValueError):
        stratified_split([], 0.6, 0.5)


def test_manifest_round_trip(tmp_path: Path):
    samples = _samples({"A": 3})
    p = tmp_path / "m.csv"
    assert write_manifest(p, samples) == 3
    assert read_manifest(p) == samples


def test_discover_plantdoc_maps_and_skips(tmp_path: Path):
    for folder in ["Tomato leaf late blight", "Tomato leaf", "Some unmapped class"]:
        (tmp_path / folder).mkdir()
        (tmp_path / folder / "x.jpg").write_bytes(b"")
    samples, skipped = discover_plantdoc(tmp_path)
    assert sorted(s.label for s in samples) == ["Tomato___Late_blight", "Tomato___healthy"]
    assert skipped == ["Some unmapped class"]
