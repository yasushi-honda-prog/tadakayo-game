import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";
import { PLAYER } from "../config/gameConfig";
import type { PhysicsWorld } from "../core/PhysicsWorld";
import type { InputBus } from "../input/InputBus";
import type { ThirdPersonCamera } from "./Camera";

type Direction = "front" | "back" | "sideRight" | "sideLeft";
type Pose = "idle" | "run" | "jump" | "crouch";

/**
 * sprite テクスチャの 4 方向 × 4 アクション辞書。
 * - sideRight / sideLeft は専用素材を持つ（左右反転は AI 絵柄の非対称で違和感が出るため避ける）
 * - front / back に crouch が無いケースは side で代用
 */
type SpriteSet = Record<Direction, Partial<Record<Pose, THREE.Texture>>>;

/** ダンス state の総再生時間 (s)。アクション押下時に毎回これだけリセット */
const DANCE_DURATION_SEC = 3.6;
/** ダンス sprite ローテ間隔 (s)。4 枚を 0.4s 毎に切替 → 1.6s で 1 ループ */
const DANCE_FRAME_SEC = 0.4;
/** ダンス中の縦バウンス振幅 (m) + 周期 (rad/s) */
const DANCE_BOUNCE_AMP = 0.12;
const DANCE_BOUNCE_RATE = 8.0;

/**
 * プレイヤー（タダカヨちゃん）。
 * - Rapier KinematicCharacterController で物理駆動
 * - 自前で重力 + ジャンプ垂直速度を管理
 * - カメラ角度に応じた 4 方向ビルボードスプライト切替
 */
export class Player {
  readonly object: THREE.Group;
  readonly position = new THREE.Vector3();
  private readonly sprite: THREE.Sprite;
  private readonly material: THREE.SpriteMaterial;
  private readonly textures: SpriteSet;
  private readonly danceTextures: THREE.Texture[];
  private readonly body: RAPIER.RigidBody;
  private readonly collider: RAPIER.Collider;
  private readonly cc: RAPIER.KinematicCharacterController;
  private readonly bus: InputBus;
  private readonly physics: PhysicsWorld;

  private verticalVelocity = 0;
  private grounded = false;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  /** キャラの向き（移動方向に追従。未移動ならカメラ前方向） */
  private facingYaw = 0;

  /** ダンス残り時間 (s)。>0 のときダンス中。0 で通常状態 */
  private danceTimer = 0;
  /** ダンス開始からの経過時間 (s)。texture index 計算に使用 */
  private danceElapsed = 0;
  /** 現在表示中のダンス texture index (texture 切替の冗長更新回避用) */
  private danceTextureIndex = -1;

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

    // 描画 (sprite ビルボード)
    this.object = new THREE.Group();
    this.textures = this.loadTextures();
    this.danceTextures = this.loadDanceTextures();
    this.material = new THREE.SpriteMaterial({
      map: this.textures.front.idle ?? this.textures.front.run,
      transparent: true,
      depthWrite: false,
    });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.scale.set(PLAYER.SPRITE_SIZE.width, PLAYER.SPRITE_SIZE.height, 1);
    this.sprite.position.y = PLAYER.SPRITE_SIZE.height / 2 - 0.05;
    this.object.add(this.sprite);

