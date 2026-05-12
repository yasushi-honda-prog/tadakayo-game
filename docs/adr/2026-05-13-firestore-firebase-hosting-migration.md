# ADR: Firestore 永続化 + Firebase Hosting 移行 (Phase 6 Stage 3)

- **Status**: Accepted
- **Date**: 2026-05-13
- **PR**: [#58](https://github.com/yasushi-honda-prog/tadakayo-game/pull/58)
- **コミット**: `f10a410 feat(stage3): Firestore 永続化 + Firebase Hosting 移行`

## Context

Phase 5-L まで完成した 3D オープンワールド「タダカヨ村」に Phase 6 ブラッシュアップを実施中、Stage 3 として **自己ベストタイム + 累計クリア回数の永続化** を実装する場面で、当初は localStorage 単独で済ませる方針だった。

しかしユーザー (NPO法人タダカヨ代表) から **「ローカルストレージだけではあまりに恥ずかしいお粗末設計、ちゃんとやるならクラウドにデータ永続化が必須、Firestore を使う」** と方針指示を受け、データ永続化とホスティングの両方を Firebase に統一する形に再設計。

### 検討した選択肢

| 選択肢 | 概要 | 評価 |
|---|---|---|
| A. localStorage 単独 | 最小実装、サーバー不要 | ❌ 別端末で記録共有不可、データクリアで消失。「公式作品」として恥ずかしい設計 |
| B. Firebase Anonymous Auth + Firestore + Firebase Hosting | 認証なし UID、クラウド永続化、CDN 配信、PR プレビュー、Authorized Domain 自動 | ✅ 採用 |
| C. Cloud Functions + Cloud SQL 等 | フル backend | ❌ オーバーキル (ゲーム記録のみで自前 backend 不要) |
| D. Supabase / 他 BaaS | OSS 寄り | ❌ ユーザー法人 (`yasushi-honda@tadakayo.jp`) は Google Workspace で、Firebase と相性が良い |

## Decision

**Firebase プロジェクト `tadakayo-game-yh` を新設し、Firestore (Anonymous Auth) + Firebase Hosting に移行する。**

### 構成詳細

| 項目 | 値 |
|---|---|
| Firebase プロジェクト ID | `tadakayo-game-yh` |
| Display name | `Tadakayo Game` (GCP は日本語非対応のため英語) |
| 作成アカウント | `yasushi-honda@tadakayo.jp` (法人 Workspace) |
| Organization | `797660187808` (tadakayo.jp Workspace organization 配下) |
| Firestore region | `asia-northeast1` (Tokyo) |
| Firestore mode | Native |
| Authentication | Anonymous Auth (匿名 UID、登録不要) |
| Hosting | base path `/` (旧 `/tadakayo-game/` から変更) |

### データモデル

```
gameRecords/{uid}  (uid = Anonymous Auth UID)
  bestTimeSec: number | null
  bestStars: number (0-5)
  playCount: number
  createdAt: Timestamp (初回作成時のみ書込、以降不変)
  updatedAt: Timestamp (毎回 serverTimestamp で更新)
```

### セキュリティルール

- `read/create/update`: `request.auth.uid == userId` のみ許可
- `delete`: 全拒否 (記録削除ニーズなし、必要なら別途要件化)
- `validNewRecord` / `validUpdate` で `hasOnly` 制約 + 型・範囲チェック + `createdAt == prev.createdAt` (codex review Medium #2 反映)

### コード設計

- **`src/config/firebase.ts`**: `FirebaseService` クラスで Firebase SDK 初期化 + Anonymous Auth + Firestore CRUD ヘルパー (`fetchRecord` / `setRecord(uid, v, isFirstWrite)`)
- **`src/config/GameRecord.ts`**: シングルトン、Firestore + localStorage ハイブリッド
  - 起動時: localStorage から即時復元 (同期、UI 即応)、非同期で Firebase init + クラウド fetch + merge
  - `recordPlay(elapsedSec, stars)`: synchronous で `RecordResult` 返却、`upsertCloud` は fire-and-forget
  - クラウド優先マージ: `pickBestTime(local, cloud)` で min、`Math.max(playCount)` (codex Stage 3 Low 許容)
- **グレースフルデグレード**: Firebase 接続失敗時は localStorage 単独で動作継続
- **`vite.config.ts` manualChunks**: `firebase` chunk を dynamic import で分離 (~250KB / gzip 105KB、initial bundle 影響なし)

### CI / デプロイ

- 自動デプロイは **本 ADR 時点では未整備** (Service Account 認証 + GitHub Secrets セットアップが別 PR)
- 当面は **手動 `firebase deploy --only hosting`** で本番反映
- 既存 `.github/workflows/deploy.yml` は GitHub Pages デプロイから build/typecheck 検証のみに改造

## Consequences

### Positive

- **クラウド永続化**: ユーザーの自己ベスト・累計クリアが端末横断的に保持される (将来別端末対応の素地ができる)
- **CDN 高速化**: Google CDN がアジアで GitHub Pages より高速
- **Authorized Domain 自動**: Firebase Hosting と Auth が同一プロジェクト = CORS / 認証ドメイン問題ゼロ
- **PR プレビュー基盤**: 将来 `firebase hosting:channel:deploy` で PR ごとプレビュー URL 提供可能
- **インフラの法人化**: `yasushi-honda@tadakayo.jp` 配下に集約、NPO 法人タダカヨの公式インフラとして運用可能
- **a11y / 設定永続化との一貫性**: Stage 2 で導入した UserSettings シングルトンと同じパターンで GameRecord を実装、保守性向上

### Negative

- **追加インフラ管理コスト**: Firebase プロジェクトの監視・課金監視が必要 (Spark プラン無料枠でカバー予定)
- **`apiKey` のクライアント露出**: Firebase の `apiKey` は public 配布可能だが、誤って他の secret を VITE_FIREBASE_* に紛れ込ませると bundle に埋め込まれる
- **Anonymous UID の永続性制約**: ブラウザクリアで失われる + 別端末で記録共有不可 (codex Stage 3 Low #4、別 PR で docs 化)
- **build chunk 増加**: firebase chunk 449KB / gzip 105KB が追加 (dynamic import で initial bundle 影響なし、但しゲーム開始後のロード時間に微影響)
- **旧 GitHub Pages URL の整理**: 既存ブックマーク / 共有リンクが旧コンテンツに当たる (redirect 化が別 PR)

### Operational notes

- **デプロイ運用**: `firebase deploy --only hosting --project tadakayo-game-yh --account yasushi-honda@tadakayo.jp`
- **セキュリティルール変更**: `firebase deploy --only firestore:rules`
- **Authentication 初期化**: Firebase CLI 不可、初回 Console GUI で「Anonymous」を有効化 (本 ADR 時点で完了済)
- **新規 Service Account 作成**: auto mode classifier がブロック (IAM 操作)、ユーザー明示認可 + GitHub Secrets 登録が CI 整備時に必要

## References

- [Game Accessibility Guidelines (Settings persist)](https://gameaccessibilityguidelines.com/full-list/)
- [Firebase Auth 永続化と Anonymous UID](https://firebase.google.com/docs/auth/web/anonymous-auth)
- [Firestore セキュリティルール (`hasOnly`)](https://firebase.google.com/docs/firestore/security/rules-conditions)
- 関連 ADR: [`2026-05-10-pivot-to-3d-openworld.md`](./2026-05-10-pivot-to-3d-openworld.md) (Rapier 物理エンジン + 3D オープンワールドへのピボット)

## Follow-ups (別 PR)

- [ ] 旧 GitHub Pages URL を HTML redirect 化
- [ ] Firebase Hosting 自動デプロイ CI (Service Account 認証、`FirebaseExtended/action-hosting-deploy`)
- [ ] Anonymous UID 永続性の制約を README / docs 明記
- [ ] Firestore バックアップ (PITR) の検討
- [ ] カスタムドメイン (`game.tadakayo.jp` 等) の検討 (NPO 法人公式コンテンツとして自然)
