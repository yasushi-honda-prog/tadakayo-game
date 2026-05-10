import * as THREE from "three";
import { BRAND_HEX } from "../config/brand";

export class GameScene {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  private readonly bgPlane: THREE.Mesh;
  private readonly fog: THREE.Fog;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BRAND_HEX.SKY_TOP);
    this.fog = new THREE.Fog(BRAND_HEX.SKY_BOTTOM, 24, 70);
    this.scene.fog = this.fog;

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 200);
    this.camera.position.set(0, 4.2, 7.5);
    this.camera.lookAt(0, 1.0, -8);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = false;

    const hemi = new THREE.HemisphereLight(0xffffff, BRAND_HEX.PINK, 0.85);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xfff2e5, 1.0);
    dir.position.set(5, 12, 6);
    this.scene.add(dir);

    // 後ろのゴール雲
    const cloudGeom = new THREE.PlaneGeometry(40, 14);
    const cloudMat = new THREE.MeshBasicMaterial({
      color: BRAND_HEX.PINK,
      transparent: true,
      opacity: 0.85,
    });
    this.bgPlane = new THREE.Mesh(cloudGeom, cloudMat);
    this.bgPlane.position.set(0, 7, -55);
    this.scene.add(this.bgPlane);

    this.handleResize();
    window.addEventListener("resize", this.handleResize);
  }

  /** ステージ移行時に色相を変える */
  setPalette(skyTop: number, skyBottom: number, accent: number): void {
    (this.scene.background as THREE.Color).setHex(skyTop);
    this.fog.color.setHex(skyBottom);
    ((this.bgPlane.material as THREE.MeshBasicMaterial).color as THREE.Color).setHex(accent);
  }

  private handleResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    window.removeEventListener("resize", this.handleResize);
    this.renderer.dispose();
  }
}
