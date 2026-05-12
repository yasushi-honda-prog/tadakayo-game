/**
 * Phase 5-F: タダカヨ村マスター達成時のスコア画面 (大型モーダル)。
 * Stage 3 (2026-05-13): 自己ベストタイム + 累計クリア回数 + 新記録バッジを追加。
 *
 * 表示項目:
 * - クリアタイム (mm:ss) + 新記録バッジ (新自己ベスト達成時)
 * - DXの種を集めた数 (current/total)
 * - 現場の声を聞いた数 (current/total)
 * - 広場で踊った数 (current/total)
 * - 塔の頂上に到達したか
 * - 自己ベスト (Stage 3: 過去最速)
 * - 累計クリア回数 (Stage 3)
 * - 星評価 1-5 (タイムベース、ハート全取得・全会話で +0.5 ずつ)
 *
 * ボタン:
 * - もう一度プレイ → onReplay (Game 側で resetToTitle 後に startPlay 相当を即起動するか、タイトルに戻る)
 * - タイトルに戻る → onClose (純粋に閉じてタイトルへ)
 */
import { GameRecord } from "../config/GameRecord";

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
  // Stage 3: 自己ベスト + 累計 + 新記録バッジ
  private readonly bestTimeEl: HTMLElement;
  private readonly playCountEl: HTMLElement;
  private readonly newRecordEl: HTMLElement;
  private readonly replayBtn: HTMLButtonElement;
  private readonly closeBtn: HTMLButtonElement;
  private readonly onReplay: () => void;
  private readonly onClose: () => void;
  private opened = false;
  private disposed = false;

  private readonly replayHandler = () => this.handleReplay();
  private readonly closeHandler = () => this.handleClose();
  /** Stage 3 (Firestore): show 中にクラウド同期で values が更新されたら再描画する用 */
  private recordUnsub: (() => void) | null = null;
  /** Stage 3: 最後に show したときの新記録判定結果。クラウド遅延 fetch 後の再描画で消えないよう保持 */
  private lastWasNewBestTime = false;
  private lastPrevBestTimeSec: number | null = null;

  constructor(opts: ScoreScreenOptions) {
    const root = document.getElementById("score-screen");
    const time = document.getElementById("score-time");
    const hearts = document.getElementById("score-hearts");
    const talks = document.getElementById("score-talks");
    const dances = document.getElementById("score-dances");
    const tower = document.getElementById("score-tower");
    const stars = document.getElementById("score-stars");
    const message = document.getElementById("score-message");
    const bestTime = document.getElementById("score-best-time");
    const playCount = document.getElementById("score-play-count");
    const newRecord = document.getElementById("score-new-record");
    const replay = document.getElementById("score-replay") as HTMLButtonElement | null;
    const close = document.getElementById("score-close") as HTMLButtonElement | null;
    if (
      !root ||
      !time ||
      !hearts ||
      !talks ||
      !dances ||
      !tower ||
      !stars ||
      !message ||
      !bestTime ||
      !playCount ||
      !newRecord ||
      !replay ||
      !close
    ) {
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
    this.bestTimeEl = bestTime;
    this.playCountEl = playCount;
    this.newRecordEl = newRecord;
    this.replayBtn = replay;
    this.closeBtn = close;
    this.onReplay = opts.onReplay;
    this.onClose = opts.onClose;
    this.replayBtn.addEventListener("click", this.replayHandler);
    this.closeBtn.addEventListener("click", this.closeHandler);
  }

  /** 統計を表示してモーダルを開く。Stage 3: GameRecord に記録 + 自己ベスト表示 */
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

    // Stage 3: クリア記録 (localStorage に同期保存、Firestore は fire-and-forget)
    const result = GameRecord.instance.recordPlay(stats.elapsedSec, stars);
    this.lastWasNewBestTime = result.isNewBestTime;
    this.lastPrevBestTimeSec = result.prevBestTimeSec;
    this.renderRecordSection();

    // クラウドから遅れて新しい記録 (別端末でのプレイ結果) が降ってくる場合に
    // 再描画する。値が改善されたケースだけバッジ表示は維持。
    this.recordUnsub = GameRecord.instance.onChange(() => this.renderRecordSection());

    this.root.classList.remove("hidden");
  }

  /** 自己ベスト / 累計 / 新記録バッジを GameRecord.instance.current から再構築 */
  private renderRecordSection(): void {
    const rec = GameRecord.instance.current;
    this.bestTimeEl.textContent =
      rec.bestTimeSec === null ? "—" : formatTime(rec.bestTimeSec);
    this.playCountEl.textContent = `${rec.playCount} 回`;
    if (this.lastWasNewBestTime) {
      if (this.lastPrevBestTimeSec === null) {
        this.newRecordEl.textContent = "🏆 新記録!";
      } else {
        this.newRecordEl.textContent = `🏆 新記録! (前回 ${formatTime(this.lastPrevBestTimeSec)})`;
      }
      this.newRecordEl.classList.remove("hidden");
    } else {
      this.newRecordEl.classList.add("hidden");
    }
  }

  hide(): void {
    if (!this.opened) return;
    this.opened = false;
    this.root.classList.add("hidden");
    // 新記録バッジは次回 show で再判定するため、hide 時に隠しておく
    this.newRecordEl.classList.add("hidden");
    // Stage 3: クラウド同期 listener を解除 (hide 後の不要再描画を防ぐ)
    if (this.recordUnsub) {
      this.recordUnsub();
      this.recordUnsub = null;
    }
  }

  isVisible(): boolean {
    return this.opened;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.replayBtn.removeEventListener("click", this.replayHandler);
    this.closeBtn.removeEventListener("click", this.closeHandler);
    if (this.recordUnsub) {
      this.recordUnsub();
      this.recordUnsub = null;
    }
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
