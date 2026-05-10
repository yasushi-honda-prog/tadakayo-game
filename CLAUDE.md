# tadakayo-game プロジェクト固有の前提

## 位置づけ

- NPO法人タダカヨ（本人運営）公式の **3D オープンワールド・プラットフォーマー**
- 「タダカヨ村」を舞台に、ミッションをクリアしながら介護 DX の世界を冒険する
- 法人内イベント + 公式コンテンツとしての配信が主目的（一般公開も視野）
- ユーザーが目指す品質: **「どこに出しても恥ずかしくないクオリティ」**（itch.io の良質作品レベル）

## 開発状態（2026-05-10 時点）

- **Phase 5-B 完了**: タダカヨ村ステージ（中央広場 + タダスクの塔 + タダレク広場 + タダコミュ会館 + 装飾）が `src/world/Village.ts` に集約
- **次フェーズ**: 5-C ミッション基盤 → 5-D NPC → 5-E モバイル → 5-F 仕上げ
- 過去の経緯: Phase 0-2 ランナー（main 反映）→ Phase 3-4 ランナー深掘り（PR #4 close でピボット）→ Phase 5-A Rapier 物理 + 三人称カメラ + 4 方向スプライト → Phase 5-B 村ステージ
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

## ディレクトリ構成（Phase 5-A 以降）

```
src/
├── core/         # PhysicsWorld, Game (メインループ)
├── entities/     # Player, Camera, NPC (5-D), Collectible (5-C)
├── world/        # TestArena (5-A), Village (5-B)
├── input/        # InputBus, KeyboardMouseInput, TouchInput (5-E)
├── ui/           # TitleScreen, HUD, MissionPanel (5-C), DialogBox (5-D), MobileControls (5-E)
├── missions/     # MissionManager, Mission, missions/* (5-C 以降)
├── audio/        # AudioManager
├── config/       # brand.ts, gameConfig.ts (PHYSICS / PLAYER / CAMERA)
└── styles/main.css
```

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

## キャラクタースプライト（12 種）

| | idle | run | jump | crouch |
|---|---|---|---|---|
| **front** | `tadakayo-front-idle.png` | `tadakayo-run.png` | `tadakayo-jump.png` | — |
| **back** | `tadakayo-back-idle.png` | `tadakayo-back-run.png` | `tadakayo-back-jump.png` | — |
| **sideRight** | `tadakayo-side-idle.png` | `tadakayo-side-run.png` | `tadakayo-side-jump.png` | `tadakayo-side-crouch.png` |
| **sideLeft** | `tadakayo-side-left-idle.png` | `tadakayo-side-left-run.png` | `tadakayo-side-left-jump.png` | `tadakayo-side-left-crouch.png` |

front/back の crouch は side で代用。

すべて nano-banana (Gemini 3.1 Flash Image) で生成し、`scripts/remove-checker-bg.py` で完全透明化済み。

**既知の品質課題**: 追加 sprite 群でキャラが裸足（プロンプトに `shoes` 含めず）。Phase 5-F で再生成予定。

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
- bundle size: 約 2.7 MB（gzip 960 KB、Rapier WASM 込み）— Phase 5-F で code split による遅延ロード予定

## モバイル対応

- 現状: PC のみ動作（Pointer Lock 必須）
- iOS Safari の Pointer Lock は限定対応 → Phase 5-E で仮想スティック実装予定
- viewport は `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no`
- タッチイベントは `passive: false` で `preventDefault` してスクロール抑止

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
