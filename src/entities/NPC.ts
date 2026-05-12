import * as THREE from "three";

/**
 * NPC の状態遷移 (Phase 5-D):
 *
 *   idle ──(distance ≤ INTERACT_RADIUS)──> interactable ──(E キー)──> talking
 *     ↑                                          │                           │
 *     └──(distance > RELEASE_RADIUS)─────────────┘                           │
 *     └──(DialogBox 完了 + endTalk())──────────────────────────────────────┘
 *
 * - idle: 通常表示。プレイヤーが近寄ると interactable へ
 * - interactable: glow が pulse、E キーで talking へ遷移
 * - talking: glow 消灯、proximity 判定停止 (DialogBox 操作中の状態安定化)
 *
 * 距離閾値はヒステリシスを持たせる (RELEASE > INTERACT) ことで境界での状態振動を防ぐ。
 */
type NpcState = "idle" | "interactable" | "talking";

const INTERACT_RADIUS = 2.0;
const RELEASE_RADIUS = 2.6;

export class NPC {
  readonly id: string;
  readonly displayName: string;
  readonly object: THREE.Group;
  readonly position: THREE.Vector3;
  readonly lines: readonly string[];

  private state: NpcState = "idle";
  private readonly sprite: THREE.Sprite;
  private readonly material: THREE.SpriteMaterial;
  private readonly texture: THREE.Texture;
  private readonly glowSprite: THREE.Sprite;
  private readonly glowMaterial: THREE.SpriteMaterial;
  private readonly spriteHeight: number;
  private elapsed = 0;

  constructor(args: {
    id: string;
    displayName: string;
    /** ファイル名 (拡張子なし、public/assets/images/ 配下) */
    spriteName: string;
    /** ワールド座標 (足元基準) */
    position: THREE.Vector3;
    lines: readonly string[];
    /** スプライト高さ (m)、デフォルト 1.6 */
    spriteHeight?: number;
  }) {
    this.id = args.id;
    this.displayName = args.displayName;
    this.position = args.position.clone();
    this.lines = args.lines;
    this.spriteHeight = args.spriteHeight ?? 1.6;

    const loader = new THREE.TextureLoader();
    const base = import.meta.env.BASE_URL;
    this.texture = loader.load(`${base}assets/images/${args.spriteName}.png`);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = true;

    this.material = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
    });

    const h = this.spriteHeight;
    const w = h * (2 / 3); // 2:3 比率の生成画像を維持

    this.sprite = new THREE.Sprite(this.material);
    this.sprite.scale.set(w, h, 1);
    this.sprite.position.y = h / 2;

    // glow: interactable 時に sprite 背後で pulse する半透明ピンク
    this.glowMaterial = new THREE.SpriteMaterial({
      color: 0xffe2f7,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    this.glowSprite = new THREE.Sprite(this.glowMaterial);
    this.glowSprite.scale.set(w * 1.45, h * 1.1, 1);
    this.glowSprite.position.y = h / 2;

    this.object = new THREE.Group();
    this.object.position.set(this.position.x, this.position.y, this.position.z);
    // 順番: glow を先に追加 (背面)、sprite を後 (前面)
    this.object.add(this.glowSprite);
    this.object.add(this.sprite);
  }

  /**
   * 毎フレーム呼ばれる。プレイヤーとの XZ 距離で idle ⇄ interactable 遷移を判定。
   * talking 中は距離判定を凍結する (会話 UI 側が状態を握る)。
   */
  updateProximity(
    playerPosition: Readonly<{ x: number; y: number; z: number }>,
    dt: number
  ): void {
    this.elapsed += dt;

    if (this.state !== "talking") {
      const dx = playerPosition.x - this.position.x;
      const dz = playerPosition.z - this.position.z;
      const dist = Math.hypot(dx, dz);
      if (this.state === "idle" && dist <= INTERACT_RADIUS) {
        this.state = "interactable";
      } else if (this.state === "interactable" && dist > RELEASE_RADIUS) {
        this.state = "idle";
      }
    }

    // glow 演出
    if (this.state === "interactable") {
      this.glowMaterial.opacity = 0.32 + 0.18 * Math.sin(this.elapsed * 4.0);
    } else {
      this.glowMaterial.opacity = 0;
    }

    // 軽い浮遊感 (キャラが「生きている」感じ)
    const baseY = this.spriteHeight / 2;
    this.sprite.position.y = baseY + Math.sin(this.elapsed * 1.6) * 0.04;
  }

  isInteractable(): boolean {
    return this.state === "interactable";
  }

  /** 会話開始時に Game 側から呼ぶ。glow を消して talking 状態に固定。 */
  startTalk(): void {
    this.state = "talking";
    this.glowMaterial.opacity = 0;
  }

  /** 会話終了時に Game 側から呼ぶ。idle に戻り、再接近で再び interactable 化する。 */
  endTalk(): void {
    this.state = "idle";
  }

  dispose(): void {
    // THREE.Sprite は内部 BufferGeometry を持つため明示的に解放
    // (Phase 5-D 時点では NPC 動的生成/削除はないが、Phase 5-E 以降で必要になる)
    this.sprite.geometry.dispose();
    this.glowSprite.geometry.dispose();
    this.texture.dispose();
    this.material.dispose();
    this.glowMaterial.dispose();
  }
}
