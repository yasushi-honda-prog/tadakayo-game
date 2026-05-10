import * as THREE from "three";
import { PhysicsWorld } from "./PhysicsWorld";
import { Player } from "../entities/Player";
import { ThirdPersonCamera } from "../entities/Camera";
import { Village } from "../world/Village";
import { Collectible } from "../entities/Collectible";
import { InputBus } from "../input/InputBus";
import { KeyboardMouseInput } from "../input/KeyboardMouseInput";
import { AudioManager } from "../audio/AudioManager";
import { TitleScreen } from "../ui/TitleScreen";
import { HUD } from "../ui/HUD";
import { MissionPanel } from "../ui/MissionPanel";
import { MissionManager } from "../missions/MissionManager";
import { CollectMission } from "../missions/missions/CollectMission";
import { ReachMission } from "../missions/missions/ReachMission";
import { BRAND_HEX } from "../config/brand";
import { PHYSICS } from "../config/gameConfig";

/**
 * 3D オープンワールド（Phase 5-C）のメインゲームクラス。
 * シーン・物理・プレイヤー・カメラ・ミッションを束ねて毎フレーム更新する。
 */
export class Game {
  private readonly scene: THREE.Scene;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly physics: PhysicsWorld;
  private readonly player: Player;
  private readonly camera: ThirdPersonCamera;
  private readonly village: Village;
  private readonly bus: InputBus;
  private readonly kbInput: KeyboardMouseInput;
  private readonly audio: AudioManager;
  private readonly titleScreen: TitleScreen;
  private readonly hud: HUD;
  private readonly missionPanel: MissionPanel;
  private readonly missions: MissionManager;
  private readonly collectibles: Collectible[] = [];

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
    this.village = new Village(physics);
    this.scene.add(this.village.object);
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
    this.missionPanel = new MissionPanel();

    // ミッション基盤
    this.missions = new MissionManager();
    this.setupMissions();

    this.bus.on((event) => {
      if (event === "panel") {
        this.missionPanel.toggle();
        if (this.missionPanel.isOpen()) this.missionPanel.render(this.missions.all);
      }
    });
    this.missions.onChange(() => this.refreshMissionUI());
    this.missions.onCleared((m) => {
      this.audio.missionClearSE();
      this.hud.flashClear(`クリア！ ${m.title}`);
    });

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

      // ミッション更新
      this.missions.update(this.player.position, dt);

      // Collectible アニメ (浮遊・回転)
      for (const c of this.collectibles) c.animate(dt);

      this.hud.update({
        x: this.player.position.x,
        y: this.player.position.y,
        z: this.player.position.z,
      });
    }

    this.renderer.render(this.scene, this.camera.camera);
  };

  /**
   * Phase 5-C のミッション 2 本を初期化:
   * 1. 「DXの種を集めよう」 = 中央広場・パス沿い・タダレク広場に Heart 10 個を配置して取得
   * 2. 「タダスクの塔へ」 = Village.landmarks.towerTop に到達
   */
  private setupMissions(): void {
    // Heart 10 個を村に分散配置。プレイヤーが歩きやすい高さ (y=0.4) に置き、
    // Collectible 内部で浮遊オフセット (+0.6) が付く。
    const spots: Array<[number, number]> = [
      [0, 2],         // 中央広場の南手前 (スポーン直後に見える)
      [-3, -2],       // 中央広場の左奥
      [3, -2],        // 中央広場の右奥
      [-9, 4],        // 塔への道
      [9, 4],         // 広場への道
      [-13, 4],       // 塔へさらに進んだ位置
      [13, 4],        // 広場の手前
      [18, 1],        // タダレク広場の入り口
      [18, 7],        // タダレク広場の奥
      [0, -10],       // 会館への道
    ];
    for (const [x, z] of spots) {
      const c = new Collectible(new THREE.Vector3(x, 0.4, z));
      c.onCollect(() => this.audio.pickupSE());
      this.collectibles.push(c);
      this.scene.add(c.object);
    }

    const collectMission = new CollectMission({
      id: "collect-dx-seeds",
      title: "DXの種を集めよう",
      description:
        "村のあちこちに散らばっている赤い「DXの種」(ハート) を集めてください。介護現場のちょっとした工夫が、タダカヨ村の DX 力になります。",
      items: this.collectibles,
    });

    const reachMission = new ReachMission({
      id: "reach-tower-top",
      title: "タダスクの塔へ",
      description:
        "村の西にある「タダスクの塔」の頂上まで、5 段のジャンプアスレチックを登りきってください。Space キーでジャンプできます。",
      target: this.village.landmarks.towerTop,
      radius: 1.8,
    });

    this.missions.start(collectMission);
    this.missions.start(reachMission);
  }

  private refreshMissionUI(): void {
    const fg = this.missions.foreground;
    if (fg === null) {
      this.hud.setMission(null);
    } else {
      this.hud.setMission({ title: fg.title, progress: fg.progressText() });
    }
    if (this.missionPanel.isOpen()) {
      this.missionPanel.render(this.missions.all);
    }
  }

  private async startPlay(): Promise<void> {
    await this.audio.ensureStarted();
    this.audio.startBgm();
    this.player.resetPosition();
    this.titleScreen.hide();
    this.hud.show();
    this.refreshMissionUI();
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
    this.village.dispose();
    for (const c of this.collectibles) c.dispose();
    this.missions.dispose();
    this.audio.dispose();
    this.renderer.dispose();
  }
}
