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

    // ボタンは `pointerdown` で即時発火させる。理由:
    // - `click` だと iOS Safari で「スティック (pointercapture 中) と別指 tap」の同時
    //   タッチ時に click 発火が干渉して取りこぼされる (= 移動中ジャンプ不可)。
    // - `pointerdown` は touch 発生瞬間に発火するためマルチタッチでも確実。
    // - PointerEvent のデフォルト挙動を抑止して、scroll-pan や hover delay を排除する。
    this.controls.jumpBtn.addEventListener("pointerdown", this.onJump);
    this.controls.actionBtn.addEventListener("pointerdown", this.onAction);
    this.controls.pauseBtn.addEventListener("pointerdown", this.onPause);
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

  private onJump = (e: PointerEvent): void => {
    // pointerdown のデフォルト挙動 (focus 移動、scroll 開始判定など) を抑止
    e.preventDefault();
    e.stopPropagation();
    this.bus.emit("jump");
  };

  private onAction = (e: PointerEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    this.bus.emit("action");
  };

  private onPause = (e: PointerEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    this.bus.emit("pause");
  };

  /**
   * 入力状態を即座に中立化する (Phase 5-E review fix)。
   * pause / resetToTitle で呼ぶと、スティック押下中・スワイプ中の宙ぶらりんな pointerId が
   * 残って次フレームで意図しない move/look が反映される問題を防ぐ。
   *
   * - 仮想スティック / 視点 swipe の pointerId を null に戻す
   * - knob 表示位置をリセット
   * - bus.state の move{X,Y} / look{DX,DY} を 0 に
   */
  reset(): void {
    this.stickPointerId = null;
    this.lookPointerId = null;
    this.controls.knob.style.transform = "";
    this.bus.state.moveX = 0;
    this.bus.state.moveY = 0;
    this.bus.state.lookDX = 0;
    this.bus.state.lookDY = 0;
  }

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

    this.controls.jumpBtn.removeEventListener("pointerdown", this.onJump);
    this.controls.actionBtn.removeEventListener("pointerdown", this.onAction);
    this.controls.pauseBtn.removeEventListener("pointerdown", this.onPause);

    this.bus.state.moveX = 0;
    this.bus.state.moveY = 0;
  }
}
