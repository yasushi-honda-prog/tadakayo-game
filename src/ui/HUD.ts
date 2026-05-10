export class HUD {
  private readonly root: HTMLElement;
  private readonly scoreEl: HTMLElement;
  private readonly distanceEl: HTMLElement;

  constructor() {
    const root = document.getElementById("hud");
    const score = document.getElementById("hud-score");
    const distance = document.getElementById("hud-distance");
    if (!root || !score || !distance) {
      throw new Error("HUD 要素が見つかりません");
    }
    this.root = root;
    this.scoreEl = score;
    this.distanceEl = distance;
  }

  show(): void {
    this.root.classList.remove("hidden");
  }

  hide(): void {
    this.root.classList.add("hidden");
  }

  update(score: number, distance: number): void {
    this.scoreEl.textContent = String(score);
    this.distanceEl.textContent = String(distance);
  }
}
