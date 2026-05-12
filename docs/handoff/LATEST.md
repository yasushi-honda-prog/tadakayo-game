# タダカヨ村 3D オープンワールド — セッションハンドオフ

最終更新: 2026-05-12 (Phase 5-L: タイトル本番化 + UI 操作説明統一 + 噴水水しぶき frustum cull hotfix)

## 現在地点

- **リポジトリ**: [yasushi-honda-prog/tadakayo-game](https://github.com/yasushi-honda-prog/tadakayo-game)
- **公開 URL**: https://yasushi-honda-prog.github.io/tadakayo-game/
- **作業ディレクトリ**: `/Users/yyyhhh/Projects/tadakayo/game-ai`
- **現在ブランチ**: `main`(同期済み、最新コミット `3a68b13`)
- **v1.0.0 リリース済 + Phase 5-J UI / 輪郭品質改善 + Phase 5-K title-logo 透明化 + Phase 5-L タイトル本番化 + 噴水 hotfix 完了** ✅(2026-05-12)
- **未マージ PR**: なし

## 2026-05-12 セッション 6 成果 (Phase 5-L: タイトル本番化 + UI 操作説明統一 + 噴水 hotfix)

タイトル画面の「プロトタイプ」表記を削除し本番化。さらにタイトル / HUD / ポーズ画面の操作説明を `<kbd>` + `<dl>` ベースの「キー → やること」対応表に全箇所統一。途中で発覚した噴水水しぶき消失バグ (Three.js InstancedMesh frustum culling false-positive) も同セッションで修正。3 PR マージ。

| PR | 内容 | 効果 |
|---|---|---|
| **#52** | タイトル画面: (a) `Phase 5-F プロトタイプ` バッジ削除 + (b) 操作説明を `<dl>` 対応表化 (`<kbd>` で赤ピル、デスクトップ 2 列 / モバイル 1 列スタック) | タイトル画面が本番仕様に、操作説明の可読性大幅向上 |
| **#53** | (hotfix) 噴水の水しぶき (InstancedMesh) が特定視点で全消失する問題を `droplets.frustumCulled = false` で修正 | カメラ角度で water droplets が一括消失するバグを解消 |
| **#54** | (a) HUD 上部ピルを `<span class="hud-hint-item">` + `<kbd>` に分解 (flex-wrap 対応) + (b) ポーズ画面の操作説明を PR #52 と同じ `<dl>` 対応表に統一 | ゲーム内 UI 全体で操作説明の表現が統一、kbd ピルで視覚的にキー入力箇所が一目で分かる |

### #52 詳細 (タイトル本番化)
- `index.html` から `<div class="phase-tag">Phase 5-F プロトタイプ（演出 + スコア画面）</div>` を削除、合わせて `src/styles/main.css` の `.phase-tag` クラスも削除
- 操作説明を `<section class="hint-section">` + `<h3 class="hint-section-title">` + `<dl class="hint-list">` で再構築、キーは `<kbd>` で赤の丸ピル化
- `.hint-list` は `grid-template-columns: minmax(auto, max-content) 1fr` で 2 列、`@media (max-width: 768px)` で 1 列スタック (dt の下に dd を字下げ)
- 冗長表現を平易化: 「画面クリックでマウス視点操作 ON」→「画面をクリック → マウスで視点を回せるようになる」、「E（会話・踊り）」→「近くの人に話しかける／広場でいっしょに踊る」

### #53 詳細 (噴水水しぶき frustum cull bug)
- **症状**: ユーザー報告「特定の位置で水しぶきだけが消える (水柱は残る)」
- **根本原因**: `droplets` (InstancedMesh) は `this.object.add(droplets)` でローカル位置 (0,0,0) に追加されていたが、実際の粒子は `fountainCenter (cx=18, _, cz=4)` 周辺で `setMatrixAt` 更新される。Three.js は InstancedMesh の bounding sphere を **メッシュの local origin (= world (0,0,0)) + geometry の bounding sphere (radius 1.0)** で計算するため、カメラ frustum から world (0,0,0) が外れる角度では実際の粒子位置に関わらず InstancedMesh 全体が一括 cull される。`waterColumn` (通常 Mesh、position が `(cx, 1.75, cz)`) は bounding sphere が正しく付随するため影響なし → 「水柱は見えるのに粒子だけ消える」症状の説明
- **修正**: 粒子 18 個と軽量なため `droplets.frustumCulled = false` で frustum 判定をバイパス (Three.js 公式 examples の `webgl_instancing_*` でも頻出パターン)

### #54 詳細 (HUD + ポーズ画面の操作説明統一)
- HUD 上部ピル: 長文 1 行を 6 つの `<span class="hud-hint-item">` グループに分解、`<kbd>` でキーを赤の丸ピル化、`flex-wrap: wrap` で画面幅が狭い時に折り返し対応
- ポーズ画面 (操作説明 ▾): PC / モバイルの 2 セクションを `<dl>` 対応表に再構築、タイトル画面と同じ `.hint-section` / `.hint-list` / `kbd` CSS を再利用

### 重要な学び (本セッション)
1. **Three.js InstancedMesh の frustum culling は注意が必要**: InstancedMesh の bounding sphere は「メッシュの local origin + geometry の bounding sphere」で計算される。シーン Group のローカル原点 (0,0,0) に追加されたまま per-instance で遠方に粒子を描画すると、カメラから world 原点が frustum 外に出る角度で全粒子が一括 cull される false-positive が発生。粒子数が少ない場合は `frustumCulled = false` がもっとも素直な対処。代替の `computeBoundingSphere()` 毎フレーム再計算は perf 的に割に合わない
2. **UI コンポーネント横断で同じパターンを共有すると保守性が高い**: タイトル画面 (#52) で導入した `.hint-section` / `.hint-list` / `kbd` CSS は HUD・ポーズ画面 (#54) でもそのまま再利用でき、3 箇所で一貫した UX を最小コストで実現。次回類似の操作説明が出てきたらまずこのパターン適用を検討
3. **小規模バグ修正は仮説 3 つ以上の素早い列挙が高速判断につながる**: 噴水水しぶき消失バグは「視点で消える + 水柱は残る (Mesh) + 粒子だけ消える (InstancedMesh)」という症状から、3 仮説 (frustum culling / 透明度ソート / shadow) を上げて Three.js の InstancedMesh bounding sphere 仕様 1 個に確信を持って絞り込み、コード 1 行 (+ コメント 3 行) で解決

## 2026-05-12 セッション 5 成果 (Phase 5-K: title-logo「カ」内部チェッカー柄透明化 hotfix)

ユーザー報告: タイトル画面ロゴの「カ」の内部にチェッカー柄が残る。

| PR | 内容 | 効果 |
|---|---|---|
| **#50** | `title-logo.png` の閉じ領域内チェッカー柄 8,248 px (R~254 明灰) を透明化 + `scripts/fix-title-logo-checker.py` 追加 | 「カ」内部の市松模様残骸を除去、本番反映確認済 |

### #50 詳細
- **真因**: `remove-checker-bg.py` は 4 隅起点の連結成分しか辿らないため、文字輪郭で**完全に閉じた領域**に取り残されたチェッカー柄ピクセル (alpha=255, RGB=明灰の市松ピクセル値) が焼き込まれたまま残っていた。「カ」の閉じ領域だけが該当 (他文字は外周と細い隙間で繋がっていた)
- **対応**: ロゴ画像は「キャラ内側白色保護 (靴の中身)」が不要なので、bg_candidate (透明 / 純黒 / 明灰グレー) 該当ピクセルを **全領域 alpha=0** にする専用後処理 `scripts/fix-title-logo-checker.py` を追加
- ロゴは HTML `<img class="title-logo-img">` (index.html:46) で表示 → Three.js sprite ではないため mipmap / alphaTest 問題は無関係
- 本番 (GitHub Pages) で「カ」内部にピンク背景が透けて見えることをユーザー確認済 (Image #2)

### 重要な学び (本セッション)
1. **AI 生成画像の後処理は「キャラ用」と「ロゴ用」で要件が分かれる**: キャラは靴の白を保護する必要 (4 隅起点 + char_dilation 救済) があるが、ロゴは保護対象がない (全 bg_candidate を透明化) → スクリプトを分離。汎用化のために統合スクリプトに `--all-bg` フラグを足すより、ユースケース別の単機能スクリプトを並列に持つ方が読みやすい
2. **PR の base は必ず作成直後に確認する**: 当初 `gh pr create` のデフォルト base が `feat/bootstrap` になっており +6197/-1084 / 86 files の巨大 PR として作成された。`gh pr edit 50 --base main` で +48/-0 / 2 files の適正サイズに修正。次回以降は `gh pr create --base main` を明示指定する

## 2026-05-12 セッション 4 成果 (Phase 5-J: UI + 輪郭品質改善 + sprite 不可視 hotfix)

v1.0.0 リリース後の追加 polish。6 PR マージ。最後の PR #48 はユーザー環境固有の sprite 不可視を codex セカンドオピニオン併用で hotfix 対応。

| PR | 内容 | 効果 |
|---|---|---|
| **#43** | canvas 上の十字カーソル (`cursor: crosshair`) を非表示化 | PointerLock OFF 時の常時赤十字を解消 |
| **#44** | `scripts/clean-white-halo.py` 追加、21 PNG (3-9% 削除) | スプライト輪郭の白いハロー除去 |
| **#45** | sprite テクスチャに `LinearMipmapLinearFilter` + `generateMipmaps=true` 適用 | 縮小エイリアシング除去 (→ #48 で sprite 側 revert) |
| **#46** | `scripts/soften-alpha.py` 追加、22 PNG の alpha を Gaussian σ=0.6 でぼかす | AI 線画の折れ線ジャギーをソフト化 |
| **#47** | タダスクの塔の看板柱を看板下面 (y=0.85) で止める | 柱が看板を 0.55m 貫通して Z-fighting (細い縦線) を解消 |
| **#48** | (hotfix) sprite 側で PR #45 を revert + SpriteMaterial に `alphaTest: 0.01` 追加 | ユーザー環境で全 sprite 不可視になる症状の対処 |

### #43 詳細
- 元: `#game-canvas { cursor: crosshair }` で PointerLock OFF 時 (Esc 後 / モーダル中) に常時赤十字
- 修正: `cursor: none` に変更 + `.screen { pointer-events: auto; cursor: default }` 追加 (TitleScreen 用に矢印カーソル復活)
- HUD / DialogBox / MissionPanel / PauseMenu / ScoreScreen は body から `auto` 継承 (= 標準矢印) で問題なし

### #44 詳細 (PNG 後処理 - 白ハロー除去)
- AI (nano-banana) がチェッカー背景上に描く際に anti-alias の白ハローを残す
- 既存 `remove-checker-bg.py` の **靴保護 12px dilation の副作用** で白ハローも「キャラの一部」として保存されていた
- 新規 `scripts/clean-white-halo.py`: alpha=0 隣接 8px 以内の **ほぼ白 (RGB>=200) かつ低彩度 (gray)** ピクセルを透明化
- 環境変数 `HALO_ITER=8 HALO_RGB_MIN=200` (デフォルト)、キャラ内部の白色 (歯/目のハイライト) と黒線 anti-alias の中明度グレーは保護条件で除外

### #45 → #48 詳細 (mipmap 適用とその撤回)
- **#45**: `Player.ts` / `NPC.ts` / `DanceNpc.ts` の Texture を `LinearFilter` → `LinearMipmapLinearFilter` + `generateMipmaps=true`、dev / Playwright Chromium で輪郭が大幅に滑らかに
- **本番ユーザー報告**: 「キャラクターが誰もいない (Player + NPC + DanceNpc すべて表示されない)」、Mesh (Collectible / 街灯 / 噴水 / 建物) は表示 → **Sprite 系のみ消える**
- **dev / Chromium 新規セッションでは無症状** (検証済)、ユーザー環境固有
- **codex セカンドオピニオン要約**: PR #45 mipmap completeness 違反 (透明領域 RGB bleed なしで mipmap chain 破綻) + PR #46 で生まれた alpha=1-10 極小値が mipmap 縮小で alpha=2-3 まで下がり特定 GPU で完全透明化
- **#48 hotfix**: sprite 側だけ `LinearFilter` に戻す + `generateMipmaps=false` 明示 + SpriteMaterial に `alphaTest: 0.01` (極小 alpha 切り捨ての防御層)
- 副作用: PR #45 の輪郭品質改善は失われるが、PR #44 (白ハロー除去) + PR #46 (alpha smoothing) は維持されるため初期状態より改善

### #46 詳細 (PNG 後処理 - alpha Gaussian smoothing)
- 残るジャギー = AI 線画自体の折れ線描画。RGB は触らず alpha チャンネルだけ Gaussian σ=0.6 でぼかすことで透明境界の「角」を 1-2 px ほど丸めて目立たなくする
- 22 PNG 全適用、1 枚あたり 13K-32K alpha pixel が変更 (大半は端 1-2 px の階調化)
- title-logo にも適用 (alpha 隣接ピクセル変化あり)

### #47 詳細 (看板柱の貫通修正)
- 看板: 中心 y=1.4, half y=0.55 → 範囲 y=0.85-1.95
- 柱 (修正前): 中心 y=0.7, half y=0.7 → 範囲 y=0-1.4 → **看板内部に 0.55m 突き出て Z-fighting**
- 修正: 中心 y=0.425, half y=0.425 → top y=0.85 (看板下面と接する)、physics collider も同時更新

### 重要な学び (本セッション)
1. **dev で再現しないユーザー固有不具合は環境差分の仮説検証が必須**: 単なるブラウザキャッシュ問題と決めつけず、変更要因 (PR #45 + #46) と GPU/ドライバ依存の WebGL 仕様 (mipmap completeness、alphaTest) を洗い出す
2. **codex セカンドオピニオンは大規模 PR 後の不具合切り分けで有効**: 6 エージェント並列レビューより codex の「他の見落としは？」相談の方が hotfix では速い
3. **アセット pipeline の mipmap 化は RGB bleed + alpha floor clamp + alphaTest をセットで実装する必要**: 透明領域 RGB を周辺色で埋めないと mipmap 縮小で白 fringe が混ざる (codex 指摘、CLAUDE.md「残課題」に反映済)
4. **trade-off 許容判断**: PR #45 の輪郭品質改善 vs sprite 不可視回避 → 後者を優先 (decision-maker 領分の判断)、ただし将来 mipmap 復活する場合の必要条件を文書化

## 2026-05-12 セッション 3 成果 (Phase 5-I: ScoreScreen UX + 看板 + collider 復活)

ユーザーから 2 件の報告を受けて 2 回の PR で対応:
1. **スコア画面のボタンが押せない** → PR #39 で `exitPointerLock()` 追加 (不十分) → PR #40 で CSS の真因 (`pointer-events` 継承) を解決
2. **立て看板に文字がない** → PR #39 で CanvasTexture + 自動フォント縮小で「タダスクの塔」を描画
3. **オブジェクトすり抜け (中央モニュメント / 4 柱)** → PR #40 で Phase 5-G の装飾化を revert し collider 復活

| PR | 内容 | 効果 |
|---|---|---|
| **#39** | ScoreScreen.show() で `document.exitPointerLock()` 呼び出し + タダスクの塔の立て看板に CanvasTexture テキスト | スコア画面で PointerLock 自動解除、看板に「タダスクの塔」表示 |
| **#40** | `.score-screen { pointer-events: auto }` 追加 + 中央モニュメント・4 柱の collider 復活 | スコア画面ボタンクリック貫通の真因解消、すり抜け解消 |

### PR #39 詳細
- `src/ui/ScoreScreen.ts` `show()` 冒頭で `document.exitPointerLock()` を呼ぶ (PauseMenu は Esc 経由でブラウザが自動解除するが ScoreScreen は missionCleared から自動表示されるため明示的解除が必要)
- `src/world/Village.ts` `buildTadasukuTower()` の看板を **BoxGeometry + multi-material** に置換 (±Z 2 面に CanvasTexture、残り 4 面は黄色単色)
- `makeSignTexture()` ヘルパー: canvas 512×314 (看板物理 aspect 1.8/1.1 に合わせる)、`ctx.measureText` で内側幅に収まる最大フォントサイズを 96px から 4px 刻みで自動選択 → Noto Sans JP のロード前後でも文字がはみ出ない
- `dispose()` で `material.map.dispose()` 追加 (texture リーク防止)

### PR #40 詳細 (真因対応)
- **ScoreScreen ボタン真因**: PR #39 の `exitPointerLock` だけでは不十分。実は親 `#ui-layer` が `pointer-events: none` を持ち、`.screen` クラスを持つ要素 (TitleScreen) や個別に `pointer-events: auto` を持つモーダル (`.pause-menu`, `.mission-panel`) だけが overlay 機能していた。`.score-screen` には `pointer-events` 設定がなく、クリックが背後の canvas に貫通していた。`.score-screen { pointer-events: auto }` 追加で解決
- **collider 復活**: Phase 5-G で Issue #31 (Player が乗れる) 対応のため装飾化していた中央モニュメント (台座 + ピンクキューブ) と タダレク広場 4 隅の柱に `physics.addStaticCuboid` を復活。ユーザー判断「すり抜けは駄目 (上に乗れても良い)」に方針変更。Player sprite 浮きは PR #36 で解消済なので上に乗っても綺麗に立つ

### 重要な学び (PR #39 → #40 の段階)
1. **症状治療と真因対応を区別する**: PR #39 で `exitPointerLock` を入れたが、これは「Pointer Lock 中でクリックできない」症状の対処であって、`pointer-events` 継承で canvas に貫通する真因とは別。ユーザーから「まだ駄目」と再報告を受けて初めて真因 (CSS) を発見した。**最初に PauseMenu/MissionPanel との class 構造差分を確認していれば 1 回の PR で解決できた**
2. **CSS の `pointer-events: none` 継承は overlay 設計で頻発する落とし穴**: 親 (`#ui-layer`) で全 UI クリックを通す設計にした場合、モーダル overlay は **必ず個別に `pointer-events: auto` を設定**する必要がある。新しいモーダルを追加する際のチェック項目に
3. **decision-maker の方針変更を素直に受け入れる**: Phase 5-G で「Player が乗れる」回避のため collider を外したが、ユーザー判断で「すり抜けは駄目」に変わったら revert する。AI 側で「乗れる問題が再発するから」と説得しない (decision-maker の領分)

## 2026-05-12 セッション 2 成果 (Issue #31 真因対応 + UX)

ユーザー報告「カメラ視点切り替えでキャラクターが浮く」「ジャンプしてない」を **Playwright MCP で実機検証** した結果、Issue #31 のスコープ 3 (Rapier KCC 段差 snap 失敗) 仮説は誤りと判明。真因は **Player sprite が常に capsule 足元から 0.85m 浮いて表示される設計バグ**だった。

| PR | 内容 | 効果 |
|---|---|---|
| **#36** | Player sprite が常に capsule 足元から 0.85m 浮く問題を修正 (Issue #31 真因) | カメラを動かしても Player が地面に接地、本番反映済 |
| **#37** | 操作ヒントの「視点ロック」表現を「マウス視点 ON/OFF」に変更 + 「矢印キーで移動」 | 紛らわしい表現を排除 |
| **#35** | (close) タダレク広場の噴水・ベンチに乗れる挙動を解消 | ユーザー判断「乗れても良い」で見送り、PR #36 で sprite 浮きが消えれば UX 影響低 |

### PR #36 詳細 (真因対応)
- `src/entities/Player.ts:84` の式が capsule の halfHeight (0.55) + radius (0.35) = 0.9m を考慮しておらず、sprite 底面が常に capsule 足元より 0.85m 高かった
- 旧式: `sprite.position.y = SPRITE_SIZE.height / 2 - 0.05` (= 0.95) → sprite 中心が capsule center + 0.95m
- 新式: `sprite.position.y = SPRITE_SIZE.height / 2 - (COLLIDER.halfHeight + COLLIDER.radius)` (= 0.10) → sprite 底面 = capsule 足元
- 2 箇所 (constructor + update の baseY) を同式に統一、PLAYER.COLLIDER から値を引くため将来 capsule 寸法を変えても自動追従
- Playwright で sprite 底面 world Y = capsule 足元 world Y (完全一致、誤差 0.01m 内) を確認
- 本番 (https://yasushi-honda-prog.github.io/tadakayo-game/) で 3 アングル (デフォルト/俯瞰/横方向) の接地を視覚確認済

### PR #37 詳細 (UX 文言)
- タイトル画面 PC 操作: 「マウスクリックで視点ロック」→「画面クリックでマウス視点操作 ON」、「Esc で視点ロック解除」→「Esc で視点操作解除」
- HUD ヒント: 「クリックで視点ロック」→「クリックでマウス視点変更 ON / Esc で OFF」、「WASD 移動」→「矢印キーで移動」
- 「視点ロック」表現が「視点を固定する」と誤解されやすい点を排除

### 重要な学び (Issue #31 検証プロセス)
1. **ユーザーの現場観察を AI 推測より優先する**: PR #33 マージ時のコメント「カメラ切替が原因ではない (ジャンプ中の偶然着地)」は AI 推測で誤り。ユーザーが「ジャンプしてない」と明示しているのに別仮説 (歩行 + 構造物乗り上げ) で検証を進めた結果、PR #35 を起票 → close するノイズを生んだ
2. **Playwright MCP は executor の標準ツール**: ユーザーに現場確認を依頼する前に、自分で navigate して数値・スクリーンショットで一次データを取る
3. **「物理接地 (grounded=true)」と「視覚接地 (sprite 底面 = 地面)」は別問題**: grounded だけ確認して接地完了と判断するのは不十分。sprite の世界座標で「絵が地面に立っているか」を必ず別途確認する

## 2026-05-12 セッション 1 成果 (午前)

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
   - Player の足が地面に接地 (sprite 浮きが消えていること、PR #36)
   - HUD/タイトル画面のヒント文言が新表現 (「クリックでマウス視点変更 ON / Esc で OFF」「矢印キーで移動」、PR #37)
   - タイトルロゴ「カ」内部のチェッカー柄が消えていること (PR #50、本番反映済)
3. 残課題 (low priority):
   - **Issue #31 OPEN (スコープ 3 のみ残)**: 段差エッジで capsule が浮く Rapier KCC 挙動 (P2、本人 postpone 宣言済「単独着手は当面見送り、要請があれば再着手」)
   - **噴水/ベンチ歩行乗り上げ**: PR #35 close (ユーザー判断「乗れても良い」)、sprite 浮き解消後の見え方を本番で再評価し UX 判定
   - **Rapier 0.20+ アップデート時の init() deprecation 再評価** (0.19.3 が最新、未リリース)
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
| 5-H 真因対応 | Player sprite 0.85m 浮き修正 (PR #36、Issue #31 真因) + UX 文言修正 (PR #37) | ✅ |
| 5-I ScoreScreen UX | ScoreScreen クリック貫通真因解消 + 立て看板テキスト + 中央モニュメント/4 柱 collider 復活 (PR #39, #40) | ✅ |
| 5-J UI/輪郭品質 | カーソル非表示 + 白ハロー/alpha smoothing + 看板貫通修正 + sprite 不可視 hotfix (PR #43-#48) | ✅ |
| 5-K title-logo | 「カ」内部チェッカー柄透明化 hotfix (PR #50) | ✅ |

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
| ~~カメラ視点切り替えで Player が浮く (Issue #31 真因)~~ | ✅ 解消 | PR #36 で sprite.position.y 式を capsule 足元基準に変更、本番接地確認済 |
| ~~HUD/タイトル「視点ロック」表現が紛らわしい~~ | ✅ 解消 | PR #37 で「クリックでマウス視点変更 ON / Esc で OFF」「矢印キーで移動」に変更 |
| **Issue #31 OPEN: 段差エッジで capsule が浮く Rapier KCC 挙動 (スコープ 3 のみ)** | P2 | 本人 postpone 宣言済 (Issue コメント)。修正候補 4 案 (snap 距離拡大 / capsule radius 縮小 / autostep 上限調整 / マップ collider 面取り) はコメント記録済 |
| 噴水・ベンチ歩行乗り上げ | 様子見 | PR #35 close (ユーザー判断「乗れても良い」)、sprite 浮き解消後の本番見え方で再評価 |
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
