/**
 * ポーズメニュー (Phase 5-E)。
 *
 * モーダル全画面 UI で 4 ボタンを提供:
 * - 再開 (resume): 単に閉じる。Game 側は isVisible() で update を pause しているので、
 *   閉じれば自動的にゲーム再開。
 * - 音 ON/OFF: AudioManager.setMuted() を Game 経由で呼ぶ
 * - 操作説明: 折りたたみテキストの開閉のみ (UI 内ローカル状態)
 * - タイトルに戻る: Game.resetToTitle() を呼ぶ。確認ダイアログは出さない (シンプル優先、
 *   再構築で全 mission も初期化される)。
 *
 * **責務注意**: PauseMenu は「開閉と 4 ボタンの発火」のみ。
 * - 実際に Game ループを止めるのは Game 側 (`if (this.pauseMenu.isVisible()) return` で update を skip)
 * - mute 状態の真の保持先は AudioManager (PauseMenu はラベル表示用に muted state を持つだけ)
 * - 開いている間は mobile-controls / pointer-lock も Game 側で別途制御する
 */
export interface PauseMenuOptions {
  initialMuted: boolean;
  onResume: () => void;
  onMuteToggle: (muted: boolean) => void;
  onReset: () => void;
}

export class PauseMenu {
  private readonly root: HTMLElement;
  private readonly resumeBtn: HTMLButtonElement;
  private readonly muteBtn: HTMLButtonElement;
  private readonly controlsToggleBtn: HTMLButtonElement;
  private readonly controlsDetail: HTMLElement;
  private readonly resetBtn: HTMLButtonElement;

  private opened = false;
  private muted: boolean;
  private disposed = false;
  private readonly onResume: () => void;
  private readonly onMuteToggleCb: (muted: boolean) => void;
  private readonly onReset: () => void;

  private readonly resumeHandler = () => this.handleResume();
  private readonly muteHandler = () => this.handleMuteToggle();
  private readonly controlsHandler = () => this.handleControlsToggle();
  private readonly resetHandler = () => this.handleReset();

  constructor(opts: PauseMenuOptions) {
    const root = document.getElementById("pause-menu");
    const resume = document.getElementById("pause-resume") as HTMLButtonElement | null;
    const mute = document.getElementById("pause-mute-toggle") as HTMLButtonElement | null;
    const ctrlBtn = document.getElementById("pause-controls-toggle") as HTMLButtonElement | null;
    const ctrlDetail = document.getElementById("pause-controls-detail");
    const reset = document.getElementById("pause-reset") as HTMLButtonElement | null;
    if (!root || !resume || !mute || !ctrlBtn || !ctrlDetail || !reset) {
      throw new Error("PauseMenu 要素が見つかりません");
    }
    this.root = root;
    this.resumeBtn = resume;
    this.muteBtn = mute;
    this.controlsToggleBtn = ctrlBtn;
    this.controlsDetail = ctrlDetail;
    this.resetBtn = reset;
    this.muted = opts.initialMuted;
    this.onResume = opts.onResume;
    this.onMuteToggleCb = opts.onMuteToggle;
    this.onReset = opts.onReset;
    this.refreshMuteLabel();
    this.bind();
  }

  private bind(): void {
    // bound handler 化で dispose / 重複登録防止 (PR #15 review fix)
    this.resumeBtn.addEventListener("click", this.resumeHandler);
    this.muteBtn.addEventListener("click", this.muteHandler);
    this.controlsToggleBtn.addEventListener("click", this.controlsHandler);
    this.resetBtn.addEventListener("click", this.resetHandler);
  }

  /** HMR / Game.dispose 後の再生成で listener が重複しないよう必ず呼ぶ */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resumeBtn.removeEventListener("click", this.resumeHandler);
    this.muteBtn.removeEventListener("click", this.muteHandler);
    this.controlsToggleBtn.removeEventListener("click", this.controlsHandler);
    this.resetBtn.removeEventListener("click", this.resetHandler);
  }

  open(): void {
    if (this.opened) return;
    this.opened = true;
    this.root.classList.remove("hidden");
  }

  close(): void {
    if (!this.opened) return;
    this.opened = false;
    this.root.classList.add("hidden");
    // 操作説明展開状態は閉じるたびに畳む (再開→ポーズで毎回開く挙動を避ける)
    this.controlsDetail.classList.add("hidden");
    this.controlsToggleBtn.textContent = "操作説明 ▾";
  }

  toggle(): void {
    if (this.opened) {
      this.handleResume();
    } else {
      this.open();
    }
  }

  isVisible(): boolean {
    return this.opened;
  }

  /** 外部 (Game) が AudioManager 状態を変更した場合に呼ぶ */
  syncMuted(muted: boolean): void {
    this.muted = muted;
    this.refreshMuteLabel();
  }

  private handleResume(): void {
    this.close();
    this.onResume();
  }

  private handleMuteToggle(): void {
    this.muted = !this.muted;
    this.refreshMuteLabel();
    this.onMuteToggleCb(this.muted);
  }

  private handleControlsToggle(): void {
    const isHidden = this.controlsDetail.classList.contains("hidden");
    if (isHidden) {
      this.controlsDetail.classList.remove("hidden");
      this.controlsToggleBtn.textContent = "操作説明 ▴";
    } else {
      this.controlsDetail.classList.add("hidden");
      this.controlsToggleBtn.textContent = "操作説明 ▾";
    }
  }

  private handleReset(): void {
    this.close();
    this.onReset();
  }

  private refreshMuteLabel(): void {
    this.muteBtn.textContent = this.muted ? "🔇 音 OFF" : "🔊 音 ON";
    this.muteBtn.classList.toggle("muted", this.muted);
  }
}
