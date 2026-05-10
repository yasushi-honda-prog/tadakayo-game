import * as THREE from "three";
import { Mission, type MissionContext } from "../Mission";

/**
 * 到達ミッション: 指定座標から `radius` 以内に入ったらクリア。
 *
 * - XZ 平面距離だけで判定（高さ違いの誤検出を避けるため Y 差は radius*1.5 まで許容）
 * - 一度クリアしたら戻ってきても解除しない
 */
export class ReachMission extends Mission {
  private readonly target3: THREE.Vector3;
  private readonly radius: number;

  constructor(args: {
    id: string;
    title: string;
    description: string;
    target: THREE.Vector3;
    radius: number;
  }) {
    super({
      id: args.id,
      title: args.title,
      description: args.description,
      target: 1,
    });
    this.target3 = args.target.clone();
    this.radius = args.radius;
  }

  update(ctx: MissionContext): void {
    if (this.cleared) return;
    const p = ctx.playerPosition;
    const dx = p.x - this.target3.x;
    const dz = p.z - this.target3.z;
    const dy = Math.abs(p.y - this.target3.y);
    const distXZ = Math.hypot(dx, dz);
    if (distXZ <= this.radius && dy <= this.radius * 1.5) {
      this.current = 1;
      this.cleared = true;
    }
  }
}
