import * as THREE from "three";
import { PhysicsWorld } from "./PhysicsWorld";
import { Player } from "../entities/Player";
import { ThirdPersonCamera } from "../entities/Camera";
import { Village } from "../world/Village";
import { Collectible } from "../entities/Collectible";
import { NPC } from "../entities/NPC";
import { InputBus } from "../input/InputBus";
import { KeyboardMouseInput } from "../input/KeyboardMouseInput";
import { AudioManager } from "../audio/AudioManager";
import { TitleScreen } from "../ui/TitleScreen";
import { HUD } from "../ui/HUD";
import { MissionPanel } from "../ui/MissionPanel";
import { DialogBox } from "../ui/DialogBox";
import { MissionManager } from "../missions/MissionManager";
import { CollectMission } from "../missions/missions/CollectMission";
import { ReachMission } from "../missions/missions/ReachMission";
import { TalkMission } from "../missions/missions/TalkMission";
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
  private readonly dialogBox: DialogBox;
  private readonly missions: MissionManager;
  private readonly collectibles: Collectible[] = [];
  private readonly npcs: NPC[] = [];
  private talkMission: TalkMission | null = null;
  private nearestInteractableNpc: NPC | null = null;
  private readonly actionHintEl: HTMLElement;
  private readonly actionHintTargetEl: HTMLElement;

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
    this.dialogBox = new DialogBox();

    const hint = document.getElementById("hud-action-hint");
    const hintTarget = document.getElementById("hud-action-target");
    if (!hint || !hintTarget) throw new Error("hud-action-hint 要素が見つかりません");
    this.actionHintEl = hint;
    this.actionHintTargetEl = hintTarget;

    // ミッション基盤
    this.missions = new MissionManager();
    this.setupMissions();

    this.bus.on((event) => {
      if (event === "panel") {
        this.missionPanel.toggle();
        if (this.missionPanel.isOpen()) this.missionPanel.render(this.missions.all);
      } else if (event === "action") {
        this.handleActionPress();
      }
    });
    this.missions.onChange(() => this.refreshMissionUI());
    this.missions.onCleared((m) => {
      this.audio.missionClearSE();
      this.hud.flashClear(`クリア！ ${m.title}`);
    });

    this.titleScreen.show();
  }

  /**
   * E キー (action) 押下時のディスパッチ:
   * - DialogBox が開いていれば advance() して次の line へ
   * - 閉じていて最寄りの interactable NPC があれば会話開始
   * - それ以外は何もしない
   */
  private handleActionPress(): void {
    if (!this.playing) return;
    if (this.dialogBox.isVisible()) {
      this.audio.dialogSE();
      this.dialogBox.advance();
      return;
    }
    const npc = this.nearestInteractableNpc;
    if (npc !== null) this.startNpcTalk(npc);
  }

  private startNpcTalk(npc: NPC): void {
    npc.startTalk();
    this.hideActionHint();
    this.audio.dialogOpenSE();
    this.dialogBox.open(npc.displayName, npc.lines, () => {
      // 会話完了: TalkMission に通知 + NPC を idle に戻す
      npc.endTalk();
      if (this.talkMission !== null) this.talkMission.notifyTalked(npc.id);
      // notifyTalked が状態変えても MissionManager.update のループ外なので
      // 進捗反映用に手動で onChange 相当を呼ぶ (foreground 切替反映)
      this.refreshMissionUI();
    });
  }

  private updateNpcsAndHint(playerPos: THREE.Vector3, dt: number): void {
    const playerSnap = { x: playerPos.x, y: playerPos.y, z: playerPos.z };
    let nearest: NPC | null = null;
    let nearestDist = Infinity;
    for (const npc of this.npcs) {
      npc.updateProximity(playerSnap, dt);
      if (npc.isInteractable()) {
        const dx = playerPos.x - npc.position.x;
        const dz = playerPos.z - npc.position.z;
        const d = Math.hypot(dx, dz);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = npc;
        }
      }
    }
    this.nearestInteractableNpc = nearest;

    if (nearest !== null && !this.dialogBox.isVisible()) {
      this.actionHintTargetEl.textContent = `で ${nearest.displayName} と話す`;
      this.actionHintEl.classList.remove("hidden");
    } else {
      this.hideActionHint();
    }
  }

  private hideActionHint(): void {
    this.actionHintEl.classList.add("hidden");
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

      // NPC 近接判定 + 「E で話す」ヒント更新
      this.updateNpcsAndHint(this.player.position, dt);

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

    // Phase 5-D: NPC 3 体 + Talk ミッション「現場の声を聞こう」
    this.setupNpcs();
    const talkMission = new TalkMission({
      id: "talk-three-voices",
      title: "現場の声を聞こう",
      description:
        "タダカヨ村にいる 3 人の住人 (利用者・看護師・施設長) と E キーで話してみましょう。介護現場のリアルな声が、DX のヒントになります。",
      requiredNpcIds: this.npcs.map((n) => n.id),
    });
    this.talkMission = talkMission;

    this.missions.start(collectMission);
    this.missions.start(reachMission);
    this.missions.start(talkMission);
  }

  /**
   * Phase 5-D の NPC 3 体を村に配置する。
   * - 高齢者: タダレク広場のベンチ近く (15.4, 0, 4)
   * - 看護師: タダコミュ会館の入口前 (landmarks.hallEntrance)
   * - 施設長: 中央広場の南東 (3, 0, 3)
   */
  private setupNpcs(): void {
    const elderPos = new THREE.Vector3(15.4, 0, 4);
    const nursePos = this.village.landmarks.hallEntrance.clone();
    const managerPos = new THREE.Vector3(3, 0, 3);

    const elder = new NPC({
      id: "elder",
      displayName: "タダさん（利用者）",
      spriteName: "npc-elder",
      position: elderPos,
      lines: [
        "いやあ、最近のスマホは便利だねえ。",
        "孫の写真を見られるのが何より楽しみだよ。",
        "あんたみたいな若い人が、私たちのことを考えてくれるのは嬉しいねえ。",
      ],
    });

    const nurse = new NPC({
      id: "nurse",
      displayName: "カヨさん（看護師）",
      spriteName: "npc-nurse",
      position: nursePos,
      lines: [
        "お疲れさまです。日々の記録、書くのに時間がかかって大変なんです。",
        "音声入力やテンプレートがもう少し使いやすくなったら、利用者さんと向き合う時間が増えると思います。",
        "現場の声を聞いてもらえるのは本当にありがたいです。",
      ],
    });

    const manager = new NPC({
      id: "manager",
      displayName: "ヨシオさん（施設長）",
      spriteName: "npc-manager",
      position: managerPos,
      lines: [
        "タダカヨ村へようこそ。私はこの施設の運営を任されています。",
        "DX というと難しく聞こえますが、要は職員の負担を減らして利用者さんとの時間を増やすこと。",
        "現場主導で考えてくれる仲間が増えると、本当に心強いですよ。",
      ],
    });

    for (const n of [elder, nurse, manager]) {
      this.npcs.push(n);
      this.scene.add(n.object);
    }
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
    for (const n of this.npcs) n.dispose();
    this.missions.dispose();
    this.audio.dispose();
    this.renderer.dispose();
  }
}
