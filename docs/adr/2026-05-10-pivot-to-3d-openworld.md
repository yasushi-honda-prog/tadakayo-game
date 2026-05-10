# ADR-2026-05-10: エンドレスランナー → 3D オープンワールドへのピボット + Rapier 採用

- **Status**: Accepted
- **Date**: 2026-05-10
- **Deciders**: yasushi-honda-prog（NPO法人タダカヨ運営）
- **Related**: PR #4 (close), PR #5 (merged), PR #6 (merged)

## Context

NPO法人タダカヨ法人内イベント + 公式コンテンツとして 3D ゲームを開発中。
Phase 0〜4 で **3D エンドレスランナー** を実装し、しゃがみ・コンボ・シールド・ステージ進行・難易度・音・チュートリアルまで深掘りした。

しかしユーザー（NPO 運営者、対象プレイヤーは介護業界の DX 推進担当）から複数回にわたり以下の批判的フィードバックを受けた:

1. 「ジャンプの意味が分からない」（ジャンプして取れる空中アイテムを実装しても根本解決せず）
2. 「しゃがみモーションが雑」（スプライトの縦圧縮では限界、専用画像で改善後も）
3. 「クオリティ 10 段階で 1」「単調かつクオリティが低い」
4. 「3D マリオレベルのオープンワールド + 物理演算 + ミッション化が必須」
5. 「時間がかかってもよい」「どこに出しても恥ずかしくないクオリティ」
6. 「無料 web ゲームでもこれより面白いものはある」

エンドレスランナーは内在的に「タイミング失敗のストレス」を抱えるジャンルで、操作快適性をいくら改善しても「単調」「ストレスフル」の根本問題は解消できないと判断。

## Decision

**1. ジャンルを 3D 三人称オープンワールド・プラットフォーマーに転換する**

- 「タダカヨ村」1 ステージ + 5 ミッションの構成
- 中央広場、タダスクの塔（ジャンプアスレチック）、タダレク広場、タダコミュ会館、装飾物
- ミッション例: ハート 10 個収集 / 塔の頂上到達 / 3 NPC と会話 / 広場でアクション / オールクリア

**2. 物理エンジンとして Rapier 3D (`@dimforge/rapier3d-compat`) を採用する**

選定根拠:
- Rust 実装、WASM ビルド。2025-2026 時点で Three.js コミュニティ最高性能との評価（[discourse.threejs.org](https://discourse.threejs.org/t/rapier-vs-cannon-performance/53475)）
- `KinematicCharacterController` 公式サポートで character controller 実装が簡単
- CCD（連続衝突検出）で高速移動時のすり抜け防止
- 商用品質、長期メンテナンス
- bundle +500 KB（gzip）の代償は商用品質確保のため妥当

代替案:
- cannon-es (Pure JS): 学習・プロトタイプ向きだが、character controller は自前実装が必要、性能で Rapier に劣る → 却下
- ammo.js: WASM、レガシーで API が複雑 → 却下
- 自前 AABB 継続: オープンワールドの坂・段差・複雑形状で破綻 → 却下

**3. PC + モバイル両対応とする**

- PC: WASD + Pointer Lock マウス + Space ジャンプ + E アクション + Shift 走る
- モバイル: 仮想スティック（左下）+ ジャンプ・アクションボタン（右下）+ スワイプ視点回転（Phase 5-E で実装）

**4. キャラ表現は 4 方向ビルボードスプライト**

- 3D モデル（glTF）は時間コスト大、現実的でない
- nano-banana (Gemini 3.1 Flash Image) で 4 方向 × 各アクション、計 12 sprite を生成
- カメラ→キャラ角度差で `front` / `back` / `sideRight` / `sideLeft` を判別
- `sideRight` / `sideLeft` は専用素材（左右反転は AI 絵柄の非対称で違和感が出るため避ける）

**5. 既存 PR #4（ランナー深掘り）は close、Phase 0-2 のみ main に残す**

- Phase 5 で `src/game/` を全面削除し、`src/core/`, `src/entities/`, `src/world/`, `src/input/` の新構造に置換
- 流用するのは画像（タダカヨちゃん front/jump、ロゴ）、`brand.ts`、`AudioManager`、`deploy.yml`、Vite/TS 設定

## Consequences

### Positive

- 操作の単調さが消え、ステージ探索・ミッション達成という能動的な体験が提供できる
- 物理エンジンによる重力・衝突・坂登りで「3D 空間にいる」体感
- 三人称カメラで世界観の没入感
- ブランドの介護 DX メタファー（タダスク = 学校風、タダレク = 広場、タダコミュ = 会館）を世界観に組み込める
- 5 ミッション制で再プレイ性が出る

### Negative

- 開発期間が長くなる（Phase 5 で 10 営業日想定）
- bundle size が 485 KB → 2.7 MB に増大（gzip 123 KB → 960 KB）。初回ロード 1〜2 秒。Phase 5-F で code split で改善予定
- iOS Safari の Pointer Lock 限定対応 → モバイル仮想スティックが必須となり実装量増
- 4 方向ビルボードは 3D モデルに比べて自由度が低い（カメラ角度との不一致、上下視点の制約）

### Neutral

- 既存 Phase 3-4 のしゃがみ・コンボ・シールド・難易度・音・チュートリアルの実装ノウハウは Phase 5-C 以降の機能に部分的に転用可能（GameState のコンボ機構など）
- 既存 sprite アセット（run/jump）は流用可能、追加 8〜12 sprite で 4 方向対応

## Verification

- Phase 5-A 完了時に本番 URL で実機確認:
  - クリックで視点ロック → カーソル消失
  - WASD でカメラ基準の方向に歩ける
  - Space でジャンプ + バッファで連続ジャンプ
  - 段差・足場をジャンプで登れる
  - 高い壁にジャンプでも越えられない（物理が機能）
  - 4 方向 sprite が正しく切り替わる（前進=背中 / 後退=顔 / 左=左側面 / 右=右側面）

- 各 Phase 完了時に PR #5〜#10 を出して段階レビュー

## References

- 実装プラン: `~/.claude/plans/yasushi-honda-prog-github-githubpages-us-transient-summit.md`
- Endless Runner Best Practices: [gamedeveloper.com](https://www.gamedeveloper.com/design/endless-runner-games-how-to-think-and-design-plus-some-history-)
- Subway Surfers vs Temple Run: [subwaysrf.com](https://www.subwaysrf.com/subway-surfers-vs-temple-run/)
- Rapier vs Cannon: [discourse.threejs.org](https://discourse.threejs.org/t/rapier-vs-cannon-performance/53475)
- セッションハンドオフ: `docs/handoff/LATEST.md`
