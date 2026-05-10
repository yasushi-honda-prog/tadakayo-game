import type * as THREE from "three";

/**
 * ミッションが受け取るゲーム状態スナップショット。
 * 毎フレーム MissionManager.update() で各 mission に渡される。
 */
export interface MissionContext {
  /** プレイヤーの現在位置（読み取り専用、変更しない） */
  readonly playerPosition: THREE.Vector3;
  /** 経過時間 (秒) — 経過時間判定ミッション (Phase 5-E 以降) で使う */
  readonly elapsed: number;
}

/**
 * Phase 5-C のミッション基底。
 *
 * - id: 一意。HUD / MissionPanel が参照
 * - title: 短い表題（HUD バー）
 * - description: 詳細パネル用の説明文
 * - progress: { current, target } 進捗（target=1 のミッションは「未達/達成」だけ表現）
 * - cleared: チェック済みフラグ
 * - update(ctx): 毎フレーム呼び出し。クリア条件を満たしたら cleared=true にする
 *
 * サブクラスは update() を実装するだけでよい。Manager 側で cleared 観測 + コールバック発火。
 */
export abstract class Mission {
  readonly id: string;
  readonly title: string;
  readonly description: string;

  cleared = false;
  current = 0;
  readonly target: number;

  constructor(args: {
    id: string;
    title: string;
    description: string;
    target: number;
  }) {
    this.id = args.id;
    this.title = args.title;
    this.description = args.description;
    this.target = args.target;
  }

  /** 進捗テキスト（HUD で「2/10」等を表示） */
  progressText(): string {
    if (this.target <= 1) return this.cleared ? "クリア！" : "未達成";
    return `${this.current}/${this.target}`;
  }

  /** 毎フレーム呼ばれる。サブクラスがクリア条件をチェック */
  abstract update(ctx: MissionContext): void;

  /** 必要に応じてサブクラスでリソース解放 */
  dispose(): void {}
}
