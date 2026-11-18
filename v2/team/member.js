// 팀원 화면 (뉴버전 시안 4장 화면 구성). 운영진도 같은 화면을 쓰고, 운영진에게만 관리 버튼과 운영 탭이 더 보인다.
import { noLate, pol, rulesTextOf, fineRulesOf, $, D, POS, QN, ROLE, S, UI, att, cameTo, closeSheet, confirmBox, esc, evName, evStart, fail, feeMode, guestReqs, guestsOf, isAdmin, isPlay, md, momClosed, momDeadline, momOpen, momWinners, myProfile, myUv, myVote, nameOf, noticesList, past, patchDoc, people, render, ruleKind, sb, sheet, sport, started, toast, todayStr, uid36, upcoming, voteState, wd, won, ym, mLabel, closeAt, remindInfo, promotedAt, spotXY, viewMode, fineAt, fineNow, fineText, lateCancel, ls, APP, maintLocked } from "./main.js";
import { C, IC, navBar, hd, hdTab, hdBrand, mngBtn, lrow, dlg, empty, initial, sw, teamLogo } from "./ui.js";
import { afeed, adminHomeRows } from "./admin.js";

/* ---------- 공통 계산 ---------- */
const MU = { season: "", lq: 1, mom: "", gpos: [], tq: {}, anim: null };
const yearOf = () => MU.season || todayStr().slice(0, 4);
export const seasonEvents = y => past().filter(e => e.date.startsWith(y));
const pad2 = n => String(n).padStart(2, "0");
const kst = t => new Date(t + 9 * 3600e3);
export const whenText = t => { const d = kst(t); return `${d.getUTCMonth() + 1}.${pad2(d.getUTCDate())} ${"일월화수목금토"[d.getUTCDay()]} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`; };
const dday = e => { const d = Math.round((new Date(e.date + "T00:00:00+09:00") - new Date(todayStr() + "T00:00:00+09:00")) / 864e5); return d === 0 ? "D-DAY" : d > 0 ? "D-" + d : ""; };
const VS = { yes: "참석", late: "늦참", no: "불참" };
const VC = { yes: C.white, late: C.white, no: C.white };
const myPid = () => (S.rsvp[S.uid] || {}).pid || "";
export const kindOf = e => e.type === "scrim" ? "내전" : e.type === "match" ? "경기" : "훈련";
export const vsText = e => e.type === "match" ? (e.opponent ? "vs " + e.opponent : "상대 미정") : e.type === "scrim" ? "우리끼리 내전" : (e.place || "훈련");
// 라인업: 이 사람이 뛴 쿼터 (없으면 null)
export function quarterList(e, u) {
  const out = []; const L = e.lineup || {};
  Object.values(L).forEach(side => { if (!side || !side.q) return; Object.entries(side.q).forEach(([k, q]) => { if (Object.values(q).includes(u)) out.push(Number(k)); }); });
  return out.sort((a, b) => a - b);
}
function quartersOf(e, u) { const L = e.lineup || {}; return Object.values(L).some(s => s && s.q) ? quarterList(e, u).length : null; }
export function myStats(u, y) {
  const evs = seasonEvents(y || yearOf()).filter(isPlay);
  const came = evs.filter(e => cameTo(e, u));
  const late = evs.filter(e => (e.check || {})[u] === "late").length;
  const goals = evs.reduce((n, e) => n + (e.goals || []).filter(g => g.uid === u).length, 0);
  const mom = evs.filter(momClosed).filter(e => momWinners(e).includes(u)).length;
  return { n: evs.length, mine: came.length, late, miss: evs.length - came.length, goals, mom, rate: evs.length ? Math.round(came.length * 100 / evs.length) : 0 };
}
const scoreText = e => `${e.score.us}:${e.score.them}`;
const resultWord = e => { if (!e.score) return ""; const a = +e.score.us, b = +e.score.them; return e.type === "scrim" ? (a > b ? "A팀 승" : a < b ? "B팀 승" : "무승부") : a > b ? "승" : a < b ? "패" : "무"; };
const sideOf = (e, u) => (e.teams || {})[u] || "";

/* ---------- 알림 (데이터에서 만든다, 30일) ---------- */
export function feed() {
  const out = []; const u = S.uid; const now = Date.now(); const keep = 30 * 864e5;
  const add = (at, where, text, href) => { const t = Date.parse(at || ""); if (t && now - t < keep) out.push({ t, where, text, href }); };
  Object.values(S.events).forEach(e => {
    const name = `${md(e.date)} ${evName(e)}`;
    if (!started(e) && e.createdAt) add(e.createdAt, "일정", `${name} 참석 투표가 열렸어요`, "#/event/" + e.id);
    const pa = !started(e) && promotedAt(e, u); if (pa) add(pa, "일정", `${name} 대기에서 참석으로 올라왔어요`, "#/event/" + e.id);
    if (e.scrimAt) add(e.scrimAt, "일정", `${md(e.date)} 경기가 내전으로 바뀌었어요`, "#/event/" + e.id);
    if (e.lineupAt && cameOrGoing(e, u)) add(e.lineupAt, "라인업", `${name} 라인업이 나왔어요`, "#/event/" + e.id);
    if (e.scoredAt && momOpen(e) && cameTo(e, u)) add(e.scoredAt, "기록", `${name} MOM 투표가 열렸어요`, "#/game/" + e.id);
    if (e.score && momClosed(e) && momWinners(e).length) add(momDeadline(e).toISOString(), "기록", `${name} MOM은 ${momWinners(e).map(nameOf).join(", ")}`, "#/game/" + e.id);
  });
  Object.values(((D("guestreq")[u] || {}).items) || {}).forEach(g => { const e = S.events[g.eid]; if (g.status === "ok") add(g.doneAt || g.at, "용병", `${g.name} 용병 신청이 수락됐어요`, e ? "#/event/" + e.id : "#/schedule"); if (g.status === "no") add(g.doneAt || g.at, "용병", `${g.name} 용병 신청이 이번에는 어려워요`, e ? "#/event/" + e.id : "#/schedule"); });
  const pr = (S.rsvp[u] || {}).posReq; if (pr && pr.doneAt) add(pr.doneAt, "포지션", pr.status === "ok" ? "포지션 변경이 수락됐어요" : "포지션 변경 요청이 반려됐어요", "#/");
  const rm = remindInfo(); if (rm && (rm.to || []).includes(u) && S.events[rm.eid] && !started(S.events[rm.eid]) && !myVote(S.events[rm.eid]).s) add(rm.at, "일정", `${md(S.events[rm.eid].date)} ${evName(S.events[rm.eid])} 참석 응답을 기다리고 있어요`, "#/event/" + rm.eid);
  const owe = oweNow(); if (owe.total && owe.dueAt) add(owe.dueAt, "회비", `${owe.label}${iga(owe.label)} 아직이에요`, "#/money");
  const dr = D("team").duesRemind; if (dr && (dr.to || []).includes(u) && owe.total) add(dr.at, "회비", `운영진이 회비 알림을 보냈어요. ${won(owe.total)}`, "#/money");
  (((D("mydues")[u] || {}).fines) || []).forEach(f => { if (!f.paid && f.at) add(f.at, "벌금", `${f.reason || "벌금"} ${won(f.amount)}이 매겨졌어요`, "#/money"); });
  if (S.settings.rulesAt) add(S.settings.rulesAt, "팀", "팀 수칙이 바뀌었어요", "#/rules");
  noticesList().forEach(n => { if (!n.quiet) add(n.at, "공지", n.title, "#/notice/" + n.id); });
  ((D("team").evlog || {}).items || []).forEach(x => { if ((x.to || []).includes(u)) add(x.at, "일정", x.text, "#/schedule"); });
  return out.sort((a, b) => b.t - a.t);
}
function cameOrGoing(e, u) { const v = (((S.rsvp[u] || {}).ev || {})[e.id]) || {}; return cameTo(e, u) || v.s === "yes" || v.s === "late"; }
export const readAt = () => Date.parse(myUv().readAt || "") || 0;
const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 60 ? (m < 2 ? "방금" : m + "분 전") : m < 1440 ? Math.round(m / 60) + "시간 전" : m < 2880 ? "어제" : kst(t).toISOString().slice(5, 10).replace("-", "."); };
const iga = w => { const c = String(w || "").trim().slice(-1).charCodeAt(0); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? "이" : "가"; };
export const bell = n => `<a class="ib" href="#/notify" aria-label="알림${n ? " " + n + "개 안 읽음" : ""}">${IC.bell}${n ? `<span style="position:absolute;top:9px;right:9px;width:10px;height:10px;border-radius:50%;background:${C.orange};border:2px solid ${C.bg}"></span>` : ""}</a>`;

/* ---------- 내가 낼 돈 (본인 것만, mydues) ---------- */
export function oweNow() {
  const my = D("mydues")[S.uid] || {}; const fee = Number(my.fee != null ? my.fee : S.settings.fee) || 0; const items = [];
  Object.entries(my.dues || {}).forEach(([k, v]) => { if (v !== "paid") items.push({ kind: "dues", key: k, label: duesLabel(k), amount: fee, sub: duesSub(k), due: dueDate(k) }); });
  (my.fines || []).forEach(f => { if (!f.paid) items.push({ kind: "fine", id: f.id, label: (f.reason || "벌금") + " 벌금", amount: Number(f.amount) || 0, sub: md(f.date || todayStr()) + (f.eventId && S.events[f.eventId] ? " " + evName(S.events[f.eventId]) : ""), due: f.date || "" }); });
  const total = items.reduce((n, x) => n + x.amount, 0);
  const dues = items.filter(x => x.kind === "dues").sort((a, b) => a.key.localeCompare(b.key))[0];
  return { items, total, label: dues ? dues.label : "벌금", dueAt: dues ? new Date(dueDate(dues.key) + "T09:00:00+09:00").toISOString() : "" };
}
function duesLabel(k) { return k.startsWith("m-") ? mLabel(k.slice(2)) + " 회비" : (S.events[k.slice(2)] ? md(S.events[k.slice(2)].date) + " 경기 회비" : "경기 회비"); }
function dueDate(k) { if (!k.startsWith("m-")) { const e = S.events[k.slice(2)]; return e ? e.date : todayStr(); } const dd = S.settings.dueDay === "말일" ? 28 : Number(S.settings.dueDay) || 5; return `${k.slice(2)}-${pad2(Math.min(28, dd))}`; }
function duesSub(k) { const due = dueDate(k); const left = Math.round((new Date(due + "T00:00:00+09:00") - new Date(todayStr() + "T00:00:00+09:00")) / 864e5); return left < 0 ? `${md(due)}까지였어요` : left === 0 ? "오늘까지" : `${md(due)}까지`; }

