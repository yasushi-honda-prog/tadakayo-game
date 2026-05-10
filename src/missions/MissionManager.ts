import type * as THREE from "three";
import type { Mission, MissionContext } from "./Mission";

/**
 * MissionManager: アクティブなミッションの集合を管理。
 *
 * - `start(mission)` で active リストに追加
 * - 毎フレーム `update(playerPosition, dt)` で全 active mission を更新
 * - cleared 観測でコールバック (onCleared) を発火、active → completed に移動
 * - HUD / MissionPanel への通知は onChange コールバックで行う（Manager は UI を直接知らない）
 */
export class MissionManager {
  private readonly active: Mission[] = [];
  private readonly completed: Mission[] = [];
  private elapsed = 0;
  private listeners: Array<() => void> = [];
  private clearListeners: Array<(m: Mission) => void> = [];

  /** active + completed で「現在表示する一番手前のミッション」 */
  get foreground(): Mission | null {
    return this.active[0] ?? null;
  }

  get all(): readonly Mission[] {
    return [...this.active, ...this.completed];
  }

  start(mission: Mission): void {
    this.active.push(mission);
    this.notify();
  }

  /** UI 側が「変化があったら再描画」するためのコールバック */
  onChange(fn: () => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((f) => f !== fn);
    };
  }

  /** ミッションクリア瞬間に発火（SE 鳴動・演出） */
  onCleared(fn: (m: Mission) => void): () => void {
    this.clearListeners.push(fn);
    return () => {
      this.clearListeners = this.clearListeners.filter((f) => f !== fn);
    };
  }

  update(playerPosition: THREE.Vector3, dt: number): void {
    this.elapsed += dt;
    // Vector3 そのまま渡すと mission 側で .set() などで mutation できるため
    // 不変な値オブジェクトに詰め直す (Mission.ts の MissionContext コメント参照)
    const ctx: MissionContext = {
      playerPosition: { x: playerPosition.x, y: playerPosition.y, z: playerPosition.z },
      elapsed: this.elapsed,
    };

    let mutated = false;
    for (const m of this.active) {
      const wasCleared = m.cleared;
      const beforeCurrent = m.current;
      m.update(ctx);
      if (m.cleared !== wasCleared || m.current !== beforeCurrent) mutated = true;
    }

    // クリア済みは完了リストへ
    for (let i = this.active.length - 1; i >= 0; i--) {
      const m = this.active[i];
      if (m.cleared) {
        this.active.splice(i, 1);
        this.completed.push(m);
        for (const l of this.clearListeners) l(m);
        mutated = true;
      }
    }

    if (mutated) this.notify();
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  dispose(): void {
    for (const m of this.active) m.dispose();
    for (const m of this.completed) m.dispose();
    this.active.length = 0;
    this.completed.length = 0;
    this.listeners = [];
    this.clearListeners = [];
  }
}
