// PC 화면 (브라우저 가로 1024px 이상): PC 시안처럼 왼쪽 메뉴와 넓은 본문. 휴대폰 화면은 그대로 둔다.
// 화면 내용은 휴대폰과 같은 코드로 그리고, 여기서는 왼쪽 메뉴로 감싸기만 한다 (휴대폰과 PC가 엇갈리지 않게).
import { S, esc, isAdmin, viewMode, myProfile, nameOf, sport, MBRAND, upcoming, past, isPlay, isCanceled, md, wd, route, scrimReady } from "./main.js";
import { teamLogo, C, IC } from "./ui.js";
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
  const role = { owner: "운영진", admin: "운영진", member: "팀원" }[S.role] || "";
  return `<div class="pcw"><aside class="pcs" aria-label="팀과 메뉴">${BRAND_()}
    <button type="button" class="pct" data-act="switchTeam" aria-label="${esc((S.team && S.team.name) || "")}, 팀 바꾸기"><span class="pctl">${teamLogo(40)}</span><span class="pctx"><b>${esc((S.team && S.team.name) || "")}</b><span>${sport() === "soccer" ? "축구팀" : "풋살팀"}  ${role}</span></span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${C.ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h13l-3-3M20 16H7l3 3"></path></svg></button>
    <nav class="pnv" aria-label="메뉴">${nav}</nav>
    <div class="pco"><span class="pcoh"><i aria-hidden="true"></i>다른 팀과</span><nav class="pnv sm" aria-label="다른 팀과">${other}</nav></div>
    <div class="pcu"><span class="pcun" aria-hidden="true">${esc(p.num || "")}</span><span class="pcux"><b>${esc(me)}</b><span>카카오 계정 연결됨</span></span><button type="button" class="lnk" data-act="logout">로그아웃</button></div>
  </aside><div class="pcm"><div class="pcc">${pcPage(html)}</div></div></div>`;
}

/* ===================== PC 제목줄과 오른쪽 칸 머리 (PC 시안) =====================
   화면 내용은 휴대폰 코드 그대로 쓰고, 맨 위 휴대폰 머리(.hd)만 PC 모양으로 바꾼다.
   휴대폰 머리의 버튼(관리, 글쓰기 같은 것)은 그대로 옮겨서 빠지는 기능이 없게 한다. */
const frag = h => { const t = document.createElement("template"); t.innerHTML = h; return t.content; };
const html_ = f => { const d = document.createElement("div"); d.appendChild(f); return d.innerHTML; };
// 휴대폰 머리를 읽고 지운다: 뒤로 주소, 제목, 설명, 오른쪽 버튼
function takeHd(f) {
  const h = [...f.children].find(k => k.matches("header.hd")); if (!h) return null;
  const ib = [...h.children].find(k => k.matches("a.ib"));
  const kids = [...h.children];
  const ti = kids.findIndex(k => k.matches("h1, .tt, .brand"));
  const tEl = ti >= 0 ? kids[ti] : null;
  const title = tEl ? (tEl.matches("h1") ? tEl.textContent : (tEl.querySelector("b") || tEl).textContent) : "";
  const sub = tEl && tEl.matches(".tt") && tEl.querySelector("span") ? tEl.querySelector("span").textContent : "";
  const right = kids.slice(ti + 1).filter(k => k.tagName !== "SPAN" || k.children.length || k.textContent.trim()).map(k => k.outerHTML).join("");
  h.remove();
  return { back: ib ? ib.getAttribute("href") : "", backAct: ib ? ib.dataset.act || "" : "", title, sub, right, brand: !!(tEl && tEl.matches(".brand")) };
}
const KIND = e => e ? (e.type === "scrim" ? "내전" : e.type === "match" ? "경기" : e.type === "training" ? "훈련" : "일정") : "";
const evOf = r => { const m = r.match(/^\/(?:event|manage|check|roster|lineup|merc|scrim|edit|game|result)\/(.+)$/); return m ? S.events[decodeURIComponent(m[1])] : null; };
const BACKL = h => /^#\/(event|manage)\//.test(h) ? "일정" : /^#\/game\//.test(h) ? "기록" : /^#\/(team|notices)$/.test(h) ? "팀" : /^#\/ops$/.test(h) ? "운영" : /^#\/schedule$/.test(h) ? "일정" : /^#\/records$/.test(h) ? "기록" : "뒤로";
// PC 제목줄 (시안: 큰 제목, 숫자, 설명, 오른쪽 버튼)
export const pcHead = ({ title, num = "", sub = "", right = "", back = "", backAct = "" }) =>
  `<header class="pch1">${back ? `<a class="pbk" href="${esc(back)}"${backAct ? ` data-act="${esc(backAct)}"` : ""}>${IC.back}${BACKL(back)}</a>` : ""}<span class="t"><h1>${esc(title)}</h1>${num ? `<b class="n">${esc(num)}</b>` : ""}${sub ? `<span class="s">${esc(sub)}</span>` : ""}</span>${right ? `<span class="r">${right}</span>` : ""}</header>`;
