"""nano-banana 生成画像の checkerboard 背景を透明化する後処理。

AI が「透明背景」を「チェッカー柄＝透明の表現」として描き込んでしまう問題への対処。
4 隅から連結成分で外側のチェッカー柄領域のみ alpha=0 にする。
キャラ内側の白色（歯、靴のハイライト等）は別連結成分なので保護される。

Usage:
  python3 scripts/remove-checker-bg.py public/assets/images/*.png
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import label  # type: ignore[import-untyped]


def remove_checker_bg(path: Path) -> tuple[int, int]:
    img = Image.open(path).convert("RGBA")
    arr = np.array(img)
    h, w = arr.shape[:2]

    r = arr[:, :, 0].astype(int)
    g = arr[:, :, 1].astype(int)
    b = arr[:, :, 2].astype(int)
    is_gray = (np.abs(r - g) < 30) & (np.abs(g - b) < 30) & (np.abs(r - b) < 30)
    is_bright = r >= 180
    bg_candidate = is_gray & is_bright

    labeled, _ = label(bg_candidate)
    corner_labels: set[int] = set()
    for cy, cx in [(0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)]:
        lbl = int(labeled[cy, cx])
        if lbl != 0:
            corner_labels.add(lbl)

    if not corner_labels:
        return 0, h * w

    bg_mask = np.isin(labeled, list(corner_labels))
    arr[bg_mask, 3] = 0

    Image.fromarray(arr).save(path, optimize=True)
    return int(bg_mask.sum()), h * w


def main(paths: list[str]) -> None:
    for p in paths:
        path = Path(p)
        cleared, total = remove_checker_bg(path)
        ratio = cleared / total * 100 if total else 0
        print(f"{path.name}: cleared {cleared:,}/{total:,} px ({ratio:.1f}%)")


if __name__ == "__main__":
    main(sys.argv[1:])
