import * as THREE from "three";
import { GameScene } from "./Scene";
import { Player } from "./Player";
import { Track } from "./Track";
import { Input } from "./Input";
import { Obstacle } from "./Obstacle";
import { Collectible } from "./Collectible";
import { Spawner } from "./Spawner";
import { GameState } from "./GameState";
import { SCORE, SPEED, STORAGE_KEYS } from "../config/gameConfig";
import { TitleScreen } from "../ui/TitleScreen";
import { HUD } from "../ui/HUD";
import { ResultScreen } from "../ui/ResultScreen";

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

  private obstacles: Obstacle[] = [];
  private collectibles: Collectible[] = [];

  private lastTime = 0;
  private elapsed = 0;
  private speed: number = SPEED.INITIAL;
  private rafId: number | null = null;
  private disposed = false;

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
      else if (event.type === "jump") this.player.jump();
    });

    // ハイスコア読み込み
    const stored = Number(localStorage.getItem(STORAGE_KEYS.HIGH_SCORE));
    if (Number.isFinite(stored) && stored > 0) {
      this.state.stats.highScore = stored;
    }

    this.titleScreen = new TitleScreen(() => this.startPlay());
    this.hud = new HUD();
    this.resultScreen = new ResultScreen(() => this.startPlay());

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
    if (dt > 0.1) dt = 0.1; // タブ復帰時の暴走防止

    if (this.state.status === "playing") {
      this.updatePlaying(dt);
    } else {
      // タイトル/結果でも床のスクロールだけ続けて演出感
      this.track.update(dt, 3);
      this.player.update(dt);
    }

    this.scene.render();
  };

  private updatePlaying(dt: number): void {
    this.elapsed += dt;

    // 速度上昇
    this.speed = Math.min(SPEED.MAX, SPEED.INITIAL + (this.elapsed / 10) * SPEED.PER_10_SEC);

    // 距離・時間ベースのスコア
    this.state.setDistance(Math.floor(this.elapsed * this.speed));
    this.state.addScore(SCORE.PER_METER * this.speed * dt);

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

    // 衝突 & 収集判定
    const hitbox = this.player.getHitbox();
    const pickup = this.player.getPickupBox();

    for (const o of this.obstacles) {
      if (hitbox.intersectsBox(o.getHitbox())) {
        this.gameOver();
        return;
      }
    }
    for (const c of this.collectibles) {
      if (!c.collected && pickup.intersectsBox(c.getBox())) {
        c.collected = true;
        this.state.addScore(SCORE.PICKUP);
      }
    }

    // 画面外の掃除
    this.obstacles = this.cleanup(this.obstacles, (o) => o.isOutOfRange());
    this.collectibles = this.cleanup(this.collectibles, (c) => c.isOutOfRange() || c.collected);

    // HUD 更新
    this.hud.update(Math.floor(this.state.stats.score), this.state.stats.distance);
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

  private startPlay(): void {
    this.clearWorld();
    this.state.reset();
    this.elapsed = 0;
    this.speed = SPEED.INITIAL;
    this.spawner.reset();
    this.player.resetPosition();

    this.titleScreen.hide();
    this.resultScreen.hide();
    this.hud.show();
    this.hud.update(0, 0);

    this.state.status = "playing";
  }

  private gameOver(): void {
    this.state.status = "result";
    const newRecord = this.state.finalize();
    localStorage.setItem(STORAGE_KEYS.HIGH_SCORE, String(this.state.stats.highScore));

    this.hud.hide();
    this.resultScreen.show({
      score: Math.floor(this.state.stats.score),
      distance: this.state.stats.distance,
      highScore: this.state.stats.highScore,
      newRecord,
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
  }
}
