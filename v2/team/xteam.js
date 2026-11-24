// 다른 팀과 (PC): 매칭, 용병 구인, 용병 구직. PC 시안 4-7과 같은 흐름.
// 다른 팀 정보는 서버 함수(x_list, x_inbox, x_my)가 공개해도 되는 것만 준다. 쓰기도 서버 함수로만 한다.
import { S, sb, esc, render, toast, fail, isAdmin, viewMode, isCanceled, md, wd, evName, evStart, maintLocked, todayStr, att, confirmBox, POS, sport, myProfile, guestsOf } from "./main.js";
import { hd, hdTab, empty } from "./ui.js";
import { isPC, pcHead } from "./pc.js";

export const XT = { tid: "", data: {}, at: {}, busy: {}, view: { match: "list", hire: "list", seek: "list" }, sel: {}, f: { day: "all", area: "all", lv: "all", pos: "", kind: "all" }, fOpen: false, fv: {} };
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
// 경기 종류: 메뉴 '매칭'과 헷갈리지 않게 '다른 팀과', '팀 내전'으로 보인다 (시안 결정 기록 10)
const won = n => Number(n || 0).toLocaleString("ko-KR") + "원";
const KN = { match: "다른 팀과", scrim: "팀 내전", training: "팀 훈련" };
const kindName = ev => KN[ev.type] || "경기";
const kWord = ev => ev.type === "scrim" ? "내전" : ev.type === "training" ? "훈련" : "경기";
const kindBadge = (ev, big) => { const m = ev.type === "match"; return `<span class="xk${m ? " m" : ""}${big ? " big" : ""}"><svg width="${big ? 18 : 14}" height="${big ? 18 : 14}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${m ? "M4 7h11l-3-3M20 17H9l3 3" : "M4 5h16v14H4zM12 5v14"}"></path></svg>${kindName(ev)}</span>`; };
const kindVs = x => x.event.type === "match" ? `${x.team.name} vs ${x.vs ? x.vs.name : x.event.opponent || "상대 정하는 중"}` : `${x.team.name}끼리 A팀 대 B팀`;
const kindSub = x => x.event.type === "match" ? (x.vs && x.vs.level ? "상대 " + lvText(x.vs.level) : x.event.opponent ? "상대 실력 정보 없음" : "상대가 정해지면 보여요") : "다른 팀 없이 그 팀 사람끼리";
const kindRow = x => `<span class="xkr">${kindBadge(x.event)}<span class="xkv"><b>${esc(kindVs(x))}</b><span>${esc(kindSub(x))}</span></span></span>`;
// 용병비 (시안 결정 기록 6): 나눠 받기, 무료, 교통비 드리기. est 는 지금 신청하면 받을 금액이고 받을 때 정해진다
const feeShort = f => !f ? "" : f.mode === "free" ? "용병비 무료" : f.mode === "pay" ? `교통비 ${won(f.pay)} 드려요` : `용병비 ${won(f.est)}`;
const feeCalc = (f, ev) => `구장비 ${won(f.total)}${ev.type === "match" ? " ÷ 2팀" : ""} ÷ ${f.people + 1}명, 500원 단위 내림`;
const feeHero = f => !f ? ["용병비", "-", ""] : f.mode === "free" ? ["용병비", "무료", "받으면 바로 확정"] : f.mode === "pay" ? ["교통비 (그 팀이 드려요)", won(f.pay), "경기 뒤 출석 확인되면 받아요"] : ["용병비", won(f.est), "받으면 먼저 보내야 확정"];
const feeRows = (f, ev, own) => !f ? [] : f.mode === "split" ? [["용병비 계산", esc(feeCalc(f, ev)) + "<br><span class=\"note\">신청을 받을 때 그때 인원으로 정해져요</span>"], ["구장비", esc(won(f.total)) + (f.self ? (own ? ", 우리가 직접 적은 금액" : ", 그 팀 운영진이 직접 적은 금액") : ", 구장 목록 금액")]] : f.mode === "free" ? [["용병비", "무료예요. 받으면 바로 확정돼요"]] : [["교통비", `${own ? "우리 팀이" : "그 팀이"} ${won(f.pay)}을 드려요. 경기 뒤 현장 출석으로 온 게 확인되면 보내요`]];
// 용병이 남긴 팀 평가
const GOOD = [["ontime", "시간 잘 지킴"], ["field", "구장 일찍 잡음"], ["gear", "공, 조끼 준비"], ["fair", "쿼터 고르게"], ["kind", "말이 친절함"], ["pass", "패스 잘 줌"]]; const GOODL = Object.fromEntries(GOOD);
const BAD = [["late", "늦게 시작"], ["long", "용병만 오래 뜀"], ["rude", "말이 거침"], ["pos", "적힌 포지션과 다름"], ["fee", "용병비가 적힌 것과 다름"]];
const trvText = r => !r || r.n < 3 ? `아직 평가가 적어요 (3번 모이면 보여요${r && r.n ? ", 지금 " + r.n + "번" : ""})` : `매너 ${r.manner}, 준비 ${r.prep} (용병 ${r.n}명)` + (r.tags && r.tags.length ? ", 많이 받은 말: " + r.tags.map(k => GOODL[k] || k).join(", ") : "");
const trvChip = t => { const r = t && t.trv; return r && r.n >= 3 ? `용병 평가 ${((Number(r.manner) + Number(r.prep)) / 2).toFixed(1)}` : ""; };
// 한마디: 라벨은 작은 회색 글씨로 위에, 글은 아래에 크게 (시안 결정 기록 9)
const QI = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 18c-1.2-1.3-2-2.8-2-5 0-3.6 2.4-6.3 6-7.5l.8 1.6C7.4 8.2 6.4 9.7 6.2 11.3c.3-.1.7-.2 1.1-.2 1.9 0 3.2 1.4 3.2 3.3 0 2-1.5 3.6-3.4 3.6-.8 0-1.5-.2-2.1 0zm10 0c-1.2-1.3-2-2.8-2-5 0-3.6 2.4-6.3 6-7.5l.8 1.6c-2.4 1.1-3.4 2.6-3.6 4.2.3-.1.7-.2 1.1-.2 1.9 0 3.2 1.4 3.2 3.3 0 2-1.5 3.6-3.4 3.6-.8 0-1.5-.2-2.1 0z"></path></svg>`;
const memoBox = (label, text) => text ? `<div class="xmemo2"><span>${QI}${esc(label)}</span><p>${esc(text)}</p></div>` : "";
// 위쪽 시간 박스: 왼쪽에 경기 종류와 큰 시간, 오른쪽에 용병비
const hero = (x, k, v, s) => `<div class="xhero"><div class="xhl">${x.kind === "hire" ? `<span class="xkr">${kindBadge(x.event)}<b>${esc(kindVs(x))}</b></span>` : ""}<span class="xht"><b>${esc(x.event.time || "--:--")}</b>${x.event.end ? `<span>~ ${esc(x.event.end)}</span>` : ""}</span><span class="xhd">${esc(dayLabel(x.event))} ${esc(x.event.place || "장소 미정")}</span></div><div class="xhr"><span>${esc(k)}</span><b>${esc(v)}</b><span>${esc(s)}</span></div></div>`;

