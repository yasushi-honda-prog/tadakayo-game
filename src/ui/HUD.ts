export interface HUDState {
  score: number;
  distance: number;
  combo: number;
  multiplier: number;
  shielded: boolean;
  streak: number;
  streakRequired: number;
  stageName: string;
}

export class HUD {
  private readonly root: HTMLElement;
  private readonly scoreEl: HTMLElement;
  private readonly distanceEl: HTMLElement;
  private readonly comboEl: HTMLElement;
  private readonly comboValue: HTMLElement;
  private readonly multiplierEl: HTMLElement;
  private readonly shieldEl: HTMLElement;
  private readonly streakEl: HTMLElement;
  private readonly stageEl: HTMLElement;
  private readonly stageFlashEl: HTMLElement;
  private readonly comboBurstEl: HTMLElement;
  private readonly tutorialTipEl: HTMLElement;

  constructor() {
    this.root = this.required("hud");
    this.scoreEl = this.required("hud-score");
    this.distanceEl = this.required("hud-distance");
    this.comboEl = this.required("hud-combo");
    this.comboValue = this.required("hud-combo-value");
    this.multiplierEl = this.required("hud-multiplier");
    this.shieldEl = this.required("hud-shield");
    this.streakEl = this.required("hud-streak");
    this.stageEl = this.required("hud-stage");
    this.stageFlashEl = this.required("stage-flash");
    this.comboBurstEl = this.required("combo-burst");
    this.tutorialTipEl = this.required("tutorial-tip");
  }

  private required(id: string): HTMLElement {
    const el = document.getElementById(id);
    if (!el) throw new Error(`HUD 要素が見つかりません: ${id}`);
    return el;
  }

  show(): void {
    this.root.classList.remove("hidden");
  }

  hide(): void {
    this.root.classList.add("hidden");
  }

  update(s: HUDState): void {
    this.scoreEl.textContent = String(s.score);
    this.distanceEl.textContent = String(s.distance);
    this.stageEl.textContent = s.stageName;

    if (s.combo >= 2) {
      this.comboEl.classList.add("active");
      this.comboValue.textContent = `${s.combo}`;
      this.multiplierEl.textContent = `×${s.multiplier}`;
    } else {
      this.comboEl.classList.remove("active");
    }

    // シールドゲージ: streak が満タンか、シールド発動中
    if (s.shielded) {
      this.shieldEl.classList.add("active");
      this.streakEl.style.width = `100%`;
      this.streakEl.textContent = "SHIELD!";
    } else {
      this.shieldEl.classList.remove("active");
      const ratio = Math.min(1, s.streak / s.streakRequired);
      this.streakEl.style.width = `${ratio * 100}%`;
      this.streakEl.textContent = `${s.streak}/${s.streakRequired}`;
    }
  }

  /** ステージ移行時の大きなテキスト演出 */
  flashStage(text: string): void {
    this.stageFlashEl.textContent = text;
    this.stageFlashEl.classList.remove("show");
    void this.stageFlashEl.offsetWidth;
    this.stageFlashEl.classList.add("show");
  }

  /** コンボ達成（5/10/15...）時のキラキラ演出 */
  burstCombo(text: string): void {
    this.comboBurstEl.textContent = text;
    this.comboBurstEl.classList.remove("show");
    void this.comboBurstEl.offsetWidth;
    this.comboBurstEl.classList.add("show");
  }

  /** チュートリアル吹き出しを 4 秒間表示 */
  showTutorialTip(text: string): void {
    this.tutorialTipEl.textContent = text;
    this.tutorialTipEl.classList.remove("show");
    void this.tutorialTipEl.offsetWidth;
    this.tutorialTipEl.classList.add("show");
  }

  hideTutorialTip(): void {
    this.tutorialTipEl.classList.remove("show");
  }
}
