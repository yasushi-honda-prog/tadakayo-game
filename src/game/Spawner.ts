import { Obstacle, pickObstacleKind } from "./Obstacle";
import { Collectible, COLLECTIBLE_KINDS } from "./Collectible";
import { LANE, SPAWN } from "../config/gameConfig";

export interface SpawnResult {
  obstacles: Obstacle[];
  collectibles: Collectible[];
}

const randInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * 障害物 / 収集アイテムのスポーンを抽選する。
 * - 一定確率で「空中ハート列」パターン（ジャンプの動機付け）
 * - jump / jumpLow 障害物の手前に空中ハート列を配置（飛び越え報酬）
 * - crouch 障害物には地面寄りの収集アイテムをセット
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

    // 1. 空中ハート列パターン（障害物なし、ジャンプ報酬）
    if (Math.random() < SPAWN.AERIAL_PATTERN_CHANCE) {
      this.spawnAerialHeartLine(collectibles);
      this.lastObstacleLane = null;
      // 空中パターンは間隔を少し短めに（テンポ感）
      this.cooldown *= 0.7;
      return { obstacles, collectibles };
    }

    // 2. 障害物 + 連動アイテム
    if (Math.random() < this.obstacleRatio) {
      const kind = pickObstacleKind();
      const lanes = [0, 1, 2].filter((i) => i !== this.lastObstacleLane);
      const lane = lanes[Math.floor(Math.random() * lanes.length)];
      obstacles.push(new Obstacle(kind, lane));
      this.lastObstacleLane = kind === "jumpLow" ? null : lane;

      if (kind === "crouch") {
        // しゃがみ報酬: 同レーン地面寄りに収集物
        if (Math.random() < 0.7) {
          const cKind = COLLECTIBLE_KINDS[Math.floor(Math.random() * COLLECTIBLE_KINDS.length)];
          collectibles.push(new Collectible(cKind, lane, "ground"));
        }
      } else if (kind === "jump" || kind === "jumpLow") {
        // ジャンプ報酬: 障害物手前に空中ハートを 2〜3 個配置（飛んで取る）
        const heartLane = kind === "jumpLow" ? randInt(0, LANE.POSITIONS.length - 1) : lane;
        const count = randInt(2, 3);
        for (let i = 1; i <= count; i++) {
          collectibles.push(new Collectible("heart", heartLane, "high", -i * 1.4));
        }
      } else if (Math.random() < 0.5) {
        // lane 障害物: 別レーンに収集物（取捨選択を促す）
        const otherLanes = [0, 1, 2].filter((i) => i !== lane);
        const cLane = otherLanes[Math.floor(Math.random() * otherLanes.length)];
        const cKind = COLLECTIBLE_KINDS[Math.floor(Math.random() * COLLECTIBLE_KINDS.length)];
        collectibles.push(new Collectible(cKind, cLane));
      }
    } else {
      // 3. 単独の収集アイテム
      const lane = Math.floor(Math.random() * LANE.POSITIONS.length);
      const kind = COLLECTIBLE_KINDS[Math.floor(Math.random() * COLLECTIBLE_KINDS.length)];
      collectibles.push(new Collectible(kind, lane));
      this.lastObstacleLane = null;
    }

    return { obstacles, collectibles };
  }

  /** 空中ハート列を生成。同一レーンに 3〜6 個並べてジャンプ連取できるようにする */
  private spawnAerialHeartLine(out: Collectible[]): void {
    const lane = Math.floor(Math.random() * LANE.POSITIONS.length);
    const count = randInt(SPAWN.AERIAL_HEART_COUNT.min, SPAWN.AERIAL_HEART_COUNT.max);
    for (let i = 0; i < count; i++) {
      out.push(new Collectible("heart", lane, "high", i * 1.4));
    }
  }
}
