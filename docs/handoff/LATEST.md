# タダカヨ村 3D オープンワールド — セッションハンドオフ

最終更新: 2026-05-10

## 現在地点

- **リポジトリ**: [yasushi-honda-prog/tadakayo-game](https://github.com/yasushi-honda-prog/tadakayo-game)
- **公開 URL**: https://yasushi-honda-prog.github.io/tadakayo-game/
- **作業ディレクトリ**: `/Users/yyyhhh/Projects/tadakayo/game-ai`
- **現在ブランチ**: `main`（同期済み、最新コミット `fe7c6d9`）
- **未マージ PR**: なし（PR #5〜#8 すべて main 反映）

## 次セッションで最初にやること

1. `cd /Users/yyyhhh/Projects/tadakayo/game-ai && direnv allow` で `GH_TOKEN` を読み込む
2. **本番 URL で Phase 5-B 実機操作確認**:
   - スポーン位置: 中央広場の南手前 (x=0, z=6)、起動直後にロゴモニュメントが正面
   - WASD で移動、マウスで視点回転
   - 中央広場のピンク石畳と赤い縁取りが見える
   - 北のタダコミュ会館（赤屋根）に歩いて行ける、壁を抜けない
   - 西のタダスクの塔の 5 段を Space ジャンプで登れる、頂上に旗
   - 東のタダレク広場の噴水・ベンチに到達できる
   - 街灯・木・ベンチに正しく衝突する
   - 外周 30m を超えて出られない（柵で落下防止）
3. 問題なければ **Phase 5-C 着手**（ミッション基盤 + Collect/Reach 2 本）

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
| 5-C | ミッション基盤 + Collect/Reach 2 本 | 🔜 次セッション |
| 5-D | NPC + 会話 + Talk ミッション 1 本 | 🔜 |
| 5-E | モバイル対応（仮想スティック + ボタン）+ 残ミッション | 🔜 |
| 5-F | 演出 + パフォーマンス + 仕上げ | 🔜 |

詳細プラン: `/Users/yyyhhh/.claude/plans/yasushi-honda-prog-github-githubpages-us-transient-summit.md`

## Phase 5-B でできた村の構造

### レイアウト（俯瞰、+X 東 / +Z 南、原点が中央広場の中心）

```
                      +Z 北
                 タダコミュ会館
                  (0, -22)
                 [白壁8x4x8 + 赤屋根]


    タダスクの塔     中央広場     タダレク広場
     (-18, 4)        (0, 0)         (18, 4)
     [5段ジャンプ    [ピンク石畳    [8x8床+噴水
      頂上に旗]      直径16m]       +ベンチ2]

                      SPAWN
                      (0,4,6)
                      -Z 南
```

外周 30m 四方の柵で落下防止、中央広場 ↔ 各エリアを淡いベージュのパスで接続。

### Phase 5-C で参照する公開座標

`Village.landmarks` で以下を公開（`MissionManager` の入力として使う）:

```ts
landmarks = {
  plazaCenter: Vector3(0, 0, 0),
  towerTop:    Vector3(-18, ~3.6, ~-4.8),
  rekuCenter:  Vector3(18, 0.2, 4),
  hallEntrance: Vector3(0, 0, -17.5),
}
```

## Phase 5-C 着手プラン（次セッション最初の作業）

新規ディレクトリ・ファイル:

```
src/missions/
├── Mission.ts              # 抽象 base クラス: id, title, description, check(state), progress, isCleared
├── MissionManager.ts       # active/completed リスト、HUD 更新ブリッジ
└── missions/
    ├── CollectMission.ts   # 「DXの種を集めよう」ハート 10 個
    └── ReachMission.ts     # 「タダスクの塔へ」towerTop 到達
src/entities/Collectible.ts # 静的配置のハート、近接で取得イベント
src/ui/MissionPanel.ts      # ミッション詳細パネル（M キーで開閉）
src/ui/HUD.ts               # 既存に「現在ミッション + 進捗 X/N」を追加
```

ミッション 1: 中央広場・タダレク広場・タダスクの塔の周囲に Heart を 10 個配置、近接で取得。
ミッション 2: `landmarks.towerTop` の半径 1.5m 以内で発火、クリアで HUD に「クリア！」表示。

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
│   └── Village.ts          # タダカヨ村全体（中央広場/塔/広場/会館/装飾/柵）
├── input/
│   ├── InputBus.ts         # 統一入力バス（move/look/jump/action/run/pause）
│   └── KeyboardMouseInput.ts  # WASD + Pointer Lock + Space + E + Shift
├── ui/
│   ├── TitleScreen.ts      # スタート画面
│   └── HUD.ts              # 座標表示（5-C でミッション表示に拡張予定）
├── audio/AudioManager.ts   # Web Audio 合成 SE/BGM
├── config/
│   ├── brand.ts            # ブランドカラー
│   └── gameConfig.ts       # PHYSICS / PLAYER / CAMERA 定数（SPAWN は中央広場手前）
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

## リポジトリ設定の積み残し（次回ユーザー判断）

- **デフォルトブランチが `feat/bootstrap` のまま**残っている（Phase 0 初期化の名残）。
  PR 作成時の base が誤って `feat/bootstrap` になり、毎回 `gh pr edit <N> --base main` で
  修正している。次回ユーザー認可があれば以下を実行して恒久解決:
  ```bash
  gh api -X PATCH /repos/yasushi-honda-prog/tadakayo-game -f default_branch=main
  ```

## 残留プロセス

- vite dev server は今セッション末で停止済み。確認するには:
  ```bash
  ~/.claude/scripts/cleanup-node.sh
  ```

## 既知の制約

- bundle size 2.7 MB (gzip 963 KB) — Rapier WASM が大半。Phase 5-F で code split 検討
- iOS Safari は Pointer Lock が限定的サポート → モバイル操作は Phase 5-E で仮想スティック実装予定
- favicon.ico 404（実害なし、Phase 5-F でファビコン追加）
- キャラクター sprite が裸足（プロンプトに `shoes` 含めなかった）— Phase 5-F で再生成予定

## 公式作品としての位置づけ

ユーザーは **NPO法人タダカヨの代表/運営者**。本作は法人内イベント用 + 公式コンテンツ。
ロゴ・キャラクター指定は NPO 法人タダカヨに帰属。コードは MIT。
