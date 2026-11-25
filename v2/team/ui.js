// 뉴버전 공통 모양: 머리, 하단 탭(탭마다 줄 색), 팀 로고, 아이콘, 줄 버튼, 창
import { S, esc, sport, isAdmin, route, viewMode } from "./main.js";
import { chatUnread } from "./chat.js";
import { isPC } from "./pc.js";

// 17안 색: 종이 바탕, 먹색 글자와 선, 흰 카드. 예전 이름(blue, orange 등)은 같은 역할의 17안 색으로 바꿔 둠
// blue: 가장 가까운 일정 같은 강조면(옅은 파랑), orange: 누를 곳 노랑, green: 옅은 초록, pink: MOM 분홍, clay: 옅은 분홍, teal(대기): 먹색
export const C = { bg: "#FBF7EF", ink: "#121110", sub: "#5B5650", line: "#DDD6C8", mute: "#9C9488", gray: "#FFFFFF", white: "#FFFFFF", blue: "#CDDFFF", orange: "#FCD01A", green: "#C8E8CD", pink: "#FDD1D8", clay: "#FFECEF", teal: "#121110", yel: "#FCD01A", danger: "#8C3B28", fc: "#5B8DEF", fs: "#69BA7C", sec: "var(--sec)", sec2: "var(--sec2)", sec3: "var(--sec3)", sect: "var(--sect)", sh: "4px 4px 0 #121110" };
const sv = (d, w = 20, sw = 2.2, extra = "") => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="${C.ink}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${d}</svg>`;
export const IC = {
  back: sv(`<path d="M15 5l-7 7 7 7"></path>`, 22),
  chev: sv(`<path d="M9 5l7 7-7 7"></path>`, 18, 2.4, ` class="chev"`),
  arrow: sv(`<path d="M5 12h14M13 6l6 6-6 6"></path>`, 20, 2.4),
  bell: sv(`<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"></path><path d="M10 20a2 2 0 0 0 4 0"></path>`, 24),
  chat: sv(`<path d="M4 5h16v11H9l-5 4z"></path><path d="M8 9.5h8M8 12.5h5"></path>`, 24),
  target: sv(`<circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="3" fill="${C.ink}"></circle>`),
  swap: sv(`<path d="M4 8h13l-3-3M20 16H7l3 3"></path>`),
  user: sv(`<circle cx="12" cy="8" r="4"></circle><path d="M4 21c1-4 4-6 8-6s7 2 8 6"></path>`),
  leave: sv(`<path d="M14 4H6v16h8M11 12h9M17 9l3 3-3 3"></path>`),
  megaphone: sv(`<path d="M4 10v4h3l6 4V6L7 10z"></path><path d="M17 9a4 4 0 0 1 0 6"></path>`, 22),
  doc: sv(`<path d="M6 3h9l3 3v15H6z"></path><path d="M9 10h6M9 14h6M9 18h4"></path>`, 22),
  card: sv(`<rect x="3" y="6" width="18" height="13" rx="2"></rect><path d="M3 10h18"></path><circle cx="16" cy="15" r="1.4" fill="${C.ink}"></circle>`, 22),
  people: sv(`<circle cx="9" cy="8" r="3.2"></circle><path d="M3 20c.8-3.5 3-5.5 6-5.5s5.2 2 6 5.5"></path><circle cx="17" cy="9" r="2.4"></circle><path d="M16 14.6c2.6.2 4.4 2 5 5.4"></path>`, 22),
  plus: sv(`<path d="M12 5v14M5 12h14"></path>`),
  split: sv(`<path d="M7 4v16M17 4v16M3 12h18"></path>`),
  sliders: sv(`<path d="M4 7h10M18 7h2M4 17h2M10 17h10"></path><circle cx="16" cy="7" r="2"></circle><circle cx="8" cy="17" r="2"></circle>`, 16, 2.4),
  list: sv(`<path d="M8 6h12M8 12h12M8 18h12"></path><circle cx="4" cy="6" r="1" fill="${C.ink}"></circle><circle cx="4" cy="12" r="1" fill="${C.ink}"></circle><circle cx="4" cy="18" r="1" fill="${C.ink}"></circle>`),
  field: sv(`<rect x="3" y="4" width="18" height="16" rx="1"></rect><path d="M3 12h18"></path><circle cx="12" cy="12" r="2.5"></circle>`),
  check: sv(`<path d="M5 12l5 5 9-10"></path>`),
  merc: sv(`<path d="M9 4.8a3.2 3.2 0 1 1 0 6.4a3.2 3.2 0 1 1 0-6.4M3 20c.8-3.5 3-5.5 6-5.5s5.2 2 6 5.5M18 8v6M15 11h6"></path>`),
  pen: sv(`<path d="M4 20h4L19 9l-4-4L4 16z"></path><path d="M13 7l4 4"></path>`),
  trash: sv(`<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"></path>`),
  join: sv(`<circle cx="9" cy="8" r="3.2"></circle><path d="M3 20c.8-3.5 3-5.5 6-5.5s5.2 2 6 5.5M18 8v6M15 11h6"></path>`),
  coin: sv(`<circle cx="12" cy="12" r="8"></circle><path d="M12 8v8M9.5 10.5c0-1.2 1.1-2 2.5-2s2.5.8 2.5 2-1.1 1.5-2.5 1.5-2.5.6-2.5 1.8 1.1 2 2.5 2 2.5-.8 2.5-2"></path>`),
  receipt: sv(`<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"></path><path d="M9 8h6M9 12h6"></path>`),
  shield: sv(`<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"></path>`),
  gear: sv(`<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"></path>`),
  bin: sv(`<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"></path>`),
  ball: sv(`<circle cx="12" cy="12" r="9"></circle><path d="M12 7l4 3-1.5 4.5h-5L8 10z"></path>`),
  star: sv(`<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"></path>`),
  clock: sv(`<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>`),
};