// 거르기
function filterBox(kind) {
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
  const kd = kind === "seek" ? `<span class="xfg"><b>경기 종류</b>${pill("kind", "all", "전체")}${pill("kind", "match", "다른 팀과")}${pill("kind", "scrim", "팀 내전")}</span>` : "";
  return `<div class="xflt" id="xflt" role="group" aria-label="거르기">${pos}${kd}${day}${area}${lv}</div>`;
}
// 거르기: 고른 조건 한 줄과 거르기 버튼. 누르면 아래에 펼쳐진다 (시안 B 디자인)
function filterBar(kind) {
  const f = XT.f; const D = { all: "전체", sat: "토요일", sun: "일요일" }; const K = { all: "전체", match: "다른 팀과", scrim: "팀 내전" };
  const posL = !f.pos || f.pos === "all" ? "모든 자리" : (GROUPS().find(x => x[0] === f.pos) || [0, f.pos])[1] + " 자리";
  const sum = (kind === "seek" ? [posL, "경기 종류 " + (K[f.kind] || "전체")] : []).concat(["날짜 " + (D[f.day] || "전체"), "지역 " + (f.area === "all" ? "전체" : f.area)]).concat(kind === "match" ? ["상대 실력 " + (f.lv === "all" ? "전체" : f.lv)] : []).join(", ");
  return `<div class="xfs"><span>${esc(sum)}</span><button type="button" class="xfb" data-act="xFOpen" aria-expanded="${!!XT.fOpen}" aria-controls="xflt"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"></path></svg>${XT.fOpen ? "접기" : "거르기"}</button></div>${XT.fOpen ? filterBox(kind) : ""}`;
}
const posSet = v => { if (!v || v === "all") return null; const g = GROUPS().find(x => x[0] === v); return g ? g[2] : [v]; };
const fitPos = label => { const s = posSet(XT.f.pos); return !s || String(label).split("/").some(p => s.includes(p)); };
const pass = x => (!XT.f.kind || XT.f.kind === "all" || x.event.type === XT.f.kind) && isWeekend(x.event, XT.f.day) && (XT.f.area === "all" || x.team.area === XT.f.area) && (XT.f.lv === "all" || String(x.team.level) === XT.f.lv);

// 화면 틀 (PC: 왼쪽 목록, 오른쪽 자세히)
// 제목줄 오른쪽: 우리 팀 실력 표와 버튼 (PC 시안)
const lvChip = () => `<span class="xlvc">우리 팀 ${esc(lvText(Number(S.settings.level) || 0))}</span>`;
function frame(title, sub, right, flt, list, panel) {
  return `${pcHead({ title, sub, right: lvChip() + right })}<div class="xbody">${flt}<div class="pcsplit2"><div class="pcl2 xl">${list}</div><section class="pcr2 xr" aria-label="자세히">${panel}</section></div></div>`;
}
const card = (x, on, chips, act) => `<button type="button" class="xc${on ? " on" : ""}" data-act="${act}" data-id="${esc(x.id)}" aria-pressed="${on}">${teamHead(x.team)}${x.kind === "hire" ? kindRow(x) : ""}<span class="xw"><b>${esc(dayLabel(x.event))} ${esc(x.event.time)}</b><span>${esc(x.event.place || "장소 미정")}</span></span><span class="xchips">${chips}</span></button>`;
const chip = (t, k) => `<span class="tag${k ? " " + k : " thin"}">${esc(t)}</span>`;
const pane = (kind, title, body, cta) => `<header class="xph"><span class="tag" style="background:#F2A65A;color:#121110">${kind}</span><b>${esc(title)}</b></header><div class="xpb">${body}</div>${cta ? `<div class="xpc">${cta}</div>` : ""}`;
const mobileOnly = title => `${hd(title, "#/")}<div class="body">${empty("PC에서 쓸 수 있어요", "다른 팀과(매칭, 용병 구인, 용병 구직)는 PC 브라우저로 열어 주세요.")}</div>`;

