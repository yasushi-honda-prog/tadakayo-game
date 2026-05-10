import { STORAGE_KEYS } from "../config/gameConfig";

/**
 * SE/BGM の再生管理。
 *
 * Phase 5-D 改修: 外部フリー素材 (kenney.nl Interface Sounds + Music Jingles, CC0)
 * を Web Audio で decode して再生する。decode 失敗時は内部合成 fallback。
 *
 * 素材クレジット:
 * - SE: Kenney Interface Sounds (CC0, kenney.nl)
 * - BGM: Kenney Music Jingles - Pizzicato (CC0, kenney.nl)
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

const SE_GAIN = 0.55;
const BGM_GAIN = 0.22; // BGM は控えめ (SE 聞こえやすく)

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private muted = false;
  private buffers: Partial<Record<SoundKey, AudioBuffer>> = {};
  private bgmBuffer: AudioBuffer | null = null;
  private bgmSource: AudioBufferSourceNode | null = null;

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
    await Promise.all(tasks);
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
   * BGM ループ再生開始。bgmBuffer が未 decode なら何もしない (preloadAll が
   * 完了次第、次の startBgm() で再生される)。
   */
  startBgm(): void {
    if (!this.ctx || !this.bgmGain || !this.bgmBuffer || this.bgmSource !== null) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.bgmBuffer;
    src.loop = true;
    src.connect(this.bgmGain);
    src.start(0);
    this.bgmSource = src;
  }

  stopBgm(): void {
    if (this.bgmSource) {
      try { this.bgmSource.stop(0); } catch { /* already stopped */ }
      this.bgmSource.disconnect();
      this.bgmSource = null;
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
