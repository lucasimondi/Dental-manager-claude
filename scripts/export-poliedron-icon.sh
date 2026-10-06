#!/usr/bin/env bash
# Mechanical export of the approved square artwork, no redesign or baked mask.
set -euo pipefail
task_root="$(cd "$(dirname "$0")/.." && pwd)"
task_source="${1:?Usage: bash scripts/export-poliedron-icon.sh approved-square.png}"
task_shape="$(identify -format '%w %h' "$task_source")"
read -r task_width task_height <<< "$task_shape"
if [[ "$task_width" != "$task_height" || "$task_width" -lt 512 ]]; then
  echo 'Expected square artwork at least 512 pixels wide.' >&2
  exit 1
fi
for task_size in 180 192 512; do
  convert "$task_source" -colorspace sRGB -filter Lanczos \
    -resize "${task_size}x${task_size}" -alpha off -strip \
    -define png:color-type=2 "$task_root/public/poliedron-v2-${task_size}.png"
done
# Approved symbol is already inside the central 80%-diameter safe circle.
cp "$task_root/public/poliedron-v2-512.png" "$task_root/public/poliedron-v2-maskable-512.png"
