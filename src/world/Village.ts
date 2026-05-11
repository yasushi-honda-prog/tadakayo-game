import * as THREE from "three";
import type { PhysicsWorld } from "../core/PhysicsWorld";
import { BRAND_HEX } from "../config/brand";

/**
 * タダカヨ村ステージ（Phase 5-B）。
 *
 * レイアウト（俯瞰、+X 東 / +Z 南、原点が中央広場の中心）:
 *
 *                       +Z 北
 *                  タダコミュ会館
 *                   (0, -22)
 *
 *
 *     タダスクの塔     中央広場     タダレク広場
 *      (-18, 4)        (0, 0)         (18, 4)
 *
 *                       SPAWN
 *                       -Z 南
 *
 * - 60x60 の地面 + 中央広場（ピンク円盤）+ 北の会館 + 西の塔 + 東の広場
 * - 木・街灯・ベンチを村全体に配置
 * - 落下防止に外周柵（高さ 1.4m, 30m 四方）
 *
 * すべての構造物に Rapier 静的 collider を付与。Phase 5-C のミッション基盤を
 * 載せる前提で、特徴的なランドマークを座標として確保する。
 */
const COLOR = {
  GROUND: 0xcfe6c2, // 淡い芝生グリーン
  PATH: 0xf2dfd0, // 中央広場周辺のパス
  PLAZA: BRAND_HEX.PINK,
  PLAZA_RIM: BRAND_HEX.PRIMARY,
  TOWER_STEP: BRAND_HEX.PRIMARY,
  TOWER_STEP_ALT: 0xffd23a, // 学校風の黄色（タダスク = 学校イメージ）
  TOWER_FLAG_POLE: 0x9a9a9a,
  TOWER_FLAG_CLOTH: BRAND_HEX.PRIMARY,
  REKU_FLOOR: BRAND_HEX.PINK,
  REKU_PILLAR: BRAND_HEX.PRIMARY,
  FOUNTAIN_BASE: 0xb6d8e6,
  FOUNTAIN_TOP: 0xdef2fa,
  HALL_WALL: 0xfffaf3,
  HALL_ROOF: BRAND_HEX.PRIMARY,
  HALL_DOOR: 0x8e5a3a,
  HALL_MAT: BRAND_HEX.PINK,
  TREE_TRUNK: 0x8a5a3a,
  TREE_LEAF: 0x6fb964,
  LAMP_POLE: 0x6c6c6c,
  LAMP_BULB: BRAND_HEX.PINK,
  BENCH: 0x4a3a2e,
  FENCE: 0xe6c8a8,
} as const;

const HALF = {
  GROUND: 30,
  WORLD_BOUNDARY: 30,
} as const;

/** 噴水アニメ: 水柱 + 飛沫粒子 (Phase 5-F) */
const FOUNTAIN_PARTICLES = 18;

export class Village {
  readonly object: THREE.Group;

  /** 主要ランドマーク座標（Phase 5-C のミッションで参照する） */
  readonly landmarks = {
    plazaCenter: new THREE.Vector3(0, 0, 0),
    towerTop: new THREE.Vector3(-18, 3.6, 4),
    rekuCenter: new THREE.Vector3(18, 0, 4),
    hallEntrance: new THREE.Vector3(0, 0, -18),
  };

  // ─── Phase 5-F: 噴水アニメ用 ───
  private fountainCenter = new THREE.Vector3();
  private waterColumn: THREE.Mesh | null = null;
  private waterDroplets: THREE.InstancedMesh | null = null;
  private dropletState: Array<{ vx: number; vy: number; vz: number; t: number; life: number }> = [];
  private flagMesh: THREE.Mesh | null = null;
  // animate() 内で毎フレーム new するのを避けるため hoist (Medium 修正: GC pressure 軽減)
  private readonly dropletDummy = new THREE.Object3D();

  constructor(physics: PhysicsWorld) {
    this.object = new THREE.Group();
    this.buildGround(physics);
    this.buildCentralPlaza(physics);
    this.buildTadasukuTower(physics);
    this.buildTadarekuPlaza(physics);
    this.buildTadakomyuHall(physics);
    this.buildDecorations(physics);
    this.buildBoundaryFence(physics);
  }