/* ===================== 4-1 홈: 내 사물함 ===================== */
function seasonPass(p) {
  const num = p.num || "";
  return `<div class="box blue" style="padding:0;gap:0;border-radius:20px;overflow:hidden">
    <div class="spread" style="padding:16px 16px 0"><span class="bc" style="font-size:14px;letter-spacing:2px">SEASON PASS ${todayStr().slice(0, 4)}</span><span style="font-size:12px">${sport() === "soccer" ? "축구" : "풋살"}</span></div>
    <div style="position:relative;height:204px;display:flex;align-items:center;justify-content:center">
      <span aria-hidden="true" style="position:absolute;left:18px;top:14px;z-index:1;width:62px;height:62px;border-radius:50%;border:2.5px solid ${C.ink};background:${C.bg};transform:rotate(-14deg);display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1" class="bc"><span style="font-size:12px;letter-spacing:1px">MY</span><span style="font-size:18px">PASS</span></span>
      <span aria-hidden="true" class="bc" style="position:absolute;right:12px;bottom:-22px;font-size:200px;line-height:1;color:rgba(18,17,16,.08)">${esc(num)}</span>
      <span style="position:relative;width:176px;height:176px;display:block"><svg width="176" height="176" viewBox="0 0 100 100" aria-hidden="true" style="display:block"><path d="M31 9 L43 5 Q50 13 57 5 L69 9 L93 27 L82 43 L72 37 L72 95 L28 95 L28 37 L18 43 L7 27 Z" fill="${C.ink}" stroke="${C.ink}" stroke-width="2.5" stroke-linejoin="round"></path><path d="M43 5 Q50 13 57 5" fill="none" stroke="${C.bg}" stroke-width="2.5"></path></svg><span aria-hidden="true" class="bc" style="position:absolute;left:0;right:0;top:44px;text-align:center;font-size:68px;line-height:1;color:${C.bg}">${esc(num)}</span></span>
    </div>
    <div style="position:relative;height:0;margin:0 22px;border-top:2px dashed rgba(18,17,16,.4)"><span style="position:absolute;left:-36px;top:-13px;width:24px;height:24px;border-radius:50%;background:${C.bg};border:2px solid ${C.ink}"></span><span style="position:absolute;right:-36px;top:-13px;width:24px;height:24px;border-radius:50%;background:${C.bg};border:2px solid ${C.ink}"></span></div>
    <div style="padding:16px 16px 16px;display:flex;align-items:flex-end;justify-content:space-between;gap:8px">
      <span style="display:flex;flex-direction:column;gap:4px;min-width:0"><span style="font-size:12px;font-weight:700">${num ? "등번호 " + esc(num) + "  " : ""}${ROLE[S.role] || "팀원"}</span><b class="bh" style="font-size:32px;line-height:1.1">${esc(p.name || nameOf(S.uid))}</b></span>
      <span class="bc" style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;font-size:16px;flex:none"><span style="background:${C.ink};color:${C.bg};border:2px solid ${C.ink};border-radius:6px;padding:0 8px">1선호 ${esc(p.pos1 || "미정")}</span><span style="background:${C.bg};border:2px solid ${C.ink};border-radius:6px;padding:0 8px">2선호 ${esc(p.pos2 || "없음")}</span></span>
    </div></div>`;
}
function mHome() {
  const p = myProfile() || {}; const n = (isAdmin() && viewMode() === "admin" ? afeed() : feed()).filter(x => x.t > readAt()).length;
  const req = (S.rsvp[S.uid] || {}).posReq; const pending = req && req.status === "req";
  const adm = isAdmin() && viewMode() === "admin";
  return `${hdBrand(bell(n))}<div class="body">
    ${seasonPass(p)}
    ${pending && !adm ? `<div class="box gray" style="flex-direction:row;align-items:center;gap:12px;padding:12px 12px 12px 16px;border-radius:14px"><span style="flex:1;display:flex;flex-direction:column;gap:4px"><b style="display:flex;align-items:center;gap:8px;font-size:14px"><span class="tag blue">확인 중</span>포지션 변경 요청</b><span style="font-size:12px">${esc([req.pos1, req.pos2].filter(Boolean).join(", "))}로 요청했어요. 운영진이 확인하면 카드가 바뀌어요.</span></span><button class="btn xs" data-act="mPosCancel">요청 취소</button></div>` : ""}
    <section class="lst" aria-label="내 설정">
      ${lrow({ href: "#/posreq", icon: IC.target, tone: "pink", title: adm ? "내 포지션 바꾸기" : "포지션 변경 요청", right: esc([p.pos1, p.pos2].filter(Boolean).join(", ") || "미정") })}
      ${lrow({ act: "switchTeam", icon: IC.swap, tone: "green", title: "팀 바꾸기", right: S.teams.length > 1 ? S.teams.length + "팀" : "새 팀 만들기" })}
      ${adm ? adminHomeRows() : ""}
      <div class="lr" style="cursor:default"><span class="ic" aria-hidden="true">${IC.user}</span><span class="tx"><b>카카오 계정</b><span>${esc(((S.session && S.session.user.user_metadata) || {}).nickname || "")}</span></span><span class="rt" style="display:inline-flex;align-items:center;gap:8px"><span style="width:8px;height:8px;border-radius:50%;background:${C.green}"></span>연결됨</span></div>
      ${lrow({ act: "mLeave", icon: IC.leave, tone: "clay", title: `${S.team.name}에서 나가기`, danger: true })}
      <div class="row" style="justify-content:space-between;padding:12px 0"><a class="lnk" href="../../privacy.html" style="padding-left:0">개인정보처리방침과 이용약관</a><button class="lnk" data-act="logout">로그아웃</button></div>
    </section>
  </div>${navBar("홈")}`;
}
// 4-1-4 알림
function mNotify() {
  const adm = isAdmin() && viewMode() === "admin"; const list = adm ? afeed() : feed(); const r = readAt(); const n = list.filter(x => x.t > r).length;
  const TONE = {};
  return `${hd("알림", "#/", { right: n ? `<button class="btn xs" data-act="readAll">모두 읽음</button>` : "" })}<div class="body" style="gap:0">
    ${list.length ? list.map(x => `<a href="${x.href}" style="text-decoration:none;display:flex;gap:12px;padding:16px 0;border-bottom:2px solid ${C.line}"><span style="flex:none;width:10px;height:10px;margin-top:6px;border-radius:50%;${x.t > r ? `background:${C.orange}` : `border:2px solid ${C.line}`}"></span><span style="flex:1;display:flex;flex-direction:column;gap:4px"><span style="display:flex;align-items:center;gap:8px;font-size:12px;color:${C.sub}"><span class="tag" style="background:${TONE[x.where] || C.gray}">${esc(x.where)}</span>${ago(x.t)}</span><b style="font-size:16px;line-height:1.5;${x.t > r ? "" : "font-weight:500"}">${esc(x.text)}</b></span></a>`).join("") : empty("알림이 없어요")}
    <span class="note" style="padding-top:16px">알림은 30일 동안 남아요.</span>
  </div>${navBar("홈")}`;
}
// 4-1-1 포지션 변경 요청 (운영진은 바로 바꾼다)
function mPosReq() {
  const p = myProfile() || {}; const adm = isAdmin() && viewMode() === "admin";
  const f = S.form; const slot = f.slot || 1; const v1 = f.p1 !== undefined ? f.p1 : p.pos1 || "", v2 = f.p2 !== undefined ? f.p2 : p.pos2 || "";
  const changed = v1 !== (p.pos1 || "") || v2 !== (p.pos2 || "");
  const pos = POS[sport()];
  const slotBtn = (k, label, val) => `<button type="button" class="box ${slot === k ? "blue" : ""}" data-act="mPosSlot" data-k="${k}" aria-pressed="${slot === k}" style="align-items:flex-start;gap:4px;${slot === k ? `box-shadow:4px 4px 0 ${C.ink};transform:rotate(-2deg)` : ""}"><span style="font-size:12px;font-weight:700">${label}</span><b class="bc" style="font-size:32px;line-height:1.1;font-family:'Barlow Condensed','IBM Plex Sans KR',sans-serif">${esc(val || "없음")}</b></button>`;
  return `${hd(adm ? "내 포지션 바꾸기" : "포지션 변경 요청", "#/")}<div class="body">
    <span style="font-size:14px;line-height:1.6">지금은 1선호 <b>${esc(p.pos1 || "미정")}</b>, 2선호 <b>${esc(p.pos2 || "없음")}</b>예요.<br>${adm ? "바꿀 칸을 고르고 포지션을 눌러요. 운영진은 바로 바뀌어요." : "바꿀 칸을 고르고 포지션을 눌러요. 운영진이 확인하면 바뀌어요."}</span>
    <div class="grid2" style="gap:12px;padding:4px 4px">${slotBtn(1, "1선호", v1)}${slotBtn(2, "2선호", v2)}</div>
    <div class="${sport() === "soccer" ? "grid4" : "grid2"}">${pos.map(x => { const on = (slot === 1 ? v1 : v2) === x; const other = (slot === 1 ? v2 : v1) === x; return `<button type="button" class="chip${on ? " on" : ""}" data-act="mPosPick" data-v="${esc(x)}" aria-pressed="${on}" style="height:48px;font-family:'Barlow Condensed','IBM Plex Sans KR',sans-serif;font-size:16px${other ? `;background:${C.gray}` : ""}">${esc(x)}${other ? `<span style="font-size:12px;font-family:'IBM Plex Sans KR'">${slot === 1 ? "2선호" : "1선호"}</span>` : ""}</button>`; }).join("")}</div>
    ${slot === 2 ? `<button class="lnk" data-act="mPosPick" data-v="" style="align-self:flex-start">2선호 비우기</button>` : ""}
  </div><div class="cta"><button class="btn o block" data-act="mPosSend" ${changed && v1 ? "" : "disabled"}>${adm ? "포지션 바꾸기" : changed ? "요청 보내기" : "바꿀 포지션을 골라요"}</button></div>`;
}

