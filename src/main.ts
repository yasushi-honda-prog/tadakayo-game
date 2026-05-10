/// <reference types="vite/client" />
import { Game } from "./core/Game";
import { PhysicsWorld } from "./core/PhysicsWorld";

async function bootstrap(): Promise<void> {
  const canvas = document.getElementById("game-canvas") as HTMLCanvasElement | null;
  if (!canvas) throw new Error("game-canvas が見つかりません");

  // Rapier WASM 初期化を待ってから Game を起動
  const physics = await PhysicsWorld.create();
  const game = new Game(canvas, physics);
  game.start();

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      game.dispose();
      physics.dispose();
    });
  }
}

function showBootError(err: unknown): void {
  const root = document.getElementById("game-root");
  if (!root) return;
  // textContent 中心で組み立てて XSS リスクを避ける
  while (root.firstChild) root.removeChild(root.firstChild);
  const wrap = document.createElement("div");
  wrap.style.cssText =
    "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:'Noto Sans JP',sans-serif;color:#1a1a1a;background:#ffe2f7;";
  const inner = document.createElement("div");
  const h2 = document.createElement("h2");
  h2.style.color = "#e33535";
  h2.textContent = "起動エラー";
  const p = document.createElement("p");
  p.textContent = "WebGL や WebAssembly に対応したブラウザでお試しください。";
  const pre = document.createElement("pre");
  pre.style.cssText = "font-size:11px;text-align:left;background:#fff;padding:8px;border-radius:8px;overflow:auto;max-width:80vw;";
  pre.textContent = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ""}` : String(err);
  inner.appendChild(h2);
  inner.appendChild(p);
  inner.appendChild(pre);
  wrap.appendChild(inner);
  root.appendChild(wrap);
}

bootstrap().catch((err) => {
  console.error("Failed to bootstrap game:", err);
  showBootError(err);
});
