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
- **Phase 6 ブラッシュアップ Stage 1-4 完了** ✅ (2026-05-13、Stage 1 〜 Stage 4 = PR #56 〜 #59):
  - Stage 1 #56: 目標コンパス HUD (foreground mission の方向矢印 + 距離、Camera fwd/right 内積で画面相対角を計算、aria-label 8 方位、0.5° transform キャッシュ)
  - Stage 2 #57: UserSettings シングルトン (感度 X/Y、Y軸反転、BGM/SE 個別音量、設定リセット、localStorage 永続化 + safe accessors)
  - Stage 3 #58: **Firestore + Anonymous Auth 永続化 + Firebase Hosting 移行** (ADR-2026-05-13 参照、公開 URL 変更)
  - Stage 4 #59: prefers-reduced-motion 対応 (UserMotion singleton、6 entity + ScoreScreen + toast 全対応) + プレイ開始時 welcome toast (4.5 秒、目標誘導)
- 本番デプロイ済み: **https://tadakayo-game-yh.web.app/** (Firebase Hosting、Stage 3 以降)
- 旧 URL `https://yasushi-honda-prog.github.io/tadakayo-game/` は Stage 3 マージ前のコンテンツで凍結、PR #61 で新 URL への自動 redirect 化完了
- 全 5 ミッション完走 + スコア画面 + 自己ベスト + 累計クリア + リプレイ + 噴水アニメ + ダンス NPC + Player 自身も踊る + HUD ヒント + コンパス + 設定 + a11y + welcome 演出 すべて稼働
- **Phase 6 配信インフラ整備 完了** ✅ (2026-05-13): PR #61 (旧 GH Pages → 新 URL redirect) + PR #62 (`main` push → Firebase Hosting 自動デプロイ workflow、最小権限 SA + Secrets 設定)
- **Phase 6 品質改善 完了** ✅ (2026-05-13): PR #64 (README に Anonymous UID 永続性 docs) + PR #65 (UserMotion `dispose()` で matchMedia listener cleanup) + PR #66 (Collectible y 計算 bug 真因修正: 床面 y > 0 のハートが +0.15-0.2m 余分浮上していた問題を解消)
- **Phase 6 UX hotfix セッション 完了** ✅ (2026-05-13、PR #69-71): ユーザー実機目視 hotfix 3 件:
  - PR #69 welcome toast 1 文字孤立改行を `\n` + `white-space: pre-line` で 2 行固定
  - PR #70 空 favicon を解消、`scripts/generate-favicon.py` で front-idle のヘッドフォン込みクロップから `favicon.ico` / `favicon-32.png` / `apple-touch-icon.png` を生成
  - PR #71 NPC 服透け (npc-elder/-nurse/-manager で 1.5-4.6% の透明 hole) を `scripts/fill-sprite-internal-holes.py` (4 隅 BFS + 内部白 fill) で解消 + elder NPC 位置 `(15.4, 0, 4)` → `(15.4, 0, 5.5)` でビルボード sprite のベンチ貫通を回避。`Game.ts:setupNpcs` JSDoc に「ベンチ z=4 から 1m 以上離す」forward-looking 制約を追記
- **Phase 6 iPhone 音/操作 hotfix セッション 完了** ✅ (2026-05-13、PR #73-77): iPhone 実機検証起点の 2 件 hotfix + 整理 PR。
  - **真因 (2 つ)**: ①村 BGM/SE が `.ogg` で iOS Safari Web Audio `decodeAudioData()` が OGG Vorbis 非対応 (Safari 18.4+ でも `<audio>` 要素経由のみ、Web Audio 経路は 2026 年現在も不可) → PR #76 で MP3 変換、②端末側面サイレントスイッチ ON (ユーザー側で OFF にして解決)
  - **真因 fix (PR #74 操作 + PR #76 音)**:
    - PR #74 TouchInput `click` → `pointerdown`: 仮想スティック pointercapture 中の右下ボタンが iOS マルチタッチで `click` 取りこぼされる問題を即時発火に変更、`preventDefault()` + `stopPropagation()` 併用
    - PR #76 7 ファイル OGG → MP3 変換 (`ffmpeg -c:a libmp3lame -q:a 4`): `bgm-village.ogg` + se 6 個。`bgm-dance.mp3` は元から MP3 で影響なし
  - **試行錯誤痕跡 (PR #73/#75 + PR #74 の suspended セーフティネット) は PR #77 で整理削除** (AudioManager.ts -81 行 / silent.mp3 -748 bytes)。教訓は global memory に保存: ①iPhone 音問題は最初に AskUserQuestion で端末側面確認 ②iOS Safari Web Audio は OGG decode 不可 ③同一機能 3 連続失敗で元設計再レビュー (CLAUDE.md MUST 補強)
  - **音 asset 構成**: 全 8 ファイル MP3 統一 (bgm-village.mp3 / bgm-dance.mp3 / se-{pickup,mission-clear,jump,land,dialog-open,dialog-next}.mp3)。iOS Safari Web Audio で確実に decode される
- **残課題** (別 PR、優先度順):
  - Issue #31 (`postponed` ラベル付与済、スコープ 3 のみ: 段差エッジ snap 失敗、P2)
  - Rapier 0.20+ init() deprecation 再評価 (0.19.3 が現状最新、未リリース)
  - sprite 輪郭の縮小エイリアシング (PR #45 mipmap が #48 で revert された副作用、品質トレードオフとして許容)。再度 mipmap 化するなら asset pipeline に「RGB bleed + alpha floor clamp + alphaTest」をセットで実装する必要あり
  - Firebase Firestore のバックアップ (PITR) / PR preview channel / Workload Identity Federation 移行 (handoff 残課題 #2-#4、要件整理必要)
- ハンドオフ: `docs/handoff/LATEST.md` 参照 (Phase 5 系の旧履歴は `docs/handoff/2026-05-12_phase5-L.md`)

## 公開 URL と Firebase インフラ (Stage 3 以降)

- リポジトリ: `yasushi-honda-prog/tadakayo-game` (public)
- 新公開 URL (現用): `https://tadakayo-game-yh.web.app/` (Firebase Hosting)
- 旧公開 URL (redirect 中): `https://yasushi-honda-prog.github.io/tadakayo-game/` → 新 URL へ `meta refresh` + `location.replace` で自動転送 (`redirect/index.html` + `.github/workflows/pages-redirect.yml`)
- Firebase プロジェクト: `tadakayo-game-yh` (法人アカウント `yasushi-honda@tadakayo.jp`、organization `797660187808` 配下)
- Firestore: `(default)` database、`asia-northeast1`、`gameRecords/{uid}` コレクション
- Authentication: Anonymous Auth 有効化
- `vite.config.ts` の `base: "/"` (Firebase Hosting ルート配信、`tadakayo-game/` prefix なし)
- デプロイ: `main` push → `.github/workflows/firebase-hosting.yml` で自動 deploy (Stage 4 / 2026-05-13)。手動 fallback は `firebase deploy --only hosting --project tadakayo-game-yh --account yasushi-honda@tadakayo.jp`
- 自動デプロイ用 SA: `github-actions-hosting@tadakayo-game-yh.iam.gserviceaccount.com` (権限 `roles/firebasehosting.admin` のみ、最小権限)。SA JSON key は GitHub Secret `FIREBASE_SERVICE_ACCOUNT_TADAKAYO_GAME_YH` に格納、`VITE_FIREBASE_*` 6 件も Secrets に登録済み

## アカウント / 認証 (env-isolation 準拠)

- GitHub アカウント: `yasushi-honda-prog`（global の `gh auth` の active と異なる可能性あり）
- 認証は **`.envrc` の `GH_TOKEN`** でローカルに閉じる（direnv allow 済み）
- グローバル `gh auth switch` は **しない**（global feedback_account_scope 準拠）
- git identity も **`git config --local`** で `yasushi-honda-prog` 名義に閉じる + `.gitconfig.local` で宣言
  - email: `254105639+yasushi-honda-prog@users.noreply.github.com`
- **Firebase / GCP** (Stage 3 以降): `yasushi-honda@tadakayo.jp` (法人アカウント) で `.envrc` 経由
  - `CLOUDSDK_ACTIVE_CONFIG_NAME=tadakayo-game` (named config、グローバル ACTIVE 不変)
  - `GCP_ACCOUNT="yasushi-honda@tadakayo.jp"` + `FIREBASE_PROJECT="tadakayo-game-yh"`
  - firebase CLI コマンドは `--account yasushi-honda@tadakayo.jp` を都度指定

## 技術スタック

| 項目 | 採用 | 用途 |
|---|---|---|
| Three.js (r169+) | ✓ | レンダリング |
| Rapier 3D (`@dimforge/rapier3d-compat`) | ✓ | 物理（重力、衝突、CharacterController） |
| Vite 5 + TypeScript 5 | ✓ | ビルド/型 |
| Noto Sans JP, Web Audio API | ✓ | フォント、音 |
| **Firebase 12.13 (App + Auth + Firestore)** | ✓ | クラウド永続化 + 匿名認証 (Stage 3 以降) |
| **Firebase Hosting** | ✓ | 本番配信 (Stage 3 以降、GitHub Pages から移行) |

## ディレクトリ構成 (Phase 6 完了時点)

```
src/
├── core/         # PhysicsWorld, Game (メインループ + Stage 1 コンパス + Stage 4 welcome toast)
├── entities/     # Player, Camera (Stage 2 感度), Collectible, NPC, DanceNpc (Stage 4 reduced-motion)
├── world/        # Village (Stage 4 噴水・旗 reduced-motion)
├── input/        # InputBus, KeyboardMouseInput, TouchInput, detectInput
├── ui/           # TitleScreen, HUD (Stage 1 コンパス, Stage 4 welcome), MissionPanel, DialogBox,
│                 #   PauseMenu (Stage 2 設定 UI), ScoreScreen (Stage 3 自己ベスト), MobileControls
├── missions/     # Mission, MissionManager, missions/{Collect,Reach,Talk,Dance,Meta}Mission
├── audio/        # AudioManager (Stage 2 BGM/SE 個別音量)
├── config/       # brand.ts, gameConfig.ts (PHYSICS/PLAYER/CAMERA),
│                 #   UserSettings.ts (Stage 2), UserMotion.ts (Stage 4),
│                 #   GameRecord.ts (Stage 3, Firestore+localStorage hybrid),
│                 #   firebase.ts (Stage 3, FirebaseService)
└── styles/main.css
firebase.json / .firebaserc / firestore.rules / firestore.indexes.json   # Stage 3
.env.example / .env.local (gitignore)                                    # Stage 3 Vite env
.gitconfig.local                                                         # env-isolation 準拠
```

## アセット (Phase 5-G 完了時点)

```
public/assets/
├── images/       # タダカヨちゃん 14 + dance 4 (front-dance-1..4) + NPC 3 + title-logo (計 22 PNG)
└── audio/        # bgm-village.mp3 + bgm-dance.mp3 (Mixkit "Karma" EDM 2:15) + se-{pickup,mission-clear,jump,land,dialog-open,dialog-next}.mp3
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