/* ===================== 4-2 일정: 티켓 ===================== */
function stubOf(e) {
  const vs = voteState(e);
  if (vs === "soon") { const t = Date.parse(e.openAt); return `<span class="go" style="font-size:12px;color:${C.sub};gap:4px"><b class="bc" style="font-size:20px;color:${C.ink}">${md(kst(t).toISOString().slice(0, 10))}</b>투표 시작</span>`; }
  if (vs === "closed") return `<span class="go" style="font-size:12px;color:${C.sub}"><b style="color:${C.ink}">마감</b></span>`;
  return `<span class="go">투표<br>하기${IC.arrow}</span>`;
}
export function waitNo(e, u) { const a = att(e); const i = a.wait.findIndex(x => x.uid === u); return i >= 0 ? i + 1 : 0; }
export function ticket(e, opts = {}) {
  const a = att(e); const v = myVote(e); const w = waitNo(e, S.uid); const torn = !!v.s;
  const href = opts.href || "#/event/" + e.id; const vsx = voteState(e);
  const count = a.cap ? `${a.in}/${a.cap}` : `${a.in}명`;
  const an = MU.anim && MU.anim.id === e.id && Date.now() - MU.anim.t0 < 1600 ? MU.anim : null; const el = an ? (Date.now() - an.t0) / 1000 : 0;
  const fly = an && an.tear && torn ? `<span class="s fly" aria-hidden="true" style="animation-delay:${(0.12 - el).toFixed(3)}s"></span>` : "";
  const stamp = torn ? `${fly}<a class="st${an ? " pop" : ""}${v.s === "no" && !w ? " no" : ""}" href="${href}" aria-label="다시 투표하기"${an ? ` style="animation-delay:${((an.tear ? 0.62 : 0.05) - el).toFixed(3)}s"` : ""}><b>${w ? "대기" : VS[v.s]}</b><span>${w ? w + "번" : v.s === "late" && v.q ? v.q + "Q부터" : "TICKET"}</span></a>` : "";
  return `<div class="tk${torn ? " torn" : ""}${opts.near ? " near" : ""}" data-tk="${esc(e.id)}">
    <a class="m" href="${href}">
      <span class="spread" style="min-height:24px"><span class="cn" style="gap:8px"><b class="bc" style="font-size:20px">${md(e.date)} ${wd(e.date)}</b><span class="kd">${esc(e.type === "match" && !e.opponent ? "상대 미정" : kindOf(e))}</span></span>${torn ? "" : `<span class="dd">${dday(e)}</span>`}</span>
      <b class="bc" style="font-size:32px;line-height:1">${esc(e.time || "")}${e.end ? " ~ " + esc(e.end) : ""}</b>
      <span style="font-size:12px">${esc(e.place || "장소 미정")}</span>
      <span style="font-size:12px">참가 <b class="bc" style="font-size:20px">${count}</b>${a.wait.length ? `  대기 ${a.wait.length}` : ""}</span>
    </a>
    ${stamp}
    ${torn ? "" : `<a class="s${vsx === "open" ? "" : " wait"}" href="${href}" aria-label="${esc(md(e.date) + " " + kindOf(e))} 투표하기">${stubOf(e)}</a>`}
  </div>`;
}
function monthSpan(list) { if (!list.length) return Number(todayStr().slice(5, 7)) + ""; const a = Number(list[0].date.slice(5, 7)), b = Number(list[list.length - 1].date.slice(5, 7)); return a === b ? String(a) : `${a} – ${b}`; }
function mSchedule() {
  const list = upcoming().filter(e => !started(e) || isPlay(e) && Date.now() - evStart(e) < 3 * 3600e3);
  const pending = list.filter(e => voteState(e) === "open" && !myVote(e).s).length;
  const adm = isAdmin() && viewMode() === "admin";
  const nearId = (list.find(e => voteState(e) === "open") || {}).id;
  return `${hdTab("일정", adm ? mngBtn("aSchedSheet") : "")}<div class="body" style="gap:16px">
    <div class="mon"><b>${monthSpan(list)}</b><span style="font-size:12px;color:${C.sub}">${list.length ? pending ? "투표할 일정 " + pending + "개" : "모두 투표했어요" : ""}</span></div>
    ${list.length ? list.map(e => ticket(e, { near: e.id === nearId })).join("") : empty("다가오는 일정이 없어요", adm ? "위쪽 관리에서 일정을 올려요." : "운영진이 일정을 올리면 여기에 보여요.")}
  </div>${navBar("일정")}`;
}

