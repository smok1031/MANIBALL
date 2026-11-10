// 팀원 화면: 디자인 시안 [팀원] 1-1 ~ 5-5를 그대로 따른다. 운영진 기능은 이 파일에 두지 않는다.
// 운영진도 "팀원 화면 보기"를 누르면 이 화면으로 자기 참석과 선수 카드를 본다.
import { $, D, LOGO, POS, QN, ROLE, S, UI, att, cameTo, closeSheet, closeText, confirmBox, esc, evName, evStart, fail, feeMode, guestReqs, guestsOf, isAdmin, isPlay, jersey, joinedOf, mLabel, md, momClosed, momDeadline, momOpen, momWinners, myProfile, myUv, myVote, nameOf, nav, noticesList, past, patchDoc, people, qs, remindInfo, render, ruleKind, sb, setView, sheet, sport, started, toast, todayStr, top, uid36, unclaimed, upcoming, voteState, wd, won, ym } from "./main.js";

/* ---------- 공통 계산 ---------- */
const MU = { cal: false, day: "", change: "", season: "", filter: "all" };
const yearOf = () => MU.season || todayStr().slice(0, 4);
const seasonEvents = y => past().filter(e => e.date.startsWith(y));
// 라인업에서 그 사람이 뛴 쿼터 수 (라인업이 없으면 null)
function quartersOf(e, u) {
  const L = e.lineup || {}; let n = 0, has = false;
  Object.values(L).forEach(side => { if (!side || !side.q) return; has = true; Object.values(side.q).forEach(q => { if (Object.values(q).includes(u)) n++; }); });
  return has ? n : null;
}
function quarterList(e, u) {
  const out = []; const L = e.lineup || {};
  Object.values(L).forEach(side => { if (!side || !side.q) return; Object.entries(side.q).forEach(([k, q]) => { if (Object.values(q).includes(u)) out.push(Number(k)); }); });
  return out;
}
function myStats(u, y) {
  const evs = seasonEvents(y || yearOf());
  const came = evs.filter(e => cameTo(e, u));
  const qs = came.map(e => quartersOf(e, u)).filter(x => x != null);
  const late = evs.filter(e => (e.check || {})[u] === "late").length;
  const miss = evs.filter(e => !cameTo(e, u)).length;
  const goals = evs.reduce((n, e) => n + (e.goals || []).filter(g => g.uid === u).length, 0);
  const mom = evs.filter(momClosed).filter(e => momWinners(e).includes(u)).length;
  return { n: evs.length, mine: came.length, avgQ: qs.length ? (qs.reduce((a, b) => a + b, 0) / qs.length) : null, late, miss, goals, mom, rate: evs.length ? Math.round(came.length * 100 / evs.length) : 0 };
}
const fmtQ = q => q == null ? "-" : (Math.round(q * 10) / 10).toString();
const dday = e => { const d = Math.round((new Date(e.date + "T00:00:00+09:00") - new Date(todayStr() + "T00:00:00+09:00")) / 864e5); return d === 0 ? "오늘" : d > 0 ? "D-" + d : ""; };
const typeTag = e => `<span class="tag ${e.type === "training" ? "blue" : ""}">${e.type === "match" ? "경기" : e.type === "scrim" ? "내전" : "훈련"}</span>`;
const dateBox = (e, gray) => `<span class="datebox ${gray ? "gray" : ""}"><span>${wd(e.date)}</span><b>${Number(e.date.slice(8, 10))}</b></span>`;
const VS = { yes: "참석", late: "늦참", no: "불참" };
const cancelRule = () => (S.settings.rules || []).find(r => ruleKind(r) === "cancel");
const myPid = () => (S.rsvp[S.uid] || {}).pid || "";
function resultWord(e) { if (!e.score) return ""; const a = +e.score.us, b = +e.score.them; return e.type === "scrim" ? (a > b ? "A팀 승" : a < b ? "B팀 승" : "무승부") : a > b ? "승" : a < b ? "패" : "무"; }
function scoreText(e) { return e.type === "scrim" ? `A팀 ${e.score.us} : ${e.score.them} B팀` : `${e.score.us} : ${e.score.them}`; }
const sideOf = (e, u) => (e.teams || {})[u] || "";
const chipT = (t, tone) => `<span class="pill" style="font-size:12px;padding:4px 10px;${tone === "amber" ? "background:#FEF3C7;color:#92400E" : tone === "green" ? "background:#DCFCE7;color:#166534" : "background:#F3F4F6;color:#374151"}">${esc(t)}</span>`;
const tile = (v, l, c) => `<span style="background:#F9FAFB;border-radius:14px;padding:12px 4px;text-align:center;display:flex;flex-direction:column;gap:2px"><b style="font-size:22px;${c ? "color:" + c : ""}">${v}</b><span style="font-size:12px;color:#6B7280">${l}</span></span>`;
const tiles = arr => `<div style="display:grid;grid-template-columns:repeat(${arr.length},minmax(0,1fr));gap:8px">${arr.join("")}</div>`;
const mmdd = d => d.slice(5, 7) + "." + d.slice(8, 10);

/* ---------- 알림함: 데이터에서 만든다 (30일 보관) ---------- */
function feed() {
  const out = []; const u = S.uid; const now = Date.now(); const keep = 30 * 864e5;
  const add = (at, title, body, href) => { const t = Date.parse(at || ""); if (t && now - t < keep) out.push({ t, title, body, href }); };
  Object.values(S.events).forEach(e => {
    const name = `${md(e.date)} ${evName(e)}`;
    if (!started(e) && e.createdAt) add(e.createdAt, `${name} 참석 투표가 열렸어요`, `경기 시작 전까지, 지금 ${att(e).in}명 참석`, "#/schedule");
    if (e.scrimAt) add(e.scrimAt, `${md(e.date)} 경기가 내전으로 바뀌었어요`, "신청한 사람 모두 뛰어요. 팀은 운영진이 나눠서 알려 드려요", "#/schedule");
    if (e.lineupAt && cameOrGoing(e, u)) add(e.lineupAt, `${name} 라인업이 나왔어요`, "내 자리와 쉬는 쿼터를 확인해 주세요", "#/lineup/" + e.id);
    if (started(e) && isPlay(e) && !e.score && cameTo(e, u)) add(new Date(evStart(e)).toISOString(), `${name} 결과가 곧 올라와요`, "올라오면 MOM 투표가 열려요", "#/game/" + e.id);
    if (e.scoredAt && momOpen(e) && cameTo(e, u)) add(e.scoredAt, `${name} MOM 투표가 열렸어요`, "다음 날 12시에 마감돼요", "#/game/" + e.id);
    if (e.score && momClosed(e) && momWinners(e).length) add(momDeadline(e).toISOString(), `${name} MOM은 ${momWinners(e).map(nameOf).join(", ")}`, scoreText(e), "#/game/" + e.id);
  });
  Object.values(((D("guestreq")[u] || {}).items) || {}).forEach(g => { const e = S.events[g.eid]; if (g.status === "ok") add(g.doneAt || g.at, "용병 신청이 수락됐어요", `${g.name}님이 ${e ? md(e.date) + " " + evName(e) : "경기"} 참석 명단에 들어갔어요`, e ? "#/event/" + e.id : "#/schedule"); if (g.status === "no") add(g.doneAt || g.at, "용병 신청이 이번에는 어려워요", g.name + "님", "#/schedule"); });
  Object.values(((D("payreq")[u] || {}).items) || {}).forEach(p => { if (p.status === "ok") add(p.doneAt, "입금을 확인했어요", won(p.amount) + " 납부 완료", "#/dues"); if (p.status === "no") add(p.doneAt, "입금이 확인되지 않았어요", "운영진에게 물어봐 주세요", "#/dues"); });
  const pr = (S.rsvp[u] || {}).posReq; if (pr && pr.doneAt) add(pr.doneAt, pr.status === "ok" ? "포지션 변경이 수락됐어요" : "포지션 변경 요청이 반려됐어요", "", "#/players");
  const rm = remindInfo(); if (rm && (rm.to || []).includes(u) && S.events[rm.eid] && !started(S.events[rm.eid]) && !myVote(S.events[rm.eid]).s) add(rm.at, "참석 응답을 기다리고 있어요", `${md(S.events[rm.eid].date)} ${evName(S.events[rm.eid])}, 운영진이 미응답 알림을 보냈어요`, "#/schedule");
  const owe = oweNow(); if (owe.total && owe.dueAt) add(owe.dueAt, `${owe.label}이 아직이에요`, owe.items.map(x => x.label + " " + won(x.amount)).join(", "), "#/dues");
  const dr = D("team").duesRemind; if (dr && (dr.to || []).includes(u) && owe.total) add(dr.at, "회비 알림", `운영진이 회비 알림을 보냈어요. ${won(owe.total)}`, "#/dues");
  if (S.settings.rulesAt) add(S.settings.rulesAt, "팀 수칙이 바뀌었어요", (S.settings.rules || []).map(r => r.label + (Number(r.amount) ? " " + won(r.amount) : "")).join(", "), "#/players");
  noticesList().forEach(n => add(n.at, "공지: " + n.title, String(n.body || "").slice(0, 60), "#/notices"));
  return out.sort((a, b) => b.t - a.t);
}
function cameOrGoing(e, u) { const v = (((S.rsvp[u] || {}).ev || {})[e.id]) || {}; return cameTo(e, u) || v.s === "yes" || v.s === "late"; }
const readAt = () => Date.parse(myUv().readAt || "") || 0;
const unread = () => feed().filter(x => x.t > readAt()).length;
const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 60 ? (m < 2 ? "방금" : m + "분 전") : m < 1440 ? Math.round(m / 60) + "시간 전" : m < 2880 ? "어제" : new Date(t + 9 * 3600e3).toISOString().slice(5, 10).replace("-", "."); };
const BELL = n => `<a class="iconbtn" href="#/notify" aria-label="알림${n ? " " + n + "개 안 읽음" : ""}" style="position:relative;color:inherit"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>${n ? `<span style="position:absolute;top:9px;right:9px;width:9px;height:9px;border-radius:50%;background:#DC2626;box-shadow:0 0 0 2px #1E6B45"></span>` : ""}</a>`;

