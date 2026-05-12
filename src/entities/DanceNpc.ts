import * as THREE from "three";

/**
 * Phase 5-F: タダレク広場で「自動で踊っている」装飾 NPC。
 *
 * 物理コリジョンなし、会話なし、ミッションへの影響もなし。純粋な雰囲気要素。
 * - ビルボード sprite (front-idle / side-run / side-left-run のローテーションで「踊る」感)
 * - y 軸まわりのスピン + y のバウンス で「リズム感」を表現
 * - 1-2 体配置することでプレイヤーが Mission 4 のヒントを視覚的に得られる
 */
export class DanceNpc {
  readonly object: THREE.Group;
  readonly footPosition: THREE.Vector3;
  private readonly sprite: THREE.Sprite;
  private readonly material: THREE.SpriteMaterial;
  private readonly textures: THREE.Texture[];
  private readonly spriteHeight: number;
  private elapsed = 0;
  private currentTextureIndex = 0;
  private readonly phase: number;

  constructor(args: {
    /** 足元基準のワールド座標 */
    position: THREE.Vector3;
    /** 個体ごとの位相オフセット (0..2π) で複数体の同期を崩す */
    phase?: number;
    /** sprite 高さ (m)、デフォルト 1.5 */
    spriteHeight?: number;
  }) {
    this.footPosition = args.position.clone();
    this.spriteHeight = args.spriteHeight ?? 1.5;
    this.phase = args.phase ?? 0;

    const loader = new THREE.TextureLoader();
    const base = import.meta.env.BASE_URL;
    const names = [
      "tadakayo-front-idle",
      "tadakayo-side-run",
      "tadakayo-side-left-run",
    ];
    this.textures = names.map((name) => {
      const t = loader.load(`${base}assets/images/${name}.png`);
      t.colorSpace = THREE.SRGBColorSpace;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = true;
      return t;
    });

    this.material = new THREE.SpriteMaterial({
      map: this.textures[0],
      transparent: true,
      depthWrite: false,
    });

    const h = this.spriteHeight;
    const w = h * (2 / 3);
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.scale.set(w, h, 1);
    this.sprite.position.y = h / 2;

    this.object = new THREE.Group();
    this.object.position.copy(this.footPosition);
    this.object.add(this.sprite);
  }

  /**
   * 踊りアニメ:
   * - y バウンス (0.0-0.45m を sin で振動)
   * - 一定リズム (0.35s 毎) で sprite テクスチャを front → side-right → side-left → front... 切替
   * - object は y軸スピンせず、表情だけが踊る (テクスチャ切替で「左右に揺れる」表現)
   */
  animate(dt: number): void {
    this.elapsed += dt;
    const t = this.elapsed + this.phase;
    const bounce = Math.max(0, Math.sin(t * 4.0)) * 0.42;
    this.object.position.y = this.footPosition.y + bounce;

    const idx = Math.floor(t * 2.8) % this.textures.length;
    if (idx !== this.currentTextureIndex) {
      this.currentTextureIndex = idx;
      this.material.map = this.textures[idx];
      this.material.needsUpdate = true;
    }
  }

  dispose(): void {
    this.sprite.geometry.dispose();
    for (const t of this.textures) t.dispose();
    this.material.dispose();
  }
}
