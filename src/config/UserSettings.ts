/**
 * ユーザー設定 (Stage 2 / 2026-05-13)。
 *
 * - マウス感度 X / Y (倍率、デフォルト 1.0、範囲 0.2..3.0)
 * - Y 軸反転 (boolean)
 * - BGM 音量倍率 (0..1、デフォルト 1.0、AudioManager の BGM_GAIN への係数)
 * - SE 音量倍率 (0..1、デフォルト 1.0、AudioManager の SE_GAIN への係数)
 * - 既存 `muted` (mute トグル) もここに集約 (gameConfig.STORAGE_KEYS.AUDIO_MUTED 互換)
 *
 * **設計方針**:
 * - シングルトン (UserSettings.instance) で全箇所からアクセス
 * - 設定変更時は localStorage に即時保存 + observer (`onChange`) 経由で各 consumer
 *   (AudioManager / Camera / KeyboardMouseInput) に通知
 * - mute だけは旧キー `tadakayo-game.audioMuted` を維持して後方互換 (前バージョン
 *   からの設定保持)、他は新 prefix `tadakayo-game.settings.*`
 *
 * Game Accessibility Guidelines:
 * - Allow camera sensitivity to be adjusted independently per axis
 * - Allow camera axis to be inverted
 * - Remember settings between sessions
 */

import { STORAGE_KEYS } from "./gameConfig";

const STORAGE_PREFIX = "tadakayo-game.settings.";

export interface UserSettingsValues {
  /** マウス感度 X (倍率): 0.2 = 弱、1.0 = 既定、3.0 = 強 */
  sensitivityX: number;
  /** マウス感度 Y (倍率): 0.2..3.0 */
  sensitivityY: number;
  /** Y 軸反転: true なら上下のマウス移動でカメラ pitch が反転 */
  invertY: boolean;
  /** BGM 音量倍率: 0..1。AudioManager の base BGM_GAIN にこれを掛ける */
  bgmVolume: number;
  /** SE 音量倍率: 0..1。AudioManager の base SE_GAIN にこれを掛ける */
  seVolume: number;
  /** mute トグル (全音 OFF)。volume とは独立 (mute=true 中も volume は保持) */
  muted: boolean;
}

export const DEFAULT_SETTINGS: Readonly<UserSettingsValues> = Object.freeze({
  sensitivityX: 1.0,
  sensitivityY: 1.0,
  invertY: false,
  bgmVolume: 1.0,
  seVolume: 1.0,
  muted: false,
});

export const SETTINGS_LIMITS = {
  sensitivityMin: 0.2,
  sensitivityMax: 3.0,
  volumeMin: 0,
  volumeMax: 1,
} as const;

type Listener = (s: Readonly<UserSettingsValues>) => void;

export class UserSettings {
  private static _instance: UserSettings | null = null;
  static get instance(): UserSettings {
    if (this._instance === null) this._instance = new UserSettings();
    return this._instance;
  }

  /** ユニットテスト用にシングルトンを破棄 (本番コードでは使わない) */
  static _reset(): void {
    this._instance = null;
  }

  private values: UserSettingsValues;
  private listeners: Listener[] = [];

  private constructor() {
    this.values = this.load();
    // codex review #1 補強: load で clamp / fallback が発生した不正値を localStorage 側にも
    // 反映させる (in-memory だけ正しい状態を残さず、次回起動も正常化されるようにする)。
    this.persist(this.values);
  }

  /** 現在値の不変スナップショット (consumer は破壊しないこと) */
  get current(): Readonly<UserSettingsValues> {
    return this.values;
  }

  /** 部分更新 (1 つ以上のキーを更新)。永続化 + listeners 発火 */
  update(patch: Partial<UserSettingsValues>): void {
    const next: UserSettingsValues = { ...this.values, ...this.clampPatch(patch) };
    // 変化がなければ何もしない (perf + 不要 listener 抑制)
    if (this.equals(this.values, next)) return;
    this.values = next;
    this.persist(next);
    for (const l of this.listeners) l(next);
  }

  /** デフォルトに戻す (mute は維持) */
  resetToDefaults(): void {
    const keptMuted = this.values.muted;
    this.update({ ...DEFAULT_SETTINGS, muted: keptMuted });
  }

