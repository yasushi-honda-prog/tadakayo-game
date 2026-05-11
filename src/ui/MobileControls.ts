/**
 * モバイル仮想コントローラ DOM ラッパー (Phase 5-E)。
 *
 * **責務**:
 * - index.html の `#mobile-controls` 配下要素を取得して publicly expose する (TouchInput が触れるように)
 * - show()/hide() で全体表示制御 (タイトル/ポーズ画面では hide)
 *
 * **責務外** (TouchInput 側で実装):
 * - Pointer Event listener と仮想スティックの knob 移動
 * - ジャンプ/アクション/ポーズボタンのクリックイベント発火
 *
 * 分離理由: TouchInput が「入力処理」、MobileControls が「DOM 制御」と責務を切ることで、
 * デスクトップでも MobileControls だけ生成して非表示にし続ける構成が可能 (今は使わないが将来の余地)。
 */
export class MobileControls {
  readonly root: HTMLElement;
  readonly stick: HTMLElement;
  readonly knob: HTMLElement;
  readonly jumpBtn: HTMLButtonElement;
  readonly actionBtn: HTMLButtonElement;
  readonly pauseBtn: HTMLButtonElement;

  constructor() {
    const root = document.getElementById("mobile-controls");
    const stick = document.getElementById("virtual-stick");
    const knob = stick?.querySelector(".stick-knob") as HTMLElement | null;
    const jump = document.getElementById("btn-jump") as HTMLButtonElement | null;
    const action = document.getElementById("btn-action") as HTMLButtonElement | null;
    const pause = document.getElementById("btn-pause") as HTMLButtonElement | null;
    if (!root || !stick || !knob || !jump || !action || !pause) {
      throw new Error("MobileControls 要素が見つかりません");
    }
    this.root = root;
    this.stick = stick;
    this.knob = knob;
    this.jumpBtn = jump;
    this.actionBtn = action;
    this.pauseBtn = pause;
  }

  show(): void {
    this.root.classList.remove("hidden");
    this.root.setAttribute("aria-hidden", "false");
  }

  hide(): void {
    this.root.classList.add("hidden");
    this.root.setAttribute("aria-hidden", "true");
  }
}
