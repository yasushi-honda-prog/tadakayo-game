/**
 * Phase 5-C の HUD。座標 + 現在ミッション + 進捗 + クリア演出を担当。
 *
 * - 座標 (Phase 5-A から継続、デバッグ・位置感覚用)
 * - 現在ミッション名 + 進捗 (例: 「DXの種を集めよう  3/10」)
 * - クリア時の一時メッセージ (3 秒で自動消去)
 */
export interface HUDState {
  x: number;
  y: number;
  z: number;
}

export interface HUDMission {
  title: string;
  progress: string;
}

export class HUD {
  private readonly root: HTMLElement;
  private readonly posEl: HTMLElement;
  private readonly missionEl: HTMLElement;
  private readonly missionTitleEl: HTMLElement;
  private readonly missionProgressEl: HTMLElement;
  private readonly toastEl: HTMLElement;
  private toastTimer: number | null = null;

  constructor() {
    const root = document.getElementById("hud");
    const pos = document.getElementById("hud-position");
    const mission = document.getElementById("hud-mission");
    const missionTitle = document.getElementById("hud-mission-title");
    const missionProgress = document.getElementById("hud-mission-progress");
    const toast = document.getElementById("hud-toast");
    if (!root || !pos || !mission || !missionTitle || !missionProgress || !toast) {
      throw new Error("HUD 要素が見つかりません");
    }
    this.root = root;
    this.posEl = pos;
    this.missionEl = mission;
    this.missionTitleEl = missionTitle;
    this.missionProgressEl = missionProgress;
    this.toastEl = toast;
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

  setMission(m: HUDMission | null): void {
    if (m === null) {
      this.missionEl.classList.add("hidden");
      return;
    }
    this.missionEl.classList.remove("hidden");
    this.missionTitleEl.textContent = m.title;
    this.missionProgressEl.textContent = m.progress;
  }

  flashClear(text: string, durationMs = 3000): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove("hidden");
    if (this.toastTimer !== null) clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.classList.add("hidden");
      this.toastTimer = null;
    }, durationMs);
  }
}