// 팀 로고: 축구 FC 파랑, 풋살 FS 초록 (남색 선과 글자)
export function teamLogo(sz, sp) {
  const soc = (sp || sport()) === "soccer"; const fill = soc ? C.fc : C.fs; const tag = soc ? "FC" : "FS";
  const lines = soc ? `<rect x="33" y="15" width="34" height="13"></rect><rect x="41" y="15" width="18" height="6"></rect><rect x="33" y="72" width="34" height="13"></rect><rect x="41" y="79" width="18" height="6"></rect>`
    : `<path d="M34 15 A10 10 0 0 0 44 25 L56 25 A10 10 0 0 0 66 15"></path><path d="M34 85 A10 10 0 0 1 44 75 L56 75 A10 10 0 0 1 66 85"></path>`;
  return `<svg width="${sz}" height="${sz}" viewBox="6 6 88 88" role="img" aria-label="${soc ? "축구" : "풋살"}" style="flex:none;display:block"><rect x="6" y="6" width="88" height="88" rx="22" fill="${fill}"></rect><g fill="none" stroke="${C.ink}" stroke-width="2.5" stroke-linejoin="round" opacity="0.9"><rect x="18" y="15" width="64" height="70" rx="1"></rect><line x1="18" y1="50" x2="82" y2="50"></line>${lines}</g><rect x="25" y="37" width="50" height="26" rx="6" fill="${fill}"></rect><text x="50" y="61" text-anchor="middle" font-family="'IBM Plex Sans KR', sans-serif" font-weight="700" font-size="30" fill="${C.ink}">${tag}</text></svg>`;
}
// 매니볼 로고 (로그인 전 화면)
export const MB = sz => `<svg width="${sz}" height="${sz}" viewBox="0 0 64 64" role="img" aria-label="매니볼" style="flex:none;display:block"><rect width="64" height="64" rx="16" fill="${C.fc}" stroke="${C.ink}" stroke-width="3"></rect><circle cx="32" cy="32" r="20" fill="none" stroke="${C.ink}" stroke-width="4.5"></circle><circle cx="24" cy="26" r="3.2" fill="#E46A2E"></circle><circle cx="24" cy="38" r="3.2" fill="#E46A2E"></circle><path d="M30 26 H42 M30 38 H40" fill="none" stroke="${C.ink}" stroke-width="4.5" stroke-linecap="round"></path></svg>`;

