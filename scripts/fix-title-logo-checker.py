"""title-logo.png の閉じ領域内に取り残されたチェッカー柄を透明化する後処理。

remove-checker-bg.py は 4 隅起点の連結成分しか辿らないため、
「カ」のように文字輪郭で完全に閉じた領域内のチェッカー柄は透明化されない。
ロゴ画像はキャラ画像と違い「内側の白色保護」が不要なので、
bg_candidate に該当するピクセルを全領域で alpha=0 にする。

Usage:
  python3 scripts/fix-title-logo-checker.py public/assets/images/title-logo.png
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image


def fix(path: Path) -> int:
    img = Image.open(path).convert("RGBA")
    arr = np.array(img)
    r = arr[:, :, 0].astype(int)
    g = arr[:, :, 1].astype(int)
    b = arr[:, :, 2].astype(int)
    a = arr[:, :, 3].astype(int)

    is_gray = (np.abs(r - g) < 30) & (np.abs(g - b) < 30) & (np.abs(r - b) < 30)
    is_already_transparent = a < 128
    is_dark_check = (r < 16) & (g < 16) & (b < 16)
    is_light_gray = is_gray & (r >= 80)
    bg_candidate = is_already_transparent | is_dark_check | is_light_gray

    newly_cleared = int((bg_candidate & ~is_already_transparent).sum())
    arr[bg_candidate, 3] = 0
    Image.fromarray(arr).save(path, optimize=True)
    return newly_cleared


def main(paths: list[str]) -> None:
    for p in paths:
        path = Path(p)
        cleared = fix(path)
        print(f"{path.name}: newly cleared {cleared:,} px")


if __name__ == "__main__":
    main(sys.argv[1:])
