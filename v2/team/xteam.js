// 다른 팀과 (PC): 매칭, 용병 구인, 용병 구직. PC 시안 4-7과 같은 흐름.
// 다른 팀 정보는 서버 함수(x_list, x_inbox, x_my)가 공개해도 되는 것만 준다. 쓰기도 서버 함수로만 한다.
import { S, sb, esc, render, toast, fail, isAdmin, viewMode, isCanceled, md, wd, evName, evStart, maintLocked, todayStr, att, confirmBox, POS, sport, myProfile, guestsOf } from "./main.js";
import { hd, hdTab, empty } from "./ui.js";
import { isPC } from "./pc.js";

export const XT = { tid: "", data: {}, at: {}, busy: {}, view: { match: "list", hire: "list", seek: "list" }, sel: {}, f: { day: "all", area: "all", lv: "all", pos: "" }, fv: {} };
const LV = ["", "입문", "초급", "중급", "중상급", "상급"];
const adm = () => isAdmin() && viewMode() === "admin";
const lvText = n => n ? `실력 ${n} ${LV[n]}` : "실력 정하지 않음";
const ORDER = () => POS[sport()] || POS.soccer;
const GROUPS = () => sport() === "soccer" ? [["GK", "골키퍼", ["GK"]], ["DF", "수비", ["LB", "CB", "RB"]], ["MF", "미드필더", ["CDM", "CM", "CAM"]], ["FW", "공격", ["LW", "RW", "ST"]]] : ORDER().map(p => [p, p, [p]]);
const dayLabel = ev => `${md(ev.date)} ${wd(ev.date)}`;
const when = ev => `${dayLabel(ev)} ${ev.time || ""}${ev.end ? " ~ " + ev.end : ""}`;
const sinceText = iso => { const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / (30.4 * 864e5))); return m < 1 ? "매니볼 처음 쓰는 팀" : m < 12 ? `매니볼 ${m}개월째` : `매니볼 ${Math.floor(m / 12)}년째`; };
const isWeekend = (ev, k) => { const g = new Date(ev.date + "T12:00:00+09:00").getUTCDay(); return k === "sat" ? g === 6 : k === "sun" ? g === 0 : true; };

