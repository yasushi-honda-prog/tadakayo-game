# タダカヨ村

NPO法人タダカヨ公式 3D オープンワールド・プラットフォーマー。
タダカヨちゃんと一緒に「タダカヨ村」でミッションをクリアしながら介護 DX の世界を冒険します。

公開 URL: https://yasushi-honda-prog.github.io/tadakayo-game/

> 開発状態: **Phase 5-D 完了**（物理 + 三人称カメラ + タダカヨ村 + ミッション基盤 + Collect/Reach/Talk 3 本 + NPC 3 体 + 会話 UI + フリー音素材）。次フェーズで モバイル対応 (仮想スティック) + 残ミッション。

## 操作

| 操作 | PC | モバイル（Phase 5-E 実装予定） |
|------|----|----|
| 視点ロック | キャンバスをクリック（Esc で解除） | — |
| 視点回転 | マウス | スワイプ |
| 移動 | WASD / 矢印 | 仮想スティック |
| 走る | Shift | （長押し） |
| ジャンプ | Space / W / ↑ | ジャンプボタン |
| アクション | E | アクションボタン |
| ミッション一覧 | M | ミッションアイコン |
| ポーズ | Esc / P | ポーズアイコン |

## ミッション

| # | タイトル | 種類 | クリア条件 |
|---|---|---|---|
| 1 | DXの種を集めよう | Collect | 中央広場・パス沿い・タダレク広場の赤いハートを 10 個取得 |
| 2 | タダスクの塔へ | Reach | 西の塔の 5 段ジャンプ頂上に到達 |
| 3 | 現場の声を聞こう | Talk | 利用者・看護師・施設長の 3 NPC と E キーで会話 |

## 開発

```bash
# 依存インストール
npm install

# 開発サーバ
npm run dev
# → http://localhost:5173/tadakayo-game/

# 型チェック
npm run typecheck

# 本番ビルド
npm run build

# 本番ビルドをローカル確認
npm run preview
```

## アーキテクチャ概要

- **Three.js (r169+)** で 3D 描画
- **Rapier 3D** (`@dimforge/rapier3d-compat`) で物理（重力、衝突、KinematicCharacterController）
- **Vite 5 + TypeScript 5** でビルド／HMR
- **4 方向ビルボード**（front / back / sideRight / sideLeft）でキャラ表現
- **HTML overlay** でタイトル／HUD（DOM のシンプルさを活用）

| ディレクトリ | 役割 |
|--------------|------|
| `src/core/` | `PhysicsWorld`（Rapier ラッパー）、`Game`（メインループ） |
| `src/entities/` | `Player`（KinematicCharacterController + sprite 切替）、`Camera`（三人称後方追従） |
| `src/world/` | ステージ・ワールドの構築（`Village` = タダカヨ村全体: 中央広場・塔・広場・会館・装飾・柵） |
| `src/input/` | `InputBus`（統一入力）、`KeyboardMouseInput`（PC 入力）、Phase 5-E で `TouchInput` 追加 |
| `src/ui/` | タイトル画面、HUD（座標＋現在ミッション＋クリア toast＋アクションヒント）、`MissionPanel`（M キー開閉）、`DialogBox`（NPC 会話） |
| `src/missions/` | `Mission` 抽象基底、`MissionManager`、`CollectMission`／`ReachMission`／`TalkMission` |
| `src/audio/` | `AudioManager` (kenney.nl の OGG 音源を Web Audio decode、BGM ループ + SE) |
| `src/config/` | ブランド定数（`brand.ts`）、物理・カメラ・プレイヤー設定（`gameConfig.ts`） |
| `public/assets/images/` | タダカヨちゃん 4 方向 sprite（14 種）+ NPC 3 体 + ロゴ |
| `public/assets/audio/` | BGM (Pizzicato jingle ループ) + SE (pickup/mission-clear/jump/land/dialog-open/dialog-next) |
| `scripts/remove-checker-bg.py` | nano-banana 生成画像のチェッカー柄背景を 4 隅連結成分で透明化（暗チェッカー対応 + 靴保護版） |

## ロードマップ

| Phase | 概要 | 状態 |
|---|---|---|
| 5-A | Rapier 物理 + 三人称カメラ + テストアリーナ + 4 方向 sprite | ✅ 完了 |
| 5-B | タダカヨ村ステージ（中央広場 + タダスクの塔 + タダレク広場 + タダコミュ会館 + 装飾 + 柵） | ✅ 完了 |
| 5-C | ミッション基盤 + Collect / Reach ミッション 2 本 + MissionPanel + HUD 拡張 | ✅ 完了 |
| 5-D | NPC + 会話 + Talk ミッション + フリー音素材 (kenney.nl) | ✅ 完了 |
| 5-E | モバイル対応（仮想スティック + ボタン） + 残ミッション | 🔜 |
| 5-F | 演出 + パフォーマンス（InstancedMesh, code split）+ 仕上げ | 🔜 |

詳細プラン: `~/.claude/plans/yasushi-honda-prog-github-githubpages-us-transient-summit.md`

## デプロイ

`main` ブランチに push すると GitHub Actions が自動でビルドし GitHub Pages にデプロイします。
GitHub の Settings → Pages → Source は **GitHub Actions** に設定済み。

## ブランドガイドライン

NPO法人タダカヨ ブランドガイドラインに準拠:

- プライマリ: `#e33535`
- セカンダリ: `#ffe2f7`
- フォント: Noto Sans JP
- マスコット: タダカヨちゃん（黄色ショートヘア + ピンクのヘッドフォン + 赤い和風ジャケット）

## クレジット

- フォント: [Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP) (SIL Open Font License)
- 3D: [three.js](https://threejs.org/) (MIT)
- 物理: [Rapier](https://rapier.rs/) (Apache-2.0)
- ビルド: [Vite](https://vitejs.dev/) (MIT)
- 効果音: [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) (CC0)
- BGM (タダカヨ村テーマ) / ミッションクリア jingle: [Kenney Music Jingles](https://kenney.nl/assets/music-jingles) (CC0)
- キャラクター/NPC スプライト: nano-banana (Vertex AI Gemini 3.1 Flash Image) で本プロジェクト用に生成

## ライセンス

- ソースコード: MIT License
- ブランドガイドライン由来の文字・カラー・キャラクター指定は NPO法人タダカヨに帰属
