"""
Fine-tune an ImageNet backbone on PlantVillage in two phases:

1. Head only (backbone frozen) for --head-epochs at --head-lr.
2. Everything unfrozen at a low learning rate with warm-up + cosine decay,
   early-stopped on validation accuracy.

    python -m leafdoc_train.train --splits data/splits --out runs/mnv3
"""

from __future__ import annotations

import argparse
import json
import math
import random
import time
from pathlib import Path

import numpy as np
import torch
from torch import nn
from tqdm import tqdm

from .data import read_manifest
from .labels import plantvillage_labels
from .model import build_model, head_parameters, pick_device, save_checkpoint, set_backbone_trainable
from .torch_data import ManifestDataset, make_loader
from .transforms import eval_transform, train_transform


def seed_everything(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def run_epoch(model, loader, criterion, device, optimizer=None, scheduler=None, scaler=None, desc=""):
    train = optimizer is not None
    model.train(train)
    total, correct, loss_sum = 0, 0, 0.0
    amp = scaler is not None
    with torch.set_grad_enabled(train):
        for x, y in tqdm(loader, desc=desc, leave=False):
            x, y = x.to(device, non_blocking=True), y.to(device, non_blocking=True)
            with torch.autocast(device_type=device.type, enabled=amp):
                logits = model(x)
                loss = criterion(logits, y)
            if train:
                optimizer.zero_grad(set_to_none=True)
                if amp:
                    scaler.scale(loss).backward()
                    scaler.unscale_(optimizer)
                    nn.utils.clip_grad_norm_(model.parameters(), 5.0)
                    scaler.step(optimizer)
                    scaler.update()
                else:
                    loss.backward()
                    nn.utils.clip_grad_norm_(model.parameters(), 5.0)
                    optimizer.step()
                if scheduler is not None:
                    scheduler.step()
            loss_sum += loss.item() * y.size(0)
            correct += (logits.argmax(1) == y).sum().item()
            total += y.size(0)
    return loss_sum / max(1, total), correct / max(1, total)


def warmup_cosine(optimizer, warmup_steps: int, total_steps: int):
    def f(step: int) -> float:
        if step < warmup_steps:
            return (step + 1) / max(1, warmup_steps)
        progress = (step - warmup_steps) / max(1, total_steps - warmup_steps)
        return 0.5 * (1 + math.cos(math.pi * min(1.0, progress)))

    return torch.optim.lr_scheduler.LambdaLR(optimizer, f)


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--splits", default="data/splits")
    ap.add_argument("--out", default="runs/mobilenetv3")
    ap.add_argument("--arch", default="mobilenetv3_large_100", help="e.g. mobilenetv3_large_100, efficientnet_b0")
    ap.add_argument("--img-size", type=int, default=224)
    ap.add_argument("--batch-size", type=int, default=64)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--head-epochs", type=int, default=3)
    ap.add_argument("--head-lr", type=float, default=1e-3)
    ap.add_argument("--epochs", type=int, default=15, help="Full fine-tuning epochs after the head phase")
    ap.add_argument("--lr", type=float, default=2e-4)
    ap.add_argument("--weight-decay", type=float, default=0.05)
    ap.add_argument("--label-smoothing", type=float, default=0.1)
    ap.add_argument("--patience", type=int, default=4)
    ap.add_argument("--balanced", action="store_true", help="Class-balanced sampling")
    ap.add_argument(
        "--plantdoc-mix",
        type=int,
        default=0,
        help="Repeat PlantDoc *train* field photos N times in the training set (0 = PlantVillage only)",
    )
    ap.add_argument("--no-pretrained", action="store_true", help="Random init (for smoke tests only)")
    ap.add_argument("--limit", type=int, default=0, help="Use at most N samples per split (smoke tests)")
    ap.add_argument("--device", default="auto")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args(argv)

    seed_everything(args.seed)
    device = pick_device(args.device)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    labels = plantvillage_labels()
    splits = Path(args.splits)

    train_samples = read_manifest(splits / "train.csv")
    pd_train = splits / "plantdoc_train.csv"
    if args.plantdoc_mix and pd_train.exists():
        train_samples += read_manifest(pd_train) * args.plantdoc_mix
    val_samples = read_manifest(splits / "val.csv")
    if args.limit:
        random.Random(args.seed).shuffle(train_samples)
        train_samples, val_samples = train_samples[: args.limit], val_samples[: args.limit]

    train_ds = ManifestDataset(train_samples, labels, train_transform(args.img_size))
    val_ds = ManifestDataset(val_samples, labels, eval_transform(args.img_size))
    train_dl = make_loader(train_ds, args.batch_size, args.workers, train=True, balanced=args.balanced)
    val_dl = make_loader(val_ds, args.batch_size, args.workers, train=False)

    model = build_model(args.arch, len(labels), pretrained=not args.no_pretrained).to(device)
    criterion = nn.CrossEntropyLoss(label_smoothing=args.label_smoothing)
    scaler = torch.amp.GradScaler("cuda") if device.type == "cuda" else None
    history: list[dict] = []
    best_acc, best_epoch, stale = -1.0, -1, 0
    ckpt_path = out / "best.pt"

    def log(phase: str, epoch: int, tr, va, lr: float, t0: float):
        row = {
            "phase": phase,
            "epoch": epoch,
            "train_loss": tr[0],
            "train_acc": tr[1],
            "val_loss": va[0],
            "val_acc": va[1],
            "lr": lr,
            "seconds": round(time.time() - t0, 1),
        }
        history.append(row)
        print(json.dumps(row))
        (out / "history.json").write_text(json.dumps(history, indent=2))

    def maybe_save(epoch: int, val_acc: float) -> bool:
        nonlocal best_acc, best_epoch
        if val_acc > best_acc:
            best_acc, best_epoch = val_acc, epoch
            save_checkpoint(
                ckpt_path, model, arch=args.arch, labels=labels, img_size=args.img_size, epoch=epoch, val_acc=val_acc
            )
            return True
        return False

    # Phase 1: train only the new head.
    set_backbone_trainable(model, False)
    opt = torch.optim.AdamW(head_parameters(model), lr=args.head_lr, weight_decay=1e-4)
    for epoch in range(1, args.head_epochs + 1):
        t0 = time.time()
        tr = run_epoch(model, train_dl, criterion, device, opt, scaler=scaler, desc=f"head {epoch}")
        va = run_epoch(model, val_dl, criterion, device, desc="val")
        log("head", epoch, tr, va, args.head_lr, t0)
        maybe_save(epoch, va[1])

    # Phase 2: unfreeze everything at a low learning rate.
    set_backbone_trainable(model, True)
    head_ids = {id(p) for p in head_parameters(model)}
    opt = torch.optim.AdamW(
        [
            {"params": [p for p in model.parameters() if id(p) not in head_ids], "lr": args.lr},
            {"params": head_parameters(model), "lr": args.lr * 5},
        ],
        weight_decay=args.weight_decay,
    )
    steps = args.epochs * len(train_dl)
    sched = warmup_cosine(opt, warmup_steps=min(len(train_dl), steps // 10), total_steps=steps)
    for e in range(1, args.epochs + 1):
        epoch = args.head_epochs + e
        t0 = time.time()
        tr = run_epoch(model, train_dl, criterion, device, opt, sched, scaler, desc=f"finetune {e}")
        va = run_epoch(model, val_dl, criterion, device, desc="val")
        log("finetune", epoch, tr, va, opt.param_groups[0]["lr"], t0)
        if maybe_save(epoch, va[1]):
            stale = 0
        else:
            stale += 1
            if stale >= args.patience:
                print(f"Early stopping: no val improvement for {args.patience} epochs")
                break

    summary = {"best_val_acc": best_acc, "best_epoch": best_epoch, "checkpoint": str(ckpt_path), **vars(args)}
    (out / "train_summary.json").write_text(json.dumps(summary, indent=2))
    print(f"Best val acc {best_acc:.4f} at epoch {best_epoch} → {ckpt_path}")


if __name__ == "__main__":
    main()
