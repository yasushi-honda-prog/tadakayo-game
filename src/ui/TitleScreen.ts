import { DIFFICULTY, type Difficulty } from "../config/gameConfig";

export interface TitleScreenOptions {
  onStart: () => void;
  onDifficultyChange: (d: Difficulty) => void;
  onMuteToggle: (muted: boolean) => void;
  initialDifficulty: Difficulty;
  initialMuted: boolean;
  highScore: number;
}

export class TitleScreen {
  private readonly root: HTMLElement;
  private readonly startButton: HTMLButtonElement;
  private readonly difficultyButtons: HTMLButtonElement[];
  private readonly muteButton: HTMLButtonElement;
  private readonly highScoreEl: HTMLElement;
  private muted: boolean;

  constructor(opts: TitleScreenOptions) {
    const root = document.getElementById("title-screen");
    const start = document.getElementById("start-button");
    const mute = document.getElementById("mute-toggle");
    const high = document.getElementById("title-highscore");
    if (!root || !(start instanceof HTMLButtonElement) || !(mute instanceof HTMLButtonElement) || !high) {
      throw new Error("title-screen DOM が見つかりません");
    }
    this.root = root;
    this.startButton = start;
    this.muteButton = mute;
    this.highScoreEl = high;
    this.muted = opts.initialMuted;

    this.startButton.addEventListener("click", () => opts.onStart());
    this.muteButton.addEventListener("click", () => {
      this.muted = !this.muted;
      this.updateMuteUI();
      opts.onMuteToggle(this.muted);
    });
    this.updateMuteUI();
    this.highScoreEl.textContent = String(opts.highScore);

    // 難易度ボタン
    this.difficultyButtons = [];
    for (const d of Object.keys(DIFFICULTY) as Difficulty[]) {
      const btn = document.querySelector<HTMLButtonElement>(`#difficulty-buttons [data-difficulty="${d}"]`);
      if (!btn) continue;
      btn.textContent = DIFFICULTY[d].label;
      btn.classList.toggle("active", d === opts.initialDifficulty);
      btn.addEventListener("click", () => {
        for (const b of this.difficultyButtons) b.classList.remove("active");
        btn.classList.add("active");
        opts.onDifficultyChange(d);
      });
      this.difficultyButtons.push(btn);
    }
  }

  private updateMuteUI(): void {
    this.muteButton.textContent = this.muted ? "🔈 音 OFF" : "🔊 音 ON";
    this.muteButton.classList.toggle("muted", this.muted);
  }

  show(): void {
    this.root.classList.remove("hidden");
    this.root.classList.add("visible");
  }

  hide(): void {
    this.root.classList.add("hidden");
    this.root.classList.remove("visible");
  }

  setHighScore(score: number): void {
    this.highScoreEl.textContent = String(score);
  }
}
