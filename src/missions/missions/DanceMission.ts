import { Mission, type MissionContext } from "../Mission";

/**
 * 場所限定アクションミッション (Phase 5-E):
 * 指定の中心座標 + 半径以内でアクションを `requiredCount` 回押したらクリア。
 *
 * **イベント駆動パターン** (TalkMission と同様):
 * - 毎フレーム判定なし (`update` は no-op)
 * - 外部 (Game.handleActionPress) から `notifyAction(playerPosition)` を呼ぶ
 * - 中心から `radius` を超えていたら無視 (= 場所外でアクションしてもカウントしない)
 * - 連打防止のクールダウンは持たない (踊るアクションなので連打の意味がある)
 *
 * 用途: 「タダレク広場で踊ろう」(中央 14,0,0 半径 4m で アクション 3 回)
 */
export class DanceMission extends Mission {
  private readonly centerX: number;
  private readonly centerY: number;
  private readonly centerZ: number;
  private readonly radius: number;

  constructor(args: {
    id: string;
    title: string;
    description: string;
    center: Readonly<{ x: number; y: number; z: number }>;
    radius: number;
    requiredCount: number;
  }) {
    super({
      id: args.id,
      title: args.title,
      description: args.description,
      target: args.requiredCount,
    });
    this.centerX = args.center.x;
    this.centerY = args.center.y;
    this.centerZ = args.center.z;
    this.radius = args.radius;
  }

  /**
   * Game 側が action イベントを受け取って「会話中でも NPC interact でもない」と判定したときに呼ぶ。
   * 戻り値: カウントが進んだ場合 true (HUD refresh トリガに使える)。
   */
  notifyAction(playerPosition: Readonly<{ x: number; y: number; z: number }>): boolean {
    if (this.cleared) return false;
    const dx = playerPosition.x - this.centerX;
    const dz = playerPosition.z - this.centerZ;
    const dy = Math.abs(playerPosition.y - this.centerY);
    const distXZ = Math.hypot(dx, dz);
    if (distXZ > this.radius) return false;
    if (dy > this.radius * 1.5) return false; // 高さ違いの誤検出を避ける (ReachMission と同じ閾値)

    this.current = Math.min(this.current + 1, this.target);
    if (this.current >= this.target) this.cleared = true;
    return true;
  }

  /** 場所内にいるかの判定 (HUD ヒント表示用) */
  isInArea(playerPosition: Readonly<{ x: number; y: number; z: number }>): boolean {
    const dx = playerPosition.x - this.centerX;
    const dz = playerPosition.z - this.centerZ;
    const dy = Math.abs(playerPosition.y - this.centerY);
    return Math.hypot(dx, dz) <= this.radius && dy <= this.radius * 1.5;
  }

  update(_ctx: MissionContext): void {
    // イベント駆動なので毎フレーム判定不要
  }
}
