import { defineConfig } from "vite";

// Stage 3 / 2026-05-13: Firebase Hosting 移行に伴い base path を `/` に。
// 旧公開 URL: https://yasushi-honda-prog.github.io/tadakayo-game/
// 新公開 URL: https://tadakayo-game-yh.web.app/ (Firebase Hosting)
//   + (オプション) カスタムドメイン game.tadakayo.jp 等
export default defineConfig({
  base: "/",
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: "es2022",
    sourcemap: false,
    rollupOptions: {
      output: {
        // Firebase SDK (~250KB) は dynamic import 経由で分離。
        // initial bundle に含めず、GameRecord 初期化時にロードされる。
        manualChunks: (id) => {
          if (id.includes("node_modules/firebase")) return "firebase";
          if (id.includes("node_modules/@firebase")) return "firebase";
          if (id.includes("node_modules/@dimforge/rapier3d-compat")) return "rapier";
          return undefined;
        },
      },
    },
  },
});
