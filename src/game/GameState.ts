export type GameStatus = "title" | "playing" | "result";

export interface GameStats {
  score: number;
  distance: number; // meters
  highScore: number;
}

export class GameState {
  status: GameStatus = "title";
  stats: GameStats = { score: 0, distance: 0, highScore: 0 };

  reset(): void {
    this.stats.score = 0;
    this.stats.distance = 0;
  }

  addScore(amount: number): void {
    this.stats.score += amount;
  }

  setDistance(meters: number): void {
    this.stats.distance = meters;
  }

  finalize(): boolean {
    const newRecord = this.stats.score > this.stats.highScore;
    if (newRecord) {
      this.stats.highScore = this.stats.score;
    }
    return newRecord;
  }
}
