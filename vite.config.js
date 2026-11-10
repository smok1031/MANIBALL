import { defineConfig } from "vite";
import { readFileSync } from "node:fs";

// 화면 보안 정책(CSP): 스크립트는 우리 주소만, 연결은 Supabase와 카카오만
const sbUrl = process.env.VITE_SUPABASE_URL || (readFileSync("src/config.js", "utf8").match(/SUPABASE_URL = "([^"]+)"/) || [])[1] || "";
const sbWs = sbUrl.replace(/^http/, "ws");
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' ${sbUrl} ${sbWs} https://kauth.kakao.com`,
  "object-src 'none'", "base-uri 'self'", "form-action 'self'",
].join("; ");

export default defineConfig({
  base: "./",
  build: { outDir: "dist", emptyOutDir: true, target: "es2020", rollupOptions: { input: { main: "index.html", team: "v2/team/index.html" } } },
  plugins: [{ name: "mb-csp", transformIndexHtml: { order: "post", handler: html => html.replace("<meta charset=\"utf-8\">", `<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${CSP}">`) } }],
});