/* ===================== 매칭 ===================== */
export function vMatch() {
  if (!isPC()) return mobileOnly("매칭");
  const list = need("match", "x_list", { p_kind: "match" }); const v = XT.view.match;
  const inbox = adm() ? need("inbox", "x_inbox", { p_team: S.tid }) : null;
  const pend = inbox && !inbox.err ? inbox.filter(p => p.kind === "match").reduce((n, p) => n + p.apps.filter(a => a.status === "pending").length, 0) : 0;
  const right = adm() ? `<button type="button" class="pbtn" data-act="xView" data-k="match" data-v="${v === "inbox" ? "list" : "inbox"}" aria-pressed="${v === "inbox"}">받은 신청 ${pend}</button>` + `<button type="button" class="pbtn o" data-act="xView" data-k="match" data-v="${v === "new" ? "list" : "new"}" aria-pressed="${v === "new"}">매칭 글 올리기</button>` : "";
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
  const cards = (posts.length ? posts.map(p => { const pend = p.apps.filter(a => a.status === "pending").length; return `<button type="button" class="xc${sel && p.id === sel.id ? " on" : ""}" data-act="xSelIn" data-k="${kind}" data-id="${esc(p.id)}">${kindBadge(p.event)}<span class="xw"><b>${esc(dayLabel(p.event))} ${esc(p.event.time)} ${esc(evName({ type: p.event.type, opponent: p.event.opponent }))}</b><span>${esc(p.event.place || "")}</span></span><span class="xchips">${chip(p.state === "open" ? "받는 중" : "마감", p.state === "open" ? "ink" : "thin")}${kind === "hire" ? chip(p.slots.map(slotLabel).join(", ")) : ""}${pend ? chip("새 신청 " + pend, "ink") : ""}</span></button>`; }).join("") : empty("올린 글이 없어요", "위에서 글을 올리면 여기에 보여요."));
  const v = XT.view[kind === "match" ? "match" : "hire"];
  let panel;
  if (v === "new") panel = kind === "match" ? newMatchForm() : newHireForm();
  else if (!sel) panel = `<div class="pce">${empty("글을 골라 주세요", "")}</div>`;
  else {
    const apps = sel.apps.slice().sort((a, b) => rk(b) - rk(a));
    const appRows = apps.length ? apps.map(a => `<div class="xa"><span class="xat">${a.team ? teamHead(a.team) : `<b>${esc(a.name)}</b><span>${esc(a.sub || "")}</span>`}${kind === "hire" ? `<span class="xpos">${esc(slotText(String(a.pos).split("/")))} 자리</span>${lvLine(a.lv)}${a.acct ? `<span class="note">교통비 받을 계좌: ${esc(a.acct)}</span>` : ""}${a.status === "pay" ? `<span class="note">용병비 ${won(a.fee)}, ${esc(hm(a.due))}까지 안 보내면 자동으로 취소돼요</span>` : a.status === "sent" ? `<span class="note">${esc(a.name)}님이 용병비 ${won(a.fee)}을 보냈대요. 통장을 확인해 주세요</span>` : ""}` : `<span class="note">참석 투표로 확인된 팀원 ${a.mem}명, ${esc(recText(a.team))}</span>`}${a.memo ? `<span class="note">한마디: ${esc(a.memo)}</span>` : ""}</span><span class="xab">${a.status === "pending" ? `<button type="button" class="btn sm" data-act="xAnswer" data-id="${esc(a.id)}" data-ok="0">거절</button><button type="button" class="btn sm pri" data-act="xAnswer" data-id="${esc(a.id)}" data-ok="1">받기</button>` : a.status === "pay" || a.status === "sent" ? `${chip(a.status === "pay" ? "입금 기다림" : "입금했어요, 확인해 주세요", "yel")}<button type="button" class="btn sm pri" data-act="xPayOk" data-id="${esc(a.id)}">입금 확인</button>` : chip(a.status === "yes" ? (kind === "hire" ? "확정" : "받음") : "거절함", a.status === "yes" ? "ink" : "thin")}</span></div>`).join("") : empty("아직 신청이 없어요", "");
    const hx = { ...sel, team: { name: (S.team && S.team.name) || "우리 팀" } }; const hv = kind === "hire" ? (sel.fee && sel.fee.mode === "split" ? ["용병비", won(sel.fee.est), "받은 용병이 먼저 보내야 확정"] : feeHero(sel.fee)) : ["구장", sel.field === "yes" ? "잡음" : "없음", `팀원 ${sel.mem}명 (투표로 확인)`];
    const body = `${hero(hx, hv[0], hv[1], hv[2])}${rows([["우리 팀원", `참석 투표 ${sel.mem}명`]].concat(kind === "hire" ? [["구하는 자리", esc(sel.slots.map(slotText).join(", "))], ["용병들이 본 우리 팀", esc(trvText(sel.trv)) + " 누가 남겼는지는 안 보여요"]].concat(feeRows(sel.fee, sel.event, true)) : [["구장", sel.field === "yes" ? "우리가 잡았어요" : "아직 없어요"]]))}${memoBox("우리 팀이 남긴 말", sel.memo)}<div class="xsec"><b>신청 ${sel.apps.length}건</b><span class="note">${kind === "hire" ? sel.fee && sel.fee.mode === "split" ? "레벨이 높은 사람이 위에 보여요. 받으면 용병비 금액이 정해지고, 입금을 확인하면 참석 명단과 대화방에 들어가요." : "레벨이 높은 사람이 위에 보여요. 받으면 바로 그 일정 참석 명단에 용병으로 들어가요." : "받으면 두 팀 일정에 서로가 상대로 적혀요. 다른 신청은 거절돼요."}</span></div>${appRows}`;
    panel = pane(kind === "match" ? "매칭" : "용병 구인", `${dayLabel(sel.event)} ${sel.event.time} 우리 글`, body, `<button type="button" class="btn" data-act="xState" data-id="${esc(sel.id)}" data-open="${sel.state === "open" ? "0" : "1"}">${sel.state === "open" ? "마감하기" : "다시 받기"}</button>`);
  }
  return frame(title, kind === "match" ? "우리 팀이 올린 매칭 글과 받은 신청이에요." : "우리 경기에 올 용병을 다른 팀 사람들에게서 구해요. 운영진이 올리고 신청을 받아요.", right, "", cards, panel);
}
const rk = a => a.lv ? Number(a.lv.level) : 1;
// 용병 레벨 (구인 팀 운영진만 봄): 현장 출석과 평가로 오르고 내려간다
const lvLine = l => !l ? "" : `<span class="xrate"><span class="xlvb">용병 레벨 ${l.level}</span>${l.games ? `온 경기 ${l.games}번` : "매니볼 용병 처음"}${l.noshow ? `, 안 옴 ${l.noshow}번` : ""}</span>`;
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
  if (adm()) { const inbox = need("inbox", "x_inbox", { p_team: S.tid }); return inboxView("hire", inbox, `<button type="button" class="pbtn o" data-act="xView" data-k="hire" data-v="${XT.view.hire === "new" ? "list" : "new"}" aria-pressed="${XT.view.hire === "new"}">구인 글 올리기</button>`); }
  // 팀원: 우리 팀이 올린 구인 글을 본다 (신청은 운영진이 받고 거절해요)
  const all = need("hireAll", "x_list", { p_kind: "hire" });
  if (all === null) return frame("용병 구인", "", "", "", loading, "");
  if (all.err) return frame("용병 구인", "", "", "", errBox(all), "");
  const mine = all.filter(x => x.mine); const sel = mine.find(x => x.id === XT.sel.hire) || mine[0];
  const cards = mine.length ? mine.map(x => card(x, sel && x.id === sel.id, x.slots.map(s => chip(slotLabel(s) + " 1명")).join(""), "xSelHire")).join("") : empty("우리 팀이 올린 구인 글이 없어요", "운영진이 올리면 여기에 보여요.");
  const hvm = feeHero(sel ? sel.fee : null);
  const panel = sel ? pane("용병 구인", `${dayLabel(sel.event)} ${sel.event.time} ${kWord(sel.event)} 용병`, hero(sel, hvm[0], hvm[1], hvm[2]) + rows([["구하는 자리", esc(sel.slots.map(slotText).join(", "))], ["받은 용병", `${sel.taken}명`], ["용병들이 본 우리 팀", esc(trvText(sel.team.trv)) + " 누가 남겼는지는 안 보여요"]].concat(feeRows(sel.fee, sel.event, true))) + memoBox("우리 팀이 남긴 말", sel.memo), `<span class="note">운영진만 받고 거절해요. 받은 용병은 일정의 참석 명단에 보여요.</span>`) : `<div class="pce">${empty("글을 골라 주세요", "")}</div>`;
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
    ${pick && empt ? feeForm(pick, a, gs, slots.length) : ""}
    <label class="fld"><b>한마디</b><input class="inp" data-bind="xmemo" maxlength="300" placeholder="용병에게 남길 말" value="${esc(S.form.xmemo || "")}"></label>`;
  return pane("용병 구인", "용병 구인 글 올리기", body, `<button type="button" class="btn" data-act="xView" data-k="hire" data-v="list">닫기</button><button type="button" class="btn o" data-act="xPostHire" data-ev="${esc(pick ? pick.id : "")}" ${pick && empt ? "" : "disabled"}>구인 글 올리기</button>`);
}

// 용병비 정하기 (구장 목록이 생기기 전까지 구장비는 직접 적고, 글에 '직접 적은 금액'이 붙어요)
const num = v => Number(String(v || "").replace(/[^0-9]/g, "")) || 0;
function feeForm(ev, a, gs, n) {
  const m = XT.fv.fmode || "split"; const total = num(S.form.xtotal); const ppl = a.in + gs + Math.max(1, n);
  const fee = total ? Math.floor((ev.type === "match" ? total / 2 : total) / ppl / 500) * 500 : 0;
  const chips = [["split", "구장비 나눠 받기"], ["free", "무료"], ["pay", "교통비 드리기"]].map(([v, l]) => `<button type="button" class="chip sm${m === v ? " on" : ""}" data-act="xFv" data-k="fmode" data-v="${v}" aria-pressed="${m === v}">${l}</button>`).join("");
  return `<div class="fld"><b>용병비</b><div class="chips">${chips}</div></div>
    ${m === "split" ? `<label class="fld"><b>구장비 <span class="note">구장 목록이 생기기 전까지 직접 적어요. 글에 '직접 적은 금액'이 붙어요</span></b><input class="inp" inputmode="numeric" data-bind="xtotal" maxlength="9" placeholder="예: 100,000" value="${esc(S.form.xtotal || "")}"></label>
      <div class="xfee"><b>${total ? "한 명당 약 " + won(fee) : "구장비를 적으면 계산돼요"}</b><span>${total ? esc(`구장비 ${won(total)}${ev.type === "match" ? " ÷ 2팀" : ""} ÷ ${ppl}명 (팀원 ${a.in} + 용병 ${gs + Math.max(1, n)}), 500원 단위 내림`) : ""}</span><span>신청을 받을 때 그때 인원으로 정해져요. 받은 용병은 정해진 시간 안에 먼저 보내야 확정돼요. 운영진은 금액을 고칠 수 없어요.</span></div>`
    : m === "pay" ? `<label class="fld"><b>한 명당 교통비</b><input class="inp" inputmode="numeric" data-bind="xpay" maxlength="7" placeholder="예: 10,000" value="${esc(S.form.xpay || "")}"><span class="note">받으면 바로 확정돼요. 경기 뒤 현장 출석으로 온 게 확인된 용병에게 팀이 직접 보내요.</span></label>`
    : `<span class="note">무료예요. 받으면 바로 확정되고 그 경기 대화방에 들어가요.</span>`}`;
}

/* ===================== 용병 구직 ===================== */
export function vSeek() {
  if (!isPC()) return mobileOnly("용병 구직");
  const all = need("hireAll", "x_list", { p_kind: "hire" }); const v = XT.view.seek;
  const right = `<button type="button" class="pbtn" data-act="xView" data-k="seek" data-v="${v === "mine" || v === "rate" ? "list" : "mine"}"${v === "mine" || v === "rate" ? ` aria-pressed="true"` : ""}>${v === "mine" || v === "rate" ? "구인 글 보기" : "내 신청 목록"}</button>`;
  if (!XT.f.pos) XT.f.pos = (myProfile() || {}).pos1 || "all";
  if (all === null) return frame("용병 구직", "", right, "", loading, "");
  if (all.err) return frame("용병 구직", "", right, "", errBox(all), "");
  const items = all.filter(x => !x.mine && pass(x) && x.slots.some(s => fitPos(slotLabel(s))));
  const sel = items.find(x => x.id === XT.sel.seek) || items[0];
  const cards = items.length ? items.map(x => card(x, sel && x.id === sel.id, x.slots.map(s => chip(slotLabel(s) + " 1명", XT.f.pos !== "all" && fitPos(slotLabel(s)) ? "ink" : "")).concat([chip(feeShort(x.fee))], trvChip(x.team) ? [chip(trvChip(x.team))] : [], x.applied ? [chip("신청함", "ink")] : []).join(""), "xSelSeek")).join("") : empty("이 조건에 맞는 구인 글이 없어요", "거르기를 바꿔 보세요.");
  let panel = `<div class="pce">${empty("글을 골라 주세요", "")}</div>`;
  if (v === "mine") panel = myView();
  else if (v === "rate") panel = rateView();
  else if (sel && v === "form") panel = seekForm(sel);
  else if (sel) {
    const hv = feeHero(sel.fee);
    const body = `${hero(sel, hv[0], hv[1], hv[2])}${teamHead(sel.team, true)}${rows([["용병들의 평가", esc(trvText(sel.team.trv))], ["이 팀 실력", esc(lvText(sel.team.level))], ["팀 기록", esc(recText(sel.team))]].concat(feeRows(sel.fee, sel.event)))}<div class="fld"><b>구하는 포지션</b><div class="xposl">${sel.slots.map(s => `<span class="xpos big${XT.f.pos !== "all" && fitPos(slotLabel(s)) ? " on" : ""}">${esc(slotLabel(s))} <small>1명</small></span>`).join("")}</div></div>${memoBox("그 팀이 남긴 말", sel.memo)}`;
    const cta = sel.applied ? `<span class="note">신청했어요 (${({ pending: "기다림", pay: "받음, 용병비를 보내 주세요", sent: "보냈어요, 그 팀 확인 기다림", yes: "확정" })[sel.applied] || "기다림"}). 내 신청 목록에서 볼 수 있어요.</span><button type="button" class="btn" data-act="xView" data-k="seek" data-v="mine">내 신청 목록</button>` : `<span class="note">신청은 팀원, 운영진 누구나 개인으로 해요. ${sel.fee && sel.fee.mode === "split" ? `받으면 용병비 ${won(sel.fee.est)} 정도를 먼저 보내야 경기가 확정되고 그 경기 대화방에 들어가요.` : sel.fee && sel.fee.mode === "pay" ? "받으면 바로 확정되고, 경기 뒤 교통비를 받아요." : "무료라 받으면 바로 확정되고 그 경기 대화방에 들어가요."}</span><button type="button" class="btn o" data-act="xView" data-k="seek" data-v="form">${XT.f.pos && XT.f.pos !== "all" && sel.slots.some(s => fitPos(slotLabel(s))) && !GROUPS().some(g => g[0] === XT.f.pos && g[2].length > 1) ? esc(XT.f.pos) + "로 신청하기" : "신청하기"}</button>`;
    panel = pane("용병 구직", `${sel.team.name}  ${dayLabel(sel.event)} ${sel.event.time} ${kWord(sel.event)}`, body, cta);
  }
  return frame("용병 구직", "내 포지션을 구하는 다른 팀 경기를 찾아 신청해요. 처음에는 내 1선호 포지션으로 걸러져요.", right, filterBar("seek"), cards, panel);
}
function seekForm(sel) {
  const cur = sel.slots.map(slotLabel).includes(XT.fv.apPos) ? XT.fv.apPos : slotLabel(sel.slots.find(s => fitPos(slotLabel(s))) || sel.slots[0]);
  const p = myProfile() || {};
  const body = `${teamHead(sel.team)}<div class="fld"><span class="spread"><b>신청 자리</b><span class="note">두 포지션이 적힌 자리는 둘 중 어디든 들어가요</span></span><div class="chips">${sel.slots.map(s => `<button type="button" class="chip sm${slotLabel(s) === cur ? " on" : ""}" data-act="xFv" data-k="apPos" data-v="${esc(slotLabel(s))}">${esc(slotText(s))}</button>`).join("")}</div></div>
    ${rows([["내 포지션", esc([p.pos1, p.pos2].filter(Boolean).join(" / ") || "정하지 않음") + "  홈에서 바꿔요"], ["내 팀", esc((S.team && S.team.name) || "") + " 팀원으로 보여요"]])}
    ${rows(feeRows(sel.fee, sel.event))}
    ${sel.fee && sel.fee.mode === "pay" ? `<label class="fld"><b>교통비 받을 계좌</b><input class="inp" data-bind="xacct" maxlength="60" placeholder="예: 카카오뱅크 3333-01-1234567 홍길동" value="${esc(S.form.xacct || "")}"><span class="note">그 팀 운영진에게만 보여요. 경기 뒤 현장 출석으로 온 게 확인되면 이 계좌로 보내요.</span></label>` : ""}
    <label class="fld"><b>한마디</b><input class="inp" data-bind="xmemo" maxlength="200" placeholder="그 팀 운영진에게만 보여요" value="${esc(S.form.xmemo || "")}"></label>`;
  return pane("용병 구직", `${sel.team.name}  ${md(sel.event.date)} ${kWord(sel.event)}에 신청`, body, `<button type="button" class="btn" data-act="xView" data-k="seek" data-v="list">닫기</button><button type="button" class="btn o" data-act="xApplyHire" data-id="${esc(sel.id)}" data-pos="${esc(cur)}">신청하기</button>`);
}
// 내 신청 목록 (시안 5-3-3): 해야 할 일, 다가오는 경기, 기다리는 신청, 지난 경기로 묶고 신청마다 카드 하나
// 용병 본인에게는 별점과 레벨을 보여 주지 않는다 (시안 결정 기록 3)
const hm = iso => { const d = new Date(Date.parse(iso) + 9 * 3600e3); return `${d.getUTCMonth() + 1}.${String(d.getUTCDate()).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`; };
function myView() {
  const my = need("my", "x_my", {});
  if (my === null) return loading; if (my.err) return errBox(my);
  const apps = (my.apps || []).filter(a => a.kind === "hire" && a.mine);
  const today = todayStr();
  const canRate = a => a.status === "yes" && a.came && !a.rated && a.past && a.rateBy && a.rateBy >= today;
  const grp = a => a.status === "pay" || a.status === "sent" || canRate(a) ? "todo" : a.status === "pending" ? (a.event.date < today ? "past" : "wait") : a.status === "yes" && !a.past ? "up" : "past";
  const ST = a => a.status === "pending" ? ["기다림", "thin"] : a.status === "pay" ? ["받음, 용병비를 보내 주세요", "yel"] : a.status === "sent" ? ["보냈어요, 그 팀 확인 기다림", "yel"] : a.status === "no" ? ["거절됨", "dash"] : a.past ? [a.rated ? "다녀왔어요, 평가함" : a.checked && !a.came ? "출석 확인 안 됨" : "다녀왔어요", "ink"] : [a.mode === "pay" ? "확정, 경기 뒤 교통비가 와요" : "확정, 대화방에 들어갔어요", "ink"];
  const sub = a => [slotText(String(a.pos).split("/")) + " 자리로 신청", a.mode === "free" ? "용병비 무료" : a.mode === "pay" ? `교통비 ${won(a.pay)} 받아요` : a.fee ? `용병비 ${won(a.fee)}${a.status === "yes" ? " 냄" : ""}` : "용병비는 받을 때 정해져요"].join(", ");
  const box = a => {
    if (a.status === "pay" || a.status === "sent") {
      const bk = a.bank || {}; const acc = [bk.bank, bk.account, bk.holder].filter(Boolean).join("  ");
      return `<div class="xpay"><span class="xpt"><b>용병비 ${won(a.fee)}</b><span>${a.total ? esc(`구장비 ${won(a.total)}${a.event.type === "match" ? " ÷ 2팀" : ""}, 받을 때 인원으로 나눠 500원 단위 내림`) : ""}</span><span>${acc ? esc(a.team.name + " 계좌  " + acc) : "그 팀이 아직 계좌를 적지 않았어요. 대화로 물어봐 주세요"}</span><span>${a.status === "pay" ? `<b>${esc(hm(a.due))}</b>까지 보내야 확정돼요. 안 보내면 자동으로 취소돼요` : "그 팀이 입금을 확인하면 확정되고 대화방에 들어가요"}</span></span><span class="xpbt">${a.status === "pay" ? `${acc ? `<button type="button" class="btn" data-act="xCopy" data-v="${esc(bk.account || "")}">계좌 복사</button>` : ""}<button type="button" class="btn o" data-act="xPaid" data-id="${esc(a.id)}">보냈어요</button>` : ""}</span></div>`;
    }
    if (canRate(a)) return `<div class="xpay"><span class="xpt"><b>이 팀은 어땠나요?</b><span>매너와 준비를 평가해 주세요. 다른 용병이 팀을 고를 때 보여요. 누가 남겼는지는 그 팀에 안 보여요</span><span>${esc(md(a.rateBy))}까지 남길 수 있어요</span></span><span class="xpbt"><button type="button" class="btn o" data-act="xRateOpen" data-id="${esc(a.id)}">팀 평가하기</button></span></div>`;
    return "";
  };
  const one = (a, g) => { const st = ST(a); return `<div class="xmc${g === "todo" ? " todo" : g === "past" ? " past" : ""}"><div class="xmt">${jersey(a.team.kit, 44, tagOf(a.team.name))}<span class="xmm"><span class="xmn"><b>${esc(a.team.name)}</b>${kindBadge(a.event)}</span><span class="xw"><b>${esc(dayLabel(a.event))} ${esc(a.event.time || "")}</b><span>${esc(a.event.place || "")}</span></span><span class="note">${esc(sub(a))}</span></span><span class="tag ${st[1]}">${esc(st[0])}</span></div>${box(a)}${a.status === "pending" || a.status === "pay" ? `<span class="xmx"><button type="button" class="lnk" data-act="xCancel" data-id="${esc(a.id)}">신청 취소</button></span>` : ""}</div>`; };
  const G = [["todo", "해야 할 일", "지금 눌러야 하는 것", "#FCD01A"], ["up", "다가오는 경기", "확정됐어요", "#14BBC2"], ["wait", "기다리는 신청", "그 팀이 아직 안 정했어요", "#FFFFFF"], ["past", "지난 경기", "끝났거나 안 된 신청", "#DDD6C8"]];
  const body = `<div class="xml"><p class="xmi"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v6M12 7.5v.5"></path></svg><span><b>내가 용병으로 신청한 경기</b>만 모여요. 우리 팀 구인 글과 매칭 신청은 각 메뉴에서 봐요.</span></p>
    ${apps.length ? G.map(g => { const list = apps.filter(a => grp(a) === g[0]); return list.length ? `<section class="xmg" aria-label="${g[1]}"><h3><i style="background:${g[3]}"></i>${g[1]}<span class="xmcnt">${list.length}</span><em>${g[2]}</em></h3>${list.map(a => one(a, g[0])).join("")}</section>` : ""; }).join("") : empty("아직 신청한 경기가 없어요", "구인 글을 골라 신청하면 여기에 모여요.")}
    <span class="note">그 팀이 받으면 알림이 와요. 용병비를 보내고 그 팀이 확인하면 참석 명단과 대화방에 들어가요. 그 팀 사정으로 경기가 취소되면 용병비를 모두 돌려받아요.</span></div>`;
  return pane("용병 구직", "내 신청 목록", body, "");
}
// 팀 평가 (시안 5-3-6)
function rateView() {
  const my = need("my", "x_my", {}); if (my === null) return loading; if (my.err) return errBox(my);
  const a = (my.apps || []).find(x => x.id === XT.rateApp); if (!a) { XT.view.seek = "mine"; return myView(); }
  const r = XT.rt || (XT.rt = { m: 0, p: 0, same: "", good: [], bad: [] });
  const stars = k => `<span class="xst" role="group" aria-label="${k === "m" ? "매너" : "준비"}">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-act="xRt" data-k="${k}" data-v="${n}" aria-label="${k === "m" ? "매너" : "준비"} 별 ${n}개" aria-pressed="${r[k] >= n}"><svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.3l-5.7 3 1.1-6.3-4.6-4.5 6.4-.9z" fill="${r[k] >= n ? "#FCD01A" : "#FFFFFF"}" stroke="#121110" stroke-width="1.8" stroke-linejoin="round"></path></svg></button>`).join("")}<b>${r[k] ? r[k] + " / 5" : "골라 주세요"}</b></span>`;
  const pills = (k, list, multi) => `<div class="chips">${list.map(([v, l]) => { const on = multi ? r[k].includes(v) : r[k] === v; return `<button type="button" class="chip sm${on ? " on" : ""}" data-act="xRt" data-k="${k}" data-v="${v}" aria-pressed="${on}">${esc(l)}</button>`; }).join("")}</div>`;
  const body = `<span class="note">현장 출석으로 온 게 확인된 용병만 남겨요. 3명 이상 모이면 그 팀 구인 글에 평균과 많이 받은 말이 보여요. 누가 남겼는지는 그 팀에 안 보여요.</span>
    <div class="fld"><b>매너 <span class="note">말투, 존중, 거친 플레이</span></b>${stars("m")}</div>
    <div class="fld"><b>준비 <span class="note">시간 약속, 구장, 공과 조끼, 라인업</span></b>${stars("p")}</div>
    <div class="fld"><b>글에 적힌 대로였나요 <span class="note">포지션, 시간, 용병비</span></b>${pills("same", [["same", "같았어요"], ["bit", "조금 달랐어요"], ["diff", "많이 달랐어요"]])}</div>
    <div class="fld"><b>좋았던 점 <span class="note">여러 개 골라도 돼요</span></b>${pills("good", GOOD, true)}</div>
    <div class="fld"><b>아쉬운 점 <span class="note">여러 개 골라도 돼요</span></b>${pills("bad", BAD, true)}</div>
    <label class="fld"><b>한마디 <span class="note">그 팀에는 안 보이고 매니볼만 봐요</span></b><input class="inp" data-bind="xrmemo" maxlength="200" placeholder="하고 싶은 말이 있으면 적어요 (안 적어도 돼요)" value="${esc(S.form.xrmemo || "")}"></label>`;
  return pane("용병 구직", `${a.team.name} ${md(a.event.date)} ${kWord(a.event)} 평가`, body, `<button type="button" class="btn" data-act="xView" data-k="seek" data-v="mine">닫기</button><button type="button" class="btn o" data-act="xRateSend" data-id="${esc(a.id)}">평가 남기기</button>`);
}

