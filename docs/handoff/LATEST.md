# タダカヨ村 3D オープンワールド — セッションハンドオフ

最終更新: 2026-05-12 (Player ダンス機能 + collider polish 完了)

## 現在地点

- **リポジトリ**: [yasushi-honda-prog/tadakayo-game](https://github.com/yasushi-honda-prog/tadakayo-game)
- **公開 URL**: https://yasushi-honda-prog.github.io/tadakayo-game/
- **作業ディレクトリ**: `/Users/yyyhhh/Projects/tadakayo/game-ai`
- **現在ブランチ**: `main`(同期済み、最新コミット `b3adc3c`)
- **Phase 5 + 6 polish + Player ダンス + collider polish 完了** ✅(2026-05-12)
- **未マージ PR**: なし

## 2026-05-12 セッション成果

| PR | 内容 | 効果 |
|---|---|---|
| **#30** | Player ダンス機能 (専用 sprite + EDM BGM + 何度でも踊れる) | タダレク広場の体験が完成、DanceMission クリア後も繰り返し可 |
| **#32** | タダレク広場の柱と木の幹 collider 修正 (Issue #31 スコープ 1+2) | ジャンプで柱/木の上に乗れる挙動を解消 |
| **#33** | 中央広場モニュメントを装飾化 (Issue #31 追加対応) | カメラ回転時に「浮いて見える」現象 (Image #3) を根本解消 |

### PR #30 詳細
- `src/entities/Player.ts`: dance state 追加 (DANCE_DURATION_SEC=3.6s、4 枚 sprite ローテ、水平入力ゼロ化、jump 入力ガード)
- `src/core/Game.ts`: handleActionPress で `DanceMission.isInArea()` 判定 → `player.startDance()`、update で dance edge 検出 → BGM 切替
- `src/audio/AudioManager.ts`: `danceBgmGain` 専用ノード + village BGM ducking (0.22→0.04)
- `public/assets/audio/bgm-dance.mp3`: Mixkit "Karma" by Michael Ramir C. (EDM 2:15, Mixkit License, 商用 OK)
- `public/assets/images/tadakayo-front-dance-{1..4}.png`: nano-banana 生成 (白インナー除去 reroll で dance-3/4 再生成)
- Codex セカンドオピニオン反映: 連打リスタート方式、水平入力のみゼロ化、jump バッファ暴発防止

### PR #32/#33 詳細 (Issue #31 対応)
- タダレク広場 4 本柱: `addBoxMesh` → 純 Three.js mesh (collider 削除)
- 木の幹: `addStaticCylinder(1.1, 0.28, y:1.1)` → `addStaticCylinder(0.5, 0.28, y:0.5)` (腰高に縮小)
- 中央広場モニュメント (赤い台座 + ピンクキューブ): collider 削除、mesh 維持

## 次セッションで最初にやること

1. `cd /Users/yyyhhh/Projects/tadakayo/game-ai && direnv allow` で `GH_TOKEN` 読み込み
2. **本番動作確認** (https://yasushi-honda-prog.github.io/tadakayo-game/):
   - タダレク広場で E 押下 → Player が踊る (EDM BGM)、DanceMission クリア後も繰り返し可
   - 中央広場/タダレク広場のモニュメント/柱/木に**乗れない**ことを確認
3. 残課題 (low priority):
   - **Issue #31 スコープ 3 (OPEN)**: 段差エッジで capsule が浮く Rapier KCC 挙動 (P2、本番様子見、修正候補は Issue コメント記録済)
   - **Rapier 0.20+ アップデート時の init() deprecation 再評価**
   - 新規ミッション追加 / 演出強化 / コンテンツ拡張など自由に着手可
4. 不明な場合は `/catchup` で最新 Issue / PR / handoff を再確認

## これまでの経緯

| Phase | 概要 | 状態 |
|---|---|---|
| 0-2 | Vite/TS/Three.js + ランナー基盤 + nano-banana ブランド画像 | ✅ |
| 3-4 | ランナー深掘り(複数パワーアップ・難易度・チュートリアル) | ❌ PR #4 close (ピボット) |
| 5-A | Rapier 物理 + 三人称カメラ + 4 方向 sprite (PR #5-7) | ✅ |
| 5-B | タダカヨ村ステージ構築 (PR #8-9) | ✅ |
| sprite 整合化 | 14 枚再生成 + remove-checker-bg 改良 (PR #10) | ✅ |
| 5-C | ミッション基盤 + Collect/Reach 2 本 + MissionPanel (PR #11) | ✅ |
| 5-D | NPC + 会話 + Talk + 靴修正 + kenney.nl 音素材 (PR #13) | ✅ |
| 5-E | モバイル + DanceMission + MetaMission + 4 件バグ修正 + レビュー fix 7 件 (PR #15) | ✅ |
| 5-F | 演出 + ScoreScreen + DanceNpc + HUD ヒント + SkyDome (PR #17, 18) | ✅ |
| 5-F hotfix | 影 renderOrder / 靴穴埋め / contact shadow 全廃 / NPC 影削除 / preload / 床上ハート影 (PR #19-24) | ✅ |
| 6 polish | 赤靴 sprite 再生成 (#26) / bundle code split (#27) / preload crossorigin (#28) | ✅ |
| 5-G dance | Player ダンス機能 + 専用 sprite + EDM BGM (PR #30) | ✅ |
| 5-G polish | 柱/木/モニュメント collider 修正 (PR #32, #33、Issue #31 スコープ 1+2+追加) | ✅ |

詳細プラン: `/Users/yyyhhh/.claude/plans/yasushi-honda-prog-github-githubpages-us-transient-summit.md`

## Phase 5-F で追加された機能

### 演出 (PR #18)
- **噴水アニメ** (`src/world/Village.ts`): 水柱の y スケール sin 振動 + 飛沫粒子 18 個 (InstancedMesh、投射運動 p=v0t+½gt²) + 旗の z 軸揺れ
- **スカイドーム** (`src/core/Game.ts buildSkyDome`): BackSide ShaderMaterial で BRAND_HEX.SKY_TOP/BOTTOM のグラデーション
- **ダンス NPC** (`src/entities/DanceNpc.ts`、新規): タダレク広場に 2 体配置、front/side/side-left を順次切替 + バウンス animate
- **HUD ヒント改善**: `Esc / P でポーズ` を pill に追加し操作発見性向上
- **ScoreScreen** (`src/ui/ScoreScreen.ts`、新規): MetaMission 達成時の大型モーダル
  - クリアタイム / ハート / 会話 / ダンス / 塔到達 + 1-5 ★ 評価 (computeStars: 基本 3★ + ハート完全 +1 + 会話完全 +1 + 5分以内 +1 / 10分超 -1)
  - 「もう一度プレイ」ボタンで resetToTitle → 即 startPlay
- **collectStats**: MissionManager の current/target を集約して ScoreScreen に渡す single source of truth

### Phase 5-F hotfix の経緯 (PR #19-24)

| # | 課題 | 修正 |
|---|---|---|
| #19 | 接地影 renderOrder + 靴穴埋め + Z-fight 防止 | renderOrder=-1 で sprite を上に / scipy.binary_fill_holes で靴中身赤化 (v8: 大連結成分 + 下半分アプローチ) |
| #20 | NPC/DanceNpc 影が頭上に浮く違和感 + favicon 404 | NPC/DanceNpc 用 contact shadow 削除 + `<link rel=icon href=data:,>` |
| #21 | Player 影が capsule center (~0.55m) で空中固定 | 3D contact shadow を完全廃止 (sprite 焼き込みフットシャドウで担保) |
| #22 | Heart の浮遊位置が分かりにくい | Collectible に専用地面影 (CircleGeometry r=0.22, opacity 0.28) |
| #23 | 床上 (中央広場 y=0.15 / タダレク広場 y=0.2) のハート影が床下に隠れる | spots に y を持たせ、Collectible.object.position.y を床面に設定 |
| #24 | ハート影 renderOrder 問題 + キャラチラつき | renderOrder=-1 削除 (transparency sort に任せる) + 17 sprite を `<link rel=preload>` |

### 重要な学び

1. **Three.js の transparent + depthWrite false の renderOrder 罠**:
   - 安易な `renderOrder=-1` は「先に描画 → 後の不透明体に depth で覆われる」逆効果になる
   - 正しい順序を欲しいなら **transparency distance sort に任せる** (default 0)
2. **Player.object.position は physics capsule の center**:
   - `position.y + 0.02` で contact shadow を貼ると「腰〜頭の高さ」に空中固定される
   - sprite に焼き込んだ黒楕円フットシャドウのほうが確実かつ軽量
3. **picture preload で TextureLoader 体感速度激変**:
   - HTML head に `<link rel=preload as=image>` で 17 sprite を先取得 → スタート時のチラつき消滅
4. **画像処理スクリプトのアプローチ試行錯誤** (PR #19 で v3 → v8 まで反復):
   - 純画像処理だけで「白いハロー除外 + 全 pose の靴完全塗り」の両立は難しい
   - 完璧を求めるなら nano-banana で「赤いスニーカー指定」再生成が確実

## 既知の残課題

| 項目 | 重要度 | 備考 |
|---|---|---|
| ~~脚周りの細い赤縁 (PR #19 v8 妥協点)~~ | ✅ 解消 | PR #26 nano-banana 直接生成で根本解消 |
| ~~bundle 2,773 KB / gzip 974 KB~~ | ✅ 解消 | PR #27 dynamic import で main 538 KB / gzip 138 KB |
| ~~preload credentials mode 不一致 warning 40+ 件~~ | ✅ 解消 | PR #28 crossorigin="anonymous" 追加で 41→1 |
| ~~Player が柱/木/中央モニュメントの上に乗れる~~ | ✅ 解消 | PR #32/#33 で collider 装飾化、Issue #31 スコープ 1+2+追加完了 |
| **Issue #31 OPEN: 段差エッジで capsule が浮く Rapier KCC 挙動** | P2 | スコープ 3 残課題、修正候補 4 案を Issue コメント記録済。本番ユーザー報告を待って判断 (snap 距離拡大 / capsule radius 縮小 / autostep 上限調整 / マップ collider 面取り) |
| Rapier `init()` deprecated parameters warning | Low | `@dimforge_rapier3d-compat.js:2516` ライブラリ内部の自己呼び出し起因、app コードから修正不可。Rapier 0.20+ アップデート時に再評価候補 |

## アーキテクチャ概要 (Phase 5-F 完了時点)

```
src/
├── core/
│   ├── PhysicsWorld.ts         # Rapier WASM ラッパー
│   └── Game.ts                 # メインループ + MissionManager + 全 entity 統合 + ScoreScreen + SkyDome
├── entities/
│   ├── Player.ts               # KinematicCharacterController + 4 方向 sprite + jump/land
│   ├── Camera.ts               # 三人称後方追従、yaw/pitch
│   ├── Collectible.ts          # ハート (浮遊回転 + 専用地面影 + 近接トリガ)
│   ├── NPC.ts                  # ビルボード sprite + 状態 + 近接 + glow pulse
│   └── DanceNpc.ts             # 装飾 NPC (Phase 5-F、front/side テクスチャ切替 + バウンス)
├── world/Village.ts            # タダカヨ村 + 噴水アニメ + 旗揺れ
├── missions/
│   ├── Mission.ts
│   ├── MissionManager.ts
│   └── missions/{Collect,Reach,Talk,Dance,Meta}Mission.ts
├── input/{InputBus,KeyboardMouseInput,TouchInput,detectInput}.ts
├── ui/
│   ├── TitleScreen.ts
│   ├── HUD.ts                  # ミッション + toast + actionHint (座標は PR #17 で削除)
│   ├── MissionPanel.ts         # M キー開閉
│   ├── DialogBox.ts            # NPC 会話
│   ├── PauseMenu.ts            # 4 ボタンモーダル (再開/音/操作/タイトル戻り)
│   ├── ScoreScreen.ts          # MetaMission 達成時の大型モーダル (Phase 5-F)
│   └── MobileControls.ts       # 仮想スティック + ボタン
├── audio/AudioManager.ts       # kenney.nl OGG decode + BGM ループ + SE 6 種
├── config/{brand,gameConfig}.ts
└── main.ts
scripts/fix-sprites.py          # 水平反転 + フットシャドウ強制 + 靴赤色化 (red-v8)
```

## アカウント・認証

- GitHub: `yasushi-honda-prog`(`yasushi-honda` ではない)
- `.envrc` で `GH_TOKEN="$(gh auth token --user yasushi-honda-prog)"` をローカル閉じ込め
- グローバル `gh auth switch` は **しない**
- nano-banana (Vertex AI / Gemini 3.1 Flash Image) は `hy.unimail.11@gmail.com` の user account token

### nano-banana 連続生成の運用

- 12-15 秒間隔 + exponential backoff (15→30→60s)、14-17 枚で 7-10 分
- 統一プロンプトで素材・色・輪郭線太さを明示
- 靴問題対策プロンプト: `shoes must have thick black outline INCLUDING the bottom sole`、`background MUST be MEDIUM GRAY (RGB 130,130,130) and WHITE squares, never all white`
- 透過処理: `scripts/remove-checker-bg.py`(暗チェッカー + 靴保護対応済)
- 赤靴指定が必要な場合は v8 スクリプトより nano-banana 直接生成のほうが完璧

## リポジトリ設定の積み残し

- **デフォルトブランチが `feat/bootstrap` のまま**残っている。次回ユーザー認可で:
  ```bash
  gh api -X PATCH /repos/yasushi-honda-prog/tadakayo-game -f default_branch=main
  ```

## 残留プロセス

- vite dev server は本セッションでは未起動 → 残留なし
  ```bash
  ~/.claude/scripts/cleanup-node.sh
  ```

## 公式作品としての位置づけ

ユーザーは **NPO法人タダカヨの代表/運営者**。本作は法人内イベント用 + 公式コンテンツ。
ロゴ・キャラクター指定は NPO 法人タダカヨ帰属。コードは MIT。

**現在の到達品質**: Phase 5 完全完了で「介護業界 IT 推進担当者が 5-10 分プレイして楽しめる」itch.io 良質作品レベルの 3D オープンワールド・プラットフォーマー。法人内イベントで「公式作品」として紹介可能な完成度。
