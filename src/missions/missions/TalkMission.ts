import { Mission, type MissionContext } from "../Mission";

/**
 * 会話ミッション (Phase 5-D): requiredNpcIds に列挙された NPC 全員と会話したらクリア。
 *
 * Mission.ts の docstring における **イベント駆動パターン** の実装:
 * - 毎フレーム判定は行わない (`update` は no-op)
 * - 外部 (NPC.onTalk → Game → mission.notifyTalked) から呼び出されて current 加算
 * - 同じ NPC を繰り返し訪問しても 1 回しか加算しない (Set で重複排除)
 * - requiredNpcIds に含まれない NPC との会話はミッション進捗に影響しない
 */
export class TalkMission extends Mission {
  private readonly visitedIds = new Set<string>();
  private readonly requiredIds: ReadonlySet<string>;

  constructor(args: {
    id: string;
    title: string;
    description: string;
    requiredNpcIds: readonly string[];
  }) {
    super({
      id: args.id,
      title: args.title,
      description: args.description,
      target: args.requiredNpcIds.length,
    });
    this.requiredIds = new Set(args.requiredNpcIds);
  }

  /** 指定 NPC との会話が完了済みか (HUD コンパスの未会話最寄り NPC 検索用) */
  hasTalkedTo(npcId: string): boolean {
    return this.visitedIds.has(npcId);
  }

  /** NPC との会話完了時に Game 側から呼ぶ。 */
  notifyTalked(npcId: string): void {
    if (this.cleared) return;
    if (!this.requiredIds.has(npcId)) return;
    if (this.visitedIds.has(npcId)) return;
    this.visitedIds.add(npcId);
    this.current = this.visitedIds.size;
    if (this.current >= this.target) this.cleared = true;
  }

  update(_ctx: MissionContext): void {
    // イベント駆動なので毎フレーム判定不要 (notifyTalked が状態を進める)
  }
}
