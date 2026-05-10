import * as THREE from "three";
import { LANE, SPAWN } from "../config/gameConfig";
import { BRAND_HEX } from "../config/brand";

/**
 * 障害物の挙動カテゴリ。
 * - lane: 既存の Box（左右レーンチェンジで回避）
 * - jump: ジャンプ必須の縦長壁（隣レーンへの回避も可）
 * - jumpLow: 全レーンを横断する低い障害物（ジャンプ必須、隣レーン逃げ不可）
 * - crouch: しゃがみ必須の天井（ジャンプすると頭をぶつける）
 */
export type ObstacleKind = "lane" | "jump" | "jumpLow" | "crouch";

const ICON_COLOR: Record<ObstacleKind, string> = {
  lane: "#ffb400",
  jump: "#e33535",
  jumpLow: "#e33535",
  crouch: "#3aa5d8",
};

/**
 * 矢印アイコンを CanvasTexture で生成。障害物の上に Sprite として浮かべて
 * 「何をすべきか」を直感的に伝える。
 */
function makeIconTexture(kind: ObstacleKind): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // 影付きの白丸ベース
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 100, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";

  // カラーリング
  ctx.lineWidth = 14;
  ctx.strokeStyle = ICON_COLOR[kind];
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 100, 0, Math.PI * 2);
  ctx.stroke();

  // 矢印を描く（kind ごとに形を変える）
  ctx.fillStyle = ICON_COLOR[kind];
  ctx.beginPath();
  if (kind === "jump" || kind === "jumpLow") {
    // 上向き矢印
    ctx.moveTo(128, 50);
    ctx.lineTo(190, 130);
    ctx.lineTo(155, 130);
    ctx.lineTo(155, 200);
    ctx.lineTo(101, 200);
    ctx.lineTo(101, 130);
    ctx.lineTo(66, 130);
    ctx.closePath();
  } else if (kind === "crouch") {
    // 下向き矢印
    ctx.moveTo(128, 206);
    ctx.lineTo(190, 126);
    ctx.lineTo(155, 126);
    ctx.lineTo(155, 56);
    ctx.lineTo(101, 56);
    ctx.lineTo(101, 126);
    ctx.lineTo(66, 126);
    ctx.closePath();
  } else {
    // 左右矢印（⇄）
    // 左矢印
    ctx.moveTo(40, 128);
    ctx.lineTo(96, 86);
    ctx.lineTo(96, 112);
    ctx.lineTo(160, 112);
    ctx.lineTo(160, 86);
    ctx.lineTo(216, 128);
    ctx.lineTo(160, 170);
    ctx.lineTo(160, 144);
    ctx.lineTo(96, 144);
    ctx.lineTo(96, 170);
    ctx.closePath();
  }
  ctx.fill();

  // ラベル（! / ↓ / ↔︎ ではなく言葉で念押し）
  const label =
    kind === "jump" || kind === "jumpLow" ? "JUMP" : kind === "crouch" ? "DUCK" : "AVOID";
  ctx.fillStyle = "#1a1a1a";
  ctx.font = "bold 28px 'Noto Sans JP', system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(label, size / 2, 240);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

export class Obstacle {
  readonly object: THREE.Group;
  readonly kind: ObstacleKind;
  destroyed = false;
  private readonly icon: THREE.Sprite;
  private readonly iconBaseY: number;

