import * as THREE from "three";
import { LANE, PLAYER } from "../config/gameConfig";
import { BRAND_HEX } from "../config/brand";

export class Player {
  readonly object: THREE.Group;
  private readonly mesh: THREE.Mesh;
  private targetLane: number = PLAYER.START_LANE;
  private currentX: number = LANE.POSITIONS[PLAYER.START_LANE];
  private velocityY = 0;
  private grounded = true;

  constructor() {
    this.object = new THREE.Group();
    this.object.position.set(this.currentX, PLAYER.GROUND_Y, 0);

    // 仮プリミティブ: 背の高い丸い直方体（タダカヨちゃんイメージカラー）
    const geom = new THREE.BoxGeometry(0.8, 1.4, 0.6);
    const mat = new THREE.MeshStandardMaterial({
      color: BRAND_HEX.PRIMARY,
      roughness: 0.6,
      metalness: 0.05,
    });
    this.mesh = new THREE.Mesh(geom, mat);
    this.mesh.castShadow = true;
    this.mesh.position.y = 0;
    this.object.add(this.mesh);

    // 頭の表現用に黄色い球を追加（暫定）
    const headGeom = new THREE.SphereGeometry(0.32, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffd84d, roughness: 0.5 });
    const head = new THREE.Mesh(headGeom, headMat);
    head.position.y = 0.95;
    this.object.add(head);

    // ピンクのヘッドフォン風リング
    const ringGeom = new THREE.TorusGeometry(0.3, 0.06, 8, 24);
    const ringMat = new THREE.MeshStandardMaterial({ color: BRAND_HEX.PINK, roughness: 0.4 });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.position.y = 1.05;
    ring.rotation.x = Math.PI / 2;
    this.object.add(ring);
  }

  changeLane(delta: -1 | 1): void {
    this.targetLane = Math.max(0, Math.min(LANE.POSITIONS.length - 1, this.targetLane + delta));
  }

  jump(): void {
    if (!this.grounded) return;
    this.velocityY = PLAYER.JUMP_VELOCITY;
    this.grounded = false;
  }

  update(dt: number): void {
    // レーン移動補間
    const targetX = LANE.POSITIONS[this.targetLane];
    this.currentX += (targetX - this.currentX) * Math.min(1, LANE.LERP * (dt / (1 / 60)));
    this.object.position.x = this.currentX;

    // ジャンプ物理
    if (!this.grounded) {
      this.velocityY += PLAYER.GRAVITY * dt;
      this.object.position.y += this.velocityY * dt;
      if (this.object.position.y <= PLAYER.GROUND_Y) {
        this.object.position.y = PLAYER.GROUND_Y;
        this.velocityY = 0;
        this.grounded = true;
      }
    }

    // 走る感じを出すために少し前傾揺れ
    this.mesh.rotation.z = Math.sin(performance.now() * 0.01) * 0.05;
  }

  resetPosition(): void {
    this.targetLane = PLAYER.START_LANE;
    this.currentX = LANE.POSITIONS[PLAYER.START_LANE];
    this.velocityY = 0;
    this.grounded = true;
    this.object.position.set(this.currentX, PLAYER.GROUND_Y, 0);
  }

  /** 当たり判定用 AABB（足元中心、見た目より小さめ） */
  getHitbox(): THREE.Box3 {
    const half = {
      x: PLAYER.HITBOX.width / 2,
      y: PLAYER.HITBOX.height / 2,
      z: PLAYER.HITBOX.depth / 2,
    };
    const cy = this.object.position.y;
    return new THREE.Box3(
      new THREE.Vector3(this.object.position.x - half.x, cy - half.y, this.object.position.z - half.z),
      new THREE.Vector3(this.object.position.x + half.x, cy + half.y, this.object.position.z + half.z)
    );
  }

  /** 収集判定用 AABB（広め、取り損ね防止） */
  getPickupBox(): THREE.Box3 {
    const half = {
      x: PLAYER.PICKUP_BOX.width / 2,
      y: PLAYER.PICKUP_BOX.height / 2,
      z: PLAYER.PICKUP_BOX.depth / 2,
    };
    const cy = this.object.position.y;
    return new THREE.Box3(
      new THREE.Vector3(this.object.position.x - half.x, cy - half.y, this.object.position.z - half.z),
      new THREE.Vector3(this.object.position.x + half.x, cy + half.y, this.object.position.z + half.z)
    );
  }

  isJumping(): boolean {
    return !this.grounded;
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