    bus.on((event) => {
      // ダンス中はジャンプを完全に無視 (終了直後のジャンプ暴発も防止)
      if (event === "jump" && !this.isDancing()) {
        this.jumpBufferTimer = PLAYER.JUMP_BUFFER_SEC;
      }
    });
  }

  private loadTextures(): SpriteSet {
    const loader = new THREE.TextureLoader();
    const base = import.meta.env.BASE_URL;
    const load = (name: string): THREE.Texture => {
      const tex = loader.load(`${base}assets/images/${name}.png`);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      return tex;
    };
    return {
      front: {
        idle: load("tadakayo-front-idle"),
        run: load("tadakayo-run"),
        jump: load("tadakayo-jump"),
      },
      back: {
        idle: load("tadakayo-back-idle"),
        run: load("tadakayo-back-run"),
        jump: load("tadakayo-back-jump"),
      },
      sideRight: {
        idle: load("tadakayo-side-idle"),
        run: load("tadakayo-side-run"),
        jump: load("tadakayo-side-jump"),
        crouch: load("tadakayo-side-crouch"),
      },
      sideLeft: {
        idle: load("tadakayo-side-left-idle"),
        run: load("tadakayo-side-left-run"),
        jump: load("tadakayo-side-left-jump"),
        crouch: load("tadakayo-side-left-crouch"),
      },
    };
  }

  private loadDanceTextures(): THREE.Texture[] {
    const loader = new THREE.TextureLoader();
    const base = import.meta.env.BASE_URL;
    const names = [
      "tadakayo-front-dance-1",
      "tadakayo-front-dance-2",
      "tadakayo-front-dance-3",
      "tadakayo-front-dance-4",
    ];
    return names.map((name) => {
      const tex = loader.load(`${base}assets/images/${name}.png`);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      return tex;
    });
  }

  isDancing(): boolean {
    return this.danceTimer > 0;
  }

  /**
   * ダンス state を開始 (もしくは継続中ならリスタート)。
   * - 残り時間を {@link DANCE_DURATION_SEC} に再セット
   * - texture rotation を 1 枚目から再生
   * - 直前にバッファされていた jump 入力をクリア (終了直後の暴発防止)
   *
   * @returns 常に true (将来的な失敗条件追加用に boolean を返しておく)
   */
  startDance(): boolean {
    this.danceTimer = DANCE_DURATION_SEC;
    this.danceElapsed = 0;
    this.danceTextureIndex = -1;
    this.jumpBufferTimer = 0;
    return true;
  }

  update(dt: number, camera: ThirdPersonCamera): void {
    // ダンス state 更新 (move 入力ゼロ化のため update 冒頭で進める)
    const dancing = this.isDancing();
    if (dancing) {
      this.danceTimer = Math.max(0, this.danceTimer - dt);
      this.danceElapsed += dt;
    }

    // 入力 → ワールド XZ ベクトル (ダンス中は水平移動だけゼロ化)
    const forward = camera.getForwardXZ();
    const right = camera.getRightXZ();
    const move = new THREE.Vector3();
    if (!dancing) {
      move.addScaledVector(forward, this.bus.state.moveY);
      move.addScaledVector(right, this.bus.state.moveX);
    }
    const moveLen = move.length();
    if (moveLen > 1) move.divideScalar(moveLen);

    const speed = this.bus.state.running ? PLAYER.RUN_SPEED : PLAYER.MOVE_SPEED;
    const horiz = move.clone().multiplyScalar(speed * dt);

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

    const cur = this.body.translation();
    const next = { x: cur.x + corrected.x, y: cur.y + corrected.y, z: cur.z + corrected.z };
    this.body.setNextKinematicTranslation(next);

    this.position.set(next.x, next.y, next.z);
    this.object.position.copy(this.position);

    // キャラの向き（移動方向に追従）
    if (moveLen > 0.1) {
      this.facingYaw = Math.atan2(move.x, move.z);
    }

    // ポーズ + 方向 → テクスチャ + flip
    this.applyDirectionalSprite(moveLen, camera.getYaw());

    // sprite 縦位置: ダンス中は専用バウンス、それ以外は走り中の足音的な微振動 (接地時のみ)
    const baseY = PLAYER.SPRITE_SIZE.height / 2 - 0.05;
    if (dancing) {
      const bounce = Math.max(0, Math.sin(this.danceElapsed * DANCE_BOUNCE_RATE)) * DANCE_BOUNCE_AMP;
      this.sprite.position.y = baseY + bounce;
    } else if (this.grounded && moveLen > 0.05) {
      this.sprite.position.y = baseY + Math.sin(performance.now() * 0.018) * 0.04;
    } else {
      this.sprite.position.y = baseY;
    }
  }

  /** カメラとキャラの相対角度から方向を判定し、テクスチャ + 反転を反映 */
  private applyDirectionalSprite(moveLen: number, cameraYaw: number): void {
    // ダンス中は方向判定をバイパスし、専用 4 枚を時間ベースでローテ
    if (this.isDancing()) {
      const idx = Math.floor(this.danceElapsed / DANCE_FRAME_SEC) % this.danceTextures.length;
      if (idx !== this.danceTextureIndex) {
        this.danceTextureIndex = idx;
        this.material.map = this.danceTextures[idx];
        this.material.needsUpdate = true;
      }
      this.sprite.scale.set(PLAYER.SPRITE_SIZE.width, PLAYER.SPRITE_SIZE.height, 1);
      return;
    }

    // 通常時: ダンス texture index をリセット (次回 dance 開始時に 1 枚目から再生)
    this.danceTextureIndex = -1;

    let pose: Pose;
    if (!this.grounded) pose = "jump";
    else if (moveLen > 0.05) pose = "run";
    else pose = "idle";

    // cameraYaw は camera の旋回角で、視線方向の atan2 とは π ずれている。
    // 例: cameraYaw=0 → camera は player の +Z 側、視線方向は -Z = atan2(0,-1) = π
    // よって「camera 視線 atan2 = cameraYaw + π」と比較する。
    let rel = this.facingYaw - cameraYaw - Math.PI;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;

    let dir: Direction;
    const abs = Math.abs(rel);
    if (abs < Math.PI / 4) {
      dir = "back"; // 背中が見える
    } else if (abs > (Math.PI * 3) / 4) {
      dir = "front"; // 顔が見える
    } else if (rel > 0) {
      // rel > 0: キャラがカメラ視線の右側を向いている → カメラから見て左側面が見える
      dir = "sideLeft";
    } else {
      dir = "sideRight";
    }

    // テクスチャ取得（フォールバック: pose が無ければ idle、それも無ければ右側面の同 pose）
    const tex =
      this.textures[dir][pose] ??
      this.textures[dir].idle ??
      this.textures.sideRight[pose] ??
      this.textures.front.run!;
    if (this.material.map !== tex) {
      this.material.map = tex;
      this.material.needsUpdate = true;
    }

    this.sprite.scale.set(PLAYER.SPRITE_SIZE.width, PLAYER.SPRITE_SIZE.height, 1);
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
    this.danceTimer = 0;
    this.danceElapsed = 0;
    this.danceTextureIndex = -1;
  }

  dispose(): void {
    for (const dir of Object.values(this.textures)) {
      for (const tex of Object.values(dir)) tex?.dispose();
    }
    for (const tex of this.danceTextures) tex.dispose();
    this.material.dispose();
    this.physics.removeCharacterController(this.cc);
  }
}
