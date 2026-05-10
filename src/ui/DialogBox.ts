/**
 * NPC 会話 UI (Phase 5-D)。
 *
 * - open(speaker, lines, onComplete) で開く
 * - advance() で次の line へ進める。最後の line で advance() すると close + onComplete 発火
 * - HTML 上では textContent しか書き換えない (XSS 防止)
 *
 * Game 側が E キー (action イベント) を受け取ったとき、`isVisible()` で開閉を判定し、
 *   - 開いていれば advance()
 *   - 閉じていれば最寄りの interactable NPC を探して open()
 * の 2 経路にディスパッチする。
 */
export class DialogBox {
  private readonly root: HTMLElement;
  private readonly speakerEl: HTMLElement;
  private readonly bodyEl: HTMLElement;
  private readonly hintEl: HTMLElement;

  private lines: readonly string[] = [];
  private index = 0;
  private opened = false;
  private onComplete: (() => void) | null = null;

  constructor() {
    const root = document.getElementById("dialog-box");
    const speaker = document.getElementById("dialog-speaker");
    const body = document.getElementById("dialog-body");
    const hint = document.getElementById("dialog-hint");
    if (!root || !speaker || !body || !hint) {
      throw new Error("DialogBox 要素が見つかりません");
    }
    this.root = root;
    this.speakerEl = speaker;
    this.bodyEl = body;
    this.hintEl = hint;
  }

  open(speaker: string, lines: readonly string[], onComplete: () => void): void {
    if (lines.length === 0) {
      onComplete();
      return;
    }
    this.lines = lines;
    this.index = 0;
    this.onComplete = onComplete;
    this.opened = true;
    this.speakerEl.textContent = speaker;
    this.renderCurrent();
    this.root.classList.remove("hidden");
  }

  /** E キー押下時。次の line に進めるか、最後なら close + onComplete 発火 */
  advance(): void {
    if (!this.opened) return;
    this.index++;
    if (this.index >= this.lines.length) {
      this.close();
      const cb = this.onComplete;
      this.onComplete = null;
      if (cb) cb();
      return;
    }
    this.renderCurrent();
  }

  isVisible(): boolean {
    return this.opened;
  }

  /**
   * 強制的に閉じる (ポーズ等で使う想定、Phase 5-D 時点では未使用)。
   *
   * **責務注意**: forceClose は onComplete を発火しないため、呼び出し側 (Game) は
   * 「会話中の NPC を idle に戻す」「TalkMission に進捗加算しない」等の状態復帰を
   * 別経路で行う必要がある。Phase 5-E でポーズ画面を実装する際は、Game 側で
   * `npc.endTalk()` を併用すること。
   */
  forceClose(): void {
    if (!this.opened) return;
    this.close();
    this.onComplete = null;
  }

  private renderCurrent(): void {
    this.bodyEl.textContent = this.lines[this.index];
    const last = this.index >= this.lines.length - 1;
    this.hintEl.textContent = last ? "▼ 閉じる (E)" : "▼ 続ける (E)";
  }

  private close(): void {
    this.opened = false;
    this.root.classList.add("hidden");
    this.lines = [];
    this.index = 0;
  }
}
