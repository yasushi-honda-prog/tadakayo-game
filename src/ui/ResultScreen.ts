export interface ResultData {
  score: number;
  distance: number;
  highScore: number;
  bestCombo: number;
  newRecord: boolean;
  stageName: string;
}

export class ResultScreen {
  private readonly root: HTMLElement;
  private readonly scoreEl: HTMLElement;
  private readonly distanceEl: HTMLElement;
  private readonly highEl: HTMLElement;
  private readonly comboEl: HTMLElement;
  private readonly stageEl: HTMLElement;
  private readonly retryButton: HTMLButtonElement;

  constructor(onRetry: () => void) {
    this.root = this.required("result-screen");
    this.scoreEl = this.required("result-score");
    this.distanceEl = this.required("result-distance");
    this.highEl = this.required("result-highscore");
    this.comboEl = this.required("result-combo");
    this.stageEl = this.required("result-stage");
    const retry = document.getElementById("retry-button");
    if (!(retry instanceof HTMLButtonElement)) {
      throw new Error("retry-button が見つかりません");
    }
    this.retryButton = retry;
    this.retryButton.addEventListener("click", onRetry);
  }

  private required(id: string): HTMLElement {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Result 要素が見つかりません: ${id}`);
    return el;
  }

  show(data: ResultData): void {
    this.scoreEl.textContent = String(data.score);
    this.distanceEl.textContent = `${data.distance}m`;
    this.highEl.textContent = String(data.highScore);
    this.comboEl.textContent = String(data.bestCombo);
    this.stageEl.textContent = data.stageName || "現場";
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
