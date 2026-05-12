"""sprite PNG の alpha チャンネルだけ Gaussian でぼかしてエッジを soften する後処理。

clean-white-halo.py + Three.js mipmap 適用後にも残る、AI 線画自体のジャギー
(線が滑らかな曲線ではなく細かい折れ線として描かれている) の「角」を丸めて
目立たなくする。

RGB チャンネルは触らないので、黒い線画や色彩は影響を受けない。
alpha のみ Gaussian σ≈0.6 で境界を 1-2 px ほどフェードさせる。

Usage:
  python3 scripts/soften-alpha.py public/assets/images/*.png
  ALPHA_SIGMA=0.8 python3 scripts/soften-alpha.py <files>
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter  # type: ignore[import-untyped]


def soften_alpha(path: Path, sigma: float) -> int:
    img = Image.open(path).convert("RGBA")
    arr = np.array(img)

    alpha_before = arr[:, :, 3].astype(np.float32)
    alpha_smooth = gaussian_filter(alpha_before, sigma=sigma)
    alpha_after = np.clip(alpha_smooth, 0, 255).astype(np.uint8)

    changed = int(np.sum(alpha_after != arr[:, :, 3]))
    arr[:, :, 3] = alpha_after
    Image.fromarray(arr).save(path, optimize=True)
    return changed


def main(paths: list[str]) -> None:
    sigma = float(os.environ.get("ALPHA_SIGMA", "0.6"))
    print(f"# sigma={sigma}")
    for p in paths:
        path = Path(p)
        changed = soften_alpha(path, sigma)
        print(f"{path.name}: {changed:,} alpha pixels modified")


if __name__ == "__main__":
    main(sys.argv[1:])