// 오른쪽 칸 머리 (시안: 뒤로, 종류 표, 제목, 오른쪽 버튼)
const paneHead = ({ kind, title, sub = "", right = "", back = "", backAct = "" }) =>
  `<header class="pdh">${back ? `<a class="pbk" href="${esc(back)}"${backAct ? ` data-act="${esc(backAct)}"` : ""}>${IC.back}${BACKL(back)}</a>` : ""}${kind ? `<span class="pkd">${esc(kind)}</span>` : ""}<h2>${esc(title)}</h2>${sub ? `<span class="psub">${esc(sub)}</span>` : ""}${right}</header>`;
// 한 칸짜리 화면: 휴대폰 머리를 PC 제목줄로
const PAGE = { "/": { title: "홈", sub: "내 사물함" }, "/chat": { sub: "일정마다 방이 하나씩 생겨요" } };
function pcPage(html) {
  if (/^\s*<header class="pch1"/.test(html)) return html;
  const f = frag(html); const h = takeHd(f); if (!h) return html;
  const r = route(); const cfg = PAGE[r] || {};
  const head = pcHead({ title: cfg.title || h.title, sub: cfg.sub || h.sub, right: h.right, back: r === "/" ? "" : h.back, backAct: h.backAct });
  return head + html_(f);
}