  /**
   * Phase 5-F: 噴水水柱の上下スケール + 飛沫粒子の物理 (重力で落下、寿命で再生成)
   * + 旗の靡き (z 軸まわりの軽い揺れ)。loop から dt 渡しで毎フレーム呼ばれる前提。
   */
  animate(dt: number, elapsed: number): void {
    // 水柱: y スケールを 0.7-1.3 で sin 振動
    if (this.waterColumn !== null) {
      const s = 1.0 + Math.sin(elapsed * 2.4) * 0.3;
      this.waterColumn.scale.y = s;
      // 中心は底面固定 (柱の base は y = 1.0、高さは元 1.5 = half 0.75)
      this.waterColumn.position.y = 1.0 + 0.75 * s;
    }

    // 飛沫: 投射運動 (p = v0*t + 0.5*g*t^2)、寿命で再スポーン
    if (this.waterDroplets !== null) {
      const baseY = 1.6;
      const g = -3.0; // 弱重力で粒子の弧を見やすく
      const dummy = this.dropletDummy; // hoist 済 instance を再利用
      for (let i = 0; i < FOUNTAIN_PARTICLES; i++) {
        const st = this.dropletState[i];
        st.t += dt;
        if (st.t >= st.life) {
          // 再スポーン: 噴水トップから上方+ランダム XZ で噴出
          const angle = Math.random() * Math.PI * 2;
          st.vx = Math.cos(angle) * 0.55;
          st.vz = Math.sin(angle) * 0.55;
          st.vy = 1.6 + Math.random() * 0.8;
          st.t = 0;
          st.life = 1.4 + Math.random() * 0.4;
        }
        const px = this.fountainCenter.x + st.vx * st.t;
        const py = baseY + st.vy * st.t + 0.5 * g * st.t * st.t;
        const pz = this.fountainCenter.z + st.vz * st.t;
        dummy.position.set(px, Math.max(py, 0.5), pz);
        dummy.scale.setScalar(0.08);
        dummy.updateMatrix();
        this.waterDroplets.setMatrixAt(i, dummy.matrix);
      }
      this.waterDroplets.instanceMatrix.needsUpdate = true;
    }

    // 旗の揺れ: z 軸回り 0.15rad の sin 振動
    if (this.flagMesh !== null) {
      this.flagMesh.rotation.z = Math.sin(elapsed * 1.8) * 0.15;
    }
  }

  // ───────────────────────────────────────────────────────────
  // 地面 + パス
  // ───────────────────────────────────────────────────────────
  private buildGround(physics: PhysicsWorld): void {
    const size = HALF.GROUND * 2;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({ color: COLOR.GROUND, roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.object.add(ground);
    physics.addStaticCuboid(
      { x: HALF.GROUND, y: 0.05, z: HALF.GROUND },
      { x: 0, y: -0.05, z: 0 }
    );

    // 中央広場と各エリアをつなぐパス（衝突なし、見た目だけ）
    this.addFlatRect(0, 0.01, -10, 4, 12, COLOR.PATH); // 会館への道
    this.addFlatRect(-10, 0.01, 4, 12, 4, COLOR.PATH); // 塔への道
    this.addFlatRect(10, 0.01, 4, 12, 4, COLOR.PATH); // 広場への道
  }

  private addFlatRect(
    x: number,
    y: number,
    z: number,
    sx: number,
    sz: number,
    color: number
  ): void {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(sx, sz),
      new THREE.MeshStandardMaterial({ color, roughness: 0.95 })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    this.object.add(m);
  }

  // ───────────────────────────────────────────────────────────
  // 中央広場（直径 16m のピンク円盤 + 縁取り + ロゴモニュメント）
  // ───────────────────────────────────────────────────────────
  private buildCentralPlaza(physics: PhysicsWorld): void {
    const radius = 8;

    // 床（薄い円柱で物理的にも僅かに高い）
    const plaza = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 0.15, 48),
      new THREE.MeshStandardMaterial({ color: COLOR.PLAZA, roughness: 0.8 })
    );
    plaza.position.y = 0.075;
    this.object.add(plaza);
    physics.addStaticCylinder(0.075, radius, { x: 0, y: 0.075, z: 0 });

    // 縁取り（赤いリング）
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.12, 12, 64),
      new THREE.MeshStandardMaterial({ color: COLOR.PLAZA_RIM, roughness: 0.6 })
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.16;
    this.object.add(rim);

