import { Obstacle, OBSTACLE_KINDS } from "./Obstacle";
import { Collectible, COLLECTIBLE_KINDS } from "./Collectible";
import { LANE, SPAWN } from "../config/gameConfig";

export interface SpawnResult {
  obstacles: Obstacle[];
  collectibles: Collectible[];
}

/**
 * 一定間隔でスポーン候補を抽選する。
 * - 連続して同じレーンに障害物を置かない
 * - 同時に最大 2 オブジェクトまで
 */
export class Spawner {
  private cooldown = 0;
  private lastObstacleLane: number | null = null;

  reset(): void {
    this.cooldown = 0;
    this.lastObstacleLane = null;
  }

  /** 経過時間に応じてスポーン間隔を短くする */
  private currentInterval(elapsedSec: number): number {
    const decay = (elapsedSec / 10) * SPAWN.INTERVAL_DECAY_PER_10_SEC;
    return Math.max(SPAWN.MIN_INTERVAL, SPAWN.INITIAL_INTERVAL - decay);
  }

  update(dt: number, elapsedSec: number): SpawnResult | null {
    this.cooldown -= dt;
    if (this.cooldown > 0) return null;

    this.cooldown = this.currentInterval(elapsedSec);

    const obstacles: Obstacle[] = [];
    const collectibles: Collectible[] = [];

    // 障害物 or 収集アイテム
    if (Math.random() < SPAWN.OBSTACLE_RATIO) {
      const lanes = [0, 1, 2].filter((i) => i !== this.lastObstacleLane);
      const lane = lanes[Math.floor(Math.random() * lanes.length)];
      const kind = OBSTACLE_KINDS[Math.floor(Math.random() * OBSTACLE_KINDS.length)];
      obstacles.push(new Obstacle(kind, lane));
      this.lastObstacleLane = lane;

      // 別レーンに収集アイテムを置く（取捨選択を促す）
      if (Math.random() < 0.5) {
        const otherLanes = [0, 1, 2].filter((i) => i !== lane);
        const cLane = otherLanes[Math.floor(Math.random() * otherLanes.length)];
        const cKind = COLLECTIBLE_KINDS[Math.floor(Math.random() * COLLECTIBLE_KINDS.length)];
        collectibles.push(new Collectible(cKind, cLane));
      }
    } else {
      // 収集アイテム単体
      const lane = Math.floor(Math.random() * LANE.POSITIONS.length);
      const kind = COLLECTIBLE_KINDS[Math.floor(Math.random() * COLLECTIBLE_KINDS.length)];
      collectibles.push(new Collectible(kind, lane));
      this.lastObstacleLane = null;
    }

    return { obstacles, collectibles };
  }
}
