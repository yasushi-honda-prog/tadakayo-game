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

export class Collectible {
  readonly object: THREE.Group;
  readonly kind: CollectibleKind;
  collected = false;
  private spinSpeed = 1.5;

  constructor(kind: CollectibleKind, lane: number) {
    this.kind = kind;
    this.object = new THREE.Group();

    const color = COLLECTIBLE_COLORS[kind];
    let mesh: THREE.Mesh;
    if (kind === "heart") {
      const geom = new THREE.IcosahedronGeometry(0.3, 0);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.1 });
      mesh = new THREE.Mesh(geom, mat);
    } else if (kind === "book") {
      const geom = new THREE.BoxGeometry(0.4, 0.5, 0.1);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
      mesh = new THREE.Mesh(geom, mat);
    } else if (kind === "mic") {
      const geom = new THREE.CylinderGeometry(0.12, 0.18, 0.5, 12);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
      mesh = new THREE.Mesh(geom, mat);
    } else {
      const geom = new THREE.SphereGeometry(0.3, 16, 16);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.05 });
      mesh = new THREE.Mesh(geom, mat);
    }
    mesh.position.y = 1.1;
    this.object.add(mesh);

    this.object.position.set(LANE.POSITIONS[lane], 0, SPAWN.Z);
  }

  update(dt: number, speed: number): void {
    this.object.position.z += speed * dt;
    this.object.children[0].rotation.y += this.spinSpeed * dt;
    this.object.children[0].rotation.x += this.spinSpeed * 0.5 * dt;
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