/* ===================== 동작 ===================== */
function xFail(e) {
  const m = String((e && (e.message || e.details)) || e || "");
  const M = { too_fast: "너무 빨리 반복하고 있어요. 잠시 뒤에 다시 해 주세요", need_acct: "교통비 받을 계좌를 적어 주세요", bad_fee: "용병비를 다시 확인해 주세요", not_pay: "입금 기다림이 아니에요. 기한이 지나 취소됐을 수 있어요", full: "자리가 다 찼어요", not_came: "현장 출석으로 온 게 확인된 경기만 평가할 수 있어요", too_late: "경기 뒤 7일이 지나 평가할 수 없어요", not_yet: "경기가 끝난 뒤에 평가할 수 있어요", bad_stars: "별점을 다시 골라 주세요", not_admin: "운영진만 할 수 있어요", not_member: "팀에 들어간 뒤에 쓸 수 있어요", post_closed: "마감된 글이에요", own_post: "우리 팀 글이에요", own_team: "우리 팀 글에는 신청할 수 없어요", not_open_match: "상대가 정해지지 않은 경기만 돼요", other_day: "같은 날 경기만 신청할 수 있어요", other_sport: "같은 종목 팀끼리만 매칭할 수 있어요", bad_pos: "글에 있는 자리만 고를 수 있어요", too_many: "빈 자리보다 많이 구할 수 없어요", bad_slots: "자리를 다시 골라 주세요", event_closed: "지났거나 취소된 일정이에요", not_pending: "이미 처리된 신청이에요", duplicate: "이미 신청했어요", unique: "이미 신청했어요" };
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
  xFOpen: () => { XT.fOpen = !XT.fOpen; render(); },
  xFv: t => { XT.fv[t.dataset.k] = t.dataset.v; render(); },
  xView: t => { XT.view[t.dataset.k] = t.dataset.v; if (/^(form|new)$/.test(t.dataset.v)) { S.form = { ...(S.form || {}), xmemo: "", xkit: "", xacct: "" }; XT.fv = { ...XT.fv, apPos: "" }; } render(); },
  xSel: t => { XT.sel.match = t.dataset.id; XT.view.match = "list"; render(); },
  xSelHire: t => { XT.sel.hire = t.dataset.id; render(); },
  xSelSeek: t => { XT.sel.seek = t.dataset.id; XT.view.seek = "list"; render(); },
  xSelIn: t => { XT.sel["in_" + t.dataset.k] = t.dataset.id; XT.view[t.dataset.k === "match" ? "match" : "hire"] = t.dataset.k === "match" ? "inbox" : "list"; render(); },
  xApplyMatch: t => call("x_apply_match", { p_post: t.dataset.id, p_team: S.tid, p_event: t.dataset.ev, p_memo: (S.form || {}).xmemo || "" }, "매칭을 신청했어요. 상대가 받으면 알림이 가요", () => { XT.view.match = "list"; }),
  xApplyHire: t => {
    const it = ((XT.data.hireAll || []).find || (() => null)).call(XT.data.hireAll || [], x => x.id === t.dataset.id);
    const acct = String((S.form || {}).xacct || "").trim();
    if (it && it.fee && it.fee.mode === "pay" && acct.length < 6) { toast("교통비 받을 계좌를 적어 주세요"); return; }
    call("x_apply_hire", { p_post: t.dataset.id, p_pos: t.dataset.pos, p_memo: (S.form || {}).xmemo || "", p_acct: acct }, "신청했어요. 받으면 알림이 와요", () => { XT.view.seek = "list"; });
  },
  xPostMatch: t => call("x_post_match", { p_team: S.tid, p_event: t.dataset.ev, p_field: XT.fv.field || "yes", p_kit: (S.form || {}).xkit || ((S.settings.kit || {}).home || ""), p_memo: (S.form || {}).xmemo || "" }, "매칭 글을 올렸어요. 신청이 오면 알림이 가요", () => { XT.view.match = "inbox"; }),
  xPostHire: t => {
    const slots = (XT.fv.slots && XT.fv.slotsFor === t.dataset.ev) ? XT.fv.slots : [[]];
    if (!slots.length) { toast("구할 용병을 한 명 이상 추가해 주세요"); return; }
    const blank = slots.findIndex(s => !s.length); if (blank >= 0) { toast(`용병 ${blank + 1}의 자리를 골라 주세요`); return; }
    const m = XT.fv.fmode || "split"; const total = num((S.form || {}).xtotal), pay = num((S.form || {}).xpay);
    if (m === "split" && (total < 10000 || total > 2000000)) { toast("구장비를 적어 주세요 (10,000원부터)"); return; }
    if (m === "pay" && (pay < 1000 || pay > 200000)) { toast("교통비를 적어 주세요 (1,000원부터)"); return; }
    call("x_post_hire", { p_team: S.tid, p_event: t.dataset.ev, p_slots: slots, p_memo: (S.form || {}).xmemo || "", p_mode: m, p_total: m === "split" ? total : null, p_pay: m === "pay" ? pay : null }, "용병 구인 글을 올렸어요. 용병 구직 화면에 보여요", () => { XT.view.hire = "list"; XT.fv.slots = null; });
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
  xPaid: t => confirmBox("용병비를 보냈나요?", "그 팀 운영진에게 알림이 가요. 그 팀이 입금을 확인하면 확정되고 대화방에 들어가요.", "보냈어요", () => call("x_paid", { p_app: t.dataset.id }, "그 팀에 알렸어요. 확인하면 대화방에 들어가요")),
  xPayOk: t => confirmBox("입금을 확인했나요?", "확인하면 그 용병이 참석 명단과 그 경기 대화방에 들어가요.", "입금 확인", () => call("x_pay_ok", { p_app: t.dataset.id }, "입금을 확인했어요. 참석 명단에 들어갔어요")),
  xCopy: async t => { try { await navigator.clipboard.writeText(t.dataset.v || ""); toast("계좌번호를 복사했어요"); } catch (e) { toast("계좌번호를 길게 눌러 복사해 주세요"); } },
  xRateOpen: t => { XT.rateApp = t.dataset.id; XT.rt = null; S.form = { ...(S.form || {}), xrmemo: "" }; XT.view.seek = "rate"; render(); },
  xRt: t => { const r = XT.rt || (XT.rt = { m: 0, p: 0, same: "", good: [], bad: [] }); const k = t.dataset.k, v = t.dataset.v;
    if (k === "m" || k === "p") r[k] = Number(v); else if (k === "same") r.same = r.same === v ? "" : v; else r[k] = r[k].includes(v) ? r[k].filter(x => x !== v) : r[k].concat([v]); render(); },
  xRateSend: t => { const r = XT.rt || {}; if (!r.m || !r.p) { toast("매너와 준비 별점을 골라 주세요"); return; }
    call("x_rate_team", { p_app: t.dataset.id, p_manner: r.m, p_prep: r.p, p_same: r.same || "", p_good: r.good || [], p_bad: r.bad || [], p_memo: (S.form || {}).xrmemo || "" }, "평가를 남겼어요. 고마워요", () => { XT.view.seek = "mine"; XT.rt = null; }); },
  xCancel: t => confirmBox("신청을 취소할까요?", "그 팀 운영진에게 보이던 신청이 사라져요.", "신청 취소", () => call("x_cancel", { p_app: t.dataset.id }, "신청을 취소했어요"), true),
};
