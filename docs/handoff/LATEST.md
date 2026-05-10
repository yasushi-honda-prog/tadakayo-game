# タダカヨ村 3D オープンワールド — セッションハンドオフ

最終更新: 2026-05-10

## 現在地点

- **リポジトリ**: [yasushi-honda-prog/tadakayo-game](https://github.com/yasushi-honda-prog/tadakayo-game)
- **公開 URL**: https://yasushi-honda-prog.github.io/tadakayo-game/
- **作業ディレクトリ**: `/Users/yyyhhh/Projects/tadakayo/game-ai`
- **現在ブランチ**: `feat/openworld-village`
- **未マージ PR**: 未作成（Phase 5-B 実装ブランチを push 後に作成予定）

## 次セッションで最初にやること

1. `cd /Users/yyyhhh/Projects/tadakayo/game-ai && direnv allow` で `GH_TOKEN` を読み込む
2. **本番 URL で実機操作確認**（Phase 5-B のタダカヨ村）:
   - スポーン位置: 中央広場の南手前 (x=0, z=6)
   - WASD で移動、マウスで視点回転
   - 中央広場のピンク石畳と赤い縁取りが見える
   - 北のタダコミュ会館（赤屋根）に歩いて行ける
   - 西のタダスクの塔の 5 段を Space ジャンプで登れる、頂上に旗
   - 東のタダレク広場の噴水・ベンチに到達できる
   - 街灯・木・ベンチに正しく衝突する
3. 問題なければ **Phase 5-B PR を merge**
4. **Phase 5-C 着手**（ミッション基盤 + Collect/Reach 2 本）

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
| 5-B | タダカヨ村ステージ構築（中央広場 + 塔 + 広場 + 会館 + 装飾） | 🟡 ブランチ作業中 |
| 5-C | ミッション基盤 + Collect/Reach 2 本 | 🔜 |
| 5-D | NPC + 会話 + Talk ミッション 1 本 | 🔜 |
| 5-E | モバイル対応（仮想スティック + ボタン）+ 残ミッション | 🔜 |
| 5-F | 演出 + パフォーマンス + 仕上げ | 🔜 |

詳細プラン: `/Users/yyyhhh/.claude/plans/yasushi-honda-prog-github-githubpages-us-transient-summit.md`

## Phase 5-B 実装内容（今セッション）

### 追加・変更ファイル

| ファイル | 変更 |
|---|---|
| `src/world/Village.ts` | 新規。タダカヨ村全体を 1 ファイルで構築 |
| `src/world/TestArena.ts` | 削除（Village に置換） |
| `src/core/Game.ts` | TestArena → Village 切替 |
| `src/config/gameConfig.ts` | SPAWN を `(0, 4, 8)` → `(0, 4, 6)`（中央広場手前） |
| `index.html` | フェーズタグを `Phase 5-B プロトタイプ（タダカヨ村）` に更新 |

### Village レイアウト（俯瞰、+X 東 / +Z 南、原点が中央広場の中心）

```
                      +Z 北
                 タダコミュ会館
                  (0, -22)
                 [白壁8x4x8 + 赤屋根]


    タダスクの塔     中央広場     タダレク広場
     (-18, 4)        (0, 0)         (18, 4)
     [5段ジャンプ]   [ピンク円盤    [8x8床+噴水
      頂上に旗       直径16m]        +ベンチ2]

                      SPAWN
                      (0,4,6)
                      -Z 南
```

外周は 30m 四方の柵で囲み（落下防止）、中央広場↔会館・塔・広場のパスを淡いベージュの平面で表示。

### Village.landmarks（Phase 5-C のミッション基盤で参照する座標）

```ts
landmarks = {
  plazaCenter: Vector3(0, 0, 0),
  towerTop: Vector3(-18, 3.6, 4 - 1 - 4*2.2 = -4.8 ぐらい),
  rekuCenter: Vector3(18, 0.2, 4),
  hallEntrance: Vector3(0, 0, -18 + 0.5),
}
```

### 物理コライダー

すべての構造物に Rapier 静的 collider を付与:
- 地面 60×60（薄い cuboid）
- 中央広場（高さ 0.15 cylinder）
- 中央モニュメント（cuboid 2 段）
- タダスクの塔（5 段の cuboid）
- タダレク広場（床 + 4 柱 + 噴水 cylinder 2 段 + ベンチ 2）
- タダコミュ会館（壁 cuboid + 屋根 cuboid）
- 装飾: 木 6 本（cylinder）+ 街灯 6 本（cylinder）+ ベンチ 2 個（cuboid）
- 外周柵 4 辺（cuboid）

入口の扉だけ collider なし（見た目のみ、Phase 5-D で NPC の出入口表現に使用予定）。

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
│   └── Village.ts          # ★ 5-B 新規。タダカヨ村全体（中央広場/塔/広場/会館/装飾/柵）
├── input/
│   ├── InputBus.ts         # 統一入力バス（move/look/jump/action/run/pause）
│   └── KeyboardMouseInput.ts  # WASD + Pointer Lock + Space + E + Shift
├── ui/
│   ├── TitleScreen.ts      # スタート画面
│   └── HUD.ts              # 座標表示（Phase 5-C でミッション表示に拡張）
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

## 残留プロセス

- vite dev server がバックグラウンドで動いている可能性あり。停止するには:
  ```bash
  ~/.claude/scripts/cleanup-node.sh --kill
  ```

## 既知の制約

- bundle size 2.7 MB (gzip 963 KB) — Rapier WASM が大半。Phase 5-F で code split 検討
- iOS Safari は Pointer Lock が限定的サポート → モバイル操作は Phase 5-E で仮想スティック実装予定
- favicon.ico 404（実害なし、Phase 5-F でファビコン追加）
- キャラクター sprite が裸足（プロンプトに `shoes` 含めなかった）— Phase 5-F で再生成予定

## 公式作品としての位置づけ

ユーザーは **NPO法人タダカヨの代表/運営者**。本作は法人内イベント用 + 公式コンテンツ。
ロゴ・キャラクター指定は NPO 法人タダカヨに帰属。コードは MIT。
