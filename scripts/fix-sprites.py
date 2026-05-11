#!/usr/bin/env python3
"""
スプライト整合化 + 靴シャドウ強制 + 靴赤色化 (Phase 5-E / Phase 5-F)

問題:
1. tadakayo-side-idle.png / tadakayo-side-run.png が「右向き」になっておらず、
   実際は左向き or 正面気味の絵が混じっていた → 右移動時に違和感
2. 全 sprite で run/jump 系の靴透明 (下端中央 opaque 0-12%) → 走ったり跳んだりすると靴が消える
3. 白いスニーカーが背景の白チェッカー柄と区別がつかず、透過処理で部分消失

対処:
1. 全 side-{pose}.png を side-left-{pose}.png の水平反転で再生成 (左右一貫性確保)
2. 全 14 sprite (front/back/sideLeft/sideRight × idle/run/jump/crouch) の下端中央に
   黒い楕円フットシャドウを強制描画 → 靴がなくても「足元に影」として自然に見える
3. 下端 30% 領域内の白いピクセルをブランド赤 (#e33535) に置換 → 透過リスクを根絶
   + ブランドカラーとの整合 (短パン領域は下端 30% 外なので影響なし)

使用法:
    python3 scripts/fix-sprites.py
"""
from __future__ import annotations
import os
import sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_DIR = os.path.join(ROOT, "public", "assets", "images")

# 1. 水平反転対象: side-left-* → side-* (右向きは左向きの mirror)
FLIP_PAIRS = [
    # (source, dest)
    ("tadakayo-side-left-idle.png", "tadakayo-side-idle.png"),
    ("tadakayo-side-left-run.png", "tadakayo-side-run.png"),
    ("tadakayo-side-left-jump.png", "tadakayo-side-jump.png"),
    ("tadakayo-side-left-crouch.png", "tadakayo-side-crouch.png"),
]

# 2. フットシャドウを強制適用する全 sprite
SPRITES_FOR_SHADOW = [
    "tadakayo-front-idle.png",
    "tadakayo-back-idle.png",
    "tadakayo-back-run.png",
    "tadakayo-run.png",
    "tadakayo-back-jump.png",
    "tadakayo-jump.png",
    "tadakayo-side-idle.png",
    "tadakayo-side-run.png",
    "tadakayo-side-jump.png",
    "tadakayo-side-crouch.png",
    "tadakayo-side-left-idle.png",
    "tadakayo-side-left-run.png",
    "tadakayo-side-left-jump.png",
    "tadakayo-side-left-crouch.png",
]


def flip_horizontal(src_path: str, dst_path: str) -> None:
    """src を水平反転して dst に保存。

    **重要**: source 側の sentinel metadata (tdk-foot-shadow / tdk-shoe-color) を
    引き継いで保存する。これがないと反転後の dst は metadata 喪失状態になり、
    後続 Step 2/3 が「未適用」と誤判定して二重に shadow / 赤塗りを重ねる。
    (codex review PR #17 Medium 修正)
    """
    if not os.path.exists(src_path):
        print(f"  [SKIP] source not found: {src_path}")
        return
    src = Image.open(src_path)
    info = src.info or {}
    flipped = src.convert("RGBA").transpose(Image.FLIP_LEFT_RIGHT)

    from PIL import PngImagePlugin
    pnginfo = PngImagePlugin.PngInfo()
    for key in ("tdk-foot-shadow", "tdk-shoe-color"):
        val = info.get(key)
        if val:
            pnginfo.add_text(key, val)
    flipped.save(dst_path, "PNG", pnginfo=pnginfo)
    print(f"  [FLIP] {os.path.basename(src_path)} → {os.path.basename(dst_path)}")


def add_foot_shadow(path: str) -> tuple[float, float, str]:
    """
    画像下端中央 (35-65% × 92-99%) に半透明黒楕円を強制描画。
    既存 character pixel と alpha-composite される (上書きでなく重ね)。

    **冪等性保証**: PNG metadata `tdk-foot-shadow=v1` を sentinel として使う。
    既に適用済みなら再描画せず skip して画像が二重暗化することを防ぐ。

    return: (before_opaque_pct, after_opaque_pct, status)
        status: "applied" or "skipped" (既適用)
    """
    img = Image.open(path).convert("RGBA")
    sentinel = (img.info or {}).get("tdk-foot-shadow")
    if sentinel == "v1":
        # 既適用 → スキップ (冪等性確保)
        opaque = _foot_opaque_pct(img)
        return opaque, opaque, "skipped"

    W, H = img.size

    # 楕円位置: 中央寄り、下端ぎりぎりの帯
    cx = W // 2
    cy = int(H * 0.955)
    half_w = int(W * 0.18)
    half_h = int(H * 0.025)
    bbox = (cx - half_w, cy - half_h, cx + half_w, cy + half_h)

    # before opaque (中央 30-70% × 92-100%)
    before = _foot_opaque_pct(img)

    # 半透明黒楕円を上に重ねる (alpha 200 で「靴の影 + 地面」的な印象)
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    odraw.ellipse(bbox, fill=(20, 20, 20, 210))
    composited = Image.alpha_composite(img, overlay)

    # PNG metadata (tEXt chunk) で sentinel 埋め込み
    from PIL import PngImagePlugin
    pnginfo = PngImagePlugin.PngInfo()
    pnginfo.add_text("tdk-foot-shadow", "v1")
    composited.save(path, "PNG", pnginfo=pnginfo)

    after = _foot_opaque_pct(composited)
    return before, after, "applied"


