/**
 * ポーズメニュー (Phase 5-E + Stage 2 / 2026-05-13)。
 *
 * モーダル全画面 UI で 5 ボタンを提供:
 * - 再開 (resume): 単に閉じる。Game 側は isVisible() で update を pause しているので、
 *   閉じれば自動的にゲーム再開。
 * - 音 ON/OFF: AudioManager.setMuted() を Game 経由で呼ぶ
 * - 設定 ▾ (Stage 2): 感度 X/Y スライダー、Y 軸反転、BGM/SE 音量スライダー、
 *   設定リセット。UserSettings シングルトンに直接書き込み、永続化は UserSettings 側で実施。
 * - 操作説明 ▾: 折りたたみテキストの開閉のみ (UI 内ローカル状態)
 * - タイトルに戻る: Game.resetToTitle() を呼ぶ。
 *
 * **責務注意**: PauseMenu は「開閉と各操作の発火」のみ。
 * - 実際に Game ループを止めるのは Game 側 (`if (this.pauseMenu.isVisible()) return` で update を skip)
 * - mute 状態の真の保持先は AudioManager (PauseMenu はラベル表示用に muted state を持つだけ)
 * - 設定値の真の保持先は UserSettings シングルトン (PauseMenu は表示同期のため `onChange` を購読)
 */
