// 3D オープンワールド「タダカヨ村」のバランス・物理パラメータ。

export const STORAGE_KEYS = {
  AUDIO_MUTED: "tadakayo-game.audioMuted",
  HIGHEST_MISSION: "tadakayo-game.highestMission",
} as const;

/** 物理パラメータ */
export const PHYSICS = {
  GRAVITY: { x: 0, y: -22, z: 0 },
  /** Rapier の固定タイムステップ。step ベースで物理が更新される */
  FIXED_DT: 1 / 60,
} as const;

/** プレイヤー（KinematicCharacterController）の挙動 */
export const PLAYER = {
  /** 出現位置 */
  SPAWN: { x: 0, y: 4, z: 8 },
  /** 移動速度（地上） m/s */
  MOVE_SPEED: 5.5,
  /** 走り（Shift 押下時） */
  RUN_SPEED: 8.5,
  /** ジャンプの初速 m/s */
  JUMP_VELOCITY: 8.0,
  /** 重力（自前で character controller の縦速を加算する分） */
  GRAVITY_PULL: 22,
  /** カプセルコライダー: 半径と上下半高 */
  COLLIDER: { radius: 0.35, halfHeight: 0.55 },
  /** ジャンプバッファ（着地直前の入力許容秒数） */
  JUMP_BUFFER_SEC: 0.16,
  /** コヨーテ時間（地面を離れた直後でもジャンプ可） */
  COYOTE_SEC: 0.12,
  /** sprite の表示寸法 */
  SPRITE_SIZE: { width: 1.4, height: 2.0 },
} as const;

/** 三人称カメラ（後方追従＋ピッチヨー） */
export const CAMERA = {
  DISTANCE: 6.0,
  HEIGHT: 2.4,
  /** マウス感度 */
  MOUSE_SENSITIVITY_X: 0.0035,
  MOUSE_SENSITIVITY_Y: 0.0028,
  /** タッチ感度 */
  TOUCH_SENSITIVITY_X: 0.005,
  TOUCH_SENSITIVITY_Y: 0.004,
  /** ピッチの上下限 [rad]（真上・真下を抑制） */
  PITCH_MIN: -1.1,
  PITCH_MAX: 0.45,
  /** カメラの追従補間 */
  LERP_POS: 0.18,
  LERP_ANGLE: 0.22,
} as const;
