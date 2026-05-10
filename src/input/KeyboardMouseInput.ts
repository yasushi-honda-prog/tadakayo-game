import type { InputBus } from "./InputBus";

/**
 * PC 入力: WASD/矢印で移動、マウスで視点回転（Pointer Lock）、Space ジャンプ、E アクション。
 */
export class KeyboardMouseInput {
  private readonly bus: InputBus;
  private readonly canvas: HTMLCanvasElement;
  private readonly keys = new Set<string>();
  private pointerLocked = false;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, bus: InputBus) {
    this.canvas = canvas;
    this.bus = bus;
    this.bind();
  }

  private bind(): void {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.canvas.addEventListener("click", this.requestLock);
    document.addEventListener("pointerlockchange", this.onLockChange);
    document.addEventListener("mousemove", this.onMouseMove);
  }

  private requestLock = (): void => {
    if (!this.pointerLocked && this.canvas.requestPointerLock) {
      this.canvas.requestPointerLock();
    }
  };

  private onLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.pointerLocked) return;
    this.bus.state.lookDX += e.movementX;
    this.bus.state.lookDY += e.movementY;
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    const key = e.key.toLowerCase();
    this.keys.add(key);
    this.recomputeMove();
    if (key === " " || key === "spacebar") {
      this.bus.emit("jump");
      e.preventDefault();
    } else if (key === "e") {
      this.bus.emit("action");
    } else if (key === "escape" || key === "p") {
      this.bus.emit("pause");
    }
    if (key === "shift") this.bus.state.running = true;
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    this.keys.delete(key);
    if (key === "shift") this.bus.state.running = false;
    this.recomputeMove();
  };

  private recomputeMove(): void {
    let x = 0;
    let y = 0;
    if (this.keys.has("w") || this.keys.has("arrowup")) y += 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) y -= 1;
    if (this.keys.has("a") || this.keys.has("arrowleft")) x -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) x += 1;
    // 正規化（斜めで速度過剰を抑える）
    const len = Math.hypot(x, y);
    if (len > 0) {
      x /= len;
      y /= len;
    }
    this.bus.state.moveX = x;
    this.bus.state.moveY = y;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("click", this.requestLock);
    document.removeEventListener("pointerlockchange", this.onLockChange);
    document.removeEventListener("mousemove", this.onMouseMove);
    if (document.pointerLockElement === this.canvas && document.exitPointerLock) {
      document.exitPointerLock();
    }
  }
}
