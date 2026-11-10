import { defineConfig } from "vite";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// app.js와 style.css는 이름이 고정이라 브라우저와 GitHub Pages가 예전 파일을 붙잡을 수 있다.
// 내용의 해시를 붙여 배포할 때마다 새 파일을 받게 한다.
// 화면 보안 정책(CSP): 스크립트는 우리 주소와 PDF 라이브러리만, 연결은 Supabase와 카카오만
const sbUrl = process.env.VITE_SUPABASE_URL || (readFileSync("src/config.js", "utf8").match(/SUPABASE_URL = "([^"]+)"/) || [])[1] || "";
const sbWs = sbUrl.replace(/^http/, "ws");
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/ https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  `connect-src 'self' ${sbUrl} ${sbWs} https://kauth.kakao.com`,
  "object-src 'none'", "base-uri 'self'", "form-action 'self'",
].join("; ");
const ver = createHash("sha256").update(readFileSync("public/app.js")).update(readFileSync("public/style.css")).digest("hex").slice(0, 10);

export default defineConfig({
  base: "./",
  define: { __APP_VER__: JSON.stringify(ver) },
  build: { outDir: "dist", emptyOutDir: true, target: "es2020" },
  plugins: [{ name: "kei-ver", transformIndexHtml: { order: "post", handler: html => html.replace(/href="(\.?\/)style\.css"/, `href="$1style.css?v=${ver}"`).replace("<meta charset=\"utf-8\">", `<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${CSP}">`) } }],
});
