/**
 * プレイ記録ストア (Stage 3 / 2026-05-13、Firestore + localStorage ハイブリッド版)。
 *
 * - `bestTimeSec`: 自己ベストクリアタイム (秒)。初回は null
 * - `bestStars`: 自己ベスト星評価 (0-5)。初回は 0
 * - `playCount`: 累計クリア回数
 *
 * **データソース戦略**:
 * 1. **起動時**: localStorage から即座に値復元 → 同期的に `current` で UI に渡せる
 * 2. **非同期で Firebase 初期化**: Anonymous Auth + Firestore fetch
 *    - クラウドに記録あり: localStorage に上書き反映 + listener 通知 (UI 再描画)
 *    - クラウドに記録なし + localStorage に記録あり: クラウドへマイグレート (初回 upsert)
 * 3. **`recordPlay` 呼出時**: in-memory + localStorage を **同期的に** 更新し RecordResult を即返却。
 *    クラウド upsert は fire-and-forget (失敗してもゲーム続行)
 * 4. **オフライン / Firebase 未設定 / 認証失敗**: localStorage のみで動作
 *
 * **設計判断**:
 * - `recordPlay` の戻り値を Promise 化しなかった理由: UI (ScoreScreen.show) は即座にレンダリング
 *   する必要があり、クラウド upsert の完了を待たせると ScoreScreen 表示が数百 ms 遅れる
 * - クラウド fetch 完了で表示が更新される場合があるため、ScoreScreen 表示中も `onChange`
 *   listener で再描画できるようにする (ScoreScreen 側は purely passive)
 */

const STORAGE_PREFIX = "tadakayo-game.record.";

export interface GameRecordValues {
  bestTimeSec: number | null;
  bestStars: number;
  playCount: number;
}

export const DEFAULT_RECORD: Readonly<GameRecordValues> = Object.freeze({
  bestTimeSec: null,
  bestStars: 0,
  playCount: 0,
});

export interface RecordResult {
  isNewBestTime: boolean;
  isNewBestStars: boolean;
  prevBestTimeSec: number | null;
}

type Listener = (v: Readonly<GameRecordValues>) => void;

export class GameRecord {
  private static _instance: GameRecord | null = null;
  static get instance(): GameRecord {
    if (this._instance === null) this._instance = new GameRecord();
    return this._instance;
  }

  static _reset(): void {
    this._instance = null;
  }

  private values: GameRecordValues;
  private listeners: Listener[] = [];
  /** Firebase 連動の状態。null = 未初期化 / 初期化失敗 / 認証なし */
  private firebaseUid: string | null = null;
  // FirebaseService への参照は循環依存回避のため `any` 型でも問題ないが、
  // TypeScript 的に明示するため import 型を late-binding する
  private firebaseService: {
    uid: string | null;
    fetchRecord(uid: string): Promise<GameRecordValues | null>;
    upsertRecord(uid: string, v: GameRecordValues): Promise<boolean>;
  } | null = null;

  private constructor() {
    // 同期: localStorage から即時復元 (UI が即値を取れるように)
    this.values = this.load();
    this.persist(this.values); // load 時 clamp/fallback 結果を storage 側にも反映
    // 非同期: Firebase init + クラウド同期 (失敗してもゲーム継続)
    void this.initCloud();
  }

  get current(): Readonly<GameRecordValues> {
    return this.values;
  }

  /** クラウド同期完了済みか (ScoreScreen が「クラウド同期中…」表示判断に使える) */
  get isCloudReady(): boolean {
    return this.firebaseUid !== null;
  }

  /**
   * 新規プレイクリアを記録 (synchronous)。
   * クラウド upsert は fire-and-forget でバックグラウンド実行。
   */
  recordPlay(elapsedSec: number, stars: number): RecordResult {
    const prevBestTimeSec = this.values.bestTimeSec;
    const prevBestStars = this.values.bestStars;

    if (!Number.isFinite(elapsedSec) || elapsedSec <= 0) {
      // 不正値は記録せず playCount も増やさない
      return { isNewBestTime: false, isNewBestStars: false, prevBestTimeSec };
    }
    const clampedStars = Math.max(0, Math.min(5, Math.floor(stars)));

    const isNewBestTime = prevBestTimeSec === null || elapsedSec < prevBestTimeSec;
    const isNewBestStars = clampedStars > prevBestStars;

    const next: GameRecordValues = {
      bestTimeSec: isNewBestTime ? elapsedSec : prevBestTimeSec,
      bestStars: Math.max(prevBestStars, clampedStars),
      playCount: this.values.playCount + 1,
    };
    this.values = next;
    this.persist(next);
    for (const l of this.listeners) l(next);

    // fire-and-forget でクラウド upsert
    void this.upsertCloud();
    return { isNewBestTime, isNewBestStars, prevBestTimeSec };
  }

