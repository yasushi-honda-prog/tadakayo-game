import { defineConfig } from "vite";

// GitHub Pages 公開時のリポジトリ名に合わせる。
// 公開 URL: https://yasushi-honda-prog.github.io/tadakayo-game/
export default defineConfig({
  base: "/tadakayo-game/",
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: "es2022",
    sourcemap: false,
  },
});
