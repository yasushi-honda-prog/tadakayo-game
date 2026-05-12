# tadakayo-game プロジェクト固有の前提

## 位置づけ

- NPO法人タダカヨ（本人運営）公式の **3D オープンワールド・プラットフォーマー**
- 「タダカヨ村」を舞台に、ミッションをクリアしながら介護 DX の世界を冒険する
- 法人内イベント + 公式コンテンツとしての配信が主目的（一般公開も視野）
- ユーザーが目指す品質: **「どこに出しても恥ずかしくないクオリティ」**（itch.io の良質作品レベル）

## 開発状態(2026-05-12 時点)

- **Phase 5 完全完了** ✅: 5-A 物理基盤 → 5-B 村構築 → 5-C ミッション基盤 → 5-D NPC/会話 → 5-E モバイル+残ミッション → 5-F 演出+ScoreScreen+DanceNpc+SkyDome → hotfix 6 件 (#19-24)
- **Phase 6 polish 完了** ✅ (2026-05-11): #26 赤靴 sprite 再生成 / #27 bundle code split / #28 preload crossorigin
- **Phase 5-G Player ダンス + collider polish 完了** ✅ (2026-05-12):
  - #30 Player ダンス機能 (専用 sprite + EDM BGM + 何度でも踊れる)
  - #32 柱/木 collider 修正、#33 中央モニュメント装飾化 (Issue #31 スコープ 1+2+追加)
- **Phase 5-H Issue #31 真因対応 + UX 文言修正 完了** ✅ (2026-05-12):
  - #36 Player sprite が常に capsule 足元から 0.85m 浮く問題を修正 (Issue #31 真因、ユーザー報告「カメラ視点切替で浮く」の根本原因)
  - #37 操作ヒントの「視点ロック」表現を「クリックでマウス視点変更 ON / Esc で OFF」「矢印キーで移動」に変更
  - #35 close (噴水・ベンチ装飾化、ユーザー判断「乗れても良い」)
- **Phase 5-I ScoreScreen UX + 看板 + collider 復活 完了** ✅ (2026-05-12):
  - #39 ScoreScreen 表示時の `exitPointerLock()` 追加 + タダスクの塔の立て看板に CanvasTexture でテキスト描画 (フォントサイズは `measureText` 自動縮小)
  - #40 ScoreScreen ボタンクリック貫通の **真因対応**: `.score-screen` に `pointer-events: auto` 追加 (親 `#ui-layer` の `pointer-events: none` 継承で canvas に貫通していた、PauseMenu / MissionPanel と同パターン)
  - #40 中央モニュメント (台座 + ピンクキューブ) と タダレク広場 4 隅の柱の collider 復活 (ユーザー判断「すり抜けは駄目 (乗れても良い)」、PR #36 で sprite 浮きが解消済のため許容)
- **Phase 5-J UI / 輪郭品質改善 + sprite 不可視 hotfix 完了** ✅ (2026-05-12 セッション 4、6 PR):
  - #43 canvas 上の十字カーソル (`cursor: crosshair`) を非表示化 (`cursor: none` + `.screen { cursor: default }`)
  - #44 PNG 後処理 `scripts/clean-white-halo.py` 追加: alpha=0 隣接 8px 以内のほぼ白ピクセル (RGB>=200 & gray) を透明化、21 PNG (3-9% 削減)
  - #45 sprite テクスチャに mipmap (`LinearMipmapLinearFilter` + `generateMipmaps=true`) 適用 → 縮小エイリアシング除去 → **#48 で sprite 側 revert (本番不具合のため)**
  - #46 PNG 後処理 `scripts/soften-alpha.py` 追加: 22 PNG の alpha を Gaussian σ=0.6 でぼかし、AI 線画の折れ線ジャギーをソフト化
  - #47 タダスクの塔の看板柱が看板を 0.55m 貫通して Z-fighting (看板テクスチャに細い縦線) → 柱を看板下面 (y=0.85) で止める
  - **#48 sprite 不可視 hotfix**: ユーザー報告「Player + NPC + DanceNpc すべて表示されない」(dev / Playwright Chromium では正常、ユーザー環境のみ NG) → codex セカンドオピニオン → PR #45 を sprite 側 revert (LinearFilter 戻し + generateMipmaps=false 明示) + SpriteMaterial に `alphaTest: 0.01` 追加。**仮説**: PR #45 mipmap completeness 違反 + PR #46 で生まれた alpha=1-10 極小値が mipmap 縮小で更に薄まり特定 GPU で完全透明化
- **Phase 5-K title-logo「カ」内部チェッカー柄透明化 hotfix 完了** ✅ (2026-05-12 セッション 5):
  - #50 `title-logo.png` の閉じ領域内に取り残された明灰チェッカー柄 8,248 px (R~254) を全領域 alpha=0 にする `scripts/fix-title-logo-checker.py` を追加 → 「カ」内部の市松模様残骸を除去
  - 真因: `remove-checker-bg.py` は 4 隅起点の連結成分しか辿らないため、文字輪郭で**完全に閉じた領域**のチェッカー柄は透明化されず焼き込まれていた (キャラ画像と違い「内側白色保護 (靴の中身)」が不要なロゴ用に専用スクリプトを分離)
  - title-logo は HTML `<img>` 表示 (index.html:46) のため Three.js mipmap / alphaTest 問題は無関係
- **Phase 5-L タイトル本番化 + UI 操作説明統一 + 噴水水しぶき frustum cull hotfix 完了** ✅ (2026-05-12 セッション 6、3 PR):
  - #52 タイトル画面: `Phase 5-F プロトタイプ` バッジ削除 (本番仕様化) + 操作説明を `<kbd>` + `<dl>` の「キー → やること」対応表化 (デスクトップ 2 列 / モバイル 1 列スタック)
  - #53 (hotfix) 噴水の水しぶき (InstancedMesh) が特定視点で全消失する問題を `droplets.frustumCulled = false` で修正。**真因**: Three.js の InstancedMesh bounding sphere は「メッシュ local origin + geometry の bounding sphere」で計算されるが、`droplets` はシーン Group のローカル原点 (0,0,0) に追加されたまま per-instance で `fountainCenter (cx=18, _, cz=4)` 周辺に粒子を描画するため、カメラから world (0,0,0) が frustum 外に出る角度で全粒子が一括 cull される false-positive。`waterColumn` は通常 Mesh で position が `(cx, 1.75, cz)` のため bounding sphere が正しく付随し影響なし → 「水柱は見えるのに粒子だけ消える」症状の説明
  - #54 HUD 上部ピル + ポーズ画面の操作説明を PR #52 と同じ `<kbd>` 対応表に統一 (`.hint-section` / `.hint-list` / `kbd` CSS をゲーム全体で共有、ゲーム内 UI の操作説明表現が 3 箇所で完全統一)
- 本番デプロイ済み: https://yasushi-honda-prog.github.io/tadakayo-game/
- 全 5 ミッション完走 + スコア画面 + リプレイ + 噴水アニメ + ダンス NPC + Player 自身も踊る + HUD ヒント すべて稼働
- **残課題**:
  - Issue #31 (`postponed` ラベル付与済、スコープ 3 のみ: 段差エッジ snap 失敗、P2)
  - Rapier 0.20+ init() deprecation 再評価 (0.19.3 が現状最新、未リリース)
  - sprite 輪郭の縮小エイリアシング (PR #45 mipmap が #48 で revert された副作用、品質トレードオフとして許容)。再度 mipmap 化するなら asset pipeline に「RGB bleed (透明領域 RGB を周辺色で埋める) + alpha floor clamp + alphaTest」をセットで実装する必要あり (codex セカンドオピニオン根拠)
- ハンドオフ: `docs/handoff/LATEST.md` 参照

## 公開 URL と base path

- リポジトリ: `yasushi-honda-prog/tadakayo-game` (public)
- 公開 URL: `https://yasushi-honda-prog.github.io/tadakayo-game/`
- `vite.config.ts` の `base: "/tadakayo-game/"` を変更すると 404 になるので、リポジトリ名と一致させる

## アカウント / 認証

- GitHub アカウント: `yasushi-honda-prog`（global の `gh auth` の active と異なる可能性あり）
- 認証は **`.envrc` の `GH_TOKEN`** でローカルに閉じる（direnv allow 済み）
- グローバル `gh auth switch` は **しない**（global feedback_account_scope 準拠）
- git identity も **`git config --local`** で `yasushi-honda-prog` 名義に閉じる
  - email: `254105639+yasushi-honda-prog@users.noreply.github.com`

## 技術スタック

| 項目 | 採用 | 用途 |
|---|---|---|
| Three.js (r169+) | ✓ | レンダリング |
| Rapier 3D (`@dimforge/rapier3d-compat`) | ✓ | 物理（重力、衝突、CharacterController） |
| Vite 5 + TypeScript 5 | ✓ | ビルド/型 |
| Noto Sans JP, Web Audio API | ✓ | フォント、音 |

## ディレクトリ構成 (Phase 5-F 完了時点)

```
src/
├── core/         # PhysicsWorld, Game (メインループ + 全 entity + ScoreScreen + SkyDome)
├── entities/     # Player, Camera, Collectible (専用地面影付), NPC, DanceNpc (5-F 装飾)
├── world/        # Village (5-B + 5-F 噴水アニメ + 旗揺れ)
├── input/        # InputBus, KeyboardMouseInput (PointerLock+drag fallback), TouchInput, detectInput
├── ui/           # TitleScreen, HUD, MissionPanel, DialogBox, PauseMenu, ScoreScreen (5-F), MobileControls
├── missions/     # Mission, MissionManager, missions/{Collect,Reach,Talk,Dance,Meta}Mission
├── audio/        # AudioManager (kenney.nl OGG decode + BGM ループ + SE 6 種)
├── config/       # brand.ts, gameConfig.ts (PHYSICS / PLAYER / CAMERA)
└── styles/main.css
```

## アセット (Phase 5-G 完了時点)

```
public/assets/
├── images/       # タダカヨちゃん 14 + dance 4 (front-dance-1..4) + NPC 3 + title-logo (計 22 PNG)
└── audio/        # bgm-village.ogg + bgm-dance.mp3 (Mixkit "Karma" EDM 2:15) + se-{pickup,mission-clear,jump,land,dialog-open,dialog-next}.ogg
```

`index.html` に **21 sprite を `<link rel=preload as=image>`** 追加 (PR #24 + #30): スタート時のチラつき解消。

音素材ライセンス:
- SE / 村 BGM: [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) + [Kenney Music Jingles](https://kenney.nl/assets/music-jingles) (CC0、商用 OK)
- ダンス BGM: "Karma" by Michael Ramir C. from [Mixkit](https://mixkit.co/free-stock-music/tag/dance/) (Mixkit License、商用 OK)

クレジットは README に記載。

## ブランド定数（`src/config/brand.ts`）

| 用途 | 値 |
|------|----|
| プライマリ赤 | `#e33535` |
| セカンダリ ピンク | `#ffe2f7` |
| フォント | Noto Sans JP |
| マスコット要素 | 黄色ショートヘア + ピンクのヘッドフォン + 赤い和風ジャケット（3 要素を必ず維持） |

NG（ブランドガイドライン由来）:
- 暴力・恐怖・暗いトーン
- ロゴ変形・指定色外使用
- ドロップシャドウ装飾の濫用

## キャラクタースプライト（14 種）

| | idle | run | jump | crouch |
|---|---|---|---|---|
| **front** | `tadakayo-front-idle.png` | `tadakayo-run.png` | `tadakayo-jump.png` | — |
| **back** | `tadakayo-back-idle.png` | `tadakayo-back-run.png` | `tadakayo-back-jump.png` | — |
| **sideRight** | `tadakayo-side-idle.png` | `tadakayo-side-run.png` | `tadakayo-side-jump.png` | `tadakayo-side-crouch.png` |
| **sideLeft** | `tadakayo-side-left-idle.png` | `tadakayo-side-left-run.png` | `tadakayo-side-left-jump.png` | `tadakayo-side-left-crouch.png` |

front/back の crouch は side で代用。

すべて nano-banana (Gemini 3.1 Flash Image) で統一プロンプト（赤い和風ジャケット + 赤い短パン + 白いスニーカー + 黄色ショート + ピンクヘッドフォン + 細目笑顔）で生成、`scripts/remove-checker-bg.py` で完全透明化済み。Phase 5-C 直前にデザイン整合化（PR #10）で 14 枚を一括再生成。

## 物理・操作パラメータ（`src/config/gameConfig.ts`）

- 重力: y = -22 m/s²
- プレイヤー移動速度: 5.5 m/s（走り 8.5 m/s）
- ジャンプ初速: 8.0 m/s
- カプセルコライダー: 半径 0.35、半高 0.55
- ジャンプバッファ 0.18s + コヨーテ時間 0.12s
- 三人称カメラ: 距離 6.0、高さ 2.4、lerp 補間 0.18-0.22

## 4 方向ビルボードの判定（重要）

`Player.applyDirectionalSprite` で `cameraYaw` と `facingYaw` の相対角度を計算:

```ts
let rel = facingYaw - cameraYaw - Math.PI;
// rel ≈ 0 → back（カメラ視線方向と同じ向き = 背中）
// |rel| > 3π/4 → front（逆向き = 顔）
// rel > 0 → sideLeft（カメラ視線の右側を向いている = 左側面が見える）
// rel < 0 → sideRight
```

**重要な注意**: `cameraYaw` は camera の旋回角で、視線方向 atan2 とは **π ずれている**（cameraYaw=0 なら camera は player の +Z 側、視線は -Z 方向 = atan2(0,-1) = π）。
過去のセッションで、`rel = facingYaw - cameraYaw` で実装したら方向が逆になるバグがあった。`- Math.PI` のオフセットが必須。

## デプロイ

- `main` push → GitHub Actions が自動デプロイ
- workflow: `.github/workflows/deploy.yml`
- Pages の Source は **GitHub Actions** に設定済み
- bundle (Phase 5-G 完了時、PR #30 後): main chunk **540 KB / gzip 139 KB** (dance state 追加で +1 KB)、rapier chunk **2,237 KB / gzip 836 KB** (dynamic import で並列ダウンロード)。bgm-dance.mp3 (4.3 MB) は `public/` 別管理で bundle 外

## モバイル対応 (Phase 5-E 完了)

- **モバイル両対応** ✅: 仮想スティック (左) + ジャンプ/E ボタン (右下) + ⏸ ポーズ (右上)
- 自動判定: `ontouchstart` / `maxTouchPoints` で判定、URL `?ui=mobile` / `?ui=desktop` で強制
- PointerLock fallback: マウスドラッグでも視点回転可 (PR #15)
- viewport: `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover`
- タッチイベントは `passive: false` で `preventDefault`

## 検証コマンド

```bash
npm run dev         # ローカル開発
npm run typecheck   # 型チェック
npm run build       # 本番ビルド
npm run preview     # 本番ビルドのローカル確認
```

Playwright MCP でブラウザ動作確認可。`http://localhost:5173/tadakayo-game/` （base path 必須）。

## ADR（重要技術判断）

- `docs/adr/2026-05-10-pivot-to-3d-openworld.md` — エンドレスランナー → 3D オープンワールドへのピボット + Rapier 物理エンジン採用
