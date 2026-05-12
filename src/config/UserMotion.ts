/**
 * `prefers-reduced-motion` メディアクエリ監視シングルトン (Stage 4 / 2026-05-13)。
 *
 * **責務**:
 * - OS / ブラウザの「動きを減らす」設定を検出
 * - 検出結果を boolean で公開、各エンティティ (Collectible / DanceNpc / Village) が
 *   `animate()` 内で参照して動きを停止 / 減速する
 *
 * **設計**:
 * - シングルトン (UserSettings / GameRecord と同じパターン)
 * - `window.matchMedia` の `change` イベントを購読してランタイムで反映 (OS 設定変更直後に
 *   ゲームが応答できる、a11y ベストプラクティス)
 * - listener 経由で各 entity に通知 (現状は参照する側が `prefersReduced` を毎フレーム読む
 *   だけで十分なので listener は将来拡張用)
 *
 * 参考: https://web.dev/learn/accessibility/motion
 * 参考: https://gameaccessibilityguidelines.com/full-list/
 */

type Listener = (reduced: boolean) => void;

export class UserMotion {
  private static _instance: UserMotion | null = null;
  static get instance(): UserMotion {
    if (this._instance === null) this._instance = new UserMotion();
    return this._instance;
  }

  static _reset(): void {
    this._instance = null;
  }

  private _prefersReduced = false;
  private listeners: Listener[] = [];

  private constructor() {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    this._prefersReduced = mql.matches;
    // ランタイム変更 (OS 設定を切り替えたら即座に反映)
    mql.addEventListener("change", (e) => this.handleChange(e.matches));
  }

  /** 現在の `prefers-reduced-motion: reduce` 検出状態 */
  get prefersReduced(): boolean {
    return this._prefersReduced;
  }

  onChange(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private handleChange(reduced: boolean): void {
    if (reduced === this._prefersReduced) return;
    this._prefersReduced = reduced;
    for (const l of this.listeners) l(reduced);
  }
}
