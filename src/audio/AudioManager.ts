import { STORAGE_KEYS } from "../config/gameConfig";

/**
 * Web Audio API で SE / BGM を合成。外部素材なし。
 * iOS Safari は初回ユーザー操作後に AudioContext を resume する必要がある。
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private bgmTimer: number | null = null;
  private bgmStep = 0;

  constructor() {
    const stored = localStorage.getItem(STORAGE_KEYS.AUDIO_MUTED);
    this.muted = stored === "1";
  }

  async ensureStarted(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === "suspended") await this.ctx.resume();
      return;
    }
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.55;
    this.masterGain.connect(this.ctx.destination);
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain) this.masterGain.gain.value = muted ? 0 : 0.55;
    localStorage.setItem(STORAGE_KEYS.AUDIO_MUTED, muted ? "1" : "0");
  }

  isMuted(): boolean {
    return this.muted;
  }

  private tone(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.25, freqEnd?: number): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), now + dur);
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(g).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  jumpSE(): void {
    this.tone(520, 0.14, "square", 0.18, 880);
  }
  landSE(): void {
    this.tone(180, 0.1, "sine", 0.16, 90);
  }
  pickupSE(): void {
    this.tone(900, 0.07, "sine", 0.22, 1320);
    setTimeout(() => this.tone(1320, 0.09, "sine", 0.18, 1760), 50);
  }
  missionClearSE(): void {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.18, "triangle", 0.22), i * 110));
  }
  dialogSE(): void {
    this.tone(440, 0.05, "sine", 0.15, 660);
  }

  startBgm(): void {
    if (!this.ctx || this.bgmTimer !== null) return;
    const notes = [261.63, 329.63, 392, 440, 523.25, 440, 392, 329.63];
    const stepMs = 360;
    this.bgmStep = 0;
    const tick = (): void => {
      const note = notes[this.bgmStep % notes.length];
      if (this.ctx && this.masterGain) {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = note;
        g.gain.setValueAtTime(0.05, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(g).connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.34);
      }
      this.bgmStep++;
      this.bgmTimer = window.setTimeout(tick, stepMs);
    };
    tick();
  }

  stopBgm(): void {
    if (this.bgmTimer !== null) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  dispose(): void {
    this.stopBgm();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