import { UserSettings, DEFAULT_SETTINGS } from "../config/UserSettings";

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
  // Stage 2: 設定セクション
  private readonly settingsToggleBtn: HTMLButtonElement;
  private readonly settingsDetail: HTMLElement;
  private readonly sensXInput: HTMLInputElement;
  private readonly sensXValueEl: HTMLElement;
  private readonly sensYInput: HTMLInputElement;
  private readonly sensYValueEl: HTMLElement;
  private readonly invertYInput: HTMLInputElement;
  private readonly bgmVolInput: HTMLInputElement;
  private readonly bgmVolValueEl: HTMLElement;
  private readonly seVolInput: HTMLInputElement;
  private readonly seVolValueEl: HTMLElement;
  private readonly settingsResetBtn: HTMLButtonElement;

  private opened = false;
  private muted: boolean;
  private disposed = false;
  private readonly onResume: () => void;
  private readonly onMuteToggleCb: (muted: boolean) => void;
  private readonly onReset: () => void;
  private settingsUnsub: (() => void) | null = null;

  private readonly resumeHandler = () => this.handleResume();
  private readonly muteHandler = () => this.handleMuteToggle();
  private readonly controlsHandler = () => this.handleControlsToggle();
  private readonly resetHandler = () => this.handleReset();
  private readonly settingsToggleHandler = () => this.handleSettingsToggle();
  private readonly settingsResetHandler = () => this.handleSettingsReset();
  private readonly sensXHandler = () => this.handleSliderChange("sensitivityX", this.sensXInput);
  private readonly sensYHandler = () => this.handleSliderChange("sensitivityY", this.sensYInput);
  private readonly invertYHandler = () =>
    UserSettings.instance.update({ invertY: this.invertYInput.checked });
  private readonly bgmVolHandler = () => this.handleSliderChange("bgmVolume", this.bgmVolInput);
  private readonly seVolHandler = () => this.handleSliderChange("seVolume", this.seVolInput);

  constructor(opts: PauseMenuOptions) {
    const root = document.getElementById("pause-menu");
    const resume = document.getElementById("pause-resume") as HTMLButtonElement | null;
    const mute = document.getElementById("pause-mute-toggle") as HTMLButtonElement | null;
    const ctrlBtn = document.getElementById("pause-controls-toggle") as HTMLButtonElement | null;
    const ctrlDetail = document.getElementById("pause-controls-detail");
    const reset = document.getElementById("pause-reset") as HTMLButtonElement | null;
    const settingsBtn = document.getElementById("pause-settings-toggle") as HTMLButtonElement | null;
    const settingsDetail = document.getElementById("pause-settings-detail");
    const sensX = document.getElementById("pause-sensitivity-x") as HTMLInputElement | null;
    const sensXVal = document.getElementById("pause-sensitivity-x-value");
    const sensY = document.getElementById("pause-sensitivity-y") as HTMLInputElement | null;
    const sensYVal = document.getElementById("pause-sensitivity-y-value");
    const invertY = document.getElementById("pause-invert-y") as HTMLInputElement | null;
    const bgmVol = document.getElementById("pause-bgm-volume") as HTMLInputElement | null;
    const bgmVolVal = document.getElementById("pause-bgm-volume-value");
    const seVol = document.getElementById("pause-se-volume") as HTMLInputElement | null;
    const seVolVal = document.getElementById("pause-se-volume-value");
    const settingsResetBtn = document.getElementById("pause-settings-reset") as HTMLButtonElement | null;
    if (
      !root ||
      !resume ||
      !mute ||
      !ctrlBtn ||
      !ctrlDetail ||
      !reset ||
      !settingsBtn ||
      !settingsDetail ||
      !sensX ||
      !sensXVal ||
      !sensY ||
      !sensYVal ||
      !invertY ||
      !bgmVol ||
      !bgmVolVal ||
      !seVol ||
      !seVolVal ||
      !settingsResetBtn
    ) {
      throw new Error("PauseMenu 要素が見つかりません");
    }
    this.root = root;
    this.resumeBtn = resume;
    this.muteBtn = mute;
    this.controlsToggleBtn = ctrlBtn;
    this.controlsDetail = ctrlDetail;
    this.resetBtn = reset;
    this.settingsToggleBtn = settingsBtn;
    this.settingsDetail = settingsDetail;
    this.sensXInput = sensX;
    this.sensXValueEl = sensXVal;
    this.sensYInput = sensY;
    this.sensYValueEl = sensYVal;
    this.invertYInput = invertY;
    this.bgmVolInput = bgmVol;
    this.bgmVolValueEl = bgmVolVal;
    this.seVolInput = seVol;
    this.seVolValueEl = seVolVal;
    this.settingsResetBtn = settingsResetBtn;
    this.muted = opts.initialMuted;
    this.onResume = opts.onResume;
    this.onMuteToggleCb = opts.onMuteToggle;
    this.onReset = opts.onReset;
    this.refreshMuteLabel();
    this.syncSettingsUI(UserSettings.instance.current);
    this.bind();
  }

  private bind(): void {
    // bound handler 化で dispose / 重複登録防止 (PR #15 review fix)
    this.resumeBtn.addEventListener("click", this.resumeHandler);
    this.muteBtn.addEventListener("click", this.muteHandler);
    this.controlsToggleBtn.addEventListener("click", this.controlsHandler);
    this.resetBtn.addEventListener("click", this.resetHandler);
    this.settingsToggleBtn.addEventListener("click", this.settingsToggleHandler);
    this.settingsResetBtn.addEventListener("click", this.settingsResetHandler);
    // input イベント (ドラッグ中もリアルタイム反映) を使用
    this.sensXInput.addEventListener("input", this.sensXHandler);
    this.sensYInput.addEventListener("input", this.sensYHandler);
    this.invertYInput.addEventListener("change", this.invertYHandler);
    this.bgmVolInput.addEventListener("input", this.bgmVolHandler);
    this.seVolInput.addEventListener("input", this.seVolHandler);
    // 外部から設定が変わった場合 (デフォルト戻し等) に UI を再同期
    this.settingsUnsub = UserSettings.instance.onChange((s) => this.syncSettingsUI(s));
  }

  /** HMR / Game.dispose 後の再生成で listener が重複しないよう必ず呼ぶ */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resumeBtn.removeEventListener("click", this.resumeHandler);
    this.muteBtn.removeEventListener("click", this.muteHandler);
    this.controlsToggleBtn.removeEventListener("click", this.controlsHandler);
    this.resetBtn.removeEventListener("click", this.resetHandler);
    this.settingsToggleBtn.removeEventListener("click", this.settingsToggleHandler);
    this.settingsResetBtn.removeEventListener("click", this.settingsResetHandler);
    this.sensXInput.removeEventListener("input", this.sensXHandler);
    this.sensYInput.removeEventListener("input", this.sensYHandler);
    this.invertYInput.removeEventListener("change", this.invertYHandler);
    this.bgmVolInput.removeEventListener("input", this.bgmVolHandler);
    this.seVolInput.removeEventListener("input", this.seVolHandler);
    if (this.settingsUnsub) {
      this.settingsUnsub();
      this.settingsUnsub = null;
    }
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
    // 操作説明 / 設定 展開状態は閉じるたびに畳む (再開→ポーズで毎回開く挙動を避ける)
    this.controlsDetail.classList.add("hidden");
    this.controlsToggleBtn.textContent = "操作説明 ▾";
    this.settingsDetail.classList.add("hidden");
    this.settingsToggleBtn.textContent = "設定 ▾";
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

  private handleSettingsToggle(): void {
    const isHidden = this.settingsDetail.classList.contains("hidden");
    if (isHidden) {
      this.settingsDetail.classList.remove("hidden");
      this.settingsToggleBtn.textContent = "設定 ▴";
    } else {
      this.settingsDetail.classList.add("hidden");
      this.settingsToggleBtn.textContent = "設定 ▾";
    }
  }

  private handleSettingsReset(): void {
    UserSettings.instance.resetToDefaults();
    // resetToDefaults は muted を保持するため、mute ラベルへの影響なし
  }

  private handleSliderChange(
    key: "sensitivityX" | "sensitivityY" | "bgmVolume" | "seVolume",
    input: HTMLInputElement,
  ): void {
    const v = Number.parseFloat(input.value);
    if (!Number.isFinite(v)) return;
    UserSettings.instance.update({ [key]: v });
  }

  /** UserSettings の現在値を UI コントロールへ反映 (初期化 + リセット時) */
  private syncSettingsUI(s: typeof DEFAULT_SETTINGS): void {
    this.sensXInput.value = String(s.sensitivityX);
    this.sensXValueEl.textContent = `${s.sensitivityX.toFixed(2)}x`;
    this.sensYInput.value = String(s.sensitivityY);
    this.sensYValueEl.textContent = `${s.sensitivityY.toFixed(2)}x`;
    this.invertYInput.checked = s.invertY;
    this.bgmVolInput.value = String(s.bgmVolume);
    this.bgmVolValueEl.textContent = `${Math.round(s.bgmVolume * 100)}%`;
    this.seVolInput.value = String(s.seVolume);
    this.seVolValueEl.textContent = `${Math.round(s.seVolume * 100)}%`;
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
