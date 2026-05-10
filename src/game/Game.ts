import * as THREE from "three";
import { GameScene } from "./Scene";
import { Player } from "./Player";
import { Track } from "./Track";
import { Input } from "./Input";
import { Obstacle } from "./Obstacle";
import { Collectible } from "./Collectible";
import { Spawner } from "./Spawner";
import { GameState } from "./GameState";
import { SCORE, SPEED, STAGE, STORAGE_KEYS, DIFFICULTY, type Difficulty } from "../config/gameConfig";
import { TitleScreen } from "../ui/TitleScreen";
import { HUD } from "../ui/HUD";
import { ResultScreen } from "../ui/ResultScreen";
import { AudioManager } from "../audio/AudioManager";

export class Game {
  private readonly scene: GameScene;
  private readonly player: Player;
  private readonly track: Track;
  private readonly input: Input;
  private readonly spawner = new Spawner();
  private readonly state = new GameState();
  private readonly titleScreen: TitleScreen;
  private readonly hud: HUD;
  private readonly resultScreen: ResultScreen;
  private readonly audio = new AudioManager();

  private obstacles: Obstacle[] = [];
  private collectibles: Collectible[] = [];

  private lastTime = 0;
  private elapsed = 0;
  private speed: number = SPEED.INITIAL;
  private rafId: number | null = null;
  private disposed = false;
  private currentStageIndex = 0;
  private difficulty: Difficulty = "normal";
  private prevCombo = 0;
  private tutorialShown = false;
  private tipTimers: number[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new GameScene(canvas);
    this.track = new Track();
    this.player = new Player();
    this.scene.scene.add(this.track.object);
    this.scene.scene.add(this.player.object);

    this.input = new Input(canvas);
    this.input.on((event) => {
      if (this.state.status !== "playing") return;
      if (event.type === "lane") this.player.changeLane(event.delta);
      else if (event.type === "jump") {
        this.player.jump();
        this.audio.jumpSE();
      } else if (event.type === "crouch") {
        this.player.crouch();
        this.audio.crouchSE();
      }
    });

    // 永続化からハイスコア / 難易度 / 音設定を読込
    const stored = Number(localStorage.getItem(STORAGE_KEYS.HIGH_SCORE));
    if (Number.isFinite(stored) && stored > 0) {
      this.state.stats.highScore = Math.floor(stored);
    }
    const storedDiff = localStorage.getItem(STORAGE_KEYS.DIFFICULTY) as Difficulty | null;
    if (storedDiff && storedDiff in DIFFICULTY) {
      this.difficulty = storedDiff;
    }
    this.tutorialShown = localStorage.getItem("tadakayo-game.tutorial.shown") === "1";

    this.titleScreen = new TitleScreen({
      onStart: () => void this.startPlay(),
      onDifficultyChange: (d) => this.setDifficulty(d),
      onMuteToggle: (m) => this.audio.setMuted(m),
      initialDifficulty: this.difficulty,
      initialMuted: this.audio.isMuted(),
      highScore: this.state.stats.highScore,
    });
    this.hud = new HUD();
    this.resultScreen = new ResultScreen(() => void this.startPlay());

    this.titleScreen.show();
  }

  start(): void {
    this.lastTime = performance.now();
    this.loop();
  }

  private setDifficulty(d: Difficulty): void {
    this.difficulty = d;
    localStorage.setItem(STORAGE_KEYS.DIFFICULTY, d);
  }

