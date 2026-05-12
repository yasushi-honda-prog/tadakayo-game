import * as THREE from "three";
import { PhysicsWorld } from "./PhysicsWorld";
import { Player } from "../entities/Player";
import { ThirdPersonCamera } from "../entities/Camera";
import { Village } from "../world/Village";
import { Collectible } from "../entities/Collectible";
import { NPC } from "../entities/NPC";
import { DanceNpc } from "../entities/DanceNpc";
import { InputBus } from "../input/InputBus";
import { KeyboardMouseInput } from "../input/KeyboardMouseInput";
import { TouchInput } from "../input/TouchInput";
import { detectInputMode } from "../input/detectInput";
import { AudioManager } from "../audio/AudioManager";
import { TitleScreen } from "../ui/TitleScreen";
import { HUD } from "../ui/HUD";
import { MissionPanel } from "../ui/MissionPanel";
import { DialogBox } from "../ui/DialogBox";
import { MobileControls } from "../ui/MobileControls";
import { PauseMenu } from "../ui/PauseMenu";
import { ScoreScreen, type ScoreStats } from "../ui/ScoreScreen";
import { MissionManager } from "../missions/MissionManager";
import { Mission } from "../missions/Mission";
import { CollectMission } from "../missions/missions/CollectMission";
import { ReachMission } from "../missions/missions/ReachMission";
import { TalkMission } from "../missions/missions/TalkMission";
import { DanceMission } from "../missions/missions/DanceMission";
import { MetaMission } from "../missions/missions/MetaMission";
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
  private touchInput: TouchInput | null = null;
  private mobileControls: MobileControls | null = null;
  private readonly inputMode: "desktop" | "mobile";
  private readonly audio: AudioManager;
  private readonly titleScreen: TitleScreen;
  private readonly hud: HUD;
  private readonly missionPanel: MissionPanel;
  private readonly dialogBox: DialogBox;
  private readonly pauseMenu: PauseMenu;
  private readonly missions: MissionManager;
  private collectibles: Collectible[] = [];
  private npcs: NPC[] = [];
  private talkMission: TalkMission | null = null;
  private danceMission: DanceMission | null = null;
  private metaMission: MetaMission | null = null;
  private nearestInteractableNpc: NPC | null = null;
  private readonly actionHintEl: HTMLElement;
  private readonly actionHintTargetEl: HTMLElement;

  private accumulator = 0;
  /** Player の dance state エッジ検出用 (false→true で danceBgm 開始, true→false で停止) */
  private playerWasDancing = false;
  private lastTime = 0;
  private rafId: number | null = null;
  private disposed = false;
  private playing = false;
  private elapsed = 0;

  // Phase 5-F: 演出
  private skyDome: THREE.Mesh | null = null;
  private danceNpcs: DanceNpc[] = [];
  private playStartMs = 0;
  private scoreScreen!: ScoreScreen;
  private scoreScreenTimerId: ReturnType<typeof setTimeout> | null = null;

  constructor(canvas: HTMLCanvasElement, physics: PhysicsWorld) {
    this.physics = physics;
    this.bus = new InputBus();
    this.audio = new AudioManager();

    // シーン基盤
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BRAND_HEX.SKY_TOP);
    // Phase 5-F: フォグの遠方色を空底色に合わせて遠景の境目を消す + 開始距離を 24 に短縮して
    // 距離感を強める (元 28 → 24)
    this.scene.fog = new THREE.Fog(BRAND_HEX.SKY_BOTTOM, 24, 80);

    const hemi = new THREE.HemisphereLight(0xffffff, BRAND_HEX.PINK, 0.85);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xfff2e5, 1.0);
    dir.position.set(8, 18, 8);
    this.scene.add(dir);

    // Phase 5-F: スカイドーム (グラデーション内向き球)
    this.scene.add(this.buildSkyDome());
    // 注意 (PR #21): 接地影は sprite に焼き込まれた黒い楕円フットシャドウで担保。
    // 3D contact shadow は Player の object.position が capsule center (~0.55m) のため
    // 影が空中に浮く問題があり、PR #21 で全廃した。

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

    // 入力 (KB は常設、Touch は mobile 検出時のみ追加。両方共存可能)
    this.kbInput = new KeyboardMouseInput(canvas, this.bus);
    this.inputMode = detectInputMode();
    if (this.inputMode === "mobile") {
      this.mobileControls = new MobileControls();
      this.touchInput = new TouchInput(canvas, this.bus, this.mobileControls);
    }

    // UI
    this.titleScreen = new TitleScreen({
      onStart: () => void this.startPlay(),
      onMuteToggle: (m) => {
        this.audio.setMuted(m);
        // PauseMenu のラベル状態を同期 (タイトル画面の mute toggle ↔ ポーズメニューの mute toggle 連動)
        this.pauseMenu?.syncMuted(m);
      },
      initialMuted: this.audio.isMuted(),
    });
    this.hud = new HUD();
    this.missionPanel = new MissionPanel();
    this.dialogBox = new DialogBox();
    this.pauseMenu = new PauseMenu({
      initialMuted: this.audio.isMuted(),
      onResume: () => {
        if (this.inputMode === "mobile") this.mobileControls?.show();
      },
      onMuteToggle: (muted) => this.audio.setMuted(muted),
      onReset: () => this.resetToTitle(),
    });
    // Phase 5-F: スコア画面 (タダカヨ村マスター達成時)
    this.scoreScreen = new ScoreScreen({
      onReplay: () => {
        this.resetToTitle();
        // タイトル経由せず即プレイ再開: titleScreen を一瞬挟まず startPlay
        void this.startPlay();
      },
      onClose: () => this.resetToTitle(),
    });

    const hint = document.getElementById("hud-action-hint");
    const hintTarget = document.getElementById("hud-action-target");
    if (!hint || !hintTarget) throw new Error("hud-action-hint 要素が見つかりません");
    this.actionHintEl = hint;
    this.actionHintTargetEl = hintTarget;

    // ミッション基盤
    this.missions = new MissionManager();
    this.setupMissions();
    this.bindMissionListeners();

    this.bus.on((event) => {
      if (event === "panel") {
        // scoreScreen 表示中も M キーを無視 (Low 修正: スコア画面の裏で panel が開く問題)
        if (!this.playing || this.pauseMenu.isVisible() || this.scoreScreen.isVisible()) return;
        this.missionPanel.toggle();
        if (this.missionPanel.isOpen()) this.missionPanel.render(this.missions.all);
      } else if (event === "action") {
        this.handleActionPress();
      } else if (event === "pause") {
        this.handlePausePress();
      }
    });

    this.titleScreen.show();
  }

  /**
   * MissionManager.dispose() は listeners 配列を空にするため、
   * 初回 + resetToTitle 後の再構築の両方で listener を hook する必要がある。
   * (PR #15 Codex/Evaluator 双方が High バグとして指摘した「2 周目以降 HUD 更新 / SE が止まる」修正)
   */
  private bindMissionListeners(): void {
    this.missions.onChange(() => this.refreshMissionUI());
    this.missions.onCleared((m) => this.handleMissionCleared(m));
  }

  /**
   * mission cleared 時のハンドラ:
   * - Hit jingle 再生 + HUD で toast
   * - MetaMission に通知 (id 一致なら自身も cleared 判定)
   * - MetaMission 自身が cleared した場合は「タダカヨ村マスター」エンディング演出 + スコア画面
   */
  private handleMissionCleared(m: Mission): void {
    this.audio.missionClearSE();
    if (m instanceof MetaMission) {
      this.hud.flashClear(`🎉 ${m.title} 達成！`, 5000);
      // Phase 5-F: スコア画面を 0.8 秒遅延して開く (toast を読む間)。
      // resetToTitle / dispose との競合で stale show を防ぐため timer id を保持し、
      // 発火時にも disposed/playing の世代チェックを入れる (codex+evaluator High 修正)
      if (this.scoreScreenTimerId !== null) clearTimeout(this.scoreScreenTimerId);
      // Stage 3: firebase が依存する @types/node 導入で setTimeout の戻り値型が
      // ブラウザ env でも Node の Timeout になる。window.setTimeout (number 返却) ではなく
      // ReturnType<typeof setTimeout> として整合させる。
      this.scoreScreenTimerId = setTimeout(() => {
        this.scoreScreenTimerId = null;
        if (this.disposed || !this.playing) return;
        this.scoreScreen.show(this.collectStats());
      }, 800);
    } else {
      this.hud.flashClear(`クリア！ ${m.title}`);
    }
    if (this.metaMission !== null && !(m instanceof MetaMission)) {
      this.metaMission.notifyMissionCleared(m.id);
    }
  }

  /**
   * Phase 5-F: スコア画面に渡す統計を集める。
   * 各 mission の current/target をそのまま使うことで Single Source of Truth を維持。
   */
  private collectStats(): ScoreStats {
    const elapsedSec = (performance.now() - this.playStartMs) / 1000;
    const collect = this.missions.all.find((m) => m.id === "collect-dx-seeds");
    const reach = this.missions.all.find((m) => m.id === "reach-tower-top");
    return {
      elapsedSec,
      hearts: {
        current: collect?.current ?? 0,
        total: collect?.target ?? 10,
      },
      talks: {
        current: this.talkMission?.current ?? 0,
        total: this.talkMission?.target ?? 3,
      },
      dances: {
        current: this.danceMission?.current ?? 0,
        total: this.danceMission?.target ?? 3,
      },
      reachedTower: (reach?.current ?? 0) >= (reach?.target ?? 1),
    };
  }

  /** Phase 5-F: スカイドーム (内向き球、頂点カラーで上から下へグラデーション) */
  private buildSkyDome(): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(120, 32, 16);
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(BRAND_HEX.SKY_TOP) },
        bottomColor: { value: new THREE.Color(BRAND_HEX.SKY_BOTTOM) },
        offset: { value: 30 },
        exponent: { value: 0.7 },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos + vec3(0.0, offset, 0.0)).y;
          float t = pow(max(h, 0.0), exponent);
          gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
        }
      `,
    });
    const dome = new THREE.Mesh(geometry, material);
    dome.frustumCulled = false;
    this.skyDome = dome;
    return dome;
  }

  /**
   * Esc / P / pause ボタン押下時:
   * - playing 中だけ反応 (タイトル画面では無視)
   * - dialog/missionPanel が開いていれば閉じる優先
   * - それ以外で pauseMenu をトグル
   * - mobile では pauseMenu open 中は仮想コントローラを隠す
   */
  private handlePausePress(): void {
    if (!this.playing) return;
    if (this.dialogBox.isVisible()) {
      this.dialogBox.forceClose();
      return;
    }
    if (this.missionPanel.isOpen()) {
      this.missionPanel.toggle();
      return;
    }
    if (this.pauseMenu.isVisible()) {
      this.pauseMenu.toggle();
      if (this.inputMode === "mobile") this.mobileControls?.show();
    } else {
      // open 時に最新の mute 状態をラベルへ反映 (TitleScreen からの mute 変更を取り込む)
      this.pauseMenu.syncMuted(this.audio.isMuted());
      this.pauseMenu.open();
      if (this.inputMode === "mobile") {
        this.mobileControls?.hide();
        this.touchInput?.reset();
      }
    }
  }

  /**
   * E キー (action) 押下時のディスパッチ:
   * - DialogBox が開いていれば advance() して次の line へ
   * - 閉じていて最寄りの interactable NPC があれば会話開始
   * - それ以外でタダレク広場内なら Player を踊らせる (DanceMission クリア後も何度でも)
   *   ミッション未クリア時は notifyAction でカウントも加算
   * - pauseMenu open 中は無視
   */
  private handleActionPress(): void {
    if (!this.playing) return;
    if (this.pauseMenu.isVisible()) return;
    if (this.dialogBox.isVisible()) {
      this.audio.dialogSE();
      this.dialogBox.advance();
      return;
    }
    const npc = this.nearestInteractableNpc;
    if (npc !== null) {
      this.startNpcTalk(npc);
      return;
    }
    // タダレク広場内なら Player をダンス発火 (クリア後も繰り返し可)
    if (this.danceMission !== null) {
      const playerSnap = {
        x: this.player.position.x,
        y: this.player.position.y,
        z: this.player.position.z,
      };
      if (this.danceMission.isInArea(playerSnap)) {
        this.player.startDance();
        // 未クリア時のみカウント加算 (notifyAction は cleared 後 false を返す既存仕様)
        const advanced = this.danceMission.notifyAction(playerSnap);
        if (advanced) {
          this.audio.pickupSE();
          this.refreshMissionUI();
        }
      }
    }
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

    if (this.playing && !this.pauseMenu.isVisible() && !this.scoreScreen.isVisible()) {
      this.elapsed += dt;
      // 視点回転を取り込んでカメラ更新の前に
      this.camera.applyLookDelta();

      // 物理: 固定ステップ + accumulator で安定化
      this.accumulator += dt;
      while (this.accumulator >= PHYSICS.FIXED_DT) {
        this.player.update(PHYSICS.FIXED_DT, this.camera);
        this.physics.step();
        this.accumulator -= PHYSICS.FIXED_DT;
      }

      // dance state の edge 検出 → ダンス BGM の開始/停止 (village BGM ducking 含む)
      const dancingNow = this.player.isDancing();
      if (dancingNow !== this.playerWasDancing) {
        if (dancingNow) this.audio.startDanceBgm();
        else this.audio.stopDanceBgm();
        this.playerWasDancing = dancingNow;
      }

      this.camera.follow(this.player.position);

      // ミッション更新
      this.missions.update(this.player.position, dt);

      // Collectible アニメ (浮遊・回転)
      for (const c of this.collectibles) c.animate(dt);

      // NPC 近接判定 + 「E で話す」ヒント更新
      this.updateNpcsAndHint(this.player.position, dt);

      // Stage 1: 目標コンパス更新 (foreground mission の次目標までの方向 + 距離)
      this.updateCompass();

      // Phase 5-F: 村のアニメ (噴水・旗) + ダンス NPC
      this.village.animate(dt, this.elapsed);
      for (const d of this.danceNpcs) d.animate(dt);
    }

    this.renderer.render(this.scene, this.camera.camera);
  };

  /**
   * Phase 5-C のミッション 2 本を初期化:
   * 1. 「DXの種を集めよう」 = 中央広場・パス沿い・タダレク広場に Heart 10 個を配置して取得
   * 2. 「タダスクの塔へ」 = Village.landmarks.towerTop に到達
   */
  private setupMissions(): void {
    // Heart 10 個を村に分散配置。各スポット毎に「足元の床面 y」を指定して、
    // Collectible 内部の地面影 (y_in_object=0.02) が床下に隠れないようにする。
    // - 中央広場のピンク床: y=0.15 (床 thickness 0.075×2)
    // - タダレク広場の床: y=0.2
    // - 草地 / パス: y=0
    // Collectible.object.position.y = ground、内部 mesh は ground + 0.6 で浮遊。
    const spots: Array<{ x: number; y: number; z: number }> = [
      { x: 0, y: 0.15, z: 2 },     // 中央広場の南手前 (スポーン直後に見える)
      { x: -3, y: 0.15, z: -2 },   // 中央広場の左奥
      { x: 3, y: 0.15, z: -2 },    // 中央広場の右奥
      { x: -9, y: 0, z: 4 },       // 草地 (塔への道)
      { x: 9, y: 0, z: 4 },        // 草地 (広場への道)
      { x: -13, y: 0, z: 4 },      // 草地 (塔へさらに進んだ位置)
      { x: 13, y: 0, z: 4 },       // 草地 (広場の手前)
      { x: 18, y: 0.2, z: 1 },     // タダレク広場の入り口
      { x: 18, y: 0.2, z: 7 },     // タダレク広場の奥
      { x: 0, y: 0, z: -10 },      // 草地 (会館への道)
    ];
    for (const s of spots) {
      const c = new Collectible(new THREE.Vector3(s.x, s.y, s.z));
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

    // Phase 5-E: DanceMission (タダレク広場で 3 回アクション)
    const rekuCenter = this.village.landmarks.rekuCenter;
    const danceMission = new DanceMission({
      id: "dance-tadareku",
      title: "タダレク広場で踊ろう",
      description:
        "タダレク広場（村の東側、噴水のあるエリア）の中央に立って、E キー (アクション) を 3 回押してみましょう。レクリエーションは介護現場の元気の源です。",
      center: { x: rekuCenter.x, y: rekuCenter.y, z: rekuCenter.z },
      radius: 4.0,
      requiredCount: 3,
    });
    this.danceMission = danceMission;

    // Phase 5-E: MetaMission (4 ミッション全クリアでエンディング)
    const metaMission = new MetaMission({
      id: "tadakayo-master",
      title: "タダカヨ村マスター",
      description:
        "上の 4 つのミッションをすべて達成すると「タダカヨ村マスター」の称号が手に入ります。介護 DX の世界を完走しよう！",
      requiredMissionIds: [
        "collect-dx-seeds",
        "reach-tower-top",
        "talk-three-voices",
        "dance-tadareku",
      ],
    });
    this.metaMission = metaMission;

    this.missions.start(collectMission);
    this.missions.start(reachMission);
    this.missions.start(talkMission);
    this.missions.start(danceMission);
    this.missions.start(metaMission);
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

    // Phase 5-F: タダレク広場で自動的に踊る NPC を 2 体配置 (ミッション 4 のヒント)
    const reku = this.village.landmarks.rekuCenter;
    const dance1 = new DanceNpc({
      position: new THREE.Vector3(reku.x - 1.6, reku.y, reku.z + 1.6),
      phase: 0,
    });
    const dance2 = new DanceNpc({
      position: new THREE.Vector3(reku.x + 1.6, reku.y, reku.z - 1.4),
      phase: Math.PI / 2,
    });
    for (const d of [dance1, dance2]) {
      this.danceNpcs.push(d);
      this.scene.add(d.object);
    }
    // 注意: NPC / DanceNpc には contact shadow を付けない。Player より遠くにいる
    // NPC の影が、視野角や距離によって「キャラの頭の上に大きく浮いて見える」違和感を
    // 引き起こすため (ユーザー実機報告 PR #19 後)。Player の足元 shadow のみ維持する。
  }

  /**
   * Stage 1 (2026-05-13): 目標コンパスを毎フレーム更新する。
   *
   * - foreground mission を見て「次に行くべき XZ 座標」を決定 (`pickWaypoint`)
   * - 画面上での相対角度 = atan2(rightComp, forwardComp) で計算
   *   (camera.getForwardXZ / getRightXZ を内積に使う = 画面右が +、上が 0)
   * - foreground 不在 (= 全 mission クリア) または waypoint 不在 (MetaMission のみ
   *   残っている / dance/talk が cleared) なら null で非表示
   */
  private updateCompass(): void {
    const fg = this.missions.foreground;
    if (fg === null) {
      this.hud.setCompass(null);
      return;
    }
    const wp = this.pickWaypoint(fg);
    if (wp === null) {
      this.hud.setCompass(null);
      return;
    }
    const p = this.player.position;
    const dx = wp.position.x - p.x;
    const dz = wp.position.z - p.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.001) {
      // 真上に重なっている場合は矢印を回転させない (前回値を維持)
      this.hud.setCompass({
        angleRad: 0,
        label: wp.label,
        distanceM: 0,
      });
      return;
    }
    const fwd = this.camera.getForwardXZ();
    const right = this.camera.getRightXZ();
    const forwardComp = dx * fwd.x + dz * fwd.z;
    const rightComp = dx * right.x + dz * right.z;
    // atan2(右成分, 前成分): 前=0, 右=+π/2, 左=-π/2, 後ろ=±π
    const angleRad = Math.atan2(rightComp, forwardComp);
    this.hud.setCompass({ angleRad, label: wp.label, distanceM: distance });
  }

  /**
   * Stage 1: foreground mission から「次に行くべき waypoint」を決定する。
   *
   * 設計: Mission サブクラス側に getWaypoint() を生やすと NPC 配列依存の TalkMission が
   * 不自然になるため、Game 側で switch (instanceof) する集約方式を採用。
   * Mission の内部状態 (CollectMission の items, TalkMission の hasTalkedTo) は public
   * メソッド経由でアクセス。
   */
  private pickWaypoint(
    fg: Mission,
  ): { position: { x: number; z: number }; label: string } | null {
    if (fg instanceof CollectMission || fg.id === "collect-dx-seeds") {
      // 未取得のうち最寄りハート
      const p = this.player.position;
      let best: { x: number; z: number } | null = null;
      let bestDist = Infinity;
      for (const c of this.collectibles) {
        if (c.collected) continue;
        const cp = c.object.position;
        const d = Math.hypot(cp.x - p.x, cp.z - p.z);
        if (d < bestDist) {
          bestDist = d;
          best = { x: cp.x, z: cp.z };
        }
      }
      return best === null ? null : { position: best, label: "DXの種" };
    }
    if (fg instanceof ReachMission || fg.id === "reach-tower-top") {
      const t = this.village.landmarks.towerTop;
      return { position: { x: t.x, z: t.z }, label: "タダスクの塔" };
    }
    if (fg instanceof TalkMission || fg.id === "talk-three-voices") {
      // 未会話 NPC のうち最寄り。codex Stage 1 review #5 対応:
      // 「required かつ未会話」に限定し、脇役 NPC が目標化されるのを防ぐ。
      const tm = this.talkMission;
      if (tm === null) return null;
      const p = this.player.position;
      let best: { x: number; z: number; name: string } | null = null;
      let bestDist = Infinity;
      for (const n of this.npcs) {
        if (!tm.isRequiredNpc(n.id)) continue;
        if (tm.hasTalkedTo(n.id)) continue;
        const d = Math.hypot(n.position.x - p.x, n.position.z - p.z);
        if (d < bestDist) {
          bestDist = d;
          best = { x: n.position.x, z: n.position.z, name: n.displayName };
        }
      }
      if (best === null) return null;
      // ラベルは displayName の括弧前を抜き出して短く (例 "タダさん（利用者）" → "タダさん")
      const shortName = best.name.replace(/[（(].*$/, "").trim();
      return { position: { x: best.x, z: best.z }, label: shortName };
    }
    if (fg instanceof DanceMission || fg.id === "dance-tadareku") {
      const c = this.village.landmarks.rekuCenter;
      return { position: { x: c.x, z: c.z }, label: "タダレク広場" };
    }
    // MetaMission など waypoint を持たない type は null
    return null;
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
    if (this.inputMode === "mobile") this.mobileControls?.show();
    // Phase 5-F: スタート時刻記録
    this.playStartMs = performance.now();
    this.elapsed = 0;
    // Stage 4: オープニング演出 (画面上端のコンパスへの誘導)。4.5 秒で自動消滅。
    this.hud.flashClear(
      "ようこそ、タダカヨ村へ！　画面上の▲が次の目標を示します",
      4500,
      "welcome",
    );
    // **contact shadow は無効化**: Player の object.position は physics capsule の center
    // (地面 +0.55m) のため、影 mesh が「キャラの腰〜頭の高さ」に空中固定されて表示される
    // 違和感があった (PR #20 後ユーザー実機報告)。sprite には既に fix-sprites.py で
    // 黒い楕円フットシャドウが焼き込まれているため、3D contact shadow を全廃しても
    // 接地表現は維持される。
    this.playing = true;
  }

  /**
   * タイトル画面に戻る (Phase 5-E ポーズメニュー「タイトルに戻る」から呼ばれる)。
   *
   * 既存 mission/collectible/npc を完全 dispose して setupMissions() で再構築する方針。
   * これにより:
   * - 「2 周目に取得済みハートが透明のまま」「会話済み NPC が talked のまま」等の状態残留を確実に防ぐ
   * - 1 回 reset すると collectible 10 + npc 3 + mission 5 が再生成される (~30KB のテクスチャ再 load
   *   は THREE.TextureLoader のキャッシュで実質ゼロ負荷)
   *
   * **責務注意**: pauseMenu.close は呼び出し側 (PauseMenu の handleReset) で実行済み。
   * このメソッドは「ゲーム状態のリセット」だけを行う。
   */
  private resetToTitle(): void {
    this.playing = false;
    this.audio.stopBgm();
    this.dialogBox.forceClose();
    this.hideActionHint();
    this.nearestInteractableNpc = null;
    if (this.missionPanel.isOpen()) this.missionPanel.toggle();
    // Phase 5-F: scoreScreen reopen 競合防止 + pauseMenu が ScoreScreen 経由で残るのを防ぐ
    // (codex High 修正: scoreScreen onReplay 経路でも pauseMenu が閉じることを保証)
    if (this.scoreScreenTimerId !== null) {
      clearTimeout(this.scoreScreenTimerId);
      this.scoreScreenTimerId = null;
    }
    this.scoreScreen.hide();
    this.pauseMenu.close();
    if (this.inputMode === "mobile") {
      this.mobileControls?.hide();
      this.touchInput?.reset();
    }

    // entity / mission のクリーンアップ
    for (const c of this.collectibles) {
      this.scene.remove(c.object);
      c.dispose();
    }
    this.collectibles = [];
    for (const n of this.npcs) {
      this.scene.remove(n.object);
      n.dispose();
    }
    this.npcs = [];
    // Phase 5-F: ダンス NPC + contact shadow の clean up (player shadow 含めて全消し)
    for (const d of this.danceNpcs) {
      this.scene.remove(d.object);
      d.dispose();
    }
    this.danceNpcs = [];
    this.missions.dispose();
    this.talkMission = null;
    this.danceMission = null;
    this.metaMission = null;

    // 再構築 + プレイヤー位置リセット + カメラ初期化 (yaw/pitch を constructor 時の状態に戻す)
    this.setupMissions();
    this.bindMissionListeners(); // missions.dispose() で消えた listener を再 hook
    this.player.resetPosition();
    this.camera.setInitial(this.player.position);
    this.refreshMissionUI();
    this.pauseMenu.syncMuted(this.audio.isMuted());

    // UI: HUD 非表示 + タイトル表示
    this.hud.hide();
    this.titleScreen.show();
  }

  private handleResize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
  };

  dispose(): void {
    this.disposed = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    if (this.scoreScreenTimerId !== null) {
      clearTimeout(this.scoreScreenTimerId);
      this.scoreScreenTimerId = null;
    }
    window.removeEventListener("resize", this.handleResize);
    this.kbInput.dispose();
    this.touchInput?.dispose();
    this.pauseMenu.dispose();
    this.scoreScreen.dispose();
    this.mobileControls?.hide();
    this.player.dispose();
    this.camera.dispose();
    this.village.dispose();
    for (const c of this.collectibles) c.dispose();
    for (const n of this.npcs) n.dispose();
    for (const d of this.danceNpcs) d.dispose();
    if (this.skyDome !== null) {
      const m = this.skyDome.material;
      if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
      else m.dispose();
      this.skyDome.geometry.dispose();
    }
    this.missions.dispose();
    this.audio.dispose();
    this.renderer.dispose();
  }
}
