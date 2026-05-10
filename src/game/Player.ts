import * as THREE from "three";
import { LANE, PLAYER } from "../config/gameConfig";
import { BRAND_HEX } from "../config/brand";

export class Player {
  readonly object: THREE.Group;
  private readonly sprite: THREE.Sprite;
  private readonly material: THREE.SpriteMaterial;
  private readonly runTexture: THREE.Texture;
  private readonly jumpTexture: THREE.Texture;
  private readonly shieldRing: THREE.Mesh;
  private targetLane: number = PLAYER.START_LANE;
  private currentX: number = LANE.POSITIONS[PLAYER.START_LANE];
  private velocityY = 0;
  private grounded = true;
  private crouchTimer = 0;
  private shieldTimer = 0;

  constructor() {
    this.object = new THREE.Group();
    this.object.position.set(this.currentX, PLAYER.GROUND_Y, 0);

    const loader = new THREE.TextureLoader();
    const base = import.meta.env.BASE_URL;
    this.runTexture = loader.load(`${base}assets/images/tadakayo-run.png`);
    this.jumpTexture = loader.load(`${base}assets/images/tadakayo-jump.png`);
    for (const tex of [this.runTexture, this.jumpTexture]) {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
    }

    this.material = new THREE.SpriteMaterial({
      map: this.runTexture,
      transparent: true,
      depthWrite: false,
    });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.scale.set(PLAYER.SPRITE_SIZE.width * 1.6, PLAYER.SPRITE_SIZE.height * 1.6, 1);
    this.sprite.position.y = PLAYER.SPRITE_SIZE.height * 0.6;
    this.object.add(this.sprite);

    // シールドリング（非表示で初期化）
    const ringGeom = new THREE.TorusGeometry(1.0, 0.08, 12, 36);
    const ringMat = new THREE.MeshBasicMaterial({
      color: BRAND_HEX.PINK,
      transparent: true,
      opacity: 0.85,
    });
    this.shieldRing = new THREE.Mesh(ringGeom, ringMat);
    this.shieldRing.rotation.x = Math.PI / 2;
    this.shieldRing.position.y = 0.9;
    this.shieldRing.visible = false;
    this.object.add(this.shieldRing);
  }

  changeLane(delta: -1 | 1): void {
    this.targetLane = Math.max(0, Math.min(LANE.POSITIONS.length - 1, this.targetLane + delta));
  }

  jump(): void {
    if (!this.grounded) return;
    // しゃがみ中はジャンプを優先（しゃがみ解除）
    this.crouchTimer = 0;
    this.velocityY = PLAYER.JUMP_VELOCITY;
    this.grounded = false;
  }

  crouch(): void {
    // 空中ではしゃがめない（着地後に発動）
    if (!this.grounded) return;
    this.crouchTimer = PLAYER.CROUCH_DURATION;
  }

  activateShield(durationSec: number): void {
    this.shieldTimer = durationSec;
    this.shieldRing.visible = true;
  }

  isShielded(): boolean {
    return this.shieldTimer > 0;
  }

  isCrouching(): boolean {
    return this.crouchTimer > 0;
  }

  update(dt: number): void {
    const targetX = LANE.POSITIONS[this.targetLane];
    this.currentX += (targetX - this.currentX) * Math.min(1, LANE.LERP * (dt / (1 / 60)));
    this.object.position.x = this.currentX;

    if (!this.grounded) {
      this.velocityY += PLAYER.GRAVITY * dt;
      this.object.position.y += this.velocityY * dt;
      if (this.object.position.y <= PLAYER.GROUND_Y) {
        this.object.position.y = PLAYER.GROUND_Y;
        this.velocityY = 0;
        this.grounded = true;
      }
    }

    // しゃがみタイマー減算
    if (this.crouchTimer > 0) {
      this.crouchTimer = Math.max(0, this.crouchTimer - dt);
    }

    // シールドタイマー減算 + 点滅
    if (this.shieldTimer > 0) {
      this.shieldTimer = Math.max(0, this.shieldTimer - dt);
      this.shieldRing.rotation.z += dt * 4;
      // 残り 1.5 秒で点滅
      const blink = this.shieldTimer < 1.5 ? Math.floor(performance.now() / 120) % 2 === 0 : true;
      this.shieldRing.visible = blink;
      if (this.shieldTimer === 0) this.shieldRing.visible = false;
    }

    // テクスチャ切替
    const desired = this.grounded ? this.runTexture : this.jumpTexture;
    if (this.material.map !== desired) {
      this.material.map = desired;
      this.material.needsUpdate = true;
    }

    // しゃがみで sprite を縮める / 走り中は微振動
    const baseY = PLAYER.SPRITE_SIZE.height * 0.6;
    if (this.isCrouching()) {
      this.sprite.scale.y = PLAYER.SPRITE_SIZE.height * 1.0; // 通常 1.6 → 1.0 に縮める
      this.sprite.position.y = baseY * 0.55;
    } else if (this.grounded) {
      this.sprite.scale.y = PLAYER.SPRITE_SIZE.height * 1.6;
      this.sprite.position.y = baseY + Math.sin(performance.now() * 0.018) * 0.05;
    } else {
      this.sprite.scale.y = PLAYER.SPRITE_SIZE.height * 1.6;
      this.sprite.position.y = baseY;
    }
  }

  resetPosition(): void {
    this.targetLane = PLAYER.START_LANE;
    this.currentX = LANE.POSITIONS[PLAYER.START_LANE];
    this.velocityY = 0;
    this.grounded = true;
    this.crouchTimer = 0;
    this.shieldTimer = 0;
    this.shieldRing.visible = false;
    this.object.position.set(this.currentX, PLAYER.GROUND_Y, 0);
  }

  /** 当たり判定。しゃがみ/ジャンプで縦サイズと中心 y が変化する */
  getHitbox(): THREE.Box3 {
    const hb = this.isCrouching() ? PLAYER.HITBOX_CROUCH : PLAYER.HITBOX;
    const half = { x: hb.width / 2, y: hb.height / 2, z: hb.depth / 2 };
    const cy = this.object.position.y - PLAYER.GROUND_Y + hb.height / 2;
    return new THREE.Box3(
      new THREE.Vector3(this.object.position.x - half.x, cy - half.y, this.object.position.z - half.z),
      new THREE.Vector3(this.object.position.x + half.x, cy + half.y, this.object.position.z + half.z)
    );
  }

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
    this.runTexture.dispose();
    this.jumpTexture.dispose();
    this.material.dispose();
    this.shieldRing.geometry.dispose();
    (this.shieldRing.material as THREE.Material).dispose();
  }
}
