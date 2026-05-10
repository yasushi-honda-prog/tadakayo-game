import { STORAGE_KEYS } from "../config/gameConfig";

/**
 * Web Audio API で SE / BGM を合成。
 * - 効果音は短いシンセ波形（外部音源不要）
 * - BGM は和音アルペジオの繰り返し
 * - iOS Safari は初回ユーザー操作後に AudioContext を resume() 必須
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

  /** タイトルの「スタート」など、初回タップで呼ぶ。AudioContext を起動・resume */
  async ensureStarted(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === "suspended") await this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.6;
    this.masterGain.connect(this.ctx.destination);
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : 0.6;
    }
    localStorage.setItem(STORAGE_KEYS.AUDIO_MUTED, muted ? "1" : "0");
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** 短い tone を鳴らす */
  private tone(freq: number, durationSec: number, type: OscillatorType = "sine", gain = 0.3, freqEnd?: number): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), now + durationSec);
    }
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
    osc.connect(g).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  jumpSE(): void {
    this.tone(440, 0.18, "square", 0.18, 880);
  }
  crouchSE(): void {
    this.tone(220, 0.15, "sine", 0.18, 110);
  }
  pickupSE(): void {
    this.tone(880, 0.08, "sine", 0.25, 1320);
    setTimeout(() => this.tone(1320, 0.1, "sine", 0.18, 1760), 60);
  }
  hitSE(): void {
    this.tone(110, 0.45, "sawtooth", 0.35, 40);
  }
  shieldSE(): void {
    this.tone(660, 0.12, "triangle", 0.25, 990);
    setTimeout(() => this.tone(990, 0.16, "triangle", 0.25, 1320), 80);
    setTimeout(() => this.tone(1320, 0.22, "triangle", 0.22, 1760), 180);
  }
  stageUpSE(): void {
    [523, 659, 784, 1046].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.18, "triangle", 0.25), i * 100);
    });
  }
  gameOverSE(): void {
    [523, 415, 330, 261].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.25, "sine", 0.25), i * 130);
    });
  }

  /** 軽い BGM ループ（C メジャー pentatonic の繰り返し） */
  startBgm(): void {
    if (!this.ctx || this.bgmTimer !== null) return;
    const notes = [261.63, 329.63, 392, 440, 523.25, 440, 392, 329.63];
    const stepMs = 320;
    this.bgmStep = 0;
    const tick = (): void => {
      const note = notes[this.bgmStep % notes.length];
      // BGM は SE よりさらに小さく
      if (this.ctx && this.masterGain) {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = note;
        g.gain.setValueAtTime(0.06, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.connect(g).connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.32);
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