// 탭: 홈 파랑, 일정 청록, 기록 분홍, 팀 초록, 운영 보라 (색 한 벌은 index.html의 data-sec)
const TABS = [["#/", "홈", "home"], ["#/schedule", "일정", "schedule"], ["#/chat", "대화", "chat"], ["#/records", "기록", "record"], ["#/team", "팀", "team"], ["#/ops", "운영", "ops"]];
export const setSec = k => { if (document.documentElement.dataset.sec !== k) document.documentElement.dataset.sec = k; };
// 아래 탭 (54번 B): 떠 있는 칸 묶음, 지금 탭 칸은 그 탭 색으로 왼쪽 위로 살짝 올라옴. 탭을 옮겼을 때만 올라오는 모션을 보인다
const NAVI = {
  홈: `<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"></path>`,
  일정: `<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18M8 3v4M16 3v4"></path>`,
  대화: `<path d="M4 5h16v11H9l-5 4z"></path><path d="M8 9h8M8 12h5"></path>`,
  기록: `<path d="M3 20h18M6 20v-8M12 20V5M18 20v-5"></path>`,
  팀: `<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"></path><circle cx="17" cy="9" r="2.5"></circle><path d="M16.5 14.6c2.4.3 4.2 2.1 4.8 5.4"></path>`,
  운영: `<path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"></path>`,
};
let lastTab = "";
export function navBar(on) {
  const t = isAdmin() && viewMode() === "admin" ? TABS : TABS.filter(x => x[2] !== "ops");
  const cu = chatUnread();
  const cur = TABS.find(x => x[1] === on); if (cur) setSec(cur[2]);
  const lift = lastTab && lastTab !== on; lastTab = on;
  if (isPC()) return ""; // PC는 왼쪽 메뉴를 쓴다
  return `<div class="navw"><nav class="nav" aria-label="하단 메뉴">${t.map(([h, l]) => `<a href="${h}"${on === l ? ` aria-current="page"${lift ? ' class="lift"' : ""}` : ""}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${NAVI[l]}</svg><span>${l}</span>${l === "대화" && cu ? `<i class="nb" aria-label="안 읽은 글 ${cu}개">${cu > 99 ? "99+" : cu}</i>` : ""}</a>`).join("")}</nav></div>`;
}
// 머리: 뒤로가 있는 화면
export function hd(title, back, opts = {}) {
  const b = back ? `<a class="ib" href="${esc(back)}" aria-label="뒤로"${opts.backAct ? ` data-act="${opts.backAct}"` : ""}>${IC.back}</a>` : "";
  const tt = opts.sub ? `<span class="tt"><b>${esc(title)}</b><span>${esc(opts.sub)}</span></span>` : `<span class="tt"><b>${esc(title)}</b></span>`;
  return `<header class="hd back">${b}${b ? "" : `<span style="width:12px"></span>`}${tt}${opts.right || ""}</header>`;
}
// 머리: 탭 첫 화면 (큰 제목)
export const hdTab = (title, right = "") => `<header class="hd" style="padding:0 8px 0 12px"><h1>${esc(title)}</h1>${right}</header>`;
// 머리: 팀 이름과 로고
export const hdBrand = (right = "", back = "") => `<header class="hd">${back ? `<a class="ib" href="${esc(back)}" aria-label="뒤로">${IC.back}</a>` : ""}<span class="brand">${teamLogo(32)}<b>${esc(S.team ? S.team.name : "")}</b></span>${right}</header>`;
export const mngBtn = (act, extra = "") => `<button type="button" class="mng" data-act="${act}" aria-label="일정 관리" title="일정 관리"${extra}>${IC.sliders}</button>`;
// 줄 버튼 (아이콘, 제목, 설명, 오른쪽)
export function lrow({ href, act, data = "", icon, tone, title, sub, right, big, danger, attrs = "" }) {
  const inner = `<span class="ic ${tone || ""}" aria-hidden="true">${icon || ""}</span><span class="tx"><b${danger ? ' style="color:#8C3B28"' : ""}>${esc(title)}</b>${sub ? `<span>${sub}</span>` : ""}</span>${right ? `<span class="rt">${right}</span>` : ""}${IC.chev}`;
  const cls = `lr${big ? " big" : ""}`;
  return href ? `<a class="${cls}" href="${esc(href)}"${attrs}>${inner}</a>` : `<button type="button" class="${cls}" data-act="${act}"${data}${attrs}>${inner}</button>`;
}
// 가운데 확인 창
export function dlg(html) {
  const L = document.getElementById("layer");
  L.innerHTML = `<div class="dlg" data-act="closeSheet"><div role="alertdialog" aria-modal="true">${html}</div></div>`;
  const f = L.querySelector("textarea,input,button"); if (f && f.tagName !== "BUTTON") f.focus();
}
export const sw = on => `<span class="sw${on ? " on" : ""}" aria-hidden="true"><i></i></span>`;
export const empty = (t, s = "") => `<div class="empty"><b>${esc(t)}</b>${s ? `<span>${s}</span>` : ""}</div>`;
export const initial = n => (String(n || "").replace(/[^0-9A-Za-z가-힣]/g, "")[0] || "?");
export const isRoute = re => re.test(route());