  constructor(kind: ObstacleKind, lane: number) {
    this.kind = kind;
    this.object = new THREE.Group();

    // 障害物本体（kind 別の見た目）
    if (kind === "lane") {
      // 紙書類の山（薄いベージュの段重ね）
      const stackHeights = [0.18, 0.34, 0.5, 0.66, 0.82];
      for (const h of stackHeights) {
        const w = 0.85 - h * 0.15;
        const geom = new THREE.BoxGeometry(w, 0.18, w * 0.7);
        const mat = new THREE.MeshStandardMaterial({
          color: 0xfaf3e0,
          roughness: 0.9,
        });
        const sheet = new THREE.Mesh(geom, mat);
        sheet.position.y = h;
        sheet.rotation.y = (Math.random() - 0.5) * 0.15;
        this.object.add(sheet);
      }
      // クリップ風の赤い小球
      const clipGeom = new THREE.SphereGeometry(0.07, 12, 12);
      const clipMat = new THREE.MeshStandardMaterial({ color: BRAND_HEX.PRIMARY });
      const clip = new THREE.Mesh(clipGeom, clipMat);
      clip.position.set(0.2, 0.95, 0.05);
      this.object.add(clip);
      this.iconBaseY = 1.85;
    } else if (kind === "jumpLow") {
      // 全レーンを横断する低い障害物。電源コードのメタファー（介護現場の足元の障害）
      const ropeGeom = new THREE.CylinderGeometry(0.08, 0.08, 6.4, 12);
      const ropeMat = new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.6 });
      const rope = new THREE.Mesh(ropeGeom, ropeMat);
      rope.rotation.z = Math.PI / 2;
      rope.position.y = 0.3;
      this.object.add(rope);
      // 黄色いケーブルタグ（注意喚起）
      for (let i = -1; i <= 1; i++) {
        const tagGeom = new THREE.BoxGeometry(0.32, 0.22, 0.06);
        const tagMat = new THREE.MeshStandardMaterial({ color: 0xffd84d, roughness: 0.4 });
        const tag = new THREE.Mesh(tagGeom, tagMat);
        tag.position.set(i * 1.6, 0.3, 0);
        this.object.add(tag);
      }
      // 黒いプラグ（左端）
      const plugGeom = new THREE.BoxGeometry(0.32, 0.4, 0.32);
      const plugMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
      const plug = new THREE.Mesh(plugGeom, plugMat);
      plug.position.set(-3.0, 0.3, 0);
      this.object.add(plug);
      this.iconBaseY = 1.3;
    } else if (kind === "jump") {
      // FAX 機モチーフ。縦長の本体 + 上のトレイ + 受話器
      const bodyGeom = new THREE.BoxGeometry(1.0, 1.4, 0.7);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb0b8c4, roughness: 0.55 });
      const body = new THREE.Mesh(bodyGeom, bodyMat);
      body.position.y = 0.7;
      this.object.add(body);
      // 紙が出てくるトレイ（薄い白い長方形）
      const trayGeom = new THREE.BoxGeometry(0.95, 0.06, 0.5);
      const trayMat = new THREE.MeshStandardMaterial({ color: 0xfaf3e0 });
      const tray = new THREE.Mesh(trayGeom, trayMat);
      tray.position.set(0, 1.45, 0.2);
      this.object.add(tray);
      // 受話器（黒い細長い半円）
      const handsetGeom = new THREE.CapsuleGeometry(0.08, 0.5, 6, 12);
      const handsetMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a });
      const handset = new THREE.Mesh(handsetGeom, handsetMat);
      handset.position.set(-0.4, 1.15, 0.42);
      handset.rotation.z = Math.PI / 2;
      this.object.add(handset);
      // ボタン（赤いポチ）
      const btnGeom = new THREE.SphereGeometry(0.05, 10, 10);
      const btnMat = new THREE.MeshStandardMaterial({ color: BRAND_HEX.PRIMARY });
      const btn = new THREE.Mesh(btnGeom, btnMat);
      btn.position.set(0.3, 0.95, 0.4);
      this.object.add(btn);
      this.iconBaseY = 2.5;
    } else {
      // 天井から吊り下げる古いブラウン管モニタ群（くぐる）
      const monitorGeom = new THREE.BoxGeometry(1.4, 0.7, 0.6);
      const monitorMat = new THREE.MeshStandardMaterial({ color: 0xd9c79a, roughness: 0.65 });
      const monitor = new THREE.Mesh(monitorGeom, monitorMat);
      monitor.position.y = 1.95;
      this.object.add(monitor);
      // 画面（少し暗い面）
      const screenGeom = new THREE.PlaneGeometry(1.0, 0.45);
      const screenMat = new THREE.MeshStandardMaterial({ color: 0x3a4756, emissive: 0x223344, emissiveIntensity: 0.4 });
      const screen = new THREE.Mesh(screenGeom, screenMat);
      screen.position.set(0, 1.95, 0.31);
      this.object.add(screen);
      // 吊り下げ紐
      const beamGeom = new THREE.CylinderGeometry(0.025, 0.025, 0.8, 6);
      const beamMat = new THREE.MeshStandardMaterial({ color: 0x666666 });
      for (const sx of [-0.5, 0.5]) {
        const beam = new THREE.Mesh(beamGeom, beamMat);
        beam.position.set(sx, 2.7, 0);
        this.object.add(beam);
      }
      this.iconBaseY = 3.1;
    }

    // 指示アイコン Sprite（障害物上にホバー）
    const iconTex = makeIconTexture(kind);
    const iconMat = new THREE.SpriteMaterial({
      map: iconTex,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      // sizeAttenuation: true（デフォルト）= 距離で見かけサイズが変化
      // 近距離での巨大化は update() でスケール上限を抑える
    });
    this.icon = new THREE.Sprite(iconMat);
    this.icon.scale.set(0.55, 0.55, 1);
    this.icon.position.y = this.iconBaseY;
    this.icon.renderOrder = 1000;
    this.object.add(this.icon);

    // jumpLow は全レーンを横断するので x=0 中央に配置（lane 引数は無視）
    const xPos = kind === "jumpLow" ? 0 : LANE.POSITIONS[lane];
    this.object.position.set(xPos, 0, SPAWN.Z);
  }

  update(dt: number, speed: number): void {
    this.object.position.z += speed * dt;

    // アイコンを上下にゆらゆら（注目を引く）
    const t = performance.now() * 0.004;
    this.icon.position.y = this.iconBaseY + Math.sin(t) * 0.08;

    // 障害物がプレイヤーに近づいたらアイコンを徐々にフェードさせ、
    // 通り過ぎる手前では完全に消す（巨大化を防ぐ + 視界の邪魔にならない）
    const z = this.object.position.z;
    const mat = this.icon.material as THREE.SpriteMaterial;
    if (z > -2) {
      // 遠 (-2) → 近 (3) で alpha 1.0 → 0.0
      const fade = Math.max(0, Math.min(1, (3 - z) / 5));
      mat.opacity = fade;
      this.icon.visible = fade > 0.02;
    } else {
      mat.opacity = 1.0;
      this.icon.visible = true;
    }

    if (this.destroyed) {
      this.object.position.y += dt * 4;
      this.object.rotation.x += dt * 6;
      this.object.rotation.z += dt * 4;
      this.object.children.forEach((child) => {
        const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m) {
          if (!m.transparent) m.transparent = true;
          m.opacity = Math.max(0, m.opacity - dt * 1.5);
        }
        const sm = (child as THREE.Sprite).material as THREE.SpriteMaterial | undefined;
        if (sm && sm.opacity !== undefined) {
          sm.opacity = Math.max(0, sm.opacity - dt * 1.5);
        }
      });
    }
  }

  isOutOfRange(): boolean {
    return this.object.position.z > 6 || (this.destroyed && this.object.position.y > 8);
  }

  /** 障害物本体の判定範囲。アイコン Sprite は判定から除外する */
  getHitbox(): THREE.Box3 {
    const box = new THREE.Box3();
    // アイコンを一時的に除外して計算
    const wasVisible = this.icon.visible;
    this.icon.visible = false;
    box.setFromObject(this.object);
    this.icon.visible = wasVisible;
    box.expandByScalar(-0.06);
    return box;
  }

  dispose(): void {
    this.object.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      } else if (obj instanceof THREE.Sprite) {
        const mat = obj.material as THREE.SpriteMaterial;
        if (mat.map) mat.map.dispose();
        mat.dispose();
      }
    });
  }
}

export const OBSTACLE_KINDS: readonly ObstacleKind[] = ["lane", "jump", "jumpLow", "crouch"];

/** SPAWN.KIND_WEIGHT に従って kind を抽選 */
export function pickObstacleKind(): ObstacleKind {
  const w = SPAWN.KIND_WEIGHT;
  const r = Math.random();
  let acc = w.lane;
  if (r < acc) return "lane";
  acc += w.jump;
  if (r < acc) return "jump";
  acc += w.jumpLow;
  if (r < acc) return "jumpLow";
  return "crouch";
}
