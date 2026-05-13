"""タダカヨちゃん front-idle から favicon を生成する。

元画像 (1024x1024 RGBA) は全身レイアウトで、ファビコンに全身を縮小すると
16x16 では小豆大に潰れて視認できない。そこで頭部 + ヘッドフォンを正方形に
クロップしてから複数サイズへ Lanczos 縮小する。

出力:
- public/favicon.ico        : 16/32/48 マルチサイズ ICO (ブラウザ標準)
- public/favicon-32.png     : 32x32 PNG (rel=icon、modern fallback)
- public/apple-touch-icon.png : 180x180 PNG (iOS ホーム画面アイコン)
"""

from pathlib import Path
from PIL import Image

SRC = Path("public/assets/images/tadakayo-front-idle.png")
OUT_DIR = Path("public")

# 頭部 + ヘッドフォン込みの正方形クロップ (1024x1024 上での bounding box)。
# 画像中央に縦に並ぶ立ち絵で、頭頂部からあご下までを含めつつ、
# 横はヘッドフォン両端が切れない幅を確保。
CROP_X0, CROP_Y0 = 280, 30
CROP_X1, CROP_Y1 = 720, 470  # 440x440 正方形


def main() -> None:
    src = Image.open(SRC).convert("RGBA")
    head = src.crop((CROP_X0, CROP_Y0, CROP_X1, CROP_Y1))
    assert head.size[0] == head.size[1], head.size  # 正方形維持

    # ICO 用マルチサイズ (Pillow 内部で各サイズへ Lanczos 縮小して 1 ICO に格納)
    ico_sizes = [(16, 16), (32, 32), (48, 48)]
    head.save(OUT_DIR / "favicon.ico", format="ICO", sizes=ico_sizes)

    head.resize((32, 32), Image.LANCZOS).save(OUT_DIR / "favicon-32.png", optimize=True)
    head.resize((180, 180), Image.LANCZOS).save(
        OUT_DIR / "apple-touch-icon.png", optimize=True
    )

    print(f"crop: {head.size} from {SRC}")
    print("written:")
    for name in ("favicon.ico", "favicon-32.png", "apple-touch-icon.png"):
        p = OUT_DIR / name
        print(f"  {p}  ({p.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
