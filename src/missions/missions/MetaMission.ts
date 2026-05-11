import { Mission, type MissionContext } from "../Mission";

/**
 * 「他ミッション全クリア」を条件とするメタミッション (Phase 5-E)。
 *
 * **イベント駆動パターン**:
 * - MissionManager.onCleared に Game 側で hookup し、cleared mission の id を `notifyMissionCleared`
 *   に渡す
 * - `requiredMissionIds` に含まれる id のみカウント。Set 重複排除で同じ mission の二重発火に耐える
 * - 全部 cleared で自身も cleared
 *
 * 用途: 「タダカヨ村マスター」(mission-1〜4 全クリアでエンディング演出)
 *
 * **責務外** (Game 側):
 * - cleared 検知後のエンディング演出 (大型 toast + Hit jingle + 例えば BGM フェードアウト)
 * - MetaMission 自身は Mission 基盤と同じ progress 進行のみ提供
 */
export class MetaMission extends Mission {
  private readonly requiredIds: ReadonlySet<string>;
  private readonly clearedSet = new Set<string>();

  constructor(args: {
    id: string;
    title: string;
    description: string;
    requiredMissionIds: readonly string[];
  }) {
    super({
      id: args.id,
      title: args.title,
      description: args.description,
      target: args.requiredMissionIds.length,
    });
    this.requiredIds = new Set(args.requiredMissionIds);
  }

  /**
   * 他のミッションが clear したときに Game 側 (missionManager.onCleared 経由) で呼ぶ。
   * 自身が target 達成すれば cleared = true。
   */
  notifyMissionCleared(missionId: string): void {
    if (this.cleared) return;
    if (!this.requiredIds.has(missionId)) return;
    if (this.clearedSet.has(missionId)) return;
    this.clearedSet.add(missionId);
    this.current = this.clearedSet.size;
    if (this.current >= this.target) this.cleared = true;
  }

  update(_ctx: MissionContext): void {
    // イベント駆動なので毎フレーム判定不要
  }
}
