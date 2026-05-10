import * as THREE from "three";
import { LANE, SPAWN } from "../config/gameConfig";
import { BRAND_HEX } from "../config/brand";

export type ObstacleKind = "papers" | "fax" | "oldpc" | "moya";

const OBSTACLE_COLORS: Record<ObstacleKind, number> = {
  papers: 0xfaf3e0,
  fax: 0xb8b8b8,
  oldpc: 0xd9c79a,
  moya: 0x9aa0a6,
};

const OBSTACLE_LABEL: Record<ObstacleKind, string> = {
  papers: "紙",
  fax: "FAX",
  oldpc: "PC",
  moya: "...",
};

export class Obstacle {
  readonly object: THREE.Group;
  readonly kind: ObstacleKind;

  constructor(kind: ObstacleKind, lane: number) {
    this.kind = kind;
    this.object = new THREE.Group();

    const color = OBSTACLE_COLORS[kind];
    const geom = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.y = 0.45;
    this.object.add(mesh);

    // 上に小さな赤い印（ブランド色アクセント）
    const accentGeom = new THREE.SphereGeometry(0.12, 12, 12);
    const accentMat = new THREE.MeshStandardMaterial({ color: BRAND_HEX.PRIMARY });
    const accent = new THREE.Mesh(accentGeom, accentMat);
    accent.position.y = 1.0;
    this.object.add(accent);

    this.object.position.set(LANE.POSITIONS[lane], 0, SPAWN.Z);
    this.object.userData.label = OBSTACLE_LABEL[kind];
  }

  update(dt: number, speed: number): void {
    this.object.position.z += speed * dt;
  }

  isOutOfRange(): boolean {
    return this.object.position.z > 6;
  }

  getHitbox(): THREE.Box3 {
    const box = new THREE.Box3();
    box.setFromObject(this.object);
    // 当たり判定を見た目より少しだけ小さく（理不尽感の緩和）
    box.expandByScalar(-0.08);
    return box;
  }

  dispose(): void {
    this.object.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
  }
}

export const OBSTACLE_KINDS: readonly ObstacleKind[] = ["papers", "fax", "oldpc", "moya"];