  private loop = (): void => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.loop);

    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > 0.1) dt = 0.1;

    if (this.state.status === "playing") {
      this.updatePlaying(dt);
    } else {
      this.track.update(dt, 3);
      this.player.update(dt);
    }

    this.scene.render();
  };

  private updatePlaying(dt: number): void {
    this.elapsed += dt;
    const diffCfg = DIFFICULTY[this.difficulty];

    // 速度上昇（難易度倍率）
    const baseSpeed = Math.min(SPEED.MAX, SPEED.INITIAL + (this.elapsed / 10) * SPEED.PER_10_SEC);
    this.speed = baseSpeed * diffCfg.speedScale;

    // 距離 + コンボタイマー減算
    const prevDistance = this.state.stats.distance;
    const newDistance = Math.floor(this.elapsed * this.speed);
    this.state.setDistance(newDistance);
    if (newDistance > prevDistance) {
      this.state.addDistanceScore(newDistance - prevDistance);
    }
    this.state.tickCombo(dt);

    // ステージ進行チェック
    this.checkStageProgression(newDistance);

    // 各オブジェクト更新
    this.player.update(dt);
    this.track.update(dt, this.speed);
    for (const o of this.obstacles) o.update(dt, this.speed);
    for (const c of this.collectibles) c.update(dt, this.speed);

    // スポーン
    const spawn = this.spawner.update(dt, this.elapsed);
    if (spawn) {
      for (const o of spawn.obstacles) {
        this.obstacles.push(o);
        this.scene.scene.add(o.object);
      }
      for (const c of spawn.collectibles) {
        this.collectibles.push(c);
        this.scene.scene.add(c.object);
      }
    }

    // 衝突判定（シールド中は破壊して通過）
    const hitbox = this.player.getHitbox();
    const pickup = this.player.getPickupBox();

    for (const o of this.obstacles) {
      if (o.destroyed) continue;
      if (hitbox.intersectsBox(o.getHitbox())) {
        if (this.player.isShielded()) {
          o.destroyed = true;
          this.audio.shieldSE();
        } else {
          this.audio.hitSE();
          this.gameOver();
          return;
        }
      }
    }

    for (const c of this.collectibles) {
      if (!c.collected && pickup.intersectsBox(c.getBox())) {
        c.collected = true;
        this.state.addPickup();
        this.audio.pickupSE();
        if (this.state.shouldActivateShield()) {
          this.player.activateShield(SCORE.SHIELD_DURATION_SEC);
          this.state.consumeShieldStreak();
          this.audio.shieldSE();
        }
      }
    }

    // 画面外掃除
    this.obstacles = this.cleanup(this.obstacles, (o) => o.isOutOfRange());
    this.collectibles = this.cleanup(this.collectibles, (c) => c.isOutOfRange() || c.collected);

    // コンボ達成のキラキラ演出
    this.checkComboBurst();

    // HUD 更新
    this.hud.update({
      score: Math.floor(this.state.stats.score),
      distance: this.state.stats.distance,
      combo: this.state.stats.combo,
      multiplier: this.state.currentMultiplier(),
      shielded: this.player.isShielded(),
      streak: this.state.stats.pickupStreak,
      streakRequired: SCORE.SHIELD_PICKUPS_REQUIRED,
      stageName: STAGE.NAMES[this.currentStageIndex] ?? "",
    });
  }

  private checkComboBurst(): void {
    const c = this.state.stats.combo;
    const milestones: { at: number; text: string }[] = [
      { at: 5, text: "GREAT!" },
      { at: 10, text: "AMAZING!" },
      { at: 15, text: "AWESOME!" },
      { at: 20, text: "INCREDIBLE!" },
      { at: 30, text: "UNSTOPPABLE!" },
      { at: 50, text: "LEGENDARY!" },
    ];
    for (const m of milestones) {
      if (this.prevCombo < m.at && c >= m.at) {
        this.hud.burstCombo(m.text);
        this.audio.stageUpSE();
        break;
      }
    }
    this.prevCombo = c;
  }

  private scheduleTutorial(): void {
    for (const t of this.tipTimers) clearTimeout(t);
    this.tipTimers = [];
    const tips: { delay: number; text: string }[] = [
      { delay: 1200, text: "← → で左右に移動！" },
      { delay: 5200, text: "↑ または Space でジャンプ！" },
      { delay: 9200, text: "↓ または Shift でしゃがむ！" },
      { delay: 13200, text: "空中のハート列はジャンプで連取してコンボを稼ごう！" },
    ];
    for (const t of tips) {
      this.tipTimers.push(
        window.setTimeout(() => {
          if (this.state.status === "playing") this.hud.showTutorialTip(t.text);
        }, t.delay)
      );
    }
    this.tipTimers.push(
      window.setTimeout(() => {
        localStorage.setItem("tadakayo-game.tutorial.shown", "1");
        this.tutorialShown = true;
      }, 18000)
    );
  }

  private clearTutorialTimers(): void {
    for (const t of this.tipTimers) clearTimeout(t);
    this.tipTimers = [];
    this.hud.hideTutorialTip();
  }

  private checkStageProgression(distance: number): void {
    // 距離しきい値を超えたら次のステージへ
    let newIndex = 0;
    for (let i = 0; i < STAGE.THRESHOLDS.length; i++) {
      if (distance >= STAGE.THRESHOLDS[i]) newIndex = i;
    }
    if (newIndex !== this.currentStageIndex) {
      this.currentStageIndex = newIndex;
      const palette = STAGE.PALETTES[Math.min(newIndex, STAGE.PALETTES.length - 1)];
      this.scene.setPalette(palette.sky, palette.skyBottom, palette.accent);
      const stageName = STAGE.NAMES[newIndex] ?? "ゴール";
      if (newIndex > 0) {
        this.hud.flashStage(`ステージ${newIndex + 1}: ${stageName}`);
        this.audio.stageUpSE();
      }
    }
  }

  private cleanup<T extends { object: THREE.Object3D; dispose(): void }>(arr: T[], pred: (item: T) => boolean): T[] {
    const remain: T[] = [];
    for (const item of arr) {
      if (pred(item)) {
        this.scene.scene.remove(item.object);
        item.dispose();
      } else {
        remain.push(item);
      }
    }
    return remain;
  }

  private async startPlay(): Promise<void> {
    await this.audio.ensureStarted();
    this.audio.startBgm();

    const diffCfg = DIFFICULTY[this.difficulty];
    this.spawner.setDifficulty(diffCfg.spawnIntervalScale, diffCfg.obstacleRatio);

    this.clearWorld();
    this.clearTutorialTimers();
    this.state.reset();
    this.prevCombo = 0;
    this.elapsed = 0;
    this.speed = SPEED.INITIAL * diffCfg.speedScale;
    this.spawner.reset();
    this.player.resetPosition();
    this.currentStageIndex = 0;
    this.scene.setPalette(STAGE.PALETTES[0].sky, STAGE.PALETTES[0].skyBottom, STAGE.PALETTES[0].accent);
    if (!this.tutorialShown) this.scheduleTutorial();

    this.titleScreen.hide();
    this.resultScreen.hide();
    this.hud.show();
    this.hud.update({
      score: 0,
      distance: 0,
      combo: 0,
      multiplier: 1,
      shielded: false,
      streak: 0,
      streakRequired: SCORE.SHIELD_PICKUPS_REQUIRED,
      stageName: STAGE.NAMES[0],
    });

    this.state.status = "playing";
  }

  private gameOver(): void {
    this.state.status = "result";
    this.audio.stopBgm();
    this.audio.gameOverSE();
    this.clearTutorialTimers();
    const newRecord = this.state.finalize();
    localStorage.setItem(STORAGE_KEYS.HIGH_SCORE, String(this.state.stats.highScore));

    this.hud.hide();
    this.resultScreen.show({
      score: this.state.stats.score,
      distance: this.state.stats.distance,
      highScore: this.state.stats.highScore,
      bestCombo: this.state.stats.bestCombo,
      newRecord,
      stageName: STAGE.NAMES[this.currentStageIndex] ?? "",
    });
  }

  private clearWorld(): void {
    for (const o of this.obstacles) {
      this.scene.scene.remove(o.object);
      o.dispose();
    }
    for (const c of this.collectibles) {
      this.scene.scene.remove(c.object);
      c.dispose();
    }
    this.obstacles = [];
    this.collectibles = [];
  }

  dispose(): void {
    this.disposed = true;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.clearWorld();
    this.player.dispose();
    this.track.dispose();
    this.scene.dispose();
    this.audio.dispose();
  }
}
