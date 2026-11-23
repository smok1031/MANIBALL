// 디자인 시안 A(design/home/Main.dc.html)에 실제 앱 화면 사진 5장을 넣어 한 장짜리 정적 페이지로 묶는다.
// 결과: public/v2/index.html (vite가 dist/v2/로 복사)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { execSync } from "node:child_process";

// 점검 문지기와 새 버전 확인에 쓰는 값: 이 빌드의 버전(git 짧은 번호)과 Supabase 공개 주소, 공개 키, 스키마
const VER = (() => { try { return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch (e) { return ""; } })();
const cfgSrc = readFileSync(new URL("../src/config.js", import.meta.url), "utf8");
const MB_CFG = {
  url: process.env.VITE_SUPABASE_URL || (cfgSrc.match(/SUPABASE_URL = "([^"]+)"/) || [])[1] || "",
  key: process.env.VITE_SUPABASE_KEY || (cfgSrc.match(/SUPABASE_KEY = "([^"]+)"/) || [])[1] || "",
  schema: process.env.VITE_SUPABASE_SCHEMA || "public",
  ver: VER,
};

// 홍보 페이지: PC 시안(PC_Landing)을 그린 정적 조각(design/landing/landing.html, tools/snap-landing.py로 만듦)에 머리말만 붙인다.
// 시안은 폭 760px 아래에서 휴대폰 배치로 바뀐다. 로그인과 팀 만들기 버튼은 실제 앱(team/)으로 간다
const SITE = process.env.VITE_STAGE === "test" ? "https://smok1031.github.io/MANIBALL/test/v2/" : "https://smok1031.github.io/MANIBALL/v2/";
const main = readFileSync(new URL("../design/landing/landing.html", import.meta.url), "utf8");
for (const need of ['href="team/"', 'id="before"', 'id="screens"', 'id="start"', 'id="pc"']) if (!main.includes(need)) throw new Error("landing missing: " + need);
const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="maint-config.js?v=${VER}"></script>
<script src="maint-gate.js?v=${VER}"></script>
<title>매니볼 | 축구팀, 풋살팀 관리를 편하게</title>
<meta name="description" content="참석 투표, 라인업, 현장 출석과 벌금, 회비, 경기 기록과 MOM까지. 우리 팀 링크 하나에서 자동으로 정리돼요. 카카오로 한 번 로그인하면 끝, 앱 설치는 필요 없어요.">
<meta property="og:type" content="website">
<meta property="og:title" content="매니볼 | 축구팀, 풋살팀 관리를 편하게">
<meta property="og:description" content="운영진이 매주 손으로 하던 일, 이제 매니볼이 해요">
<meta property="og:image" content="${SITE}team/icon-512.png">
<meta property="og:url" content="${SITE}">
<meta name="theme-color" content="#FBF7EF">
<link rel="icon" href="team/icon-192.png">
<link rel="apple-touch-icon" href="team/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Black+Han+Sans&family=IBM+Plex+Sans+KR:wght@400;500;700&display=swap">
<style>
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;background:#FBF7EF;word-break:keep-all}
section[id]{scroll-margin-top:16px}
.screen[inert]{pointer-events:none}
</style>
</head>
<body>
${main}
</body>
</html>
`;
mkdirSync(new URL("../public/v2/", import.meta.url), { recursive: true });
writeFileSync(new URL("../public/v2/index.html", import.meta.url), html);
console.log("public/v2/index.html", html.length, "bytes");

// 점검 안내 화면과 문지기 (원본은 maint/). 캐시에 옛 파일이 남지 않게 주소에 버전을 붙인다
writeFileSync(new URL("../public/v2/maint-config.js", import.meta.url), `window.MB_CFG = ${JSON.stringify(MB_CFG)};\n`);
for (const f of ["maint.html", "maint.js", "maint-gate.js"]) writeFileSync(new URL(`../public/v2/${f}`, import.meta.url), readFileSync(new URL(`../maint/${f}`, import.meta.url), "utf8").replaceAll("__VER__", VER));

// 휴대폰 알림과 홈 화면 추가 (원본은 pwa/). 앱 주소(v2/team/) 바로 아래에 둔다
const PWA = new URL("../public/v2/team/", import.meta.url);
mkdirSync(PWA, { recursive: true });
for (const f of ["sw.js", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "badge-96.png"]) copyFileSync(new URL(`../pwa/${f}`, import.meta.url), new URL(f, PWA));
const appName = process.env.VITE_STAGE === "test" ? "매니볼 테스트" : "매니볼";
writeFileSync(new URL("manifest.webmanifest", PWA), JSON.stringify({
  name: appName, short_name: appName, id: "./", start_url: "./", scope: "./", display: "standalone", lang: "ko",
  background_color: "#FBF7EF", theme_color: "#FBF7EF",
  icons: [
    { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
}, null, 2));
