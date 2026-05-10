// NPO法人タダカヨ ブランドガイドライン定数
// 出典: ブランドガイドライン（仮２） 2026

export const BRAND = {
  // プライマリ
  PRIMARY: "#e33535",
  PRIMARY_RGB: { r: 0xe3 / 255, g: 0x35 / 255, b: 0x35 / 255 },

  // セカンダリ
  PINK: "#ffe2f7",
  PINK_RGB: { r: 0xff / 255, g: 0xe2 / 255, b: 0xf7 / 255 },

  // モノトーン
  BLACK: "#000000",
  GRAY: "#f2f2f2",
  WHITE: "#ffffff",

  // 背景・空（ピンク寄りの淡いトーン、温かみ重視）
  SKY_TOP: "#ffe2f7",
  SKY_BOTTOM: "#fff5fb",

  // 床（ロゴと衝突しない優しい灰）
  GROUND: "#f7f0ec",
  GROUND_LANE: "#ebd9d9",

  // フォント
  FONT_FAMILY: '"Noto Sans JP", system-ui, -apple-system, sans-serif',
} as const;

// Three.js 用 0xRRGGBB 数値
export const BRAND_HEX = {
  PRIMARY: 0xe33535,
  PINK: 0xffe2f7,
  BLACK: 0x000000,
  GRAY: 0xf2f2f2,
  WHITE: 0xffffff,
  SKY_TOP: 0xffe2f7,
  SKY_BOTTOM: 0xfff5fb,
  GROUND: 0xf7f0ec,
  GROUND_LANE: 0xebd9d9,
} as const;
