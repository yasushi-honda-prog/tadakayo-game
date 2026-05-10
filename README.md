# タダカヨ村

NPO法人タダカヨ公式 3D オープンワールド・プラットフォーマー。
タダカヨちゃんと一緒に「タダカヨ村」でミッションをクリアしながら介護 DX の世界を冒険します。

公開 URL: https://yasushi-honda-prog.github.io/tadakayo-game/

> 開発状態: **Phase 5-B 完了**（物理 + 三人称カメラ + 4 方向スプライト + タダカヨ村ステージ）。次フェーズで Collect / Reach のミッション基盤を実装。

## 操作

| 操作 | PC | モバイル（Phase 5-E 実装予定） |
|------|----|----|
| 視点ロック | キャンバスをクリック（Esc で解除） | — |
| 視点回転 | マウス | スワイプ |
| 移動 | WASD / 矢印 | 仮想スティック |
| 走る | Shift | （長押し） |
| ジャンプ | Space / W / ↑ | ジャンプボタン |
| アクション | E | アクションボタン |
| ポーズ | Esc / P | ポーズアイコン |

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
| `src/ui/` | タイトル画面、HUD、（Phase 5-C 以降）ミッションパネル・会話 |
| `src/audio/` | Web Audio API での SE/BGM 合成 |
| `src/config/` | ブランド定数（`brand.ts`）、物理・カメラ・プレイヤー設定（`gameConfig.ts`） |
| `public/assets/images/` | タダカヨちゃん 4 方向 sprite（12 種）+ ロゴ |
| `scripts/remove-checker-bg.py` | nano-banana 生成画像のチェッカー柄背景を 4 隅連結成分で透明化 |

## ロードマップ

| Phase | 概要 | 状態 |
|---|---|---|
| 5-A | Rapier 物理 + 三人称カメラ + テストアリーナ + 4 方向 sprite | ✅ 完了 |
| 5-B | タダカヨ村ステージ（中央広場 + タダスクの塔 + タダレク広場 + タダコミュ会館 + 装飾 + 柵） | ✅ 完了 |
| 5-C | ミッション基盤 + Collect / Reach ミッション 2 本 | 🔜 |
| 5-D | NPC + 会話 + Talk ミッション | 🔜 |
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
- BGM/SE: Web Audio API による合成（外部素材なし）

## ライセンス

- ソースコード: MIT License
- ブランドガイドライン由来の文字・カラー・キャラクター指定は NPO法人タダカヨに帰属
