import type { InputBus } from "./InputBus";
import type { MobileControls } from "../ui/MobileControls";

/**
 * モバイル / タッチ入力 (Phase 5-E)。
 *
 * **入力経路**:
 * - 仮想スティック (左下 #virtual-stick) → `bus.state.move{X,Y}`
 *   - first pointerdown で記録、pointermove で knob を引きずる、pointerup で解放
 *   - スティック中心からの距離を `STICK_RADIUS` で正規化、`DEAD_ZONE` 未満は moveX/Y = 0
 * - 視点回転 (canvas 全域) → `bus.state.look{DX,DY}`
 *   - canvas 上で pointerdown された (= ボタン/スティックの上ではない) pointer を look 専用として捕捉
 *   - pointermove で `dx, dy` (前回位置からの差) を蓄積。Camera 側 MOUSE_SENSITIVITY_X/Y で yaw/pitch に変換される
 * - ジャンプ / アクション / ポーズボタン → `bus.emit("jump"/"action"/"pause")`
 *
 * **multi-touch 対応**:
 * - 各 pointer は `setPointerCapture` で発火元に固定 → stick 中に look を別指で動かしても取り違えない
 * - `stickPointerId` / `lookPointerId` を別管理して交差を防ぐ
 *
 * **責務外** (Game / MobileControls 側):
 * - 表示の visible/hidden 切替 (MobileControls.show/hide)
 * - タイトル/ポーズ画面で TouchInput を pause したい場合は MobileControls.hide() で全要素無効化
 *
 * **既存 KeyboardMouseInput との共存**: モバイルでも外付け KB 接続を考慮し、両方常時有効。
 * canvas のクリック (PointerLock 要求) は KeyboardMouseInput にだけ実装、TouchInput では不要。
 */
const STICK_RADIUS = 50; // px、CSS 上の virtual-stick 半径 (66px) - knob 半径 (28px) - 余白
const DEAD_ZONE = 8; // px

export class TouchInput {
  private readonly bus: InputBus;
  private readonly canvas: HTMLCanvasElement;
  private readonly controls: MobileControls;
  private disposed = false;

  private stickPointerId: number | null = null;
  private stickCenterX = 0;
  private stickCenterY = 0;

  private lookPointerId: number | null = null;
  private lookPrevX = 0;
  private lookPrevY = 0;

  constructor(canvas: HTMLCanvasElement, bus: InputBus, controls: MobileControls) {
    this.canvas = canvas;
    this.bus = bus;
    this.controls = controls;
    this.bind();
  }

  private bind(): void {
    const stick = this.controls.stick;
    stick.addEventListener("pointerdown", this.onStickDown);
    stick.addEventListener("pointermove", this.onStickMove);
    stick.addEventListener("pointerup", this.onStickEnd);
    stick.addEventListener("pointercancel", this.onStickEnd);

    this.canvas.addEventListener("pointerdown", this.onCanvasDown);
    this.canvas.addEventListener("pointermove", this.onCanvasMove);
    this.canvas.addEventListener("pointerup", this.onCanvasEnd);
    this.canvas.addEventListener("pointercancel", this.onCanvasEnd);

    this.controls.jumpBtn.addEventListener("click", this.onJump);
    this.controls.actionBtn.addEventListener("click", this.onAction);
    this.controls.pauseBtn.addEventListener("click", this.onPause);
  }

  // ===== Stick =====

  private onStickDown = (e: PointerEvent): void => {
    if (this.stickPointerId !== null) return;
    this.stickPointerId = e.pointerId;
    const rect = this.controls.stick.getBoundingClientRect();
    this.stickCenterX = rect.left + rect.width / 2;
    this.stickCenterY = rect.top + rect.height / 2;
    this.controls.stick.setPointerCapture(e.pointerId);
    this.updateStick(e.clientX, e.clientY);
    e.preventDefault();
    e.stopPropagation();
  };

  private onStickMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.stickPointerId) return;
    this.updateStick(e.clientX, e.clientY);
    e.preventDefault();
  };

  private onStickEnd = (e: PointerEvent): void => {
    if (e.pointerId !== this.stickPointerId) return;
    this.stickPointerId = null;
    this.controls.knob.style.transform = "";
    this.bus.state.moveX = 0;
    this.bus.state.moveY = 0;
  };

  private updateStick(clientX: number, clientY: number): void {
    let dx = clientX - this.stickCenterX;
    let dy = clientY - this.stickCenterY;
    const dist = Math.hypot(dx, dy);
    if (dist > STICK_RADIUS) {
      dx = (dx / dist) * STICK_RADIUS;
      dy = (dy / dist) * STICK_RADIUS;
    }
    this.controls.knob.style.transform = `translate(${dx}px, ${dy}px)`;

    if (dist < DEAD_ZONE) {
      this.bus.state.moveX = 0;
      this.bus.state.moveY = 0;
      return;
    }
    // 正規化 (-1〜1)。画面上方向 (dy < 0) を forward (moveY > 0) に対応させる
    this.bus.state.moveX = dx / STICK_RADIUS;
    this.bus.state.moveY = -dy / STICK_RADIUS;
  }

  // ===== Look (canvas 上の任意 pointer) =====

  private onCanvasDown = (e: PointerEvent): void => {
    // stick / button の上は target が違うため canvas に到達しない (event.target === canvas)
    if (this.lookPointerId !== null) return;
    this.lookPointerId = e.pointerId;
    this.lookPrevX = e.clientX;
    this.lookPrevY = e.clientY;
    this.canvas.setPointerCapture(e.pointerId);
  };

  private onCanvasMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.lookPointerId) return;
    const dx = e.clientX - this.lookPrevX;
    const dy = e.clientY - this.lookPrevY;
    this.lookPrevX = e.clientX;
    this.lookPrevY = e.clientY;
    // Camera は MOUSE_SENSITIVITY_X/Y で raw delta を yaw/pitch に変換するので、ここではそのまま流す
    this.bus.state.lookDX += dx;
    this.bus.state.lookDY += dy;
  };

  private onCanvasEnd = (e: PointerEvent): void => {
    if (e.pointerId !== this.lookPointerId) return;
    this.lookPointerId = null;
  };

  // ===== Buttons =====

  private onJump = (): void => {
    this.bus.emit("jump");
  };

  private onAction = (): void => {
    this.bus.emit("action");
  };

  private onPause = (): void => {
    this.bus.emit("pause");
  };

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const stick = this.controls.stick;
    stick.removeEventListener("pointerdown", this.onStickDown);
    stick.removeEventListener("pointermove", this.onStickMove);
    stick.removeEventListener("pointerup", this.onStickEnd);
    stick.removeEventListener("pointercancel", this.onStickEnd);

    this.canvas.removeEventListener("pointerdown", this.onCanvasDown);
    this.canvas.removeEventListener("pointermove", this.onCanvasMove);
    this.canvas.removeEventListener("pointerup", this.onCanvasEnd);
    this.canvas.removeEventListener("pointercancel", this.onCanvasEnd);

    this.controls.jumpBtn.removeEventListener("click", this.onJump);
    this.controls.actionBtn.removeEventListener("click", this.onAction);
    this.controls.pauseBtn.removeEventListener("click", this.onPause);

    this.bus.state.moveX = 0;
    this.bus.state.moveY = 0;
  }
}