    // 中央モニュメント (Issue #31: 装飾化)
    // 赤い台座 (上面 1.2×1.2m, h=0.95m) + ピンクキューブ (上面 0.8×0.8m, h=1.75m) は
    // どちらも Player capsule (radius 0.35m) が乗れる寸法。collider を外して見た目だけ維持。
    const pedestal = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.8, 1.2),
      new THREE.MeshStandardMaterial({ color: COLOR.PLAZA_RIM, roughness: 0.7 })
    );
    pedestal.position.set(0, 0.55, 0);
    this.object.add(pedestal);

    const monument = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.8, 0.8),
      new THREE.MeshStandardMaterial({ color: COLOR.PLAZA, roughness: 0.7 })
    );
    monument.position.set(0, 1.35, 0);
    this.object.add(monument);
  }

  // ───────────────────────────────────────────────────────────
  // タダスクの塔（5 段ジャンプアスレチック + 頂上の旗）
  // ───────────────────────────────────────────────────────────
  private buildTadasukuTower(physics: PhysicsWorld): void {
    const baseX = -18;
    const baseZ = 4;

    // 看板（簡素なテキスト風プレート）
    this.addBoxMesh(
      physics,
      { x: 0.6, y: 0.6, z: 0.05 },
      { x: baseX + 4, y: 1.4, z: baseZ },
      COLOR.TOWER_STEP_ALT
    );
    this.addBoxMesh(
      physics,
      { x: 0.05, y: 0.7, z: 0.05 },
      { x: baseX + 4, y: 0.7, z: baseZ },
      COLOR.LAMP_POLE
    );

    // 5 段の階段ジャンプ。z 方向にずらしつつ高さを上げる
    const steps = 5;
    for (let i = 0; i < steps; i++) {
      const half = { x: 1.0, y: 0.35 + i * 0.35, z: 1.0 };
      const pos = {
        x: baseX,
        y: half.y, // 立方体の中心
        z: baseZ - 1 - i * 2.2,
      };
      const color = i % 2 === 0 ? COLOR.TOWER_STEP : COLOR.TOWER_STEP_ALT;
      this.addBoxMesh(physics, half, pos, color);
    }

    // 頂上の小台座（ジャンプの目標）
    const topY = 0.35 + (steps - 1) * 0.35;
    const topPos = { x: baseX, y: topY * 2, z: baseZ - 1 - (steps - 1) * 2.2 };

    // 旗の柱
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 2.0, 8),
      new THREE.MeshStandardMaterial({ color: COLOR.TOWER_FLAG_POLE })
    );
    pole.position.set(topPos.x, topPos.y + 1.0, topPos.z);
    this.object.add(pole);

    // 旗
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.55),
      new THREE.MeshStandardMaterial({
        color: COLOR.TOWER_FLAG_CLOTH,
        side: THREE.DoubleSide,
        roughness: 0.5,
      })
    );
    flag.position.set(topPos.x + 0.45, topPos.y + 1.6, topPos.z);
    this.object.add(flag);
    this.flagMesh = flag; // Phase 5-F: animate() で揺らす

    // landmarks.towerTop を頂上スラブ位置に揃える（ミッション基盤用）
    this.landmarks.towerTop.set(topPos.x, topPos.y, topPos.z);
  }

  // ───────────────────────────────────────────────────────────
  // タダレク広場（ピンク床 + 4 本柱 + 噴水 + ベンチ）
  // ───────────────────────────────────────────────────────────
  private buildTadarekuPlaza(physics: PhysicsWorld): void {
    const cx = 18;
    const cz = 4;
    const halfFloor = 4;

    // 床
    this.addBoxMesh(
      physics,
      { x: halfFloor, y: 0.1, z: halfFloor },
      { x: cx, y: 0.1, z: cz },
      COLOR.REKU_FLOOR
    );

    // 4 隅の柱 (Issue #31: 装飾化 — 上面 0.36×0.36m に Player capsule (radius 0.35m) が
    // 着地できてしまう問題を回避するため collider を外す。見た目だけ維持)
    const cornerOff = halfFloor - 0.4;
    for (const dx of [-cornerOff, cornerOff]) {
      for (const dz of [-cornerOff, cornerOff]) {
        const pillar = new THREE.Mesh(
          new THREE.BoxGeometry(0.36, 2.8, 0.36),
          new THREE.MeshStandardMaterial({ color: COLOR.REKU_PILLAR, roughness: 0.7 })
        );
        pillar.position.set(cx + dx, 1.4, cz + dz);
        this.object.add(pillar);
        // 柱の上の球（飾り）
        const cap = new THREE.Mesh(
          new THREE.SphereGeometry(0.25, 16, 12),
          new THREE.MeshStandardMaterial({ color: COLOR.PLAZA, roughness: 0.6 })
        );
        cap.position.set(cx + dx, 2.95, cz + dz);
        this.object.add(cap);
      }
    }

    // 噴水（円柱 2 段、見た目は base + top の 2 mesh、collider は乗れない高さの 1 本）
    // Issue #31: 旧 collider (base 上面 y=0.6m、top 上面 y=1.1m) は autostep 0.4m で
    // Player が歩いて乗れた。Rapier KCC が autostep する高さを capsule + autostep
    // (= 0.9 + 0.4 = 1.3m) より高い壁にすることで「乗れず・侵入もできない」を実現。
    const fountainBase = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 0.4, 24),
      new THREE.MeshStandardMaterial({ color: COLOR.FOUNTAIN_BASE, roughness: 0.4 })
    );
    fountainBase.position.set(cx, 0.4, cz);
    this.object.add(fountainBase);

    const fountainTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.6, 0.5, 18),
      new THREE.MeshStandardMaterial({
        color: COLOR.FOUNTAIN_TOP,
        roughness: 0.3,
        emissive: 0x223344,
        emissiveIntensity: 0.15,
      })
    );
    fountainTop.position.set(cx, 0.85, cz);
    this.object.add(fountainTop);

    // 統合 collider: 底 y=0 から上面 y=1.6 まで (半高 0.8, y=0.8)。
    // Player capsule (半径 0.35 + 半高 0.55 + autostep 0.4 = 1.3) より高く、
    // タダレク広場床面 (y=0.2) からの段差 1.4m は autostep では登れない。
    physics.addStaticCylinder(0.8, 1.4, { x: cx, y: 0.8, z: cz });

    // Phase 5-F: 水柱 (半透明シアンの円柱、animate() で y スケール振動)
    this.fountainCenter.set(cx, 0, cz);
    const waterColumn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 1.5, 12, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0x9fd9f0,
        roughness: 0.2,
        transparent: true,
        opacity: 0.65,
        emissive: 0x4090b0,
        emissiveIntensity: 0.4,
        side: THREE.DoubleSide,
      })
    );
    waterColumn.position.set(cx, 1.75, cz); // 中心 y = 1.75 = base 1.0 + half 0.75
    this.object.add(waterColumn);
    this.waterColumn = waterColumn;

    // Phase 5-F: 飛沫粒子 (InstancedMesh で軽量)
    const droplets = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1.0, 8, 6),
      new THREE.MeshStandardMaterial({
        color: 0xb6e8f5,
        roughness: 0.2,
        transparent: true,
        opacity: 0.85,
        emissive: 0x4090b0,
        emissiveIntensity: 0.3,
      }),
      FOUNTAIN_PARTICLES
    );
    for (let i = 0; i < FOUNTAIN_PARTICLES; i++) {
      this.dropletState.push({
        vx: 0,
        vy: 0,
        vz: 0,
        // 初期 t を散らして粒子を一斉スポーンさせない (見た目の自然さ)
        t: Math.random() * 1.4,
        life: 1.4 + Math.random() * 0.4,
      });
    }
    this.object.add(droplets);
    this.waterDroplets = droplets;

    // ベンチ 2 個（噴水の南北）
    this.addBench(physics, cx - 2.6, cz);
    this.addBench(physics, cx + 2.6, cz);

    this.landmarks.rekuCenter.set(cx, 0.2, cz);
  }

  private addBench(physics: PhysicsWorld, x: number, z: number): void {
    // Issue #31: 旧実装は座面 (上面 y=0.56m) と脚 (上面 y=0.5m) に collider があり、
    // autostep 0.4m で Player が歩いて乗り上げる挙動があった。
    // ベンチは座る機能が無く collider 維持の意義が薄いため装飾化 (PR #32/#33 と同パターン)。
    // 通り抜けは発生するが、ジャンプなし乗り上げよりも UX 影響は小さい。
    void physics;
    const benchMat = new THREE.MeshStandardMaterial({ color: COLOR.BENCH, roughness: 0.7 });
    // 座面
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.44), benchMat);
    seat.position.set(x, 0.5, z);
    this.object.add(seat);
    // 脚 2 本
    const legGeo = new THREE.BoxGeometry(0.1, 0.5, 0.36);
    const legL = new THREE.Mesh(legGeo, benchMat);
    legL.position.set(x - 0.7, 0.25, z);
    this.object.add(legL);
    const legR = new THREE.Mesh(legGeo, benchMat);
    legR.position.set(x + 0.7, 0.25, z);
    this.object.add(legR);
  }

  // ───────────────────────────────────────────────────────────
  // タダコミュ会館（白壁 + 赤屋根 + 入口）
  // ───────────────────────────────────────────────────────────
  private buildTadakomyuHall(physics: PhysicsWorld): void {
    const cx = 0;
    const cz = -22;

    // 本体（白壁）
    const wallHalf = { x: 4, y: 2, z: 4 };
    this.addBoxMesh(
      physics,
      wallHalf,
      { x: cx, y: wallHalf.y, z: cz },
      COLOR.HALL_WALL
    );

    // 屋根（少しせり出した赤い直方体）
    const roofMesh = new THREE.Mesh(
      new THREE.BoxGeometry(8.6, 0.5, 8.6),
      new THREE.MeshStandardMaterial({ color: COLOR.HALL_ROOF, roughness: 0.4 })
    );
    roofMesh.position.set(cx, wallHalf.y * 2 + 0.25, cz);
    this.object.add(roofMesh);
    physics.addStaticCuboid(
      { x: 4.3, y: 0.25, z: 4.3 },
      { x: cx, y: wallHalf.y * 2 + 0.25, z: cz }
    );

    // 屋根の上の小さなドーマー（ブランド赤）
    const dormer = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.6, 1.4),
      new THREE.MeshStandardMaterial({ color: COLOR.PLAZA, roughness: 0.6 })
    );
    dormer.position.set(cx, wallHalf.y * 2 + 0.8, cz);
    this.object.add(dormer);

    // 入口（茶色のプレート、collider なし＝見た目のみ）
    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 2.4),
      new THREE.MeshStandardMaterial({
        color: COLOR.HALL_DOOR,
        roughness: 0.7,
        side: THREE.DoubleSide,
      })
    );
    door.position.set(cx, 1.2, cz + wallHalf.z + 0.01);
    this.object.add(door);

    // ウェルカムマット（ピンク）
    this.addFlatRect(cx, 0.02, cz + wallHalf.z + 0.9, 2.0, 1.0, COLOR.HALL_MAT);

    // landmarks.hallEntrance を入口の前 1m に
    this.landmarks.hallEntrance.set(cx, 0, cz + wallHalf.z + 1.5);
  }

  // ───────────────────────────────────────────────────────────
  // 装飾（木・街灯・ベンチ・看板）
  // ───────────────────────────────────────────────────────────
  private buildDecorations(physics: PhysicsWorld): void {
    // 木 6 本（衝突あり、collider はおおまかな円柱で）
    const treeSpots: Array<[number, number]> = [
      [-12, -4],
      [12, -4],
      [-22, -10],
      [22, -10],
      [-10, 14],
      [10, 14],
    ];
    for (const [x, z] of treeSpots) this.addTree(physics, x, z);

    // 街灯 6 本（中央広場周りと会館への道）
    const lampSpots: Array<[number, number]> = [
      [-9, -2],
      [9, -2],
      [-9, 6],
      [9, 6],
      [-3, -10],
      [3, -10],
    ];
    for (const [x, z] of lampSpots) this.addStreetlight(physics, x, z);

    // ベンチ 2 個（中央広場の南側、休憩スポット）
    this.addBench(physics, -3, 9);
    this.addBench(physics, 3, 9);
  }

  private addTree(physics: PhysicsWorld, x: number, z: number): void {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.28, 2.2, 10),
      new THREE.MeshStandardMaterial({ color: COLOR.TREE_TRUNK, roughness: 0.9 })
    );
    trunk.position.set(x, 1.1, z);
    this.object.add(trunk);
    // Issue #31: 幹の collider は腰高 (0-1m) までに制限。
    // 上に着地できる問題 (radius 0.28m の上面に Player capsule が乗る) を回避。
    // 体当たり防御は腰までで十分機能する。
    physics.addStaticCylinder(0.5, 0.28, { x, y: 0.5, z });

    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 18, 14),
      new THREE.MeshStandardMaterial({ color: COLOR.TREE_LEAF, roughness: 0.7 })
    );
    leaf.position.set(x, 2.8, z);
    this.object.add(leaf);
  }

  private addStreetlight(physics: PhysicsWorld, x: number, z: number): void {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 3.2, 10),
      new THREE.MeshStandardMaterial({ color: COLOR.LAMP_POLE, roughness: 0.7 })
    );
    pole.position.set(x, 1.6, z);
    this.object.add(pole);
    physics.addStaticCylinder(1.6, 0.1, { x, y: 1.6, z });

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 18, 14),
      new THREE.MeshStandardMaterial({
        color: COLOR.LAMP_BULB,
        roughness: 0.3,
        emissive: COLOR.LAMP_BULB,
        emissiveIntensity: 0.4,
      })
    );
    bulb.position.set(x, 3.4, z);
    this.object.add(bulb);
  }

  // ───────────────────────────────────────────────────────────
  // 外周柵（30m 四方、落下防止）
  // ───────────────────────────────────────────────────────────
  private buildBoundaryFence(physics: PhysicsWorld): void {
    const limit = HALF.WORLD_BOUNDARY;
    const fenceHalf = { x: limit, y: 0.7, z: 0.1 };
    // 北・南
    this.addBoxMesh(physics, fenceHalf, { x: 0, y: 0.7, z: -limit }, COLOR.FENCE);
    this.addBoxMesh(physics, fenceHalf, { x: 0, y: 0.7, z: limit }, COLOR.FENCE);
    // 東・西（90°回転して reuse）
    const sideHalf = { x: 0.1, y: 0.7, z: limit };
    this.addBoxMesh(physics, sideHalf, { x: -limit, y: 0.7, z: 0 }, COLOR.FENCE);
    this.addBoxMesh(physics, sideHalf, { x: limit, y: 0.7, z: 0 }, COLOR.FENCE);
  }

  // ───────────────────────────────────────────────────────────
  // ヘルパ: メッシュ + collider のセット
  // ───────────────────────────────────────────────────────────
  private addBoxMesh(
    physics: PhysicsWorld,
    halfExtents: { x: number; y: number; z: number },
    position: { x: number; y: number; z: number },
    color: number
  ): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(halfExtents.x * 2, halfExtents.y * 2, halfExtents.z * 2),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
    );
    mesh.position.set(position.x, position.y, position.z);
    this.object.add(mesh);
    physics.addStaticCuboid(halfExtents, position);
  }

  dispose(): void {
    this.object.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mat = obj.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
  }
}
