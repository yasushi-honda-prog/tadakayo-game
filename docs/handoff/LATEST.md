# タダカヨ村 3D オープンワールド — セッションハンドオフ

最終更新: 2026-05-10

## 現在地点

- **リポジトリ**: [yasushi-honda-prog/tadakayo-game](https://github.com/yasushi-honda-prog/tadakayo-game)
- **公開 URL**: https://yasushi-honda-prog.github.io/tadakayo-game/
- **作業ディレクトリ**: `/Users/yyyhhh/Projects/tadakayo/game-ai`
- **現在ブランチ**: `main`（同期済み、最新コミット `38c0e4f`）
- **未マージ PR**: なし（PR #5〜#11 すべて main 反映、Deploy 完了）

## 次セッションで最初にやること

1. `cd /Users/yyyhhh/Projects/tadakayo/game-ai && direnv allow` で `GH_TOKEN` を読み込む
2. **本番 URL で Phase 5-B + 5-C 実機操作確認**:
   - スポーン位置: 中央広場の南手前 (x=0, z=6)
   - HUD 上部に「現在のミッション DXの種を集めよう 0/10」が表示
   - WASD で移動 + マウスクリックで視点ロック
   - **DXの種**（赤いハート）が中央広場周辺・パス沿い・タダレク広場に 10 個浮遊回転
     - 1 個近づく → SE 鳴動 + 進捗が 1/10 → ... → 10/10 で「クリア！」toast
   - **タダスクの塔へ**: 西の塔 (-18, 4) の 5 段ジャンプを Space で登る → 頂上で「クリア！」toast
   - **M キー** でミッションパネル開閉、active/completed 表示確認
   - 街灯・木・ベンチに正しく衝突、外周 30m 柵で落下防止
3. 問題なければ **Phase 5-D 着手**（NPC + 会話 + Talk ミッション 1 本）

## これまでの経緯

| Phase | 概要 | 状態 |
|---|---|---|
| 0 | Vite + TS + Three.js scaffold + GitHub Pages CI/CD | ✅ main 反映 |
| 1 | ランナー コアループ | ✅ main 反映 |
| 2 | nano-banana ブランド画像 + ロゴ統合 | ✅ main 反映 |
| 3-4 | ランナー深掘り（しゃがみ/コンボ/シールド/難易度/音/ステージ進行/チュートリアル） | ❌ PR #4 close（ピボットのため） |
| 5-A | Rapier 物理 + KinematicCharacterController + 三人称カメラ + テストアリーナ | ✅ PR #5 main 反映 |
| 5-A 拡張 | 4 方向スプライト 12 枚 + Player 多方向切替 + バグ修正 3 件 | ✅ PR #6 main 反映 |
| 5-A 文書 | README/CLAUDE.md 更新 + ピボット ADR | ✅ PR #7 main 反映 |
| 5-B | タダカヨ村ステージ構築（中央広場 + 塔 + 広場 + 会館 + 装飾） | ✅ PR #8 main 反映 |
| 5-B 文書 | README/CLAUDE.md/ハンドオフ更新 | ✅ PR #9 main 反映 |
| sprite 整合化 | 14 枚を統一スタイルで再生成 + remove-checker-bg 改良 | ✅ PR #10 main 反映 |
| 5-C | ミッション基盤 + Collect/Reach 2 本 + MissionPanel + HUD 拡張 | ✅ PR #11 main 反映 |
| 5-D | NPC + 会話 + Talk ミッション 1 本 | 🔜 次セッション |
| 5-E | モバイル対応（仮想スティック + ボタン）+ 残ミッション | 🔜 |
| 5-F | 演出 + パフォーマンス + 仕上げ | 🔜 |

詳細プラン: `/Users/yyyhhh/.claude/plans/yasushi-honda-prog-github-githubpages-us-transient-summit.md`

## Phase 5-C で追加された Mission 基盤

### ディレクトリ

```
src/missions/
├── Mission.ts              # 抽象 base + MissionContext (不変スナップショット)
├── MissionManager.ts       # active/completed + onChange/onCleared
└── missions/
    ├── CollectMission.ts   # Collectible 配列を集計、全取得でクリア
    └── ReachMission.ts     # XZ 距離 + Y tolerance で目標到達判定
src/entities/Collectible.ts # 浮遊回転ハート (球+円錐)、近接 0.9m で取得
src/ui/MissionPanel.ts      # M キー開閉 modal、active/completed 一覧
src/ui/HUD.ts               # 現在ミッション + 進捗 X/N + クリア toast
```

### Mission base 拡張パターン (Phase 5-D 設計の鍵)

`src/missions/Mission.ts` の docstring に明記済みの 3 パターン:
1. **位置駆動** (ReachMission): 毎フレーム `ctx.playerPosition` で判定
2. **収集駆動** (CollectMission): 外部 entity (Collectible) を集計
3. **イベント駆動** (TalkMission, 5-D で実装): NPC.onTalk から `mission.notifyEvent()` を呼んで `current` 加算。`update(ctx)` は no-op。

`MissionContext.playerPosition` は **`Readonly<{x,y,z}>` の不変スナップショット**（PR #11 codex review Medium 対応で Vector3 mutation 経路を断った）。

## Phase 5-D 着手プラン（次セッション）

新規ファイル:

```
src/entities/NPC.ts                  # ビルボード sprite + 近接 trigger + onTalk emit
src/missions/missions/TalkMission.ts # 訪問済み NPC ID set を集計
src/ui/DialogBox.ts                  # 吹き出し UI、E キー/タップで進行
public/assets/images/
├── npc-elder.png                    # 高齢者 NPC (nano-banana 生成)
├── npc-nurse.png                    # 看護師 NPC
└── npc-manager.png                  # 施設長 NPC
```

NPC 配置案:
- 高齢者: タダレク広場のベンチ近く `(18 - 2.6, 0, 4)`
- 看護師: タダコミュ会館の入口 `landmarks.hallEntrance`
- 施設長: 中央広場の南東 `(3, 0, 3)`

ミッション: 「現場の声を聞こう」= 全 3 NPC と E キーで会話。

NPC.onTalk から TalkMission.notifyTalked(npcId) を呼ぶ。Mission の cleared 判定は visitedIds.size >= 3。

入力: E キー (action) で近接 NPC があれば dialog 開始 → DialogBox が次の line を表示 → 最後で onTalk 発火。

## アーキテクチャ概要

```
src/
├── core/
│   ├── PhysicsWorld.ts     # Rapier WASM ラッパー
│   └── Game.ts             # メインループ + MissionManager 統合
├── entities/
│   ├── Player.ts           # KinematicCharacterController + 4 方向 sprite
│   ├── Camera.ts           # 三人称後方追従、yaw/pitch
│   ├── Collectible.ts      # ハート (浮遊回転 + 近接トリガ)
│   └── NPC.ts              # 5-D 新規
├── world/Village.ts        # タダカヨ村全体
├── missions/               # 5-C で追加した Mission 基盤
│   ├── Mission.ts
│   ├── MissionManager.ts
│   └── missions/{Collect,Reach,Talk}Mission.ts
├── input/
│   ├── InputBus.ts         # move/look/jump/action/run/pause/panel
│   └── KeyboardMouseInput.ts  # WASD + Space + E + M + Shift + Pointer Lock
├── ui/
│   ├── TitleScreen.ts
│   ├── HUD.ts              # 座標 + 現在ミッション + 進捗 + toast
│   ├── MissionPanel.ts     # M キー開閉
│   └── DialogBox.ts        # 5-D 新規
├── audio/AudioManager.ts   # SE/BGM 合成 (pickupSE / missionClearSE / dialogSE 実装済)
├── config/{brand,gameConfig}.ts
└── main.ts
```

## 重要文脈・ユーザー要求

- **クオリティ最優先**「どこに出しても恥ずかしくないクオリティ」「3D マリオレベル」
- **時間がかかってもよい**（10 営業日想定）
- 介護業界 DX 推進担当者がプレイ → 操作はシンプルに、難易度は緩めに
- これまでに却下されたもの:
  - エンドレスランナー（タイミングストレス、単調）
  - 圧縮しゃがみ（雑なモーション）
  - 矢印アイコンが手前で巨大化（空間表現として違和感）
- **本セッションで対応**: 14 枚スプライトの服装・足元・顔つきの整合性を統一プロンプト再生成で復旧 (PR #10)

## アカウント・認証

- GitHub: `yasushi-honda-prog` アカウント（`yasushi-honda` ではない）
- `.envrc` で `GH_TOKEN` をローカル閉じ込め（direnv allow 済）
- グローバル `gh auth switch` は **しない**
- git identity も `--local` で `yasushi-honda-prog` 名義
- nano-banana (Vertex AI / Gemini 3.1 Flash Image) は `gcloud auth print-access-token --account=hy.unimail.11@gmail.com` で取得した user account token を使う（skill 規定 + Phase 2/5-A/5-sprite で同パターン）

### nano-banana 利用時の注意（PR #10 で蓄積した運用知）

- 連続生成は 6 秒間隔でも 5-6 枚で 429 (quota exhaust) に遭遇する。**実用は 12-15 秒間隔 + リトライ (15→30→60s exponential backoff)** が安全
- 14 枚一括生成は 7-8 分かかる前提。run_in_background で
- AI が暗いチェッカー柄背景を描く画像があり、`scripts/remove-checker-bg.py` の旧版 (`r >= 180` 閾値) では透明化失敗。改良版 (透明 + 純黒 + 明灰を bg_candidate) で対応済み

## リポジトリ設定の積み残し（次回ユーザー判断）

- **デフォルトブランチが `feat/bootstrap` のまま**残っている（Phase 0 初期化の名残）。
  PR 作成時の base が誤って `feat/bootstrap` になり、毎回 `gh pr edit <N> --base main` で
  修正している。次回ユーザー認可があれば以下を実行して恒久解決:
  ```bash
  gh api -X PATCH /repos/yasushi-honda-prog/tadakayo-game -f default_branch=main
  ```

## 残留プロセス

- vite dev server は今セッション末で停止済み。確認:
  ```bash
  ~/.claude/scripts/cleanup-node.sh
  ```

## 既知の制約

- bundle size 2.74 MB (gzip 965.5 KB) — Rapier WASM が大半。Phase 5-F で code split 検討
- iOS Safari は Pointer Lock が限定的サポート → モバイル操作は Phase 5-E で仮想スティック実装予定
- favicon.ico 404（実害なし、Phase 5-F でファビコン追加）
- DXの種 (Heart) は球 2 + 円錐の幾何形状。Phase 5-F で nano-banana の専用テクスチャに差し替え検討

## 公式作品としての位置づけ

ユーザーは **NPO法人タダカヨの代表/運営者**。本作は法人内イベント用 + 公式コンテンツ。
ロゴ・キャラクター指定は NPO 法人タダカヨに帰属。コードは MIT。