/* ===================== 4-2-1 일정 상세: 심판 카드 ===================== */
export function bigTicket(e, a) {
  const vs = voteState(e); const label = e.type === "match" ? "MATCH  " + (e.opponent ? "vs " + e.opponent : "상대 미정") : e.type === "scrim" ? "SCRIM  내전" : "TRAINING  훈련";
  const full = a.cap && a.in >= a.cap; const left = a.cap ? a.cap - a.in : 0;
  const fa = fineAt(e); const ca = closeAt(e);
  const lines = [];
  if (vs === "soon") lines.push(`<span style="font-size:12px">투표는 ${whenText(Date.parse(e.openAt))}부터 열려요</span>`);
  if (vs === "open") {
    lines.push(`<span style="font-size:12px">투표 마감 ${whenText(ca)}</span>`);
    if (fa < ca) lines.push(`<span style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700"><span class="tag ink">벌금</span>${whenText(fa)}부터 불참으로 바꾸면 벌금</span>`);
  }
  if (vs === "closed") lines.push(`<span style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700"><span class="tag ink">마감</span>${whenText(ca)}에 투표가 끝났어요</span>`);
  return `<div class="bigt${e.type === "match" ? "" : " gray"}">
    <div class="top">
      <div class="spread"><span class="bc kick" style="font-size:14px;letter-spacing:2px;white-space:pre">${esc(label)}</span>${dday(e) ? `<span class="bc" style="font-size:20px;background:${C.ink};color:${C.bg};border-radius:8px;padding:4px 8px;line-height:1">${dday(e)}</span>` : ""}</div>
      <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><span class="hh">${esc(e.time || "--:--")}</span>${e.end ? `<span class="bc" style="font-size:24px;font-weight:600">~ ${esc(e.end)}</span>` : ""}</div>
      <b style="font-size:16px;margin-top:6px">${md(e.date)} ${wd(e.date)}요일</b>
      <span style="font-size:14px">${esc(e.place || "장소 미정")}</span>
      ${e.memo ? `<span style="font-size:12px;white-space:pre-wrap;line-height:1.6;border-top:2px dashed rgba(18,17,16,.35);padding-top:8px;margin-top:4px">${esc(e.memo)}</span>` : ""}
    </div>
    <div class="cut"></div>
    <div class="bot">
      <div class="spread bc" style="align-items:baseline;font-size:16px"><span>참석 <b style="font-size:24px">${a.in}</b>${a.cap ? " / " + a.cap : "명"}</span><span style="font-family:'IBM Plex Sans KR',sans-serif;font-size:12px;font-weight:500">${a.cap ? full ? `정원이 다 찼어요${a.wait.length ? ", 대기 " + a.wait.length + "명" : ""}` : `${left}자리 남았어요` : ""}</span></div>
      ${a.cap ? `<span class="bar"><i style="width:${Math.min(100, Math.round(a.in * 100 / a.cap))}%"></i></span>` : ""}
      ${lines.join("")}
    </div></div>`;
}
function voteNote(e, a, v, vs, w, full, seat) {
  const cr = (S.settings.rules || []).find(r => ruleKind(r) === "cancel"); const amt = cr ? Number(cr.amount) || 0 : 0;
  if (vs === "soon") return "투표가 열리면 카드를 고를 수 있어요.";
  if (vs === "closed") return seat ? `투표가 마감됐어요. 지금 불참으로 바꾸면${amt ? " 벌금 " + won(amt) + "이 생기고" : ""} 사유를 남겨요.` : v.lateCancel ? "마감 뒤에 불참으로 바꿨어요." : v.s ? `투표가 마감됐어요. 내 응답은 ${w ? "대기 " + w + "번" : VS[v.s]}이에요.` : "투표가 마감됐어요.";
  if (w) return (v.s === "late" && v.q ? v.q + "쿼터부터 뛸 수 있다고 적어 뒀어요. " : "") + "앞에서 불참이 나오면 순서대로 참석이 되고, 알림이 가요.";
  const fn = fineNow(e);
  if (v.s === "no") return (v.cancelAt ? "불참으로 바꾸었어요. " : "불참이에요. ") + (full ? `정원이 다 차서 다시 참석을 누르면 대기 ${a.wait.length + 1}번이 돼요.` : "다시 참석을 누르면 바로 참석이 돼요.");
  if (v.s === "yes" || v.s === "late") {
    const q = v.s === "late" ? (v.q ? v.q + "쿼터부터 뛸 수 있어요. " : "몇 쿼터부터 올 수 있는지 골라 주세요. ") : "";
    return q + (fn ? `불참 벌금 기준 시각이 지났어요. 지금 불참으로 바꾸면${amt ? " 벌금 " + won(amt) + "이 생기고" : ""} 사유를 남겨요.` : "마감 전까지 바꿀 수 있어요.");
  }
  return full ? `정원이 다 찼어요. 지금 참석${noLate() ? "" : "이나 늦참"}을 누르면 대기 ${a.wait.length + 1}번이 돼요.` : `아직 카드를 고르지 않았어요. ${fineText(e)}`;
}
function mercRow(e, vs) {
  const mine = guestReqs(e).filter(g => g.u === S.uid && g.status !== "no" && g.status !== "cancel");
  const open = !!e.guestOpen && vs === "open" && e.type !== "training";
  if (mine.length) return mine.map(g => `<div class="box" style="flex-direction:row;align-items:center;gap:12px;min-height:60px;padding:8px 8px 8px 16px;border-radius:12px"><span class="ic" style="width:34px;height:34px;border-radius:10px" aria-hidden="true">${IC.check}</span><span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px"><b style="font-size:16px">${esc(g.name)} ${g.status === "ok" ? "용병 수락됨" : "신청함, 확인 중"}</b><span style="font-size:12px;color:${C.sub}">${g.status === "ok" ? "참석 명단에 들어갔어요" : "운영진이 확인하면 알림이 와요"}</span></span>${g.status === "ok" ? "" : `<button class="lnk" data-act="mGuestCancel" data-k="${esc(g.k)}">취소</button>`}</div>`).join("") + (open ? `<button class="lnk" data-act="mGuest" data-eid="${esc(e.id)}" style="align-self:flex-start">+ 한 명 더 신청하기</button>` : "");
  if (open) return `<button type="button" data-act="mGuest" data-eid="${esc(e.id)}" style="display:flex;align-items:center;gap:12px;min-height:60px;padding:8px 16px;border:2px solid ${C.ink};border-radius:12px;background:${C.white};box-shadow:4px 4px 0 ${C.ink};text-align:left"><span class="ic" style="width:34px;height:34px;border-radius:10px" aria-hidden="true">${IC.merc}</span><span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px"><b style="font-size:16px">용병 신청하기</b><span style="font-size:12px">운영진이 이 경기 용병을 받고 있어요</span></span>${IC.chev}</button>`;
  if (e.type === "training") return "";
  return `<div aria-disabled="true" style="display:flex;align-items:center;gap:12px;min-height:58px;padding:8px 16px;border:2px dashed ${C.ink};border-radius:12px;color:${C.sub}"><span aria-hidden="true" style="flex:none;width:34px;height:34px;border:2px dashed ${C.ink};border-radius:10px;display:flex;align-items:center;justify-content:center;opacity:.6">${IC.merc}</span><span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px"><b style="font-size:16px">용병 신청하기</b><span style="font-size:12px">${vs === "closed" || vs === "done" ? "투표가 끝나서 용병 신청도 닫혔어요." : "운영진이 이 경기 용병을 받을 때 열려요."}</span></span><span class="tag thin">닫힘</span></div>`;
}
export function strip(a) {
  const sw = (c, extra = "") => `<i style="background:${c};${extra}"></i>`;
  const cell = (n, l, s) => `<span><b>${n}</b><em>${s}${l}</em></span>`;
  return `<div class="strip">${cell(a.yes.length, "참석", sw(C.green))}${noLate() ? "" : cell(a.late.length, "늦참", sw(C.orange))}${cell(a.wait.length, "대기", sw(C.teal, `border:2px solid ${C.ink};box-sizing:border-box`))}${cell(a.no.length, "불참", sw(C.clay))}${cell(a.none.length, "미응답", sw("transparent", `border:2px solid ${C.ink};box-sizing:border-box`))}</div>`.replace('class="strip"', `class="strip" style="grid-template-columns:repeat(${noLate() ? 4 : 5},minmax(0,1fr))"`);
}
// 라인업 (팀원은 내 자리와 쉬는 쿼터만)
function myLineup(e) {
  const ready = (e.lineupAt || e.lineupOld) && e.lineup && Object.keys(e.lineup).length;
  const side = e.type === "scrim" ? sideOf(e, S.uid) || "A" : "main";
  const L = ready ? (e.lineup[side] || Object.values(e.lineup)[0]) : null;
  const fk = L && (L.fkey || "");
  const head = `<div class="sh"><b>라인업</b>${fk ? `<span class="bc" style="font-size:16px;border:2px solid ${C.ink};border-radius:6px;padding:4px 8px">${esc(fk)}</span>` : ""}</div>`;
  if (!L) return `<section class="sec" aria-label="라인업">${head}<div style="position:relative;height:220px;border-radius:16px;border:2px dashed ${C.ink};display:flex;align-items:center;justify-content:center"><span aria-hidden="true" style="position:absolute;left:10px;right:10px;top:50%;border-top:2px dashed ${C.line}"></span><span aria-hidden="true" style="position:absolute;left:50%;top:50%;width:60px;height:60px;margin:-30px 0 0 -30px;border:2px dashed ${C.line};border-radius:50%"></span><span class="stamp" style="position:relative">라인업 준비 중</span></div><span class="note">운영진이 라인업을 다 짜서 알리면 내 출전 쿼터와 자리가 여기에 나와요.</span></section>`;
  const qn = QN[sport()]; const lq = Math.min(MU.lq || 1, qn);
  const mine = k => { const row = (L.q || {})[k] || {}; const i = Object.keys(row).find(j => row[j] === S.uid); return i == null ? null : Number(i); };
  const played = Array.from({ length: qn }, (_, i) => i + 1).filter(k => mine(k) != null);
  const rest = Array.from({ length: qn }, (_, i) => i + 1).filter(k => mine(k) == null);
  const me = mine(lq); const xy = spotXY(L.formation, L.fkey);
  const cards = Array.from({ length: qn }, (_, i) => i + 1).map(k => { const p = mine(k); const on = k === lq; return `<button type="button" data-act="mLq" data-q="${k}" aria-pressed="${on}" style="height:56px;border:2px ${p != null ? "solid" : "dashed"} ${C.ink};border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;background:${on ? `${C.ink};color:${C.bg}` : p != null ? C.white : C.bg};transition:transform .25s cubic-bezier(.3,1.5,.6,1);${on ? `transform:rotate(-6deg) translateY(-3px);box-shadow:4px 4px 0 ${C.ink}` : ""}"><b class="bc" style="font-size:18px;line-height:1">${k}Q</b><span style="font-size:12px;font-weight:700">${p != null ? esc(L.formation[p]) : "휴식"}</span></button>`; }).join("");
  return `<section class="sec" aria-label="라인업">${head}
    <div class="spread" style="align-items:baseline"><span class="cn"><span style="font-size:14px;font-weight:700">내 출전</span><b class="bc" style="font-size:34px;line-height:1">${played.length}</b><span class="bc" style="font-weight:600;font-size:18px;color:${C.sub}">/ ${qn}Q</span></span><span style="font-size:12px">${rest.length ? rest.join(", ") + "쿼터는 쉬어요" : "모든 쿼터를 뛰어요"}</span></div>
    <div style="display:grid;grid-template-columns:repeat(${qn > 4 ? 4 : qn},minmax(0,1fr));gap:8px;padding:4px 4px 4px">${cards}</div>
    <div class="pitch"><span class="l" style="left:10px;right:10px;top:10px;bottom:10px;border-radius:4px"></span><span class="l" style="left:10px;right:10px;top:50%;height:0;border-width:2px 0 0"></span><span class="l" style="left:50%;top:50%;width:60px;height:60px;margin:-30px 0 0 -30px;border-radius:50%"></span><span class="l" style="left:50%;top:10px;width:140px;height:46px;margin-left:-70px;border-top:0"></span><span class="l" style="left:50%;bottom:10px;width:140px;height:46px;margin-left:-70px;border-bottom:0"></span>
      ${(L.formation || []).map((pos, i) => { const p = xy[i] || { x: 50, y: 50 }; const isMe = i === me; return `<span class="spot${isMe ? " me" : ""}" style="left:${p.x}%;top:${100 - p.y}%;opacity:${me == null ? .3 : 1};z-index:${isMe ? 2 : 1}"><span class="d">${isMe ? "나" : ""}</span><span class="p">${esc(pos)}</span></span>`; }).join("")}
      ${me == null ? `<span class="stamp" style="position:absolute;z-index:5;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-4deg);font-family:'IBM Plex Sans KR';font-size:16px;font-weight:700;white-space:nowrap;padding:8px 16px">이번 쿼터는 쉬어요</span>` : ""}
    </div>
    <span class="note">${me != null ? lq + "쿼터에는 " + esc(L.formation[me]) + " 자리예요." : lq + "쿼터에는 벤치에서 쉬어요."} 다른 팀원의 자리와 쿼터 수는 운영진 화면에서만 보여요.</span>
  </section>`;
}
function mEvent(id) {
  const e = S.events[id]; if (!e) return `${hd("일정", "#/schedule")}<div class="body">${empty("지워진 일정이에요")}</div>${navBar("일정")}`;
  if (started(e) && isPlay(e) && Date.now() - evStart(e) > 3 * 3600e3) return mGame(id);
  const a = att(e); const v = myVote(e); const vs = voteState(e); const w = waitNo(e, S.uid);
  const seat = (v.s === "yes" || v.s === "late") && !w; const full = a.cap && a.in >= a.cap;
  const asWait = !seat && (w || full);
  const adm = isAdmin() && viewMode() === "admin";
  const opts = noLate() ? [["yes", "참석"], ["no", "불참"]] : [["yes", "참석"], ["late", "늦참"], ["no", "불참"]];
  const can = id => vs === "open" || (vs === "closed" && id === "no" && seat);
  const cards = opts.map(([k, l]) => { const on = v.s === k; const lab = k !== "no" && asWait ? (k === "yes" ? "대기" : "늦참 대기") : l; return `<button type="button" class="qc${on ? " on " + (k !== "no" && w ? "wait" : k) : ""}" data-act="mVote" data-eid="${esc(e.id)}" data-v="${k}" aria-pressed="${on}" ${can(k) ? "" : "disabled"} style="${can(k) || on ? "" : "opacity:.45"}">${lab}</button>`; }).join("");
  const qn = QN[sport()];
  const quarters = v.s === "late" && vs === "open" ? `<div style="display:flex;align-items:center;gap:8px"><span style="flex:none;font-size:12px;font-weight:700">몇 쿼터부터?</span><div style="flex:1;display:grid;grid-template-columns:repeat(${qn - 1},minmax(0,1fr));gap:8px">${Array.from({ length: qn - 1 }, (_, i) => i + 2).map(q => `<button type="button" class="qq${Number(v.q) === q ? " on" : ""}" data-act="mLateQ" data-eid="${esc(e.id)}" data-q="${q}" aria-pressed="${Number(v.q) === q}">${q}Q</button>`).join("")}</div></div>` : "";
  const waitBox = w ? `<div role="status" class="box teal" style="flex-direction:row;align-items:center;gap:16px;border-radius:12px;padding:8px 16px"><span style="flex:none;display:flex;flex-direction:column;align-items:center;line-height:1;gap:4px"><span style="font-size:12px;font-weight:700">대기</span><b class="bc" style="font-size:36px;line-height:.9">${w}</b><span style="font-size:12px;font-weight:700">번</span></span><span style="display:flex;flex-direction:column;gap:4px"><b style="font-size:16px">아직 참석이 아니라 대기예요</b><span style="font-size:12px;line-height:1.5">정원 ${a.cap}명이 다 차서 대기 ${w}번으로 기다리고 있어요.</span></span></div>` : "";
  return `${hdBrand(adm ? `<a class="mng" href="#/manage/${esc(e.id)}">${IC.sliders}관리</a>` : "", "#/schedule")}<div class="body tight">
    ${bigTicket(e, a)}
    ${myProfile() ? `<section aria-label="내 참석" style="display:flex;flex-direction:column;gap:8px;margin-top:6px">
      <div style="display:grid;grid-template-columns:repeat(${opts.length},minmax(0,1fr));gap:12px;padding:8px 4px 4px">${cards}</div>
      ${quarters}${waitBox}
      <span class="note">${voteNote(e, a, v, vs, w, full, seat)}</span>
    </section>` : `<div class="box gray"><b>선수 등록을 마치면 투표할 수 있어요</b><a class="btn sm" href="#/me">선수 등록</a></div>`}
    ${mercRow(e, vs)}
    <div style="display:flex;flex-direction:column;gap:16px;padding-top:8px">${strip(a)}${isPlay(e) ? myLineup(e) : ""}</div>
  </div>${navBar("일정")}`;
}
// 불참 확인 창: 자리를 대기 1번에게 넘기는 경우
function giveSeatDlg(e, a, nextVote) {
  const v = myVote(e);
  dlg(`<h3>${VS[v.s]}에서 불참으로 바꿀까요?</h3><span style="font-size:14px;line-height:1.6">정원 ${a.cap}명이 다 찼고 대기 ${a.wait.length}명이 있어요. 지금 바꾸면 내 자리는 대기 1번에게 넘어가고, 다시 참석을 누르면 대기 ${a.wait.length}번이 돼요.</span>
    <div class="grid2"><button class="btn" data-act="closeSheet">${VS[v.s]} 그대로 두기</button><button class="btn c" id="dOk">불참으로 바꾸기</button></div>`);
  $("#dOk").onclick = () => { closeSheet(); const card = document.querySelector(`.qc[data-v="no"]`); if (card) pressCard(card, "no"); saveVote(e, nextVote, { back: true }); };
}
// 벌금 창: 벌금 기준 시각이 지났거나 마감 뒤에 참석, 늦참에서 불참으로
function fineDlg(e) {
  const v = myVote(e); const vs = voteState(e); const cr = (S.settings.rules || []).find(r => ruleKind(r) === "cancel"); const amt = cr ? Number(cr.amount) || 0 : 0;
  const closed = vs === "closed"; const fa = fineAt(e); const ca = closeAt(e);
  dlg(`<h3>${closed ? "마감 뒤에 불참으로 바꿀까요?" : "벌금 기준이 지났어요. 불참으로 바꿀까요?"}</h3>
    <span style="font-size:14px;line-height:1.6">${closed ? `투표는 ${whenText(ca)}에 끝났어요.` : `팀이 정한 불참 벌금 기준(${whenText(fa)})이 지났어요. 투표는 아직 열려 있지만`} ${amt ? `지금 불참으로 바꾸면 팀 수칙에 따라 벌금 ${won(amt)}이 생기고,` : "지금 바꾸면"} 내 자리는 ${att(e).wait.length ? "대기 1번에게 넘어가요" : "비어요"}.</span>
    <label class="fld"><span class="lb">사유</span><textarea class="inp" id="fReason" maxlength="80" style="min-height:84px" placeholder="예: 갑자기 출근하게 됐어요"></textarea></label>
    ${amt ? `<label class="row" style="gap:8px;min-height:44px;cursor:pointer"><input type="checkbox" id="fAgree" style="width:22px;height:22px;accent-color:${C.ink}"><b style="font-size:14px">벌금 ${won(amt)}에 동의해요</b></label>` : ""}
    <div class="grid2"><button class="btn" data-act="closeSheet">${VS[v.s] || "참석"} 그대로 두기</button><button class="btn c" id="fOk">${amt ? "벌금 내고 불참하기" : "불참하기"}</button></div>`);
  $("#fOk").onclick = async ev => {
    const reason = $("#fReason").value.trim(); if (!reason) { toast("사유를 적어 주세요"); return; }
    if (amt && !($("#fAgree") || {}).checked) { toast("벌금에 동의해야 바꿀 수 있어요"); return; }
    ev.target.disabled = true;
    try { const r = await lateCancel(e, reason, !!amt); closeSheet(); MU.anim = { id: e.id, tear: false, t0: Date.now() }; location.hash = "#/schedule"; render(); toast(r && r.amount ? `불참으로 바꿨어요. 벌금 ${won(r.amount)}이 매겨졌어요` : "불참으로 바꿨어요"); } catch (err) { ev.target.disabled = false; fail(err); }
  };
}
function guestSheet(eid) {
  const e = S.events[eid]; if (!e) return; MU.gpos = [];
  const pos = POS[sport()];
  const draw = () => {
    sheet(`<h3>용병 신청</h3><span class="note">${esc(md(e.date) + " " + wd(e.date) + " " + (e.time || "") + " " + evName(e))}에 같이 뛸 사람을 적어요. 운영진이 수락하면 정원에 들어가고, 정원이 다 찼으면 대기 뒤에 서요.</span>
      <label class="fld"><span class="lb">용병 이름</span><input class="inp" id="gName" maxlength="20" placeholder="이름" value="${esc(MU.gname || "")}"></label>
      <div class="fld"><span class="lb">포지션 <span style="font-weight:500;color:${C.sub}">2개까지</span></span><div class="${sport() === "soccer" ? "grid5" : "grid4"}">${pos.map(p => `<button type="button" class="chip${MU.gpos.includes(p) ? " on" : ""}" data-gp="${esc(p)}" style="height:40px;font-family:'Barlow Condensed','IBM Plex Sans KR';font-size:16px;padding:0 4px${MU.gpos.includes(p) ? `;background:${C.pink};color:${C.ink};box-shadow:2px 2px 0 ${C.ink}` : ""}">${esc(p)}</button>`).join("")}</div><span class="note">${MU.gpos.length ? esc(MU.gpos.join(" / ")) : "골라 주세요"}</span></div>
      <label class="fld"><span class="lb">한마디 <span style="font-weight:500;color:${C.sub}">안 써도 돼요</span></span><textarea class="inp" id="gNote" maxlength="60" style="min-height:72px" placeholder="예: 회사 동료예요">${esc(MU.gnote || "")}</textarea></label>
      <button class="btn o block" id="gSend" ${MU.gpos.length ? "" : "disabled"}>신청 보내기</button><button class="btn block" data-act="closeSheet">닫기</button>`);
    document.querySelectorAll("[data-gp]").forEach(b => b.onclick = () => { MU.gname = $("#gName").value; MU.gnote = $("#gNote").value; const p = b.dataset.gp; const i = MU.gpos.indexOf(p); if (i >= 0) MU.gpos.splice(i, 1); else { MU.gpos.push(p); if (MU.gpos.length > 2) MU.gpos.shift(); } draw(); });
    $("#gSend").onclick = async ev => {
      const name = $("#gName").value.trim(); if (!name) { toast("이름을 적어 주세요"); return; } if (!MU.gpos.length) return; ev.target.disabled = true;
      try { await patchDoc("guestreq", S.uid, { items: { [uid36("g")]: { eid, name: name.slice(0, 20), pos: MU.gpos[0], pos2: MU.gpos[1] || "", rel: $("#gNote").value.trim().slice(0, 60), at: new Date().toISOString(), status: "req" } } }); MU.gname = ""; MU.gnote = ""; closeSheet(); render(); toast("용병 신청을 보냈어요. 운영진이 수락하면 알려 드려요"); } catch (err) { ev.target.disabled = false; fail(err); }
    };
  };
  draw();
}

