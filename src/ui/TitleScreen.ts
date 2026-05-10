export interface TitleScreenOptions {
  onStart: () => void;
  onMuteToggle: (muted: boolean) => void;
  initialMuted: boolean;
}

export class TitleScreen {
  private readonly root: HTMLElement;
  private readonly startButton: HTMLButtonElement;
  private readonly muteButton: HTMLButtonElement;
  private muted: boolean;

  constructor(opts: TitleScreenOptions) {
    const root = document.getElementById("title-screen");
    const start = document.getElementById("start-button");
    const mute = document.getElementById("mute-toggle");
    if (!root || !(start instanceof HTMLButtonElement) || !(mute instanceof HTMLButtonElement)) {
      throw new Error("title-screen DOM が見つかりません");
    }
    this.root = root;
    this.startButton = start;
    this.muteButton = mute;
    this.muted = opts.initialMuted;

    this.startButton.addEventListener("click", () => opts.onStart());
    this.muteButton.addEventListener("click", () => {
      this.muted = !this.muted;
      this.updateMuteUI();
      opts.onMuteToggle(this.muted);
    });
    this.updateMuteUI();
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
}
