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
  private readonly shadowMaterial: THREE.MeshBasicMaterial;
  private readonly shadowGeometry: THREE.CircleGeometry;
  private elapsed = 0;
  private onPickup: (() => void) | null = null;

  constructor(position: THREE.Vector3) {
    this.position = position.clone();
    // baseY: ハート mesh の浮遊中心 (絶対 y)。position.y は足元の床面、+0.6 で目線高さに浮遊
    this.baseY = position.y + 0.6;

    this.material = new THREE.MeshStandardMaterial({
      color: BRAND_HEX.PRIMARY,
      roughness: 0.3,
      metalness: 0.1,
      emissive: BRAND_HEX.PRIMARY,
      emissiveIntensity: 0.25,
    });

    this.mesh = this.buildHeartMesh();
    // mesh.position.y は object 相対なので、絶対 baseY から object.y (= position.y) を引く
    this.mesh.position.set(0, this.baseY - this.position.y, 0);

    this.object = new THREE.Group();
    // object.position.y = 床面 (PR #23): 中央広場 0.15 / タダレク広場 0.2 / 草地 0。
    // 影は object 内 y=0.02 のため、床面 +0.02 に貼り付き「床下に隠れる」問題を解消。
    this.object.position.set(this.position.x, this.position.y, this.position.z);
    this.object.add(this.mesh);

    // 地面影: ハートが空中浮遊しているとき XZ 位置を視認しやすくする (Phase 5-F UX 改善)。
    // Heart sprite と異なり静的位置 (y=0.02 固定) で、浮遊高さによる scale 変動なし
    // (シンプルさ優先、ユーザーが「真下のここ」と分かれば十分)。
    this.shadowGeometry = new THREE.CircleGeometry(0.22, 20);
    this.shadowMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(this.shadowGeometry, this.shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, 0.02, 0);
    shadow.renderOrder = -1; // 地面と Z-fight しないよう先描画
    this.object.add(shadow);
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
    this.shadowGeometry.dispose();
    this.shadowMaterial.dispose();
  }
}
