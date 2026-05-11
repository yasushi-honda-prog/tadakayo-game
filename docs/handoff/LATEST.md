# タダカヨ村 3D オープンワールド — セッションハンドオフ

最終更新: 2026-05-10

## 現在地点

- **リポジトリ**: [yasushi-honda-prog/tadakayo-game](https://github.com/yasushi-honda-prog/tadakayo-game)
- **公開 URL**: https://yasushi-honda-prog.github.io/tadakayo-game/
- **作業ディレクトリ**: `/Users/yyyhhh/Projects/tadakayo/game-ai`
- **現在ブランチ**: `main`（同期済み、最新コミット `6c47b2f`）
- **未マージ PR**: なし（PR #5〜#13 すべて main 反映、Deploy 完了）

## 次セッションで最初にやること

1. `cd /Users/yyyhhh/Projects/tadakayo/game-ai && direnv allow` で `GH_TOKEN` を読み込む
2. **本番 URL で Phase 5-D 実機操作確認**:
   - スポーン位置: 中央広場の南手前 (x=0, z=6)
   - HUD 上部に「現在のミッション DXの種を集めよう 0/10」が表示
   - WASD で移動 + マウスクリックで視点ロック
   - **タダカヨちゃんの足元に白いスニーカー** がしっかり描画されている (Phase 5-D 修正)
   - **NPC 3 体が配置されている**:
     - 中央広場南東 (3, 0, 3): ヨシオさん（施設長）
     - タダレク広場ベンチ近く (15.4, 0, 4): タダさん（利用者）
     - タダコミュ会館入口 (0, 0, -16.5): カヨさん（看護師）
   - NPC に近づく → HUD 中央下に **「E でヨシオさんと話す」** 等の hint 表示
   - **E キー** で会話開始 → DialogBox 表示 → E キーで line 進行 → 全 line 完了で TalkMission 進捗 +1
   - 3 NPC 全員と会話で **「現場の声を聞こう」クリア** toast
   - **BGM (Pizzicato 系ループ)** がタイトル画面 → 本編で流れる
   - **SE** が pickup / mission-clear / dialog-open / dialog-next で正しく鳴る
3. 問題なければ **Phase 5-E 着手**（モバイル対応 + 仮想スティック + 残ミッション）

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
| 5-D | NPC + 会話 + Talk ミッション + 靴修正 + フリー音素材 (kenney.nl CC0) | ✅ PR #13 main 反映 |
| 5-E | モバイル対応（仮想スティック + ボタン）+ 残ミッション | 🔜 次セッション |
| 5-F | 演出 + パフォーマンス + 仕上げ | 🔜 |

詳細プラン: `/Users/yyyhhh/.claude/plans/yasushi-honda-prog-github-githubpages-us-transient-summit.md`

## Phase 5-D で追加された NPC + 会話 + 音素材基盤

### ディレクトリ

```
src/
├── entities/NPC.ts           # ビルボード sprite + 状態 (idle/interactable/talking) + 近接判定 + glow pulse
├── missions/missions/
│   └── TalkMission.ts        # visitedIds Set 集計 (イベント駆動)
├── ui/DialogBox.ts           # 吹き出し UI、E キーで line 進行、onComplete 発火
└── audio/AudioManager.ts     # kenney.nl OGG 素材を Web Audio decode + BGM ループ + SE

public/assets/audio/          # 全 7 ファイル ~50KB
├── bgm-village.ogg           # Pizzicato jingle (ループ再生)
├── se-pickup.ogg             # confirmation_001 (DXの種取得)
├── se-mission-clear.ogg      # Hit jingle (ミッションクリア)
├── se-jump.ogg               # click_001
├── se-land.ogg               # drop_001
├── se-dialog-open.ogg        # glass_001 (会話開始)
└── se-dialog-next.ogg        # click_002 (line 進行)
```

### NPC 状態遷移（CLAUDE.md CRITICAL: status 設計→状態遷移図先行）

```
idle ──(distance ≤ 2.0m)──> interactable ──(E キー)──> talking
  ↑                                ↑                          │
  │                                │                          │
  └──(distance > 2.6m)─────────────┘                          │
  └──(全 line 完了 + E キー、visited 記録)──────────────────┘
```

距離閾値はヒステリシス (RELEASE 2.6m > INTERACT 2.0m) で境界振動防止。

### TalkMission のイベント駆動パターン

Mission.ts の docstring で予告した「イベント駆動」を初実装:
- 毎フレーム判定なし (`update` は no-op)
- `notifyTalked(npcId)` で current 加算 (重複防止 Set)
- `requiredIds` 外の NPC との会話は無視

### Game.ts の handleActionPress ディスパッチ

E キー押下で:
- DialogBox 開いていれば → `dialogBox.advance()` + `dialogSE()`
- 閉じていて最寄り interactable NPC があれば → `startNpcTalk(npc)` + `dialogOpenSE()`

会話完了 callback で `talkMission.notifyTalked(npc.id)` + `refreshMissionUI()`。

## 靴透明化バグ修正（ユーザー指摘 2026-05-10）

### 問題
- タダカヨちゃん 14 枚 + NPC 3 枚すべてで「下端中央 95% が alpha=0」状態
- ゲーム内で「赤短パン + 肌色脚 + 靴透明」の見た目になっていた
- 原因: チェッカー背景の白セル + キャラの白いスニーカーが連結成分で外周まで通り、`remove-checker-bg.py` が背景判定して透明化

### 修正
1. **プロンプト強化**: 「靴は太い黒輪郭で囲む (CRITICAL)」「背景は MEDIUM GRAY (RGB 130,130,130) と白の交互、白だけにしない」を強調 → 17 枚再生成
2. **`scripts/remove-checker-bg.py` 改良**: `binary_dilation(char_mask, iterations=12)` で character 領域を膨張させ、内部に取り囲まれた背景判定ピクセル (= 靴の中身) を救済

## フリー音素材導入

- **ライセンス**: kenney.nl (CC0、商用利用 OK、クレジット任意)
- **採用**: Interface Sounds (UI SE) + Music Jingles (Pizzicato BGM ループ + Hit jingle)
- **AudioManager**: Web Audio で fetch + decodeAudioData → AudioBuffer 保持 → BufferSourceNode で再生。decode 失敗時は内部合成 fallback (Phase 5-C 以前のロジックを保険として残す)
- **クレジット**: README に Kenney 出典を追記

## アーキテクチャ概要 (Phase 5-D 時点)

```
src/
├── core/
│   ├── PhysicsWorld.ts     # Rapier WASM ラッパー
│   └── Game.ts             # メインループ + MissionManager 統合 + NPC 配置 + handleActionPress
├── entities/
│   ├── Player.ts           # KinematicCharacterController + 4 方向 sprite
│   ├── Camera.ts           # 三人称後方追従、yaw/pitch
│   ├── Collectible.ts      # ハート (浮遊回転 + 近接トリガ)
│   └── NPC.ts              # ビルボード sprite + 状態 + 近接 + glow (5-D)
├── world/Village.ts        # タダカヨ村全体
├── missions/
│   ├── Mission.ts
│   ├── MissionManager.ts
│   └── missions/{Collect,Reach,Talk}Mission.ts
├── input/
│   ├── InputBus.ts         # move/look/jump/action/run/pause/panel
│   └── KeyboardMouseInput.ts  # WASD + Space + E + M + Shift + Pointer Lock
├── ui/
│   ├── TitleScreen.ts
│   ├── HUD.ts              # 座標 + 現在ミッション + 進捗 + toast + actionHint (5-D)
│   ├── MissionPanel.ts     # M キー開閉
│   └── DialogBox.ts        # NPC 会話 (5-D)
├── audio/AudioManager.ts   # kenney.nl OGG decode + BGM ループ + SE 6 種 (5-D)
├── config/{brand,gameConfig}.ts
└── main.ts
```

## 重要文脈・ユーザー要求

- **クオリティ最優先**「どこに出しても恥ずかしくないクオリティ」「3D マリオレベル」
- **時間がかかってもよい**（10 営業日想定）
- 介護業界 DX 推進担当者がプレイ → 操作はシンプルに、難易度は緩めに
- **本セッションで対応**:
  1. Phase 5-D 実装 (NPC 3 体 + Talk ミッション)
  2. 靴透明化バグ修正 (17 枚再生成 + remove-checker-bg.py 改良)
  3. BGM/SE フリー素材導入 (kenney.nl CC0、AudioManager 再構築)

## アカウント・認証

- GitHub: `yasushi-honda-prog` アカウント（`yasushi-honda` ではない）
- `.envrc` で `GH_TOKEN` をローカル閉じ込め（direnv allow 済）
- グローバル `gh auth switch` は **しない**
- git identity も `--local` で `yasushi-honda-prog` 名義
- nano-banana (Vertex AI / Gemini 3.1 Flash Image) は `gcloud auth print-access-token --account=hy.unimail.11@gmail.com` で取得した user account token を使う

### nano-banana 利用時の注意

- 連続生成は 12-15 秒間隔 + exponential backoff リトライ (15→30→60s) 必須
- 17 枚再生成は約 8-10 分かかる前提で `run_in_background`
- スタイル整合性のため、共通プロンプト (素材・色・輪郭線太さ) を統一しテキストで明示する
- **靴の輪郭線は明示要求**:「shoes must have thick black outline INCLUDING the bottom sole」「background must be MEDIUM GRAY (RGB 130,130,130) and WHITE squares, never all white」
- 暗チェッカー対応 + 靴保護: `scripts/remove-checker-bg.py` 最新版で透明化

## リポジトリ設定の積み残し

- **デフォルトブランチが `feat/bootstrap` のまま**残っている。次回ユーザー認可で:
  ```bash
  gh api -X PATCH /repos/yasushi-honda-prog/tadakayo-game -f default_branch=main
  ```

## 残留プロセス

- vite dev server は今セッション末で停止済み。確認:
  ```bash
  ~/.claude/scripts/cleanup-node.sh
  ```

## 既知の制約

- bundle size 約 2.75 MB (gzip 967.84 KB) — Rapier WASM が大半。Phase 5-F で code split 検討
- iOS Safari は Pointer Lock が限定的サポート → モバイル操作は Phase 5-E で仮想スティック実装予定
- favicon.ico 404（実害なし、Phase 5-F でファビコン追加）
- BGM は Pizzicato jingle (約 4 秒) のループのため単調。Phase 5-F で長尺 BGM 検討

## 公式作品としての位置づけ

ユーザーは **NPO法人タダカヨの代表/運営者**。本作は法人内イベント用 + 公式コンテンツ。
ロゴ・キャラクター指定は NPO 法人タダカヨに帰属。コードは MIT。
