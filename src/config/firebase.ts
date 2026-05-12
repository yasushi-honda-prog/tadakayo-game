/**
 * Firebase 初期化 + Anonymous Auth + Firestore CRUD ヘルパー (Stage 3 / 2026-05-13)。
 *
 * **責務**:
 * - `import.meta.env.VITE_FIREBASE_*` から接続情報を読み込み、Firebase アプリを初期化
 * - 起動時に `signInAnonymously` で匿名 UID を取得 (永続セッション)
 * - `gameRecords/{uid}` ドキュメントの取得・upsert を提供
 *
 * **責務外**:
 * - GameRecord の値整形・記録判定 (recordPlay の制御は GameRecord.ts 側)
 *
 * **エラー方針**:
 * - 初期化失敗・認証失敗・Firestore I/O 失敗は throw せず `null` を返し、ゲーム本体は
 *   localStorage で継続可能にする (グレースフル劣化)
 * - 失敗は console.warn でロギング
 *
 * **バンドル戦略**:
 * - 本モジュールは `GameRecord` の constructor から dynamic import される (`await import(...)`).
 *   これにより firebase SDK ~250KB が initial bundle に含まれず、初期表示が軽くなる。
 */

import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  type Auth,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";

export interface GameRecordCloudValues {
  bestTimeSec: number | null;
  bestStars: number;
  playCount: number;
}

/**
 * Vite が VITE_FIREBASE_* env から構築する Firebase 接続情報。
 * 全キーが揃わない場合は Firebase 初期化を諦めて null を返す (ローカル開発フォールバック)。
 */
function readFirebaseConfig(): {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
} | null {
  const env = import.meta.env as Record<string, string | undefined>;
  const apiKey = env.VITE_FIREBASE_API_KEY;
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  const storageBucket = env.VITE_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID;
  const appId = env.VITE_FIREBASE_APP_ID;
  // placeholder のままなら未設定扱い
  if (
    !apiKey ||
    apiKey === "__SET_ME__" ||
    !authDomain ||
    !projectId ||
    !storageBucket ||
    !messagingSenderId ||
    !appId
  ) {
    return null;
  }
  return { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId };
}

export class FirebaseService {
  private readonly auth: Auth;
  private readonly db: Firestore;
  private currentUid: string | null = null;
  private readyResolver: ((uid: string | null) => void) | null = null;
  private readonly readyPromise: Promise<string | null>;

  private constructor(app: FirebaseApp) {
    // app 参照は不要なので保持しない (getAuth/getFirestore は default app に解決)。
    // 将来 Storage や Functions を使う際に this.app として保持し直すこと。
    this.auth = getAuth(app);
    this.db = getFirestore(app);
    this.readyPromise = new Promise<string | null>((resolve) => {
      this.readyResolver = resolve;
    });
    onAuthStateChanged(this.auth, (user) => {
      this.currentUid = user?.uid ?? null;
      if (this.readyResolver !== null) {
        this.readyResolver(this.currentUid);
        this.readyResolver = null;
      }
    });
  }

  /**
   * Firebase を初期化して Anonymous Auth を開始。
   * 接続情報未設定 / 初期化失敗時は null を返し、呼出側は localStorage のみで動作する。
   */
  static async create(): Promise<FirebaseService | null> {
    const cfg = readFirebaseConfig();
    if (cfg === null) {
      console.info(
        "[Firebase] VITE_FIREBASE_* env が未設定のため初期化スキップ (localStorage のみで動作)",
      );
      return null;
    }
    try {
      const app = initializeApp(cfg);
      const service = new FirebaseService(app);
      // Anonymous Auth トリガ (onAuthStateChanged が ready Promise を解決)
      await signInAnonymously(service.auth);
      // ready Promise を待って uid を確定 (await 中に onAuthStateChanged コールバックが
      // 解決済になるはず)
      const uid = await service.readyPromise;
      if (uid === null) {
        console.warn("[Firebase] Anonymous Auth は成功したが uid が取れない");
        return null;
      }
      return service;
    } catch (e) {
      console.warn("[Firebase] 初期化に失敗、localStorage のみで動作:", e);
      return null;
    }
  }

  get uid(): string | null {
    return this.currentUid;
  }

  /** `gameRecords/{uid}` ドキュメントを取得。存在しなければ null。 */
  async fetchRecord(uid: string): Promise<GameRecordCloudValues | null> {
    try {
      const snap = await getDoc(doc(this.db, "gameRecords", uid));
      if (!snap.exists()) return null;
      const data = snap.data();
      const bestTimeSec =
        typeof data.bestTimeSec === "number" && Number.isFinite(data.bestTimeSec) && data.bestTimeSec > 0
          ? data.bestTimeSec
          : null;
      const bestStars =
        typeof data.bestStars === "number" && Number.isFinite(data.bestStars)
          ? Math.max(0, Math.min(5, Math.floor(data.bestStars)))
          : 0;
      const playCount =
        typeof data.playCount === "number" && Number.isFinite(data.playCount) && data.playCount >= 0
          ? Math.floor(data.playCount)
          : 0;
      return { bestTimeSec, bestStars, playCount };
    } catch (e) {
      console.warn("[Firebase] fetchRecord 失敗:", e);
      return null;
    }
  }

  /**
   * `gameRecords/{uid}` ドキュメントを upsert (merge:true)。
   * 失敗時は false を返し、ゲーム本体は継続。
   */
  async upsertRecord(uid: string, v: GameRecordCloudValues): Promise<boolean> {
    try {
      const ref = doc(this.db, "gameRecords", uid);
      await setDoc(
        ref,
        {
          bestTimeSec: v.bestTimeSec,
          bestStars: v.bestStars,
          playCount: v.playCount,
          updatedAt: serverTimestamp(),
          // createdAt は存在しなければ新規作成、存在すれば変更しない (merge:true のため
          // 既存ドキュメントの createdAt は保持される)
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );
      return true;
    } catch (e) {
      console.warn("[Firebase] upsertRecord 失敗:", e);
      return false;
    }
  }
}
