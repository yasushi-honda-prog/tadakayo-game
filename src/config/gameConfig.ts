// ゲームバランス調整値。MVPで遊んで調整するための一元管理。

export const LANE = {
  // 3レーン: 左 / 中央 / 右
  POSITIONS: [-2, 0, 2] as const,
  WIDTH: 2,
  // レーン移動の補間係数（lerp）。大きいほど機敏、小さいほどヌルッと
  LERP: 0.18,
} as const;

export const PLAYER = {
  START_LANE: 1, // 中央
  GROUND_Y: 0.5,
  // ジャンプ
  JUMP_VELOCITY: 9,
  GRAVITY: -22,
  // 当たり判定（見た目より甘め: 足元小さめBox / 収集は広めBox）
  HITBOX: { width: 0.55, height: 1.0, depth: 0.55 },
  PICKUP_BOX: { width: 1.4, height: 1.6, depth: 1.4 },
  // 描画サイズ（ビルボード）
  SPRITE_SIZE: { width: 1.2, height: 1.8 },
} as const;

export const TRACK = {
  // 走路の見た目の長さ。Z+方向に向かって流れる
  LENGTH: 100,
  WIDTH: 8,
  // 床のスクロール係数（speed * dt をUVに加算）
  SCROLL_FACTOR: 1 / 4,
} as const;

export const SPEED = {
  INITIAL: 6, // m/s
  PER_10_SEC: 0.6, // 10秒ごとに +0.6
  MAX: 13,
} as const;

export const SPAWN = {
  // 初期スポーン間隔（秒）。徐々に短くなる
  INITIAL_INTERVAL: 1.4,
  MIN_INTERVAL: 0.7,
  INTERVAL_DECAY_PER_10_SEC: 0.08,
  // スポーンZ（プレイヤー奥）
  Z: -60,
  // 障害物 vs 収集アイテムの比率
  OBSTACLE_RATIO: 0.55,
} as const;

export const SCORE = {
  PICKUP: 10,
  PER_METER: 1,
} as const;

export const STORAGE_KEYS = {
  HIGH_SCORE: "tadakayo-game.highScore",
  AUDIO_MUTED: "tadakayo-game.audioMuted",
} as const;