  /** 値変化時のコールバック登録。返り値は解除関数 */
  onChange(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  // ───────── private ─────────

  private clampPatch(patch: Partial<UserSettingsValues>): Partial<UserSettingsValues> {
    const out: Partial<UserSettingsValues> = {};
    if (patch.sensitivityX !== undefined) {
      out.sensitivityX = this.clamp(
        patch.sensitivityX,
        SETTINGS_LIMITS.sensitivityMin,
        SETTINGS_LIMITS.sensitivityMax,
      );
    }
    if (patch.sensitivityY !== undefined) {
      out.sensitivityY = this.clamp(
        patch.sensitivityY,
        SETTINGS_LIMITS.sensitivityMin,
        SETTINGS_LIMITS.sensitivityMax,
      );
    }
    if (patch.invertY !== undefined) out.invertY = Boolean(patch.invertY);
    if (patch.bgmVolume !== undefined) {
      out.bgmVolume = this.clamp(
        patch.bgmVolume,
        SETTINGS_LIMITS.volumeMin,
        SETTINGS_LIMITS.volumeMax,
      );
    }
    if (patch.seVolume !== undefined) {
      out.seVolume = this.clamp(
        patch.seVolume,
        SETTINGS_LIMITS.volumeMin,
        SETTINGS_LIMITS.volumeMax,
      );
    }
    if (patch.muted !== undefined) out.muted = Boolean(patch.muted);
    return out;
  }

  private clamp(v: number, min: number, max: number): number {
    if (!Number.isFinite(v)) return min;
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  private equals(a: UserSettingsValues, b: UserSettingsValues): boolean {
    return (
      a.sensitivityX === b.sensitivityX &&
      a.sensitivityY === b.sensitivityY &&
      a.invertY === b.invertY &&
      a.bgmVolume === b.bgmVolume &&
      a.seVolume === b.seVolume &&
      a.muted === b.muted
    );
  }

  private load(): UserSettingsValues {
    // mute は旧キー (gameConfig.STORAGE_KEYS.AUDIO_MUTED) を継続使用 (後方互換)
    const muted = safeGetItem(STORAGE_KEYS.AUDIO_MUTED) === "1";
    // codex review #1 対応: 既存 storage に不正値 (例 bgmVolume=999) が入っていても
    // load 時に clamp して安全な範囲に強制矯正する
    return {
      sensitivityX: this.loadNumber(
        "sensitivityX",
        DEFAULT_SETTINGS.sensitivityX,
        SETTINGS_LIMITS.sensitivityMin,
        SETTINGS_LIMITS.sensitivityMax,
      ),
      sensitivityY: this.loadNumber(
        "sensitivityY",
        DEFAULT_SETTINGS.sensitivityY,
        SETTINGS_LIMITS.sensitivityMin,
        SETTINGS_LIMITS.sensitivityMax,
      ),
      invertY: this.loadBool("invertY", DEFAULT_SETTINGS.invertY),
      bgmVolume: this.loadNumber(
        "bgmVolume",
        DEFAULT_SETTINGS.bgmVolume,
        SETTINGS_LIMITS.volumeMin,
        SETTINGS_LIMITS.volumeMax,
      ),
      seVolume: this.loadNumber(
        "seVolume",
        DEFAULT_SETTINGS.seVolume,
        SETTINGS_LIMITS.volumeMin,
        SETTINGS_LIMITS.volumeMax,
      ),
      muted,
    };
  }

  private loadNumber(
    key: keyof UserSettingsValues,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const raw = safeGetItem(STORAGE_PREFIX + key);
    if (raw === null) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    return this.clamp(parsed, min, max);
  }

  private loadBool(key: keyof UserSettingsValues, fallback: boolean): boolean {
    const raw = safeGetItem(STORAGE_PREFIX + key);
    if (raw === null) return fallback;
    return raw === "1";
  }

  private persist(v: UserSettingsValues): void {
    // mute は旧キー、他は STORAGE_PREFIX を付ける
    safeSetItem(STORAGE_KEYS.AUDIO_MUTED, v.muted ? "1" : "0");
    safeSetItem(STORAGE_PREFIX + "sensitivityX", String(v.sensitivityX));
    safeSetItem(STORAGE_PREFIX + "sensitivityY", String(v.sensitivityY));
    safeSetItem(STORAGE_PREFIX + "invertY", v.invertY ? "1" : "0");
    safeSetItem(STORAGE_PREFIX + "bgmVolume", String(v.bgmVolume));
    safeSetItem(STORAGE_PREFIX + "seVolume", String(v.seVolume));
  }
}

/**
 * codex review #1 対応: localStorage アクセス全てを例外安全にする。
 * - SSR / test 環境で `localStorage` undefined → null 返却
 * - プライベートブラウジング / disabled storage → null 返却 (例外回避)
 * - QuotaExceededError → 黙って無視 (設定の損失は許容、ゲーム継続を優先)
 *
 * 例外メッセージは console.warn でログ出力するが、ゲーム本体を止めない。
 */
function safeGetItem(key: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  } catch (e) {
    console.warn(`[UserSettings] localStorage.getItem(${key}) failed:`, e);
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, value);
  } catch (e) {
    // QuotaExceededError / SecurityError 等。設定永続化は諦め、in-memory のみ動作継続。
    console.warn(`[UserSettings] localStorage.setItem(${key}) failed:`, e);
  }
}
