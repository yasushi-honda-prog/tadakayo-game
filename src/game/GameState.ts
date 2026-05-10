import { SCORE } from "../config/gameConfig";

export type GameStatus = "title" | "playing" | "result";

export interface GameStats {
  score: number;
  distance: number;
  highScore: number;
  combo: number;
  bestCombo: number;
  pickupStreak: number; // シールド発動カウンター
}

export class GameState {
  status: GameStatus = "title";
  stats: GameStats = {
    score: 0,
    distance: 0,
    highScore: 0,
    combo: 0,
    bestCombo: 0,
    pickupStreak: 0,
  };
  comboTimer = 0; // 残り秒、0 でリセット

  reset(): void {
    this.stats.score = 0;
    this.stats.distance = 0;
    this.stats.combo = 0;
    this.stats.bestCombo = 0;
    this.stats.pickupStreak = 0;
    this.comboTimer = 0;
  }

  setDistance(meters: number): void {
    this.stats.distance = meters;
  }

  /**
   * コンボの段階に応じたマルチプライヤーを返す。
   * COMBO_TIERS の min を境に階段的に増える。
   */
  currentMultiplier(): number {
    let m = 1;
    for (const tier of SCORE.COMBO_TIERS) {
      if (this.stats.combo >= tier.min) m = tier.multiplier;
    }
    return m;
  }

  /** 収集アイテム取得時に呼ぶ。コンボ加算 + マルチプライヤー込みのスコア追加 */
  addPickup(): void {
    this.stats.combo += 1;
    if (this.stats.combo > this.stats.bestCombo) this.stats.bestCombo = this.stats.combo;
    this.comboTimer = SCORE.COMBO_WINDOW_SEC;
    this.stats.pickupStreak += 1;
    this.stats.score += SCORE.PICKUP * this.currentMultiplier();
  }

  /** 距離ベースのスコア加算（マルチプライヤー無し） */
  addDistanceScore(deltaMeters: number): void {
    this.stats.score += SCORE.PER_METER * deltaMeters;
  }

  /** 障害物衝突 / コンボ時間切れでコンボ消失 */
  resetCombo(): void {
    this.stats.combo = 0;
    this.comboTimer = 0;
    this.stats.pickupStreak = 0;
  }

  /** シールド発動条件を満たしたか */
  shouldActivateShield(): boolean {
    return this.stats.pickupStreak >= SCORE.SHIELD_PICKUPS_REQUIRED;
  }

  consumeShieldStreak(): void {
    this.stats.pickupStreak = 0;
  }

  /** 毎フレーム呼んでコンボタイマー減らす */
  tickCombo(dt: number): void {
    if (this.stats.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.stats.combo = 0;
        this.stats.pickupStreak = 0;
      }
    }
  }

  finalize(): boolean {
    const finalScore = Math.floor(this.stats.score);
    this.stats.score = finalScore;
    const newRecord = finalScore > this.stats.highScore;
    if (newRecord) {
      this.stats.highScore = finalScore;
    }
    return newRecord;
  }
}
