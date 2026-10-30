#!/usr/bin/env bash
# Download PlantVillage (lab photos, 38 classes) and PlantDoc (real field photos).
# Both are public GitHub repositories; only the folders we need are checked out.
set -euo pipefail

DEST="${1:-data}"
mkdir -p "$DEST"
cd "$DEST"

if [ ! -d PlantVillage-Dataset ]; then
  git clone --depth 1 --filter=blob:none --sparse https://github.com/spMohanty/PlantVillage-Dataset.git
  git -C PlantVillage-Dataset sparse-checkout set raw/color
fi

if [ ! -d PlantDoc-Dataset ]; then
  git clone --depth 1 https://github.com/pratikkayal/PlantDoc-Dataset.git
fi

echo "PlantVillage classes: $(ls PlantVillage-Dataset/raw/color | wc -l)"
echo "PlantDoc train/test:  $(find PlantDoc-Dataset/train -type f | wc -l) / $(find PlantDoc-Dataset/test -type f | wc -l) images"
