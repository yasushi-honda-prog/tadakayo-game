/**
 * Phase 5-A の最小 HUD。プレイヤー座標と操作ヒントを表示する。
 * Phase 5-C 以降でミッション表示・進捗バー等を追加。
 */
export interface HUDState {
  x: number;
  y: number;
  z: number;
}

export class HUD {
  private readonly root: HTMLElement;
  private readonly posEl: HTMLElement;

  constructor() {
    const root = document.getElementById("hud");
    const pos = document.getElementById("hud-position");
    if (!root || !pos) throw new Error("HUD 要素が見つかりません");
    this.root = root;
    this.posEl = pos;
  }

  show(): void {
    this.root.classList.remove("hidden");
  }

  hide(): void {
    this.root.classList.add("hidden");
  }

  update(s: HUDState): void {
    this.posEl.textContent = `x:${s.x.toFixed(1)} y:${s.y.toFixed(1)} z:${s.z.toFixed(1)}`;
  }
}
