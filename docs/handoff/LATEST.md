# タダカヨ村 3D オープンワールド — セッションハンドオフ

最終更新: 2026-05-10

## 現在地点

- **リポジトリ**: [yasushi-honda-prog/tadakayo-game](https://github.com/yasushi-honda-prog/tadakayo-game)
- **公開 URL**: https://yasushi-honda-prog.github.io/tadakayo-game/
- **作業ディレクトリ**: `/Users/yyyhhh/Projects/tadakayo/game-ai`
- **現在ブランチ**: `feat/openworld-sprites`
- **未マージ PR**: [#6](https://github.com/yasushi-honda-prog/tadakayo-game/pull/6) — 認可待ち

## 次セッションで最初にやること

1. `cd /Users/yyyhhh/Projects/tadakayo/game-ai && direnv allow` で `GH_TOKEN` を読み込む
2. **本番 URL で実機操作確認**:
   - クリックで視点ロック → カーソル消失
   - WASD 移動、マウスで視点回転
   - 「W で背中」「S で顔」「A で左側面」「D で右側面」が **正しく一致**するか
   - Space ジャンプ + バッファ（連打で連続ジャンプ）
3. 問題なければ **PR #6 を merge**:
   ```bash
   gh pr merge 6 --squash --delete-branch
   git checkout main && git pull --ff-only
   ```
4. **Phase 5-B 着手**（タダカヨ村ステージ構築）

## これまでの経緯

| Phase | 概要 | 状態 |
|---|---|---|
| 0 | Vite + TS + Three.js scaffold + GitHub Pages CI/CD | ✅ main 反映 |
| 1 | ランナー コアループ | ✅ main 反映 |
| 2 | nano-banana ブランド画像 + ロゴ統合 | ✅ main 反映 |
| 3-4 | ランナー深掘り（しゃがみ/コンボ/シールド/難易度/音/ステージ進行/チュートリアル） | ❌ PR #4 close（ピボットのため） |
| 5-A | Rapier 物理 + KinematicCharacterController + 三人称カメラ + テストアリーナ | ✅ PR #5 main 反映 |
| 5-A 拡張 | 4 方向スプライト 12 枚 + Player 多方向切替 + バグ修正 3 件 | 🟡 PR #6 認可待ち |
| 5-B | タダカヨ村ステージ構築（中央広場 + 塔 + 広場 + 会館 + 装飾） | 🔜 次セッション |
| 5-C | ミッション基盤 + Collect/Reach 2 本 | 🔜 |
| 5-D | NPC + 会話 + Talk ミッション 1 本 | 🔜 |
| 5-E | モバイル対応（仮想スティック + ボタン）+ 残ミッション | 🔜 |
| 5-F | 演出 + パフォーマンス + 仕上げ | 🔜 |

詳細プラン: `/Users/yyyhhh/.claude/plans/yasushi-honda-prog-github-githubpages-us-transient-summit.md`

## PR #6 に含まれている内容

| Commit | 内容 |
|---|---|
| 9b4e021 | 4 方向 sprite 8 枚追加 + Player 多方向切替 |
| c948155 | 方向判定の π オフセット修正（W=背中/S=顔/A=反転/D=右） |
| a9d416d | 左向き sprite 4 枚追加 + 視点ロックの CSS 修正 |

ファイル: 13 file changed (12 sprite + Player.ts + main.css)。

## キャラクタースプライト（12 種、すべて完全透明背景）

| | idle | run | jump | crouch |
|---|---|---|---|---|
| **front** | front-idle ✓ | run ✓ | jump ✓ | — |
| **back** | back-idle ✓ | back-run ✓ | back-jump ✓ | — |
| **sideRight** | side-idle ✓ | side-run ✓ | side-jump ✓ | side-crouch ✓ |
| **sideLeft** | side-left-idle ✓ | side-left-run ✓ | side-left-jump ✓ | side-left-crouch ✓ |

front-crouch / back-crouch は side-crouch でフォールバック。

**既知の品質課題** (Phase 5-F で対処):
- AI 生成キャラが裸足（靴を描いていない sprite が多い）。元 run には白いスニーカーがあったが、追加 sprite 群はプロンプトに `shoes` を含めなかった結果一貫性低下
- 解決: Phase 5-F の仕上げで「red sneakers」を全 sprite で再生成 or 上から sprite に靴を合成

## アーキテクチャ概要

```
src/
├── core/
│   ├── PhysicsWorld.ts     # Rapier WASM ラッパー、async create()
│   └── Game.ts             # メインループ、固定タイムステップ、シーン統合
├── entities/
│   ├── Player.ts           # KinematicCharacterController + 4 方向 sprite 切替
│   └── Camera.ts           # 三人称後方追従、yaw/pitch 入力、lerp 補間
├── world/
│   └── TestArena.ts        # Phase 5-A テスト用平地・段差・足場（5-B で Village に置換）
├── input/
│   ├── InputBus.ts         # 統一入力バス（move/look/jump/action/run/pause）
│   └── KeyboardMouseInput.ts  # WASD + Pointer Lock + Space + E + Shift
├── ui/
│   ├── TitleScreen.ts      # スタート画面
│   └── HUD.ts              # 座標表示（Phase 5-C でミッション表示に拡張）
├── audio/AudioManager.ts   # Web Audio 合成 SE/BGM
├── config/
│   ├── brand.ts            # ブランドカラー
│   └── gameConfig.ts       # PHYSICS / PLAYER / CAMERA 定数
└── main.ts                 # async ブートストラップ
```

## 重要文脈・ユーザー要求

- **クオリティ最優先**「どこに出しても恥ずかしくないクオリティ」「3D マリオレベル」
- **時間がかかってもよい**（10 営業日想定）
- 介護業界 DX 推進担当者がプレイ → 操作はシンプルに、難易度は緩めに
- これまでに却下されたもの:
  - エンドレスランナー（タイミングストレス、単調）
  - 圧縮しゃがみ（雑なモーション）
  - 矢印アイコンが手前で巨大化（空間表現として違和感）

## アカウント・認証

- GitHub: `yasushi-honda-prog` アカウント（`yasushi-honda` ではない）
- `.envrc` で `GH_TOKEN` をローカル閉じ込め（direnv allow 済）
- グローバル `gh auth switch` は **しない**
- git identity も `--local` で `yasushi-honda-prog` 名義

## 残留プロセス

- vite dev server (PID 10367) が起動中。停止するには:
  ```bash
  ~/.claude/scripts/cleanup-node.sh --kill
  ```

## 既知の制約

- bundle size 2.7 MB (gzip 960 KB) — Rapier WASM が大半。Phase 5-F で code split 検討
- iOS Safari は Pointer Lock が限定的サポート → モバイル操作は Phase 5-E で仮想スティック実装予定
- favicon.ico 404（実害なし、Phase 5-F でファビコン追加）

## 公式作品としての位置づけ

ユーザーは **NPO法人タダカヨの代表/運営者**。本作は法人内イベント用 + 公式コンテンツ。
ロゴ・キャラクター指定は NPO 法人タダカヨに帰属。コードは MIT。
