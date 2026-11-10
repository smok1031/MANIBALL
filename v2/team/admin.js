// 운영진 화면: 디자인 시안 [운영진] 1-1 ~ 5-9. 팀원 화면은 member.js에 있다.
import { mCalendar } from "./member.js";
import { $, D, LOGO, POS, ROLE, S, UI, att, cameTo, closeSheet, closeText, confirmBox, dotDate, duesKey, esc, evName, evStart, eventCard, fail, feeMode, guestReqs, guestsOf, isAdmin, isPlay, joinedOf, lateRow, mLabel, md, momClosed, momDeadline, momOpen, momWinners, monthsList, myProfile, myUv, myVote, nameOf, nav, noticeCard, noticesList, paidOf, parseRoster, past, patchDoc, people, profileOf, remindInfo, render, ruleAmt, scrimReady, setDoc, sheet, sport, started, toast, todayStr, top, uid36, unclaimed, upcoming, voteRow, voteState, wd, won, ym } from "./main.js";

function homeExtras() {
  const out = [];
  const rm = remindInfo(); const re = rm && S.events[rm.eid];
  if (!isAdmin() && re && !started(re) && Date.now() - Date.parse(rm.at) < 2 * 864e5 && !myVote(re).s && myProfile()) out.push(`<a class="card" href="#/event/${esc(re.id)}" style="text-decoration:none;color:inherit;background:#FEF2F2"><b style="color:#B91C1C">참석 응답을 기다리고 있어요</b><span class="hint">${esc(md(re.date) + " " + wd(re.date) + " " + (re.time || "") + " " + evName(re))}, 운영진이 미응답 알림을 보냈어요</span></a>`);
  const n = noticesList()[0];
  if (n) out.push(`<div class="spread"><b>공지</b><a href="#/notices" class="hint" style="text-decoration:none">전체</a></div>${noticeCard(n, false)}`);
  else if (!isAdmin()) out.push(`<a class="btn" href="#/notices">공지와 설문</a>`);
  past().filter(e => momOpen(e) && cameTo(e, S.uid) && !(myUv().mom || {})[e.id]).slice(0, 1).forEach(e => out.push(`<a class="card" href="#/game/${esc(e.id)}" style="text-decoration:none;color:inherit;background:#FFFBEB"><b>오늘의 MOM을 골라 주세요</b><span class="hint">${esc(md(e.date) + " " + evName(e))}, 다음 날 12시 마감</span></a>`));
  if (!isAdmin()) { const my = D("mydues")[S.uid] || {}; const owe = Object.values(my.dues || {}).filter(v => v !== "paid").length * (Number(S.settings.fee) || 0) + (my.fines || []).filter(f => !f.paid).reduce((s2, f) => s2 + (Number(f.amount) || 0), 0); if (owe) out.push(`<a class="card" href="#/dues" style="text-decoration:none;color:inherit"><div class="spread"><b>낼 돈이 있어요</b><b>${won(owe)}</b></div><span class="hint">회비 탭에서 입금하기를 눌러요</span></a>`); }
  return out.join("");
}
function vHomeAdmin() {
  const next = upcoming().find(e => !started(e)); const a = next ? att(next) : null; const todo = adminTodo();
  const mon = ym(); const key = feeMode() === "monthly" ? "m-" + mon : ""; const allP = people();
  const paidN = key ? allP.filter(x => paidOf(key, x.uid)).length : 0;
  const prN = Object.values(D("payreq")).reduce((n, d) => n + Object.values((d && d.items) || {}).filter(it => it && it.status === "req").length, 0);
  const fineSum = Object.values(D("fines")).filter(f => !f.paid).reduce((s2, f) => s2 + (Number(f.amount) || 0), 0);
  const lastPlay = past().filter(isPlay)[0]; const momTxt = !lastPlay ? ["-", "아직 경기가 없어요"] : !lastPlay.score ? ["결과 대기", `${md(lastPlay.date)} 결과를 넣으면 열려요`] : momOpen(lastPlay) ? ["투표 중", `${md(lastPlay.date)} 다음 날 12시 마감`] : [momWinners(lastPlay).map(nameOf).join(", ") || "투표 없음", `${md(lastPlay.date)} MOM`];
  const pin = noticesList()[0]; const poll = noticesList().find(n => n.poll && n !== pin);
  const st = (v, l, sub, href, c) => `<a href="${href}" style="text-decoration:none;color:inherit;background:#FFFFFF;border-radius:18px;padding:14px;display:flex;flex-direction:column;gap:2px"><span class="hint" style="font-size:12px">${l}</span><b style="font-size:20px;${c ? "color:" + c : ""}">${v}</b><span class="hint" style="font-size:12px">${sub}</span></a>`;
  return `<header class="top" style="padding:10px 4px 10px 12px">${LOGO(32)}<span style="flex:1;line-height:1.2"><b style="font-size:17px">${esc(S.team.name)}</b><br><span class="hint" style="font-size:12px">${sport() === "soccer" ? "축구팀" : "풋살팀"}, 팀원 ${S.members.length + unclaimed().length}명</span></span>${S.teams.length > 1 ? `<button class="iconbtn" data-act="switchTeam" aria-label="다른 팀">⇄</button>` : ""}${ABELL()}</header>
  <div class="body">
    ${weekStrip()}
    <div class="card"><div class="spread"><b style="font-size:16px">운영진이 할 일 ${todo.length}개</b><span class="hint">${Number(todayStr().slice(5, 7))}월 ${Number(todayStr().slice(8, 10))}일 ${"일월화수목금토"[new Date(todayStr() + "T00:00:00Z").getUTCDay()]}요일</span></div>
      ${todo.length ? `<div class="list">${todo.map(t => `<div class="li"><span style="flex:1;min-width:0"><b style="font-size:15px">${esc(t[0])}</b><br><span class="hint">${esc(t[1])}</span></span><a class="btn sm" href="${t[2]}" style="flex:none">${esc(t[3])}</a></div>`).join("")}</div>` : `<span class="hint">할 일을 다 했어요.</span>`}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      ${st(next ? `${a.in}${a.cap ? " / " + a.cap : ""}` : "-", "참석", next ? `${md(next.date)}, 미응답 ${a.none.length + unclaimed().length}명` : "일정 없음", next ? "#/event/" + next.id : "#/new")}
      ${st(key ? `${paidN} / ${allP.length}` : feeMode() === "per_game" ? "경기마다" : "-", `${Number(mon.slice(5))}월 회비`, prN ? `입금 확인 ${prN}건` : "입금 확인 없음", "#/dues", "")}
      ${st(won(fineSum), "벌금 미납", "현재 금액 합계", "#/dues", fineSum ? "#B91C1C" : "")}
      ${st(esc(momTxt[0]), "MOM", esc(momTxt[1]), lastPlay ? "#/game/" + lastPlay.id : "#/records", "#B45309")}
    </div>
    <div class="spread"><b>공지</b><a class="hint" href="#/notices" style="text-decoration:none">전체 ›</a></div>
    ${pin ? `<a class="card" href="#/notices" style="text-decoration:none;color:inherit;gap:6px">${pin.pinned ? `<span class="tag" style="align-self:flex-start">고정</span>` : ""}<b>${esc(pin.title)}</b></a>` : `<a class="card" href="#/notice-new" style="text-decoration:none;color:inherit"><b>공지를 써 보세요</b><span class="hint">팀원 알림함에 바로 보여요</span></a>`}
    ${poll ? `<a class="card" href="#/notices" style="text-decoration:none;color:inherit;gap:6px"><span class="tag blue" style="align-self:flex-start">설문</span><b>${esc(poll.title)}</b><span class="hint">${(D("tally")["poll-" + poll.id] || {}).n || 0}명 참여</span></a>` : ""}
    ${myProfile() ? `<button class="btn" data-act="viewMember">팀원 화면 보기 (내 참석, 내 선수 카드)</button>` : `<div class="card"><b>나도 선수로 등록하기</b><span class="hint">팀장도 선수로 등록하면 참석을 누르고 명단에 보여요.</span><a class="btn" href="${unclaimed().length ? "#/claim" : "#/me"}">선수 등록</a></div>`}
  </div>${nav("홈")}`;
}
function vSchedule() {
  if (isAdmin()) return vScheduleAdmin();
  const ev = upcoming();
  return `<header class="top"><span style="width:8px"></span><h1>일정</h1></header><div class="body">
    ${ev.length ? ev.map(e => eventCard(e)).join("") : `<div class="card empty"><b>다가오는 일정이 없어요</b><span class="hint">운영진이 일정을 올리면 여기에 보여요.</span></div>`}
    ${past().length ? `<b style="margin-top:8px">지난 일정</b>${past().slice(0, 10).map(e => eventCard(e, { noVote: true })).join("")}` : ""}
  </div>${nav("일정")}`;
}
const REMIND_GAP = 3600e3;
const remindLeft = () => { const r = remindInfo(); return r && r.at ? Math.max(0, Date.parse(r.at) + REMIND_GAP - Date.now()) : 0; };
function adminEventCard(e, opt = {}) {
  const a = att(e); const closed = started(e); const pct = a.cap ? Math.min(100, Math.round(a.in * 100 / a.cap)) : 0;
  const greq = guestReqs(e).filter(g => g.status === "req").length; const un = unclaimed().length;
  const sub = e.type === "match" ? (e.opponent ? "vs " + e.opponent : "상대팀 미정") : e.type === "scrim" ? "내전 (A팀 대 B팀)" : "훈련";
  return `<div class="card">
    <div class="row" style="gap:12px"><a href="#/event/${esc(e.id)}" style="text-decoration:none;color:inherit;display:flex;gap:12px;align-items:center;flex:1;min-width:0"><span class="datebox ${closed ? "gray" : ""}"><span>${wd(e.date)}</span><b>${Number(e.date.slice(8, 10))}</b></span><span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px"><span class="row" style="gap:6px"><span class="tag ${e.type === "training" ? "blue" : ""}">${e.type === "match" ? "경기" : e.type === "scrim" ? "내전" : "훈련"}</span><b style="font-size:16px">${esc(e.time || "")}${e.end ? " ~ " + esc(e.end) : ""}</b></span><span class="hint">${esc(e.place || "장소 미정")}, ${esc(sub)}</span></span></a>${closed || opt.detail ? "" : `<a href="#/edit/${esc(e.id)}" class="hint" style="text-decoration:none;padding:8px 0;flex:none">수정</a>`}</div>
    ${closed ? `<div class="spread hint"><span>출석 ${Object.values(e.check || {}).filter(v => v === "in" || v === "late").length}명${e.score ? `, 결과 ${e.score.us} : ${e.score.them}` : ""}</span>${isPlay(e) && !e.score ? `<a href="#/result/${esc(e.id)}" style="font-weight:700;text-decoration:none">결과 입력</a>` : `<a href="#/event/${esc(e.id)}" style="text-decoration:none">보기</a>`}</div>` : `
    <div class="field" style="gap:6px"><div class="spread" style="font-size:13px"><span>참석 <b>${a.in}</b>${a.cap ? " / 정원 " + a.cap : ""}${a.late.length ? ", 늦참 " + a.late.length : ""}${a.no.length ? ", 불참 " + a.no.length : ""}${a.wait.length ? ", 대기 <b>" + a.wait.length + "</b>" : ""}</span><span style="color:#B91C1C;font-weight:700">미응답 ${a.none.length + un}</span></div>
      ${a.cap ? `<div style="height:8px;border-radius:999px;background:#E5E7EB;overflow:hidden"><div style="width:${pct}%;height:100%;background:#15803D"></div></div>` : ""}
      <span class="hint" style="font-size:12px">${voteState(e) === "soon" ? "투표 열림 예약 " + md(e.openAt.slice(0, 10)) : closeText(e)}${a.wait.length ? ", 대기 " + a.wait.length + "명" : ""}${un ? `. 미응답 중 ${un}명은 아직 앱에 안 들어왔어요` : ""}</span></div>
    ${greq ? `<div class="spread" style="background:#FFFBEB;border-radius:12px;padding:10px 12px;font-size:13px;color:#92400E"><span><b>용병 신청 ${greq}건</b> 수락을 기다려요</span><a href="#/guests/${esc(e.id)}" style="font-weight:700;text-decoration:none;color:#92400E">확인</a></div>` : ""}
    ${scrimReady(e) ? `<div style="display:flex;flex-direction:column;gap:10px;background:#EEF2FF;border-radius:14px;padding:12px 14px"><span style="font-size:13px;color:#3730A3;line-height:1.5"><b>내전 가능</b> 상대팀이 미정이고 참석과 대기를 합쳐 ${a.in + a.wait.length}명이에요.</span><a class="btn sm" href="#/scrim/${esc(e.id)}" style="background:#3730A3;color:#FFFFFF">내전 검토하기</a></div>` : ""}
    <div style="display:grid;grid-template-columns:repeat(${e.type === "training" ? 2 : 3},minmax(0,1fr));gap:8px"><button class="btn sm" data-act="remindOpen" data-eid="${esc(e.id)}" style="background:#FEF2F2;color:#B91C1C;font-size:13px;padding:8px 2px;white-space:nowrap">미응답 알리기</button>${e.type !== "training" ? `<a class="btn sm pri" href="#/lineup/${esc(e.id)}" style="font-size:13px;padding:8px 2px;white-space:nowrap">라인업 짜기</a>` : ""}<a class="btn sm" href="#/check/${esc(e.id)}" style="font-size:13px;padding:8px 2px;white-space:nowrap">현장 출석</a></div>`}
  </div>`;
}
function vScheduleAdmin() {
  const m = UI.month || ym(); const [y, mo] = m.split("-").map(Number);
  const inMonth = e => e.date.slice(0, 7) === m;
  const up = upcoming().filter(inMonth), done = past().filter(inMonth);
  const later = upcoming().filter(e => e.date.slice(0, 7) > m).length;
  return `<header class="top" style="padding:10px 12px">${LOGO(32)}<h1 style="font-size:20px;font-weight:900">일정</h1><a class="btn sm" href="#/calendar">달력</a><a class="btn sm pri" href="#/new">+ 일정 만들기</a></header><div class="body">
    <div class="spread card" style="padding:6px;flex-direction:row"><button class="iconbtn" data-act="monthGo" data-d="-1" aria-label="이전 달">‹</button><b style="font-size:16px">${y}년 ${mo}월</b><button class="iconbtn" data-act="monthGo" data-d="1" aria-label="다음 달">›</button></div>
    <b style="font-size:15px;color:#374151">다가오는 일정</b>
    ${up.length ? up.map(adminEventCard).join("") : `<div class="card empty"><b>${mo}월에 남은 일정이 없어요</b><span class="hint">${later ? `다음 달에 일정 ${later}개가 있어요.` : "일정을 만들면 팀원이 참석을 눌러요."}</span><a class="btn pri" href="#/new">일정 만들기</a></div>`}
    ${done.length ? `<b style="font-size:15px;color:#374151;margin-top:8px">지난 일정</b>${done.map(adminEventCard).join("")}` : ""}
  </div>${nav("일정")}`;
}
function remindSheet(eid) {
  const e = S.events[eid]; if (!e) return; const a = att(e); const un = unclaimed();
  const left = remindLeft(); const r = remindInfo();
  const ago = r && r.at ? Math.max(1, Math.round((Date.now() - Date.parse(r.at)) / 60000)) : 0;
  const agoTxt = ago < 60 ? ago + "분 전" : Math.round(ago / 60) + "시간 전";
  sheet(`<h3>미응답 ${a.none.length + un.length}명에게 알려요</h3><span class="hint">${esc(md(e.date) + " " + wd(e.date) + " " + (e.time || "") + " " + evName(e))}, ${closeText(e)}</span>
    <div class="list" style="max-height:36vh;overflow:auto">${a.none.map(x => `<label class="li" style="cursor:pointer"><input type="checkbox" data-rm="${esc(x.uid)}" checked style="width:22px;height:22px;accent-color:#15803D"><b style="flex:1">${esc(x.name)}</b><span class="hint">앱 알림</span></label>`).join("")}${un.map(p => `<div class="li"><span style="width:22px"></span><b style="flex:1">${esc(p.name)}</b><span class="tag gray">가입 전, 단톡방 문구로</span></div>`).join("")}${a.none.length + un.length ? "" : `<span class="hint">미응답이 없어요.</span>`}</div>
    <div style="background:#FFFBEB;border-radius:14px;padding:12px 14px;font-size:13px;line-height:1.5;color:#92400E"><b>미응답 알림은 1시간에 한 번만 보낼 수 있어요</b><br>운영진 모두 합친 횟수예요.${r && r.at ? ` 마지막 알림은 ${agoTxt} ${esc(nameOf(r.by))} 님이 보냈어요.` : ""}</div>
    <div class="row"><button class="btn block" data-act="closeSheet">취소</button>${left ? `<button class="btn block" disabled>${Math.ceil(left / 60000)}분 뒤 가능</button>` : `<button class="btn pri block" data-act="remindSend" data-eid="${esc(e.id)}" ${a.none.length + un.length ? "" : "disabled"}>알림 보내기</button>`}</div>`);
}
function vEvent(id) {
  const e = S.events[id]; if (!e) return `${top("일정", "#/schedule")}<div class="body"><div class="card empty"><b>지워진 일정이에요</b></div></div>`;
  const a = att(e); const adm = isAdmin(); const day = e.date <= todayStr();
  const grp = (t, arr, fmt) => `<div class="card"><div class="spread"><b>${t}</b><span class="hint">${arr.length}명</span></div>${arr.length ? `<div class="chips">${arr.map(x => `<span class="pill" style="background:#F3F4F6">${esc(x.name)}${fmt ? fmt(x) : ""}</span>`).join("")}</div>` : `<span class="hint">없어요</span>`}</div>`;
  const gs = guestsOf(e); const greq = guestReqs(e); const myG = greq.filter(g => g.u === S.uid);
  const hasLine = e.lineup && Object.keys(e.lineup).length;
  const tools = [];
  if (adm && day && started(e)) tools.push(`<a class="btn block" href="#/check/${esc(e.id)}">현장 출석</a>`);
  if (isPlay(e) && ((adm && started(e)) || (!adm && hasLine))) tools.push(`<a class="btn block" href="#/lineup/${esc(e.id)}">라인업</a>`);
  if (e.type === "scrim" && adm) tools.push(`<a class="btn block" href="#/squad/${esc(e.id)}">스쿼드 나누기</a>`);
  if (started(e) && isPlay(e)) tools.push(`<a class="btn block" href="#/game/${esc(e.id)}">결과와 MOM</a>`);
  const T = e.teams || {};
  const mv = myVote(e);
  return `${top(md(e.date) + " " + wd(e.date) + " " + evName(e), "#/schedule", adm ? `<a class="btn sm" href="#/edit/${esc(e.id)}">수정</a>` : "")}<div class="body">
    ${adm ? adminEventCard(e, { detail: true }) + (myProfile() && !started(e) ? `<div class="card"><b>내 참석</b>${voteRow(e, mv)}${mv.s === "late" ? lateRow(e, mv) : ""}</div>` : "") : eventCard(e)}
    ${adm && scrimReady(e) ? `<div class="card" style="background:#FFFBEB"><b>내전을 할 수 있어요</b><span class="hint">상대팀이 미정이고 참석과 대기를 합쳐 ${a.in + a.wait.length}명이에요. 운영진끼리 상의해서 내전으로 바꾸면 팀원 모두에게 보여요.</span><button class="btn pri" data-act="scrimConvert" data-eid="${esc(e.id)}">내전으로 바꾸기</button></div>` : ""}
    ${tools.length ? `<div class="row" style="flex-wrap:wrap">${tools.join("")}</div>` : ""}
    ${e.memo ? `<div class="card"><b>메모</b><div class="hint" style="white-space:pre-wrap;color:#374151">${esc(e.memo)}</div></div>` : ""}
    ${e.type === "scrim" ? grp("A팀 (조끼)", [...a.yes, ...a.late, ...a.wait].filter(x => T[x.uid] === "A")) + grp("B팀", [...a.yes, ...a.late, ...a.wait].filter(x => T[x.uid] === "B")) : ""}
    ${grp("참석", a.yes)}${grp("늦참", a.late, x => x.q ? `, ${x.q}Q부터` : "")}${a.cap ? grp("대기", a.wait, () => "") : ""}${grp("불참", a.no)}${grp("미응답", a.none)}${unclaimed().length ? `<span class="hint">아직 앱에 안 들어온 선수 ${unclaimed().length}명은 참석을 누를 수 없어요. 초대 링크로 들어와 이름을 고르면 돼요.</span>` : ""}
    ${a.cap ? `<span class="hint">정원이 차면 다음 신청은 대기로 들어가고, 자리가 나면 순서대로 올라가요.</span>` : ""}
    ${e.type !== "training" ? `<div class="card"><div class="spread"><b>용병</b><span class="hint">${gs.length}명</span></div>
      ${gs.length ? `<div class="list">${gs.map(g => `<div class="li"><span style="flex:1"><b>${esc(g.name)}</b><br><span class="hint">${esc([g.pos, nameOf(g.by) + " 님 지인"].filter(Boolean).join(", "))}</span></span>${adm ? `<button class="iconbtn" data-act="guestDel" data-eid="${esc(e.id)}" data-g="${esc(g.id)}" aria-label="빼기">✕</button>` : ""}</div>`).join("")}</div>` : ""}
      ${adm ? greq.filter(g => g.status === "req").map(g => `<div class="li" style="background:#F9FAFB;border-radius:12px;padding:10px"><span style="flex:1"><b>${esc(g.name)}</b> 신청<br><span class="hint">${esc([g.pos, g.rel, nameOf(g.u) + " 님이 신청"].filter(Boolean).join(", "))}</span></span><button class="btn sm" data-act="guestNo" data-u="${esc(g.u)}" data-k="${esc(g.k)}">거절</button><button class="btn sm pri" data-act="guestOk" data-eid="${esc(e.id)}" data-u="${esc(g.u)}" data-k="${esc(g.k)}">수락</button></div>`).join("") : myG.map(g => `<span class="hint">${esc(g.name)} 신청: ${g.status === "ok" ? "수락됐어요" : g.status === "no" ? "이번에는 어려워요" : "운영진이 보고 있어요"}</span>`).join("")}
      ${!started(e) && myProfile() ? `<button class="btn" data-act="guestReq" data-eid="${esc(e.id)}">+ 용병 신청</button>` : ""}</div>` : ""}
  </div>`;
}
function vEventForm(id) {
  const f = S.form; const isNew = !id;
  const chip = (k, v, l) => `<button class="chip sm ${String(f[k]) === String(v) ? "on" : ""}" data-act="pick" data-k="${k}" data-v="${v}">${l}</button>`;
  const places = [...new Set(Object.values(S.events).sort((a, b) => b.date.localeCompare(a.date)).map(e => e.place).filter(Boolean))].slice(0, 3);
  const dates = nextDates(); const custom = f.date && !dates.includes(f.date);
  const fixed = f.oppMode === "set";
  return `${top(isNew ? "일정 만들기" : "일정 수정", isNew ? "#/schedule" : "#/event/" + id)}<div class="body">
    ${f.type === "scrim" ? `<div class="hint" style="background:#EEF2FF;color:#3730A3;border-radius:14px;padding:12px">내전으로 바뀐 일정이에요. A팀과 B팀은 스쿼드에서 정해요.</div>` : `<div class="hint" style="background:#F9FAFB;border-radius:14px;padding:12px">내전 일정은 경기로 만들어요. 상대팀이 미정이고 참석과 대기를 합쳐 20명 이상이 경기 3일 전까지 유지될 때만 내전으로 바꿀 수 있어요.</div>`}
    <div class="card">
      ${f.type === "scrim" ? "" : `<div class="field"><span class="lab">종류</span><div class="chips">${chip("type", "match", "경기")}${chip("type", "training", "훈련")}</div></div>`}
      <div class="field"><span class="lab">날짜</span><div class="chips">${dates.map(d => chip("date", d, md(d) + " " + wd(d))).join("")}<button class="chip sm ${custom ? "on" : ""}" data-act="pick" data-k="dateCustom" data-v="${f.dateCustom ? "" : "1"}">직접 고르기</button></div>${f.dateCustom || custom ? `<input class="inp" type="date" data-bind="date" value="${esc(f.date || "")}" min="${todayStr()}" aria-label="날짜">` : ""}</div>
      <div class="row" style="gap:8px"><label class="field" style="flex:1"><span class="lab">시작</span><input class="inp" type="time" data-bind="time" value="${esc(f.time || "")}"></label><label class="field" style="flex:1"><span class="lab">끝</span><input class="inp" type="time" data-bind="end" value="${esc(f.end || "")}"></label></div>
      <div class="field"><span class="lab">장소</span><input class="inp" data-bind="place" value="${esc(f.place || "")}" maxlength="40" placeholder="구장" aria-label="장소">${places.length ? `<div class="chips"><span class="hint">최근</span>${places.map(p => `<button class="chip sm ${f.place === p ? "on" : ""}" data-act="pick" data-k="place" data-v="${esc(p)}">${esc(p)}</button>`).join("")}</div>` : ""}</div>
      ${f.type === "match" ? `<div class="field"><span class="lab">상대팀</span><div class="chips">${chip("oppMode", "none", "미정")}${chip("oppMode", "set", "정해짐")}</div>${fixed ? `<input class="inp" data-bind="opponent" value="${esc(f.opponent || "")}" maxlength="30" placeholder="팀 이름" aria-label="상대팀 이름"><span class="hint">매칭된 팀이 있어서 이 일정은 내전으로 바꿀 수 없어요</span>` : `<span class="hint">미정이면 참석과 대기가 20명이 넘을 때 내전으로 바꿀 수 있어요</span>`}</div>` : ""}
    </div>
    <div class="card">
      <div class="field"><span class="lab">참석 투표</span><div class="chips">${chip("openMode", "now", "올리면 바로 열기")}${chip("openMode", "later", "열림 예약")}</div>${f.openMode === "later" ? `<input class="inp" type="datetime-local" data-bind="openAt" value="${esc(f.openAt || "")}" aria-label="투표 열 시각">` : ""}</div>
      <div class="field"><span class="lab">투표 마감</span><div class="chips">${chip("voteClose", "start", "경기 시작 전까지")}${chip("voteClose", "eve21", "경기 전날 21:00")}${chip("voteClose", "day06", "경기 당일 06:00")}</div><span class="hint">마감이 지나면 참석, 늦참, 불참을 바꿀 수 없어요</span></div>
      <div class="field"><span class="lab">정원</span><div class="row"><button class="btn sm" data-act="cap" data-d="-1" aria-label="정원 줄이기">−</button><b style="min-width:72px;text-align:center">${Number(f.cap) ? f.cap + "명" : "제한 없음"}</b><button class="btn sm" data-act="cap" data-d="1" aria-label="정원 늘리기">+</button></div></div>
      ${Number(f.cap) ? `<div class="field"><span class="lab">대기</span><div class="row"><button class="btn sm" data-act="aWait" data-d="-1" aria-label="대기 줄이기">−</button><b style="min-width:72px;text-align:center">${Number(f.waitCap) ? f.waitCap + "명" : "제한 없음"}</b><button class="btn sm" data-act="aWait" data-d="1" aria-label="대기 늘리기">+</button></div><span class="hint">정원이 차면 순서대로 기다려요</span></div>` : ""}
      ${f.type === "match" ? `<div class="spread hint"><span>내전 알림</span><b style="color:${fixed ? "#6B7280" : "#3730A3"}">${fixed ? "불가, 상대팀이 정해져 있어요" : "가능, 20명이 넘으면 알려 드려요"}</b></div>` : ""}
      <label class="field"><span class="lab">메모</span><textarea class="inp" data-bind="memo" placeholder="준비물, 주차 같은 안내" style="min-height:72px">${esc(f.memo || "")}</textarea></label>
    </div>
    ${isNew ? "" : `<button class="btn danger" data-act="delEvent" data-eid="${esc(id)}">일정 지우기</button>`}
  </div><div class="cta"><button class="btn pri block" data-act="aSaveEvent" data-eid="${esc(id || "")}">${isNew ? "일정 올리기" : "저장"}</button></div>`;
}
function vPlayers() {
  const num = x => Number(x) || 999;
  const ps = people().map(x => ({ ...x, kind: "m" }));
  const un = unclaimed().map(p => ({ kind: "p", uid: "", pid: p.id, role: "member", name: p.name, p }));
  const all = ps.concat(un).sort((a, b) => num(a.p.num) - num(b.p.num) || a.name.localeCompare(b.name, "ko"));
  const row = x => x.kind === "p"
    ? `<div class="li" data-act="rosterOpen" data-pid="${esc(x.pid)}" role="button" tabindex="0" style="cursor:pointer"><span class="av" style="background:#F3F4F6;color:#6B7280">${esc(x.p.num || x.name.slice(0, 1))}</span><span style="flex:1;min-width:0"><b>${esc(x.name)}</b><br><span class="hint">${x.p.num ? esc(x.p.num) + "번, " : ""}${esc([x.p.pos1, x.p.pos2].filter(Boolean).join(", "))}</span></span><span class="tag gray">가입 전</span></div>`
    : `<div class="li" ${isAdmin() || x.uid === S.uid ? `data-act="playerOpen" data-u="${esc(x.uid)}" role="button" tabindex="0" style="cursor:pointer"` : ""}><span class="av">${esc(x.p.num || x.name.slice(0, 1))}</span><span style="flex:1;min-width:0"><b>${esc(x.name)}</b>${x.uid === S.uid ? ` <span class="hint">나</span>` : ""}<br><span class="hint">${x.p.num ? esc(x.p.num) + "번, " : ""}${esc([x.p.pos1, x.p.pos2].filter(Boolean).join(", ") || (profileOf(x.uid) ? "포지션 미정" : "선수 등록 전"))}</span></span>${isAdmin() && ((S.rsvp[x.uid] || {}).posReq || {}).status === "req" ? `<span class="tag blue">포지션 요청</span>` : ""}${S.role === "owner" && x.role === "member" && (S.members.find(m => m.user_id === x.uid) || {}).admin_req ? `<span class="tag blue">운영진 신청</span>` : ""}${x.role !== "member" ? `<span class="tag">${ROLE[x.role]}</span>` : ""}</div>`;
  return `<header class="top"><span style="width:8px"></span><h1>선수</h1>${isAdmin() ? `<a class="btn sm" href="#/settings">팀 설정</a><a class="btn sm pri" href="#/invite">+ 초대</a>` : ""}</header><div class="body">
    <div class="card"><div class="spread"><b>${all.length}명</b><span class="hint">앱에 들어옴 ${ps.length}명${un.length ? `, 가입 전 ${un.length}명` : ""}</span></div>
      <div class="list">${all.map(row).join("")}</div>
      <span class="hint">${isAdmin() ? "이름을 누르면 권한, 요청, 내보내기를 볼 수 있어요. 가입 전 선수는 초대 링크로 들어와 자기 이름을 고르면 연결돼요." : "내 이름을 누르면 프로필과 운영진 신청을 볼 수 있어요."}</span>
    </div>
    ${isAdmin() ? `<a class="btn" href="#/roster-import">명단 붙여 넣어 한 번에 등록</a>` : ""}
    ${myProfile() && !isAdmin() ? `<a class="btn" href="#/posreq">포지션 변경 요청</a>` : ""}
    ${S.settings.rules && S.settings.rules.length ? `<div class="card"><b>우리 팀 수칙</b><div class="list">${S.settings.rules.map(r => `<div class="li"><span style="flex:1">${esc(r.label)}</span>${Number(r.amount) ? `<b>${won(r.amount)}</b>` : ""}</div>`).join("")}</div></div>` : ""}
    <div class="card"><div class="row" style="justify-content:space-between"><span class="hint">로그인: 카카오</span><span class="row"><button class="btn sm" data-act="switchTeam">다른 팀, 새 팀</button><button class="btn sm" data-act="logout">로그아웃</button></span></div><a class="hint" href="../../privacy.html">개인정보처리방침과 이용약관</a></div>
  </div>${nav("선수")}`;
}
function vDues() {
  if (!isAdmin()) return vDuesMember();
  const mode = feeMode(); const reqs = [];
  Object.entries(D("payreq")).forEach(([u, d]) => Object.entries((d && d.items) || {}).forEach(([k, it]) => { if (it && it.status === "req") reqs.push({ u, k, ...it }); }));
  let body = "";
  if (mode === "none") body = `<div class="card"><b>회비를 받지 않는 팀이에요</b><span class="hint">팀 설정에서 월회비나 경기마다로 바꿀 수 있어요.</span><a class="btn sm" href="#/settings" style="align-self:flex-start">팀 설정</a></div>`;
  else {
    const refs = mode === "monthly" ? monthsList() : past().filter(isPlay).slice(0, 12).map(e => e.id);
    if (!UI.ref || !refs.includes(UI.ref)) UI.ref = refs[0] || "";
    const key = duesKey(UI.ref); const ev = mode === "per_game" ? S.events[UI.ref] : null;
    const who = people().filter(x => mode === "monthly" || (ev && cameTo(ev, x.uid)));
    const paid = who.filter(x => paidOf(key, x.uid));
    body = `<div class="card"><div class="chips">${refs.map(r => `<button class="chip sm ${r === UI.ref ? "on" : ""}" data-act="duesRef" data-v="${esc(r)}">${mode === "monthly" ? mLabel(r) : esc(md(S.events[r].date) + " " + evName(S.events[r]))}</button>`).join("") || `<span class="hint">아직 끝난 경기가 없어요</span>`}</div>
      ${UI.ref ? `<div class="spread"><span><b style="font-size:26px">${paid.length}</b> / ${who.length}명</span><b>${won(paid.length * (Number(S.settings.fee) || 0))}</b></div>
      <div class="list">${who.map(x => `<div class="li"><span style="flex:1"><b>${esc(x.name)}</b></span>${paidOf(key, x.uid) ? `<span class="tag">납부</span>` : `<span class="tag gray">미납</span>`}<button class="btn sm" data-act="duesToggle" data-key="${esc(key)}" data-u="${esc(x.uid)}">${paidOf(key, x.uid) ? "취소" : "받음"}</button></div>`).join("")}</div>
      ${who.length > paid.length ? `<button class="btn" data-act="duesRemind">미납 ${who.length - paid.length}명에게 보낼 문구 복사</button>` : ""}` : ""}</div>`;
  }
  const unpaidF = Object.entries(D("fines")).map(([id, f]) => ({ id, ...f })).filter(f => !f.paid).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return `<header class="top"><span style="width:8px"></span><h1>회비</h1><a class="btn sm" href="#/dues-settings">회비 설정</a></header><div class="body">
    ${reqs.length ? `<div class="card"><div class="spread"><b>입금 확인 요청</b><span class="tag">${reqs.length}건</span></div><div class="list">${reqs.map(r => `<div class="li"><span style="flex:1"><b>${esc(nameOf(r.u))}</b><br><span class="hint">${esc(r.label || "")}, ${won(r.amount)}</span></span><button class="btn sm" data-act="payNo" data-u="${esc(r.u)}" data-k="${esc(r.k)}">아님</button><button class="btn sm pri" data-act="payOk" data-u="${esc(r.u)}" data-k="${esc(r.k)}">확인</button></div>`).join("")}</div><span class="hint">통장에 들어온 게 맞는지 보고 눌러 주세요.</span></div>` : ""}
    ${body}
    <div class="card"><div class="spread"><b>벌금 미납</b><b>${won(unpaidF.reduce((s, f) => s + (Number(f.amount) || 0), 0))}</b></div>${unpaidF.length ? `<div class="list">${unpaidF.map(f => `<div class="li"><span style="flex:1"><b>${esc(nameOf(f.uid))}</b><br><span class="hint">${esc(md(f.date || todayStr()))} ${esc(f.reason)}</span></span><b>${won(f.amount)}</b><button class="btn sm" data-act="fineToggle" data-id="${esc(f.id)}">받음</button></div>`).join("")}</div>` : `<span class="hint">미납 벌금이 없어요.</span>`}<span class="hint">벌금은 현장 출석에서 팀 수칙대로 매겨져요.</span></div>
    <a class="btn" href="#/ledger">팀 통장 보기</a>
  </div>${nav("회비")}`;
}
function vDuesSettings() {
  const f = S.form;
  return `${top("회비 설정", "#/dues")}<div class="body"><div class="card">
    <label class="field"><span class="lab">은행</span><input class="inp" data-bind="bank" value="${esc(f.bank || "")}" placeholder="예: 카카오뱅크"></label>
    <label class="field"><span class="lab">계좌번호</span><input class="inp" data-bind="account" value="${esc(f.account || "")}" inputmode="numeric" placeholder="예: 3333-01-1234567"></label>
    <label class="field"><span class="lab">예금주</span><input class="inp" data-bind="holder" value="${esc(f.holder || "")}" placeholder="예: 정성목"></label>
    <span class="hint">팀원이 입금하기를 누르면 이 계좌가 보여요. 회비 방식과 금액은 팀 설정에서 바꿔요.</span><a class="btn sm" href="#/settings" style="align-self:flex-start">팀 설정</a>
  </div></div><div class="cta"><button class="btn pri block" data-act="saveBank">저장</button></div>`;
}
function vLedger() {
  const items = ((D("team").ledger || {}).items || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const bal = items.reduce((s, x) => s + (x.type === "in" ? 1 : -1) * (Number(x.amount) || 0), 0);
  const f = S.form;
  return `${top("팀 통장", "#/dues")}<div class="body">
    <div class="card"><span class="hint">잔액</span><b style="font-size:28px">${won(bal)}</b></div>
    ${isAdmin() ? `<div class="card"><b>직접 기록</b><div class="chips"><button class="chip sm ${f.type !== "out" ? "on" : ""}" data-act="pick" data-k="type" data-v="in">들어온 돈</button><button class="chip sm ${f.type === "out" ? "on" : ""}" data-act="pick" data-k="type" data-v="out">나간 돈</button></div>
      <div class="row"><input class="inp" type="date" data-bind="date" value="${esc(f.date || todayStr())}" style="flex:1" aria-label="날짜"><input class="inp" data-bind="amount" value="${esc(f.amount || "")}" inputmode="numeric" placeholder="금액" style="flex:1" aria-label="금액"></div>
      <input class="inp" data-bind="label" value="${esc(f.label || "")}" placeholder="내용 (예: 구장비)" aria-label="내용"><button class="btn pri" data-act="ledgerAdd">기록하기</button></div>` : ""}
    <div class="card"><b>내역</b>${items.length ? `<div class="list">${items.map(x => `<div class="li"><span style="flex:1">${esc(md(x.date))} ${esc(x.label)}</span><b style="color:${x.type === "in" ? "#15803D" : "#B91C1C"}">${x.type === "in" ? "+" : "-"} ${won(x.amount)}</b>${isAdmin() ? `<button class="iconbtn" data-act="ledgerDel" data-id="${esc(x.id)}" aria-label="지우기">✕</button>` : ""}</div>`).join("")}</div>` : `<span class="hint">아직 내역이 없어요.</span>`}</div>
  </div>`;
}
function vCheck(id) {
  const e = S.events[id]; if (!e) return vSchedule(); const ck = e.check || {}; const at = e.checkAt || {};
  const before = Number(S.settings.checkBefore) || 10; const lim = new Date(evStart(e) - before * 60000 + 9 * 3600e3).toISOString().slice(11, 16);
  const { rows, others } = checkRows(e); const cnt = { in: 0, late: 0, absent: 0 }; Object.values(ck).forEach(v => { if (cnt[v] != null) cnt[v]++; });
  const fc = fineCalc(e);
  const b = (u, v, l) => `<button class="vote ${ck[u] === v ? "on " + (v === "in" ? "yes" : v === "late" ? "late" : "no") : ""}" style="padding:8px 0;min-height:40px;font-size:13px" data-act="checkSet" data-eid="${esc(e.id)}" data-u="${esc(u)}" data-v="${v}">${l}</button>`;
  return `${top("현장 출석", "#/event/" + e.id)}<div class="body">
    <div class="card" style="gap:6px"><b>${esc(md(e.date) + " " + wd(e.date) + " " + (e.time || "") + " " + evName(e))}</b><div class="spread hint"><span>지금 <b style="color:#111827">${hhmmNow()}</b></span><span>지각 기준 <b style="color:#111827">${lim}</b> (킥오프 ${before}분 전)</span></div>
      ${tilesA([tileA(cnt.in, "출석"), tileA(cnt.late, "지각", "#B45309"), tileA(cnt.absent, "결석", "#B91C1C")])}</div>
    <div class="spread"><b>참석 신청 ${rows.length}명</b><button class="btn sm" data-act="aGuestAddCheck" data-eid="${esc(e.id)}">+ 용병 추가</button></div>
    <div class="card" style="padding:4px 16px"><div class="list">${rows.map(x => `<div class="li" style="flex-wrap:wrap;gap:8px"><span style="flex:1;min-width:110px"><b>${esc(x.name)}</b><br><span class="hint">${at[x.uid] ? at[x.uid] + (ck[x.uid] === "late" ? " 도착, 지각" : " 도착") : ck[x.uid] === "absent" ? "도착 안 함" : x.sub || "아직"}</span></span><span style="display:grid;grid-template-columns:repeat(3,56px);gap:6px">${b(x.uid, "in", "출석")}${b(x.uid, "late", "지각")}${b(x.uid, "absent", "결석")}</span></div>`).join("")}</div></div>
    ${others.length ? `<details class="card"><summary style="cursor:pointer;font-weight:700">신청 안 한 사람 ${others.length}명 (왔으면 눌러요)</summary><div class="list">${others.map(x => `<div class="li"><span style="flex:1">${esc(x.name)}</span><span style="display:grid;grid-template-columns:repeat(2,56px);gap:6px">${b(x.uid, "in", "출석")}${b(x.uid, "late", "지각")}</span></div>`).join("")}</div></details>` : ""}
    <div class="card" style="background:#FFFBEB"><div class="spread"><b style="color:#92400E">벌금</b><b style="color:#92400E">${won(fc.total)}</b></div><span class="hint" style="color:#92400E">지각 ${fc.late.length}명${ruleAmt("late") ? " (" + won(ruleAmt("late")) + ")" : ""}, 결석 ${fc.abs.length}명${ruleAmt("absent") ? " (" + won(ruleAmt("absent")) + ")" : ""}. 결석은 참석이라고 했는데 안 온 사람만이에요.</span></div>
  </div><div class="cta"><button class="btn pri block" data-act="finesApply" data-eid="${esc(e.id)}">벌금 부과하고 단톡방에 공유</button></div>`;
}
function vRecords() {
  const y = UI.season || todayStr().slice(0, 4); const evs = past().filter(e => e.date.startsWith(y)); const tab = UI.rtab || "game"; const f = UI.rf || "all";
  const games = evs.filter(e => e.type === "match" && e.score); const w = games.filter(e => +e.score.us > +e.score.them).length, d2 = games.filter(e => +e.score.us === +e.score.them).length, l = games.length - w - d2;
  const avg = evs.length ? (evs.reduce((n, e) => n + people().filter(x => cameTo(e, x.uid)).length, 0) / evs.length) : 0;
  const fineSum = Object.values(D("fines")).filter(x => String(x.date || "").startsWith(y)).reduce((n, x) => n + (Number(x.amount) || 0), 0);
  const scr = evs.filter(e => e.type === "scrim").length, pend = evs.filter(e => isPlay(e) && !e.score).length;
  const ps = people(); const rows = ps.map(x => ({ ...x, n: evs.filter(e => cameTo(e, x.uid)).length, late: evs.filter(e => (e.check || {})[x.uid] === "late").length, abs: evs.filter(e => (e.check || {})[x.uid] === "absent").length, mom: evs.filter(momClosed).filter(e => momWinners(e).includes(x.uid)).length })).sort((a, b) => b.n - a.n);
  const half = r => evs.length && r.n * 2 <= evs.length;
  const list = evs.filter(e => f === "all" ? true : f === "match" ? e.type === "match" : e.type === "scrim");
  const evRow = e => { const ck = e.check || {}; const nIn = people().filter(x => cameTo(e, x.uid)).length; const nl = Object.values(ck).filter(v => v === "late").length, na = Object.values(ck).filter(v => v === "absent").length;
    const fn = Object.values(D("fines")).filter(x => x.eventId === e.id).length; const t = D("tally")["mom-" + e.id] || {}; const win = momClosed(e) ? momWinners(e) : [];
    return `<div class="card" style="gap:8px"><div class="row" style="gap:12px;align-items:flex-start"><span class="datebox" style="${e.type === "scrim" ? "background:#EEF2FF;color:#3730A3" : e.score ? "" : "background:#F3F4F6;color:#6B7280"}"><span>${wd(e.date)}</span><b style="font-size:15px">${e.date.slice(5, 7)}.${e.date.slice(8, 10)}</b></span><span style="flex:1;min-width:0"><span class="row" style="gap:6px"><span class="tag ${e.type === "training" ? "blue" : ""}">${e.type === "match" ? "경기" : e.type === "scrim" ? "내전" : "훈련"}</span><b>${e.score ? (e.type === "scrim" ? `A팀 ${e.score.us} : ${e.score.them} B팀` : `${e.score.us} : ${e.score.them} ${+e.score.us > +e.score.them ? "승" : +e.score.us < +e.score.them ? "패" : "무"}`) : esc(e.place || "")}</b></span><br><span class="hint">${esc([e.type === "match" && e.opponent ? "vs " + e.opponent : "", "참석 " + nIn, nl ? "지각 " + nl : "", na ? "결석 " + na : ""].filter(Boolean).join(", "))}</span></span>${isPlay(e) ? `<a class="btn sm ${e.score ? "" : "pri"}" href="#/result/${esc(e.id)}">${e.score ? "수정" : "결과 입력"}</a>` : ""}</div>
      <div class="spread hint" style="font-size:12px"><span>${win.length ? "MOM " + esc(win.map(nameOf).join(", ")) : momOpen(e) ? `MOM 투표 중, 참석한 ${nIn}명 중 ${t.n || 0}명 투표` : isPlay(e) && !e.score ? "결과를 넣어야 MOM 투표가 열려요" : ""}</span><span>${fn ? "벌금 " + fn + "건" : "벌금 없음"}</span></div></div>`; };
  return `<header class="top" style="padding:10px 12px">${LOGO(32)}<h1 style="font-size:20px;font-weight:900">기록</h1><button class="btn sm" data-act="aSeason">${y} 시즌 ▾</button></header><div class="body">
    <div class="chips"><button class="chip ${tab === "game" ? "on" : ""}" data-act="aRtab" data-v="game">경기별</button><button class="chip ${tab === "player" ? "on" : ""}" data-act="aRtab" data-v="player">선수별</button></div>
    ${tab === "game" ? `<div class="card"><b>시즌 요약</b>${tilesA([tileA(games.length + scr, "경기"), tileA(`${w}승 ${d2}무 ${l}패`, "전적"), tileA(Math.round(avg * 10) / 10, "평균 참석"), tileA(won(fineSum).replace("원", ""), "벌금 누적")])}${scr || pend ? `<span class="hint">${[scr ? "내전 " + scr + "번" : "", pend ? "결과 대기 " + pend + "경기" : ""].filter(Boolean).join("과 ")}은 승패에서 빠져 있어요</span>` : ""}</div>
      <div class="spread"><b>경기 기록</b><span class="chips">${[["all", "전체"], ["match", "경기"], ["scrim", "내전"]].map(([k2, l2]) => `<button class="chip sm ${f === k2 ? "on" : ""}" data-act="aRf" data-v="${k2}">${l2}</button>`).join("")}</span></div>
      ${list.length ? list.map(evRow).join("") : `<div class="card empty"><b>아직 지난 경기가 없어요</b></div>`}
      <div class="card"><div class="spread"><b>선수별 출석</b><button class="btn sm" data-act="aRtab" data-v="player">전체</button></div><div class="list">${rows.slice(0, 5).map(r => `<div class="li" style="${half(r) ? "background:#FFFBEB;margin:0 -16px;padding:12px 16px" : ""}"><span style="flex:1">${esc(r.name)}</span><b>${r.n}/${evs.length}</b><span class="hint">지각 ${r.late}</span></div>`).join("")}</div><span class="hint">출석이 절반 이하인 선수는 노란색으로 보여요</span></div>`
    : `<div class="card"><b>선수 ${ps.length}명</b>${tilesA([tileA(evs.length ? Math.round(rows.reduce((n, r) => n + r.n, 0) * 100 / (evs.length * Math.max(1, ps.length))) + "%" : "-", "평균 출석률"), tileA(rows.filter(half).length + "명", "절반 이하", "#B45309"), tileA(rows.filter(r => !r.late).length + "명", "지각 0회")])}</div>
      <div class="card" style="overflow-x:auto;padding:12px"><table style="border-collapse:collapse;width:100%;font-size:14px;text-align:center"><thead><tr style="color:#6B7280;font-size:12px"><th style="text-align:left;padding:6px">이름</th><th>출석</th><th>지각</th><th>결석</th><th>MOM</th></tr></thead><tbody>${rows.map(r => `<tr style="border-top:1px solid #F3F4F6;${half(r) ? "background:#FFFBEB" : ""}"><td style="text-align:left;padding:10px 6px">${esc(r.name)}${r.uid === S.uid ? ` <span class="hint">나</span>` : ""}</td><td><b>${r.n}/${evs.length}</b></td><td>${r.late}</td><td>${r.abs}</td><td>${r.mom}</td></tr>`).join("")}</tbody></table></div>
      <span class="hint">모임 ${evs.length}번 기준이에요. 출석이 절반 이하인 선수는 노란색이고, 결석은 연락 없이 빠진 횟수예요.</span>`}
  </div>${nav("기록")}`;
}
function vGame(id) {
  const e = S.events[id]; if (!e) return vRecords();
  const came = people().filter(x => cameTo(e, x.uid)); const t = D("tally")["mom-" + e.id] || { n: 0, c: {} };
  const myMom = (myUv().mom || {})[e.id]; const win = momWinners(e);
  const goals = (e.goals || []);
  return `${top(md(e.date) + " " + evName(e), "#/records", isAdmin() && isPlay(e) ? `<a class="btn sm" href="#/result/${esc(e.id)}">${e.score ? "결과 수정" : "결과 입력"}</a>` : "")}<div class="body">
    <div class="card" style="align-items:center;text-align:center">${e.score ? `<b style="font-size:40px">${e.score.us} : ${e.score.them}</b><span class="hint">${e.type === "scrim" ? "A팀 대 B팀" : esc(evName(e))}</span>` : `<b>${isPlay(e) ? "결과를 기다리고 있어요" : "훈련"}</b><span class="hint">${isPlay(e) ? "운영진이 결과를 넣으면 MOM 투표가 열려요" : esc(e.place || "")}</span>`}
      ${goals.length ? `<div class="chips" style="justify-content:center">${goals.map(g => `<span class="pill" style="background:#F3F4F6">골 ${esc(g.name || nameOf(g.uid))}</span>`).join("")}</div>` : ""}</div>
    ${momOpen(e) && cameTo(e, S.uid) ? (myMom ? `<div class="card"><b>MOM 투표를 냈어요</b><span class="hint">${esc(md(momDeadline(e).toISOString().slice(0, 10)))} 12시에 마감돼요. 결과는 마감 뒤에 보여요.</span></div>` : `<div class="card"><b>오늘의 MOM을 골라 주세요</b><span class="hint">익명이에요. 한 번 내면 바꿀 수 없어요.</span><div class="chips">${came.filter(x => x.uid !== S.uid).map(x => `<button class="chip ${UI.mom === x.uid ? "on" : ""}" data-act="momPick" data-u="${esc(x.uid)}">${esc(x.name)}</button>`).join("")}</div><button class="btn pri" data-act="momSend" data-eid="${esc(e.id)}" ${UI.mom ? "" : "disabled"}>투표하기</button></div>`) : ""}
    ${momClosed(e) && e.score ? `<div class="card"><b>MOM</b>${win.length ? `<b style="font-size:22px">${win.map(u => esc(nameOf(u))).join(", ")}</b><span class="hint">${t.n}명 투표</span>` : `<span class="hint">투표가 없었어요.</span>`}</div>` : ""}
    <div class="card"><div class="spread"><b>출석</b><span class="hint">${came.length}명</span></div><div class="chips">${came.map(x => `<span class="pill" style="background:#F3F4F6">${esc(x.name)}${(e.check || {})[x.uid] === "late" ? " (지각)" : ""}</span>`).join("") || `<span class="hint">출석 기록이 없어요</span>`}</div></div>
  </div>`;
}
function vResult(id) {
  const e = S.events[id]; if (!e) return vRecords(); const f = S.form; const came = people().filter(x => cameTo(e, x.uid));
  const gc = {}; (f.goals || []).forEach(g => { gc[g.uid] = (gc[g.uid] || 0) + 1; }); const total = (Number(f.us) || 0) + (e.type === "scrim" ? (Number(f.them) || 0) : 0); const entered = (f.goals || []).length;
  const step = (k, label) => `<span style="display:flex;flex-direction:column;align-items:center;gap:6px"><b style="font-size:13px">${esc(label)}</b><span class="row"><button class="btn sm" data-act="score" data-k="${k}" data-d="-1" aria-label="${esc(label)} 줄이기">−</button><b style="font-size:32px;min-width:40px;text-align:center">${Number(f[k]) || 0}</b><button class="btn sm" data-act="score" data-k="${k}" data-d="1" aria-label="${esc(label)} 늘리기">+</button></span></span>`;
  const gRow = x => `<div class="li"><span style="flex:1">${esc(x.name)}${x.uid === S.uid ? ` <span class="hint">나</span>` : ""}</span><button class="btn sm" data-act="aGoal" data-u="${esc(x.uid)}" data-d="-1" aria-label="${esc(x.name)} 골 빼기">−</button><b style="min-width:28px;text-align:center">${gc[x.uid] || 0}</b><button class="btn sm" data-act="aGoal" data-u="${esc(x.uid)}" data-d="1" aria-label="${esc(x.name)} 골 더하기">+</button></div>`;
  const T = e.teams || {}; const win = momClosed(e) ? momWinners(e) : []; const t = D("tally")["mom-" + e.id] || {};
  return `${top(e.score ? "결과 수정" : "결과 입력", "#/records")}<div class="body">
    <div class="card" style="gap:6px"><span class="tag ${e.type === "scrim" ? "blue" : ""}" style="align-self:flex-start">${e.type === "scrim" ? "내전" : "경기"}</span><b>${esc(md(e.date) + " " + wd(e.date) + ", " + (e.place || ""))}</b><span class="hint">참석 ${came.length}</span></div>
    <div class="card"><b>스코어</b><div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6px">${step("us", e.type === "scrim" ? "A팀" : S.team.name)}<b style="font-size:24px">:</b>${step("them", e.type === "scrim" ? "B팀" : (e.opponent || "상대"))}</div></div>
    <div class="card"><div class="spread"><b>골 넣은 사람</b><span class="hint" style="${entered !== total ? "color:#B45309" : ""}">${total}골 중 ${entered}골 입력</span></div>
      ${e.type === "scrim" ? ["A", "B"].map(sd => `<span class="lab">${sd}팀</span><div class="list">${came.filter(x => T[x.uid] === sd).map(gRow).join("") || `<span class="hint">스쿼드에서 ${sd}팀을 골라 주세요</span>`}</div>`).join("") : `<div class="list">${came.map(gRow).join("") || `<span class="hint">출석 기록이 없어요. 현장 출석을 먼저 불러 주세요</span>`}</div>`}</div>
    <div class="card"><b>MOM 투표</b>${win.length ? `<div class="spread"><b>${esc(win.map(nameOf).join(", "))}</b><span class="hint">투표 마감, ${came.length}명 중 ${t.n || 0}명 투표</span></div><span class="hint">투표 결과는 바꿀 수 없어요.</span>` : e.score ? `<span class="hint">투표 중이에요. 다음 날 12:00에 마감돼요. ${t.n || 0}명 투표했어요.</span>` : `<span class="hint">저장하면 투표가 열려요. 참석한 ${came.length}명만 투표할 수 있고, 다음 날 12:00에 마감돼요.</span>`}</div>
    <span class="hint">벌금은 일정의 현장 출석에서 바꿀 수 있어요</span>
  </div><div class="cta"><button class="btn pri block" data-act="saveResult" data-eid="${esc(e.id)}">${e.score ? "저장하기" : "결과 저장하기"}</button><span class="hint" style="text-align:center">저장하면 팀원 기록에도 바로 보여요</span></div>`;
}
function vNoticeNew() {
  const f = S.form;
  return `${top("공지 쓰기", "#/notices")}<div class="body"><div class="card">
    <label class="field"><span class="lab">제목</span><input class="inp" data-bind="title" value="${esc(f.title || "")}" maxlength="60" placeholder="예: 12월부터 구장이 바뀌어요"></label>
    <label class="field"><span class="lab">내용</span><textarea class="inp" data-bind="body" placeholder="자세한 안내">${esc(f.body || "")}</textarea></label>
    <div class="chips"><button class="chip sm ${f.pinned ? "on" : ""}" data-act="pick" data-k="pinned" data-v="${f.pinned ? "" : "1"}">맨 위에 고정</button><button class="chip sm ${f.poll ? "on" : ""}" data-act="pick" data-k="poll" data-v="${f.poll ? "" : "1"}">설문 붙이기</button></div>
    ${f.poll ? `<div class="field"><span class="lab">보기</span>${(f.opts || []).map((o, i) => `<input class="inp" data-opt="${i}" value="${esc(o.label)}" placeholder="보기 ${i + 1}" aria-label="보기 ${i + 1}">`).join("")}<button class="btn sm" data-act="optAdd" style="align-self:flex-start">+ 보기 추가</button></div><label class="field"><span class="lab">마감</span><input class="inp" type="date" data-bind="until" value="${esc(f.until || "")}"></label>` : ""}
  </div></div><div class="cta"><button class="btn pri block" data-act="noticeSave">올리기</button></div>`;
}
function vSquad(id) {
  const e = S.events[id]; if (!e) return vSchedule(); const T = e.teams || {}; const a = att(e); const going = new Set([...a.yes, ...a.late, ...a.wait].map(x => x.uid));
  const all = people().map(x => ({ uid: x.uid, name: x.name, pos: x.p.pos1 || "", going: going.has(x.uid) })).concat(guestsOf(e).map(g => ({ uid: "g:" + g.id, name: g.name + " (용병)", pos: g.pos || "", going: true })));
  all.sort((x, y) => (y.going - x.going) || x.name.localeCompare(y.name, "ko"));
  const sel = all.filter(x => T[x.uid]); const nA = sel.filter(x => T[x.uid] === "A").length, nB = sel.length - nA;
  return `${top("내전 스쿼드 고르기", "#/event/" + id)}<div class="body">
    <div class="card" style="gap:6px"><b>${esc(md(e.date) + " " + wd(e.date) + " " + (e.time || "") + " 내전")}</b><span class="hint">투표와 상관없이 골라요. 참석이라고 한 사람이 위에 있어요.</span>${tilesA([tileA(sel.length, "선택"), tileA(nA, "A 조끼", "#15803D"), tileA(nB, "B 일반", "#3730A3")])}</div>
    <div class="row"><button class="btn block" data-act="squadAuto" data-eid="${esc(id)}">팀 실력 비슷하게 자동으로 나누기</button></div>
    <div class="card" style="padding:4px 16px"><div class="spread" style="padding-top:10px"><b>전체 선수 ${all.length}명</b><button class="btn sm" data-act="aSquadAll" data-eid="${esc(id)}">${sel.length === all.length ? "모두 빼기" : "모두 선택"}</button></div><div class="list">${all.map(x => `<div class="li"><span style="flex:1;${T[x.uid] ? "" : "opacity:.55"}"><b>${esc(x.name)}</b><br><span class="hint">${esc([x.pos, x.going ? "참석 신청" : ""].filter(Boolean).join(", "))}</span></span>${T[x.uid] ? "" : `<span class="hint">빠짐</span>`}<button class="chip sm ${T[x.uid] === "A" ? "on" : ""}" data-act="squadSet" data-eid="${esc(id)}" data-u="${esc(x.uid)}" data-v="A">A 조끼</button><button class="chip sm ${T[x.uid] === "B" ? "on" : ""}" data-act="squadSet" data-eid="${esc(id)}" data-u="${esc(x.uid)}" data-v="B" style="${T[x.uid] === "B" ? "background:#3730A3;border-color:#3730A3" : ""}">B 일반</button></div>`).join("")}</div></div>
  </div><div class="cta"><a class="btn pri block" href="#/lineup/${esc(id)}">다음: 팀별 라인업 짜기</a></div>`;
}
function playerSheet(u) {
  const x = people().find(p => p.uid === u); if (!x) return; const me = S.members.find(m => m.user_id === S.uid) || {};
  const owner = S.role === "owner"; const isMe = u === S.uid; const req = (S.rsvp[u] || {}).posReq;
  sheet(`<h3>${esc(x.name)}</h3><span class="hint">${esc(ROLE[x.role])}${x.p.num ? ", " + esc(x.p.num) + "번" : ""}${x.p.pos1 ? ", " + esc([x.p.pos1, x.p.pos2].filter(Boolean).join(", ")) : ""}${joinedOf(u) ? ", 가입 " + dotDate(joinedOf(u)) : ""}</span>
    ${isAdmin() && req && req.status === "req" ? `<div class="card" style="background:#F9FAFB"><b>포지션 변경 요청</b><span class="hint">${esc([req.pos1, req.pos2].filter(Boolean).join(", "))}${req.note ? ", " + esc(req.note) : ""}</span><div class="row"><button class="btn block" data-act="posNo" data-u="${esc(u)}">거절</button><button class="btn pri block" data-act="posOk" data-u="${esc(u)}">수락</button></div></div>` : ""}
    ${owner && (S.members.find(m => m.user_id === u) || {}).admin_req && x.role === "member" ? `<div class="card" style="background:#F9FAFB"><b>운영진 신청</b><div class="row"><button class="btn block" data-act="adminAns" data-u="${esc(u)}" data-ok="">거절</button><button class="btn pri block" data-act="adminAns" data-u="${esc(u)}" data-ok="1">수락</button></div></div>` : ""}
    ${owner && !isMe ? `<div class="row">${x.role === "member" ? `<button class="btn block" data-act="setRole" data-u="${esc(u)}" data-v="admin">운영진으로</button>` : x.role === "admin" ? `<button class="btn block" data-act="setRole" data-u="${esc(u)}" data-v="member">팀원으로</button>` : ""}<button class="btn block" data-act="giveOwner" data-u="${esc(u)}">팀장 넘기기</button></div><button class="btn danger" data-act="kick" data-u="${esc(u)}">팀에서 내보내기</button>` : ""}
    ${isMe ? `<button class="btn" data-act="goTo" data-h="#/me">프로필 수정</button>${!isAdmin() ? (me.admin_req ? `<button class="btn" data-act="adminCancel">운영진 신청 취소</button>` : `<button class="btn" data-act="adminReq">운영진 신청</button>`) : ""}` : ""}
    <button class="btn" data-act="closeSheet">닫기</button>`);
}
function vPosReq() {
  const f = S.form; const pos = POS[sport()]; const req = (S.rsvp[S.uid] || {}).posReq;
  return `${top("포지션 변경 요청", "#/players")}<div class="body">
    ${req && req.status === "req" ? `<div class="card"><b>요청을 보냈어요</b><span class="hint">${esc([req.pos1, req.pos2].filter(Boolean).join(", "))}. 운영진이 수락하면 바뀌어요.</span><button class="btn" data-act="posCancel">요청 취소</button></div>` : ""}
    <div class="card"><div class="field"><span class="lab">1선호</span><div class="chips">${pos.map(p => `<button class="chip ${f.pos1 === p ? "on" : ""}" data-act="pick" data-k="pos1" data-v="${p}">${p}</button>`).join("")}</div></div>
      <div class="field"><span class="lab">2선호</span><div class="chips">${pos.filter(p => p !== f.pos1).map(p => `<button class="chip ${f.pos2 === p ? "on" : ""}" data-act="pick" data-k="pos2" data-v="${p}">${p}</button>`).join("")}<button class="chip ${!f.pos2 ? "on" : ""}" data-act="pick" data-k="pos2" data-v="">없음</button></div></div>
      <label class="field"><span class="lab">한마디 (선택)</span><input class="inp" data-bind="note" value="${esc(f.note || "")}" maxlength="60" placeholder="예: 요즘 슈팅 감이 좋아서 앞에서 뛰어 보고 싶어요"></label></div>
  </div><div class="cta"><button class="btn pri block" data-act="posSend">요청 보내기</button></div>`;
}
function vRosterImport() {
  const { rows, bad } = parseRoster(S.form.text);
  return `${top("명단 붙여 넣기", "#/players")}<div class="body">
    <div class="card"><span class="hint">한 줄에 한 명씩: 이름, 1선호, 2선호, 등번호, 가입일. 엑셀에서 복사해 그대로 붙여 넣어도 돼요.</span>
      <textarea class="inp" data-bind="text" style="min-height:200px" placeholder="김성우&#9;ST&#9;CAM&#9;1&#9;2025. 9. 10">${esc(S.form.text || "")}</textarea>
      <button class="btn sm" data-act="rosterPreview" style="align-self:flex-start">확인하기</button></div>
    ${rows.length ? `<div class="card"><div class="spread"><b>${rows.length}명</b>${bad.length ? `<span class="hint" style="color:#B91C1C">${bad.join(", ")}번째 줄은 읽지 못했어요</span>` : ""}</div><div class="list">${rows.map(r => `<div class="li"><span class="av">${esc(r.num || r.name.slice(0, 1))}</span><span style="flex:1"><b>${esc(r.name)}</b><br><span class="hint">${esc([r.pos1, r.pos2].filter(Boolean).join(", "))}${r.joined ? ", 가입 " + dotDate(r.joined) : ""}</span></span></div>`).join("")}</div><span class="hint">이미 들어온 팀원과 이름이 같으면 그 팀원에게 연결하고 번호와 포지션을 맞춰요. 같은 이름의 명단이 있으면 고쳐 써요.</span></div>` : ""}
  </div><div class="cta"><button class="btn pri block" data-act="rosterSave" ${rows.length ? "" : "disabled"}>${rows.length ? rows.length + "명 등록하기" : "명단을 붙여 넣어 주세요"}</button></div>`;
}
function rosterSheet(pid) {
  const p = D("players")[pid]; if (!p) return;
  sheet(`<h3>${esc(p.name)}</h3><span class="hint">${esc([p.num ? p.num + "번" : "", p.pos1, p.pos2].filter(Boolean).join(", "))}${p.joined ? ", 가입 " + dotDate(p.joined) : ""}</span><span class="hint">아직 앱에 들어오지 않았어요. 초대 링크로 들어와 이 이름을 고르면 연결돼요.</span>
    ${isAdmin() ? `<button class="btn danger" data-act="rosterDel" data-pid="${esc(pid)}">명단에서 빼기</button>` : ""}<button class="btn" data-act="closeSheet">닫기</button>`);
}

function weekStrip() {
  const t = new Date(todayStr() + "T00:00:00Z"); const dow = (t.getUTCDay() + 6) % 7; const mon = new Date(t.getTime() - dow * 864e5);
  const days = Array.from({ length: 7 }, (_, i) => new Date(mon.getTime() + i * 864e5).toISOString().slice(0, 10));
  const wk = Math.ceil((Number(days[0].slice(8, 10)) + new Date(days[0].slice(0, 8) + "01T00:00:00Z").getUTCDay() - 1) / 7) + (Number(days[0].slice(8, 10)) <= 7 && new Date(days[0].slice(0, 8) + "01T00:00:00Z").getUTCDay() !== 1 ? 0 : 0);
  return `<div class="card" style="gap:10px"><div class="spread"><b>${Number(todayStr().slice(5, 7))}월 ${["첫째", "둘째", "셋째", "넷째", "다섯째"][Math.min(4, Math.floor((Number(todayStr().slice(8, 10)) - 1) / 7))]} 주</b><a class="hint" href="#/calendar" style="text-decoration:none">달력 보기 ›</a></div>
    <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;text-align:center">${days.map(d => { const es = Object.values(S.events).filter(e => e.date === d); const on = d === todayStr();
      return `<a href="${es[0] ? "#/event/" + esc(es[0].id) : "#/calendar"}" style="text-decoration:none;border-radius:12px;padding:6px 0;display:flex;flex-direction:column;align-items:center;gap:2px;${on ? "background:#15803D;color:#FFFFFF" : "color:#111827"}"><span style="font-size:11px;${on ? "" : "color:#6B7280"}">${"월화수목금토일"[(new Date(d + "T00:00:00Z").getUTCDay() + 6) % 7]}</span><b style="font-size:16px">${Number(d.slice(8, 10))}</b><span style="width:6px;height:6px;border-radius:50%;background:${es.length ? (on ? "#FFFFFF" : es[0].type === "scrim" ? "#3730A3" : "#15803D") : "transparent"}"></span></a>`; }).join("")}</div></div>`;
}
function adminTodo() {
  const next = upcoming().find(e => !started(e)); const a = next ? att(next) : null; const todo = [];
  if (!S.members.some(m => m.user_id !== S.uid) && !unclaimed().length) todo.push(["팀원을 초대해 주세요", "초대 링크를 단톡방에 올리면 돼요", "#/invite", "초대하기"]);
  if (!next) todo.push(["다가오는 일정이 없어요", "일정을 올리면 팀원이 참석을 눌러요", "#/new", "일정 만들기"]);
  if (next && a.none.length) todo.push([`참석 미응답 ${a.none.length}명`, `${md(next.date)} ${wd(next.date)} ${evName(next)}, ${closeText(next)}`, "#/schedule", "알림 보내기"]);
  const prs = []; Object.entries(D("payreq")).forEach(([u, d]) => Object.values((d && d.items) || {}).forEach(it => { if (it && it.status === "req") prs.push(nameOf(u)); }));
  if (prs.length) todo.push([`입금 확인 ${prs.length}건`, `${[...new Set(prs)].slice(0, 3).join(", ")}이(가) 입금했다고 눌렀어요`, "#/dues", "확인하기"]);
  Object.values(S.events).filter(e => !started(e)).forEach(e => { const g = guestReqs(e).filter(x => x.status === "req"); if (g.length) todo.push([`용병 신청 ${g.length}건`, `${md(e.date)} ${evName(e)}, ${[...new Set(g.map(x => nameOf(x.u)))].join(", ")}이(가) 신청했어요`, "#/guests/" + e.id, "확인"]); });
  Object.values(S.events).filter(scrimReady).forEach(e => todo.push([`${md(e.date)} 경기 신청 ${att(e).in + att(e).wait.length}명`, "상대팀 미정, 20명이 넘어서 내전으로 바꿀 수 있어요", "#/scrim/" + e.id, "검토"]));
  if (next && isPlay(next) && !(next.lineup && Object.keys(next.lineup).length) && att(next).in >= 5) todo.push(["라인업 짜기", `참석 ${att(next).in}명, 포지션 맞춰 휴식 자동 배치`, "#/lineup/" + next.id, "라인업"]);
  const today = Object.values(S.events).find(e => e.date === todayStr() && !Object.keys(e.check || {}).length);
  if (today) todo.push(["오늘 현장 출석을 불러 주세요", `${today.time || ""} ${evName(today)}, 킥오프 ${Number(S.settings.checkBefore) || 10}분 전 기준`, "#/check/" + today.id, "출석"]);
  past().filter(e => isPlay(e) && !e.score && Date.now() - evStart(e) < 7 * 864e5).forEach(e => todo.push(["경기 결과를 넣어 주세요", `${md(e.date)} ${evName(e)}, 넣으면 MOM 투표가 열려요`, "#/result/" + e.id, "결과 입력"]));
  const posN = people().filter(x => ((S.rsvp[x.uid] || {}).posReq || {}).status === "req").length;
  if (posN) todo.push([`포지션 변경 요청 ${posN}건`, "선수 탭에서 수락하거나 거절해요", "#/players", "보기"]);
  const admN = S.role === "owner" ? S.members.filter(m => m.admin_req && m.role === "member").length : 0;
  if (admN) todo.push([`운영진 신청 ${admN}명`, "팀장만 수락할 수 있어요", "#/players", "보기"]);
  if (unclaimed().length) todo.push([`아직 앱에 안 들어온 선수 ${unclaimed().length}명`, "초대 링크를 올리면 명단에서 이름만 고르면 돼요", "#/invite", "초대하기"]);
  return todo;
}
function afeed() {
  const out = []; const now = Date.now();
  const add = (at, title, body, href) => { const t = Date.parse(at || ""); if (t && now - t < 30 * 864e5) out.push({ t, title, body, href }); };
  Object.values(S.events).forEach(e => {
    const nm = `${md(e.date)} ${evName(e)}`;
    if (scrimReady(e)) add(new Date(Math.min(now, new Date(e.date + "T09:00:00+09:00").getTime() - 3 * 864e5)).toISOString(), `${md(e.date)} 경기를 내전으로 바꿀 수 있어요`, `신청 ${att(e).in + att(e).wait.length}명. 운영진끼리 정해 주세요`, "#/scrim/" + e.id);
    if (started(e) && isPlay(e) && !e.score) add(new Date(evStart(e)).toISOString(), `${nm} 결과를 아직 안 넣었어요`, "결과를 넣어야 MOM 투표가 열려요", "#/result/" + e.id);
    if (!started(e) && e.createdAt) add(e.createdAt, `${nm} 참석 ${att(e).in}${att(e).cap ? " / " + att(e).cap : ""}`, `미응답 ${att(e).none.length}명, ${closeText(e)}`, "#/event/" + e.id);
    if (e.score && momClosed(e) && momWinners(e).length) add(momDeadline(e).toISOString(), `${nm} MOM ${momWinners(e).map(nameOf).join(", ")}`, `${(D("tally")["mom-" + e.id] || {}).n || 0}명 투표`, "#/game/" + e.id);
    guestReqs(e).filter(g => g.status === "req").forEach(g => add(g.at, "용병 신청", `${nameOf(g.u)}이(가) ${nm}에 ${g.name}님을 데려오고 싶어해요`, "#/guests/" + e.id));
  });
  Object.entries(D("payreq")).forEach(([u, d]) => Object.values((d && d.items) || {}).forEach(it => { if (it && it.status === "req") add(it.at, "입금 확인 요청", `${nameOf(u)}이(가) 보냈어요를 눌렀어요, ${won(it.amount)}`, "#/dues"); }));
  people().forEach(x => { const r = (S.rsvp[x.uid] || {}).posReq; if (r && r.status === "req") add(r.at, "포지션 변경 요청", `${x.name}이(가) ${x.p.pos1 || "-"}에서 ${[r.pos1, r.pos2].filter(Boolean).join(", ")}(으)로 바꾸고 싶어해요`, "#/players"); });
  S.members.filter(m => m.admin_req && m.role === "member").forEach(m => add(m.admin_req, "운영진 신청", `${nameOf(m.user_id)}이(가) 운영진을 신청했어요. 팀장만 수락할 수 있어요`, "#/players"));
  S.members.filter(m => m.user_id !== S.uid && m.joined_at).forEach(m => add(m.joined_at, "새 팀원", `${nameOf(m.user_id)}이(가) 들어왔어요`, "#/players"));
  return out.sort((a, b) => b.t - a.t);
}
const ABELL = () => { const r = Date.parse(myUv().readAt || "") || 0; const n = afeed().filter(x => x.t > r).length; return `<a class="iconbtn" href="#/notify" aria-label="알림${n ? " " + n + "개 안 읽음" : ""}" style="position:relative"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>${n ? `<span style="position:absolute;top:9px;right:9px;width:9px;height:9px;border-radius:50%;background:#DC2626;box-shadow:0 0 0 2px #FFFFFF"></span>` : ""}</a>`; };
function vNotifyAdmin() {
  const list = afeed(); const r = Date.parse(myUv().readAt || "") || 0; const n = list.filter(x => x.t > r).length;
  const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 60 ? (m < 2 ? "방금" : m + "분 전") : m < 1440 ? Math.round(m / 60) + "시간 전" : m < 2880 ? "어제" : md(new Date(t + 9 * 3600e3).toISOString().slice(0, 10)); };
  return `${top("알림", "#/", n ? `<button class="btn sm" data-act="readAll">모두 읽음</button>` : "")}<div class="body">
    <b style="font-size:15px">안 읽은 알림 <span style="color:#DC2626">${n}개</span></b>
    ${list.length ? `<div class="card" style="padding:4px 16px"><div class="list">${list.map(x => `<a class="li" href="${x.href}" style="text-decoration:none;color:inherit;${x.t > r ? "background:#F0FDF4;margin:0 -16px;padding:12px 16px" : ""}"><span style="width:8px;height:8px;border-radius:50%;flex:none;background:${x.t > r ? "#DC2626" : "transparent"}"></span><span style="flex:1;min-width:0"><b style="font-size:15px">${esc(x.title)}</b><br><span class="hint">${esc(x.body)}</span></span><span class="hint" style="flex:none;font-size:12px">${ago(x.t)}</span></a>`).join("")}</div></div>` : `<div class="card empty"><b>알림이 없어요</b></div>`}
    <span class="hint" style="text-align:center">알림은 30일 동안 보관돼요</span></div>`;
}
function nextDates() {
  const last = Object.values(S.events).sort((a, b) => b.date.localeCompare(a.date))[0]; const dow = last ? new Date(last.date + "T00:00:00Z").getUTCDay() : 6;
  const out = []; let d = new Date(todayStr() + "T00:00:00Z"); while (out.length < 3) { d = new Date(d.getTime() + 864e5); if (d.getUTCDay() === dow) out.push(d.toISOString().slice(0, 10)); } return out;
}
function eventFormInit(id) {
  const e = id ? S.events[id] : null; const d = nextDates();
  const toLocal = iso => iso ? new Date(Date.parse(iso) + 9 * 3600e3).toISOString().slice(0, 16) : "";
  S.form = e ? { type: e.type, date: e.date, time: e.time, end: e.end || "", place: e.place || "", oppMode: e.opponent ? "set" : "none", opponent: e.opponent || "", cap: Number(e.cap) || 0, waitCap: Number(e.waitCap) || 0, memo: e.memo || "", voteClose: e.voteClose || "start", openMode: e.openAt ? "later" : "now", openAt: toLocal(e.openAt) }
    : { type: "match", date: d[0], time: "", end: "", place: "", oppMode: "none", opponent: "", cap: Number(S.settings.cap) || (sport() === "soccer" ? 22 : 12), waitCap: 0, memo: "", voteClose: "start", openMode: "now", openAt: "" };
}
function vGuests(id) {
  const e = S.events[id]; if (!e) return vSchedule(); const a = att(e); const reqs = guestReqs(e); const gs = guestsOf(e); const fee = Number(S.settings.guestFee) || 0;
  const left = a.cap ? Math.max(0, a.cap - a.in - gs.length) : null;
  const ago = t => { const m = Math.round((Date.now() - Date.parse(t || "")) / 60000); return !t ? "" : m < 60 ? m + "분 전" : m < 1440 ? Math.round(m / 60) + "시간 전" : md(t.slice(0, 10)); };
  return `${top("용병 신청", "#/event/" + id)}<div class="body">
    <div class="card"><div class="spread"><span><b>${esc(md(e.date) + " " + wd(e.date) + " " + (e.time || "") + " " + evName(e))}</b></span>${left != null ? `<span class="tag ${left ? "" : "gray"}">남은 자리 ${left}</span>` : ""}</div></div>
    <b>확인할 신청 ${reqs.filter(g => g.status === "req").length}건</b>
    ${reqs.filter(g => g.status === "req").map(g => `<div class="card"><div class="row" style="gap:12px"><span class="av">${esc(g.name.slice(0, 1))}</span><span style="flex:1"><b>${esc(g.name)}</b> <span class="tag gray">용병</span><br><span class="hint">${esc([nameOf(g.u) + " 신청", g.rel, g.pos, ago(g.at)].filter(Boolean).join(", "))}</span></span></div><div class="row"><button class="btn block" data-act="guestNo" data-u="${esc(g.u)}" data-k="${esc(g.k)}">거절</button><button class="btn pri block" data-act="guestOk" data-eid="${esc(e.id)}" data-u="${esc(g.u)}" data-k="${esc(g.k)}">수락</button></div></div>`).join("") || `<div class="card empty"><b>확인할 신청이 없어요</b></div>`}
    ${gs.length ? `<div class="card"><div class="spread"><b>명단에 든 용병</b><span class="hint">${gs.length}명</span></div><div class="list">${gs.map(g => `<div class="li"><span style="flex:1"><b>${esc(g.name)}</b><br><span class="hint">${esc([g.pos, g.by ? nameOf(g.by) + " 지인" : "운영진 추가"].filter(Boolean).join(", "))}</span></span><button class="iconbtn" data-act="guestDel" data-eid="${esc(e.id)}" data-g="${esc(g.id)}" aria-label="빼기">✕</button></div>`).join("")}</div></div>` : ""}
    <span class="hint">수락하면 참석 명단에 용병으로 들어가고 신청한 팀원 알림함에 보여요.${fee ? ` 참가비 ${won(fee)}은 현장 출석에서 받아요.` : ""}</span>
    <button class="btn" data-act="aGuestAdd" data-eid="${esc(e.id)}">운영진이 직접 추가하기</button>
  </div>`;
}
function guestAddSheet(eid, atCheck) {
  const e = S.events[eid]; if (!e) return; const fee = Number(S.settings.guestFee) || 0;
  sheet(`<h3>용병 추가</h3><span class="hint">오늘만 같이 뛰는 사람이에요. 팀원 명단에는 안 들어가요</span>
    <input class="inp" id="agName" maxlength="20" placeholder="이름" aria-label="이름">
    <div class="chips">${POS[sport()].map(p => `<button class="chip sm" data-agpos="${p}">${p}</button>`).join("")}</div>
    ${fee ? `<label class="row" style="gap:10px;min-height:44px"><input type="checkbox" id="agFee" checked style="width:22px;height:22px;accent-color:#15803D"><span>참가비 ${won(fee)} 받기, 팀 통장 내역에 적혀요</span></label>` : ""}
    <div class="row"><button class="btn block" data-act="closeSheet">취소</button><button class="btn pri block" id="agSend">추가하기</button></div>`);
  let pos = ""; document.querySelectorAll("[data-agpos]").forEach(b => b.onclick = () => { pos = b.dataset.agpos; document.querySelectorAll("[data-agpos]").forEach(x => x.classList.toggle("on", x === b)); });
  $("#agSend").onclick = async () => {
    const name = $("#agName").value.trim(); if (!name) { toast("이름을 적어 주세요"); return; } const gid = uid36("g");
    try {
      const ev = S.events[eid]; const extra = atCheck ? { check: { ...(ev.check || {}), ["g:" + gid]: "in" }, checkAt: { ...(ev.checkAt || {}), ["g:" + gid]: hhmmNow() } } : {};
      await setDoc("events", eid, { ...ev, guests: { ...(ev.guests || {}), [gid]: { name, pos, by: "", at: new Date().toISOString(), fee: $("#agFee") && $("#agFee").checked ? fee : 0 } }, ...extra });
      if ($("#agFee") && $("#agFee").checked && fee) { const items = ((D("team").ledger || {}).items || []).concat([{ id: uid36("l"), date: todayStr(), type: "in", cat: "참가비", label: name + " 용병 참가비", amount: fee }]); await setDoc("team", "ledger", { items }); }
      closeSheet(); render(); toast("용병을 추가했어요");
    } catch (err) { fail(err); }
  };
}
const hhmmNow = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(11, 16);
function vScrim(id) {
  const e = S.events[id]; if (!e) return vSchedule(); const a = att(e); const n = a.in + a.wait.length;
  const daysLeft = Math.round((new Date(e.date + "T00:00:00+09:00") - new Date(todayStr() + "T00:00:00+09:00")) / 864e5);
  const ops = (D("contacts")["scrim-" + id] || {}).votes || {}; const mine = ops[S.uid] || {};
  const ck = (ok, t, s2) => `<div class="li"><span style="width:24px;height:24px;border-radius:8px;flex:none;display:inline-flex;align-items:center;justify-content:center;font-size:13px;${ok ? "background:#15803D;color:#FFFFFF" : "background:#F3F4F6;color:#9CA3AF"}">✓</span><span style="flex:1"><b>${t}</b><br><span class="hint">${s2}</span></span></div>`;
  return `${top("내전 검토", "#/event/" + id)}<div class="body">
    <div class="card"><b>${esc(md(e.date) + " " + wd(e.date) + " " + (e.time || "") + ", " + (e.place || "") + ", 상대팀 미정")}</b><div class="stat"><span><b>${n}명</b><span>참석 ${a.in} + 대기 ${a.wait.length}</span></span></div></div>
    <div class="card"><div class="list">${ck(n >= 20, "참석과 대기를 합쳐 20명 이상", "내전을 하려면 20명이 필요해요")}${ck(daysLeft >= 3, "3일 전까지 20명 유지", daysLeft >= 3 ? `경기까지 ${daysLeft}일 남았어요` : "3일 전이 지났어요")}${ck(!e.opponent, "상대팀 미정", "매칭된 팀이 있으면 내전으로 바꿀 수 없어요")}</div></div>
    <div class="card"><b>내전으로 바꾸면</b><div class="list">${ck(true, "대기 " + a.wait.length + "명도 모두 참석으로 올라가요", "")}${ck(true, "A팀, B팀으로 나눠서 해요", "팀은 운영진이 스쿼드에서 직접 골라요")}${ck(true, "신청한 " + n + "명 알림함에 바로 보여요", "")}</div></div>
    <div class="card"><div class="spread"><b>운영진 의견</b><span class="hint">운영진끼리만 보여요</span></div>
      <div class="list">${S.members.filter(m => m.role !== "member").map(m => { const o = ops[m.user_id] || {}; return `<div class="li"><span style="flex:1"><b>${esc(nameOf(m.user_id))}</b> <span class="hint">${ROLE[m.role]}${m.user_id === S.uid ? ", 나" : ""}</span>${o.note ? `<br><span class="hint">${esc(o.note)}</span>` : ""}</span>${o.v ? `<span class="tag ${o.v === "yes" ? "" : "gray"}">${o.v === "yes" ? "찬성" : "반대"}</span>` : `<span class="hint">아직</span>`}</div>`; }).join("")}</div>
      <div class="chips"><button class="chip sm ${mine.v === "yes" ? "on" : ""}" data-act="aScrimVote" data-eid="${esc(id)}" data-v="yes">찬성</button><button class="chip sm ${mine.v === "no" ? "on" : ""}" data-act="aScrimVote" data-eid="${esc(id)}" data-v="no">반대</button></div>
      <div class="row"><input class="inp" id="scrimNote" maxlength="60" value="${esc(mine.note || "")}" placeholder="예: 구장 시간 늘릴 수 있는지 볼게요" aria-label="의견"><button class="btn sm" data-act="aScrimNote" data-eid="${esc(id)}">남기기</button></div></div>
  </div><div class="cta"><div class="row"><button class="btn block" data-act="aScrimKeep" data-eid="${esc(id)}">경기로 그대로</button><button class="btn pri block" data-act="scrimConvert" data-eid="${esc(id)}" style="background:#3730A3">내전으로 바꾸기</button></div><span class="hint" style="text-align:center">정하면 신청한 팀원 알림함에 보여요</span></div>`;
}
function vCalendarAdmin() { return mCalendar(adminEventCard, true); }
const AACT1 = {
  readAll: async () => { try { await patchDoc("uvote", S.uid, { readAt: new Date().toISOString() }); render(); toast("모두 읽음으로 바꿨어요"); } catch (err) { fail(err); } },
  aWait: t => { S.form.waitCap = Math.max(0, (Number(S.form.waitCap) || 0) + Number(t.dataset.d)); render(); },
  aSaveEvent: async t => {
    const f = S.form; if (!f.date) { toast("날짜를 골라 주세요"); return; } if (!f.time) { toast("시작 시간을 골라 주세요"); return; }
    if (f.type === "match" && f.oppMode === "set" && !String(f.opponent || "").trim()) { toast("상대팀 이름을 적어 주세요"); return; }
    t.disabled = true; const id = t.dataset.eid || uid36("e"); const old = S.events[id] || {};
    const openAt = f.openMode === "later" && f.openAt ? new Date(f.openAt + ":00+09:00").toISOString() : "";
    const data = { ...old, id, type: f.type, date: f.date, time: f.time, end: f.end || "", place: String(f.place || "").trim(), opponent: f.type === "match" && f.oppMode === "set" ? String(f.opponent || "").trim() : "", cap: f.type === "scrim" ? 0 : Number(f.cap) || 0, waitCap: Number(f.waitCap) || 0, memo: String(f.memo || "").trim(), voteClose: f.voteClose || "start", openAt, createdAt: old.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    try { await setDoc("events", id, data); toast(t.dataset.eid ? "저장했어요" : openAt ? "일정을 올렸어요. 예약한 시각에 투표가 열려요" : "일정을 올렸어요. 팀원이 바로 참석을 누를 수 있어요"); location.hash = "#/event/" + id; } catch (err) { t.disabled = false; fail(err); }
  },
  aGuestAdd: t => guestAddSheet(t.dataset.eid, false),
  aGuestAddCheck: t => guestAddSheet(t.dataset.eid, true),
  aScrimVote: async t => { const id = "scrim-" + t.dataset.eid; const cur = D("contacts")[id] || { votes: {} }; const me = (cur.votes || {})[S.uid] || {}; try { await setDoc("contacts", id, { votes: { ...(cur.votes || {}), [S.uid]: { ...me, v: t.dataset.v, at: new Date().toISOString() } } }); render(); } catch (err) { fail(err); } },
  aScrimNote: async t => { const id = "scrim-" + t.dataset.eid; const cur = D("contacts")[id] || { votes: {} }; const me = (cur.votes || {})[S.uid] || {}; try { await setDoc("contacts", id, { votes: { ...(cur.votes || {}), [S.uid]: { ...me, note: $("#scrimNote").value.trim().slice(0, 60), at: new Date().toISOString() } } }); render(); toast("의견을 남겼어요"); } catch (err) { fail(err); } },
  aScrimKeep: t => { const e = S.events[t.dataset.eid]; if (!e) return; const a = att(e);
    confirmBox("이번엔 경기로 할까요?", `참석 ${a.in}명으로 경기를 해요. 대기 ${a.wait.length}명은 빠지는 사람이 생기면 순서대로 올라가요.`, "경기로 정하기", async () => {
      try { await setDoc("events", e.id, { ...e, scrimKeep: new Date().toISOString() }); const text = `[${S.team.name}] ${md(e.date)} ${wd(e.date)} ${e.time || ""}은 경기로 진행해요. 대기 중인 분은 빠지는 사람이 생기면 순서대로 올라가요.`; try { await navigator.clipboard.writeText(text); toast("경기로 정했어요. 대기자에게 보낼 문구를 복사했어요"); } catch (err) { toast("경기로 정했어요"); } location.hash = "#/event/" + e.id; } catch (err) { fail(err); }
    }); },
};

function checkRows(e) {
  const a = att(e); const rows = [...a.yes, ...a.late].map(x => ({ uid: x.uid, name: x.name, sub: x.s === "late" ? `늦참 신고, ${x.q || 1}Q부터` : "" }));
  guestsOf(e).forEach(g => rows.push({ uid: "g:" + g.id, name: g.name, sub: "용병" }));
  const extra = [...a.no, ...a.none].filter(x => (e.check || {})[x.uid]).map(x => ({ uid: x.uid, name: x.name, sub: "신청 안 함" }));
  return { rows: rows.concat(extra), others: [...a.no, ...a.none].filter(x => !(e.check || {})[x.uid]) };
}
function fineCalc(e) {
  const ck = e.check || {}; const a = att(e); const going = new Set([...a.yes, ...a.late].map(x => x.uid));
  const late = Object.keys(ck).filter(u => ck[u] === "late" && !u.startsWith("g:")), abs = Object.keys(ck).filter(u => ck[u] === "absent" && going.has(u));
  return { late, abs, total: late.length * ruleAmt("late") + abs.length * ruleAmt("absent") };
}
function fineText(e) {
  const fc = fineCalc(e); const lines = [`[${S.team.name}] ${md(e.date)} ${evName(e)} 벌금 안내`];
  if (fc.late.length) lines.push(`지각 ${won(ruleAmt("late"))}: ${fc.late.map(nameOf).join(", ")}`);
  if (fc.abs.length) lines.push(`무단 결석 ${won(ruleAmt("absent"))}: ${fc.abs.map(nameOf).join(", ")}`);
  if (!fc.late.length && !fc.abs.length) lines.push("이번엔 벌금이 없어요");
  lines.push("매니볼 회비 탭에서 확인하고 보내 주세요."); return lines.join("\n");
}
function vCheckDone(id) {
  const e = S.events[id]; if (!e) return vSchedule(); const ck = e.check || {}; const cnt = { in: 0, late: 0, absent: 0 }; Object.values(ck).forEach(v => { if (cnt[v] != null) cnt[v]++; });
  return `${top("현장 출석", "#/event/" + id)}<div class="body">
    <div class="hint" style="background:#F0FDF4;color:#166534;border-radius:12px;padding:10px 12px">벌금을 매기고 팀원 회비 탭과 알림함에 보이게 했어요</div>
    <div class="card"><b>${esc(md(e.date) + " " + evName(e))} 출석 마감</b>${tilesA([tileA(cnt.in, "출석"), tileA(cnt.late, "지각", "#B45309"), tileA(cnt.absent, "결석", "#B91C1C")])}<div class="spread"><span>매긴 벌금</span><b>${won(fineCalc(e).total)}</b></div></div>
    <div class="card"><b>단톡방에 올릴 문구</b><div class="hint" style="white-space:pre-wrap;background:#F9FAFB;border-radius:12px;padding:12px;color:#374151">${esc(fineText(e))}</div><button class="btn" data-act="aCopyFine" data-eid="${esc(id)}">문구 복사</button></div>
    <div class="row"><a class="btn block" href="#/dues">회비에서 보기</a><a class="btn block" href="#/schedule">일정으로</a></div>
  </div>`;
}
const tileA = (v, l, c) => `<span style="background:#F9FAFB;border-radius:14px;padding:12px 4px;text-align:center;display:flex;flex-direction:column;gap:2px"><b style="font-size:22px;${c ? "color:" + c : ""}">${v}</b><span style="font-size:12px;color:#6B7280">${l}</span></span>`;
const tilesA = arr => `<div style="display:grid;grid-template-columns:repeat(${arr.length},minmax(0,1fr));gap:8px">${arr.join("")}</div>`;
const AACT2 = {
  aCopyFine: async t => { const e = S.events[t.dataset.eid]; try { await navigator.clipboard.writeText(fineText(e)); toast("문구를 복사했어요. 단톡방에 붙여 넣어 주세요"); } catch (err) { toast("길게 눌러 복사해 주세요"); } },
  aSquadAll: async t => { const e = S.events[t.dataset.eid]; if (!e) return; const T = e.teams || {}; const ids = people().map(x => x.uid).concat(guestsOf(e).map(g => "g:" + g.id));
    const allOn = ids.every(u => T[u]); const N = {}; if (!allOn) ids.forEach((u, i) => { N[u] = T[u] || (i % 2 ? "B" : "A"); });
    try { await setDoc("events", e.id, { ...e, teams: N }); render(); } catch (err) { fail(err); } },
  aRtab: t => { UI.rtab = t.dataset.v; render(); window.scrollTo(0, 0); },
  aRf: t => { UI.rf = t.dataset.v; render(); },
  aSeason: () => { const years = [...new Set(past().map(e => e.date.slice(0, 4)).concat([todayStr().slice(0, 4)]))].sort().reverse();
    sheet(`<h3>시즌 고르기</h3><div class="list">${years.map(y => `<button class="li" data-act="aSeasonPick" data-y="${y}" style="border:0;border-bottom:1px solid #F3F4F6;background:none;text-align:left;width:100%"><span style="flex:1"><b>${y} 시즌</b><br><span class="hint">모임 ${past().filter(e => e.date.startsWith(y)).length}번</span></span>${(UI.season || todayStr().slice(0, 4)) === y ? "✓" : ""}</button>`).join("")}</div><span class="hint">시즌은 매년 1월 1일에 새로 시작해요</span><button class="btn" data-act="closeSheet">닫기</button>`); },
  aSeasonPick: t => { UI.season = t.dataset.y; closeSheet(); render(); },
  aGoal: t => { const g = S.form.goals = S.form.goals || []; if (Number(t.dataset.d) > 0) g.push({ uid: t.dataset.u }); else { const i = g.map(x => x.uid).lastIndexOf(t.dataset.u); if (i >= 0) g.splice(i, 1); } render(); },
};

export { AACT1, AACT2, eventFormInit, playerSheet, remindLeft, remindSheet, rosterSheet, vCalendarAdmin, vCheck, vCheckDone, vDues, vDuesSettings, vEvent, vEventForm, vGame, vGuests, vHomeAdmin, vLedger, vNoticeNew, vNotifyAdmin, vPlayers, vPosReq, vRecords, vResult, vRosterImport, vSchedule, vScrim, vSquad };
