// 디자인 시안 A(design/home/Main.dc.html)에 실제 앱 화면 사진 5장을 넣어 한 장짜리 정적 페이지로 묶는다.
// 결과: public/v2/index.html (vite가 dist/v2/로 복사)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";

const ACCENT = "#15803D";
const APP_URL = "team/"; // 새 디자인 화면(눌러 보기용). 실제 앱이 붙으면 여기만 바꾼다.
const dir = new URL("../design/home/", import.meta.url);
const read = f => readFileSync(new URL(f, dir), "utf8");
const body = src => {
  const x = src.slice(src.indexOf("<x-dc>") + 6, src.indexOf("</x-dc>"));
  return x.replace(/<helmet>[\s\S]*?<\/helmet>/, "").trim();
};

const screens = {};
for (const n of ["AppVote", "AppLineup", "AppCheck", "AppDues", "AppEvent"]) screens[n] = body(read(`${n}.dc.html`));

// 예시 화면 자리에는 실제 앱 화면을 찍은 사진(design/home/shots)을 넣는다. 설명 문구는 시안의 aria-label을 쓴다
const SHOTS = new URL("../design/home/shots/", import.meta.url); let shotN = 0;
mkdirSync(new URL("../public/v2/shots/", import.meta.url), { recursive: true });
let main = body(read("Main.dc.html"))
  .replace(/<dc-import name="(\w+)"[^>]*><\/dc-import>/g, (_, n) => {
    if (!screens[n]) throw new Error("screen missing: " + n);
    const alt = (screens[n].match(/aria-label="([^"]*)"/) || [])[1] || "매니볼 실제 화면";
    for (const ext of ["webp", "png"]) copyFileSync(new URL(`${n}.${ext}`, SHOTS), new URL(`../public/v2/shots/${n}.${ext}`, import.meta.url));
    return `<div class="phone"><div style="width: 320px; height: 660px; box-sizing: border-box; border-radius: 44px; background: #111111; padding: 10px; box-shadow: 0 24px 50px rgba(0,0,0,0.18)"><picture><source srcset="shots/${n}.webp" type="image/webp"><img src="shots/${n}.png" alt="${alt.replace("화면 예시", "실제 화면")}" width="300" height="640" loading="${shotN++ < 2 ? "eager" : "lazy"}" style="display: block; width: 300px; height: 640px; border-radius: 34px; background: #F6F7F9"></picture></div></div>`;
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

// 팀원이 초대 링크로 들어왔을 때 보는 화면으로 가는 길
const MEMBER_URL = "app/JoinInvite.html";
const screensBtn = '<a href="#screens" style="background: #F3F4F6; color: #111827; text-decoration: none; font-weight: 700; font-size: 17px; padding: 16px 24px; border-radius: 14px">실제 화면 보기</a>';
if (!main.includes(screensBtn)) throw new Error("not found: 실제 화면 보기");
main = main.replace(screensBtn, screensBtn + `\n        <a href="${MEMBER_URL}" style="background: #F3F4F6; color: #111827; text-decoration: none; font-weight: 700; font-size: 17px; padding: 16px 24px; border-radius: 14px">팀원 화면 둘러보기</a>`);
main = main.replace("매니볼 ManiBall</footer>", `매니볼 ManiBall<br><a href="app/" style="color: #6B7280">화면 둘러보기</a> &nbsp; <a href="${MEMBER_URL}" style="color: #6B7280">팀원 화면 보기</a> &nbsp; <a href="../privacy.html" style="color: #6B7280">개인정보처리방침</a></footer>`);
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
