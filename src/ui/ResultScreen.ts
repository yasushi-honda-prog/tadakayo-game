export interface ResultData {
  score: number;
  distance: number;
  highScore: number;
  newRecord: boolean;
}

export class ResultScreen {
  private readonly root: HTMLElement;
  private readonly scoreEl: HTMLElement;
  private readonly distanceEl: HTMLElement;
  private readonly highEl: HTMLElement;
  private readonly retryButton: HTMLButtonElement;

  constructor(onRetry: () => void) {
    const root = document.getElementById("result-screen");
    const score = document.getElementById("result-score");
    const distance = document.getElementById("result-distance");
    const high = document.getElementById("result-highscore");
    const retry = document.getElementById("retry-button");
    if (!root || !score || !distance || !high || !(retry instanceof HTMLButtonElement)) {
      throw new Error("Result 画面の要素が見つかりません");
    }
    this.root = root;
    this.scoreEl = score;
    this.distanceEl = distance;
    this.highEl = high;
    this.retryButton = retry;
    this.retryButton.addEventListener("click", onRetry);
  }

  show(data: ResultData): void {
    this.scoreEl.textContent = String(data.score);
    this.distanceEl.textContent = String(data.distance);
    this.highEl.textContent = String(data.highScore);
    const title = this.root.querySelector(".result-title");
    if (title) {
      title.textContent = data.newRecord ? "ありがとう！ハイスコア更新！" : "ありがとう！";
    }
    this.root.classList.remove("hidden");
    this.root.classList.add("visible");
  }

  hide(): void {
    this.root.classList.add("hidden");
    this.root.classList.remove("visible");
  }
}
