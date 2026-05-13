"""キャラクター sprite の内部にできた透明 hole を白で塗り直す。

`scripts/remove-checker-bg.py` は 4 隅起点の連結成分しか辿らないため、
キャラ輪郭の中で完全に閉じた領域に「透明ピクセル」が残ることがある。
NPC 3 体 (nurse / elder / manager) は服の白い部分が背景チェッカーと
同色 (白) で、`clean-white-halo.py` のハロ除去で削られた結果、服の
内部に大きな透明 hole ができ、ゲーム内で「服が透けて背景が見える」
不具合の原因になっていた (npc-elder: 4.57% / npc-nurse: 3.25% /
npc-manager: 1.51% の透明面積)。

本スクリプトは 4 隅から alpha==0 を BFS で塗りつぶし、「真の背景」を
visited として記録、それ以外の alpha==0 を「内部 hole」とみなして
白 (255,255,255,255) で fill する。fix-title-logo-checker.py と同様の
発想だが、title-logo は「内部白を透明にする」逆方向の処理だったのに対し、
こちらは「内部透明を白に戻す」方向。

Usage:
    python3 scripts/fill-sprite-internal-holes.py path1.png [path2.png ...]
"""

from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

FILL_RGBA = (255, 255, 255, 255)


def fill_internal_holes(path: Path) -> tuple[int, int]:
    im = Image.open(path).convert("RGBA")
    arr = np.array(im)
    h, w = arr.shape[:2]
    alpha = arr[..., 3]

    visited = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for y, x in ((0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)):
        if alpha[y, x] == 0:
            visited[y, x] = True
            q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and alpha[ny, nx] == 0:
                visited[ny, nx] = True
                q.append((ny, nx))

    internal = (alpha == 0) & (~visited)
    filled = int(internal.sum())
    if filled > 0:
        arr[internal] = FILL_RGBA
        Image.fromarray(arr, mode="RGBA").save(path, optimize=True)
    return filled, alpha.size


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2
    for raw in argv[1:]:
        p = Path(raw)
        if not p.exists():
            print(f"skip (missing): {p}")
            continue
        filled, total = fill_internal_holes(p)
        pct = filled / total * 100 if total else 0.0
        print(f"{p}: filled {filled} px ({pct:.2f}% of {total})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
