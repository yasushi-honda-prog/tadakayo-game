import * as THREE from "three";
import { LANE, SPAWN } from "../config/gameConfig";
import { BRAND_HEX } from "../config/brand";

/**
 * 障害物の挙動カテゴリ。
 * - lane: 既存の Box（左右レーンチェンジで回避）
 * - jump: ジャンプ必須。プレイヤー身長より高い壁状で、しゃがみでは抜けられない
 * - crouch: しゃがみ必須。空中に張り出した「天井」状で、ジャンプすると当たる
 */
export type ObstacleKind = "lane" | "jump" | "crouch";

const COLOR_PRIMITIVE: Record<ObstacleKind, number> = {
  lane: 0xb8b8b8,
  jump: 0xc04545,
  crouch: 0xd9c79a,
};

export class Obstacle {
  readonly object: THREE.Group;
  readonly kind: ObstacleKind;
  destroyed = false;

  constructor(kind: ObstacleKind, lane: number) {
    this.kind = kind;
    this.object = new THREE.Group();

    if (kind === "lane") {
      const geom = new THREE.BoxGeometry(0.9, 0.9, 0.9);
      const mat = new THREE.MeshStandardMaterial({ color: COLOR_PRIMITIVE.lane, roughness: 0.7 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.y = 0.45;
      this.object.add(mesh);
      const accentGeom = new THREE.SphereGeometry(0.1, 12, 12);
      const accentMat = new THREE.MeshStandardMaterial({ color: BRAND_HEX.PRIMARY });
      const accent = new THREE.Mesh(accentGeom, accentMat);
      accent.position.y = 1.0;
      this.object.add(accent);
    } else if (kind === "jump") {
      // 縦長の壁。プレイヤー身長より高めなのでジャンプで飛び越える必要あり
      const geom = new THREE.BoxGeometry(0.9, 1.5, 0.4);
      const mat = new THREE.MeshStandardMaterial({ color: COLOR_PRIMITIVE.jump, roughness: 0.6 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.y = 0.75;
      this.object.add(mesh);
      // 上に黄色の警告ストライプ
      const stripeGeom = new THREE.BoxGeometry(0.95, 0.12, 0.42);
      const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffd84d });
      const stripe = new THREE.Mesh(stripeGeom, stripeMat);
      stripe.position.y = 1.45;
      this.object.add(stripe);
    } else {
      // 天井型（crouch）。空中に張り出し、地面〜頭上に広い空間を残す
      const geom = new THREE.BoxGeometry(1.4, 0.4, 0.8);
      const mat = new THREE.MeshStandardMaterial({ color: COLOR_PRIMITIVE.crouch, roughness: 0.6 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.y = 1.7; // 頭の上のあたり
      this.object.add(mesh);
      // 吊り下げのピンクの帯
      const beamGeom = new THREE.BoxGeometry(0.05, 0.6, 0.05);
      const beamMat = new THREE.MeshStandardMaterial({ color: BRAND_HEX.PINK });
      for (const sx of [-0.5, 0.5]) {
        const beam = new THREE.Mesh(beamGeom, beamMat);
        beam.position.set(sx, 2.2, 0);
        this.object.add(beam);
      }
    }

    this.object.position.set(LANE.POSITIONS[lane], 0, SPAWN.Z);
  }

  update(dt: number, speed: number): void {
    this.object.position.z += speed * dt;

    // shielded で破壊されたときの飛散アニメ
    if (this.destroyed) {
      this.object.position.y += dt * 4;
      this.object.rotation.x += dt * 6;
      this.object.rotation.z += dt * 4;
      this.object.children.forEach((child) => {
        const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m) {
          if (!m.transparent) m.transparent = true;
          m.opacity = Math.max(0, m.opacity - dt * 1.5);
        }
      });
    }
  }

  isOutOfRange(): boolean {
    return this.object.position.z > 6 || (this.destroyed && this.object.position.y > 8);
  }

  /** 障害物本体の判定範囲。kind で形が違うので setFromObject ベースで取る */
  getHitbox(): THREE.Box3 {
    const box = new THREE.Box3();
    box.setFromObject(this.object);
    box.expandByScalar(-0.06);
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

export const OBSTACLE_KINDS: readonly ObstacleKind[] = ["lane", "jump", "crouch"];

/** SPAWN.KIND_WEIGHT に従って kind を抽選 */
export function pickObstacleKind(): ObstacleKind {
  const w = SPAWN.KIND_WEIGHT;
  const r = Math.random();
  if (r < w.lane) return "lane";
  if (r < w.lane + w.jump) return "jump";
  return "crouch";
}