// 불러오기 --------------------------------------------------------------------
// 화면에 들어올 때마다 새로 불러온다 (다른 팀이 보낸 신청, 새 글이 바로 보이게)
export function xEnter() { XT.data = {}; XT.at = {}; XT.tid = S.tid; }
// 30초마다 화면을 다시 그려 새로 불러올 때가 됐는지 본다 (다른 팀과 화면에 있을 때만)
setInterval(() => { if (/^#\/(match|hire|seek)$/.test(location.hash) && !document.hidden && !document.querySelector("#layer .dlg, #layer .sheet") && document.activeElement && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) render(); }, 30000);
async function load(key, fn, args) {
  if (XT.tid !== S.tid) { XT.tid = S.tid; XT.data = {}; }
  if (XT.busy[key]) return; XT.busy[key] = true;
  const { data, error } = await sb.rpc(fn, args || {});
  XT.busy[key] = false;
  XT.data[key] = error ? { err: String(error.message || error) } : data; XT.at[key] = Date.now();
  render();
}
// 화면을 켜 둔 채로 있어도 30초마다 새로 불러온다 (그동안은 있던 것을 그대로 보여 준다)
const need = (key, fn, args) => {
  if (XT.tid !== S.tid || XT.data[key] === undefined) { if (!XT.busy[key]) setTimeout(() => load(key, fn, args), 0); return null; }
  if (Date.now() - (XT.at[key] || 0) > 30000 && !XT.busy[key]) { XT.at[key] = Date.now(); setTimeout(() => load(key, fn, args), 0); }
  return XT.data[key];
};
const refresh = keys => { keys.forEach(k => { delete XT.data[k]; }); render(); };
const loading = `<div class="loading">불러오는 중이에요</div>`;
const errBox = d => d && d.err ? empty(/not_member/.test(d.err) ? "팀에 들어간 뒤에 쓸 수 있어요" : /x_list|function|schema cache/.test(d.err) ? "다른 팀과를 준비하고 있어요" : "불러오지 못했어요", "잠시 뒤에 다시 열어 주세요.") : "";

// 팀 카드 (유니폼 모양 아이콘에 팀 HOME 색)
const KITHEX = { 흰색: "#FFFFFF", 검정: "#1E1E1E", 남색: "#23336B", 파랑: "#2F6BD8", 하늘: "#8EC8F2", 빨강: "#D23A33", 주황: "#F08A24", 노랑: "#F6D02F", 초록: "#2E9E4F", 보라: "#6B4AA8", 분홍: "#F2A7C3", 회색: "#9A9A9A" };
function jersey(kit, size, tag) {
  const c = KITHEX[kit] || "#FFFFFF"; const dark = ["검정", "남색", "파랑", "빨강", "초록", "보라"].includes(kit);
  return `<span class="xj" aria-hidden="true" style="width:${size}px;height:${Math.round(size * 48 / 52)}px"><svg viewBox="-2 -2 52 48" width="100%" height="100%"><path d="M13 3 H19 C20 6 22 7 24 7 C26 7 28 6 29 3 H35 L46 12 L40 19 L37 17 V41 H11 V17 L8 19 L2 12 Z" fill="${c}" stroke="#121110" stroke-width="2.4" stroke-linejoin="round"></path></svg><b style="color:${dark ? "#FBF7EF" : "#121110"};font-size:${Math.round(size * .26)}px">${esc(tag)}</b></span>`;
}
const tagOf = name => (String(name || "").replace(/\s*(FC|FS|유나이티드)\s*/g, "").replace(/[^0-9A-Za-z가-힣]/g, "").slice(0, 2) || "?").toUpperCase();
const teamHead = (t, big) => `<span class="xth">${jersey(t.kit, big ? 64 : 40, tagOf(t.name))}<span class="xtt"><b${big ? ' class="big"' : ""}>${esc(t.name)}</b><span>${esc(t.area || "지역 정하지 않음")}  팀원 ${t.members}명</span></span><span class="xlv">${big ? `<span>실력</span><b>${t.level || "-"}</b><span>${t.level ? LV[t.level] : "미정"}</span>` : lvText(t.level)}</span></span>`;
const recText = t => `${sinceText(t.since)}, 현장 출석 받은 경기 ${t.checked}번${t.matched ? ", 매칭 " + t.matched + "번" : ", 매칭 기록 없음"}`;
const rows = list => `<div class="xrows">${list.map(([k, v]) => `<div><span>${esc(k)}</span><span>${v}</span></div>`).join("")}</div>`;
const slotLabel = s => (Array.isArray(s) ? s : []).join("/");
const slotText = s => (Array.isArray(s) ? s : []).join(" 또는 ");

// 거르기
function filterBar(kind) {
  const f = XT.f; const pill = (k, v, l) => `<button type="button" class="chip sm${f[k] === v ? " on" : ""}" data-act="xF" data-k="${k}" data-v="${esc(v)}" aria-pressed="${f[k] === v}">${esc(l)}</button>`;
  const day = `<span class="xfg"><b>날짜</b>${pill("day", "all", "전체")}${pill("day", "sat", "토요일")}${pill("day", "sun", "일요일")}</span>`;
  const areas = Array.from(new Set(((XT.data[kind === "match" ? "match" : "hireAll"] || []).filter ? (XT.data[kind === "match" ? "match" : "hireAll"] || []) : []).map(x => x.team.area).filter(Boolean))).slice(0, 8);
  const area = `<span class="xfg"><b>지역</b>${pill("area", "all", "전체")}${areas.map(a => pill("area", a, a)).join("")}</span>`;
  const lv = kind === "match" ? `<span class="xfg"><b>상대 실력</b>${pill("lv", "all", "전체")}${[1, 2, 3, 4, 5].map(n => pill("lv", String(n), n + " " + LV[n])).join("")}</span>` : "";
  let pos = "";
  if (kind === "seek") {
    const gs = GROUPS(); const one = p => pill("pos", p, p);
    pos = `<span class="xfg full"><b>포지션</b>${pill("pos", "all", "전체")}${gs.map(([k, l, ps]) => ps.length > 1 ? `<span class="xgb" role="group" aria-label="${esc(l)}">${`<button type="button" class="chip sm grp${f.pos === k ? " on" : ""}" data-act="xF" data-k="pos" data-v="${k}" aria-pressed="${f.pos === k}">${esc(l)}</button>`}${ps.map(one).join("")}</span>` : `<span class="xgb">${`<button type="button" class="chip sm grp${f.pos === ps[0] ? " on" : ""}" data-act="xF" data-k="pos" data-v="${esc(ps[0])}" aria-pressed="${f.pos === ps[0]}">${esc(l)}</button>`}</span>`).join("")}</span>`;
  }
  return `<div class="xflt" role="group" aria-label="거르기">${pos}${day}${area}${lv}</div>`;
}
const posSet = v => { if (!v || v === "all") return null; const g = GROUPS().find(x => x[0] === v); return g ? g[2] : [v]; };
const fitPos = label => { const s = posSet(XT.f.pos); return !s || String(label).split("/").some(p => s.includes(p)); };
const pass = x => isWeekend(x.event, XT.f.day) && (XT.f.area === "all" || x.team.area === XT.f.area) && (XT.f.lv === "all" || String(x.team.level) === XT.f.lv);

// 화면 틀 (PC: 왼쪽 목록, 오른쪽 자세히)
function frame(title, sub, right, flt, list, panel) {
  return `${hdTab(title, right)}<div class="xbody"><span class="note">${sub}</span>${flt}<div class="pcsplit2"><div class="pcl2 xl">${list}</div><section class="pcr2 xr" aria-label="자세히">${panel}</section></div></div>`;
}
const card = (x, on, chips, act) => `<button type="button" class="xc${on ? " on" : ""}" data-act="${act}" data-id="${esc(x.id)}" aria-pressed="${on}">${teamHead(x.team)}<span class="xw"><b>${esc(dayLabel(x.event))} ${esc(x.event.time)}</b><span>${esc(x.event.place || "장소 미정")}</span></span><span class="xchips">${chips}</span></button>`;
const chip = (t, k) => `<span class="tag${k ? " " + k : " thin"}">${esc(t)}</span>`;
const pane = (kind, title, body, cta) => `<header class="xph"><span class="tag" style="background:#F2A65A;color:#121110">${kind}</span><b>${esc(title)}</b></header><div class="xpb">${body}</div>${cta ? `<div class="xpc">${cta}</div>` : ""}`;
const mobileOnly = title => `${hd(title, "#/")}<div class="body">${empty("PC에서 쓸 수 있어요", "다른 팀과(매칭, 용병 구인, 용병 구직)는 PC 브라우저로 열어 주세요.")}</div>`;

/* ===================== 매칭 ===================== */
export function vMatch() {
  if (!isPC()) return mobileOnly("매칭");
  const list = need("match", "x_list", { p_kind: "match" }); const v = XT.view.match;
  const inbox = adm() ? need("inbox", "x_inbox", { p_team: S.tid }) : null;
  const pend = inbox && !inbox.err ? inbox.filter(p => p.kind === "match").reduce((n, p) => n + p.apps.filter(a => a.status === "pending").length, 0) : 0;
  const right = adm() ? `<button type="button" class="btn sm${v === "inbox" ? " pri" : ""}" data-act="xView" data-k="match" data-v="${v === "inbox" || v === "new" ? "list" : "inbox"}">${v === "inbox" || v === "new" ? "매칭 글 보기" : "우리 매칭 글과 받은 신청" + (pend ? ` (새 신청 ${pend})` : "")}</button>` : "";
  if (list === null) return frame("매칭", "", right, "", loading, "");
  if (list.err) return frame("매칭", "", right, "", errBox(list), "");
  if ((v === "inbox" || v === "new") && adm()) return inboxView("match", inbox, right);
  const items = list.filter(x => !x.mine && pass(x));
  const sel = items.find(x => x.id === XT.sel.match) || items[0];
  const cards = items.length ? items.map(x => card(x, sel && x.id === sel.id, [chip(x.field === "yes" ? "구장 잡음" : "구장 없음", x.field === "yes" ? "" : "thin"), chip(`팀원 ${x.mem} + 용병 ${x.merc}`)].join(""), "xSel")).join("") : empty("이 조건에 맞는 매칭 글이 없어요", "거르기를 바꿔 보세요.");
  let panel = `<div class="pce">${empty("글을 골라 주세요", "왼쪽에서 누르면 여기에 자세히 나와요.")}</div>`;
  if (sel) {
    const t = sel.team;
    const body = `${teamHead(t, true)}${rows([["날짜와 시간", esc(when(sel.event))], ["구장 위치", esc(sel.event.place || "장소 미정")], ["구장", sel.field === "yes" ? "상대 팀이 구장을 잡아 뒀어요" : "아직 없어요. 구장 있는 팀을 찾아요"], ["상대 인원", `팀원 ${sel.mem}명 (참석 투표로 확인) + 용병 ${sel.merc}명`], ["팀 기록", esc(recText(t))], ["상대 실력", esc(lvText(t.level)) + " (팀이 직접 고른 실력)"], ["상대 유니폼", esc(sel.kit || "정하지 않음")]])}${sel.memo ? `<div class="xmemo"><b>한마디</b> ${esc(sel.memo)}</div>` : ""}`;
    let cta;
    if (XT.view.match === "form" && adm()) return frame("매칭", "", right, filterBar("match"), cards, matchForm(sel));
    if (sel.applied) cta = `<span class="note">신청했어요 (${sel.applied === "yes" ? "받음" : "기다림"}). 상대가 받으면 우리 일정에 상대로 적혀요.</span>`;
    else if (adm()) cta = `<span class="note">우리 팀원 수는 직접 적지 않고, 같은 날 우리 경기의 참석 투표 수를 그대로 보내요.</span><button type="button" class="btn o" data-act="xView" data-k="match" data-v="form">매칭 신청하기</button>`;
    else cta = `<span class="note">팀원은 매칭 글을 볼 수 있고, 신청은 운영진이 해요.</span><button type="button" class="btn o" aria-disabled="true" disabled>운영진만 신청할 수 있어요</button>`;
    panel = pane("매칭", `${t.name}  ${dayLabel(sel.event)} ${sel.event.time}`, body, cta);
  }
  return frame("매칭", "경기할 상대 팀을 찾아요. 같은 종목 팀만 보여요.", right, filterBar("match"), cards, panel);
}
function matchForm(sel) {
  const mine = Object.values(S.events).filter(e => e.date === sel.event.date && e.type === "match" && !e.opponent && !isCanceled(e));
  const fv = XT.fv; const pick = mine.find(e => e.id === fv.ev) || mine[0];
  const body = `${teamHead(sel.team)}<div class="fld"><b>우리 경기</b>${mine.length ? `<div class="chips">${mine.map(e => `<button type="button" class="chip sm${pick && e.id === pick.id ? " on" : ""}" data-act="xFv" data-k="ev" data-v="${esc(e.id)}">${esc(dayLabel(e))} ${esc(e.time || "")} ${esc(e.place || "")}</button>`).join("")}</div>` : `<span class="note">${esc(dayLabel(sel.event))}에 상대가 정해지지 않은 우리 경기가 없어요. 일정에서 그 날 경기를 먼저 올려 주세요.</span>`}</div>
    ${pick ? rows([["우리 팀원", `참석, 늦참으로 투표한 팀원 ${att(pick).in}명 (직접 적지 않아요)`], ["용병", `그 일정에 확정된 용병 ${guestsOf(pick).length}명`]]) : ""}
    <label class="fld"><b>한마디</b><input class="inp" data-bind="xmemo" maxlength="200" placeholder="상대 팀 운영진에게 보여요" value="${esc(S.form.xmemo || "")}"></label>`;
  return pane("매칭", `${sel.team.name}에 매칭 신청`, body, `<button type="button" class="btn" data-act="xView" data-k="match" data-v="list">닫기</button><button type="button" class="btn o" data-act="xApplyMatch" data-id="${esc(sel.id)}" data-ev="${esc(pick ? pick.id : "")}" ${pick ? "" : "disabled"}>매칭 신청 보내기</button>`);
}

/* ===================== 받은 신청과 우리 글 (운영진) ===================== */
function inboxView(kind, inbox, right) {
  const title = kind === "match" ? "매칭" : "용병 구인";
  if (inbox === null) return frame(title, "", right, "", loading, "");
  if (inbox.err) return frame(title, "", right, "", errBox(inbox), "");
  const posts = inbox.filter(p => p.kind === kind);
  const sel = posts.find(p => p.id === XT.sel["in_" + kind]) || posts[0];
  const newBtn = `<button type="button" class="xnew" data-act="xView" data-k="${kind === "match" ? "match" : "hire"}" data-v="new">+ ${kind === "match" ? "매칭 글 올리기" : "구인 글 올리기"}</button>`;
  const cards = newBtn + (posts.length ? posts.map(p => { const pend = p.apps.filter(a => a.status === "pending").length; return `<button type="button" class="xc${sel && p.id === sel.id ? " on" : ""}" data-act="xSelIn" data-k="${kind}" data-id="${esc(p.id)}"><span class="xw"><b>${esc(dayLabel(p.event))} ${esc(p.event.time)} ${esc(evName({ type: p.event.type, opponent: p.event.opponent }))}</b><span>${esc(p.event.place || "")}</span></span><span class="xchips">${chip(p.state === "open" ? "받는 중" : "마감", p.state === "open" ? "ink" : "thin")}${kind === "hire" ? chip(p.slots.map(slotLabel).join(", ")) : ""}${pend ? chip("새 신청 " + pend, "ink") : ""}</span></button>`; }).join("") : empty("올린 글이 없어요", "위에서 글을 올리면 여기에 보여요."));
  const v = XT.view[kind === "match" ? "match" : "hire"];
  let panel;
  if (v === "new") panel = kind === "match" ? newMatchForm() : newHireForm();
  else if (!sel) panel = `<div class="pce">${empty("글을 골라 주세요", "")}</div>`;
  else {
    const apps = sel.apps.slice().sort((a, b) => rk(b) - rk(a));
    const appRows = apps.length ? apps.map(a => `<div class="xa"><span class="xat">${a.team ? teamHead(a.team) : `<b>${esc(a.name)}</b><span>${esc(a.sub || "")}</span>`}${kind === "hire" ? `<span class="xpos">${esc(slotText(String(a.pos).split("/")))} 자리</span>${rateLine(a.rating)}` : `<span class="note">참석 투표로 확인된 팀원 ${a.mem}명, ${esc(recText(a.team))}</span>`}${a.memo ? `<span class="note">한마디: ${esc(a.memo)}</span>` : ""}</span><span class="xab">${a.status === "pending" ? `<button type="button" class="btn sm" data-act="xAnswer" data-id="${esc(a.id)}" data-ok="0">거절</button><button type="button" class="btn sm pri" data-act="xAnswer" data-id="${esc(a.id)}" data-ok="1">받기</button>` : chip(a.status === "yes" ? "받음" : "거절함", a.status === "yes" ? "ink" : "thin")}</span></div>`).join("") : empty("아직 신청이 없어요", "");
    const body = `${rows([["날짜와 시간", esc(when(sel.event))], ["구장 위치", esc(sel.event.place || "")], ["우리 팀원", `참석 투표 ${sel.mem}명`]].concat(kind === "hire" ? [["구하는 자리", esc(sel.slots.map(slotText).join(", "))]] : [["구장", sel.field === "yes" ? "우리가 잡았어요" : "아직 없어요"]]))}<div class="xsec"><b>신청 ${sel.apps.length}건</b><span class="note">${kind === "hire" ? "별점이 낮은 사람은 아래에 보여요. 받으면 그 일정 참석 명단에 용병으로 들어가요." : "받으면 두 팀 일정에 서로가 상대로 적혀요. 다른 신청은 거절돼요."}</span></div>${appRows}`;
    panel = pane(kind === "match" ? "매칭" : "용병 구인", `${dayLabel(sel.event)} ${sel.event.time} 우리 글`, body, `<button type="button" class="btn" data-act="xState" data-id="${esc(sel.id)}" data-open="${sel.state === "open" ? "0" : "1"}">${sel.state === "open" ? "마감하기" : "다시 받기"}</button>`);
  }
  return frame(title, kind === "match" ? "우리 팀이 올린 매칭 글과 받은 신청이에요." : "우리 경기에 올 용병을 다른 팀 사람들에게서 구해요. 운영진이 올리고 신청을 받아요.", right, "", cards, panel);
}
const rk = a => a.rating && a.rating.n >= 3 ? Number(a.rating.avg) : 3;
const rateLine = r => !r ? "" : `<span class="xrate">${r.n >= 3 ? `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.3L12 17.1l-5.7 3.1 1.2-6.3-4.7-4.4 6.4-.8z" fill="#FCD01A" stroke="#121110" stroke-width="2" stroke-linejoin="round"></path></svg>별점 ${r.avg} (평가 ${r.n}번)` : `평가 모으는 중 (${r.n}번)`}${r.noshow ? `, 안 옴 ${r.noshow}번` : ""}</span>`;

function newMatchForm() {
  const evs = Object.values(S.events).filter(e => e.type === "match" && !e.opponent && !isCanceled(e) && e.date >= todayStr()).sort((a, b) => evStart(a) - evStart(b));
  const fv = XT.fv; const pick = evs.find(e => e.id === fv.nev) || evs[0];
  const body = `<div class="fld"><b>어느 일정</b>${evs.length ? `<div class="chips">${evs.map(e => `<button type="button" class="chip sm${pick && e.id === pick.id ? " on" : ""}" data-act="xFv" data-k="nev" data-v="${esc(e.id)}">${esc(dayLabel(e))} ${esc(e.time || "")}</button>`).join("")}</div>` : `<span class="note">상대가 정해지지 않은 다가오는 경기가 없어요. 일정에서 경기를 먼저 올려 주세요.</span>`}</div>
    <div class="fld"><b>구장</b><div class="chips">${[["yes", "우리가 잡았어요"], ["no", "아직 없어요"]].map(([v, l]) => `<button type="button" class="chip sm${(fv.field || "yes") === v ? " on" : ""}" data-act="xFv" data-k="field" data-v="${v}">${l}</button>`).join("")}</div></div>
    ${pick ? rows([["구장 위치", esc(pick.place || "장소 미정") + " (일정에서 가져와요)"], ["우리 실력", esc(lvText(Number(S.settings.level) || 0)) + " (팀 설정에서 바꿔요)"], ["우리 팀원", `참석 투표 ${att(pick).in}명 (투표가 바뀌면 상대에게도 바로 바뀌어 보여요)`]]) : ""}
    <label class="fld"><b>우리 유니폼</b><input class="inp" data-bind="xkit" maxlength="20" placeholder="예: 남색" value="${esc(S.form.xkit || ((S.settings.kit || {}).home || ""))}"></label>
    <label class="fld"><b>한마디</b><input class="inp" data-bind="xmemo" maxlength="300" placeholder="상대 팀이 보는 말" value="${esc(S.form.xmemo || "")}"></label>`;
  return pane("매칭", "매칭 글 올리기", body, `<button type="button" class="btn" data-act="xView" data-k="match" data-v="inbox">닫기</button><button type="button" class="btn o" data-act="xPostMatch" data-ev="${esc(pick ? pick.id : "")}" ${pick ? "" : "disabled"}>매칭 글 올리기</button>`);
}

/* ===================== 용병 구인 ===================== */
export function vHire() {
  if (!isPC()) return mobileOnly("용병 구인");
  if (adm()) { const inbox = need("inbox", "x_inbox", { p_team: S.tid }); return inboxView("hire", inbox, ""); }
  // 팀원: 우리 팀이 올린 구인 글을 본다 (신청은 운영진이 받고 거절해요)
  const all = need("hireAll", "x_list", { p_kind: "hire" });
  if (all === null) return frame("용병 구인", "", "", "", loading, "");
  if (all.err) return frame("용병 구인", "", "", "", errBox(all), "");
  const mine = all.filter(x => x.mine); const sel = mine.find(x => x.id === XT.sel.hire) || mine[0];
  const cards = mine.length ? mine.map(x => card(x, sel && x.id === sel.id, x.slots.map(s => chip(slotLabel(s) + " 1명")).join(""), "xSelHire")).join("") : empty("우리 팀이 올린 구인 글이 없어요", "운영진이 올리면 여기에 보여요.");
  const panel = sel ? pane("용병 구인", `${dayLabel(sel.event)} ${sel.event.time} 우리 글`, rows([["날짜와 시간", esc(when(sel.event))], ["구장 위치", esc(sel.event.place)], ["구하는 자리", esc(sel.slots.map(slotText).join(", "))], ["받은 용병", `${sel.taken}명`]]), `<span class="note">운영진만 받고 거절해요. 받은 용병은 일정의 참석 명단에 보여요.</span>`) : `<div class="pce">${empty("글을 골라 주세요", "")}</div>`;
  return frame("용병 구인", "우리 경기에 올 용병을 다른 팀 사람들에게서 구해요.", "", "", cards, panel);
}
function newHireForm() {
  const evs = Object.values(S.events).filter(e => !isCanceled(e) && e.date >= todayStr()).sort((a, b) => evStart(a) - evStart(b));
  const fv = XT.fv; const pick = evs.find(e => e.id === fv.hev) || evs[0];
  const a = pick ? att(pick) : null; const gs = pick ? guestsOf(pick).length : 0;
  const empt = pick && a.cap ? Math.max(0, a.cap - a.in - gs) : 0;
  const slots = (fv.slots && fv.slotsFor === (pick && pick.id)) ? fv.slots : [[]];
  const body = `<div class="fld"><b>어느 일정</b>${evs.length ? `<div class="chips">${evs.map(e => `<button type="button" class="chip sm${pick && e.id === pick.id ? " on" : ""}" data-act="xFv" data-k="hev" data-v="${esc(e.id)}">${esc(dayLabel(e))} ${esc(evName(e))}</button>`).join("")}</div>` : `<span class="note">다가오는 일정이 없어요.</span>`}</div>
    ${pick ? rows([["경기 종류", esc(evName(pick))], ["구장 위치와 시간", esc((pick.place || "장소 미정") + ", " + when(pick))], ["우리 팀 실력", esc(lvText(Number(S.settings.level) || 0))], ["빈 자리", a.cap ? `정원 ${a.cap}명, 참석 ${a.in}명, 용병 ${gs}명이라 <b>${empt}자리</b>가 비어요` : "정원을 정하지 않은 일정이라 구인 글을 올릴 수 없어요"]]) : ""}
    ${pick && empt ? `<div class="fld"><span class="spread"><b>구할 용병</b><span class="note">한 사람이 LB, LW 둘 다 되면 두 자리를 같이 눌러요</span></span>${slots.map((s, i) => `<div class="xslot${s.length ? " done" : ""}"><span class="spread"><b>용병 ${i + 1}</b><span class="note">${s.length ? esc(slotText(s)) + (s.length > 1 ? " 되는 사람" : " 자리") : "들어갈 자리를 골라 주세요"}</span><button type="button" class="btn sm" data-act="xSlotDel" data-i="${i}">빼기</button></span><div class="chips">${ORDER().map(p => `<button type="button" class="chip sm${s.includes(p) ? " on" : ""}" data-act="xSlotPos" data-i="${i}" data-p="${esc(p)}" aria-pressed="${s.includes(p)}">${esc(p)}</button>`).join("")}</div></div>`).join("")}<button type="button" class="btn${slots.length >= empt ? "" : ""}" data-act="xSlotAdd" data-max="${empt}" ${slots.length >= empt ? 'aria-disabled="true"' : ""}>+ 용병 한 명 더</button><span class="note"><b>용병 ${slots.length}명을 구해요</b>${slots.some(s => !s.length) ? ". 자리를 안 고른 용병이 있어요" : ""}</span></div>` : ""}
    <label class="fld"><b>한마디</b><input class="inp" data-bind="xmemo" maxlength="300" placeholder="용병에게 남길 말" value="${esc(S.form.xmemo || "")}"></label>`;
  return pane("용병 구인", "용병 구인 글 올리기", body, `<button type="button" class="btn" data-act="xView" data-k="hire" data-v="list">닫기</button><button type="button" class="btn o" data-act="xPostHire" data-ev="${esc(pick ? pick.id : "")}" ${pick && empt ? "" : "disabled"}>구인 글 올리기</button>`);
}

/* ===================== 용병 구직 ===================== */
export function vSeek() {
  if (!isPC()) return mobileOnly("용병 구직");
  const all = need("hireAll", "x_list", { p_kind: "hire" }); const v = XT.view.seek;
  const right = `<button type="button" class="btn sm${v === "mine" ? " pri" : ""}" data-act="xView" data-k="seek" data-v="${v === "mine" ? "list" : "mine"}">${v === "mine" ? "구인 글 보기" : "내 신청"}</button>`;
  if (!XT.f.pos) XT.f.pos = (myProfile() || {}).pos1 || "all";
  if (all === null) return frame("용병 구직", "", right, "", loading, "");
  if (all.err) return frame("용병 구직", "", right, "", errBox(all), "");
  const items = all.filter(x => !x.mine && pass(x) && x.slots.some(s => fitPos(slotLabel(s))));
  const sel = items.find(x => x.id === XT.sel.seek) || items[0];
  const cards = items.length ? items.map(x => card(x, sel && x.id === sel.id, [chip(x.event.type === "scrim" ? "내전" : "경기")].concat(x.slots.map(s => chip(slotLabel(s) + " 1명", XT.f.pos !== "all" && fitPos(slotLabel(s)) ? "ink" : ""))).join(""), "xSelSeek")).join("") : empty("이 조건에 맞는 구인 글이 없어요", "포지션이나 날짜를 바꿔 보세요.");
  let panel = `<div class="pce">${empty("글을 골라 주세요", "")}</div>`;
  if (v === "mine") panel = myView();
  else if (sel && v === "form") panel = seekForm(sel);
  else if (sel) {
    const body = `${teamHead(sel.team, true)}${rows([["날짜와 시간", esc(when(sel.event))], ["구장 위치", esc(sel.event.place || "")], ["경기 종류", sel.event.type === "scrim" ? "내전 (그 팀끼리)" : sel.event.type === "match" ? "경기" + (sel.event.opponent ? " vs " + esc(sel.event.opponent) : "") : "훈련"], ["이 팀 실력", esc(lvText(sel.team.level))], ["팀 기록", esc(recText(sel.team))]])}<div class="xsec"><b>구하는 자리</b></div><div class="chips">${sel.slots.map(s => `<span class="xpos big">${esc(slotText(s))} 1명</span>`).join("")}</div>${sel.memo ? `<div class="xmemo"><b>한마디</b> ${esc(sel.memo)}</div>` : ""}`;
    const cta = sel.applied ? `<span class="note">신청했어요 (${sel.applied === "yes" ? "받음" : "기다림"}). 받으면 그 팀 경기 참석 명단에 용병으로 들어가요.</span>` : `<span class="note">신청은 팀원, 운영진 누구나 개인으로 해요.</span><button type="button" class="btn o" data-act="xView" data-k="seek" data-v="form">신청하기</button>`;
    panel = pane("용병 구직", `${sel.team.name}  ${dayLabel(sel.event)} ${sel.event.time}`, body, cta);
  }
  return frame("용병 구직", "내 포지션을 구하는 다른 팀 경기를 찾아 신청해요. 처음에는 내 1선호 포지션으로 걸러져요.", right, filterBar("seek"), cards, panel);
}
function seekForm(sel) {
  const cur = sel.slots.map(slotLabel).includes(XT.fv.apPos) ? XT.fv.apPos : slotLabel(sel.slots.find(s => fitPos(slotLabel(s))) || sel.slots[0]);
  const p = myProfile() || {};
  const body = `${teamHead(sel.team)}<div class="fld"><span class="spread"><b>신청 자리</b><span class="note">두 포지션이 적힌 자리는 둘 중 어디든 들어가요</span></span><div class="chips">${sel.slots.map(s => `<button type="button" class="chip sm${slotLabel(s) === cur ? " on" : ""}" data-act="xFv" data-k="apPos" data-v="${esc(slotLabel(s))}">${esc(slotText(s))}</button>`).join("")}</div></div>
    ${rows([["내 포지션", esc([p.pos1, p.pos2].filter(Boolean).join(" / ") || "정하지 않음") + "  홈에서 바꿔요"], ["내 팀", esc((S.team && S.team.name) || "") + " 팀원으로 보여요"]])}
    <label class="fld"><b>한마디</b><input class="inp" data-bind="xmemo" maxlength="200" placeholder="그 팀 운영진에게만 보여요" value="${esc(S.form.xmemo || "")}"></label>`;
  return pane("용병 구직", `${sel.team.name}  ${dayLabel(sel.event)} 경기에 신청`, body, `<button type="button" class="btn" data-act="xView" data-k="seek" data-v="list">닫기</button><button type="button" class="btn o" data-act="xApplyHire" data-id="${esc(sel.id)}" data-pos="${esc(cur)}">신청하기</button>`);
}
function myView() {
  const my = need("my", "x_my", {});
  if (my === null) return loading; if (my.err) return errBox(my);
  const r = my.rating || { n: 0 };
  const apps = (my.apps || []).filter(a => a.kind === "hire" && a.mine);
  const body = `<div class="xmine"><b>내 용병 별점</b><span class="big">${r.n >= 3 ? `별점 ${r.avg} (평가 ${r.n}번)` : `평가 모으는 중 (${r.n}번)`}${r.noshow ? `, 안 옴 ${r.noshow}번` : ""}</span><span class="note">용병으로 간 경기마다 그 팀 운영진이 평가해요. 평가가 3번 모이면 별점이 보이고, 내가 신청한 팀 운영진에게도 보여요. 별점이 낮으면 신청한 사람 목록에서 아래에 보여요.</span></div>
    ${apps.length ? apps.map(a => `<div class="xa"><span class="xat"><b>${esc(a.team.name)}  ${esc(dayLabel(a.event))} ${esc(a.event.time)}</b><span class="note">${esc(slotText(String(a.pos).split("/")))} 자리로 신청, ${esc(a.event.place || "")}</span></span><span class="xab">${chip(a.status === "pending" ? "기다림" : a.status === "yes" ? "받음" : "거절됨", a.status === "yes" ? "ink" : "thin")}${a.status === "pending" ? `<button type="button" class="btn sm" data-act="xCancel" data-id="${esc(a.id)}">신청 취소</button>` : ""}</span></div>`).join("") : empty("신청한 경기가 없어요", "")}`;
  return pane("용병 구직", "내 신청", body, "");
}

/* ===================== 동작 ===================== */
function xFail(e) {
  const m = String((e && (e.message || e.details)) || e || "");
  const M = { not_admin: "운영진만 할 수 있어요", not_member: "팀에 들어간 뒤에 쓸 수 있어요", post_closed: "마감된 글이에요", own_post: "우리 팀 글이에요", own_team: "우리 팀 글에는 신청할 수 없어요", not_open_match: "상대가 정해지지 않은 경기만 돼요", other_day: "같은 날 경기만 신청할 수 있어요", other_sport: "같은 종목 팀끼리만 매칭할 수 있어요", bad_pos: "글에 있는 자리만 고를 수 있어요", too_many: "빈 자리보다 많이 구할 수 없어요", bad_slots: "자리를 다시 골라 주세요", event_closed: "지났거나 취소된 일정이에요", not_pending: "이미 처리된 신청이에요", duplicate: "이미 신청했어요", unique: "이미 신청했어요" };
  const k = Object.keys(M).find(x => m.includes(x)); if (k) { toast(M[k]); return; } fail(e);
}
async function call(fn, args, okMsg, after) {
  if (maintLocked()) { fail(new Error("maintenance")); return; }
  const { data, error } = await sb.rpc(fn, args);
  if (error) { xFail(error); return; }
  toast(okMsg); if (after) after(data); refresh(["match", "hireAll", "inbox", "my"]);
}
export const XACT = {
  xF: t => { XT.f[t.dataset.k] = t.dataset.v; render(); },
  xFv: t => { XT.fv[t.dataset.k] = t.dataset.v; render(); },
  xView: t => { XT.view[t.dataset.k] = t.dataset.v; if (/^(form|new)$/.test(t.dataset.v)) { S.form = { ...(S.form || {}), xmemo: "", xkit: "" }; XT.fv = { ...XT.fv, apPos: "" }; } render(); },
  xSel: t => { XT.sel.match = t.dataset.id; XT.view.match = "list"; render(); },
  xSelHire: t => { XT.sel.hire = t.dataset.id; render(); },
  xSelSeek: t => { XT.sel.seek = t.dataset.id; XT.view.seek = "list"; render(); },
  xSelIn: t => { XT.sel["in_" + t.dataset.k] = t.dataset.id; XT.view[t.dataset.k === "match" ? "match" : "hire"] = t.dataset.k === "match" ? "inbox" : "list"; render(); },
  xApplyMatch: t => call("x_apply_match", { p_post: t.dataset.id, p_team: S.tid, p_event: t.dataset.ev, p_memo: (S.form || {}).xmemo || "" }, "매칭을 신청했어요. 상대가 받으면 알림이 가요", () => { XT.view.match = "list"; }),
  xApplyHire: t => call("x_apply_hire", { p_post: t.dataset.id, p_pos: t.dataset.pos, p_memo: (S.form || {}).xmemo || "" }, "신청했어요. 받으면 알림이 와요", () => { XT.view.seek = "list"; }),
  xPostMatch: t => call("x_post_match", { p_team: S.tid, p_event: t.dataset.ev, p_field: XT.fv.field || "yes", p_kit: (S.form || {}).xkit || ((S.settings.kit || {}).home || ""), p_memo: (S.form || {}).xmemo || "" }, "매칭 글을 올렸어요. 신청이 오면 알림이 가요", () => { XT.view.match = "inbox"; }),
  xPostHire: t => {
    const slots = (XT.fv.slots && XT.fv.slotsFor === t.dataset.ev) ? XT.fv.slots : [[]];
    if (!slots.length) { toast("구할 용병을 한 명 이상 추가해 주세요"); return; }
    const blank = slots.findIndex(s => !s.length); if (blank >= 0) { toast(`용병 ${blank + 1}의 자리를 골라 주세요`); return; }
    call("x_post_hire", { p_team: S.tid, p_event: t.dataset.ev, p_slots: slots, p_memo: (S.form || {}).xmemo || "" }, "용병 구인 글을 올렸어요. 용병 구직 화면에 보여요", () => { XT.view.hire = "list"; XT.fv.slots = null; });
  },
  xSlotPos: t => {
    const ev = XT.fv.hev || (Object.values(S.events).filter(e => !isCanceled(e) && e.date >= todayStr()).sort((a, b) => evStart(a) - evStart(b))[0] || {}).id;
    const slots = (XT.fv.slots && XT.fv.slotsFor === ev ? XT.fv.slots : [[]]).map(s => s.slice()); const i = Number(t.dataset.i); const p = t.dataset.p;
    slots[i] = slots[i].includes(p) ? slots[i].filter(x => x !== p) : ORDER().filter(x => x === p || slots[i].includes(x)).slice(0, 4);
    XT.fv.slots = slots; XT.fv.slotsFor = ev; render();
  },
  xSlotAdd: t => {
    const ev = XT.fv.hev || (Object.values(S.events).filter(e => !isCanceled(e) && e.date >= todayStr()).sort((a, b) => evStart(a) - evStart(b))[0] || {}).id;
    const slots = (XT.fv.slots && XT.fv.slotsFor === ev ? XT.fv.slots : [[]]).map(s => s.slice());
    if (slots.length >= Number(t.dataset.max)) { toast(`빈 자리는 모두 ${t.dataset.max}자리예요`); return; }
    slots.push([]); XT.fv.slots = slots; XT.fv.slotsFor = ev; render();
  },
  xSlotDel: t => {
    const ev = XT.fv.hev || (Object.values(S.events).filter(e => !isCanceled(e) && e.date >= todayStr()).sort((a, b) => evStart(a) - evStart(b))[0] || {}).id;
    const slots = (XT.fv.slots && XT.fv.slotsFor === ev ? XT.fv.slots : [[]]).filter((_, i) => i !== Number(t.dataset.i)); XT.fv.slots = slots; XT.fv.slotsFor = ev; render();
  },
  xAnswer: t => {
    const ok = t.dataset.ok === "1";
    confirmBox(ok ? "이 신청을 받을까요?" : "이 신청을 거절할까요?", ok ? "받으면 상대에게 알림이 가요." : "거절하면 상대에게 알림이 가요.", ok ? "받기" : "거절", () => call("x_answer", { p_app: t.dataset.id, p_ok: ok }, ok ? "받았어요" : "거절했어요"), !ok);
  },
  xState: t => call("x_post_state", { p_post: t.dataset.id, p_open: t.dataset.open === "1" }, t.dataset.open === "1" ? "다시 받기 시작했어요" : "마감했어요"),
  xCancel: t => confirmBox("신청을 취소할까요?", "그 팀 운영진에게 보이던 신청이 사라져요.", "신청 취소", () => call("x_cancel", { p_app: t.dataset.id }, "신청을 취소했어요"), true),
};
