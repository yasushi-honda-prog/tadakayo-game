import * as THREE from "three";
import { PhysicsWorld } from "./PhysicsWorld";
import { Player } from "../entities/Player";
import { ThirdPersonCamera } from "../entities/Camera";
import { TestArena } from "../world/TestArena";
import { InputBus } from "../input/InputBus";
import { KeyboardMouseInput } from "../input/KeyboardMouseInput";
import { AudioManager } from "../audio/AudioManager";
import { TitleScreen } from "../ui/TitleScreen";
import { HUD } from "../ui/HUD";
import { BRAND_HEX } from "../config/brand";
import { PHYSICS } from "../config/gameConfig";

/**
 * 3D オープンワールド（Phase 5-A）のメインゲームクラス。
 * シーン・レンダラ・物理・プレイヤー・カメラを束ねて毎フレーム更新する。
 */
export class Game {
  private readonly scene: THREE.Scene;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly physics: PhysicsWorld;
  private readonly player: Player;
  private readonly camera: ThirdPersonCamera;
  private readonly arena: TestArena;
  private readonly bus: InputBus;
  private readonly kbInput: KeyboardMouseInput;
  private readonly audio: AudioManager;
  private readonly titleScreen: TitleScreen;
  private readonly hud: HUD;

  private accumulator = 0;
  private lastTime = 0;
  private rafId: number | null = null;
  private disposed = false;
  private playing = false;

  constructor(canvas: HTMLCanvasElement, physics: PhysicsWorld) {
    this.physics = physics;
    this.bus = new InputBus();
    this.audio = new AudioManager();

    // シーン基盤
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BRAND_HEX.SKY_TOP);
    this.scene.fog = new THREE.Fog(BRAND_HEX.SKY_BOTTOM, 28, 80);

    const hemi = new THREE.HemisphereLight(0xffffff, BRAND_HEX.PINK, 0.85);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xfff2e5, 1.0);
    dir.position.set(8, 18, 8);
    this.scene.add(dir);

    // 描画
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.handleResize();
    window.addEventListener("resize", this.handleResize);

    // ワールド・プレイヤー・カメラ
    this.arena = new TestArena(physics);
    this.scene.add(this.arena.object);
    this.player = new Player(physics, this.bus);
    this.scene.add(this.player.object);
    this.camera = new ThirdPersonCamera(this.bus);
    this.camera.setInitial(this.player.position);

    // 入力
    this.kbInput = new KeyboardMouseInput(canvas, this.bus);

    // UI
    this.titleScreen = new TitleScreen({
      onStart: () => void this.startPlay(),
      onMuteToggle: (m) => this.audio.setMuted(m),
      initialMuted: this.audio.isMuted(),
    });
    this.hud = new HUD();

    this.titleScreen.show();
  }

  start(): void {
    this.lastTime = performance.now();
    this.loop();
  }

  private loop = (): void => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.loop);

    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > 0.1) dt = 0.1;

    if (this.playing) {
      // 視点回転を取り込んでカメラ更新の前に
      this.camera.applyLookDelta();

      // 物理: 固定ステップ + accumulator で安定化
      this.accumulator += dt;
      while (this.accumulator >= PHYSICS.FIXED_DT) {
        this.player.update(PHYSICS.FIXED_DT, this.camera);
        this.physics.step();
        this.accumulator -= PHYSICS.FIXED_DT;
      }

      this.camera.follow(this.player.position);
      this.hud.update({
        x: this.player.position.x,
        y: this.player.position.y,
        z: this.player.position.z,
      });
    }

    this.renderer.render(this.scene, this.camera.camera);
  };

  private async startPlay(): Promise<void> {
    await this.audio.ensureStarted();
    this.audio.startBgm();
    this.player.resetPosition();
    this.titleScreen.hide();
    this.hud.show();
    this.playing = true;
  }

  private handleResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
  };

  dispose(): void {
    this.disposed = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    window.removeEventListener("resize", this.handleResize);
    this.kbInput.dispose();
    this.player.dispose();
    this.camera.dispose();
    this.arena.dispose();
    this.audio.dispose();
    this.renderer.dispose();
  }
}
