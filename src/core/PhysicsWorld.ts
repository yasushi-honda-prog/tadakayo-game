import type RAPIER from "@dimforge/rapier3d-compat";
import { PHYSICS } from "../config/gameConfig";

// Rapier WASM bindings (@dimforge/rapier3d-compat, ~1.5MB) を遅延ロードして
// 初回ロードの bundle 体感を改善する。vite/rollup は dynamic `import()` を見ると
// 自動的に独立 chunk に分割し、main chunk と並列ダウンロード可能になる。
let R!: typeof RAPIER;

/**
 * Rapier 3D 物理エンジンの薄いラッパー。
 * - WASM 初期化（async）を main 起動シーケンスに組み込む
 * - World の step を毎フレーム呼ぶ
 * - 静的 collider（地面・建物等）と RigidBody（プレイヤー）を作るユーティリティを提供
 *
 * **遅延ロード**: `create()` を最初に呼んだ時点で `@dimforge/rapier3d-compat` を
 * dynamic import() する。型は `import type` のみなので main chunk には実装が入らない。
 */
export class PhysicsWorld {
  readonly world: RAPIER.World;
  readonly eventQueue: RAPIER.EventQueue;

  private constructor(world: RAPIER.World) {
    this.world = world;
    this.eventQueue = new R.EventQueue(true);
  }

  /** 起動時に 1 度だけ呼ぶ。Rapier を遅延ロードし WASM 初期化を待ってから World を構築 */
  static async create(): Promise<PhysicsWorld> {
    if (!R) {
      R = (await import("@dimforge/rapier3d-compat")).default;
    }
    await R.init();
    const world = new R.World({ x: PHYSICS.GRAVITY.x, y: PHYSICS.GRAVITY.y, z: PHYSICS.GRAVITY.z });
    world.timestep = PHYSICS.FIXED_DT;
    return new PhysicsWorld(world);
  }

  step(): void {
    this.world.step(this.eventQueue);
  }

  /** 静的 cuboid collider（地面・壁・建物等） */
  addStaticCuboid(
    halfExtents: { x: number; y: number; z: number },
    position: { x: number; y: number; z: number },
    rotationY: number = 0
  ): RAPIER.Collider {
    const bodyDesc = R.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z);
    if (rotationY !== 0) {
      const half = rotationY / 2;
      bodyDesc.setRotation({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) });
    }
    const body = this.world.createRigidBody(bodyDesc);
    const colDesc = R.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z).setFriction(0.7);
    return this.world.createCollider(colDesc, body);
  }

  /** 静的シリンダー collider（柱、噴水等） */
  addStaticCylinder(
    halfHeight: number,
    radius: number,
    position: { x: number; y: number; z: number }
  ): RAPIER.Collider {
    const bodyDesc = R.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z);
    const body = this.world.createRigidBody(bodyDesc);
    const colDesc = R.ColliderDesc.cylinder(halfHeight, radius).setFriction(0.7);
    return this.world.createCollider(colDesc, body);
  }

  /** Kinematic な RigidBody + Capsule collider（プレイヤー用） */
  addKinematicCapsule(
    halfHeight: number,
    radius: number,
    position: { x: number; y: number; z: number }
  ): { body: RAPIER.RigidBody; collider: RAPIER.Collider } {
    const bodyDesc = R.RigidBodyDesc.kinematicPositionBased().setTranslation(
      position.x,
      position.y,
      position.z
    );
    const body = this.world.createRigidBody(bodyDesc);
    const colDesc = R.ColliderDesc.capsule(halfHeight, radius).setFriction(0.0);
    const collider = this.world.createCollider(colDesc, body);
    return { body, collider };
  }

  /** KinematicCharacterController を作成 */
  createCharacterController(offset: number = 0.01): RAPIER.KinematicCharacterController {
    const cc = this.world.createCharacterController(offset);
    cc.enableAutostep(0.4, 0.2, true);
    cc.enableSnapToGround(0.4);
    cc.setApplyImpulsesToDynamicBodies(true);
    return cc;
  }

  removeCharacterController(cc: RAPIER.KinematicCharacterController): void {
    this.world.removeCharacterController(cc);
  }

  dispose(): void {
    // Rapier の World は free() で WASM メモリを解放
    this.world.free();
  }
}
