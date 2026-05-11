import type { InputBus } from "./InputBus";

/**
 * PC 入力: WASD/矢印で移動、マウスで視点回転、Space ジャンプ、E アクション。
 *
 * **視点回転の 2 系統** (Phase 5-E バグ修正):
 * 1. **Pointer Lock 取得時**: マウス全体の動き (movementX/Y) を継続的に消費。FPS ライク。
 *    - canvas mousedown で `requestPointerLock()` を試行 (ブラウザ確認ダイアログが出る)
 * 2. **Pointer Lock 未取得時**: マウス押下中のみドラッグで視点回転 (押下解除で停止)
 *    - ユーザーが Pointer Lock 許可しなかった場合 / Mac システム設定で許可制限がある場合のフォールバック
 *
 * 旧実装は Pointer Lock 必須で、許可されない or ブラウザ条件不一致で「視点が全く動かない」状態だった。
 */
export class KeyboardMouseInput {
  private readonly bus: InputBus;
  private readonly canvas: HTMLCanvasElement;
  private readonly keys = new Set<string>();
  private pointerLocked = false;
  private disposed = false;

  // Drag fallback (Pointer Lock 未取得時の視点回転)
  private dragging = false;
  private dragPrevX = 0;
  private dragPrevY = 0;

  constructor(canvas: HTMLCanvasElement, bus: InputBus) {
    this.canvas = canvas;
    this.bus = bus;
    this.bind();
  }

  private bind(): void {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.canvas.addEventListener("mousedown", this.onCanvasMouseDown);
    document.addEventListener("pointerlockchange", this.onLockChange);
    document.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mouseup", this.onMouseUp);
    // window 外でドラッグを離した場合、mouseup が発火せず dragging が残る → blur で確実にリセット
    window.addEventListener("blur", this.onWindowBlur);
  }

  /** canvas mousedown: 左クリックでドラッグ開始 + Pointer Lock 試行 */
  private onCanvasMouseDown = (e: MouseEvent): void => {
    if (e.button !== 0) return;
    this.dragging = true;
    this.dragPrevX = e.clientX;
    this.dragPrevY = e.clientY;
    // Pointer Lock 取得を試行 (許可されれば次フレームから movementX/Y で継続視点回転)
    if (!this.pointerLocked && this.canvas.requestPointerLock) {
      try {
        this.canvas.requestPointerLock();
      } catch {
        // 取得失敗時はドラッグ fallback で視点回転継続
      }
    }
  };

  private onMouseUp = (): void => {
    this.dragging = false;
  };

  private onWindowBlur = (): void => {
    // window フォーカス喪失時にドラッグ状態 + 押下キー + running を全部クリア
    // (フォーカス戻ったら mousedown / keydown が再来するので問題ない)
    this.dragging = false;
    this.keys.clear();
    this.bus.state.moveX = 0;
    this.bus.state.moveY = 0;
    this.bus.state.running = false;
  };

  private onLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
    // Pointer Lock 解除時にドラッグ状態もリセット (Esc 押下で lock 解除されると mouseup が来ないため)
    if (!this.pointerLocked) this.dragging = false;
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.pointerLocked) {
      // Pointer Lock 中: マウスの絶対移動量を消費 (FPS 操作)
      this.bus.state.lookDX += e.movementX;
      this.bus.state.lookDY += e.movementY;
    } else if (this.dragging) {
      // ドラッグ中: 前回位置からの差分を消費 (押している間のみ視点回転)
      this.bus.state.lookDX += e.clientX - this.dragPrevX;
      this.bus.state.lookDY += e.clientY - this.dragPrevY;
      this.dragPrevX = e.clientX;
      this.dragPrevY = e.clientY;
    }
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
    } else if (key === "m") {
      this.bus.emit("panel");
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
    this.canvas.removeEventListener("mousedown", this.onCanvasMouseDown);
    document.removeEventListener("pointerlockchange", this.onLockChange);
    document.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("blur", this.onWindowBlur);
    if (document.pointerLockElement === this.canvas && document.exitPointerLock) {
      document.exitPointerLock();
    }
  }
}
