"""remove-checker-bg.py 適用後 PNG に残る「白いハロー輪郭」を除去する後処理。

AI 生成画像 (nano-banana) はキャラ輪郭の外側に anti-alias の白ピクセルを描き込む。
remove-checker-bg.py の靴保護ロジック (12px dilation) がこれをキャラの一部として
救済してしまうため、結果的に白いギザギザ輪郭が残る。

本スクリプトは「alpha=0 領域に隣接する 1-N px 以内の、ほぼ白かつグレー (彩度低) な
ピクセル」を選択的に透明化する。キャラ内部の白色 (歯/目のハイライト/靴の白) は
bg と隣接しないため保護される。

Usage:
  python3 scripts/clean-white-halo.py public/assets/images/tadakayo-front-idle.png
  python3 scripts/clean-white-halo.py public/assets/images/*.png
  # iterations / 白判定閾値の調整:
  HALO_ITER=5 HALO_RGB_MIN=210 python3 scripts/clean-white-halo.py <files>
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation  # type: ignore[import-untyped]


def clean_white_halo(path: Path, iterations: int, rgb_min: int) -> tuple[int, int]:
    img = Image.open(path).convert("RGBA")
    arr = np.array(img)

    r = arr[:, :, 0].astype(int)
    g = arr[:, :, 1].astype(int)
    b = arr[:, :, 2].astype(int)
    a = arr[:, :, 3].astype(int)

    bg = a == 0
    char = ~bg

    # bg を iterations px 膨張させた領域から元の bg を引くと「キャラ側のエッジ帯」になる
    edge_zone = binary_dilation(bg, iterations=iterations) & char

    is_gray = (np.abs(r - g) < 20) & (np.abs(g - b) < 20) & (np.abs(r - b) < 20)
    is_near_white = (r >= rgb_min) & (g >= rgb_min) & (b >= rgb_min)
    halo = edge_zone & is_gray & is_near_white

    cleared = int(halo.sum())
    arr[halo, 3] = 0
    Image.fromarray(arr).save(path, optimize=True)
    return cleared, int(char.sum())


def main(paths: list[str]) -> None:
    iterations = int(os.environ.get("HALO_ITER", "4"))
    rgb_min = int(os.environ.get("HALO_RGB_MIN", "200"))
    print(f"# iterations={iterations} rgb_min={rgb_min}")
    for p in paths:
        path = Path(p)
        cleared, char_total = clean_white_halo(path, iterations, rgb_min)
        ratio = cleared / char_total * 100 if char_total else 0
        print(f"{path.name}: cleared {cleared:,} / char {char_total:,} px ({ratio:.2f}%)")


if __name__ == "__main__":
    main(sys.argv[1:])
