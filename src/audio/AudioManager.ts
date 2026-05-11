import { STORAGE_KEYS } from "../config/gameConfig";

/**
 * SE/BGM の再生管理。
 *
 * Phase 5-D 改修: 外部フリー素材 (kenney.nl Interface Sounds + Music Jingles, CC0)
 * を Web Audio で decode して再生する。decode 失敗時は内部合成 fallback。
 *
 * 素材クレジット:
 * - SE: Kenney Interface Sounds (CC0, kenney.nl)
 * - BGM (village): Kenney Music Jingles - Pizzicato (CC0, kenney.nl)
 * - BGM (dance): "Karma" by Michael Ramir C. (Mixkit License, mixkit.co - 商用利用可)
 *
 * iOS Safari は初回ユーザー操作後に AudioContext を resume する必要がある。
 */
type SoundKey = "pickup" | "missionClear" | "jump" | "land" | "dialogNext" | "dialogOpen";

const SOUND_FILES: Record<SoundKey, string> = {
  pickup: "se-pickup.ogg",
  missionClear: "se-mission-clear.ogg",
  jump: "se-jump.ogg",
  land: "se-land.ogg",
  dialogNext: "se-dialog-next.ogg",
  dialogOpen: "se-dialog-open.ogg",
};

const BGM_FILE = "bgm-village.ogg";
const DANCE_BGM_FILE = "bgm-dance.mp3";