def colorize_shoes_red(path: str) -> tuple[int, str]:
    """
    画像下端 30% 領域で 2 種類の操作を行い、靴領域を完全にブランド赤 (#e33535) で塗りつぶす。

    操作 1: 既存の白っぽい不透明ピクセルを赤に置換
        - 判定: alpha > 200 + R,G,B all >= 200 (白〜薄灰)
        - 黒アウトライン (RGB 低) と肌色 (R>>G>B、B<200) は保持
        - 短パン (元から赤、G/B<200) も保持

    操作 2: アウトライン内側の透明な「穴」も赤で塗りつぶす (red-v2 で追加)
        - scipy.binary_fill_holes で「不透明ピクセルの連結成分が囲む穴」を検出
        - 元の透過処理で「白い靴 + 白い背景チェッカー」が連結して透明化された
          スケルトン領域を救済 (ユーザー報告: 靴中身が透明でピンク背景が透ける)

    **冪等性保証**: PNG metadata `tdk-shoe-color=red-v2` を sentinel に使用。
    既存 red-v1 (穴埋めなし版) は再処理対象、red-v2 は skip。foot-shadow sentinel は別 key で共存。

    return: (changed_pixel_count, status)
    """
    import numpy as np
    from scipy.ndimage import binary_fill_holes
    from PIL import PngImagePlugin

    img = Image.open(path).convert("RGBA")
    info = img.info or {}
    if info.get("tdk-shoe-color") == "red-v2":
        return 0, "skipped"

    W, H = img.size
    y_start = int(H * 0.70)  # 下から 30% (靴領域、短パンは除外)

    arr = np.array(img)  # shape: (H, W, 4)
    region = arr[y_start:H, :, :]  # 下端 30% の view

    # 操作 1: 白いピクセルを判定
    region_alpha = region[:, :, 3]
    white_mask = (
        (region_alpha > 200)
        & (region[:, :, 0] >= 200)
        & (region[:, :, 1] >= 200)
        & (region[:, :, 2] >= 200)
    )

    # 操作 2: アウトライン内側の穴を検出
    opaque_mask = region_alpha > 128
    filled = binary_fill_holes(opaque_mask)
    if filled is None:
        # scipy が None を返すことはないが型安全のため
        filled = opaque_mask
    hole_mask = filled & ~opaque_mask  # 穴 = 「埋めた後不透明」かつ「元は透明」

    target_mask = white_mask | hole_mask
    changed = int(target_mask.sum())

    # 赤 (#e33535) で塗りつぶし。穴 (元 alpha=0) は alpha=255 に
    region[:, :, 0] = np.where(target_mask, 227, region[:, :, 0])
    region[:, :, 1] = np.where(target_mask, 53, region[:, :, 1])
    region[:, :, 2] = np.where(target_mask, 53, region[:, :, 2])
    region[:, :, 3] = np.where(target_mask, 255, region[:, :, 3])
    arr[y_start:H, :, :] = region

    new_img = Image.fromarray(arr, "RGBA")

    pnginfo = PngImagePlugin.PngInfo()
    if info.get("tdk-foot-shadow") == "v1":
        pnginfo.add_text("tdk-foot-shadow", "v1")
    pnginfo.add_text("tdk-shoe-color", "red-v2")
    new_img.save(path, "PNG", pnginfo=pnginfo)
    return changed, "applied"


def _foot_opaque_pct(img: Image.Image) -> float:
    """下端中央 (横 30-70%, 縦 92-100%) の不透明 pixel %"""
    W, H = img.size
    x0 = int(W * 0.30)
    x1 = int(W * 0.70)
    y0 = int(H * 0.92)
    y1 = H
    region = img.crop((x0, y0, x1, y1))
    pixels = list(region.getdata())
    if not pixels:
        return 0.0
    opaque = sum(1 for p in pixels if p[3] > 128)
    return round(opaque / len(pixels) * 100, 1)


def main() -> int:
    # 1. 水平反転で右向き sprite を確定
    print("=== Step 1: 水平反転 (side-left → side) ===")
    for src, dst in FLIP_PAIRS:
        flip_horizontal(os.path.join(IMG_DIR, src), os.path.join(IMG_DIR, dst))

    # 2. 全 sprite にフットシャドウ強制 (冪等性 = sentinel "tdk-foot-shadow=v1" で skip)
    print("\n=== Step 2: フットシャドウ強制 (冪等、PNG metadata sentinel) ===")
    print(f"{'sprite':40s}  before  →  after  status")
    print("-" * 70)
    missing = []
    for name in SPRITES_FOR_SHADOW:
        path = os.path.join(IMG_DIR, name)
        if not os.path.exists(path):
            print(f"  [MISS] {name}")
            missing.append(name)
            continue
        before, after, status = add_foot_shadow(path)
        result = "OK" if after >= 30.0 else "WARN"
        print(f"  [{result}] {name:35s}  {before:5.1f}%  →  {after:5.1f}%  [{status}]")

    # 3. 靴の白を赤 (#e33535) に置換 (冪等、PNG metadata sentinel)
    print("\n=== Step 3: 靴を赤色化 (下端 30% 内の白 → #e33535、冪等) ===")
    print(f"{'sprite':40s}  changed_px  status")
    print("-" * 70)
    for name in SPRITES_FOR_SHADOW:
        path = os.path.join(IMG_DIR, name)
        if not os.path.exists(path):
            continue
        changed, status = colorize_shoes_red(path)
        print(f"  {name:40s}  {changed:8d}  [{status}]")

    print("\nDone." + (f" ({len(missing)} missing)" if missing else ""))
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
