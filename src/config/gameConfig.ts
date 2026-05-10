// ゲームバランス調整値。MVPで遊んで調整するための一元管理。

export const LANE = {
  POSITIONS: [-2, 0, 2] as const,
  WIDTH: 2,
  LERP: 0.18,
} as const;

export const PLAYER = {
  START_LANE: 1,
  GROUND_Y: 0.5,
  // ジャンプ
  JUMP_VELOCITY: 10,
  GRAVITY: -28,
  // しゃがみ持続時間（秒）。タップ/下方向入力で発動、自動解除
  CROUCH_DURATION: 0.7,
  // 当たり判定（見た目より甘め）
  HITBOX: { width: 0.55, height: 1.2, depth: 0.55 },
  HITBOX_CROUCH: { width: 0.55, height: 0.5, depth: 0.55 },
  PICKUP_BOX: { width: 1.4, height: 1.8, depth: 1.4 },
  SPRITE_SIZE: { width: 1.2, height: 1.8 },
} as const;

export const TRACK = {
  LENGTH: 100,
  WIDTH: 8,
  SCROLL_FACTOR: 1 / 4,
} as const;

export const SPEED = {
  INITIAL: 6,
  PER_10_SEC: 0.6,
  MAX: 14,
} as const;

export const SPAWN = {
  INITIAL_INTERVAL: 1.3,
  MIN_INTERVAL: 0.55,
  INTERVAL_DECAY_PER_10_SEC: 0.09,
  Z: -60,
  // 障害物 vs 収集アイテムの比率
  OBSTACLE_RATIO: 0.6,
  // 障害物のうち、ジャンプ必須／しゃがみ必須／レーン回避の出現比率（合計1.0想定）
  KIND_WEIGHT: { lane: 0.55, jump: 0.25, crouch: 0.2 } as const,
} as const;

export const SCORE = {
  PICKUP: 10,
  PER_METER: 1,
  // コンボシステム
  COMBO_WINDOW_SEC: 3.0, // この秒数以内に次を取るとコンボ継続
  // マルチプライヤーは combo 段階で決まる: 0-2=1x, 3-5=2x, 6-9=3x, 10-14=5x, 15+=8x
  COMBO_TIERS: [
    { min: 0, multiplier: 1 },
    { min: 3, multiplier: 2 },
    { min: 6, multiplier: 3 },
    { min: 10, multiplier: 5 },
    { min: 15, multiplier: 8 },
  ] as const,
  // シールド: 連続収集 N 個でシールド発動
  SHIELD_PICKUPS_REQUIRED: 5,
  SHIELD_DURATION_SEC: 5.0,
} as const;

export const STAGE = {
  // 距離（m）でステージ切替
  THRESHOLDS: [0, 100, 300, 600] as const,
  NAMES: ["現場", "自治体", "全国"] as const,
  // 各ステージの sky / ground 配色（ブランドの範囲で温かみを保つ）
  PALETTES: [
    { sky: 0xffe2f7, skyBottom: 0xfff5fb, ground: 0xf7f0ec, accent: 0xe33535 },
    { sky: 0xffd6c2, skyBottom: 0xfff0e6, ground: 0xefe7e0, accent: 0xff7a4f },
    { sky: 0xfff1a8, skyBottom: 0xfff7d4, ground: 0xefebd6, accent: 0xff8c00 },
  ] as const,
} as const;

export const STORAGE_KEYS = {
  HIGH_SCORE: "tadakayo-game.highScore",
  AUDIO_MUTED: "tadakayo-game.audioMuted",
  DIFFICULTY: "tadakayo-game.difficulty",
} as const;

/** 難易度プリセット。速度倍率と障害物比率を変える */
export type Difficulty = "easy" | "normal" | "hard";

export const DIFFICULTY: Record<
  Difficulty,
  {
    label: string;
    speedScale: number;
    spawnIntervalScale: number; // <1 で短く（難）/ >1 で長く（易）
    obstacleRatio: number;
  }
> = {
  easy: { label: "やさしい", speedScale: 0.85, spawnIntervalScale: 1.25, obstacleRatio: 0.45 },
  normal: { label: "ふつう", speedScale: 1.0, spawnIntervalScale: 1.0, obstacleRatio: 0.6 },
  hard: { label: "むずかしい", speedScale: 1.2, spawnIntervalScale: 0.78, obstacleRatio: 0.7 },
};
