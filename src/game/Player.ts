import * as THREE from "three";
import { LANE, PLAYER } from "../config/gameConfig";

export class Player {
  readonly object: THREE.Group;
  private readonly sprite: THREE.Sprite;
  private readonly material: THREE.SpriteMaterial;
  private readonly runTexture: THREE.Texture;
  private readonly jumpTexture: THREE.Texture;
  private targetLane: number = PLAYER.START_LANE;
  private currentX: number = LANE.POSITIONS[PLAYER.START_LANE];
  private velocityY = 0;
  private grounded = true;

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

    const desired = this.grounded ? this.runTexture : this.jumpTexture;
    if (this.material.map !== desired) {
      this.material.map = desired;
      this.material.needsUpdate = true;
    }

    // 走ってる感: 接地時に上下に微振動
    if (this.grounded) {
      this.sprite.position.y = PLAYER.SPRITE_SIZE.height * 0.6 + Math.sin(performance.now() * 0.018) * 0.05;
    } else {
      this.sprite.position.y = PLAYER.SPRITE_SIZE.height * 0.6;
    }
  }

  resetPosition(): void {
    this.targetLane = PLAYER.START_LANE;
    this.currentX = LANE.POSITIONS[PLAYER.START_LANE];
    this.velocityY = 0;
    this.grounded = true;
    this.object.position.set(this.currentX, PLAYER.GROUND_Y, 0);
  }

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
  }
}
