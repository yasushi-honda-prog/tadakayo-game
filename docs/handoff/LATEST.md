# タダカヨ村 3D オープンワールド — セッションハンドオフ

最終更新: 2026-05-13 (Phase 6 全 Stage + 配信インフラ + 品質改善 + UX hotfix + **iPhone 音/操作 hotfix セッション PR #73-77** 完了)

## 現在地点

- **リポジトリ**: [yasushi-honda-prog/tadakayo-game](https://github.com/yasushi-honda-prog/tadakayo-game)
- **公開 URL (新、現用)**: https://tadakayo-game-yh.web.app/ (Firebase Hosting)
- **公開 URL (旧、redirect 中)**: https://yasushi-honda-prog.github.io/tadakayo-game/ → 新 URL へ `meta refresh` + `location.replace` で自動転送 (`redirect/index.html` + `.github/workflows/pages-redirect.yml`)
- **作業ディレクトリ**: `/Users/yyyhhh/Projects/tadakayo/game-ai`
- **現在ブランチ**: `main` (同期済み、最新コミット `4d39702`)
- **Phase 6 全完了** ✅ (2026-05-13): ブラッシュアップ Stage 1-4 + 配信インフラ PR #61-62 + 品質改善 PR #64-66 + UX hotfix PR #69-71 + **iPhone 音/操作 hotfix PR #73-77**
- **未マージ PR**: なし (stale PR #42 は close not planned)

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

## Phase 6 後の配信インフラ整備 (2026-05-13、PR #61-62)

Stage 1-4 完了後、Stage 3 で発生した「旧 GitHub Pages URL に古いコンテンツが残存」「本番 deploy が手動運用」の 2 つの運用負債を解消した。

| PR | 内容 | 変更規模 |
|---|---|---|
| [#61](https://github.com/yasushi-honda-prog/tadakayo-game/pull/61) | 旧 `yasushi-honda-prog.github.io/tadakayo-game/` → 新 `tadakayo-game-yh.web.app/` への `meta refresh` + `location.replace` redirect (`redirect/index.html` + `.github/workflows/pages-redirect.yml`)。canonical link + 日本語通知文 + light/dark mode 対応 | 4 files, +125/-6 |
| [#62](https://github.com/yasushi-honda-prog/tadakayo-game/pull/62) | `.github/workflows/firebase-hosting.yml` で main push 時に live channel へ自動 deploy。SA `github-actions-hosting@tadakayo-game-yh` を最小権限 (`roles/firebasehosting.admin` のみ) で作成、`FIREBASE_SERVICE_ACCOUNT_TADAKAYO_GAME_YH` + `VITE_FIREBASE_*` 6 件を Secrets 登録 | 5 files, +115/-17 |

両 PR とも `FirebaseExtended/action-hosting-deploy@v0` や Pages workflow に `run:` ステップを含めず injection 面ゼロ、permissions 最小、`paths-ignore` で docs / redirect 専用 PR では deploy をスキップする設計。

## 配信インフラ整備後の品質改善 (2026-05-13、PR #64-#66)

配信インフラ整備後、codex Stage 3-4 の Low 指摘 3 件を消化する小規模 PR を 3 本マージ。各 PR は base=main / 1 file / <30 行で、typecheck + build 全 PASS。

| PR | 内容 | 変更規模 |
|---|---|---|
| [#64](https://github.com/yasushi-honda-prog/tadakayo-game/pull/64) | README に「データ保存とアカウント」セクション追加。Anonymous Auth UID の永続性仕様 (ブラウザクリア / 別端末で記録に戻れない) を明記 (codex Stage 3 Low #4) | 1 file, +25/-0 |
| [#65](https://github.com/yasushi-honda-prog/tadakayo-game/pull/65) | UserMotion に matchMedia listener 解除可能な `dispose()` メソッドを追加。`_reset()` で dispose を経由してインスタンスを破棄するよう変更し、test / HMR cleanup を構造的に整備 (codex Stage 4 Low) | 1 file, +24/-2 |
| [#66](https://github.com/yasushi-honda-prog/tadakayo-game/pull/66) | **既存 bug 真因解消**: 床面 y > 0 の収集ハート (中央広場 0.15m / タダレク広場 0.2m) が animate 開始直後に +0.15-0.2m 余分に浮上する問題を `meshBaseLocalY` (object 相対 0.6) と `baseY` (絶対 y) を明示分離して修正 (codex Stage 4 指摘) | 1 file, +22/-6 |

並行して **stale PR #42 を close (not planned)**: Phase 5-I 直後の handoff 更新 PR が後続 11 PR (Phase 5-J/K/L + Phase 6 + 配信インフラ) で内容統合済み・現行 docs と整合しなくなったため。v1.0.0 タグ記録は git tag + GitHub Release + `docs/handoff/2026-05-12_phase5-L.md` で永続保全されており情報損失なし。

## 品質改善後の UX hotfix セッション (2026-05-13、PR #69-71)

PR #64-66 完了後、ユーザー実機プレイによる目視 hotfix を 3 連続で対応。すべて pr-review-toolkit セカンドオピニオン (code-reviewer + comment-analyzer) を経てマージ。

| PR | 内容 | 変更規模 |
|---|---|---|
| [#69](https://github.com/yasushi-honda-prog/tadakayo-game/pull/69) | welcome toast「画面上の▲が次の目標を示します」が「示しま / す」と 1 文字孤立改行する破綻を、`\n` 明示 + `.hud-toast.welcome { white-space: pre-line }` で 2 行固定 | 2 files, +5/-1 |
| [#70](https://github.com/yasushi-honda-prog/tadakayo-game/pull/70) | favicon 空 (`data:,`) を解消。`tadakayo-front-idle.png` ヘッドフォン込み 440x440 正方形クロップ + Pillow Lanczos で `favicon.ico` (16/32/48 マルチサイズ) / `favicon-32.png` / `apple-touch-icon.png` (180x180) を生成 (`scripts/generate-favicon.py`) | 5 files, +57/-2 |
| [#71](https://github.com/yasushi-honda-prog/tadakayo-game/pull/71) | NPC 服透け + elder ベンチ貫通の 2 件真因対応。`remove-checker-bg.py` の 4 隅 BFS が拾わない閉じ領域を `scripts/fill-sprite-internal-holes.py` で白 fill (npc-elder/-nurse/-manager で 1.5-4.6% の透明 hole 解消)。elder NPC 位置を `(15.4, 0, 4)` → `(15.4, 0, 5.5)` に z+1.5m してビルボード sprite のベンチ貫通を回避 | 5 files, +99/-12 (累計) |

### pr-review-toolkit セカンドオピニオン

| PR | code-reviewer | comment-analyzer | 反映 |
|---|---|---|---|
| #69 | Critical/Important なし | n/a (CSS 微小) | そのままマージ |
| #70 | Critical/Important なし、Suggestion 5 件 (rating <7) | rating 8/10 → I-1/I-2 反映で 9/10 | docstring 誇張表現 + comment rot プロトコル追記で reroll |
| #71 | Critical/Important なし、Suggestion 6 件 | rating 8/10 → I-1/I-2/I-3 反映で 9-10/10 | JSDoc を forward-looking 制約に書き直し + 数値 rot を categorical 化 + script docstring に前提条件 (白系 hole 専用 / glob 禁止) を追記 |

### 構造的に得られた知見

1. **`scripts/remove-checker-bg.py` の 4 隅 BFS は閉じ領域を取りこぼす** — title-logo (PR #50) と NPC (PR #71) で同じ症状が再発した。一般化された対策スクリプトとして `fill-sprite-internal-holes.py` (内部透明→白) と `fix-title-logo-checker.py` (内部白→透明) のペアでパイプライン化済み。新キャラ追加時は両スクリプトの適用要否を判断すること。
2. **ビルボード sprite と床立ち static collider は xz 完全一致を避ける** — `Game.ts:setupNpcs` JSDoc に「ベンチ z=4 から 1m 以上離す」forward-looking 制約を記述。NPC 追加時の同類事故予防。
3. **favicon は static asset として `public/` 直下に置く + `vite.config.ts` `base: "/"` 配下で `/favicon.ico` 絶対パス指定が安定** — Firebase Hosting に統一済の現環境では `dist/` 直下に自動コピーされ、`firebase.json` の `headers` は `/assets/**` のみに immutable cache を当てて favicon は Firebase デフォルト 1h cache でアイコン差替も素早く反映可能。

## UX hotfix 後の iPhone 音/操作 hotfix セッション (2026-05-13、PR #73-77)

PR #69-71 完了後、ユーザー実機 (iPhone) 検証で 2 件の hotfix。操作問題は典型 fix で 1 PR 完了、音問題はコード仮説に飛びついて **4 連続失敗** の後に真因到達 → 整理 PR で過剰防御削除という重要な教訓を含む。

| PR | 内容 | 結果 | 変更規模 |
|---|---|---|---|
| [#73](https://github.com/yasushi-honda-prog/tadakayo-game/pull/73) | iOS Safari silent buffer unlock + `await ctx.resume()` を `void` 化 | ❌ 音未解決、後に `await` 復元・コメント整理 | 1 file, +22/-2 |
| [#74](https://github.com/yasushi-honda-prog/tadakayo-game/pull/74) | **TouchInput `click` → `pointerdown` (✅ 操作の真の fix)** + AudioManager sampleRate 動的化 + suspended セーフティネット (後者は #77 で削除) | ⭕ 操作問題解決、❌ 音は依然鳴らず | 2 files, +45/-20 |
| [#75](https://github.com/yasushi-honda-prog/tadakayo-game/pull/75) | HTMLAudioElement + silent.mp3 で iOS サイレントスイッチ bypass | ❌ 音未解決、副作用持ち (後に #77 で削除) | 2 files, +56/-0 |
| **[#76](https://github.com/yasushi-honda-prog/tadakayo-game/pull/76)** | **`bgm-village.ogg` + SE 6 個を MP3 へ変換 (iOS Safari Web Audio `decodeAudioData()` は OGG Vorbis 非対応)** | ⭕ **真因 fix** | 16 files, +13/-9 |
| **[#77](https://github.com/yasushi-honda-prog/tadakayo-game/pull/77)** | **PR #74/#75 の過剰防御整理** (HTMLAudioElement + silent.mp3 削除、suspended セーフティネット削除、試行錯誤コメント整理) | ⭕ 整理 | 3 files, +14/-81 |

### 音問題の真因 (2 つ)

1. **村 BGM/SE が `.ogg` で iOS Safari Web Audio が decode 不可**: iOS Safari の `decodeAudioData()` は OGG Vorbis 非対応 (Safari 18.4+ で `<audio>` 要素経由は OK、Web Audio 経路は 2026 年現在も不可)。PC / Android では decode できるため開発時に気づきにくい。PR #76 で MP3 変換。
2. **端末側面サイレントスイッチ ON**: アプリ側で回避すべきでない (ユーザー意図のミュート尊重)。ユーザー側で OFF に切替で解決。

### 操作問題の真因

仮想スティック (pointercapture 中) と右下ボタン (右指) のマルチタッチで `click` イベントが iOS Safari で取りこぼされる → `pointerdown` で即時発火させ `preventDefault()` + `stopPropagation()` 併用で確実取得 (PR #74)。

### 構造的に得られた教訓 (global memory に保存済み)

1. **iPhone/iOS 音問題は最初に端末側面サイレントスイッチを `AskUserQuestion` で確認** — `~/.claude/memory/feedback_ios_audio_first_check_silent_switch.md`。コード仮説より先に端末側情報を取る。
2. **iOS Safari Web Audio `decodeAudioData()` は OGG Vorbis 非対応** — `~/.claude/memory/reference_ios_safari_web_audio_formats.md`。ゲーム / 音声 Web アプリは MP3 / AAC / WAV を採用。
3. **同一機能 3 連続失敗時は元設計を再レビュー (CLAUDE.md MUST の実践補強)** — `~/.claude/memory/feedback_consecutive_failure_redesign.md`。本セッションでは 4 連続失敗まで実践できず、教訓として明文化。

### 音 asset 構成 (整理後)

```
public/assets/audio/
├── bgm-village.mp3       # Kenney Music Jingles - Pizzicato (CC0)、村 BGM
├── bgm-dance.mp3         # Mixkit "Karma" by Michael Ramir C.、ダンス BGM
├── se-pickup.mp3
├── se-mission-clear.mp3
├── se-jump.mp3
├── se-land.mp3
├── se-dialog-next.mp3
└── se-dialog-open.mp3
```

全 8 ファイル MP3 統一で iOS Safari Web Audio に確実対応。`AudioManager.ts` の `ensureStarted()` は silent buffer unlock + `await ctx.resume()` のシンプルな経路のみ (過剰防御削除済み)。

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

PR #64-#66 で旧 #1 (Collectible y) / #3 (Anonymous UID docs) / #4 (UserMotion listener) を消化済み。残るのは要件整理が必要な低優先度項目のみ。

| # | 項目 | 重要度 | 備考 |
|---|---|---|---|
| 1 | **Issue #31 (段差 snap 失敗)** | 低 | `postponed` ラベル付き、ユーザー明示指示時のみ着手 |
| 2 | **Firebase Firestore のバックアップ (PITR)** | 低 | プロジェクト規模上必須ではないが、規模拡大時に検討 |
| 3 | **PR preview channel 対応** | 低 | `firebase-hosting.yml` を PR open 時にも起動して preview URL を PR コメントに出す。外部 fork PR の secrets 不可制約と要件整理が必要 |
| 4 | **Workload Identity Federation 移行** | 低 | 現状 SA JSON key で運用。ismap 準拠強化のため WIF へ移行 (`google-github-actions/auth@v2` の workload_identity_provider に置換) |

## 次セッションで最初にやること

1. `cd /Users/yyyhhh/Projects/tadakayo/game-ai && direnv allow` で `.envrc` 環境変数読込
   - `GH_TOKEN` (yasushi-honda-prog)
   - `CLOUDSDK_ACTIVE_CONFIG_NAME=tadakayo-game` (gcloud は yasushi-honda@tadakayo.jp で操作)
   - `GCP_ACCOUNT="yasushi-honda@tadakayo.jp"` + `FIREBASE_PROJECT="tadakayo-game-yh"`
2. **本番動作確認** (https://tadakayo-game-yh.web.app):
   - タイトル → スタート → welcome toast (4.5 秒) → コンパス HUD「DXの種 4m」
   - ポーズメニュー → 設定 ▾ → 感度・音量スライダー
   - ScoreScreen (5 mission 全クリア時) → 自己ベスト・累計クリア表示
3. 残課題を着手する場合は上記表 #1-7 から優先度順に選択 (現状すべて低優先度)
4. 不明な場合は `/catchup` で最新 Issue / PR / handoff を再確認

## 公開 URL とデプロイ運用

| 項目 | 値 |
|---|---|
| 新公開 URL (Firebase Hosting) | https://tadakayo-game-yh.web.app/ |
| Firebase プロジェクト ID | `tadakayo-game-yh` |
| 法人アカウント | `yasushi-honda@tadakayo.jp` (gcloud / firebase CLI 両方に追加済) |
| デプロイ運用 | **main push → `firebase-hosting.yml` で自動 deploy** (Stage 4 / 2026-05-13)。手動運用は `firebase deploy --only hosting --project tadakayo-game-yh --account yasushi-honda@tadakayo.jp` で引き続き可能 |
| 自動デプロイ用 SA | `github-actions-hosting@tadakayo-game-yh.iam.gserviceaccount.com` (権限: `roles/firebasehosting.admin` のみ、最小権限) |
| GitHub Secrets | `FIREBASE_SERVICE_ACCOUNT_TADAKAYO_GAME_YH` (SA JSON key) + `VITE_FIREBASE_*` 6 件 (`.env.local` と同じ値) |
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
| **6 配信インフラ** | 旧 GH Pages redirect + Firebase Hosting 自動デプロイ workflow | ✅ | PR #61-62 |
| **6 品質改善** | README データ保存 docs + UserMotion dispose + Collectible y bug 修正 | ✅ | PR #64-66 |
| **6 UX hotfix** | welcome toast 改行 + favicon + NPC 服透け + elder ベンチ貫通 | ✅ | PR #69-71 |

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
