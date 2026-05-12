/**
 * Phase 5-C の HUD。現在ミッション + 進捗 + クリア演出を担当。
 *
 * - 現在ミッション名 + 進捗 (例: 「DXの種を集めよう  3/10」)
 * - クリア時の一時メッセージ (3 秒で自動消去)
 * - Stage 1 (2026-05-13): 目標コンパス (フォアグラウンドミッションの次目標までの方向 + 距離)
 *
 * (座標表示は Phase 5-E ハンドオフで不要と判断され削除)
 */
export interface HUDMission {
  title: string;
  progress: string;
}

/**
 * Stage 1 で追加: 画面上端のコンパスに渡す情報。
 * - angleRad: カメラ視線基準の目標方向 (0=画面上, +π/2=右, -π/2=左, ±π=後ろ)。
 *   `Math.atan2(rightComponent, forwardComponent)` で計算する。
 * - label: 短い目標名 (例 "DXの種", "塔")。
 * - distanceM: XZ 平面距離 (m 単位、表示は小数点なし整数)。
 */
export interface HUDCompass {
  angleRad: number;
  label: string;
  distanceM: number;
}

export class HUD {
  private readonly root: HTMLElement;
  private readonly missionEl: HTMLElement;
  private readonly missionTitleEl: HTMLElement;
  private readonly missionProgressEl: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly compassEl: HTMLElement;
  private readonly compassArrowEl: HTMLElement;
  private readonly compassLabelEl: HTMLElement;
  private readonly compassDistanceEl: HTMLElement;
  private toastTimer: number | null = null;
  private lastCompassLabel = "";
  private lastCompassDistanceM = -1;

  constructor() {
    const root = document.getElementById("hud");
    const mission = document.getElementById("hud-mission");
    const missionTitle = document.getElementById("hud-mission-title");
    const missionProgress = document.getElementById("hud-mission-progress");
    const toast = document.getElementById("hud-toast");
    const compass = document.getElementById("hud-compass");
    const compassArrow = document.getElementById("hud-compass-arrow");
    const compassLabel = document.getElementById("hud-compass-label");
    const compassDistance = document.getElementById("hud-compass-distance");
    if (
      !root ||
      !mission ||
      !missionTitle ||
      !missionProgress ||
      !toast ||
      !compass ||
      !compassArrow ||
      !compassLabel ||
      !compassDistance
    ) {
      throw new Error("HUD 要素が見つかりません");
    }
    this.root = root;
    this.missionEl = mission;
    this.missionTitleEl = missionTitle;
    this.missionProgressEl = missionProgress;
    this.toastEl = toast;
    this.compassEl = compass;
    this.compassArrowEl = compassArrow;
    this.compassLabelEl = compassLabel;
    this.compassDistanceEl = compassDistance;
  }

  show(): void {
    this.root.classList.remove("hidden");
  }

  hide(): void {
    this.root.classList.add("hidden");
    // hide のたびにコンパス内部状態もクリアして、再表示直後の「古いラベル」を防ぐ
    this.setCompass(null);
  }

  setMission(m: HUDMission | null): void {
    if (m === null) {
      this.missionEl.classList.add("hidden");
      return;
    }
    this.missionEl.classList.remove("hidden");
    this.missionTitleEl.textContent = m.title;
    this.missionProgressEl.textContent = m.progress;
  }

  /**
   * 目標コンパスを更新。`null` を渡すと非表示にする (ミッション全クリア時等)。
   * 毎フレーム呼ばれてもよい設計: ラベルと距離は値変化時のみ DOM 書き換え。
   * 矢印 transform は値変化時のみ更新 (CSS の transition で見かけの滑らかさを担保)。
   */
  setCompass(info: HUDCompass | null): void {
    if (info === null) {
      if (!this.compassEl.classList.contains("hidden")) {
        this.compassEl.classList.add("hidden");
      }
      this.lastCompassLabel = "";
      this.lastCompassDistanceM = -1;
      return;
    }
    if (this.compassEl.classList.contains("hidden")) {
      this.compassEl.classList.remove("hidden");
    }
    // CSS の rotate は時計回り正、計算側 angleRad も画面右が正で整合
    const deg = (info.angleRad * 180) / Math.PI;
    this.compassArrowEl.style.transform = `rotate(${deg.toFixed(1)}deg)`;

    if (info.label !== this.lastCompassLabel) {
      this.compassLabelEl.textContent = info.label;
      this.lastCompassLabel = info.label;
    }
    const dInt = Math.max(0, Math.round(info.distanceM));
    if (dInt !== this.lastCompassDistanceM) {
      this.compassDistanceEl.textContent = `${dInt}m`;
      this.lastCompassDistanceM = dInt;
    }
  }

  flashClear(text: string, durationMs = 3000): void {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove("hidden");
    if (this.toastTimer !== null) clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.classList.add("hidden");
      this.toastTimer = null;
    }, durationMs);
  }
}
