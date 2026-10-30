"""Image transforms. Training augmentations simulate messy phone photos; eval mirrors the app."""

from __future__ import annotations

from torchvision import transforms as T

from . import IMAGENET_MEAN, IMAGENET_STD


def train_transform(size: int = 224) -> T.Compose:
    return T.Compose(
        [
            # Random crops/zoom: users rarely frame the leaf like PlantVillage's lab shots.
            T.RandomResizedCrop(size, scale=(0.35, 1.0), ratio=(0.75, 1.33)),
            T.RandomHorizontalFlip(),
            T.RandomVerticalFlip(),
            T.RandomApply([T.RandomRotation(25)], p=0.5),
            # Lighting and white balance vary hugely outdoors.
            T.RandomApply([T.ColorJitter(brightness=0.4, contrast=0.4, saturation=0.35, hue=0.04)], p=0.8),
            # Hand shake and soft focus.
            T.RandomApply([T.GaussianBlur(kernel_size=7, sigma=(0.1, 2.5))], p=0.3),
            T.RandomApply([T.RandomPerspective(distortion_scale=0.25, p=1.0)], p=0.2),
            T.RandomGrayscale(p=0.02),
            T.ToTensor(),
            T.Normalize(IMAGENET_MEAN, IMAGENET_STD),
            # Occlusion by fingers, other leaves, glare.
            T.RandomErasing(p=0.25, scale=(0.02, 0.12)),
        ]
    )


def eval_transform(size: int = 224, crop_fraction: float = 0.875) -> T.Compose:
    """Resize shorter side to size/crop_fraction, centre-crop `size` — identical to the app's preprocessing."""
    return T.Compose(
        [
            T.Resize(round(size / crop_fraction)),
            T.CenterCrop(size),
            T.ToTensor(),
            T.Normalize(IMAGENET_MEAN, IMAGENET_STD),
        ]
    )
