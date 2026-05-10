import { Obstacle, pickObstacleKind } from "./Obstacle";
import { Collectible, COLLECTIBLE_KINDS } from "./Collectible";
import { LANE, SPAWN } from "../config/gameConfig";

export interface SpawnResult {
  obstacles: Obstacle[];
  collectibles: Collectible[];
}

/**
 * 障害物 / 収集アイテムのスポーンを抽選する。
 * - jump 障害物の手前にハート列を置きやすくしてジャンプ報酬を演出
 * - crouch 障害物のレーン以外は通れるよう調整
 * - 難易度パラメータでスポーン間隔・障害物比率を変える
 */
export class Spawner {
  private cooldown = 0;
  private lastObstacleLane: number | null = null;
  private intervalScale = 1.0;
  private obstacleRatio: number = SPAWN.OBSTACLE_RATIO;

  reset(): void {
    this.cooldown = 0;
    this.lastObstacleLane = null;
  }

  setDifficulty(intervalScale: number, obstacleRatio: number): void {
    this.intervalScale = intervalScale;
    this.obstacleRatio = obstacleRatio;
  }

  private currentInterval(elapsedSec: number): number {
    const decay = (elapsedSec / 10) * SPAWN.INTERVAL_DECAY_PER_10_SEC;
    return Math.max(SPAWN.MIN_INTERVAL, SPAWN.INITIAL_INTERVAL - decay) * this.intervalScale;
  }

  update(dt: number, elapsedSec: number): SpawnResult | null {
    this.cooldown -= dt;
    if (this.cooldown > 0) return null;

    this.cooldown = this.currentInterval(elapsedSec);

    const obstacles: Obstacle[] = [];
    const collectibles: Collectible[] = [];

    if (Math.random() < this.obstacleRatio) {
      const kind = pickObstacleKind();
      const lanes = [0, 1, 2].filter((i) => i !== this.lastObstacleLane);
      const lane = lanes[Math.floor(Math.random() * lanes.length)];
      obstacles.push(new Obstacle(kind, lane));
      this.lastObstacleLane = lane;

      // crouch 系は同レーンに収集アイテムを置いてしゃがみ報酬を演出
      if (kind === "crouch" && Math.random() < 0.7) {
        const cKind = COLLECTIBLE_KINDS[Math.floor(Math.random() * COLLECTIBLE_KINDS.length)];
        const c = new Collectible(cKind, lane);
        c.object.position.y = 0; // 地面寄り（しゃがんで通る）
        collectibles.push(c);
      } else if (Math.random() < 0.5) {
        // それ以外は別レーンに収集アイテムを置いて取捨選択を促す
        const otherLanes = [0, 1, 2].filter((i) => i !== lane);
        const cLane = otherLanes[Math.floor(Math.random() * otherLanes.length)];
        const cKind = COLLECTIBLE_KINDS[Math.floor(Math.random() * COLLECTIBLE_KINDS.length)];
        collectibles.push(new Collectible(cKind, cLane));
      }
    } else {
      // 収集アイテム単体: ハートを連続配置してコンボを誘発
      const lane = Math.floor(Math.random() * LANE.POSITIONS.length);
      const kind = COLLECTIBLE_KINDS[Math.floor(Math.random() * COLLECTIBLE_KINDS.length)];
      collectibles.push(new Collectible(kind, lane));
      this.lastObstacleLane = null;
    }

    return { obstacles, collectibles };
  }
}
