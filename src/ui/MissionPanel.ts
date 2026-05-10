import type { Mission } from "../missions/Mission";

/**
 * Phase 5-C のミッション詳細パネル。M キー/タップで開閉。
 *
 * - active / completed の全ミッションを一覧表示
 * - 各行: タイトル、説明、進捗、cleared なら「クリア！」バッジ
 * - 開いてる間でも canvas 操作は止めない（半透明 overlay でゲームは進行）
 */
export class MissionPanel {
  private readonly root: HTMLElement;
  private readonly listEl: HTMLElement;
  private readonly toggleBtn: HTMLButtonElement;
  private open = false;

  constructor() {
    const root = document.getElementById("mission-panel");
    const list = document.getElementById("mission-panel-list");
    const toggle = document.getElementById("mission-panel-close");
    if (!root || !list || !toggle) throw new Error("MissionPanel 要素が見つかりません");
    this.root = root;
    this.listEl = list;
    this.toggleBtn = toggle as HTMLButtonElement;

    this.toggleBtn.addEventListener("click", () => this.close());
  }

  isOpen(): boolean {
    return this.open;
  }

  toggle(): void {
    if (this.open) this.close();
    else this.show();
  }

  show(): void {
    this.open = true;
    this.root.classList.remove("hidden");
  }

  close(): void {
    this.open = false;
    this.root.classList.add("hidden");
  }

  render(missions: readonly Mission[]): void {
    this.listEl.replaceChildren();
    if (missions.length === 0) {
      const empty = document.createElement("div");
      empty.className = "mission-empty";
      empty.textContent = "アクティブなミッションはありません";
      this.listEl.appendChild(empty);
      return;
    }
    for (const m of missions) {
      const item = document.createElement("div");
      item.className = m.cleared ? "mission-item cleared" : "mission-item";

      const title = document.createElement("div");
      title.className = "mission-item-title";
      title.textContent = m.title;
      item.appendChild(title);

      const desc = document.createElement("div");
      desc.className = "mission-item-desc";
      desc.textContent = m.description;
      item.appendChild(desc);

      const progress = document.createElement("div");
      progress.className = "mission-item-progress";
      progress.textContent = m.cleared ? "クリア済み" : m.progressText();
      item.appendChild(progress);

      this.listEl.appendChild(item);
    }
  }
}
