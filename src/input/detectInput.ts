/**
 * 入力モード判定 (Phase 5-E)。
 *
 * - URL `?ui=mobile` または `?ui=desktop` で強制指定可能 (デバッグ・iPad のばらつき対策)
 * - 強制指定なしの場合は `ontouchstart in window` + `navigator.maxTouchPoints > 0` で判定
 *
 * **モバイル判定された場合の挙動**: KeyboardMouseInput と TouchInput を **両方** 起動して併用する。
 * モバイルブラウザでも外付けキーボード接続例があるため、KB/Mouse を排除しない方針。
 * (canvas 上の click handler は両者で衝突しないよう KeyboardMouseInput だけ持つ)
 */
export type InputMode = "desktop" | "mobile";

export function detectInputMode(): InputMode {
  const params = new URLSearchParams(window.location.search);
  const forced = params.get("ui");
  if (forced === "mobile" || forced === "desktop") return forced;

  const hasTouch =
    "ontouchstart" in window ||
    (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0);
  return hasTouch ? "mobile" : "desktop";
}