  clear(): void {
    this.values = { ...DEFAULT_RECORD };
    this.persist(this.values);
    for (const l of this.listeners) l(this.values);
    void this.upsertCloud();
  }

  onChange(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  // ───────── private ─────────

  private async initCloud(): Promise<void> {
    try {
      const { FirebaseService } = await import("./firebase");
      const svc = await FirebaseService.create();
      if (svc === null || svc.uid === null) return; // 接続情報なし or 認証失敗
      this.firebaseService = svc;
      this.firebaseUid = svc.uid;
      const cloud = await svc.fetchRecord(svc.uid);
      if (cloud !== null) {
        // クラウド優先マージ: ベスト記録は最良値、playCount はクラウドの方が信頼できる
        // (別端末でプレイしたなら累計に含めるべき)。但しローカルが新規記録した直後の
        // タイミングで上書きを避けるため、ベスト値が異なる場合のみ merge して通知
        const merged: GameRecordValues = {
          bestTimeSec: pickBestTime(this.values.bestTimeSec, cloud.bestTimeSec),
          bestStars: Math.max(this.values.bestStars, cloud.bestStars),
          playCount: Math.max(this.values.playCount, cloud.playCount),
        };
        if (!recordsEqual(merged, this.values)) {
          this.values = merged;
          this.persist(merged);
          for (const l of this.listeners) l(merged);
        }
        // 万一クラウド側が古ければ merged で更新
        if (!recordsEqual(merged, cloud)) {
          await svc.upsertRecord(svc.uid, merged);
        }
      } else if (this.values.playCount > 0) {
        // クラウドに記録なし + ローカルに記録あり → 初回マイグレート
        await svc.upsertRecord(svc.uid, this.values);
      }
    } catch (e) {
      console.warn("[GameRecord] cloud init failed, using localStorage only:", e);
    }
  }

  private async upsertCloud(): Promise<void> {
    if (this.firebaseService === null || this.firebaseUid === null) return;
    await this.firebaseService.upsertRecord(this.firebaseUid, this.values);
  }

  private load(): GameRecordValues {
    const bestTimeRaw = safeGetItem(STORAGE_PREFIX + "bestTimeSec");
    let bestTimeSec: number | null = null;
    if (bestTimeRaw !== null) {
      const n = Number(bestTimeRaw);
      if (Number.isFinite(n) && n > 0) bestTimeSec = n;
    }
    const bestStars = this.loadNumber("bestStars", DEFAULT_RECORD.bestStars, 0, 5);
    const playCount = this.loadNumber(
      "playCount",
      DEFAULT_RECORD.playCount,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    return { bestTimeSec, bestStars, playCount };
  }

  private loadNumber(
    key: keyof GameRecordValues,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const raw = safeGetItem(STORAGE_PREFIX + key);
    if (raw === null) return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback;
    if (n < min) return min;
    if (n > max) return max;
    return Math.floor(n);
  }

  private persist(v: GameRecordValues): void {
    if (v.bestTimeSec === null) {
      safeRemoveItem(STORAGE_PREFIX + "bestTimeSec");
    } else {
      safeSetItem(STORAGE_PREFIX + "bestTimeSec", String(v.bestTimeSec));
    }
    safeSetItem(STORAGE_PREFIX + "bestStars", String(v.bestStars));
    safeSetItem(STORAGE_PREFIX + "playCount", String(v.playCount));
  }
}

/** ベストタイム選択: null は「未記録」、有限正数のうち小さい方を採用 */
function pickBestTime(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

function recordsEqual(a: GameRecordValues, b: GameRecordValues): boolean {
  return (
    a.bestTimeSec === b.bestTimeSec &&
    a.bestStars === b.bestStars &&
    a.playCount === b.playCount
  );
}

// localStorage 例外安全アクセサ (UserSettings と同等)
function safeGetItem(key: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  } catch (e) {
    console.warn(`[GameRecord] localStorage.getItem(${key}) failed:`, e);
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`[GameRecord] localStorage.setItem(${key}) failed:`, e);
  }
}

function safeRemoveItem(key: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(key);
  } catch (e) {
    console.warn(`[GameRecord] localStorage.removeItem(${key}) failed:`, e);
  }
}
