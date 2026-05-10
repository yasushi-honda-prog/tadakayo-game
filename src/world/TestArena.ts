import * as THREE from "three";
import type { PhysicsWorld } from "../core/PhysicsWorld";
import { BRAND_HEX } from "../config/brand";

/**
 * Phase 5-A 用の最小テストアリーナ。
 * - 平地（50x50）
 * - 階段ジャンプ用の段差ボックス
 * - 低い壁（衝突確認）
 * - 高い壁（ジャンプで越えられない確認）
 * - スロープ（坂）
 *
 * Phase 5-B で `Village` に置き換わる。
 */
export class TestArena {
  readonly object: THREE.Group;

  constructor(physics: PhysicsWorld) {
    this.object = new THREE.Group();

    // 地面
    const groundSize = 50;
    const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize);
    const groundMat = new THREE.MeshStandardMaterial({
      color: BRAND_HEX.GROUND,
      roughness: 0.95,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.object.add(ground);
    physics.addStaticCuboid({ x: groundSize / 2, y: 0.05, z: groundSize / 2 }, { x: 0, y: -0.05, z: 0 });

    // 階段ジャンプ用の段差ボックス（高さ 0.5, 1.0, 1.5, 2.0 が並ぶ）
    for (let i = 0; i < 4; i++) {
      const h = 0.5 * (i + 1);
      this.addBox(
        physics,
        { x: 1.5, y: h / 2, z: 1.0 },
        { x: -10 + i * 3.2, y: h / 2, z: -8 },
        BRAND_HEX.PINK
      );
    }

    // 低い壁（高さ 0.5）— ジャンプで越せる
    this.addBox(physics, { x: 4, y: 0.25, z: 0.4 }, { x: 5, y: 0.25, z: -3 }, 0xc87a5a);

    // 高い壁（高さ 3）— ジャンプでは越せない
    this.addBox(physics, { x: 4, y: 1.5, z: 0.4 }, { x: 5, y: 1.5, z: 3 }, 0x7a3a3a);

    // ピンクの大きなブロック（足場ジャンプ用）
    this.addBox(physics, { x: 1.5, y: 0.75, z: 1.5 }, { x: -3, y: 0.75, z: 5 }, BRAND_HEX.PRIMARY);
    this.addBox(physics, { x: 1.5, y: 1.5, z: 1.5 }, { x: 0, y: 1.5, z: 7 }, BRAND_HEX.PRIMARY);
    this.addBox(physics, { x: 1.5, y: 2.25, z: 1.5 }, { x: 3, y: 2.25, z: 9 }, BRAND_HEX.PRIMARY);
  }

  private addBox(
    physics: PhysicsWorld,
    halfExtents: { x: number; y: number; z: number },
    position: { x: number; y: number; z: number },
    color: number
  ): void {
    const geo = new THREE.BoxGeometry(halfExtents.x * 2, halfExtents.y * 2, halfExtents.z * 2);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(position.x, position.y, position.z);
    this.object.add(mesh);
    physics.addStaticCuboid(halfExtents, position);
  }

  dispose(): void {
    this.object.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
  }
}
