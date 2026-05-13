"""キャラクター sprite の内部にできた透明 hole を白で塗り直す。

`scripts/remove-checker-bg.py` は 4 隅起点の連結成分しか辿らないため、
キャラ輪郭の中で完全に閉じた領域に「透明ピクセル」が残ることがある。
NPC 3 体 (nurse / elder / manager) は服の白い部分が背景チェッカーと
同色 (白) で、`clean-white-halo.py` のハロ除去で削られた結果、服の
内部に大きな透明 hole が残り、ゲーム内で「服が透けて背景が見える」
不具合の原因になっていた (NPC 3 体で 1.5〜4.6% 程度の透明面積、
実行時の正確な値は stdout に出力される)。

本スクリプトは 4 隅から alpha==0 を BFS で塗りつぶし、「真の背景」を
visited として記録、それ以外の alpha==0 を「内部 hole」とみなして
白で fill する。`fix-title-logo-checker.py` が「内部白→透明」だった
のに対し、本スクリプトは「内部透明→白」の逆向き処理。

**前提**:
- 内部 hole が白系のキャラ専用。色付き hole が想定されるキャラを
  追加した場合は `FILL_RGBA` を見直すこと。
- tadakayo* (Player / DanceNpc) と title-logo は対象外 (本番反映済の
  挙動を尊重 / title-logo は PR #50 で意図的に内部を透明化した処理を
  保持)。glob で一括処理しないこと。

Usage:
    # NPC 3 体のみに適用（tadakayo* / title-logo は除外）
    python3 scripts/fill-sprite-internal-holes.py public/assets/images/npc-*.png
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
