import * as THREE from "three";
import { BRAND_HEX } from "../config/brand";

/**
 * Phase 5-C 用の収集アイテム「DXの種」（赤いハート）。
 *
 * - 浮遊回転で視認性を上げる（プレイヤーが「拾えるアイテム」と分かる）
 * - 取得判定はプレイヤー位置との XZ 平面距離 (Y は ±1.5m まで許容)
 * - 取得後はシーンから外し、collected=true をマーク（CollectMission が集計）
 *
 * 物理 collider は持たない（プレイヤーが歩き抜けて取得する設計）。
 * ハート形状は小さいトーラス + 直方体 2 つを組み合わせた簡易表現。
 * Phase 5-F で nano-banana による「DXの種」テクスチャに差し替え予定。
 */
const PICKUP_RADIUS = 0.9;
const PICKUP_HEIGHT_TOLERANCE = 1.5;
const FLOAT_AMPLITUDE = 0.18;
const FLOAT_SPEED = 2.4;
const ROT_SPEED = 1.6;

export class Collectible {
  readonly object: THREE.Group;
  readonly position: THREE.Vector3;
  collected = false;

  private readonly mesh: THREE.Group;
  private readonly baseY: number;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly geometries: THREE.BufferGeometry[] = [];
  private elapsed = 0;
  private onPickup: (() => void) | null = null;

  constructor(position: THREE.Vector3) {
    this.position = position.clone();
    this.baseY = position.y + 0.6;

    this.material = new THREE.MeshStandardMaterial({
      color: BRAND_HEX.PRIMARY,
      roughness: 0.3,
      metalness: 0.1,
      emissive: BRAND_HEX.PRIMARY,
      emissiveIntensity: 0.25,
    });

    this.mesh = this.buildHeartMesh();
    this.mesh.position.set(0, this.baseY, 0);

    this.object = new THREE.Group();
    this.object.position.set(this.position.x, 0, this.position.z);
    this.object.add(this.mesh);
  }

  private buildHeartMesh(): THREE.Group {
    // 小さい球 2 つ（ハートの上の膨らみ）+ 円錐（下のとがり）
    const group = new THREE.Group();
    const sphere = new THREE.SphereGeometry(0.18, 14, 10);
    const cone = new THREE.ConeGeometry(0.26, 0.42, 14);
    this.geometries.push(sphere, cone);

    const left = new THREE.Mesh(sphere, this.material);
    left.position.set(-0.13, 0.05, 0);
    group.add(left);

    const right = new THREE.Mesh(sphere, this.material);
    right.position.set(0.13, 0.05, 0);
    group.add(right);

    const tip = new THREE.Mesh(cone, this.material);
    tip.position.set(0, -0.21, 0);
    tip.rotation.x = Math.PI; // 円錐の頂点を下向きに
    group.add(tip);

    return group;
  }

  /** 取得時のコールバックを登録（SE 鳴動用） */
  onCollect(fn: () => void): void {
    this.onPickup = fn;
  }

  /**
   * MissionManager の active な CollectMission から毎フレーム呼ばれる。
   * 既に取得済みなら何もしない。プレイヤーとの距離が PICKUP_RADIUS 内なら取得。
   *
   * 引数は MissionContext.playerPosition と同じ不変スナップショット型を受ける
   * （Mission.ts のコメント参照）。Vector3 を直接受けないことで mission 側からの
   * 誤 mutation 経路を断つ。
   */
  tryCollect(playerPosition: Readonly<{ x: number; y: number; z: number }>): void {
    if (this.collected) return;
    const dx = playerPosition.x - this.position.x;
    const dz = playerPosition.z - this.position.z;
    const dy = Math.abs(playerPosition.y - this.baseY);
    const distXZ = Math.hypot(dx, dz);
    if (distXZ <= PICKUP_RADIUS && dy <= PICKUP_HEIGHT_TOLERANCE) {
      this.collected = true;
      this.object.visible = false;
      if (this.onPickup) this.onPickup();
    }
  }

  /** 浮遊 + 回転アニメ。Game.ts のレンダリングフレームから呼ぶ。 */
  animate(dt: number): void {
    if (this.collected) return;
    this.elapsed += dt;
    this.mesh.position.y = this.baseY + Math.sin(this.elapsed * FLOAT_SPEED) * FLOAT_AMPLITUDE;
    this.mesh.rotation.y += dt * ROT_SPEED;
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    this.material.dispose();
  }
}
