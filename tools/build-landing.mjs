// 디자인 시안 A(design/home/Main.dc.html)와 예시 화면 5장을 한 장짜리 정적 페이지로 묶는다.
// 결과: public/v2/index.html (vite가 dist/v2/로 복사)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const ACCENT = "#15803D";
const APP_URL = "../"; // 지금 쓰는 앱(로그인, 팀 만들기). 새 앱이 생기면 여기만 바꾼다.
const dir = new URL("../design/home/", import.meta.url);
const read = f => readFileSync(new URL(f, dir), "utf8");
const body = src => {
  const x = src.slice(src.indexOf("<x-dc>") + 6, src.indexOf("</x-dc>"));
  return x.replace(/<helmet>[\s\S]*?<\/helmet>/, "").trim();
};

const screens = {};
for (const n of ["AppVote", "AppLineup", "AppCheck", "AppDues", "AppEvent"]) screens[n] = body(read(`${n}.dc.html`));

let main = body(read("Main.dc.html"))
  .replace(/<dc-import name="(\w+)"[^>]*><\/dc-import>/g, (_, n) => {
    if (!screens[n]) throw new Error("screen missing: " + n);
    return `<div class="phone">${screens[n]}</div>`;
  })
  .replaceAll("{{accent}}", "var(--accent)")
  .replaceAll("rgb(21, 128, 61)", "var(--accent)");

// 화면 폭에 맞춰야 하는 곳에만 class를 붙인다.
const tag = (find, cls) => {
  if (!main.includes(find)) throw new Error("not found: " + find);
  main = main.replace(find, find.replace(/^<(\w+)/, `<$1 class="${cls}"`));
};
tag('<h1 style=', "hero-h1");
tag('<div style="flex: 1 1 420px; min-width: 0; display: flex; justify-content: center; align-items: flex-end">', "hero-phones");
tag('<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 18px">', "cards");
tag('<div style="max-width: 1180px; margin: 0 auto; background: #111827; color: #FFFFFF; border-radius: 28px; padding: 56px 40px;', "cta");

// 팀 만들기 버튼은 모두 실제 앱으로 보낸다. 메뉴의 앵커(#before, #screens)는 그대로 둔다.
main = main.replace(/<a href="#start"([^>]*)>우리 팀 만들기<\/a>/g, `<a href="${APP_URL}"$1>우리 팀 만들기</a>`);

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>매니볼 | 축구팀, 풋살팀 관리를 편하게</title>
<meta name="description" content="참석 투표 집계, 축구장 위 라인업과 휴식 자동 배치, 현장 출석과 벌금, 회비, 공지와 MOM 투표까지. 우리 팀 링크 하나로 관리해요.">
<meta property="og:title" content="매니볼">
<meta property="og:description" content="운영진이 매주 손으로 하던 일, 이제 앱이 해요">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%231E6B45'/%3E%3Ccircle cx='32' cy='32' r='22' fill='none' stroke='white' stroke-width='5'/%3E%3Ccircle cx='23' cy='26' r='3.5' fill='%23F5B841'/%3E%3Ccircle cx='23' cy='38' r='3.5' fill='%23F5B841'/%3E%3Cpath d='M30 26 H43 M30 38 H41' fill='none' stroke='white' stroke-width='5' stroke-linecap='round'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap">
<style>
:root{--accent:${ACCENT}}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:#FFFFFF;-webkit-text-size-adjust:100%;word-break:keep-all}
a{color:var(--accent)}a:hover{opacity:.92}
.phone{flex:none}
.cards{grid-template-columns:repeat(auto-fit,minmax(min(330px,100%),1fr))!important}
@media (max-width:720px){
  .hero-h1{font-size:40px!important;letter-spacing:-1px!important}
  .hero-phones{display:none!important}
  .cta{padding:40px 24px!important}
  section{padding-left:16px!important;padding-right:16px!important}
  header{padding-left:16px!important;padding-right:16px!important}
  h2{font-size:28px!important}
}
@media (max-width:360px){.phone{transform:scale(.9);transform-origin:top center;margin-bottom:-66px}}
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
