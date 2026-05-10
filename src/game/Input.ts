// キーボード + タッチ統合入力。lane-delta / jump / crouch を発火する。

export type InputEvent =
  | { type: "lane"; delta: -1 | 1 }
  | { type: "jump" }
  | { type: "crouch" };

type Listener = (event: InputEvent) => void;

export class Input {
  private listeners = new Set<Listener>();
  private touchStart: { x: number; y: number; t: number } | null = null;
  private readonly target: HTMLElement;

  private readonly SWIPE_DIST = 40;
  private readonly TAP_MAX_DIST = 24;

  constructor(target: HTMLElement) {
    this.target = target;
    this.bindKeyboard();
    this.bindTouch();
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: InputEvent): void {
    for (const l of this.listeners) l(event);
  }

  private bindKeyboard(): void {
    window.addEventListener("keydown", (e) => {
      switch (e.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          this.emit({ type: "lane", delta: -1 });
          e.preventDefault();
          break;
        case "ArrowRight":
        case "d":
        case "D":
          this.emit({ type: "lane", delta: 1 });
          e.preventDefault();
          break;
        case " ":
        case "ArrowUp":
        case "w":
        case "W":
          this.emit({ type: "jump" });
          e.preventDefault();
          break;
        case "ArrowDown":
        case "s":
        case "S":
        case "Shift":
          this.emit({ type: "crouch" });
          e.preventDefault();
          break;
      }
    });
  }

  private bindTouch(): void {
    const opts: AddEventListenerOptions = { passive: false };
    this.target.addEventListener(
      "touchstart",
      (e) => {
        const t = e.changedTouches[0];
        if (!t) return;
        this.touchStart = { x: t.clientX, y: t.clientY, t: performance.now() };
        e.preventDefault();
      },
      opts
    );
    this.target.addEventListener(
      "touchend",
      (e) => {
        const t = e.changedTouches[0];
        if (!t || !this.touchStart) return;
        const dx = t.clientX - this.touchStart.x;
        const dy = t.clientY - this.touchStart.y;
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        if (adx < this.TAP_MAX_DIST && ady < this.TAP_MAX_DIST) {
          // タップ: 画面の上 30% = ジャンプ / 下 30% = しゃがみ / 中央左右 = レーンチェンジ
          const w = window.innerWidth;
          const h = window.innerHeight;
          if (t.clientY < h * 0.3) {
            this.emit({ type: "jump" });
          } else if (t.clientY > h * 0.7) {
            this.emit({ type: "crouch" });
          } else if (t.clientX < w * 0.5) {
            this.emit({ type: "lane", delta: -1 });
          } else {
            this.emit({ type: "lane", delta: 1 });
          }
        } else if (ady > adx) {
          if (dy < -this.SWIPE_DIST) this.emit({ type: "jump" });
          else if (dy > this.SWIPE_DIST) this.emit({ type: "crouch" });
        } else if (adx > ady) {
          if (dx < -this.SWIPE_DIST) this.emit({ type: "lane", delta: -1 });
          else if (dx > this.SWIPE_DIST) this.emit({ type: "lane", delta: 1 });
        }
        this.touchStart = null;
        e.preventDefault();
      },
      opts
    );
  }
}
