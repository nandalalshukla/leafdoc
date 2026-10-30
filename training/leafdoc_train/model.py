"""Model construction, freezing helpers and checkpoint IO."""

from __future__ import annotations

from pathlib import Path

import timm
import torch
from torch import nn


def build_model(arch: str, num_classes: int, pretrained: bool = True, drop_rate: float = 0.2) -> nn.Module:
    """timm backbone with ImageNet weights and a fresh classification head."""
    return timm.create_model(arch, pretrained=pretrained, num_classes=num_classes, drop_rate=drop_rate)


def head_parameters(model: nn.Module) -> list[nn.Parameter]:
    return list(model.get_classifier().parameters())


def set_backbone_trainable(model: nn.Module, trainable: bool) -> None:
    head = {id(p) for p in head_parameters(model)}
    for p in model.parameters():
        p.requires_grad = trainable or id(p) in head


def save_checkpoint(path: Path, model: nn.Module, *, arch: str, labels: list[str], img_size: int, **extra) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    torch.save({"state_dict": model.state_dict(), "arch": arch, "labels": labels, "img_size": img_size, **extra}, path)


def load_checkpoint(path: str | Path, device: str | torch.device = "cpu") -> tuple[nn.Module, dict]:
    ckpt = torch.load(path, map_location=device, weights_only=False)
    model = build_model(ckpt["arch"], len(ckpt["labels"]), pretrained=False)
    model.load_state_dict(ckpt["state_dict"])
    model.to(device).eval()
    return model, ckpt


def pick_device(name: str = "auto") -> torch.device:
    if name != "auto":
        return torch.device(name)
    if torch.cuda.is_available():
        return torch.device("cuda")
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")