/* ---------- 회비 계산 (본인 것만, mydues) ---------- */
function oweNow() {
  const my = D("mydues")[S.uid] || {}; const fee = Number(my.fee != null ? my.fee : S.settings.fee) || 0; const items = [];
  Object.entries(my.dues || {}).forEach(([k, v]) => { if (v !== "paid") items.push({ kind: "dues", key: k, label: duesLabel(k), amount: fee, sub: duesSub(k) }); });
  (my.fines || []).forEach(f => { if (!f.paid) items.push({ kind: "fine", id: f.id, label: (f.reason || "벌금") + " 벌금", amount: Number(f.amount) || 0, sub: md(f.date || todayStr()) + (f.eventId && S.events[f.eventId] ? " " + evName(S.events[f.eventId]) : "") }); });
  const total = items.reduce((n, x) => n + x.amount, 0);
  const first = items.find(x => x.kind === "dues");
  return { items, total, label: first ? first.label : "벌금", dueAt: first ? dueDate(first.key) + "T00:00:00+09:00" : (items[0] ? new Date().toISOString() : "") };
}
function duesLabel(k) { return k.startsWith("m-") ? mLabel(k.slice(2)) + " 회비" : (S.events[k.slice(2)] ? md(S.events[k.slice(2)].date) + " 경기 회비" : "경기 회비"); }
function dueDate(k) { if (!k.startsWith("m-")) { const e = S.events[k.slice(2)]; return e ? e.date : todayStr(); } const d = String(Math.min(28, Math.max(1, Number(S.settings.dueDay) || 5))).padStart(2, "0"); return k.slice(2) + "-" + d; }
function duesSub(k) { const due = dueDate(k); const left = Math.round((new Date(due + "T00:00:00+09:00") - new Date(todayStr() + "T00:00:00+09:00")) / 864e5); return `${md(due)}까지${left < 0 ? ", " + (-left) + "일 지났어요" : left === 0 ? ", 오늘이에요" : ""}`; }
const pendingPay = () => Object.entries(((D("payreq")[S.uid] || {}).items) || {}).filter(([, it]) => it && it.status === "req");
function ledgerItems() { return ((D("team").ledger || {}).items || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date))); }

/* ===================== 화면 ===================== */
// 1-1 홈: 내 선수 카드와 이번 시즌 기록만 둔다 (참석 같은 창은 두지 않는다)
function mHome() {
  const p = myProfile() || {}; const st = myStats(S.uid, todayStr().slice(0, 4)); const n = unread();
  return `<div class="hero" style="padding-bottom:56px">
    <header class="row" style="padding:14px 8px 8px 16px;gap:10px">${LOGO(32)}<span style="flex:1;line-height:1.2"><b style="font-size:18px">${esc(S.team.name)}</b><br><span style="font-size:12px;color:#D1D5DB">${sport() === "soccer" ? "축구팀" : "풋살팀"}, 팀원 ${S.members.length + unclaimed().length}명</span></span>${isAdmin() ? `<button class="btn sm" data-act="viewAdmin" style="background:rgba(255,255,255,.16);color:#FFFFFF">운영진 화면</button>` : ""}<span style="color:#FFFFFF">${BELL(n)}</span></header>
    <div style="display:flex;flex-direction:column;align-items:center;text-align:center;padding:0 20px">
      ${S.settings.uniformPhoto ? `<img src="${esc(S.settings.uniformPhoto)}" alt="팀 유니폼 사진" style="width:220px;height:220px;object-fit:contain">` : jersey(260, p.num, S.settings.uniformColor)}
      <span class="row" style="gap:10px;align-items:baseline"><b style="font-size:34px;font-weight:900;letter-spacing:-1px">${esc(p.name || nameOf(S.uid))}</b>${p.num ? `<span style="color:#BBF7D0">${esc(p.num)}번</span>` : ""}</span>
      <span class="row" style="gap:8px;margin-top:12px">${p.pos1 ? `<span class="pill" style="background:#FFFFFF;color:#1E6B45"><span style="font-size:12px;opacity:.8">1선호</span><b>${esc(p.pos1)}</b></span>` : ""}${p.pos2 ? `<span class="pill" style="background:rgba(255,255,255,.16);color:#FFFFFF"><span style="font-size:12px;opacity:.8">2선호</span><b>${esc(p.pos2)}</b></span>` : ""}</span>
      <a href="#/me" style="margin-top:18px;color:#FFFFFF;text-decoration:none;font-weight:700;padding:11px 28px;border-radius:999px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.45)">프로필 수정</a>
    </div></div>
    <div class="body" style="margin-top:-44px">
      <div class="card" style="box-shadow:0 12px 28px rgba(17,24,39,.1)"><div class="spread"><span class="hint">이번 시즌</span><b>${st.n}경기, 출석률 ${st.rate}%</b></div>
        <div class="stat"><span><b>${st.mine}</b><span>내 출석</span></span><span><b>${fmtQ(st.avgQ)}</b><span>평균 쿼터</span></span><span><b style="color:#B45309">${st.mom}</b><span>MOM</span></span></div></div>
    </div>${nav("홈")}`;
}
// 1-4 알림
function mNotify() {
  const list = feed(); const r = readAt(); const n = list.filter(x => x.t > r).length;
  return `${top("알림", "#/", n ? `<button class="btn sm" data-act="readAll">모두 읽음</button>` : "")}<div class="body">
    <b style="font-size:15px">안 읽은 알림 <span style="color:#DC2626">${n}개</span></b>
    ${list.length ? `<div class="card" style="padding:4px 16px"><div class="list">${list.map(x => `<a class="li" href="${x.href}" style="text-decoration:none;color:inherit;${x.t > r ? "background:#F0FDF4;margin:0 -16px;padding:12px 16px" : ""}"><span style="width:8px;height:8px;border-radius:50%;flex:none;background:${x.t > r ? "#DC2626" : "transparent"}"></span><span style="flex:1;min-width:0"><b style="font-size:15px">${esc(x.title)}</b>${x.body ? `<br><span class="hint">${esc(x.body)}</span>` : ""}</span><span class="hint" style="flex:none;font-size:12px">${ago(x.t)}</span></a>`).join("")}</div></div>` : `<div class="card empty"><b>알림이 없어요</b></div>`}
    <span class="hint" style="text-align:center">알림은 30일 동안 보관돼요</span>
  </div>`;
}

