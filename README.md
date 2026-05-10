# タダカヨ ランナー

NPO法人タダカヨの法人内イベント用 3D ランナーゲーム。
タダカヨちゃんと一緒に「介護 DX の旅路」を駆け抜けて、ITツール（タダスク／タダレク／タダコミュ）を集めながら笑顔のゴールを目指します。

公開 URL: https://yasushi-honda-prog.github.io/tadakayo-game/

## 操作

| 環境 | 移動 | ジャンプ |
|------|------|----------|
| PC | ← → / A・D | Space / W / ↑ |
| モバイル | 左右タップ または 左右スワイプ | 上スワイプ または 画面上部タップ |

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

- **Three.js (r169)** で 3D 描画
- **Vite 5 + TypeScript 5** でビルド／HMR
- **3 レーン固定 + 簡易 AABB** で衝突判定（cannon-es 等の物理エンジン不要）
- **HTML overlay** でタイトル／HUD／結果画面（DOM のシンプルさを活用）

| ディレクトリ | 役割 |
|--------------|------|
| `src/game/` | ゲームロジック（Scene / Player / Track / Spawner / Obstacle / Collectible / Input / GameState） |
| `src/ui/` | HTML overlay UI（TitleScreen / HUD / ResultScreen） |
| `src/config/` | ブランド定数（`brand.ts`）とゲームバランス（`gameConfig.ts`） |
| `src/styles/` | CSS（Noto Sans JP, ブランドカラー） |

## デプロイ

`main` ブランチに push すると GitHub Actions が自動でビルドし GitHub Pages にデプロイします。
GitHub の Settings → Pages → Source を **GitHub Actions** に設定してください（初回のみ）。

## ブランドガイドライン

NPO法人タダカヨ ブランドガイドラインに準拠:

- プライマリ: `#e33535`
- セカンダリ: `#ffe2f7`
- フォント: Noto Sans JP

## クレジット

- フォント: [Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP) (SIL Open Font License)
- 3D: [three.js](https://threejs.org/) (MIT License)
- ビルド: [Vite](https://vitejs.dev/) (MIT License)
- BGM/SE: 法人内イベント用素材を別途追加予定

## ライセンス

リポジトリ内のソースコードは MIT License。
ブランドガイドライン由来の文字・カラー・キャラクター指定は NPO法人タダカヨに帰属します。
