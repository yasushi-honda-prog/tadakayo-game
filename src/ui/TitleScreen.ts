export class TitleScreen {
  private readonly root: HTMLElement;
  private readonly startButton: HTMLButtonElement;

  constructor(onStart: () => void) {
    const root = document.getElementById("title-screen");
    const button = document.getElementById("start-button");
    if (!root || !(button instanceof HTMLButtonElement)) {
      throw new Error("title-screen / start-button が見つかりません");
    }
    this.root = root;
    this.startButton = button;
    this.startButton.addEventListener("click", onStart);
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
