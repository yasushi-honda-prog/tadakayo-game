# タダカヨ村 3D オープンワールド — セッションハンドオフ

最終更新: 2026-05-13 (Phase 6 ブラッシュアップ Stage 1-4 完了 + Firebase Hosting 移行)

## 現在地点

- **リポジトリ**: [yasushi-honda-prog/tadakayo-game](https://github.com/yasushi-honda-prog/tadakayo-game)
- **公開 URL (新、現用)**: https://tadakayo-game-yh.web.app/ (Firebase Hosting)
- **公開 URL (旧、redirect 中)**: https://yasushi-honda-prog.github.io/tadakayo-game/ → 新 URL へ `meta refresh` + `location.replace` で自動転送 (`redirect/index.html` + `.github/workflows/pages-redirect.yml`)
- **作業ディレクトリ**: `/Users/yyyhhh/Projects/tadakayo/game-ai`
- **現在ブランチ**: `main`(同期済み、最新コミット `0e8314b`)
- **Phase 6 ブラッシュアップ完了** ✅ (2026-05-13)
- **未マージ PR**: なし

## Phase 6 全体総括 (2026-05-13、Stage 1-4)

セッション開始時点で「Phase 5-L まで完成、ステージ・ミッション・UX 等のブラッシュアップ余地あり」の状態から、WEB ベストプラクティス (Game UI Database、Game Accessibility Guidelines、Reduced Motion) に照らして 4 つの段階に分解して実装。すべて codex セカンドオピニオン + 修正反映を経てマージ。

| Stage | PR | 内容 | 変更規模 |
|---|---|---|---|
| **Stage 1** | [#56](https://github.com/yasushi-honda-prog/tadakayo-game/pull/56) | 目標コンパス HUD (foreground mission の方向矢印 + 距離) | 5 files, +313/-2 |
| **Stage 2** | [#57](https://github.com/yasushi-honda-prog/tadakayo-game/pull/57) | UserSettings シングルトン (感度 X/Y、Y軸反転、BGM/SE 音量、localStorage 永続化) | 6 files, +617/-21 |
| **Stage 3** | [#58](https://github.com/yasushi-honda-prog/tadakayo-game/pull/58) | **Firestore + Anonymous Auth 永続化 + Firebase Hosting 移行** | 17 files, +1810/-37 |
| **Stage 4** | [#59](https://github.com/yasushi-honda-prog/tadakayo-game/pull/59) | prefers-reduced-motion 対応 + オープニング演出 | 9 files, +169/-11 |

### Stage 3 の最重要事項 (ADR-2026-05-13)

「localStorage だけではあまりに恥ずかしいお粗末設計、Firestore を使う」というユーザー指摘を受けて、データ永続化とホスティングの両方を Firebase に統一:

- **Firebase プロジェクト**: `tadakayo-game-yh` (法人アカウント `yasushi-honda@tadakayo.jp` で作成、organization `797660187808` 配下)
- **Firestore**: `(default)` database、asia-northeast1、`gameRecords/{uid}` コレクションに自己ベスト保存
- **Anonymous Auth**: ユーザー登録不要、UID 自動発行
- **セキュリティルール**: 自分の uid のみ R/W、`validNewRecord` / `validUpdate` で型・範囲 + createdAt 改竄防止 (codex review #2 反映)
- **Hosting**: base path `/` (旧 `/tadakayo-game/` から変更)、`firebase deploy --only hosting` で手動デプロイ
- **コード設計**: `GameRecord` シングルトンが Firestore + localStorage ハイブリッド、synchronous な `recordPlay` + fire-and-forget cloud upsert、Firebase 接続失敗時は localStorage 単独で動作 (グレースフルデグレード)
- **Vite manualChunks**: firebase SDK (~250KB / gzip 105KB) を dynamic import で initial bundle から分離

### codex セカンドオピニオン総括

| Stage | High | Medium 反映 | Low (別 PR / 修正不要) |
|---|---|---|---|
| 1 | 0 | 3 件: TalkMission required 限定、transform キャッシュ、aria-label | 角度↔CSS rotate 符号整合 等 |
| 2 | 0 | 2 件: localStorage 堅牢化、aria-expanded/valuetext | listener iteration、touch 感度文言 等 |
| 3 | 0 | 2 件: createdAt 上書き、rules hasOnly 化 | playCount Math.max、UID 永続性 docs 等 |
| 4 | **1** | 3 件: Player ダンス・走行微振動、NPC glow pulse・浮遊、ScoreScreen 本体アニメ | UserMotion listener 解除 等 |

各 Stage で codex review 後に追加コミットで Medium 以上をすべて反映、Low は別 PR / 修正不要判断を明文化。

## アーキテクチャ概要 (Phase 6 完了時点)

```
src/
├── core/
│   ├── PhysicsWorld.ts         # Rapier WASM ラッパー
│   └── Game.ts                 # メインループ + MissionManager + 全 entity 統合 + ScoreScreen +
│                               #   SkyDome + Stage 1 updateCompass + Stage 4 welcome toast
├── entities/
│   ├── Player.ts               # KinematicCharacterController + 4 方向 sprite + Stage 4 reduced-motion
│   ├── Camera.ts               # 三人称後方追従 + Stage 2 感度倍率・Y軸反転
│   ├── Collectible.ts          # ハート (浮遊回転 + Stage 4 reduced-motion で静止)
│   ├── NPC.ts                  # 会話 NPC + Stage 4 glow pulse / 浮遊 reduced-motion 対応
│   └── DanceNpc.ts             # 装飾 NPC + Stage 4 reduced-motion でバウンス停止
├── world/Village.ts            # タダカヨ村 + Stage 4 噴水・旗 reduced-motion 対応
├── missions/
│   ├── Mission.ts
│   ├── MissionManager.ts
│   └── missions/{Collect,Reach,Talk,Dance,Meta}Mission.ts
├── input/{InputBus,KeyboardMouseInput,TouchInput,detectInput}.ts
├── ui/
│   ├── TitleScreen.ts
│   ├── HUD.ts                  # Stage 1 コンパス + Stage 4 welcome variant
│   ├── MissionPanel.ts
│   ├── DialogBox.ts
│   ├── PauseMenu.ts            # Stage 2 設定セクション (感度/反転/音量/リセット)
│   ├── ScoreScreen.ts          # Stage 3 自己ベスト + 累計 + 新記録バッジ + GameRecord 連動
│   └── MobileControls.ts
├── audio/AudioManager.ts       # Stage 2 BGM/SE 個別音量 + UserSettings 連動
├── config/
│   ├── brand.ts
│   ├── gameConfig.ts           # PHYSICS / PLAYER / CAMERA / STORAGE_KEYS
│   ├── UserSettings.ts         # Stage 2: 感度/反転/音量/mute シングルトン (localStorage)
│   ├── UserMotion.ts           # Stage 4: prefers-reduced-motion 監視シングルトン
│   ├── GameRecord.ts           # Stage 3: 自己ベスト記録 (Firestore + localStorage hybrid)
│   └── firebase.ts             # Stage 3: Firebase SDK 初期化 + Anonymous Auth + Firestore CRUD
└── main.ts
firebase.json / .firebaserc / firestore.rules / firestore.indexes.json   # Stage 3 (Firebase 設定)
.env.example / .env.local                                                  # Stage 3 (Vite env)
.gitconfig.local                                                          # env-isolation 準拠
```

## 残課題 (別 PR、優先度順)

| # | 項目 | 重要度 | 備考 |
|---|---|---|---|
| 1 | **Firebase Hosting 自動デプロイ CI** | 中 | Service Account 作成 (要明示承認) + GitHub Secrets 登録 + `FirebaseExtended/action-hosting-deploy` を `.github/workflows/firebase-hosting.yml` で記述 |
| 3 | **Collectible.ts の y 計算修正** | 低 | codex Stage 4 で指摘された既存 bug (床上ハートが余分に 0.15m 高浮遊)。視覚影響軽微で本番運用許容範囲 |
| 4 | **Issue #31 (段差 snap 失敗)** | 低 | `postponed` ラベル付き、ユーザー明示指示時のみ着手 |
| 5 | **Anonymous UID 永続性のドキュメント化** | 低 | ブラウザクリア / 別端末では記録に戻れない仕様を README / docs に明記 (codex Stage 3 Low #4) |
| 6 | **UserMotion の matchMedia change listener 解除** | 低 | singleton 実害なし、HMR/test 時の cleanup を整える程度 (codex Stage 4 Low) |
| 7 | **Firebase Firestore のバックアップ (PITR)** | 低 | プロジェクト規模上必須ではないが、規模拡大時に検討 |

## 次セッションで最初にやること

1. `cd /Users/yyyhhh/Projects/tadakayo/game-ai && direnv allow` で `.envrc` 環境変数読込
   - `GH_TOKEN` (yasushi-honda-prog)
   - `CLOUDSDK_ACTIVE_CONFIG_NAME=tadakayo-game` (gcloud は yasushi-honda@tadakayo.jp で操作)
   - `GCP_ACCOUNT="yasushi-honda@tadakayo.jp"` + `FIREBASE_PROJECT="tadakayo-game-yh"`
2. **本番動作確認** (https://tadakayo-game-yh.web.app):
   - タイトル → スタート → welcome toast (4.5 秒) → コンパス HUD「DXの種 4m」
   - ポーズメニュー → 設定 ▾ → 感度・音量スライダー
   - ScoreScreen (5 mission 全クリア時) → 自己ベスト・累計クリア表示
3. 残課題を着手する場合は上記表 #1-6 から優先度順に選択
4. 不明な場合は `/catchup` で最新 Issue / PR / handoff を再確認

## 公開 URL とデプロイ運用

| 項目 | 値 |
|---|---|
| 新公開 URL (Firebase Hosting) | https://tadakayo-game-yh.web.app/ |
| Firebase プロジェクト ID | `tadakayo-game-yh` |
| 法人アカウント | `yasushi-honda@tadakayo.jp` (gcloud / firebase CLI 両方に追加済) |
| デプロイ運用 | 手動 `firebase deploy --only hosting --project tadakayo-game-yh --account yasushi-honda@tadakayo.jp` (CI 自動デプロイは別 PR で整備) |
| Firestore セキュリティルール deploy | `firebase deploy --only firestore:rules --project tadakayo-game-yh` |
| Anonymous Auth 有効化 | Console GUI 経由 (CLI で Auth config 初期化不可、Admin API は Firebase 認証必要) |

### `vite.config.ts` の base 設定
- 新: `base: "/"` (Firebase Hosting ルート配信)
- 旧: `base: "/tadakayo-game/"` (GitHub Pages リポジトリ名)
- manualChunks で `firebase` / `rapier` を別 chunk に分離

## アカウント / 環境分離

- GitHub: `yasushi-honda-prog` (`.envrc` 経由で `GH_TOKEN`)
- Firebase / GCP: `yasushi-honda@tadakayo.jp` (`.envrc` 経由で named config + project)
- nano-banana (将来生成時): `hy.unimail.11@gmail.com` の Vertex AI トークン
- `.gitconfig.local`: git identity を yasushi-honda-prog 名義に固定 (env-isolation ルール準拠)
- `.envrc`: `direnv allow` で cd 時に全環境変数を自動読込

## これまでの経緯

| Phase | 概要 | 状態 | 詳細 |
|---|---|---|---|
| 0-2 | Vite/TS/Three.js + ランナー基盤 + ブランド画像 | ✅ | |
| 3-4 | ランナー深掘り | ❌ close (ピボット) | |
| 5-A〜5-L | 3D オープンワールド完成 (物理、村、ミッション、NPC、モバイル、演出、ScoreScreen、polish 多数) | ✅ | `docs/handoff/2026-05-12_phase5-L.md` |
| **6 Stage 1** | 目標コンパス HUD | ✅ | PR #56 |
| **6 Stage 2** | 設定強化 (感度/反転/音量/永続化) | ✅ | PR #57 |
| **6 Stage 3** | Firestore + Firebase Hosting 移行 | ✅ | PR #58、ADR-2026-05-13 |
| **6 Stage 4** | prefers-reduced-motion + オープニング演出 | ✅ | PR #59 |

詳細な Phase 5 系の旧 handoff: `docs/handoff/2026-05-12_phase5-L.md` 参照。

## 公式作品としての位置づけ

ユーザーは **NPO法人タダカヨの代表/運営者**。本作は法人内イベント + 公式コンテンツ。
ロゴ・キャラクター指定は NPO法人タダカヨ帰属。コードは MIT。

**現在の到達品質** (Phase 6 完了):
- itch.io 良質作品レベルの 3D オープンワールド・プラットフォーマー
- クラウドデータ永続化 (端末ローカルではなく Firestore)
- a11y 包括対応 (感度調整、Y 軸反転、音量分離、prefers-reduced-motion)
- 目標誘導 UI (コンパス + welcome toast)
- 公式法人インフラ (tadakayo.jp Firebase) で配信
- 法人内イベントで「公式作品」として安定運用可能な完成度
