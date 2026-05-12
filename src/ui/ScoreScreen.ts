/**
 * Phase 5-F: タダカヨ村マスター達成時のスコア画面 (大型モーダル)。
 *
 * 表示項目:
 * - クリアタイム (mm:ss)
 * - DXの種を集めた数 (current/total)
 * - 現場の声を聞いた数 (current/total)
 * - 広場で踊った数 (current/total)
 * - 塔の頂上に到達したか
 * - 星評価 1-5 (タイムベース、ハート全取得・全会話で +0.5 ずつ)
 *
 * ボタン:
 * - もう一度プレイ → onReplay (Game 側で resetToTitle 後に startPlay 相当を即起動するか、タイトルに戻る)
 * - タイトルに戻る → onClose (純粋に閉じてタイトルへ)
 */
export interface ScoreStats {
  /** 経過秒数 */
  elapsedSec: number;
  hearts: { current: number; total: number };
  talks: { current: number; total: number };
  dances: { current: number; total: number };
  reachedTower: boolean;
}

export interface ScoreScreenOptions {
  onReplay: () => void;
  onClose: () => void;
}

export class ScoreScreen {
  private readonly root: HTMLElement;
  private readonly timeEl: HTMLElement;
  private readonly heartsEl: HTMLElement;
  private readonly talksEl: HTMLElement;
  private readonly dancesEl: HTMLElement;
  private readonly towerEl: HTMLElement;
  private readonly starsEl: HTMLElement;
  private readonly messageEl: HTMLElement;
  private readonly replayBtn: HTMLButtonElement;
  private readonly closeBtn: HTMLButtonElement;
  private readonly onReplay: () => void;
  private readonly onClose: () => void;
  private opened = false;
  private disposed = false;

  private readonly replayHandler = () => this.handleReplay();
  private readonly closeHandler = () => this.handleClose();

  constructor(opts: ScoreScreenOptions) {
    const root = document.getElementById("score-screen");
    const time = document.getElementById("score-time");
    const hearts = document.getElementById("score-hearts");
    const talks = document.getElementById("score-talks");
    const dances = document.getElementById("score-dances");
    const tower = document.getElementById("score-tower");
    const stars = document.getElementById("score-stars");
    const message = document.getElementById("score-message");
    const replay = document.getElementById("score-replay") as HTMLButtonElement | null;
    const close = document.getElementById("score-close") as HTMLButtonElement | null;
    if (!root || !time || !hearts || !talks || !dances || !tower || !stars || !message || !replay || !close) {
      throw new Error("ScoreScreen 要素が見つかりません");
    }
    this.root = root;
    this.timeEl = time;
    this.heartsEl = hearts;
    this.talksEl = talks;
    this.dancesEl = dances;
    this.towerEl = tower;
    this.starsEl = stars;
    this.messageEl = message;
    this.replayBtn = replay;
    this.closeBtn = close;
    this.onReplay = opts.onReplay;
    this.onClose = opts.onClose;
    this.replayBtn.addEventListener("click", this.replayHandler);
    this.closeBtn.addEventListener("click", this.closeHandler);
  }

  /** 統計を表示してモーダルを開く */
  show(stats: ScoreStats): void {
    if (this.opened) return;
    this.opened = true;
    // Pointer Lock 中だと UI 上のボタンがクリックできない (lock 中はカーソル非表示・
    // 全 mouse イベントが canvas に吸われる)。ScoreScreen はキー操作ではなく
    // missionCleared から自動表示されるため、ここで明示的に解除する。
    if (document.pointerLockElement && document.exitPointerLock) {
      document.exitPointerLock();
    }
    this.timeEl.textContent = formatTime(stats.elapsedSec);
    this.heartsEl.textContent = `${stats.hearts.current} / ${stats.hearts.total}`;
    this.talksEl.textContent = `${stats.talks.current} / ${stats.talks.total}`;
    this.dancesEl.textContent = `${stats.dances.current} / ${stats.dances.total}`;
    this.towerEl.textContent = stats.reachedTower ? "✓ 達成" : "—";
    const stars = computeStars(stats);
    this.starsEl.textContent = "★".repeat(stars) + "☆".repeat(5 - stars);
    this.messageEl.textContent = encouragement(stars);
    this.root.classList.remove("hidden");
  }

  hide(): void {
    if (!this.opened) return;
    this.opened = false;
    this.root.classList.add("hidden");
  }

  isVisible(): boolean {
    return this.opened;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.replayBtn.removeEventListener("click", this.replayHandler);
    this.closeBtn.removeEventListener("click", this.closeHandler);
  }

  private handleReplay(): void {
    this.hide();
    this.onReplay();
  }

  private handleClose(): void {
    this.hide();
    this.onClose();
  }
}

function formatTime(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * 星評価ロジック:
 * - 基本 3 ★ (全 4 ミッションクリアで到達した時点)
 * - 全ハート取得 (10/10) で +1
 * - 全会話達成 (3/3) で +1
 * - クリアタイム 5 分以内なら +1 (上限 5 ★)
 * - クリアタイム 10 分超なら -1 (下限 1 ★)
 */
function computeStars(s: ScoreStats): number {
  let stars = 3;
  if (s.hearts.current >= s.hearts.total) stars += 1;
  if (s.talks.current >= s.talks.total) stars += 1;
  if (s.elapsedSec <= 300) stars += 1;
  else if (s.elapsedSec > 600) stars -= 1;
  return Math.min(5, Math.max(1, stars));
}

function encouragement(stars: number): string {
  if (stars >= 5) return "完璧! 介護現場の DX、あなたが先頭です 🎉";
  if (stars >= 4) return "素晴らしい! 介護 DX の感覚、しっかり掴めました";
  if (stars >= 3) return "よくできました! ここから一緒に介護 DX を始めよう";
  return "まずは完走、おつかれさまでした! 何度でも遊べます";
}
