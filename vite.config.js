import { defineConfig } from "vite";

// GitHub Pages의 /kei-fc/ 아래에서도, 다른 주소에서도 그대로 열리도록 상대 경로로 만든다
export default defineConfig({
  base: "./",
  build: { outDir: "dist", emptyOutDir: true, target: "es2020" },
});
