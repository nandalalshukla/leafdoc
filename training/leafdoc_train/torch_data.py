"""PyTorch dataset and loaders built from CSV manifests."""

from __future__ import annotations

from collections import Counter
from collections.abc import Callable

import torch
from PIL import Image, ImageFile
from torch.utils.data import DataLoader, Dataset, WeightedRandomSampler

from .data import Sample

ImageFile.LOAD_TRUNCATED_IMAGES = True


class ManifestDataset(Dataset):
    def __init__(self, samples: list[Sample], labels: list[str], transform: Callable):
        index = {name: i for i, name in enumerate(labels)}
        unknown = {s.label for s in samples} - index.keys()
        if unknown:
            raise ValueError(f"Manifest contains unknown labels: {sorted(unknown)}")
        self.samples = samples
        self.targets = [index[s.label] for s in samples]
        self.transform = transform

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, i: int):
        with Image.open(self.samples[i].path) as im:
            img = im.convert("RGB")
        return self.transform(img), self.targets[i]


def balanced_sampler(targets: list[int], num_samples: int | None = None) -> WeightedRandomSampler:
    """Sample classes evenly; PlantVillage ranges from ~150 to ~5,500 images per class."""
    counts = Counter(targets)
    weights = torch.tensor([1.0 / counts[t] for t in targets], dtype=torch.double)
    return WeightedRandomSampler(weights, num_samples or len(targets), replacement=True)


def make_loader(
    ds: ManifestDataset, batch_size: int, workers: int, *, train: bool, balanced: bool = False
) -> DataLoader:
    sampler = balanced_sampler(ds.targets) if train and balanced else None
    return DataLoader(
        ds,
        batch_size=batch_size,
        shuffle=train and sampler is None,
        sampler=sampler,
        num_workers=workers,
        pin_memory=torch.cuda.is_available(),
        drop_last=train,
        persistent_workers=workers > 0,
    )
