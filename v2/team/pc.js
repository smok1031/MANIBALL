// PC 화면 (브라우저 가로 1024px 이상): PC 시안처럼 왼쪽 메뉴와 넓은 본문. 휴대폰 화면은 그대로 둔다.
// 화면 내용은 휴대폰과 같은 코드로 그리고, 여기서는 왼쪽 메뉴로 감싸기만 한다 (휴대폰과 PC가 엇갈리지 않게).
import { S, esc, isAdmin, viewMode, myProfile, nameOf, sport, MBRAND, upcoming, past, isPlay, isCanceled } from "./main.js";
import { teamLogo, C } from "./ui.js";
import { chatUnread } from "./chat.js";

const MQ = typeof matchMedia === "function" ? matchMedia("(min-width: 1024px)") : null;
export const isPC = () => !!(MQ && MQ.matches);
export function onPCChange(fn) { if (MQ && MQ.addEventListener) MQ.addEventListener("change", fn); }

const sv = p => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
// [주소, 이름, 탭 색 이름, 탭 색, 아이콘]
const MENU = [
  ["#/", "홈", "home", "#7CA4F0", `<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"></path>`],
  ["#/schedule", "일정", "schedule", "#14BBC2", `<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18M8 3v4M16 3v4"></path>`],
  ["#/chat", "대화", "chat", "#D9BF8C", `<path d="M4 4.5h16v11.5H10.5L6 19.5V16H4z"></path><path d="M8 8.8h8M8 11.8h5"></path>`],
  ["#/records", "기록", "record", "#E48398", `<path d="M3 20h18M6 20v-8M12 20V5M18 20v-5"></path>`],
  ["#/team", "팀", "team", "#69BA7C", `<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"></path><circle cx="17" cy="9" r="2.5"></circle><path d="M16.5 14.6c2.4.3 4.2 2.1 4.8 5.4"></path>`],
  ["#/ops", "운영", "ops", "#B093E5", `<circle cx="12" cy="12" r="3"></circle><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"></path>`],
];
const OTHER = [
  ["#/match", "매칭", "match", `<path d="M4 7h11l-3-3M20 17H9l3 3"></path>`],
  ["#/hire", "용병 구인", "hire", `<path d="M4 10v4h3l7 4V6L7 10z"></path><path d="M18 9a4 4 0 0 1 0 6"></path>`],
  ["#/seek", "용병 구직", "seek", `<circle cx="10" cy="8" r="4"></circle><path d="M3 21c.8-4 3.5-6 7-6 1.4 0 2.6.3 3.6.9"></path><circle cx="18" cy="17" r="3"></circle><path d="M20.2 19.2 22 21"></path>`],
];
// 다른 팀과 기능이 열렸는지 (3단계에서 켠다)
export const OTHER_ON = { on: true };

const BRAND_ = () => MBRAND(32);

export function pcShell(html) {
  const sec = document.documentElement.dataset.sec || "home";
  const adm = isAdmin() && viewMode() === "admin";
  const items = MENU.filter(m => adm || m[2] !== "ops");
  const cu = chatUnread();
  const nav = items.map(([h, l, k, col, ic]) => `<a href="${h}"${k === sec && sec !== "other" ? ` aria-current="page"` : ""} style="--c:${col}">${sv(ic)}<span>${l}</span>${k === "chat" && cu ? `<i class="pcn" aria-label="안 읽은 글 ${cu}개">${cu > 99 ? "99+" : cu}</i>` : ""}</a>`).join("");
  const hash = location.hash || "#/";
  const other = OTHER.map(([h, l, k, ic]) => OTHER_ON.on
    ? `<a href="${h}"${hash === h ? ` aria-current="page"` : ""} style="--c:#F2A65A">${sv(ic)}<span>${l}</span></a>`
    : `<span class="off" aria-disabled="true">${sv(ic)}<span>${l}</span><i>준비 중</i></span>`).join("");
  const p = myProfile() || {};
  const me = p.name || nameOf(S.uid);
  const role = { owner: "Admin", admin: "운영진", member: "팀원" }[S.role] || "";
  return `<div class="pcw"><aside class="pcs" aria-label="팀과 메뉴">${BRAND_()}
    <button type="button" class="pct" data-act="switchTeam" aria-label="${esc((S.team && S.team.name) || "")}, 팀 바꾸기"><span class="pctl">${teamLogo(40)}</span><span class="pctx"><b>${esc((S.team && S.team.name) || "")}</b><span>${sport() === "soccer" ? "축구팀" : "풋살팀"}  ${role}</span></span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${C.ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h13l-3-3M20 16H7l3 3"></path></svg></button>
    <nav class="pnv" aria-label="메뉴">${nav}</nav>
    <div class="pco"><span class="pcoh"><i aria-hidden="true"></i>다른 팀과</span><nav class="pnv sm" aria-label="다른 팀과">${other}</nav></div>
    <div class="pcu"><span class="pcun" aria-hidden="true">${esc(p.num || "")}</span><span class="pcux"><b>${esc(me)}</b><span>카카오 계정 연결됨</span></span><button type="button" class="lnk" data-act="logout">로그아웃</button></div>
  </aside><div class="pcm"><div class="pcc">${html}</div></div></div>`;
}

// 2단계: 챕터 화면을 왼쪽 목록, 오른쪽 상세 두 칸으로 (PC 시안 A안)
// 목록 주소를 열면 첫 항목의 상세를 오른쪽에 함께 열고, 상세 주소를 열면 왼쪽에 그 챕터 목록을 함께 둔다
const cssq = v => String(v).replace(/["\\]/g, "\\$&");
const SPL = [
  { list: "/schedule", det: /^\/event\/.+$/, def: () => { const e = upcoming().find(x => !isCanceled(x)) || upcoming()[0]; return e ? "/event/" + e.id : ""; },
    mark: d => `[data-tk="${cssq(decodeURIComponent(d.slice(7)))}"]` },
  { list: "/records", det: /^\/game\/.+$/, def: () => { const e = past().find(isPlay); return e ? "/game/" + e.id : ""; },
    mark: d => `a[href="#/game/${cssq(decodeURIComponent(d.slice(6)))}"]` },
  { list: "/team", det: /^\/(notices|notice\/.+|rules|money|members)$/, def: () => "/notices",
    mark: d => `a[href="#${/^\/notice\//.test(d) ? "/notices" : d}"]` },
  { list: "/ops", det: /^\/(requests|posreqs|dues|fines|policy|settings)$/, def: () => "/requests", admin: true,
    mark: d => `a[href="#${d}"]` },
];
export function pcSplit(r, page) {
  const sp = SPL.find(x => (r === x.list || x.det.test(r)) && (!x.admin || (isAdmin() && viewMode() === "admin")));
  if (!sp) return null;
  const d = r === sp.list ? sp.def() : r;
  const left = page(sp.list); if (!left) return null;
  const right = d ? page(d) : "";
  const mark = d ? sp.mark(d) : "";
  return `<div class="pcsplit2"><div class="pcl2">${left}</div><section class="pcr2" aria-label="자세히">${right || `<div class="pce"><div class="empty"><b>왼쪽에서 골라 주세요</b><span>고른 항목이 여기에 자세히 보여요.</span></div></div>`}</section></div>${mark ? `<style>.pcl2 ${mark}{outline:3px solid var(--ink);outline-offset:4px;border-radius:12px}</style>` : ""}`;
}
