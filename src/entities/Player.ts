import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { PLAYER } from "../config/gameConfig";
import type { PhysicsWorld } from "../core/PhysicsWorld";
import type { InputBus } from "../input/InputBus";
import type { ThirdPersonCamera } from "./Camera";

type Pose = "idle" | "run" | "jump";

/**
 * プレイヤー（タダカヨちゃん）。
 * - Rapier KinematicCharacterController で物理駆動
 * - 自前で重力＋ジャンプ垂直速度を管理（character controller は移動量を補正するだけ）
 * - 4 方向ビルボードスプライト（カメラ角度に応じて front/back/side テクスチャ + 左右反転）
 */
export class Player {
  readonly object: THREE.Group;
  readonly position = new THREE.Vector3();
  private readonly sprite: THREE.Sprite;
  private readonly material: THREE.SpriteMaterial;
  private readonly textures: Record<Pose, THREE.Texture>;
  private readonly body: RAPIER.RigidBody;
  private readonly collider: RAPIER.Collider;
  private readonly cc: RAPIER.KinematicCharacterController;
  private readonly bus: InputBus;
  private readonly physics: PhysicsWorld;

  private verticalVelocity = 0;
  private grounded = false;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private facingYaw = 0; // キャラの向き（移動方向に追従）

  constructor(physics: PhysicsWorld, bus: InputBus) {
    this.physics = physics;
    this.bus = bus;

    // 物理ボディ
    const cap = physics.addKinematicCapsule(
      PLAYER.COLLIDER.halfHeight,
      PLAYER.COLLIDER.radius,
      PLAYER.SPAWN
    );
    this.body = cap.body;
    this.collider = cap.collider;
    this.cc = physics.createCharacterController(0.01);

    // 描画
    this.object = new THREE.Group();
    const loader = new THREE.TextureLoader();
    const base = import.meta.env.BASE_URL;
    this.textures = {
      idle: loader.load(`${base}assets/images/tadakayo-run.png`),
      run: loader.load(`${base}assets/images/tadakayo-run.png`),
      jump: loader.load(`${base}assets/images/tadakayo-jump.png`),
    };
    for (const tex of Object.values(this.textures)) {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
    }
    this.material = new THREE.SpriteMaterial({
      map: this.textures.idle,
      transparent: true,
      depthWrite: false,
    });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.scale.set(PLAYER.SPRITE_SIZE.width, PLAYER.SPRITE_SIZE.height, 1);
    this.sprite.position.y = PLAYER.SPRITE_SIZE.height / 2;
    this.object.add(this.sprite);

    // ジャンプ入力イベント受信
    bus.on((event) => {
      if (event === "jump") this.jumpBufferTimer = PLAYER.JUMP_BUFFER_SEC;
    });
  }

  /** 物理＋移動の更新。dt は実時間秒、camera は入力方向の基準 */
  update(dt: number, camera: ThirdPersonCamera): void {
    // 入力 → ワールド XZ ベクトル（カメラ基準）
    const forward = camera.getForwardXZ();
    const right = camera.getRightXZ();
    const move = new THREE.Vector3();
    move.addScaledVector(forward, this.bus.state.moveY);
    move.addScaledVector(right, this.bus.state.moveX);
    const moveLen = move.length();
    if (moveLen > 1) move.divideScalar(moveLen);

    const speed = this.bus.state.running ? PLAYER.RUN_SPEED : PLAYER.MOVE_SPEED;
    const horiz = move.multiplyScalar(speed * dt);

    // 縦方向: 重力 + ジャンプ
    if (this.grounded) {
      this.verticalVelocity = 0;
      this.coyoteTimer = PLAYER.COYOTE_SEC;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
      this.verticalVelocity -= PLAYER.GRAVITY_PULL * dt;
    }
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
      if (this.grounded || this.coyoteTimer > 0) {
        this.verticalVelocity = PLAYER.JUMP_VELOCITY;
        this.grounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
      }
    }
    const vert = this.verticalVelocity * dt;

    // CharacterController で移動を補正
    const desired = { x: horiz.x, y: vert, z: horiz.z };
    this.cc.computeColliderMovement(this.collider, desired);
    const corrected = this.cc.computedMovement();
    this.grounded = this.cc.computedGrounded();

    // RigidBody を新しい位置へ
    const cur = this.body.translation();
    const next = { x: cur.x + corrected.x, y: cur.y + corrected.y, z: cur.z + corrected.z };
    this.body.setNextKinematicTranslation(next);

    // Three オブジェクトの位置を同期
    this.position.set(next.x, next.y, next.z);
    this.object.position.copy(this.position);
    // sprite 中心はカプセル中心。スプライト下端を足元に揃えるため Y は 0 のまま
    this.sprite.position.y = 0;

    // 走り中は微振動
    if (this.grounded && moveLen > 0.05) {
      this.sprite.position.y = Math.sin(performance.now() * 0.018) * 0.04;
    }

    // ポーズ判定 + ビルボード方向
    this.updatePose(moveLen, this.grounded, camera.getYaw(), move);
  }

  private updatePose(moveLen: number, grounded: boolean, cameraYaw: number, moveDir: THREE.Vector3): void {
    let pose: Pose;
    if (!grounded) pose = "jump";
    else if (moveLen > 0.05) pose = "run";
    else pose = "idle";

    if (this.material.map !== this.textures[pose]) {
      this.material.map = this.textures[pose];
      this.material.needsUpdate = true;
    }

    // 移動方向にキャラの向きを追従（描画用：sprite なのでテクスチャ反転で対応）
    if (moveLen > 0.1) {
      const dirYaw = Math.atan2(moveDir.x, moveDir.z);
      this.facingYaw = dirYaw;
    }
    // カメラ視点に対するキャラの向き角度差
    const rel = this.facingYaw - cameraYaw;
    // 右向き（rel > 0 で +X 方向 = 画面の右） → そのまま、反対なら反転
    this.material.rotation = 0;
    // 簡易表現: カメラから見て右へ動くときは flip しない、左で flip
    const facingRight = Math.sin(rel) >= 0;
    this.sprite.scale.set(
      (facingRight ? 1 : -1) * PLAYER.SPRITE_SIZE.width,
      PLAYER.SPRITE_SIZE.height,
      1
    );
  }

  resetPosition(): void {
    this.body.setNextKinematicTranslation(PLAYER.SPAWN);
    this.body.setTranslation(PLAYER.SPAWN, true);
    this.position.set(PLAYER.SPAWN.x, PLAYER.SPAWN.y, PLAYER.SPAWN.z);
    this.object.position.copy(this.position);
    this.verticalVelocity = 0;
    this.grounded = false;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
  }

  dispose(): void {
    for (const tex of Object.values(this.textures)) tex.dispose();
    this.material.dispose();
    this.physics.removeCharacterController(this.cc);
    // Body/Collider は World.free() で解放される
  }
}