/* ===================== 4-3 기록: 시즌 티켓북 ===================== */
function recTicket(e) {
  const u = S.uid; const came = cameTo(e, u); const win = momClosed(e) ? momWinners(e) : []; const v = (((S.rsvp[u] || {}).ev || {})[e.id]) || {};
  const late = (e.check || {})[u] === "late"; const mom = win.includes(u);
  const bg = C.white;
  const stBg = mom ? C.sec2 : C.bg;
  const me = mom ? "MOM" : came ? (late ? "지각" : "참석") : "불참"; const meSub = mom ? "ME" : came ? "ME" : v.s === "no" ? "미리" : "";
  return `<a href="#/game/${esc(e.id)}" aria-label="${esc(md(e.date) + " " + vsText(e))} 기록 보기" style="position:relative;display:flex;height:112px;text-decoration:none">
    <span style="flex:1;min-width:0;display:flex;align-items:center;gap:12px;background:${bg};border:2px solid ${C.ink};border-radius:12px;box-shadow:4px 4px 0 ${C.ink};padding:12px 16px">
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:4px"><span class="cn"><b class="bc" style="font-size:18px">${md(e.date)} ${wd(e.date)}</b><span style="font-size:12px;font-weight:700">${kindOf(e)}</span></span><b style="font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(vsText(e))}</b>${win.length ? `<span class="tag" style="align-self:flex-start;background:${C.sec3}">MOM ${esc(win.map(nameOf).join(", "))}</span>` : momOpen(e) ? `<span class="tag" style="align-self:flex-start;background:${C.yel}">MOM 투표하기</span>` : `<span style="font-size:12px;color:${C.sub}">${e.score ? "" : isPlay(e) ? "결과를 기다려요" : ""}</span>`}</span>
      <span style="flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:4px;margin-right:62px">${e.score ? `<b class="bc" style="font-size:38px;line-height:1;letter-spacing:-1px">${esc(scoreText(e))}</b><span style="font-size:12px;font-weight:700;background:${C.ink};color:${C.bg};border-radius:4px;padding:0 8px">${resultWord(e)}</span>` : ""}</span>
    </span>
    <span style="position:absolute;top:50%;right:14px;margin-top:-28px;width:56px;height:56px;border-radius:50%;border:2.5px ${!came && !mom ? "dashed" : "solid"} ${C.ink};background:${stBg};transform:rotate(-12deg);display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1"><b style="font-size:12px">${me}</b><span class="bc" style="font-size:12px">${meSub}</span></span>
  </a>`;
}
function mRecords() {
  const y = yearOf(); const list = seasonEvents(y).filter(isPlay);
  const ys = [...new Set(past().map(e => e.date.slice(0, 4)).concat([todayStr().slice(0, 4)]))].sort().reverse();
  return `${hdTab("기록", ys.length > 1 ? `<button class="tag bc" data-act="mSeasonPick" style="font-size:16px;height:32px;background:${C.bg};margin-right:12px">${y} 시즌 ▾</button>` : `<span class="tag bc" style="font-size:16px;margin-right:12px">${y} 시즌</span>`)}<div class="body" style="gap:12px">
    <a href="#/season" style="display:flex;align-items:center;gap:12px;min-height:64px;padding:0 16px;border:2px solid ${C.ink};border-radius:12px;background:${C.sec2};color:${C.ink};box-shadow:4px 4px 0 ${C.ink};text-decoration:none"><span style="flex:1;display:flex;flex-direction:column;gap:4px"><b class="bc" style="font-size:20px;letter-spacing:1px">${y} SEASON</b><span style="font-size:12px">팀 성적과 ${isAdmin() && viewMode() === "admin" ? "팀원 출석" : "내 출석"}</span></span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${C.ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"></path></svg></a>
    ${list.length ? list.map(recTicket).join("") : empty("아직 지난 경기가 없어요", "경기가 끝나면 티켓이 여기에 모여요.")}
  </div>${navBar("기록")}`;
}
export function teamRecord(evs) { let w = 0, d = 0, l = 0, gf = 0, ga = 0; evs.filter(e => e.type === "match" && e.score).forEach(e => { const a = +e.score.us, b = +e.score.them; gf += a; ga += b; if (a > b) w++; else if (a < b) l++; else d++; }); return { w, d, l, gf, ga }; }
function mSeason() {
  const y = yearOf(); const evs = seasonEvents(y).filter(isPlay); const r = teamRecord(evs); const st = myStats(S.uid, y);
  const punches = evs.slice().reverse().map(e => { const c = cameTo(e, S.uid); const late = (e.check || {})[S.uid] === "late"; return `<span style="display:flex;flex-direction:column;align-items:center;gap:4px"><span style="width:20px;height:20px;border-radius:50%;border:2px solid ${C.ink};background:${c ? (late ? C.orange : C.ink) : C.bg}"></span><span class="bc" style="font-size:12px;font-weight:600">${md(e.date)}</span></span>`; }).join("");
  const cnt = (n, l, c, ex = "") => `<span style="display:flex;flex-direction:column;gap:4px"><b class="bc" style="font-size:24px;line-height:1">${n}</b><span style="display:inline-flex;align-items:center;gap:4px;font-size:12px"><span style="width:9px;height:9px;background:${c};${ex}"></span>${l}</span></span>`;
  return `${hd(y + " 시즌", "#/records", { sub: "내전은 팀 성적에서 빼고 셌어요" })}<div class="body" style="gap:16px">
    <div class="spread" style="border-top:2px solid ${C.ink};border-bottom:2px solid ${C.line};padding:12px 0"><span style="font-size:12px;font-weight:700">팀 성적</span><span class="bc" style="display:flex;align-items:baseline;gap:8px"><span style="font-size:32px">${r.w}<small style="font-size:16px">승</small> ${r.d}<small style="font-size:16px">무</small> ${r.l}<small style="font-size:16px">패</small></span><span style="font-size:16px;color:${C.sub}">득 ${r.gf}  실 ${r.ga}</span></span></div>
    <div class="box" style="border-radius:12px;gap:12px"><span class="spread" style="align-items:baseline"><b style="font-size:16px">내 출석</b><span style="font-size:12px">${st.n}번 중 <b class="bc" style="font-size:20px">${st.mine}</b>번 왔어요</span></span>
      ${evs.length ? `<div style="display:grid;grid-template-columns:repeat(${Math.min(8, Math.max(evs.length, 1))},minmax(0,1fr));gap:4px;border-top:2px dashed rgba(18,17,16,.35);padding-top:12px">${punches}</div>` : ""}
      <div class="grid4" style="border-top:1px solid rgba(18,17,16,.2);padding-top:8px;gap:0">${cnt(st.mine - st.late, "정시", C.ink)}${cnt(st.late, "지각", C.orange)}${cnt(st.miss, "불참", C.bg, `border:2px solid ${C.ink};box-sizing:border-box`)}${cnt(st.mom, "MOM", C.pink)}</div></div>
    <section style="display:flex;flex-direction:column" aria-label="경기별 내 출석"><b style="font-size:16px;border-bottom:2px solid ${C.ink};padding-bottom:8px">경기별 내 출석</b>
      ${evs.length ? evs.map(e => { const c = cameTo(e, S.uid); const late = (e.check || {})[S.uid] === "late"; const lab = c ? (late ? "지각" : "참석") : "불참"; return `<a href="#/game/${esc(e.id)}" style="display:flex;align-items:center;gap:12px;min-height:52px;border-bottom:2px solid ${C.line};text-decoration:none"><b class="bc" style="flex:none;width:64px;font-size:16px">${md(e.date)}</b><span style="flex:1;font-size:16px">${esc(vsText(e))}</span><span class="tag" style="background:${C.white}${c ? "" : ";border-style:dashed"}">${lab}</span></a>`; }).join("") : `<span class="note" style="padding:16px 0">아직 지난 경기가 없어요.</span>`}
    </section>
  </div>${navBar("기록")}`;
}
// 4-3-2 경기 기록 상세, 4-3-3 MOM 투표
function mGame(id) {
  const e = S.events[id]; if (!e) return mRecords(); const u = S.uid;
  if (MU.momFor === e.id) return mMomPick(e);
  const came = people().filter(x => cameTo(e, x.uid)); const t = D("tally")["mom-" + e.id] || { n: 0, c: {} };
  const win = momClosed(e) ? momWinners(e) : []; const my = (myUv().mom || {})[e.id]; const iCame = cameTo(e, u);
  const goals = e.goals || []; const gcount = {}; goals.forEach(g => { gcount[g.uid] = (gcount[g.uid] || 0) + 1; });
  const home = e.type === "scrim" ? "A팀" : S.team.name; const away = e.type === "scrim" ? "B팀" : e.opponent || "상대";
  const res = resultWord(e); const won_ = e.score && +e.score.us > +e.score.them;
  const gn = x => !x ? "" : x.startsWith("g:") ? ((((e.guests || {})[x.slice(2)] || {}).name || "용병") + " (용병)") : nameOf(x);
  const dl = momDeadline(e); const left = Math.ceil((dl - Date.now()) / 864e5); const adm = isAdmin() && viewMode() === "admin";
  return `${hd("경기 기록", "#/records", { sub: `${md(e.date)} ${wd(e.date)}요일 ${e.time || ""}`, right: adm && isPlay(e) ? `<a class="btn sm" href="#/result/${esc(e.id)}" style="margin-right:4px">${e.score ? "결과 고치기" : "결과 넣기"}</a>` : "" })}<div class="body">
    <div class="box blue" style="border-radius:12px;position:relative;padding:16px 16px">
      <span class="cn" style="font-size:12px;padding-right:64px"><b>${kindOf(e)}</b><span>${esc(e.place || "")}</span></span>
      ${e.score ? `<div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;padding:8px 0 4px"><b style="font-size:16px;text-align:center">${esc(home)}</b><b class="bc" style="font-size:64px;line-height:1;letter-spacing:-1px">${esc(scoreText(e))}</b><b style="font-size:16px;text-align:center">${esc(away)}</b></div>
        <span style="position:absolute;top:12px;right:14px;width:52px;height:52px;border-radius:50%;border:2.5px solid ${C.ink};background:${C.bg};transform:rotate(-12deg);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px">${res}</span>` : `<b style="font-size:18px;padding:8px 0">${isPlay(e) ? "결과를 기다리고 있어요" : "훈련"}</b><span class="note" style="color:${C.ink}">운영진이 결과를 올리면 MOM 투표가 열리고 알림이 가요.</span>`}
    </div>
    ${momOpen(e) ? `<div class="box" style="border-radius:12px;padding:16px 16px 16px"><span class="spread"><b class="bh" style="font-size:21px">MOM 투표</b><span class="bc" style="font-size:16px;background:${C.ink};color:${C.bg};border-radius:6px;padding:1px 8px">${left <= 0 ? "오늘" : "D-" + left}</span></span><span style="font-size:14px">${md(e.date)} ${esc(vsText(e))}, ${whenText(dl.getTime())}까지</span>${adm ? `<b style="font-size:12px">투표한 사람 ${t.n || 0} / ${came.length}명 (운영진만 보여요)</b>` : ""}
      ${!iCame ? `<span style="font-size:14px">이날 온 사람만 투표할 수 있어요.</span>` : my ? `<span style="display:flex;align-items:center;gap:8px;background:${C.bg};border:2px solid ${C.ink};border-radius:12px;padding:8px 12px;font-size:14px">${IC.check}<span><b>${esc(nameOf(my))}</b>에게 투표했어요. 결과는 마감 뒤에 나와요.</span></span>` : `<button class="btn pri" data-act="mMomOpen" data-eid="${esc(e.id)}" style="height:48px;border-radius:12px">투표하기${IC.arrow}</button>`}</div>` : ""}
    ${isPlay(e) && e.score ? `<section style="display:flex;flex-direction:column" aria-label="골 기록"><span class="spread" style="align-items:baseline;border-bottom:2px solid ${C.ink};padding-bottom:8px"><b style="font-size:16px">골 기록</b><span style="font-size:12px;color:${C.sub}">넣은 사람과 도운 사람</span></span>
      ${goals.length ? goals.map(g => `<div style="display:flex;align-items:center;gap:12px;min-height:56px;border-bottom:2px solid ${C.line}"><span style="flex:none;width:22px;height:22px;border-radius:50%;border:2px solid ${C.ink};background:${g.uid === u ? C.orange : C.bg}"></span><span style="flex:1;display:flex;flex-direction:column;gap:1px"><b style="font-size:16px${g.uid === u ? ";text-decoration:underline" : ""}">${esc(gn(g.uid) || "모름")}</b><span style="font-size:12px;color:${C.sub}">${g.assist ? "도움 " + esc(gn(g.assist)) : "도움 없음"}</span></span>${e.type === "scrim" && g.side ? `<span class="tag">${esc(g.side)}팀</span>` : ""}</div>`).join("") : `<span class="note" style="padding:16px 0">이 경기는 우리 골이 없어요.</span>`}</section>` : ""}
    ${win.length ? `<div class="box" style="flex-direction:row;align-items:center;gap:16px;border-radius:18px"><span style="flex:none;width:64px;height:64px;border-radius:50%;border:2.5px solid ${C.ink};background:${C.sec2};transform:rotate(-12deg);display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1" class="bc"><span style="font-size:20px">MOM</span><span style="font-size:12px">${(t.c || {})[win[0]] || 0}표</span></span><span style="display:flex;flex-direction:column;gap:4px"><span class="note">이 경기 MOM</span><b class="bh" style="font-size:24px">${esc(win.map(nameOf).join(", "))}</b></span></div>` : ""}
    <section style="display:flex;flex-direction:column;gap:8px" aria-label="이날 온 사람"><span class="spread" style="align-items:baseline;border-bottom:2px solid ${C.ink};padding-bottom:8px"><b style="font-size:16px">이날 온 사람</b><b class="bc" style="font-size:18px">${came.length}명</b></span>
      <div class="chips" style="gap:8px">${came.length ? came.map(x => { const late = (e.check || {})[x.uid] === "late"; const g = gcount[x.uid]; return `<span style="display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 8px;border:2px solid ${C.ink};border-radius:8px;font-size:14px;font-weight:${x.uid === u ? 700 : 500};background:${x.uid === u ? `${C.ink};color:${C.bg}` : C.white}">${esc(x.name)}${g ? `<span class="tag green" style="border-width:1.5px">${g}골</span>` : ""}${late ? `<span class="tag orange" style="border-width:1.5px">지각</span>` : ""}</span>`; }).join("") : `<span class="note">출석 기록이 없어요</span>`}${guestsOf(e).map(g => `<span style="display:inline-flex;align-items:center;height:34px;padding:0 8px;border:2px dashed ${C.ink};border-radius:8px;font-size:14px;color:${C.sub}">${esc(g.name)} 용병</span>`).join("")}</div></section>
  </div>${navBar("기록")}`;
}
function mMomPick(e) {
  const u = S.uid; const came = people().filter(x => cameTo(e, x.uid) && x.uid !== u);
  return `${hd("MOM 투표", "#/game/" + e.id, { sub: `${md(e.date)} ${vsText(e)}, ${whenText(momDeadline(e).getTime())}까지`, backAct: "mMomClose" })}<div class="body" style="gap:16px">
    <span style="font-size:14px;line-height:1.6">이날 온 사람 중에서 한 명을 골라요. 익명이고, 한 번 내면 바꿀 수 없어요.<br>결과는 마감 뒤 이 경기 티켓에 찍혀요.</span>
    <div class="grid2" style="gap:12px;padding:4px 4px">${came.map(x => { const on = MU.mom === x.uid; const g = (e.goals || []).filter(z => z.uid === x.uid).length; return `<button type="button" class="box${on ? " pink" : ""}" data-act="mMomPick" data-u="${esc(x.uid)}" aria-pressed="${on}" style="align-items:flex-start;gap:4px;padding:12px 16px;${on ? `transform:rotate(-3deg);box-shadow:4px 4px 0 ${C.ink}` : ""}"><span class="cn"><b class="bc" style="font-size:18px">${esc(x.p.num || "")}</b><b style="font-size:16px">${esc(x.name)}</b></span><span style="font-size:12px">${esc([x.p.pos1, g ? g + "골" : ""].filter(Boolean).join(", "))}</span></button>`; }).join("") || `<span class="note">고를 사람이 없어요</span>`}</div>
  </div><div class="cta"><button class="btn ink block" data-act="mMomSend" data-eid="${esc(e.id)}" ${MU.mom ? "" : "disabled"}>${MU.mom ? esc(nameOf(MU.mom)) + "에게 투표하기" : "한 명을 골라 주세요"}</button></div>`;
}

