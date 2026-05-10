import * as THREE from "three";
import { LANE, SPAWN } from "../config/gameConfig";
import { BRAND_HEX } from "../config/brand";

export type CollectibleKind = "heart" | "book" | "mic" | "bubble";

const COLLECTIBLE_COLORS: Record<CollectibleKind, number> = {
  heart: BRAND_HEX.PRIMARY,
  book: 0xc04545,
  mic: 0xff8fcf,
  bubble: BRAND_HEX.PINK,
};

/** 配置位置のプリセット。空中はジャンプ取得を意図 */
export type CollectibleHeight = "ground" | "mid" | "high";
const HEIGHT_Y: Record<CollectibleHeight, number> = {
  ground: 0,
  mid: 1.0,
  high: 1.85,
};

export class Collectible {
  readonly object: THREE.Group;
  readonly kind: CollectibleKind;
  collected = false;
  private spinSpeed = 1.5;
  private readonly baseY: number;

  constructor(kind: CollectibleKind, lane: number, height: CollectibleHeight = "mid", zOffset = 0) {
    this.kind = kind;
    this.object = new THREE.Group();
    this.baseY = HEIGHT_Y[height];

    const color = COLLECTIBLE_COLORS[kind];
    let mesh: THREE.Mesh;
    if (kind === "heart") {
      const geom = new THREE.IcosahedronGeometry(0.32, 0);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.1, emissive: color, emissiveIntensity: 0.2 });
      mesh = new THREE.Mesh(geom, mat);
    } else if (kind === "book") {
      const geom = new THREE.BoxGeometry(0.4, 0.5, 0.1);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, emissive: color, emissiveIntensity: 0.15 });
      mesh = new THREE.Mesh(geom, mat);
    } else if (kind === "mic") {
      const geom = new THREE.CylinderGeometry(0.13, 0.19, 0.5, 12);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, emissive: color, emissiveIntensity: 0.2 });
      mesh = new THREE.Mesh(geom, mat);
    } else {
      const geom = new THREE.SphereGeometry(0.32, 16, 16);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, emissive: color, emissiveIntensity: 0.2 });
      mesh = new THREE.Mesh(geom, mat);
    }
    mesh.position.y = this.baseY + 1.1;
    this.object.add(mesh);

    this.object.position.set(LANE.POSITIONS[lane], 0, SPAWN.Z + zOffset);
  }

  update(dt: number, speed: number): void {
    this.object.position.z += speed * dt;
    this.object.children[0].rotation.y += this.spinSpeed * dt;
    this.object.children[0].rotation.x += this.spinSpeed * 0.5 * dt;
    // ふわふわ浮遊
    this.object.children[0].position.y = this.baseY + 1.1 + Math.sin(performance.now() * 0.003 + this.object.position.x) * 0.1;
  }

  isOutOfRange(): boolean {
    return this.object.position.z > 6;
  }

  getBox(): THREE.Box3 {
    const box = new THREE.Box3();
    box.setFromObject(this.object);
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

export const COLLECTIBLE_KINDS: readonly CollectibleKind[] = ["heart", "book", "mic", "bubble"];
