import { defineConfig } from "vite";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// app.js와 style.css는 이름이 고정이라 브라우저와 GitHub Pages가 예전 파일을 붙잡을 수 있다.
// 내용의 해시를 붙여 배포할 때마다 새 파일을 받게 한다.
const ver = createHash("sha256").update(readFileSync("public/app.js")).update(readFileSync("public/style.css")).digest("hex").slice(0, 10);

export default defineConfig({
  base: "./",
  define: { __APP_VER__: JSON.stringify(ver) },
  build: { outDir: "dist", emptyOutDir: true, target: "es2020" },
  plugins: [{ name: "kei-ver", transformIndexHtml: { order: "post", handler: html => html.replace(/href="(\.?\/)style\.css"/, `href="$1style.css?v=${ver}"`) } }],
});
