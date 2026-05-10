# tadakayo-game プロジェクト固有の前提

## 位置づけ

- NPO法人タダカヨ（本人運営）の **法人内イベント用** 3D ランナーゲーム
- 一般公開を主目的とした PR コンテンツではない（GitHub Pages の URL は身内に共有して遊ぶ用）
- **重く考える必要はない** スコープ。リスク評価は社内利用範囲で十分

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

## ブランド定数（`src/config/brand.ts`）

| 用途 | 値 |
|------|----|
| プライマリ赤 | `#e33535` |
| セカンダリ ピンク | `#ffe2f7` |
| フォント | Noto Sans JP |
| マスコット要素 | 黄色ショートヘア + ピンクのヘッドフォン + 赤い着物（3 要素を必ず維持） |

NG（ブランドガイドライン由来）:
- 暴力・恐怖・暗いトーン
- ロゴ変形・指定色外使用
- ドロップシャドウ装飾の濫用

## ゲームバランス（`src/config/gameConfig.ts`）

- レーン: x = `[-2, 0, 2]` の 3 レーン固定、移動は lerp 0.18
- 速度: 初期 6 m/s → 10 秒ごと +0.6、上限 13 m/s
- スポーン間隔: 初期 1.4 秒 → 経過と共に短縮、最短 0.7 秒
- 当たり判定: 足元中心の小さめ Box（理不尽感緩和）
- 収集判定: 広めの Box（取り損ね防止）

## デプロイ

- `main` push → GitHub Actions が自動デプロイ
- 初回のみ GitHub Settings → Pages → Source を **GitHub Actions** に手動設定
- workflow: `.github/workflows/deploy.yml`

## モバイル対応の注意

- iOS Safari の WebGL は対応済だが、`AudioContext` は **初回ユーザー操作後** に `resume()` 必須
- viewport は `width=device-width, initial-scale=1.0, maximum-scale=1.0` でズーム抑止
- タッチイベントは `passive: false` で `preventDefault` してスクロール抑止

## 検証コマンド

```bash
npm run dev         # ローカル開発
npm run typecheck   # 型チェック
npm run build       # 本番ビルド
npm run preview     # 本番ビルドのローカル確認
```

Playwright MCP でブラウザ動作確認可。`http://localhost:5173/tadakayo-game/` (base path 必須)。
