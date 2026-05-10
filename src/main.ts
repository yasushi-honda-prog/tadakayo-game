/// <reference types="vite/client" />
import { Game } from "./game/Game";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement | null;
if (!canvas) {
  throw new Error("game-canvas が見つかりません");
}

const game = new Game(canvas);
game.start();

// HMR: 開発時にホットリロードで多重起動しないよう dispose
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.dispose();
  });
}
