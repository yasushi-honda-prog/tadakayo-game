import * as THREE from "three";
import { CAMERA } from "../config/gameConfig";
import type { InputBus } from "../input/InputBus";

/**
 * 三人称後方追従カメラ。
 * - yaw / pitch を入力デルタから累積
 * - プレイヤー位置を基点に、後方 DISTANCE / 上 HEIGHT に配置
 * - 滑らかな lerp 追従
 */
export class ThirdPersonCamera {
  readonly camera: THREE.PerspectiveCamera;
  yaw = 0;
  pitch = -0.25;

  private readonly bus: InputBus;
  private readonly currentPos = new THREE.Vector3();
  private readonly targetPos = new THREE.Vector3();
  private readonly currentLookAt = new THREE.Vector3();
  private readonly targetLookAt = new THREE.Vector3();

  constructor(bus: InputBus) {
    this.bus = bus;
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
    this.handleResize();
    window.addEventListener("resize", this.handleResize);
  }

  private handleResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  };

  /** 視点回転デルタを取り込む */
  applyLookDelta(): void {
    const { dx, dy } = this.bus.consumeLook();
    this.yaw -= dx * CAMERA.MOUSE_SENSITIVITY_X;
    this.pitch -= dy * CAMERA.MOUSE_SENSITIVITY_Y;
    if (this.pitch < CAMERA.PITCH_MIN) this.pitch = CAMERA.PITCH_MIN;
    if (this.pitch > CAMERA.PITCH_MAX) this.pitch = CAMERA.PITCH_MAX;
  }

  /** プレイヤー位置に追従。dt 補間で滑らかに */
  follow(playerPos: THREE.Vector3): void {
    // カメラの目標位置: yaw/pitch 球面座標で「後方上空」
    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);
    const cosY = Math.cos(this.yaw);
    const sinY = Math.sin(this.yaw);
    // ヨー 0 で +Z 後方、+Y 上空（プレイヤー後ろ）
    const offsetX = sinY * cosP * CAMERA.DISTANCE;
    const offsetY = -sinP * CAMERA.DISTANCE + CAMERA.HEIGHT;
    const offsetZ = cosY * cosP * CAMERA.DISTANCE;

    this.targetPos.set(playerPos.x + offsetX, playerPos.y + offsetY, playerPos.z + offsetZ);
    this.targetLookAt.set(playerPos.x, playerPos.y + 1.2, playerPos.z);

    this.currentPos.lerp(this.targetPos, CAMERA.LERP_POS);
    this.currentLookAt.lerp(this.targetLookAt, CAMERA.LERP_POS);
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLookAt);
  }

  /** カメラ前方ベクトル（XZ 平面、移動入力用） */
  getForwardXZ(): THREE.Vector3 {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
  }

  getRightXZ(): THREE.Vector3 {
    return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
  }

  getYaw(): number {
    return this.yaw;
  }

  setInitial(playerPos: THREE.Vector3): void {
    this.follow(playerPos);
    this.currentPos.copy(this.targetPos);
    this.currentLookAt.copy(this.targetLookAt);
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLookAt);
  }

  dispose(): void {
    window.removeEventListener("resize", this.handleResize);
  }
}