// 2-1 일정
function voteSeg(e, v) {
  const b = (s, l) => `<button class="vote ${v.s === s ? "on " + s : ""}" data-act="mVote" data-eid="${esc(e.id)}" data-v="${s}" aria-pressed="${v.s === s}">${l}</button>`;
  return `<div class="seg3">${b("yes", "참석")}${b("late", "늦참")}${b("no", "불참")}</div>`;
}
function lateBox(e, v) {
  const n = QN[sport()];
  return `<div class="field" style="background:#FFFBEB;border-radius:14px;padding:12px"><span class="lab" style="color:#92400E">언제부터 뛸 수 있어요?</span><div class="chips">${Array.from({ length: n }, (_, i) => i + 1).map(q => `<button class="chip sm ${Number(v.q || 1) === q ? "on" : ""}" data-act="mLateQ" data-eid="${esc(e.id)}" data-q="${q}">${q}Q</button>`).join("")}</div>
    <input class="inp" data-note="${esc(e.id)}" value="${esc(v.note || "")}" maxlength="40" placeholder="한마디 (선택), 예: 일 끝나고 바로 갈게요" aria-label="한마디"></div>`;
}
function mEventCard(e) {
  const a = att(e); const v = myVote(e); const mine = !!myProfile(); const changing = MU.change === e.id;
  const sub = e.type === "match" ? (e.opponent ? "vs " + e.opponent : "상대팀 미정") : e.type === "scrim" ? "내전 (A팀 대 B팀)" : "훈련";
  const greqs = guestReqs(e).filter(g => g.u === S.uid && g.status !== "no");
  const hasLine = e.lineup && Object.keys(e.lineup).length;
  const cr = cancelRule();
  let vote = "";
  const vs = voteState(e);
  if (mine && vs === "soon") vote = `<div class="spread" style="background:#F9FAFB;border-radius:12px;padding:10px 12px;font-size:13px"><span>투표 열림 예약</span><b>${esc(md(e.openAt.slice(0, 10)) + " " + new Date(Date.parse(e.openAt) + 9 * 3600e3).toISOString().slice(11, 16))}</b></div>`;
  else if (mine && vs === "closed") vote = `<div class="spread" style="background:#F9FAFB;border-radius:12px;padding:10px 12px;font-size:13px"><span>투표가 마감됐어요</span><b>${v.s ? "내 응답 " + VS[v.s] : "응답 안 함"}</b></div>`;
  else if (mine && vs === "open") {
    if (v.s && !changing) vote = `<div class="spread" style="background:#F9FAFB;border-radius:14px;padding:10px 12px"><span class="hint">내 응답</span><span class="row" style="gap:8px"><b class="tag ${v.s === "yes" ? "" : v.s === "late" ? "" : "gray"}" style="font-size:13px;${v.s === "late" ? "background:#FEF3C7;color:#92400E" : ""}">${VS[v.s]}${v.s === "late" ? " " + (v.q || 1) + "Q부터" : ""}${a.wait.some(x => x.uid === S.uid) ? ", 대기 " + (a.wait.findIndex(x => x.uid === S.uid) + 1) + "번" : ""}</b><button class="btn sm" data-act="mChange" data-eid="${esc(e.id)}">바꾸기</button></span></div>`;
    else vote = `${changing ? `<div class="spread"><b>응답 바꾸기</b><button class="btn sm" data-act="mChange" data-eid="">닫기</button></div>` : `<div class="spread"><b style="color:#B91C1C;font-size:14px">아직 안 눌렀어요</b><span class="hint" style="font-size:12px">${closeText(e)}</span></div>`}${voteSeg(e, v)}${changing && cr && Number(cr.amount) ? `<span class="hint">${esc(cr.label)} 벌금 ${won(cr.amount)}이 있어요. 미리 바꿀수록 좋아요.</span>` : ""}`;
    if (v.s === "late" && (changing || !v.q)) vote += lateBox(e, v);
  }
  return `<div class="card">
    <a href="#/event/${esc(e.id)}" style="text-decoration:none;color:inherit;display:flex;gap:12px;align-items:center">${dateBox(e)}<span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px"><span class="row" style="gap:6px">${typeTag(e)}<b style="font-size:16px">${esc(e.time || "")}${e.end ? " ~ " + esc(e.end) : ""}</b></span><span class="hint">${esc(e.place || "장소 미정")}, ${esc(sub)}</span></span><b style="flex:none;color:#15803D;font-size:13px">${dday(e)}</b></a>
    ${vote}
    ${e.type === "scrim" && sideOf(e, S.uid) ? `<div class="spread" style="background:#EEF2FF;border-radius:12px;padding:10px 12px;font-size:13px;color:#3730A3"><span>내전, 내 팀</span><b>${sideOf(e, S.uid) === "A" ? "A팀 (조끼)" : "B팀"}</b></div>` : e.type === "scrim" ? `<span class="hint">내전이에요. 팀은 운영진이 나눠서 알려 드려요</span>` : ""}
    ${e.type === "match" && !e.opponent && !started(e) ? `<span class="hint" style="background:#EEF2FF;color:#3730A3;border-radius:12px;padding:10px 12px">신청 ${a.in + a.wait.length}명 (참석 ${a.in}${a.wait.length ? ", 대기 " + a.wait.length : ""}). 상대팀이 미정이라 3일 전까지 20명이 넘으면 내전으로 바뀔 수 있어요</span>` : ""}
    <div style="display:grid;grid-template-columns:${isPlay(e) ? "1fr 1fr" : "1fr"};gap:8px"><a class="btn sm" href="#/roster/${esc(e.id)}">참석 명단 ${a.in}명</a>${isPlay(e) ? (hasLine ? `<a class="btn sm pri" href="#/lineup/${esc(e.id)}">라인업 보기</a>` : `<span class="btn sm" style="color:#9CA3AF" aria-disabled="true">라인업 준비 중</span>`) : ""}</div>
    ${e.type !== "training" ? greqs.map(g => `<div class="spread" style="background:#F9FAFB;border-radius:12px;padding:10px 12px;font-size:13px"><span>용병 신청 1명 <b>${esc(g.name)}</b></span><span class="tag ${g.status === "ok" ? "" : "gray"}">${g.status === "ok" ? "수락됨" : "운영진 확인 중"}</span></div>`).join("") + (!started(e) && mine ? `<button data-act="mGuest" data-eid="${esc(e.id)}" style="border:0;background:none;color:#15803D;font-weight:700;padding:6px 0;min-height:40px">+ 용병 신청하기</button>` : "") : ""}
  </div>`;
}
function monthHead(m) { const [y, mo] = m.split("-").map(Number); return `<div class="spread card" style="padding:6px;flex-direction:row"><button class="iconbtn" data-act="mMonth" data-d="-1" aria-label="이전 달">‹</button><b style="font-size:16px">${y}년 ${mo}월</b><button class="iconbtn" data-act="mMonth" data-d="1" aria-label="다음 달">›</button></div>`; }
function mSchedule() {
  const m = UI.month || ym(); const list = upcoming().filter(e => e.date.slice(0, 7) === m);
  const later = upcoming().filter(e => e.date.slice(0, 7) > m).length;
  return `<header class="top" style="padding:10px 12px">${LOGO(32)}<h1 style="font-size:20px;font-weight:900">일정</h1><a class="btn sm" href="#/calendar">달력으로 보기</a></header><div class="body">
    ${monthHead(m)}
    <b style="font-size:15px;color:#374151">다가오는 일정</b>
    ${list.length ? list.map(mEventCard).join("") : `<div class="card empty"><b>${Number(m.slice(5))}월에 남은 일정이 없어요</b><span class="hint">${later ? `다음 달에 일정 ${later}개가 있어요.` : "운영진이 일정을 올리면 여기에 보여요."}</span></div>`}
  </div>${nav("일정")}`;
}
// 2-6 달력
export function mCalendar(cardFn, isAdm) {
  cardFn = typeof cardFn === "function" ? cardFn : mEventCard;
  const m = UI.month || ym(); const [y, mo] = m.split("-").map(Number);
  const first = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay(); const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const evs = Object.values(S.events).filter(e => e.date.slice(0, 7) === m);
  const byDay = {}; evs.forEach(e => { (byDay[Number(e.date.slice(8, 10))] = byDay[Number(e.date.slice(8, 10))] || []).push(e); });
  const sel = MU.day && MU.day.slice(0, 7) === m ? Number(MU.day.slice(8, 10)) : 0;
  const cells = []; for (let i = 0; i < first; i++) cells.push(`<span></span>`);
  for (let d = 1; d <= days; d++) { const es = byDay[d] || []; const ds = `${m}-${String(d).padStart(2, "0")}`; const today = ds === todayStr();
    cells.push(`<button data-act="mDay" data-d="${ds}" aria-label="${mo}월 ${d}일${es.length ? ", 일정 " + es.length + "개" : ""}" style="border:0;background:${sel === d ? "#15803D" : "transparent"};color:${sel === d ? "#FFFFFF" : today ? "#15803D" : "#111827"};border-radius:12px;height:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-weight:${today || sel === d ? 900 : 500}">${d}<span style="display:flex;gap:2px;height:6px">${es.map(e => `<span style="width:6px;height:6px;border-radius:50%;background:${sel === d ? "#FFFFFF" : e.type === "scrim" ? "#3730A3" : e.type === "training" ? "#6B7280" : "#15803D"}"></span>`).join("")}</span></button>`); }
  const dayEvs = sel ? (byDay[sel] || []) : [];
  return `<header class="top" style="padding:10px 12px">${LOGO(32)}<h1 style="font-size:20px;font-weight:900">일정</h1><a class="btn sm" href="#/schedule">목록으로 보기</a>${isAdm ? `<a class="btn sm pri" href="#/new">+ 일정</a>` : ""}</header><div class="body">
    ${monthHead(m)}
    <div class="card" style="padding:12px"><div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));text-align:center;font-size:12px;color:#6B7280;margin-bottom:4px">${[..."일월화수목금토"].map(x => `<span>${x}</span>`).join("")}</div><div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px">${cells.join("")}</div>
      <div class="row hint" style="gap:14px;justify-content:center;font-size:12px"><span class="row" style="gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:#15803D"></span>경기</span><span class="row" style="gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:#3730A3"></span>내전</span><span class="row" style="gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:#6B7280"></span>훈련</span></div></div>
    ${sel ? `<b style="font-size:15px;color:#374151">${mo}월 ${sel}일 ${"일월화수목금토"[new Date(Date.UTC(y, mo - 1, sel)).getUTCDay()]}요일</b>${dayEvs.length ? dayEvs.map(e => started(e) ? `<a class="card" href="#/game/${esc(e.id)}" style="text-decoration:none;color:inherit"><div class="row" style="gap:12px">${dateBox(e, true)}<span style="flex:1"><span class="row" style="gap:6px">${typeTag(e)}<b>${e.score ? scoreText(e) : "지난 일정"}</b></span><br><span class="hint">${esc(e.place || "")}</span></span></div></a>` : cardFn(e)).join("") : `<div class="card empty"><b>이날은 일정이 없어요</b></div>`}` : `<span class="hint" style="text-align:center">날짜를 누르면 그날 일정이 보여요</span>`}
  </div>${nav("일정")}`;
}
// 2-7 참석 명단
function mRoster(id) {
  const e = S.events[id]; if (!e) return mSchedule(); const a = att(e); const un = unclaimed();
  const tone = { 참석: "#DCFCE7;color:#166534", 늦참: "#FEF3C7;color:#92400E", 불참: "#F3F4F6;color:#374151", 대기: "#EEF2FF;color:#3730A3" };
  const grp = (t, arr, f) => `<div class="card"><div class="spread"><b>${t}</b><span class="hint">${arr.length}명</span></div>${arr.length ? `<div class="chips">${arr.map(x => `<span class="pill" style="background:${tone[t] || "#F3F4F6"};${x.uid === S.uid ? "font-weight:900" : ""}">${esc(x.name)}${x.uid === S.uid ? " (나)" : ""}${f ? f(x) : ""}</span>`).join("")}</div>` : `<span class="hint">없어요</span>`}</div>`;
  const gs = guestsOf(e);
  return `${top(md(e.date) + " 참석 명단", "#/schedule")}<div class="body">
    <div class="card"><b>${esc(md(e.date) + " " + wd(e.date) + " " + (e.time || "") + " " + evName(e))}</b><span class="hint">${a.cap ? "정원 " + a.cap + "명, " : ""}참석 ${a.in}명</span></div>
    ${e.type === "scrim" && Object.keys(e.teams || {}).length ? ["A", "B"].map(sd => { const arr = [...a.yes, ...a.late, ...a.wait].filter(x => sideOf(e, x.uid) === sd); return `<div class="card"><div class="spread"><b>${sd === "A" ? "A팀 (조끼)" : "B팀"}</b><span class="hint">${arr.length}명</span></div><div class="chips">${arr.map(x => `<span class="pill" style="background:#EEF2FF;color:#3730A3;${x.uid === S.uid ? "font-weight:900" : ""}">${esc(x.name)}${x.uid === S.uid ? " (나)" : ""}</span>`).join("")}</div></div>`; }).join("") : ""}
    ${grp("참석", a.yes)}${grp("늦참", a.late, x => x.q ? `, ${x.q}Q부터` : "")}${gs.length ? `<div class="card"><div class="spread"><b>용병</b><span class="hint">${gs.length}명</span></div><div class="chips">${gs.map(g => `<span class="pill" style="background:#F3F4F6">${esc(g.name)}</span>`).join("")}</div></div>` : ""}${grp("불참", a.no)}${a.cap ? grp("대기", a.wait) : ""}
    <div class="card"><div class="spread"><b>미응답</b><span class="hint">${a.none.length + un.length}명</span></div><div class="chips">${a.none.map(x => `<span class="pill" style="background:#FEF2F2;color:#B91C1C">${esc(x.name)}</span>`).join("")}${un.map(p => `<span class="pill" style="background:#F3F4F6;color:#6B7280">${esc(p.name)} (가입 전)</span>`).join("")}</div></div>
    ${a.cap ? `<span class="hint">정원이 차면 다음 신청은 대기로 들어가고, 자리가 나면 순서대로 올라가요</span>` : ""}
  </div>`;
}
// 일정 상세 (팀원)
function mEvent(id) {
  const e = S.events[id]; if (!e) return `${top("일정", "#/schedule")}<div class="body"><div class="card empty"><b>지워진 일정이에요</b></div></div>`;
  if (started(e)) return mGame(id);
  return `${top(md(e.date) + " " + wd(e.date) + " " + evName(e), "#/schedule")}<div class="body">${mEventCard(e)}${e.memo ? `<div class="card"><b>메모</b><div class="hint" style="white-space:pre-wrap;color:#374151">${esc(e.memo)}</div></div>` : ""}</div>`;
}
// 2-8 용병 신청
function guestSheet(eid) {
  const e = S.events[eid]; if (!e) return; const fee = Number(S.settings.guestFee) || 0;
  sheet(`<h3>용병 신청</h3><span class="hint">${esc(md(e.date) + " " + wd(e.date) + " " + (e.time || "") + " " + evName(e))}에 지인을 데려와요</span>
    <label class="field"><span class="lab">이름</span><input class="inp" id="gName" maxlength="20" placeholder="이름"></label>
    <div class="field"><span class="lab">나와의 사이</span><div class="chips">${["친구", "회사 동료", "가족", "기타"].map(x => `<button class="chip sm" data-grel="${x}">${x}</button>`).join("")}</div></div>
    <div class="field"><span class="lab">포지션</span><div class="chips">${POS[sport()].map(p => `<button class="chip sm" data-gpos="${p}">${p}</button>`).join("")}</div></div>
    <div class="hint" style="background:#F9FAFB;border-radius:12px;padding:10px 12px">운영진이 수락해야 참석 명단에 들어가요.${fee ? ` 참가비 ${won(fee)}은 경기 날 현장에서 내요.` : ""}</div>
    <div class="row"><button class="btn block" data-act="closeSheet">취소</button><button class="btn pri block" id="gSend">신청하기</button></div>`);
  let pos = "", rel = "";
  document.querySelectorAll("[data-gpos]").forEach(b => b.onclick = () => { pos = b.dataset.gpos; document.querySelectorAll("[data-gpos]").forEach(x => x.classList.toggle("on", x === b)); });
  document.querySelectorAll("[data-grel]").forEach(b => b.onclick = () => { rel = b.dataset.grel; document.querySelectorAll("[data-grel]").forEach(x => x.classList.toggle("on", x === b)); });
  $("#gSend").onclick = async () => {
    const name = $("#gName").value.trim(); if (!name) { toast("이름을 적어 주세요"); return; }
    try { await patchDoc("guestreq", S.uid, { items: { [uid36("g")]: { eid, name: name.slice(0, 20), pos, rel, at: new Date().toISOString(), status: "req" } } }); closeSheet(); render(); toast("용병 신청을 보냈어요. 운영진이 수락하면 알려 드려요"); } catch (err) { fail(err); }
  };
}

// 3-1 기록
function myLine(e) {
  const u = S.uid; if (!cameTo(e, u)) return `<span class="chips">${chipT("불참")}</span>`;
  const q = quartersOf(e, u); const g = (e.goals || []).filter(x => x.uid === u).length; const late = (e.check || {})[u] === "late";
  const fine = (((D("mydues")[u] || {}).fines) || []).find(f => f.eventId === e.id);
  return `<span class="chips" style="gap:6px">${[e.type === "scrim" && sideOf(e, u) ? chipT(sideOf(e, u) + "팀" + (q != null ? ", " + q + "쿼터" : "")) : chipT(q != null ? "내 출전 " + q + "쿼터" : "출석"), g ? chipT(g + "골", "green") : "", late ? chipT("지각" + (fine ? " " + won(fine.amount) : ""), "amber") : chipT("정시 도착", "green")].join("")}</span>`;
}
function mRecords() {
  const y = yearOf(); const evs = seasonEvents(y); const st = myStats(S.uid, y);
  const ps = people(); const attRank = ps.map(x => ({ ...x, n: evs.filter(e => cameTo(e, x.uid)).length })).sort((a, b) => b.n - a.n);
  const momC = {}; evs.filter(momClosed).forEach(e => momWinners(e).forEach(u => { momC[u] = (momC[u] || 0) + 1; }));
  const momTop = Object.entries(momC).sort((a, b) => b[1] - a[1])[0];
  const myRank = attRank.findIndex(x => x.uid === S.uid); const tie = myRank >= 0 ? attRank.filter(x => x.n === attRank[myRank].n).length > 1 : false;
  const rankNo = myRank >= 0 ? attRank.findIndex(x => x.n === attRank[myRank].n) + 1 : 0;
  const f = MU.filter; const list = evs.filter(e => f === "all" ? e.type !== "training" || true : f === "match" ? e.type === "match" : e.type === "scrim");
  return `<header class="top" style="padding:10px 12px">${LOGO(32)}<h1 style="font-size:20px;font-weight:900">기록</h1><button class="btn sm" data-act="mSeason">${y} 시즌 ▾</button></header><div class="body">
    <div class="card"><div class="spread"><b>내 기록</b><span class="hint">모임 ${st.n}번 중</span></div>${tiles([tile(st.mine, "출석"), tile(fmtQ(st.avgQ), "평균 쿼터"), tile(st.mom, "MOM", "#B45309")])}<span class="hint" style="text-align:center">지각 <b>${st.late}회</b>, 불참 <b>${st.miss}회</b>${st.goals ? ", <b>" + st.goals + "골</b>" : ""}</span></div>
    <div class="card"><b>팀 순위</b><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><span style="background:#F0FDF4;border-radius:14px;padding:12px"><span style="font-size:12px;color:#166534;font-weight:700">출석왕</span><br><b>${attRank[0] && attRank[0].n ? esc(attRank[0].name) : "-"}</b> <span class="hint">${attRank[0] && attRank[0].n ? attRank[0].n + "/" + evs.length : ""}</span></span><span style="background:#FFFBEB;border-radius:14px;padding:12px"><span style="font-size:12px;color:#92400E;font-weight:700">MOM 최다</span><br><b>${momTop ? esc(nameOf(momTop[0])) : "-"}</b> <span class="hint">${momTop ? momTop[1] + "회" : ""}</span></span></div><span class="hint">내 출석 순위 ${rankNo ? (tie ? "공동 " : "") + rankNo + "위 / " + ps.length + "명" : "-"}</span></div>
    <div class="spread"><b style="font-size:15px;color:#374151">지난 경기</b><span class="chips">${[["all", "전체"], ["match", "경기"], ["scrim", "내전"]].map(([k, l]) => `<button class="chip sm ${f === k ? "on" : ""}" data-act="mFilter" data-v="${k}">${l}</button>`).join("")}</span></div>
    ${list.length ? list.map(e => { const win = momClosed(e) ? momWinners(e) : []; return `<a class="card" href="#/game/${esc(e.id)}" style="text-decoration:none;color:inherit"><div class="row" style="gap:12px;align-items:flex-start"><span class="datebox ${e.type === "scrim" ? "" : ""}" style="${e.type === "scrim" ? "background:#EEF2FF;color:#3730A3" : e.score ? "" : "background:#F3F4F6;color:#6B7280"}"><span>${wd(e.date)}</span><b style="font-size:15px">${mmdd(e.date)}</b></span><span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px"><span class="row" style="gap:6px">${typeTag(e)}<b>${e.score ? esc(scoreText(e)) + " " + resultWord(e) : isPlay(e) ? "결과는 운영진이 곧 올려요" : esc(e.place || "훈련")}</b></span><span class="hint">${esc([e.type === "match" && e.opponent ? "vs " + e.opponent : e.place || "", win.length ? "MOM " + win.map(nameOf).join(", ") : momOpen(e) ? "MOM 투표 중" : ""].filter(Boolean).join(", "))}</span>${myLine(e)}</span><b style="color:#15803D;font-size:13px">보기</b></div></a>`; }).join("") : `<div class="card empty"><b>아직 지난 ${f === "scrim" ? "내전이" : "경기가"} 없어요</b></div>`}
  </div>${nav("기록")}`;
}
function seasonSheet() {
  const years = [...new Set(past().map(e => e.date.slice(0, 4)).concat([todayStr().slice(0, 4)]))].sort().reverse();
  sheet(`<h3>시즌 고르기</h3><div class="list">${years.map(y => { const evs = seasonEvents(y); return `<button class="li" data-act="mSeasonPick" data-y="${y}" style="border:0;border-bottom:1px solid #F3F4F6;background:none;text-align:left;width:100%"><span style="flex:1"><b>${y} 시즌</b><br><span class="hint">${y === todayStr().slice(0, 4) ? "진행 중, " : ""}모임 ${evs.length}번, 경기 ${evs.filter(isPlay).length}번</span></span>${yearOf() === y ? "✓" : ""}</button>`; }).join("")}</div><span class="hint">시즌은 매년 1월 1일에 새로 시작해요</span><button class="btn" data-act="closeSheet">닫기</button>`);
}
// 3-5 ~ 3-8 경기 보기
function mGame(id) {
  const e = S.events[id]; if (!e) return mRecords(); const u = S.uid;
  const came = people().filter(x => cameTo(e, x.uid)); const t = D("tally")["mom-" + e.id] || { n: 0, c: {} };
  const win = momClosed(e) ? momWinners(e) : []; const my = (myUv().mom || {})[e.id];
  const qn = QN[sport()]; const myQ = quarterList(e, u); const iCame = cameTo(e, u);
  const goals = {}; (e.goals || []).forEach(g => { goals[g.uid] = (goals[g.uid] || 0) + 1; });
  const fine = (((D("mydues")[u] || {}).fines) || []).find(f => f.eventId === e.id);
  const late = (e.check || {})[u] === "late"; const v = (((S.rsvp[u] || {}).ev || {})[e.id]) || {};
  const nm = x => esc(x.name) + (x.uid === u ? " (나)" : "") + (goals[x.uid] ? ` ${goals[x.uid]}골` : "");
  return `${top(md(e.date) + " " + evName(e), "#/records")}<div class="body">
    <div class="card" style="align-items:center;text-align:center;gap:8px">${typeTag(e)}<span class="hint">${esc(md(e.date) + " " + wd(e.date) + ", " + (e.place || ""))}</span>
      ${e.score ? `<div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;width:100%"><b style="text-align:right">${e.type === "scrim" ? "A팀" + (sideOf(e, u) === "A" ? " (내 팀)" : "") : esc(S.team.name)}</b><b style="font-size:40px;letter-spacing:-1px">${e.score.us} : ${e.score.them}</b><b style="text-align:left">${e.type === "scrim" ? "B팀" + (sideOf(e, u) === "B" ? " (내 팀)" : "") : esc(e.opponent || "상대")}</b></div><span class="tag" style="font-size:13px">${resultWord(e)}</span>` : isPlay(e) ? `<b>결과를 기다리고 있어요</b><span class="hint">운영진이 결과를 올리면 MOM 투표가 열리고 알림으로 알려 드려요</span>` : `<b>훈련</b>`}</div>
    ${win.length ? `<div class="card" style="flex-direction:row;align-items:center;gap:12px"><span class="av" style="background:#FEF3C7;color:#B45309">${esc(nameOf(win[0]).slice(0, 1))}</span><span style="flex:1"><span class="hint">MOM</span><br><b style="font-size:18px">${win.map(x => esc(nameOf(x))).join(", ")}</b></span><span class="hint">${came.length}명 중 ${(t.c || {})[win[0]] || 0}표</span></div>` : ""}
    ${momOpen(e) && iCame ? (my ? `<div class="card"><b>MOM 투표를 냈어요</b><span class="hint">다음 날 12시에 마감돼요. 결과는 마감 뒤에 보여요.</span></div>` : `<div class="card"><b>오늘의 MOM을 골라 주세요</b><span class="hint">익명이에요. 한 번 내면 바꿀 수 없어요.</span><div class="chips">${came.filter(x => x.uid !== u).map(x => `<button class="chip ${UI.mom === x.uid ? "on" : ""}" data-act="momPick" data-u="${esc(x.uid)}">${esc(x.name)}</button>`).join("")}</div><button class="btn pri" data-act="momSend" data-eid="${esc(e.id)}" ${UI.mom ? "" : "disabled"}>투표하기</button></div>`) : ""}
    ${iCame ? `<div class="card"><b>내 기록</b><span class="chips" style="gap:6px">${[chipT(myQ.length ? "출전 " + myQ.length + "쿼터" : "출석"), goals[u] ? chipT(goals[u] + "골", "green") : "", chipT(late ? "지각" : "정시 도착", late ? "amber" : "green"), chipT(fine ? "벌금 " + won(fine.amount) + (fine.paid ? " 납부" : " 미납") : "벌금 없음", fine && !fine.paid ? "amber" : "green")].join("")}</span>
      ${isPlay(e) ? `<span class="lab">쿼터별 출전</span><div style="display:grid;grid-template-columns:repeat(${qn},minmax(0,1fr));gap:4px">${Array.from({ length: qn }, (_, i) => i + 1).map(k => `<span style="text-align:center;border-radius:8px;padding:8px 0;font-size:13px;font-weight:700;${myQ.includes(k) ? "background:#15803D;color:#FFFFFF" : "background:#F3F4F6;color:#9CA3AF"}">${k}Q</span>`).join("")}</div>${e.lineup ? "" : `<span class="hint">라인업이 없는 경기라 쿼터 기록이 없어요</span>`}` : ""}</div>`
      : `<div class="card"><b>불참</b><span class="hint">${v.s === "no" ? "이 경기는 미리 불참으로 응답했어요. 출석률에서 빠지지만 벌금은 없어요." : "이 경기에는 출석 기록이 없어요."}</span></div>`}
    ${Object.keys(goals).length ? `<div class="card"><div class="spread"><b>골</b><span class="hint">${(e.goals || []).length}골</span></div><div class="list">${Object.entries(goals).sort((a, b) => b[1] - a[1]).map(([g, n]) => `<div class="li"><span style="flex:1">${esc(nameOf(g))}${g === u ? " (나)" : ""}</span><b>${n}골</b></div>`).join("")}</div></div>` : ""}
    ${e.type === "scrim" ? ["A", "B"].map(sd => `<div class="card"><div class="spread"><b>${sd}팀${sideOf(e, u) === sd ? " (내 팀)" : ""}</b><span class="hint">${came.filter(x => sideOf(e, x.uid) === sd).length}명</span></div><div class="chips">${came.filter(x => sideOf(e, x.uid) === sd).map(x => `<span class="pill" style="background:#F3F4F6">${nm(x)}</span>`).join("")}</div></div>`).join("")
      : `<div class="card"><div class="spread"><b>참석</b><span class="hint">${came.length}명</span></div><div class="chips">${came.map(x => `<span class="pill" style="background:${x.uid === u ? "#DCFCE7" : "#F3F4F6"}">${nm(x)}</span>`).join("") || `<span class="hint">출석 기록이 없어요</span>`}</div></div>`}
  </div>`;
}

// 4-1 회비
function mDues() {
  const o = oweNow(); const pend = pendingPay(); const mode = feeMode(); const my = D("mydues")[S.uid] || {};
  const items = ledgerItems(); const bal = items.reduce((s, x) => s + (x.type === "in" ? 1 : -1) * (Number(x.amount) || 0), 0);
  const mon = ym(); const mi = items.filter(x => String(x.date).startsWith(mon)); const inM = mi.filter(x => x.type === "in").reduce((s, x) => s + (Number(x.amount) || 0), 0), outM = mi.filter(x => x.type !== "in").reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const y = todayStr().slice(0, 4); const paidAt = my.paidAt || {};
  const hist = [];
  Object.entries(my.dues || {}).forEach(([k, v]) => { if (v === "paid") hist.push({ label: duesLabel(k), when: paidAt[k] || "", amount: Number(my.fee != null ? my.fee : S.settings.fee) || 0, key: k }); });
  (my.fines || []).forEach(f => { if (f.paid) hist.push({ label: (f.reason || "벌금") + " 벌금", when: f.paidAt || "", amount: Number(f.amount) || 0, key: f.date || "" , sub: md(f.date || todayStr()) + " 경기" }); });
  hist.sort((a, b) => String(b.when || b.key).localeCompare(String(a.when || a.key)));
  const yearTotal = hist.filter(h => String(h.when || h.key).includes(y)).reduce((s, h) => s + h.amount, 0);
  const status = pend.length ? ["확인 중", "background:#EEF2FF;color:#3730A3"] : o.total ? ["미납", "background:#FEF2F2;color:#B91C1C"] : ["완납", ""];
  return `<header class="top" style="padding:10px 12px">${LOGO(32)}<h1 style="font-size:20px;font-weight:900">회비</h1></header><div class="body">
    ${mode === "none" && !o.total ? `<div class="card"><b>회비를 받지 않는 팀이에요</b></div>` : `<div class="card"><div class="spread"><span class="hint">이번 달 낼 돈</span><span class="tag" style="${status[1]}">${status[0]}</span></div><b style="font-size:30px;letter-spacing:-1px">${won(o.total)}</b>
      ${o.items.length ? `<div class="list">${o.items.map(x => `<div class="li"><span style="flex:1"><b>${esc(x.label)}</b><br><span class="hint" style="${/지났어요/.test(x.sub) ? "color:#B91C1C" : ""}">${esc(x.sub)}</span></span><b>${won(x.amount)}</b></div>`).join("")}</div>` : `<span class="hint">이번 달은 다 냈어요.</span>`}
      ${pend.length ? `<div style="background:#EEF2FF;border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:6px"><b style="color:#3730A3">보냈어요</b><span class="hint" style="color:#3730A3">운영진에게 알렸어요. 확인되면 납부 완료로 바뀌어요.</span><button class="btn sm" data-act="mPayUndo" data-k="${esc(pend[0][0])}" style="align-self:flex-start">잘못 눌렀어요</button></div>` : o.total ? `<button class="btn pri" data-act="mPay">입금하기</button><span class="hint">보내고 나서 '보냈어요'를 누르면 운영진이 확인해요</span>` : ""}</div>`}
    <div class="card"><div class="spread"><b>팀 통장</b><span class="hint">${items[0] ? md(items[0].date) + " 기준" : ""}</span></div><b style="font-size:24px">${won(bal)}</b><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><span style="background:#F9FAFB;border-radius:12px;padding:10px 12px"><span class="hint" style="font-size:12px">${Number(mon.slice(5))}월 들어온 돈</span><br><b style="color:#15803D">+ ${won(inM)}</b></span><span style="background:#F9FAFB;border-radius:12px;padding:10px 12px"><span class="hint" style="font-size:12px">${Number(mon.slice(5))}월 나간 돈</span><br><b style="color:#B91C1C">- ${won(outM)}</b></span></div><a class="btn" href="#/ledger">통장 내역 보기</a></div>
    <div class="card"><div class="spread"><b>내 납부 내역</b><span class="hint">올해 ${won(yearTotal)}</span></div>${hist.length ? `<div class="list">${hist.map(h => `<div class="li"><span style="flex:1"><b>${esc(h.label)}</b><br><span class="hint">${h.sub ? esc(h.sub) + ", " : ""}${h.when ? md(String(h.when).slice(0, 10)) + "에 냈어요" : "냈어요"}</span></span><b>${won(h.amount)}</b><span class="tag">납부</span></div>`).join("")}</div>` : `<span class="hint">아직 낸 내역이 없어요.</span>`}</div>
  </div>${nav("회비")}`;
}
function paySheet() {
  const o = oweNow(); const b = S.settings.bank || {}; const me = (myProfile() || {}).name || nameOf(S.uid);
  sheet(`<h3>${won(o.total)} 보내기</h3><span class="hint">${esc(o.items.map(x => x.label + " " + won(x.amount)).join(", "))}</span>
    <div class="card" style="background:#F9FAFB">${b.account ? `<span class="hint">받는 계좌, 예금주 ${esc(b.holder || "")}</span><div class="spread"><b style="font-size:17px">${esc((b.bank || "") + " " + b.account)}</b><button class="btn sm" id="copyAcc">복사</button></div>` : `<span class="hint">운영진이 아직 계좌를 적지 않았어요. 운영진에게 물어봐 주세요.</span>`}</div>
    <div class="hint" style="background:#FFFBEB;color:#92400E;border-radius:12px;padding:10px 12px"><b>팁</b> 보내는 사람 이름을 ${esc(me)}(으)로 해 주세요. 운영진이 누가 보냈는지 바로 알아봐요.</div>
    <div class="row"><button class="btn block" data-act="closeSheet">나중에</button><button class="btn pri block" id="paySent">보냈어요</button></div>`);
  if ($("#copyAcc")) $("#copyAcc").onclick = async () => { try { await navigator.clipboard.writeText(b.account); toast("계좌를 복사했어요"); } catch (err) { toast("길게 눌러 복사해 주세요"); } };
  $("#paySent").onclick = async () => {
    const refs = o.items.map(x => x.kind === "dues" ? { kind: "dues", key: x.key } : { kind: "fine", id: x.id });
    try { await patchDoc("payreq", S.uid, { items: { [uid36("p")]: { refs, amount: o.total, label: o.items.map(x => x.label).join(", "), at: new Date().toISOString(), status: "req" } } }); closeSheet(); render(); toast("운영진에게 알렸어요"); } catch (err) { fail(err); }
  };
}
// 4-4 팀 통장 내역
function mLedger() {
  const items = ledgerItems(); const bal = items.reduce((s, x) => s + (x.type === "in" ? 1 : -1) * (Number(x.amount) || 0), 0); const b = S.settings.bank || {};
  const mon = ym(); const mi = items.filter(x => String(x.date).startsWith(mon)); const inM = mi.filter(x => x.type === "in").reduce((s, x) => s + (Number(x.amount) || 0), 0), outM = mi.filter(x => x.type !== "in").reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const groups = {}; items.forEach(x => { (groups[String(x.date).slice(0, 7)] = groups[String(x.date).slice(0, 7)] || []).push(x); });
  return `${top("팀 통장", "#/dues")}<div class="body">
    <div class="card"><span class="hint">${esc([b.bank, b.holder ? "예금주 " + b.holder : ""].filter(Boolean).join(", ") || S.team.name + " 통장")}</span><b style="font-size:28px">${won(bal)}</b><div class="list"><div class="li"><span style="flex:1">${Number(mon.slice(5))}월 들어온 돈</span><b style="color:#15803D">+ ${won(inM)}</b></div><div class="li"><span style="flex:1">${Number(mon.slice(5))}월 나간 돈</span><b style="color:#B91C1C">- ${won(outM)}</b></div></div></div>
    ${Object.keys(groups).length ? Object.entries(groups).map(([k, xs]) => `<b style="color:#374151">${Number(k.slice(5))}월</b><div class="card" style="padding:4px 16px"><div class="list">${xs.map(x => `<div class="li"><span class="hint" style="width:44px;flex:none">${md(x.date)}</span><span style="flex:1">${esc(x.label)}</span><b style="color:${x.type === "in" ? "#15803D" : "#B91C1C"}">${x.type === "in" ? "+" : "-"} ${won(x.amount)}</b></div>`).join("")}</div></div>`).join("") : `<div class="card empty"><b>아직 내역이 없어요</b></div>`}
    <span class="hint">팀원 모두 같은 내역을 봐요. 운영진이 적은 기록으로 만들어져요.</span>
  </div>`;
}

// 5-1 선수
function mPlayers() {
  const me = myProfile() || {}; const st = myStats(S.uid, todayStr().slice(0, 4)); const req = (S.rsvp[S.uid] || {}).posReq;
  const ps = people(); const admins = ps.filter(x => x.role !== "member"); const mem = ps.filter(x => x.role === "member").map(x => ({ ...x, kind: "m" })).concat(unclaimed().map(p => ({ kind: "p", uid: "", pid: p.id, name: p.name, role: "member", p })));
  const num = x => Number(x) || 999; mem.sort((a, b) => num(a.p.num) - num(b.p.num)); admins.sort((a, b) => (a.role === "owner" ? -1 : 0) - (b.role === "owner" ? -1 : 0));
  const row = x => x.kind === "p" ? `<div class="li"><span class="av" style="background:#F3F4F6;color:#6B7280">${esc(x.name.slice(0, 1))}</span><span style="flex:1"><b>${esc(x.name)}</b><br><span class="hint">${esc([x.p.num ? x.p.num + "번" : "", x.p.pos1].filter(Boolean).join(", "))}</span></span><span class="tag gray">가입 전</span></div>`
    : `<a class="li" href="#/player/${esc(x.uid)}" style="text-decoration:none;color:inherit"><span class="av">${esc(x.name.slice(0, 1))}</span><span style="flex:1"><b>${esc(x.name)}</b>${x.uid === S.uid ? ` <span class="hint">나</span>` : ""}${x.role !== "member" ? ` <span class="tag">${ROLE[x.role]}</span>` : ""}<br><span class="hint">${esc([x.p.num ? x.p.num + "번" : "", x.p.pos1, x.p.foot].filter(Boolean).join(", "))}</span></span><span class="hint">›</span></a>`;
  const rules = S.settings.rules || []; const agreed = (S.rsvp[S.uid] || {}).agreedAt;
  return `<header class="top" style="padding:10px 12px">${LOGO(32)}<h1 style="font-size:20px;font-weight:900">선수</h1><span class="hint">${ps.length + unclaimed().length}명</span></header><div class="body">
    <div class="card"><div class="row" style="gap:12px"><span class="av" style="width:56px;height:56px;font-size:22px">${esc((me.name || nameOf(S.uid)).slice(0, 1))}</span><span style="flex:1"><b style="font-size:18px">${esc(me.name || nameOf(S.uid))}</b> <span class="tag">${ROLE[S.role] || "팀원"}</span><br><span class="hint">${esc([me.num ? me.num + "번" : "", me.pos1, me.foot].filter(Boolean).join(", "))}</span></span></div>
      <div class="stat"><span><b>${st.mine}/${st.n}</b><span>출석</span></span><span><b>${st.goals}골</b><span>이번 시즌</span></span><span><b style="color:#B45309">${st.mom}</b><span>MOM</span></span></div>
      ${req && req.status === "req" ? `<div style="background:#EEF2FF;border-radius:12px;padding:10px 12px;font-size:13px;color:#3730A3"><b>포지션 변경 요청 중</b> ${esc(me.pos1 || "")}에서 ${esc([req.pos1, req.pos2].filter(Boolean).join(", "))}, 운영진 확인 전</div>` : ""}
      <div class="row"><a class="btn block" href="#/me">프로필 수정</a><a class="btn block" href="#/posreq">포지션 변경 요청</a></div>
      ${!isAdmin() ? ((S.members.find(m => m.user_id === S.uid) || {}).admin_req ? `<div class="spread hint"><span>운영진 신청을 보냈어요. 팀장이 수락하면 바뀌어요</span><button class="btn sm" data-act="adminCancel">취소</button></div>` : `<button class="btn sm" data-act="adminReq" style="align-self:flex-start;background:none;color:#6B7280;padding:4px 0">운영진 신청하기</button>`) : ""}</div>
    <div class="card"><div class="spread"><b>운영진</b><span class="hint">${admins.length}명</span></div><div class="list">${admins.map(row).join("")}</div></div>
    <div class="card"><div class="spread"><b>팀원</b><span class="hint">${mem.length}명</span></div><div class="list">${mem.map(row).join("")}</div></div>
    ${rules.length ? `<div class="card"><div class="spread"><b>우리 팀 수칙</b><span class="hint">${agreed ? md(agreed.slice(0, 10)) + "에 동의했어요" : ""}</span></div><div class="list">${rules.map(r => `<div class="li"><span style="flex:1">${esc(r.label)}</span>${Number(r.amount) ? `<b>${won(r.amount)}</b>` : `<span class="hint">글 수칙</span>`}</div>`).join("")}</div></div>` : ""}
    <div class="card"><div class="row" style="justify-content:space-between"><span class="hint">로그인: 카카오</span><span class="row"><button class="btn sm" data-act="switchTeam">다른 팀, 새 팀</button><button class="btn sm" data-act="logout">로그아웃</button></span></div><a class="hint" href="../../privacy.html">개인정보처리방침과 이용약관</a></div>
  </div>${nav("선수")}`;
}
// 5-2 선수 정보 (다른 선수)
function mPlayer(u) {
  const x = people().find(p => p.uid === u); if (!x) return mPlayers(); const st = myStats(u, todayStr().slice(0, 4)); const j = joinedOf(u);
  const recent = seasonEvents(todayStr().slice(0, 4)).filter(isPlay).slice(0, 5);
  return `${top("선수 정보", "#/players")}<div class="body">
    <div class="card" style="align-items:center;text-align:center"><span class="av" style="width:72px;height:72px;font-size:28px">${esc(x.name.slice(0, 1))}</span><b style="font-size:22px">${esc(x.name)} <span class="tag">${ROLE[x.role]}</span></b><span class="hint">${esc([x.p.num ? x.p.num + "번" : "", x.p.pos1, x.p.pos2, x.p.foot].filter(Boolean).join(", "))}</span>${j ? `<span class="hint">${j.slice(0, 4)}년 ${Number(j.slice(5, 7))}월에 들어왔어요</span>` : ""}</div>
    <div class="card"><span class="hint">이번 시즌</span><div class="stat"><span><b>${st.mine}/${st.n}</b><span>출석</span></span><span><b>${st.goals}골</b><span>득점</span></span><span><b style="color:#B45309">${st.mom}</b><span>MOM</span></span></div></div>
    <div class="card"><b>최근 경기</b>${recent.length ? `<div class="list">${recent.map(e => { const g = (e.goals || []).filter(z => z.uid === u).length; const mom = momClosed(e) && momWinners(e).includes(u); return `<a class="li" href="#/game/${esc(e.id)}" style="text-decoration:none;color:inherit"><span style="flex:1"><b>${md(e.date)} ${evName(e)}</b><br><span class="hint">${esc(e.place || "")}</span></span><span class="hint">${cameTo(e, u) ? [e.type === "scrim" && sideOf(e, u) ? sideOf(e, u) + "팀" : "출전", g ? g + "골" : "", mom ? "MOM" : ""].filter(Boolean).join(", ") : "불참"}</span></a>`; }).join("")}</div>` : `<span class="hint">아직 경기가 없어요.</span>`}</div>
    <span class="hint" style="text-align:center">회비와 벌금은 운영진만 볼 수 있어요.</span>
  </div>`;
}
// 5-3 프로필 수정: 포지션은 운영진이 정한다 (요청만 가능)
function mProfileEdit() {
  const f = S.form; const p = myProfile() || {};
  const taken = people().filter(x => x.uid !== S.uid && x.p.num).map(x => String(x.p.num)).concat(unclaimed().map(x => String(x.num || "")));
  const dup = f.num && taken.includes(String(f.num));
  return `${top("프로필 수정", "#/players")}<div class="body"><div class="card">
    <div style="display:flex;justify-content:center">${jersey(140, f.num, S.settings.uniformColor)}</div>
    <label class="field"><span class="lab">이름</span><input class="inp" data-bind="name" data-live-src="name" value="${esc(f.name || "")}" maxlength="20" placeholder="팀에서 부르는 이름"></label>
    <label class="field"><span class="lab">등번호</span><input class="inp" data-bind="num" data-live-src="num" value="${esc(f.num || "")}" inputmode="numeric" maxlength="3" placeholder="번호"></label>
    ${dup ? `<span class="err">다른 팀원과 번호가 겹쳐요. 그래도 저장할 수 있어요.</span>` : `<span class="hint">다른 팀원과 겹치면 알려 드려요</span>`}
    <div class="field"><span class="lab">주발</span><div class="chips">${["오른발", "왼발", "양발"].map(x => `<button class="chip ${f.foot === x ? "on" : ""}" data-act="pick" data-k="foot" data-v="${x}">${x}</button>`).join("")}</div></div>
    <a class="li" href="#/posreq" style="text-decoration:none;color:inherit;border:0"><span style="flex:1"><span class="lab">포지션</span><br><span class="hint">지금 ${esc([p.pos1, p.pos2].filter(Boolean).join(", ") || "미정")}</span></span><span style="color:#15803D;font-weight:700">변경 요청 ›</span></a>
    <span class="hint">포지션은 운영진이 정해요. 원하면 요청할 수 있어요.</span>
  </div></div><div class="cta"><button class="btn pri block" data-act="mSaveProfile">저장하기</button></div>`;
}
// 5-4 포지션 변경 요청: 여러 개 고를 수 있다
function mPosReq() {
  const f = S.form; const p = myProfile() || {}; const sel = f.want || [];
  return `${top("포지션 변경 요청", "#/players")}<div class="body"><div class="card">
    <div class="spread"><span class="lab">지금 포지션</span><b>${esc([p.pos1, p.pos2].filter(Boolean).join(", ") || "미정")}</b></div>
    <div class="field"><span class="lab">뛰고 싶은 포지션</span><div class="chips">${POS[sport()].map(x => `<button class="chip ${sel.includes(x) ? "on" : ""}" data-act="mWant" data-v="${x}">${x}</button>`).join("")}</div><span class="hint">여러 개 골라도 돼요. 먼저 고른 순서대로 1선호, 2선호예요.</span></div>
    <label class="field"><span class="lab">운영진에게 한마디</span><textarea class="inp" data-bind="note" maxlength="80" placeholder="메모">${esc(f.note || "")}</textarea></label>
    <span class="hint">운영진이 수락하면 다음 라인업부터 반영돼요.</span>
  </div></div><div class="cta"><button class="btn pri block" data-act="mPosSend" ${sel.length ? "" : "disabled"}>요청 보내기</button></div>`;
}

/* ---------- 길찾기 ---------- */
export function memberRoute(r) {
  let m;
  if (r === "/" || r === "") return mHome();
  if (r === "/notify") return mNotify();
  if (r === "/schedule") return mSchedule();
  if (r === "/calendar") return mCalendar();
  if ((m = r.match(/^\/roster\/(.+)$/))) return mRoster(decodeURIComponent(m[1]));
  if ((m = r.match(/^\/event\/(.+)$/))) return mEvent(decodeURIComponent(m[1]));
  if (r === "/records") return mRecords();
  if ((m = r.match(/^\/game\/(.+)$/))) return mGame(decodeURIComponent(m[1]));
  if (r === "/dues") return mDues();
  if (r === "/ledger") return mLedger();
  if (r === "/players") return mPlayers();
  if ((m = r.match(/^\/player\/(.+)$/))) return decodeURIComponent(m[1]) === S.uid ? mPlayers() : mPlayer(decodeURIComponent(m[1]));
  if (r === "/me") return mProfileEdit();
  if (r === "/posreq") return mPosReq();
  return null; // 공지, 라인업처럼 같이 쓰는 화면은 main.js가 그린다
}
export function memberForm(r) {
  if (r === "/me") { const p = myProfile() || {}; S.form = { name: p.name || nameOf(S.uid), num: p.num || "", foot: p.foot || "" }; return true; }
  if (r === "/posreq") { S.form = { want: [], note: "" }; return true; }
  if (/^\/(game)\//.test(r)) { S.form = {}; UI.mom = ""; return true; }
  if (r === "/schedule" || r === "/calendar") { MU.change = ""; return true; }
  return false;
}
let undoT = 0;
function toastUndo(msg, fn) {
  const L = document.getElementById("layer"); clearTimeout(undoT);
  const el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); el.style.display = "flex"; el.style.gap = "12px"; el.style.alignItems = "center";
  el.innerHTML = `<span>${esc(msg)}</span><button style="border:0;background:none;color:#86EFAC;font-weight:700;padding:4px">되돌리기</button>`;
  document.querySelectorAll(".toast").forEach(x => x.remove()); L.appendChild(el);
  el.querySelector("button").onclick = () => { el.remove(); fn(); };
  undoT = setTimeout(() => el.remove(), 4000);
}
async function saveVote(e, val, quiet) {
  const prev = { ...myVote(e) };
  try {
    await patchDoc("rsvp", S.uid, { ev: { [e.id]: val } });
    render();
    if (!quiet) toastUndo(`${md(e.date)} ${evName(e)}, ${val.s === "late" ? (val.q || 1) + "Q부터 늦참" : VS[val.s]}으로 저장했어요`, () => saveVote(e, prev.s ? { s: prev.s, q: prev.q || 0, note: prev.note || "" } : { s: "", q: 0 }, true));
  } catch (err) { fail(err); }
}
export const MACT = {
  viewAdmin: () => { setView("admin"); location.hash = "#/"; render(); },
  readAll: async () => { try { await patchDoc("uvote", S.uid, { readAt: new Date().toISOString() }); render(); toast("모두 읽음으로 바꿨어요"); } catch (err) { fail(err); } },
  mVote: t => { const e = S.events[t.dataset.eid]; if (!e) return; const v = t.dataset.v; MU.change = v === "late" ? e.id : ""; saveVote(e, { s: v, q: v === "late" ? (myVote(e).q || 1) : 0, note: v === "late" ? (myVote(e).note || "") : "" }); },
  mLateQ: t => { const e = S.events[t.dataset.eid]; if (!e) return; MU.change = ""; saveVote(e, { ...myVote(e), s: "late", q: Number(t.dataset.q) }); },
  mChange: t => { MU.change = t.dataset.eid; render(); },
  mGuest: t => guestSheet(t.dataset.eid),
  mMonth: t => { const [y, m] = (UI.month || ym()).split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + Number(t.dataset.d), 1)); UI.month = d.toISOString().slice(0, 7); MU.day = ""; render(); },
  mDay: t => { MU.day = MU.day === t.dataset.d ? "" : t.dataset.d; render(); },
  mSeason: () => seasonSheet(),
  mSeasonPick: t => { MU.season = t.dataset.y; closeSheet(); render(); },
  mFilter: t => { MU.filter = t.dataset.v; render(); },
  mPay: () => paySheet(),
  mPayUndo: t => confirmBox("보냈어요 취소", "운영진에게 보낸 입금 알림을 취소할까요?", "취소하기", async () => { try { await patchDoc("payreq", S.uid, { items: { [t.dataset.k]: { status: "cancel", doneAt: new Date().toISOString() } } }); render(); } catch (err) { fail(err); } }),
  mSaveProfile: async t => {
    const f = S.form; const name = String(f.name || "").trim(); if (!name) { toast("이름을 적어 주세요"); return; } t.disabled = true;
    try { const p = myProfile() || {}; await patchDoc("rsvp", S.uid, { profile: { ...p, name: name.slice(0, 20), num: String(f.num || "").replace(/\D/g, "").slice(0, 3), foot: f.foot || "" } }); await sb.rpc("set_my_name", { p_team: S.tid, p_name: name.slice(0, 20) }); toast("저장했어요"); location.hash = "#/players"; } catch (err) { t.disabled = false; fail(err); }
  },
  mWant: t => { const w = S.form.want = S.form.want || []; const i = w.indexOf(t.dataset.v); if (i >= 0) w.splice(i, 1); else w.push(t.dataset.v); render(); },
  mPosSend: async t => {
    const w = S.form.want || []; if (!w.length) return; t.disabled = true;
    try { await patchDoc("rsvp", S.uid, { posReq: { pos1: w[0], pos2: w[1] || "", more: w.slice(2), note: String(S.form.note || "").trim().slice(0, 80), at: new Date().toISOString(), status: "req" } }); toast("포지션 변경을 운영진에게 요청했어요"); location.hash = "#/players"; } catch (err) { t.disabled = false; fail(err); }
  },
};
// 늦참 한마디: 칸을 벗어날 때 저장
document.addEventListener("change", ev => { const t = ev.target; if (t.dataset && t.dataset.note != null) { const e = S.events[t.dataset.note]; if (e) saveVote(e, { ...myVote(e), note: t.value.trim().slice(0, 40) }, true); } });
