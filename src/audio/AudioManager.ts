import { STORAGE_KEYS } from "../config/gameConfig";
import { UserSettings } from "../config/UserSettings";

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

  /** Stage 2: UserSettings.onChange の解除関数 (dispose 時に呼ぶ) */
  private settingsUnsub: (() => void) | null = null;

  /**
   * iOS Safari silent switch bypass 用 HTMLAudioElement。
   * 端末側面のサイレントスイッチが ON の場合、AudioContext は「ambient」セッション
   * カテゴリでミュートされる。`<audio playsinline>` を一度 play() するとセッションが
   * 「playback」に切り替わり、silent switch ON でも音が再生される (iOS 慣用 hack)。
   */
  private htmlAudioUnlock: HTMLAudioElement | null = null;

  constructor() {
    // mute は旧キーを直接読む (UserSettings も同じキーを参照するため両者は一致)
    const stored = localStorage.getItem(STORAGE_KEYS.AUDIO_MUTED);
    this.muted = stored === "1";
  }

  async ensureStarted(): Promise<void> {
    // iOS Safari silent switch bypass: user gesture 同期内で <audio playsinline> を
    // play() し、オーディオセッションを ambient → playback に切り替える。
    // **必ず AudioContext 生成より先に実行する** (順序が逆だとセッション切替が効かない端末あり)。
    this.startHtmlAudioUnlock();

    if (this.ctx) {
      // 再エントリ (タイトル復帰など) で suspended なら resume を await する。
      // PR #73 で void に変えたが、preloadAll 後の startBgm() 時点で suspended の
      // ままだと source.start() が無音化する端末があり、await で確実に running まで待つ。
      if (this.ctx.state === "suspended") {
        try { await this.ctx.resume(); } catch { /* ignore */ }
      }
      return;
    }
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();

    // iOS Safari unlock: AudioContext 生成直後に user gesture 同期内で 1 サンプルの
    // 無音 buffer を start() することで「unlocked」状態へ遷移させる。
    // - sampleRate は **必ず ctx.sampleRate に合わせる** (22050 固定だと一部端末で
    //   ratio 不一致により start() が無視されるケースあり、PR #73 補強)
    // - 副作用: Android / Desktop ではただの no-op
    try {
      const silent = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      const src = this.ctx.createBufferSource();
      src.buffer = silent;
      src.connect(this.ctx.destination);
      src.start(0);
    } catch {
      /* unlock 失敗時は通常パスで継続 */
    }

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 1.0;
    this.masterGain.connect(this.ctx.destination);

    // Stage 2: UserSettings の bgmVolume / seVolume を BGM_GAIN / SE_GAIN に乗じる
    const s = UserSettings.instance.current;
    // BGM 専用ゲイン (mute と独立に音量を BGM_GAIN まで下げる)
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = BGM_GAIN * s.bgmVolume;
    this.bgmGain.connect(this.masterGain);

    // ダンス BGM 専用ゲイン (ducking の対象外、独立に再生制御)
    this.danceBgmGain = this.ctx.createGain();
    this.danceBgmGain.gain.value = DANCE_BGM_GAIN * s.bgmVolume;
    this.danceBgmGain.connect(this.masterGain);

    // Stage 2: 設定変化を BGM / ダンス BGM gain にリアルタイム反映 (SE は playBuffer 時に都度読む)
    // mute も同期: 設定パネルから別経路で muted が変わった場合に master gain を追従させる
    this.settingsUnsub = UserSettings.instance.onChange((ns) => {
      this.applyVolumeSettings(ns.bgmVolume);
      if (ns.muted !== this.muted) {
        this.muted = ns.muted;
        if (this.masterGain) this.masterGain.gain.value = ns.muted ? 0 : 1.0;
      }
    });

    // PR #73 では void にしていたが、preloadAll() 完了時 (= 最初の音再生時) に
    // suspended のまま source.start() が呼ばれて無音化するケースがあるため await に
    // 戻す。silent buffer unlock は既に上で同期実行済みで user gesture を消費しているので、
    // ここでの await は user gesture 切れ問題を起こさない (running 移行を待つだけ)。
    if (this.ctx.state === "suspended") {
      try { await this.ctx.resume(); } catch { /* ignore */ }
    }

    // 全音源を非同期 decode (UI ブロックしない)
    void this.preloadAll();
  }

  /**
   * iOS Safari silent switch bypass.
   *
   * 端末側面のサイレントスイッチが ON の場合、Safari の AudioContext は
   * 「ambient」セッションカテゴリで強制ミュートされる (Web Audio がスピーカーから
   * 出ない)。これを回避するには、user gesture 同期内で `<audio playsinline>` を
   * 1 度 play() してオーディオセッションを「playback」カテゴリへ昇格させる必要がある。
   *
   * - silent.mp3 (0.1 秒, 32kbps 無音 MP3, 748 bytes) を src に使用 (data URL より
   *   Safari の互換性が高い)
   * - volume は 1.0 のまま (中身が無音なのでスピーカーには何も出ない)
   * - **複数回呼ばれても 1 回しか走らない** (htmlAudioUnlock が non-null チェック)
   * - 失敗時は静かに無視 (AudioContext unlock 単独でも動く端末は多い)
   */
  private startHtmlAudioUnlock(): void {
    if (this.htmlAudioUnlock) return;
    try {
      const el = document.createElement("audio");
      // iOS Safari 必須属性
      el.setAttribute("playsinline", "");
      el.setAttribute("webkit-playsinline", "");
      el.preload = "auto";
      const base = import.meta.env.BASE_URL;
      el.src = `${base}assets/audio/silent.mp3`;
      el.loop = false;
      const p = el.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          // 再生に成功したら一旦止めて待機 (セッションカテゴリは既に変更済)
          try { el.pause(); el.currentTime = 0; } catch { /* ignore */ }
        }).catch(() => { /* user gesture 外なら NotAllowedError、無視 */ });
      }
      this.htmlAudioUnlock = el;
    } catch {
      /* element 作成自体が失敗するケースは無視 */
    }
  }

  /** Stage 2: BGM 系 gain に bgmVolume 係数を反映 (ducking 中は VILLAGE_DUCK_GAIN を優先) */
  private applyVolumeSettings(bgmVolume: number): void {
    if (!this.ctx) return;
    const ducking = this.danceBgmSource !== null;
    if (this.bgmGain) {
      const target = ducking ? VILLAGE_DUCK_GAIN * bgmVolume : BGM_GAIN * bgmVolume;
      this.bgmGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.bgmGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
    }
    if (this.danceBgmGain) {
      this.danceBgmGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.danceBgmGain.gain.setTargetAtTime(
        DANCE_BGM_GAIN * bgmVolume,
        this.ctx.currentTime,
        0.05,
      );
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain) this.masterGain.gain.value = muted ? 0 : 1.0;
    // Stage 2: localStorage 書き込みは UserSettings 経由に一元化 (STORAGE_KEYS.AUDIO_MUTED へ
    // 旧キー互換で同じ値が書かれる)。直接 localStorage.setItem しないことで、設定パネルの
    // スライダー値と整合が崩れるのを防ぐ。
    UserSettings.instance.update({ muted });
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
    // iOS Safari セーフティネット: suspended のまま start() すると無音化するため
    // resume を fire-and-forget で試す
    if (this.ctx.state === "suspended") void this.ctx.resume();
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    // Stage 2: SE 音量倍率 (UserSettings.seVolume) を再生時に都度読む。一過性 source
    // のため onChange 監視不要、最新値を都度反映するだけで十分。
    g.gain.value = SE_GAIN * gainScale * UserSettings.instance.current.seVolume;
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
    // iOS Safari セーフティネット: 何らかの理由で suspended のまま到達した場合、
    // resume を fire-and-forget で試す (no-op が安全)。
    if (this.ctx.state === "suspended") void this.ctx.resume();
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

    // ducking: 村 BGM をほぼ消す (Stage 2: bgmVolume 倍率を反映)
    if (this.bgmGain) {
      const bgmVol = UserSettings.instance.current.bgmVolume;
      this.bgmGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.bgmGain.gain.setTargetAtTime(VILLAGE_DUCK_GAIN * bgmVol, this.ctx.currentTime, 0.1);
    }
  }

  stopDanceBgm(): void {
    if (this.danceBgmSource) {
      try { this.danceBgmSource.stop(0); } catch { /* already stopped */ }
      this.danceBgmSource.disconnect();
      this.danceBgmSource = null;
    }
    // 村 BGM を元の音量に復帰 (Stage 2: bgmVolume 倍率を反映)
    if (this.ctx && this.bgmGain) {
      const bgmVol = UserSettings.instance.current.bgmVolume;
      this.bgmGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.bgmGain.gain.setTargetAtTime(BGM_GAIN * bgmVol, this.ctx.currentTime, 0.2);
    }
  }

  dispose(): void {
    if (this.settingsUnsub) {
      this.settingsUnsub();
      this.settingsUnsub = null;
    }
    this.stopBgm();
    this.stopDanceBgm();
    if (this.htmlAudioUnlock) {
      try { this.htmlAudioUnlock.pause(); } catch { /* ignore */ }
      this.htmlAudioUnlock.removeAttribute("src");
      this.htmlAudioUnlock = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