// 챕터 화면은 왼쪽 목록, 오른쪽 자세히 두 칸 (PC 시안). 목록 주소를 열면 첫 항목을 오른쪽에 함께 열고,
// 자세히 주소(일정 관리, 출석, 라인업 같은 하위 화면 포함)를 열면 왼쪽에 그 챕터 목록을 함께 둔다
const cssq = v => String(v).replace(/["\\]/g, "\\$&");
const SPL = [
  { list: "/", det: /^\/notify$/, def: () => "/notify", sub: "내 사물함", title: "홈",
    mark: () => "",
    pane: () => ({ kind: "알림", title: "알림" }) },
  { list: "/schedule", det: /^\/(event|manage|check|roster|lineup|merc|scrim|edit)\/.+$|^\/new$/, def: () => { const e = upcoming().find(x => !isCanceled(x)) || upcoming()[0]; return e ? "/event/" + e.id : ""; },
    mark: d => { const e = evOf(d); return e ? `[data-tk="${cssq(e.id)}"]` : ""; },
    right: () => { if (!(isAdmin() && viewMode() === "admin")) return ""; const rd = Object.values(S.events).filter(scrimReady);
      return `${rd.length === 1 ? `<a class="pbtn" href="#/scrim/${esc(rd[0].id)}">내전 정하기</a>` : `<button type="button" class="pbtn" data-act="aSchedSheet">내전 정하기</button>`}<a class="pbtn o" href="#/new">${IC.plus}일정 올리기</a>`; },
    pane: (d, h) => { const e = evOf(d); if (/^\/event\//.test(d) && e) return { kind: KIND(e), title: `${md(e.date)} ${wd(e.date)} ${KIND(e)}` }; return { kind: e ? KIND(e) : "일정", title: /^\/manage\//.test(d) ? "이 일정 관리" : h.title }; } },
  { list: "/records", det: /^\/(game|result)\/.+$|^\/season$/, def: () => { const e = past().find(isPlay); return e ? "/game/" + e.id : ""; }, sub: "지난 경기 티켓북",
    mark: d => { const e = evOf(d); return e ? `a[href="#/game/${cssq(e.id)}"]` : d === "/season" ? `a[href="#/season"]` : ""; },
    pane: (d, h) => { const e = evOf(d); if (/^\/game\//.test(d) && e) return { kind: KIND(e), title: `${md(e.date)} ${wd(e.date)} ${e.type === "match" ? (e.opponent ? "vs " + e.opponent : "상대 미정") : KIND(e)}` }; return { kind: d === "/season" ? "시즌" : KIND(e), title: h.title }; } },
  { list: "/team", det: /^\/(notices|notice\/.+|rules|money|members|notice-new|notice-edit\/.+|rules-edit|stats\/(mom|att))$/, def: () => "/notices", sub: "공지, 수칙, 돈, 팀원",
    mark: d => `a[href="#${/^\/notice/.test(d) ? "/notices" : /^\/rules/.test(d) ? "/rules" : d}"]`,
    pane: (d, h) => ({ kind: /^\/notice/.test(d) ? "공지" : /^\/rules/.test(d) ? "수칙" : d === "/money" ? "돈" : /^\/stats/.test(d) ? "팀 기록" : "팀원", title: h.title }) },
  { list: "/ops", det: /^\/(requests|posreqs|dues|fines|policy|settings)$/, def: () => "/requests", admin: true,
    mark: d => `a[href="#${d}"]`, pane: (d, h) => ({ kind: "운영", title: h.title }) },
];
export function pcSplit(r, page) {
  const sp = SPL.find(x => (r === x.list || x.det.test(r)) && (!x.admin || (isAdmin() && viewMode() === "admin")));
  if (!sp) return null;
  const d = r === sp.list ? sp.def() : r;
  const leftHtml = page(sp.list); if (!leftHtml) return null;
  const L = frag(leftHtml); const lh = takeHd(L) || { title: "", right: "" };
  // 일정: 휴대폰 목록 위의 달과 '투표할 일정' 줄을 제목줄로 올린다
  const mon = L.querySelector(".mon"); let num = "", sub = sp.sub || "";
  if (mon) { num = (mon.querySelector("b") || {}).textContent || ""; sub = (mon.querySelector("span") || {}).textContent || sub; mon.remove(); }
  // 운영: 목록 위 설명 줄을 제목 옆으로
  if (sp.list === "/ops") { const b = L.querySelector(".body"); const n = b && b.firstElementChild; if (n && n.tagName === "SPAN" && /운영진만/.test(n.textContent)) { sub = n.textContent; n.remove(); const nv = b.querySelector("nav.lst"); if (nv) nv.style.marginTop = "0"; } }
  let hr = sp.right ? sp.right() : lh.right;
  if (sp.list === "/") { const dot = /position:absolute/.test(lh.right); hr = `<a class="pbtn" href="#/notify">${IC.bell}알림${dot ? `<i class="pdot" aria-label="안 읽은 알림 있음"></i>` : ""}</a>`; }
  const head = pcHead({ title: sp.title || lh.title, num, sub, right: hr });
  let right = "";
  let rHtml = d ? page(d) : "";
  // 공지: 오른쪽 칸 안에서 목록과 읽기를 나란히 (PC 시안)
  if (sp.list === "/team" && /^\/(notices|notice\/.+)$/.test(d)) {
    const LH = frag(page("/notices")); const nh = takeHd(LH) || { title: "공지", right: "" };
    const ids = [...LH.querySelectorAll('a[href^="#/notice/"]')].map(a => decodeURIComponent(a.getAttribute("href").slice(9)));
    const cur = d === "/notices" ? ids[0] : decodeURIComponent(d.slice(8));
    let read = "";
    if (cur) { const RD = frag(page("/notice/" + cur)); takeHd(RD); read = html_(RD); }
    const sel = cur ? `<style>.pnl a[href="#/notice/${cssq(encodeURIComponent(cur))}"],.pnl a[href="#/notice/${cssq(cur)}"]{background:var(--sec3);margin:0 -12px;padding-left:12px!important;padding-right:12px!important}</style>` : "";
    rHtml = `<header class="hd"><h1>${esc(nh.title)}</h1>${nh.right}</header><div class="pnr"><div class="pnl">${html_(LH)}</div><div class="pnd">${read || `<div class="pce">${"<div class=\"empty\"><b>공지가 없어요</b></div>"}</div>`}</div></div>${sel}`;
  }
  if (rHtml) {
    const R = frag(rHtml); const rh = takeHd(R) || { title: "", back: "", right: "" };
    const meta = sp.pane(d, rh);
    const back = rh.back && rh.back !== "#" + sp.list && rh.back !== "#/" ? rh.back : "";
    right = paneHead({ kind: meta.kind, title: meta.title || rh.title, sub: rh.brand ? "" : rh.sub, right: rh.right, back, backAct: rh.backAct }) + html_(R);
  } else right = `<div class="pce"><div class="empty"><b>왼쪽에서 골라 주세요</b><span>고른 항목이 여기에 자세히 보여요.</span></div></div>`;
  const mark = d ? sp.mark(d) : "";
  return `${head}<div class="pcsplit2"><div class="pcl2" data-p="${esc(sp.list.slice(1) || "home")}">${html_(L)}</div><section class="pcr2" data-p="${esc((d || "").split("/")[1] || "")}" aria-label="자세히">${right}</section></div>${mark ? `<style>.pcl2 ${mark}{outline:3px solid var(--ink);outline-offset:4px;border-radius:12px}</style>` : ""}`;
}