const SE_GAIN = 0.55;
const BGM_GAIN = 0.22; // 村 BGM は控えめ (SE 聞こえやすく)
const DANCE_BGM_GAIN = 0.35; // ダンス中の主役 BGM、村より少し大きく
const VILLAGE_DUCK_GAIN = 0.04; // ダンス中は村 BGM をほぼ消す (ducking)

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private danceBgmGain: GainNode | null = null;
  private muted = false;
  private buffers: Partial<Record<SoundKey, AudioBuffer>> = {};
  private bgmBuffer: AudioBuffer | null = null;
  private bgmSource: AudioBufferSourceNode | null = null;
  private danceBgmBuffer: AudioBuffer | null = null;
  private danceBgmSource: AudioBufferSourceNode | null = null;
  /** startBgm() が bgmBuffer 未 decode で空振りした時、preloadAll 完了後に自動再生するためのフラグ */
  private bgmPendingStart = false;

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
    this.masterGain.gain.value = this.muted ? 0 : 1.0;
    this.masterGain.connect(this.ctx.destination);

    // BGM 専用ゲイン (mute と独立に音量を BGM_GAIN まで下げる)
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = BGM_GAIN;
    this.bgmGain.connect(this.masterGain);

    // ダンス BGM 専用ゲイン (ducking の対象外、独立に再生制御)
    this.danceBgmGain = this.ctx.createGain();
    this.danceBgmGain.gain.value = DANCE_BGM_GAIN;
    this.danceBgmGain.connect(this.masterGain);

    if (this.ctx.state === "suspended") await this.ctx.resume();

    // 全音源を非同期 decode (UI ブロックしない)
    void this.preloadAll();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain) this.masterGain.gain.value = muted ? 0 : 1.0;
    localStorage.setItem(STORAGE_KEYS.AUDIO_MUTED, muted ? "1" : "0");
  }

  isMuted(): boolean {
    return this.muted;
  }

  private async preloadAll(): Promise<void> {
    if (!this.ctx) return;
    const base = import.meta.env.BASE_URL;
    const tasks: Promise<void>[] = [];
    for (const [key, file] of Object.entries(SOUND_FILES) as Array<[SoundKey, string]>) {
      tasks.push(this.loadBuffer(`${base}assets/audio/${file}`).then((buf) => {
        if (buf) this.buffers[key] = buf;
      }));
    }
    tasks.push(this.loadBuffer(`${base}assets/audio/${BGM_FILE}`).then((buf) => {
      this.bgmBuffer = buf;
    }));
    tasks.push(this.loadBuffer(`${base}assets/audio/${DANCE_BGM_FILE}`).then((buf) => {
      this.danceBgmBuffer = buf;
    }));
    await Promise.all(tasks);
    // BGM の startBgm() が decode 未完で空振りしていた場合、ここで遅延再生
    if (this.bgmPendingStart && this.bgmBuffer && this.bgmSource === null) {
      this.bgmPendingStart = false;
      this.startBgm();
    }
  }

  private async loadBuffer(url: string): Promise<AudioBuffer | null> {
    if (!this.ctx) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const arr = await res.arrayBuffer();
      return await this.ctx.decodeAudioData(arr);
    } catch {
      return null;
    }
  }

  private playBuffer(key: SoundKey, gainScale = 1): void {
    const buf = this.buffers[key];
    if (!this.ctx || !this.masterGain || !buf) {
      // フォールバック: decode 未完了 → 短い合成音
      this.fallbackTone(key);
      return;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = SE_GAIN * gainScale;
    src.connect(g).connect(this.masterGain);
    src.start(0);
  }

  /** decode 未完了時の保険: Phase 5-C 以前の合成音を簡易再現 */
  private fallbackTone(key: SoundKey): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const cfg: Record<SoundKey, { f: number; type: OscillatorType; dur: number }> = {
      pickup: { f: 900, type: "sine", dur: 0.1 },
      missionClear: { f: 660, type: "triangle", dur: 0.3 },
      jump: { f: 520, type: "square", dur: 0.12 },
      land: { f: 180, type: "sine", dur: 0.1 },
      dialogNext: { f: 440, type: "sine", dur: 0.05 },
      dialogOpen: { f: 660, type: "sine", dur: 0.08 },
    };
    const c = cfg[key];
    osc.type = c.type;
    osc.frequency.setValueAtTime(c.f, now);
    g.gain.setValueAtTime(0.2, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + c.dur);
    osc.connect(g).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + c.dur + 0.02);
  }

  // ─── 公開 SE API ───
  jumpSE(): void { this.playBuffer("jump"); }
  landSE(): void { this.playBuffer("land", 0.7); }
  pickupSE(): void { this.playBuffer("pickup"); }
  missionClearSE(): void { this.playBuffer("missionClear", 1.1); }
  dialogSE(): void { this.playBuffer("dialogNext", 0.6); }
  dialogOpenSE(): void { this.playBuffer("dialogOpen", 0.8); }

  /**
   * BGM ループ再生開始。bgmBuffer が未 decode の場合は `bgmPendingStart` を
   * 立てて return し、preloadAll() 完了時に自動的に再生開始する (BGM サイレント
   * 化を防ぐ)。
   */
  startBgm(): void {
    if (!this.ctx || !this.bgmGain || this.bgmSource !== null) return;
    if (!this.bgmBuffer) {
      this.bgmPendingStart = true;
      return;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.bgmBuffer;
    src.loop = true;
    src.connect(this.bgmGain);
    src.start(0);
    this.bgmSource = src;
  }

  stopBgm(): void {
    this.bgmPendingStart = false;
    if (this.bgmSource) {
      try { this.bgmSource.stop(0); } catch { /* already stopped */ }
      this.bgmSource.disconnect();
      this.bgmSource = null;
    }
  }

  /**
   * ダンス BGM 開始 (ループ再生)。同時に村 BGM を ducking (gain を下げる)。
   * 既に再生中なら一度停止して頭から再開する (Player の連打リスタートに合わせる)。
   */
  startDanceBgm(): void {
    if (!this.ctx || !this.danceBgmGain || !this.danceBgmBuffer) return;
    // 連打リスタート: 既存 source を止めてから新しく作る
    if (this.danceBgmSource) {
      try { this.danceBgmSource.stop(0); } catch { /* already stopped */ }
      this.danceBgmSource.disconnect();
      this.danceBgmSource = null;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.danceBgmBuffer;
    src.loop = true;
    src.connect(this.danceBgmGain);
    src.start(0);
    this.danceBgmSource = src;

    // ducking: 村 BGM をほぼ消す
    if (this.bgmGain) {
      this.bgmGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.bgmGain.gain.setTargetAtTime(VILLAGE_DUCK_GAIN, this.ctx.currentTime, 0.1);
    }
  }

  stopDanceBgm(): void {
    if (this.danceBgmSource) {
      try { this.danceBgmSource.stop(0); } catch { /* already stopped */ }
      this.danceBgmSource.disconnect();
      this.danceBgmSource = null;
    }
    // 村 BGM を元の音量に復帰
    if (this.ctx && this.bgmGain) {
      this.bgmGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.bgmGain.gain.setTargetAtTime(BGM_GAIN, this.ctx.currentTime, 0.2);
    }
  }

  dispose(): void {
    this.stopBgm();
    this.stopDanceBgm();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
