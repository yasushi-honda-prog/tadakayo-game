import { Mission, type MissionContext } from "../Mission";
import type { Collectible } from "../../entities/Collectible";

/**
 * 収集ミッション: target 個の Collectible を取得したらクリア。
 *
 * Collectible 側が「取得済み」フラグを持つので、Manager は単に集計するだけ。
 * 取得トリガ（プレイヤーとの近接判定）は Collectible.update() 側に閉じ込める。
 */
export class CollectMission extends Mission {
  private readonly items: Collectible[];

  constructor(args: {
    id: string;
    title: string;
    description: string;
    items: Collectible[];
  }) {
    super({
      id: args.id,
      title: args.title,
      description: args.description,
      target: args.items.length,
    });
    this.items = args.items;
  }

  update(ctx: MissionContext): void {
    let collected = 0;
    for (const item of this.items) {
      item.tryCollect(ctx.playerPosition);
      if (item.collected) collected++;
    }
    this.current = collected;
    if (collected >= this.target) this.cleared = true;
  }
}
