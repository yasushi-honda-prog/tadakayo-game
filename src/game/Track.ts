import * as THREE from "three";
import { TRACK, LANE } from "../config/gameConfig";
import { BRAND_HEX } from "../config/brand";

export class Track {
  readonly object: THREE.Group;
  private readonly groundMaterial: THREE.MeshStandardMaterial;
  private uvOffset = 0;

  constructor() {
    this.object = new THREE.Group();

    // 走路本体
    this.groundMaterial = new THREE.MeshStandardMaterial({
      color: BRAND_HEX.GROUND,
      roughness: 0.85,
      metalness: 0.0,
    });

    const groundGeom = new THREE.PlaneGeometry(TRACK.WIDTH, TRACK.LENGTH, 1, 1);
    const ground = new THREE.Mesh(groundGeom, this.groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -TRACK.LENGTH / 2 + 4);
    ground.receiveShadow = true;
    this.object.add(ground);

    // レーン分割線（薄いピンク）
    for (const lineX of [-LANE.WIDTH / 2, LANE.WIDTH / 2]) {
      const lineGeom = new THREE.PlaneGeometry(0.06, TRACK.LENGTH);
      const lineMat = new THREE.MeshBasicMaterial({
        color: BRAND_HEX.GROUND_LANE,
        transparent: true,
        opacity: 0.7,
      });
      const line = new THREE.Mesh(lineGeom, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(lineX, 0.01, -TRACK.LENGTH / 2 + 4);
      this.object.add(line);
    }

    // 走路脇の植え込み代わりにピンクの低い壁
    for (const sideX of [-TRACK.WIDTH / 2 - 0.1, TRACK.WIDTH / 2 + 0.1]) {
      const wallGeom = new THREE.BoxGeometry(0.4, 0.6, TRACK.LENGTH);
      const wallMat = new THREE.MeshStandardMaterial({
        color: BRAND_HEX.PINK,
        roughness: 0.7,
      });
      const wall = new THREE.Mesh(wallGeom, wallMat);
      wall.position.set(sideX, 0.3, -TRACK.LENGTH / 2 + 4);
      this.object.add(wall);
    }
  }

  /** 床のスクロール（速度ベース） */
  update(dt: number, speed: number): void {
    this.uvOffset += dt * speed * TRACK.SCROLL_FACTOR;
    // 進行方向の見せ方として、床の minor な明度変化で「動いてる感」を出す
    const t = (Math.sin(this.uvOffset * Math.PI * 2) + 1) * 0.5;
    const base = 0xf7f0ec;
    const hi = 0xffe6ec;
    const r = ((base >> 16) & 0xff) * (1 - t) + ((hi >> 16) & 0xff) * t;
    const g = ((base >> 8) & 0xff) * (1 - t) + ((hi >> 8) & 0xff) * t;
    const b = (base & 0xff) * (1 - t) + (hi & 0xff) * t;
    this.groundMaterial.color.setRGB(r / 255, g / 255, b / 255);
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
