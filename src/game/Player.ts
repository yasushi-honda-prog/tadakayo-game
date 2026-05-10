import * as THREE from "three";
import { LANE, PLAYER } from "../config/gameConfig";
import { BRAND_HEX } from "../config/brand";

type Pose = "run" | "jump" | "crouch";

export class Player {
  readonly object: THREE.Group;
  private readonly sprite: THREE.Sprite;
  private readonly material: THREE.SpriteMaterial;
  private readonly textures: Record<Pose, THREE.Texture>;
  private readonly shieldRing: THREE.Mesh;
  private currentPose: Pose = "run";
  private targetLane: number = PLAYER.START_LANE;
  private currentX: number = LANE.POSITIONS[PLAYER.START_LANE];
  private velocityY = 0;
  private grounded = true;
  private crouchTimer = 0;
  private shieldTimer = 0;
  /** 着地直前に押された jump 入力をバッファして次ジャンプに繋げる */
  private jumpBufferTimer = 0;

  // 各ポーズのスプライト寸法（横長/縦長）。crouch だけ横長
  private readonly POSE_SCALE: Record<Pose, { x: number; y: number; cy: number }> = {
    run: { x: 1.92, y: 2.88, cy: 1.08 },
    jump: { x: 1.92, y: 2.88, cy: 1.18 },
    crouch: { x: 2.4, y: 1.6, cy: 0.55 },
  };

  constructor() {
    this.object = new THREE.Group();
    this.object.position.set(this.currentX, PLAYER.GROUND_Y, 0);

    const loader = new THREE.TextureLoader();
    const base = import.meta.env.BASE_URL;
    this.textures = {
      run: loader.load(`${base}assets/images/tadakayo-run.png`),
      jump: loader.load(`${base}assets/images/tadakayo-jump.png`),
      crouch: loader.load(`${base}assets/images/tadakayo-crouch.png`),
    };
    for (const tex of Object.values(this.textures)) {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
    }

    this.material = new THREE.SpriteMaterial({
      map: this.textures.run,
      transparent: true,
      depthWrite: false,
    });
    this.sprite = new THREE.Sprite(this.material);
    const scale = this.POSE_SCALE.run;
    this.sprite.scale.set(scale.x, scale.y, 1);
    this.sprite.position.y = scale.cy;
    this.object.add(this.sprite);

    // シールドリング
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
    if (this.grounded) {
      this.crouchTimer = 0;
      this.velocityY = PLAYER.JUMP_VELOCITY;
      this.grounded = false;
    } else {
      // 空中なら次の着地でジャンプを連続発火するようバッファ
      this.jumpBufferTimer = PLAYER.JUMP_BUFFER_SEC;
    }
  }

  crouch(): void {
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

  isJumping(): boolean {
    return !this.grounded;
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
        // 着地時に jump buffer があれば即座に再ジャンプ（操作快適性向上）
        if (this.jumpBufferTimer > 0) {
          this.jumpBufferTimer = 0;
          this.velocityY = PLAYER.JUMP_VELOCITY;
          this.grounded = false;
        }
      }
    }

    if (this.jumpBufferTimer > 0) this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    if (this.crouchTimer > 0) this.crouchTimer = Math.max(0, this.crouchTimer - dt);
    if (this.shieldTimer > 0) {
      this.shieldTimer = Math.max(0, this.shieldTimer - dt);
      this.shieldRing.rotation.z += dt * 4;
      const blink = this.shieldTimer < 1.5 ? Math.floor(performance.now() / 120) % 2 === 0 : true;
      this.shieldRing.visible = blink;
      if (this.shieldTimer === 0) this.shieldRing.visible = false;
    }

    // ポーズ判定 + テクスチャ・スケール切替
    const pose: Pose = this.isCrouching() ? "crouch" : this.grounded ? "run" : "jump";
    this.applyPose(pose);

    // 走り中は微振動
    if (pose === "run") {
      const baseY = this.POSE_SCALE.run.cy;
      this.sprite.position.y = baseY + Math.sin(performance.now() * 0.018) * 0.05;
    }
  }

  private applyPose(pose: Pose): void {
    if (this.currentPose !== pose) {
      this.material.map = this.textures[pose];
      this.material.needsUpdate = true;
      this.currentPose = pose;
    }
    const scale = this.POSE_SCALE[pose];
    this.sprite.scale.set(scale.x, scale.y, 1);
    this.sprite.position.y = scale.cy;
  }

  resetPosition(): void {
    this.targetLane = PLAYER.START_LANE;
    this.currentX = LANE.POSITIONS[PLAYER.START_LANE];
    this.velocityY = 0;
    this.grounded = true;
    this.crouchTimer = 0;
    this.shieldTimer = 0;
    this.jumpBufferTimer = 0;
    this.shieldRing.visible = false;
    this.applyPose("run");
    this.object.position.set(this.currentX, PLAYER.GROUND_Y, 0);
  }

  /** 当たり判定。しゃがみ時は縦サイズ縮小 */
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

  dispose(): void {
    for (const tex of Object.values(this.textures)) tex.dispose();
    this.material.dispose();
    this.shieldRing.geometry.dispose();
    (this.shieldRing.material as THREE.Material).dispose();
  }
}
