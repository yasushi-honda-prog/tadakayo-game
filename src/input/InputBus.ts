/**
 * 入力ソース（KeyboardMouse / TouchInput）から Player 側へ流す統一バス。
 *
 * - move: 2D ベクトル（向き正規化前）。WASD or 仮想スティック
 * - look: 2D デルタ（pitch/yaw 用）。マウス移動 or スワイプ
 * - jump: 押下イベント
 * - action: E キー or アクションボタン押下
 * - run: Shift（加速）
 */
export interface InputState {
  /** -1〜1。x: 左右、y: 前後（前進が +） */
  moveX: number;
  moveY: number;
  /** 視点回転デルタ。push() で蓄積、consume() で 0 に戻す */
  lookDX: number;
  lookDY: number;
  /** 走り（Shift） */
  running: boolean;
}

export type InputEvent = "jump" | "action" | "pause" | "panel";

type Listener = (event: InputEvent) => void;

export class InputBus {
  readonly state: InputState = {
    moveX: 0,
    moveY: 0,
    lookDX: 0,
    lookDY: 0,
    running: false,
  };
  private listeners = new Set<Listener>();

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: InputEvent): void {
    for (const l of this.listeners) l(event);
  }

  /** 視点回転デルタを取り出してリセット */
  consumeLook(): { dx: number; dy: number } {
    const dx = this.state.lookDX;
    const dy = this.state.lookDY;
    this.state.lookDX = 0;
    this.state.lookDY = 0;
    return { dx, dy };
  }
}
