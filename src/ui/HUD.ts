/**
 * Phase 5-C の HUD。現在ミッション + 進捗 + クリア演出を担当。
 *
 * - 現在ミッション名 + 進捗 (例: 「DXの種を集めよう  3/10」)
 * - クリア時の一時メッセージ (3 秒で自動消去)
 *
 * (座標表示は Phase 5-E ハンドオフで不要と判断され削除)
 */
export interface HUDMission {
  title: string;
  progress: string;
}

export class HUD {
  private readonly root: HTMLElement;
  private readonly missionEl: HTMLElement;
  private readonly missionTitleEl: HTMLElement;
  private readonly missionProgressEl: HTMLElement;
  private readonly toastEl: HTMLElement;
  private toastTimer: number | null = null;

  constructor() {
    const root = document.getElementById("hud");
    const mission = document.getElementById("hud-mission");
    const missionTitle = document.getElementById("hud-mission-title");
    const missionProgress = document.getElementById("hud-mission-progress");
    const toast = document.getElementById("hud-toast");
    if (!root || !mission || !missionTitle || !missionProgress || !toast) {
      throw new Error("HUD 要素が見つかりません");
    }
    this.root = root;
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