/* ===================== 4-4 팀 ===================== */
export function teamTops(y) {
  const evs = seasonEvents(y).filter(isPlay); const ps = people();
  const momC = {}; evs.filter(momClosed).forEach(e => momWinners(e).forEach(u => { momC[u] = (momC[u] || 0) + 1; }));
  const mx = Math.max(0, ...Object.values(momC)); const momTop = mx ? Object.keys(momC).filter(k => momC[k] === mx) : [];
  const rate = ps.map(x => ({ uid: x.uid, n: evs.filter(e => cameTo(e, x.uid)).length })); const rmx = Math.max(0, ...rate.map(x => x.n)); const rateTop = rmx ? rate.filter(x => x.n === rmx).map(x => x.uid) : [];
  return { evs, mom: momTop, momN: mx, rate: rateTop, rateN: rmx, pct: evs.length ? Math.round(rmx * 100 / evs.length) : 0 };
}
function teamCard() {
  return `<div class="box blue" style="flex-direction:row;align-items:center;gap:16px;border-radius:12px;padding:16px">${teamLogo(64)}<span style="display:flex;flex-direction:column;gap:4px;min-width:0"><b class="bh" style="font-size:28px;line-height:1.1">${esc(S.team.name)}</b><span style="font-size:14px">${sport() === "soccer" ? "축구팀" : "풋살팀"}  팀원 ${S.members.length}명</span></span></div>`;
}
export function topsBlock() {
  const y = todayStr().slice(0, 4); const t = teamTops(y); const names = us => us.slice(0, 2).map(nameOf).join(", ") + (us.length > 2 ? " 외 " + (us.length - 2) + "명" : "");
  return `<div class="grid2" style="margin-top:-6px"><div class="box" style="gap:4px;padding:12px 16px"><span class="tag" style="align-self:flex-start;background:#FFECEF;color:#6B3440">MOM 최다</span><b class="bh" style="font-size:21px;line-height:1.3">${t.mom.length ? esc(names(t.mom)) : "아직 없어요"}</b><span style="font-size:12px">${t.momN ? `<b class="bc" style="font-size:24px">${t.momN}</b>번 받았어요` : "&nbsp;"}</span></div>
    <div class="box" style="gap:4px;padding:12px 16px"><span class="tag" style="align-self:flex-start">출석률 최고</span><b class="bh" style="font-size:21px;line-height:1.3">${t.rate.length ? esc(names(t.rate)) : "아직 없어요"}</b><span style="font-size:12px">${t.rateN ? `<b class="bc" style="font-size:24px">${t.pct}</b>%  ${t.rateN === t.evs.length ? t.evs.length + "경기 모두" : t.evs.length + "경기 중 " + t.rateN}` : "&nbsp;"}</span></div></div>
    <span style="font-size:12px;color:${C.sub};margin-top:-10px">${y} 시즌 지난 ${t.evs.length}경기 기준이에요.</span>`;
}
function mTeam() {
  const ns = noticesList(); const unreadN = ns.filter(n => !(myUv().seen || {})[n.id]).length; const owe = oweNow();
  const ft = fineRulesOf(S.settings); const adm = isAdmin() && viewMode() === "admin";
  return `${hdTab("팀")}<div class="body">
    ${teamCard()}${topsBlock()}
    <nav class="lst" aria-label="팀 메뉴">
      ${lrow({ href: "#/notices", icon: IC.megaphone, tone: "blue", title: "공지", sub: ns[0] ? esc(ns[0].title) : "아직 공지가 없어요", right: unreadN ? `<span class="tag orange">새 글 ${unreadN}</span>` : "", big: true })}
      ${lrow({ href: adm ? "#/rules-edit" : "#/rules", icon: IC.doc, tone: "pink", title: adm ? "수칙과 벌금 고치기" : "수칙과 벌금", sub: `수칙${ft.length ? ", 벌금 " + ft.length + "가지" : ""}`, big: true })}
      ${lrow({ href: "#/money", icon: IC.card, tone: "clay", title: "내가 낼 돈", sub: "회비와 벌금", right: owe.total ? `<b class="bc" style="font-size:18px;color:${C.ink}">${won(owe.total)}</b>` : "다 냈어요", big: true })}
      ${lrow({ href: "#/members", icon: IC.people, tone: "green", title: adm ? "팀원 관리" : "팀원", sub: "포지션별로 모아 봐요", right: S.members.length + "명", big: true })}
    </nav>
  </div>${navBar("팀")}`;
}
function mNotices() {
  const ns = noticesList(); const seen = myUv().seen || {}; const adm = isAdmin() && viewMode() === "admin";
  return `${hd("공지", "#/team", { right: adm ? `<a class="btn o sm" href="#/notice-new" style="margin-right:4px">+ 공지 쓰기</a>` : "" })}<div class="body" style="gap:0">
    ${ns.length ? ns.map(n => `<a href="#/notice/${esc(n.id)}" style="display:flex;align-items:center;gap:12px;min-height:76px;padding:12px 0;border-bottom:2px solid ${C.line};text-decoration:none"><span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px"><span style="display:flex;align-items:center;gap:8px;font-size:12px;color:${C.sub}">${n.pinned ? `<span class="tag blue">고정</span>` : ""}${!seen[n.id] ? `<span class="tag orange">새 글</span>` : ""}${esc(String(n.at || "").slice(5, 10).replace("-", "."))}${n.by ? "  " + esc(nameOf(n.by)) : ""}</span><b style="font-size:16px;line-height:1.4">${esc(n.title)}</b></span>${IC.chev}</a>`).join("") : empty("아직 공지가 없어요")}
  </div>${navBar("팀")}`;
}
function mNotice(id) {
  const n = noticesList().find(x => x.id === id); if (!n) return mNotices(); const adm = isAdmin() && viewMode() === "admin";
  if (!(myUv().seen || {})[id]) setTimeout(() => patchDoc("uvote", S.uid, { seen: { [id]: new Date().toISOString() } }).catch(() => {}), 300);
  const seenN = (D("tally")["seen-" + n.id] || {}).n || 0;
  return `${hd("공지", "#/notices")}<div class="body" style="gap:16px">
    <span class="note">${n.pinned ? "고정  " : ""}${esc(String(n.at || "").slice(0, 10).replace(/-/g, "."))}${n.by ? "  " + esc(nameOf(n.by)) : ""}${adm ? `  ${seenN}명 읽음` : ""}</span>
    <h2 class="bh" style="margin:0;font-size:24px;line-height:1.3">${esc(n.title)}</h2>
    <div style="border-top:2px solid ${C.ink};padding-top:16px;font-size:16px;line-height:1.75;white-space:pre-wrap">${esc(n.body || "")}</div>
    ${adm ? `<div class="grid3" style="margin-top:12px"><a class="btn sm" href="#/notice-edit/${esc(n.id)}">고치기</a><button class="btn sm" data-act="noticePin" data-id="${esc(n.id)}">${n.pinned ? "고정 풀기" : "고정"}</button><button class="btn sm c" data-act="noticeDel" data-id="${esc(n.id)}">지우기</button></div>` : ""}
  </div>${navBar("팀")}`;
}
function mRules() {
  const txt = rulesTextOf(S.settings).trim(); const fines = fineRulesOf(S.settings);
  const KW = { late: "현장 출석에서 지각으로 체크되면", absent: "말없이 안 오면", cancel: "벌금 기준 시각이 지난 뒤 불참으로 바꾸면" };
  return `${hd("수칙과 벌금", "#/team", { sub: "운영진이 정하고 바꿔요" })}<div class="body" style="gap:24px">
    <section class="box gray" style="border-radius:18px;padding:16px 16px" aria-label="수칙"><span class="spread" style="align-items:baseline"><b class="bh" style="font-size:21px">팀 수칙</b>${S.settings.rulesAt ? `<span style="font-size:12px">${md(S.settings.rulesAt.slice(0, 10))} 고침</span>` : ""}</span><p style="margin:0;font-size:16px;line-height:1.8;white-space:pre-line">${txt ? esc(txt) : "아직 정한 수칙이 없어요."}</p></section>
    <section style="display:flex;flex-direction:column" aria-label="벌금"><b style="font-size:16px;border-bottom:2px solid ${C.ink};padding-bottom:8px">벌금</b>
      ${fines.length ? fines.map(r => `<div style="display:flex;align-items:center;gap:12px;min-height:60px;border-bottom:2px solid ${C.line}"><span style="flex:1;display:flex;flex-direction:column;gap:4px"><b style="font-size:16px">${esc(r.label)}</b><span class="note">${KW[ruleKind(r)] || "운영진이 매겨요"}</span></span><b class="bc" style="font-size:24px">${won(r.amount)}</b></div>`).join("") : `<span class="note" style="padding:16px 0">벌금이 없어요.</span>`}</section>
  </div>${navBar("팀")}`;
}
function mMoney() {
  const o = oweNow(); const my = D("mydues")[S.uid] || {}; const b = S.settings.bank || {}; const fee = Number(S.settings.fee) || 0; const mode = feeMode();
  const paid = [];
  Object.entries(my.dues || {}).forEach(([k, v]) => { if (v === "paid") paid.push({ label: duesLabel(k), when: (my.paidAt || {})[k] || "", amount: Number(my.fee != null ? my.fee : fee) || 0, key: k }); });
  (my.fines || []).forEach(f => { if (f.paid) paid.push({ label: (f.reason || "벌금") + " 벌금", when: f.paidAt || "", amount: Number(f.amount) || 0, key: f.date || "" }); });
  paid.sort((a, b) => String(b.when || b.key).localeCompare(String(a.when || a.key)));
  const row = (x, done) => `<div style="display:flex;align-items:center;gap:12px;min-height:60px;border-bottom:2px solid ${C.line}"><span style="flex:1;display:flex;flex-direction:column;gap:4px"><b style="font-size:16px">${esc(x.label)}</b><span class="note">${done ? (x.when ? md(String(x.when).slice(0, 10)) + "에 냈어요" : "냈어요") : esc(x.sub || "")}</span></span><b class="bc" style="font-size:24px">${won(x.amount)}</b><span class="tag ${done ? "green" : "clay"}">${done ? "냄" : "안 냄"}</span></div>`;
  return `${hd("내가 낼 돈", "#/team", { sub: "회비와 벌금" })}<div class="body" style="gap:20px">
    <div class="box" style="border-radius:12px;padding:16px 16px;gap:4px"><span style="font-size:14px;font-weight:700">아직 안 낸 돈</span><b class="bc" style="font-size:56px;line-height:1">${won(o.total)}</b><span style="font-size:12px">보낸 뒤 운영진이 확인하면 "냄"으로 바뀌어요.</span></div>
    ${b.account ? `<div class="box" style="flex-direction:row;align-items:center;gap:12px;border-radius:14px"><span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px"><span class="note">받는 계좌${b.holder ? ", 예금주 " + esc(b.holder) : ""}</span><b style="font-size:16px">${esc((b.bank || "") + " " + b.account)}</b></span><button class="btn sm" data-act="mCopyAcc">복사</button></div>` : `<span class="note">운영진이 아직 계좌를 적지 않았어요.</span>`}
    ${mode !== "none" ? `<span class="note">${mode === "monthly" ? `월회비 ${won(fee)}, 매달 ${S.settings.dueDay === "말일" ? "말일" : (S.settings.dueDay || "5") + "일"}까지` : `경기마다 ${won(fee)}`}</span>` : ""}
    <section style="display:flex;flex-direction:column" aria-label="낼 돈"><b style="font-size:16px;border-bottom:2px solid ${C.ink};padding-bottom:8px">낼 돈</b>${o.items.length ? o.items.map(x => row(x, false)).join("") : `<span class="note" style="padding:16px 0">지금은 낼 돈이 없어요.</span>`}</section>
    ${paid.length ? `<section style="display:flex;flex-direction:column" aria-label="낸 돈"><b style="font-size:16px;border-bottom:2px solid ${C.ink};padding-bottom:8px">낸 돈</b>${paid.slice(0, 12).map(x => row(x, true)).join("")}</section>` : ""}
  </div>${navBar("팀")}`;
}
const POS_ORDER = { soccer: [["골키퍼", ["GK"]], ["수비", ["LB", "LWB", "CB", "RB", "RWB"]], ["미드필더", ["CDM", "CM", "LM", "RM", "CAM"]], ["공격", ["LW", "RW", "ST"]]], futsal: [["골레이로", ["골레이로"]], ["픽소", ["픽소"]], ["아라", ["아라"]], ["피보", ["피보"]]] };
export function memberGroups() {
  const ps = people(); const groups = POS_ORDER[sport()].map(([g, list]) => ({ g, xs: ps.filter(x => list.includes(x.p.pos1 || "")) }));
  const rest = ps.filter(x => !groups.some(gr => gr.xs.includes(x))); if (rest.length) groups.push({ g: "포지션 미정", xs: rest });
  groups.forEach(gr => gr.xs.sort((a, b) => (Number(a.p.num) || 999) - (Number(b.p.num) || 999)));
  return groups.filter(gr => gr.xs.length);
}
function mMembers() {
  const ps = people();
  return `${hd("팀원", "#/team", { sub: `${ps.length}명, 포지션별` })}<div class="body" style="gap:16px">
    ${memberGroups().map(gr => `<section style="display:flex;flex-direction:column" aria-label="${esc(gr.g)}"><span class="spread" style="align-items:baseline;border-bottom:2px solid ${C.ink};padding-bottom:8px"><b style="font-size:16px">${esc(gr.g)}</b><span class="bc" style="font-size:16px">${gr.xs.length}명</span></span>
      ${gr.xs.map(x => `<div style="display:flex;align-items:center;gap:12px;min-height:56px;border-bottom:2px solid ${C.line}"><b class="bc" style="flex:none;width:34px;font-size:20px;text-align:center">${esc(x.p.num || "-")}</b><span style="flex:1;display:flex;flex-direction:column;gap:1px"><b style="font-size:16px">${esc(x.name)}${x.uid === S.uid ? ` <span style="font-weight:500;color:${C.sub};font-size:12px">나</span>` : ""}</b><span class="note">${esc([x.p.pos1, x.p.pos2].filter(Boolean).join(", "))}</span></span>${x.role !== "member" ? `<span class="tag ${x.role === "owner" ? "ink" : "blue"}">${ROLE[x.role]}</span>` : ""}</div>`).join("")}</section>`).join("") || empty("아직 팀원이 없어요")}
  </div>${navBar("팀")}`;
}

/* ---------- 길찾기 ---------- */
export function memberRoute(r) {
  let m;
  if (r === "/" || r === "") return mHome();
  if (r === "/notify") return mNotify();
  if (r === "/posreq") return mPosReq();
  if (r === "/schedule") return mSchedule();
  if ((m = r.match(/^\/event\/(.+)$/))) return mEvent(decodeURIComponent(m[1]));
  if (r === "/records") return mRecords();
  if (r === "/season") return mSeason();
  if ((m = r.match(/^\/game\/(.+)$/))) return mGame(decodeURIComponent(m[1]));
  if (r === "/team") return mTeam();
  if (r === "/notices") return mNotices();
  if ((m = r.match(/^\/notice\/(.+)$/))) return mNotice(decodeURIComponent(m[1]));
  if (r === "/rules") return mRules();
  if (r === "/money") return mMoney();
  if (r === "/members") return mMembers();
  return null;
}
export function memberForm(r) {
  if (r === "/posreq") { S.form = { slot: 1 }; return true; }
  if (/^\/game\//.test(r)) { MU.mom = ""; MU.momFor = ""; return true; }
  if (/^\/event\//.test(r)) { MU.lq = 1; return true; }
  return false;
}
let undoT = 0;
function toastUndo(msg, fn) {
  const L = document.getElementById("layer"); clearTimeout(undoT);
  const el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); el.style.display = "flex"; el.style.gap = "12px"; el.style.alignItems = "center"; el.style.width = "max-content";
  el.innerHTML = `<span>${esc(msg)}</span>${fn ? `<button style="border:0;background:none;color:${C.yel};font-weight:700;padding:4px">되돌리기</button>` : ""}`;
  document.querySelectorAll(".toast").forEach(x => x.remove()); L.appendChild(el);
  if (fn) el.querySelector("button").onclick = () => { el.remove(); fn(); };
  undoT = setTimeout(() => el.remove(), 4000);
}
// 투표: 화면을 먼저 바꾸고 서버에 저장한다. back이면 카드가 움직인 뒤 일정 목록으로 돌아가 티켓이 뜯긴다(처음 투표) 또는 도장이 다시 찍힌다
export async function saveVote(e, val, opts = {}) {
  if (typeof opts === "boolean") opts = { quiet: opts };
  if (maintLocked()) { render(); fail(new Error("maintenance")); return; } // 점검 직전: 화면을 바꾸지 않고 알린다
  const prev = { ...myVote(e) };
  if (opts.back) {
    const delay = opts.delay || 900; S.freezeUntil = Date.now() + delay;
    setTimeout(() => { S.freezeUntil = 0; if (location.hash === "#/event/" + e.id) { MU.anim = { id: e.id, tear: !prev.s, t0: Date.now() }; location.hash = "#/schedule"; setTimeout(() => { const tk = document.querySelector(`[data-tk="${e.id}"]`); if (tk && tk.getBoundingClientRect().bottom > innerHeight - 80) tk.scrollIntoView({ block: "center" }); }, 60); } else render(); }, delay);
  }
  try {
    await patchDoc("rsvp", S.uid, { ev: { [e.id]: val } });
    if (!opts.back) render();
    const w = waitNo(e, S.uid);
    const show = (m, f) => opts.back ? setTimeout(() => toastUndo(m, f), 1500) : toastUndo(m, f);
    if (!opts.quiet) show(`${md(e.date)} ${evName(e)}, ${w && val.s !== "no" ? "대기 " + w + "번으로" : (val.s === "late" ? (val.q ? val.q + "Q부터 늦참" : "늦참") : VS[val.s]) + "으로"} 저장했어요`, prev.s === "yes" || prev.s === "late" ? null : () => saveVote(e, prev.s ? { s: prev.s, q: prev.q || 0 } : { s: "", q: 0 }, { quiet: true }));
  } catch (err) { S.freezeUntil = 0; MU.anim = null; render(); fail(err); }
}
// 누른 카드를 바로 움직인다 (다시 그리지 않아서 기울어지는 모션이 보인다)
function pressCard(btn, cls) {
  btn.parentElement.querySelectorAll(".qc").forEach(b => { b.classList.remove("on", "yes", "late", "no", "wait"); b.setAttribute("aria-pressed", "false"); });
  btn.classList.add("on", cls); btn.setAttribute("aria-pressed", "true");
}
export const MACT = {
  readAll: async () => { try { await patchDoc("uvote", S.uid, { readAt: new Date().toISOString() }); render(); toast("모두 읽음으로 바꿨어요"); } catch (err) { fail(err); } },
  mVote: t => {
    if (maintLocked()) { fail(new Error("maintenance")); return; }
    const e = S.events[t.dataset.eid]; if (!e) return; const v = t.dataset.v; const cur = myVote(e); const vs = voteState(e);
    const a = att(e); const w = waitNo(e, S.uid); const seat = (cur.s === "yes" || cur.s === "late") && !w;
    if (v === cur.s && v !== "late") return;
    if (v === "no" && seat && (vs === "closed" || fineNow(e))) { fineDlg(e); return; }
    if (vs !== "open") return;
    const next = { s: v, q: v === "late" ? (cur.s === "late" ? cur.q || 0 : 0) : 0 };
    if (v === "no" && seat && a.cap && a.wait.length) { giveSeatDlg(e, a, next); return; }
    if (v === "late" && cur.s === "late") return;
    const full = a.cap && a.in >= a.cap; const toWait = v !== "no" && !seat && (w || full);
    if (v === "late" && !next.q) { saveVote(e, next, { quiet: true }); return; } // 늦참은 몇 쿼터부터인지 고른 뒤 돌아간다
    pressCard(t, toWait ? "wait" : v);
    saveVote(e, next, { back: true });
  },
  mLateQ: t => { const e = S.events[t.dataset.eid]; if (!e) return; t.parentElement.querySelectorAll(".qq").forEach(b => b.classList.toggle("on", b === t)); saveVote(e, { ...myVote(e), s: "late", q: Number(t.dataset.q) }, { back: true, delay: 700 }); },
  mLq: t => { MU.lq = Number(t.dataset.q) || 1; render(); },
  mGuest: t => guestSheet(t.dataset.eid),
  mGuestCancel: t => confirmBox("용병 신청 취소", "보낸 용병 신청을 취소할까요?", "취소하기", async () => { try { await patchDoc("guestreq", S.uid, { items: { [t.dataset.k]: { status: "cancel", doneAt: new Date().toISOString() } } }); render(); } catch (err) { fail(err); } }),
  mSeasonPick: () => { const ys = [...new Set(past().map(e => e.date.slice(0, 4)).concat([todayStr().slice(0, 4)]))].sort().reverse(); sheet(`<h3>시즌 고르기</h3><div class="lst">${ys.map(y => `<button class="lr" data-act="mSeasonSet" data-y="${y}"><span class="tx"><b>${y} 시즌</b><span>경기 ${seasonEvents(y).filter(isPlay).length}번</span></span>${yearOf() === y ? IC.check : ""}</button>`).join("")}</div><span class="note">시즌은 매년 1월 1일에 새로 시작해요.</span><button class="btn" data-act="closeSheet">닫기</button>`); },
  mSeasonSet: t => { MU.season = t.dataset.y; closeSheet(); render(); },
  mMomOpen: t => { MU.momFor = t.dataset.eid; MU.mom = ""; render(); window.scrollTo(0, 0); },
  mMomClose: (t, ev) => { ev.preventDefault(); MU.momFor = ""; render(); },
  mMomPick: t => { MU.mom = t.dataset.u; render(); },
  mMomSend: async t => { const e = S.events[t.dataset.eid]; if (!e || !MU.mom) return; t.disabled = true; try { await patchDoc("uvote", S.uid, { mom: { [e.id]: MU.mom } }); MU.momFor = ""; MU.mom = ""; render(); toast("MOM 투표를 냈어요"); } catch (err) { t.disabled = false; fail(err); } },
  mCopyAcc: async () => { const b = S.settings.bank || {}; try { await navigator.clipboard.writeText(b.account || ""); toast("계좌를 복사했어요"); } catch (err) { toast("계좌번호를 길게 눌러 복사해 주세요"); } },
  mPosSlot: t => { S.form.slot = Number(t.dataset.k); render(); },
  mPosPick: t => {
    const p = myProfile() || {}; const f = S.form; if (f.p1 === undefined) f.p1 = p.pos1 || ""; if (f.p2 === undefined) f.p2 = p.pos2 || "";
    const v = t.dataset.v; const k = f.slot === 2 ? "p2" : "p1", o = k === "p1" ? "p2" : "p1";
    if (v && f[o] === v) f[o] = f[k] || ""; f[k] = v; if (f.slot === 1 && v) f.slot = 2; render();
  },
  mPosSend: async t => {
    const p = myProfile() || {}; const f = S.form; const p1 = f.p1 !== undefined ? f.p1 : p.pos1 || "", p2 = f.p2 !== undefined ? f.p2 : p.pos2 || ""; if (!p1) return; t.disabled = true;
    try {
      if (isAdmin() && viewMode() === "admin") { await patchDoc("rsvp", S.uid, { profile: { ...p, pos1: p1, pos2: p2 } }); toast("포지션을 바꿨어요"); }
      else { await patchDoc("rsvp", S.uid, { posReq: { pos1: p1, pos2: p2, more: [], note: "", at: new Date().toISOString(), status: "req" } }); toast("포지션 변경을 운영진에게 요청했어요"); }
      location.hash = "#/";
    } catch (err) { t.disabled = false; fail(err); }
  },
  mPosCancel: () => confirmBox("요청 취소", "보낸 포지션 변경 요청을 취소할까요?", "요청 취소", async () => { try { await patchDoc("rsvp", S.uid, { posReq: null }); render(); toast("요청을 취소했어요"); } catch (err) { fail(err); } }),
  // 팀 나가기: Admin은 다음 Admin을 정해야 나갈 수 있다 (운영 탭 팀 설정)
  mLeave: () => {
    if (S.role === "owner") { dlg(`<span class="tag blue" style="align-self:center">Admin</span><h3 style="text-align:center">Admin은 바로 나갈 수 없어요</h3><span style="font-size:14px;line-height:1.6;text-align:center">운영진 중에서 다음 Admin을 정해야 나갈 수 있어요.<br>운영 탭의 팀 설정에서 정해 주세요.</span><div class="grid2"><button class="btn" data-act="closeSheet">닫기</button><button class="btn" data-act="goTo" data-h="#/settings" style="background:${C.blue}">팀 설정으로</button></div>`); return; }
    dlg(`<h3 style="text-align:center">${esc(S.team.name)}에서 나갈까요?</h3><span style="font-size:14px;line-height:1.6;text-align:center">나가면 이 팀의 일정과 기록을 볼 수 없어요.<br>다시 들어오려면 초대 링크를 받아야 해요.</span><div class="grid2"><button class="btn" data-act="closeSheet" style="background:${C.blue}">남기기</button><button class="btn c" id="lvOk">나가기</button></div>`);
    $("#lvOk").onclick = async ev => { ev.target.disabled = true; const { error } = await sb.rpc("remove_member", { p_team: S.tid, p_user: S.uid }); if (error) { ev.target.disabled = false; fail(error); return; } ls.set("mb-team", null); toast("팀에서 나왔어요"); setTimeout(() => location.replace(APP), 600); };
  },
};
