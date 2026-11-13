// 운영진 화면: 디자인 시안 [운영진] 1-1 ~ 5-9. 팀원 화면은 member.js에 있다.
import { mCalendar } from "./member.js";
import { $, D, KIT, LOGO, POS, ROLE, S, UI, att, cameTo, closeSheet, closeText, confirmBox, dotDate, esc, evName, evStart, eventCard, fail, feeMode, finesOf, guestReqs, guestsOf, ini, isAdmin, isPlay, jersey, joinedOf, lateRow, mLabel, md, momClosed, momDeadline, momOpen, momWinners, monthsList, myProfile, myUv, myVote, nameOf, nav, noticeCard, noticesList, paidOf, parseRoster, past, patchDoc, people, refreshMembers, remindInfo, render, ruleAmt, sb, scrimReady, setDoc, sheet, sport, started, syncMyDues, toast, todayStr, top, uid36, unclaimed, upcoming, voteRow, voteState, wd, won, ym } from "./main.js";

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
    ${myProfile() ? "" : `<div class="card"><b>나도 선수로 등록하기</b><span class="hint">팀장도 선수로 등록하면 참석을 누르고 명단에 보여요.</span><a class="btn" href="${unclaimed().length ? "#/claim" : "#/me"}">선수 등록</a></div>`}
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
  const ps = people(); const y = todayStr().slice(0, 4); const evs = past().filter(e => e.date.startsWith(y));
  const attN = u => evs.filter(e => cameTo(e, u)).length; const low = ps.filter(x => evs.length && attN(x.uid) * 2 <= evs.length);
  const dueTag = u => { const o = owedOf(u); return o.months > 1 ? `<span class="tag" style="background:#FEF2F2;color:#B91C1C">${o.months}달 미납</span>` : o.months ? `<span class="tag" style="background:#FEF2F2;color:#B91C1C">${Number(ym().slice(5))}월 미납</span>` : ""; };
  const admins = ps.filter(x => x.role !== "member").sort((a, b) => (a.role === "owner" ? -1 : 1) - (b.role === "owner" ? -1 : 1));
  const num = x => Number(x) || 999; const mem = ps.filter(x => x.role === "member").sort((a, b) => num(a.p.num) - num(b.p.num));
  const row = x => `<a class="li" href="#/player/${esc(x.uid)}" style="text-decoration:none;color:inherit"><span class="av">${esc(ini(x.name))}</span><span style="flex:1;min-width:0"><b>${esc(x.name)}</b> ${x.role !== "member" ? `<span class="tag">${ROLE[x.role]}</span>` : ""} ${dueTag(x.uid)}${x.uid === S.uid ? ` <span class="hint">나</span>` : ""}<br><span class="hint">${esc([x.p.num ? x.p.num + "번" : "", x.p.pos1, "출석 " + attN(x.uid) + "/" + evs.length].filter(Boolean).join(", "))}</span></span><span class="hint">›</span></a>`;
  const posReqs = ps.filter(x => ((S.rsvp[x.uid] || {}).posReq || {}).status === "req"); const admReqs = S.role === "owner" ? S.members.filter(m => m.admin_req && m.role === "member") : [];
  const rules = S.settings.rules || []; const un = unclaimed();
  return `<header class="top" style="padding:10px 12px">${LOGO(32)}<h1 style="font-size:20px;font-weight:900">선수</h1><a class="btn sm pri" href="#/invite">+ 초대</a></header><div class="body">
    ${tilesA([tileA(ps.length + un.length + "명", "전체"), tileA(admins.length + "명", "운영진"), tileA(low.length + "명", "출석 절반 이하", "#B45309")])}
    <a class="card" href="#/uniform" style="text-decoration:none;color:inherit;flex-direction:row;align-items:center;gap:14px">${jersey(64, (myProfile() || {}).num || "7", S.settings.uniformColor)}<span style="flex:1"><b>팀 유니폼</b><br><span class="hint">팀원 선수 카드에 등번호와 같이 보여요</span></span><span class="btn sm">바꾸기</span></a>
    ${posReqs.length + admReqs.length ? `<div class="card"><b>요청 ${posReqs.length + admReqs.length}건</b>${posReqs.map(x => { const r = S.rsvp[x.uid].posReq; return `<div style="display:flex;flex-direction:column;gap:8px;border-top:1px solid #F3F4F6;padding-top:10px"><div class="row" style="gap:10px"><span class="av">${esc(ini(x.name))}</span><span style="flex:1"><b>${esc(x.name)}</b> <span class="hint">포지션 변경 요청</span><br><span class="hint">${esc((x.p.pos1 || "-") + "에서 " + [r.pos1, r.pos2].filter(Boolean).join(", ") + (r.note ? ", " + r.note : ""))}</span></span></div><div class="row"><button class="btn block" data-act="posNo" data-u="${esc(x.uid)}">거절</button><button class="btn pri block" data-act="posOk" data-u="${esc(x.uid)}">수락</button></div></div>`; }).join("")}${admReqs.map(m => `<div style="display:flex;flex-direction:column;gap:8px;border-top:1px solid #F3F4F6;padding-top:10px"><div class="row" style="gap:10px"><span class="av">${esc(ini(nameOf(m.user_id)))}</span><span style="flex:1"><b>${esc(nameOf(m.user_id))}</b> <span class="hint">운영진 신청</span><br><span class="hint">팀장만 수락할 수 있어요</span></span></div><div class="row"><button class="btn block" data-act="adminAns" data-u="${esc(m.user_id)}" data-ok="">거절</button><button class="btn pri block" data-act="adminAns" data-u="${esc(m.user_id)}" data-ok="1">수락</button></div></div>`).join("")}</div>` : ""}
    <div class="card"><div class="spread"><b>운영진 ${admins.length}명</b></div><div class="list">${admins.map(row).join("")}</div></div>
    <div class="card"><div class="spread"><b>팀원 ${mem.length}명</b></div><div class="list">${mem.map(row).join("")}</div></div>
    ${un.length ? `<div class="card"><div class="spread"><b>가입 전 ${un.length}명</b><span class="hint">초대 링크로 들어와 이름을 고르면 연결돼요</span></div><div class="list">${un.map(p => `<div class="li" data-act="rosterOpen" data-pid="${esc(p.id)}" role="button" tabindex="0" style="cursor:pointer"><span class="av" style="background:#F3F4F6;color:#6B7280">${esc(ini(p.name))}</span><span style="flex:1"><b>${esc(p.name)}</b><br><span class="hint">${esc([p.num ? p.num + "번" : "", p.pos1, p.pos2].filter(Boolean).join(", "))}</span></span><span class="tag gray">가입 전</span></div>`).join("")}</div></div>` : ""}
    <a class="btn" href="#/roster-import">명단 붙여 넣어 한 번에 등록</a>
    <div class="card"><div class="spread"><b>우리 팀 수칙</b><a class="btn sm" href="#/rules-edit">수정</a></div>${rules.length ? `<div class="list">${rules.map(r => `<div class="li"><span style="flex:1">${esc(r.label)}</span>${Number(r.amount) ? `<b>${won(r.amount)}</b>` : `<span class="hint">글 수칙</span>`}</div>`).join("")}</div>` : `<span class="hint">아직 정한 수칙이 없어요.</span>`}</div>
    <div class="card"><div class="row" style="justify-content:space-between"><a class="btn sm" href="#/settings">팀 설정</a><span class="row"><button class="btn sm" data-act="switchTeam">다른 팀, 새 팀</button><button class="btn sm" data-act="logout">로그아웃</button></span></div><a class="hint" href="../../privacy.html">개인정보처리방침과 이용약관</a></div>
  </div>${nav("선수")}`;
}
function vDues() {
  const mode = feeMode(); const fee = Number(S.settings.fee) || 0; const ps = people(); const mon = ym();
  const reqs = []; Object.entries(D("payreq")).forEach(([u, d]) => Object.entries((d && d.items) || {}).forEach(([k, it]) => { if (it && it.status === "req") reqs.push({ u, k, ...it }); }));
  const key = "m-" + mon; const paidN = mode === "monthly" ? ps.filter(x => paidOf(key, x.uid)).length : 0;
  const due = mon + "-" + String(Math.min(28, Number(S.settings.dueDay) || 5)).padStart(2, "0"); const late = Math.round((new Date(todayStr() + "T00:00:00+09:00") - new Date(due + "T00:00:00+09:00")) / 864e5);
  const unpaid = ps.map(x => ({ ...x, o: owedOf(x.uid) })).filter(x => x.o.total).sort((a, b) => b.o.total - a.o.total);
  const fines = Object.entries(D("fines")).map(([id, f]) => ({ id, ...f })).filter(f => !f.paid).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const items = ((D("team").ledger || {}).items || []); const bal = items.reduce((s2, x) => s2 + (x.type === "in" ? 1 : -1) * (Number(x.amount) || 0), 0);
  const mi = items.filter(x => String(x.date).startsWith(mon)); const inM = mi.filter(x => x.type === "in").reduce((n, x) => n + (Number(x.amount) || 0), 0), outM = mi.filter(x => x.type !== "in").reduce((n, x) => n + (Number(x.amount) || 0), 0);
  const sel = UI.paySel || {};
  return `<header class="top" style="padding:10px 12px">${LOGO(32)}<h1 style="font-size:20px;font-weight:900">회비</h1><a class="btn sm" href="#/dues-settings">회비 설정</a></header><div class="body">
    ${mode === "none" ? `<div class="card"><b>회비를 받지 않는 팀이에요</b><span class="hint">회비 설정에서 월회비나 경기마다로 바꿀 수 있어요.</span></div>` : mode === "monthly" ? `<div class="card"><div class="spread"><b>${mLabel(mon)} 회비</b><span class="hint" style="${late > 0 ? "color:#B91C1C" : ""}">${md(due)} 마감${late > 0 ? ", " + late + "일 지났어요" : ""}</span></div>${tilesA([tileA(`${paidN} / ${ps.length}명`, "낸 사람"), tileA(`${won(paidN * fee).replace("원", "")} / ${won(ps.length * fee)}`, "모인 돈")])}</div>` : `<div class="card"><b>경기마다 ${won(fee)}</b><span class="hint">출석한 경기마다 회비가 쌓여요.</span></div>`}
    ${reqs.length ? `<div class="card"><div class="spread"><b>입금 확인 요청 ${reqs.length}건</b><span class="hint">팀원이 보냈어요를 눌렀어요</span></div><div class="list">${reqs.map(r => `<label class="li" style="cursor:pointer"><input type="checkbox" data-act="aPaySel" data-id="${esc(r.u + "|" + r.k)}" ${sel[r.u + "|" + r.k] !== false ? "checked" : ""} style="width:22px;height:22px;accent-color:#15803D"><span style="flex:1"><b>${esc(nameOf(r.u))}</b><br><span class="hint">${esc(r.label || "")}, ${esc(md(String(r.at).slice(0, 10)))} ${new Date(Date.parse(r.at) + 9 * 3600e3).toISOString().slice(11, 16)}</span></span><b>${won(r.amount)}</b><button class="btn sm" data-act="payNo" data-u="${esc(r.u)}" data-k="${esc(r.k)}">아님</button></label>`).join("")}</div><span class="hint">통장에 들어온 게 맞는지 확인하고 눌러 주세요. 거래내역을 올리면 이름과 금액이 같은 건 자동으로 확인돼요.</span><button class="btn pri" data-act="aPayBulk">체크한 ${reqs.filter(r => sel[r.u + "|" + r.k] !== false).length}건 확인</button></div>` : ""}
    <div class="card"><div class="spread"><b>미납 ${unpaid.length}명</b><span class="hint">현금으로 받았으면 받음을 눌러요</span></div>${unpaid.length ? `<div class="list">${unpaid.map(x => `<div class="li"><a href="#/player/${esc(x.uid)}" style="flex:1;text-decoration:none;color:inherit"><b>${esc(x.name)}</b>${x.uid === S.uid ? ` <span class="hint">나</span>` : ""}<br><span class="hint">${esc([x.o.months > 1 ? x.o.months + "달 미납" : x.o.months ? x.o.items.find(i => i.kind === "dues").label : "", x.o.fines ? "벌금 " + won(x.o.fines) : ""].filter(Boolean).join(", "))}</span></a><b>${won(x.o.total)}</b><button class="btn sm" data-act="aCash" data-u="${esc(x.uid)}">받음</button></div>`).join("")}</div><button class="btn" data-act="aDuesRemind">회비 알림 보내기</button>` : `<span class="hint">다 냈어요.</span>`}</div>
    <div class="card"><div class="spread"><b>벌금 미납</b><b>${won(fines.reduce((n, f) => n + (Number(f.amount) || 0), 0))}</b></div>${fines.length ? `<div class="list">${fines.map(f => `<div class="li"><span style="flex:1"><b>${esc(nameOf(f.uid))}</b><br><span class="hint">${esc(md(f.date || todayStr()) + " " + f.reason)}</span></span><b>${won(f.amount)}</b><button class="btn sm" data-act="fineToggle" data-id="${esc(f.id)}">받음</button></div>`).join("")}</div>` : `<span class="hint">미납 벌금이 없어요.</span>`}<span class="hint">벌금은 현장 출석에서 매겨지고, 회비 알림에 같이 담겨요</span></div>
    <div class="card"><div class="spread"><b>팀 통장</b><span class="hint">${items.length ? md(items.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0].date) + " 기준" : ""}</span></div><b style="font-size:24px">${won(bal)}</b><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><span style="background:#F9FAFB;border-radius:12px;padding:10px 12px"><span class="hint" style="font-size:12px">${Number(mon.slice(5))}월 들어온 돈</span><br><b style="color:#15803D">+ ${won(inM)}</b></span><span style="background:#F9FAFB;border-radius:12px;padding:10px 12px"><span class="hint" style="font-size:12px">${Number(mon.slice(5))}월 나간 돈</span><br><b style="color:#B91C1C">- ${won(outM)}</b></span></div><div class="row"><a class="btn block" href="#/ledger">통장 내역</a><a class="btn block" href="#/upload">거래내역 올리기</a></div></div>
  </div>${nav("회비")}`;
}
function vDuesSettings() {
  const f = S.form; const chip = (k, v, l) => `<button class="chip sm ${String(f[k]) === String(v) ? "on" : ""}" data-act="pick" data-k="${k}" data-v="${v}">${l}</button>`;
  return `${top("회비 설정", "#/dues")}<div class="body"><div class="card">
    <div class="field"><span class="lab">회비 방식</span><div class="chips">${chip("feeMode", "monthly", "월회비")}${chip("feeMode", "per_game", "경기마다")}${chip("feeMode", "none", "안 받음")}</div></div>
    ${f.feeMode !== "none" ? `<label class="field"><span class="lab">금액</span><div class="row"><span class="hint">${f.feeMode === "per_game" ? "한 경기에" : "한 달에"}</span><input class="inp" data-bind="fee" value="${esc(f.fee || "")}" inputmode="numeric" placeholder="30000" style="flex:1"><span>원</span></div><span class="hint">바꾼 금액은 다음 달부터 적용돼요</span></label>` : ""}
    ${f.feeMode === "monthly" ? `<div class="field"><span class="lab">납부일</span><div class="chips">${["1", "5", "10", "25", "28"].map(d => chip("dueDay", d, d === "28" ? "말일" : d + "일")).join("")}</div></div>` : ""}
  </div><div class="card"><span class="lab">받을 계좌</span>
    <input class="inp" data-bind="bank" value="${esc(f.bank || "")}" placeholder="은행 (예: 카카오뱅크)" aria-label="은행">
    <input class="inp" data-bind="account" value="${esc(f.account || "")}" inputmode="numeric" placeholder="계좌번호" aria-label="계좌번호">
    <input class="inp" data-bind="holder" value="${esc(f.holder || "")}" placeholder="예금주" aria-label="예금주">
    <span class="hint">모임통장이면 거래내역 파일로 입금을 자동 확인해요</span>
  </div><div class="card"><span class="lab">자동 알림</span>
    <label class="spread" style="min-height:44px"><span>납부일 전날 알림<br><span class="hint">아직 안 낸 팀원 알림함에만 가요</span></span><input type="checkbox" data-bind="remindEve" ${f.remindEve ? "checked" : ""} style="width:24px;height:24px;accent-color:#15803D"></label>
    <label class="spread" style="min-height:44px"><span>마감이 지나면 3일마다<br><span class="hint">다 낼 때까지 보내요</span></span><input type="checkbox" data-bind="remindAfter" ${f.remindAfter ? "checked" : ""} style="width:24px;height:24px;accent-color:#15803D"></label>
  </div></div><div class="cta"><button class="btn pri block" data-act="aSaveDues">저장하기</button></div>`;
}
function vLedger() {
  const items = ((D("team").ledger || {}).items || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date))); const bal = items.reduce((s2, x) => s2 + (x.type === "in" ? 1 : -1) * (Number(x.amount) || 0), 0);
  const groups = {}; items.forEach(x => { (groups[String(x.date).slice(0, 7)] = groups[String(x.date).slice(0, 7)] || []).push(x); }); const b = S.settings.bank || {}; const up = D("team").ledger || {};
  return `${top("통장 내역", "#/dues", `<a class="btn sm pri" href="#/spend">+ 직접 기록</a>`)}<div class="body">
    <div class="card"><span class="hint">${esc([b.bank, b.holder ? "예금주 " + b.holder : ""].filter(Boolean).join(", ") || "팀 통장")}</span><b style="font-size:28px">${won(bal)}</b>${up.uploadAt ? `<span class="hint">${md(up.uploadAt.slice(0, 10))}에 ${esc(nameOf(up.uploadBy))} 님이 거래내역을 올렸어요</span>` : ""}<a class="btn" href="#/upload">거래내역 올리기</a></div>
    ${Object.keys(groups).length ? Object.entries(groups).map(([k, xs]) => `<b style="color:#374151">${Number(k.slice(5))}월</b><div class="card" style="padding:4px 16px"><div class="list">${xs.map(x => `<div class="li"><span class="hint" style="width:44px;flex:none">${md(x.date)}</span><span style="flex:1"><b>${esc(x.label)}</b>${x.cat ? `<br><span class="hint">${esc(x.cat)}</span>` : ""}</span><b style="color:${x.type === "in" ? "#15803D" : "#B91C1C"}">${x.type === "in" ? "+" : "-"} ${won(x.amount)}</b><button class="iconbtn" data-act="ledgerDel" data-id="${esc(x.id)}" aria-label="지우기">✕</button></div>`).join("")}</div></div>`).join("") : `<div class="card empty"><b>아직 내역이 없어요</b></div>`}
    <span class="hint">팀원 모두 같은 내역을 봐요.</span></div>`;
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
    ${tab === "game" ? `<div class="card"><b>시즌 요약</b>${tilesA([tileA(games.length + scr, "경기"), tileA(`<span style="font-size:16px">${w}승 ${d2}무 ${l}패</span>`, "전적"), tileA(Math.round(avg * 10) / 10, "평균 참석"), tileA(won(fineSum).replace("원", ""), "벌금 누적")])}${scr || pend ? `<span class="hint">${[scr ? "내전 " + scr + "번" : "", pend ? "결과 대기 " + pend + "경기" : ""].filter(Boolean).join("과 ")}은 승패에서 빠져 있어요</span>` : ""}</div>
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
  const f = S.form; const n = S.members.length;
  return `${top("공지 쓰기", "#/notices")}<div class="body"><div class="card">
    <div class="field"><span class="lab">종류</span><div class="chips"><button class="chip sm ${!f.poll ? "on" : ""}" data-act="pick" data-k="poll" data-v="">공지</button><button class="chip sm ${f.poll ? "on" : ""}" data-act="pick" data-k="poll" data-v="1">설문</button></div></div>
    <label class="field"><span class="lab">제목</span><input class="inp" data-bind="title" value="${esc(f.title || "")}" maxlength="60" placeholder="제목"></label>
    <label class="field"><span class="lab">내용</span><textarea class="inp" data-bind="body" placeholder="자세한 안내">${esc(f.body || "")}</textarea></label>
    ${f.poll ? `<div class="field"><span class="lab">보기</span>${(f.opts || []).map((o, i) => `<input class="inp" data-opt="${i}" value="${esc(o.label)}" placeholder="보기 ${i + 1}" aria-label="보기 ${i + 1}">`).join("")}<button class="btn sm" data-act="optAdd" style="align-self:flex-start">+ 보기 추가</button></div><label class="field"><span class="lab">마감</span><input class="inp" type="date" data-bind="until" value="${esc(f.until || "")}"></label>` : ""}
    <label class="spread" style="min-height:44px"><span><b>맨 위에 고정</b><br><span class="hint">고정은 하나만 돼요. 예전 고정은 풀려요</span></span><input type="checkbox" data-bind="pinned" ${f.pinned ? "checked" : ""} style="width:24px;height:24px;accent-color:#15803D"></label>
    <span class="hint">팀원 ${n}명 모두의 알림함에 바로 보여요</span>
  </div></div><div class="cta"><button class="btn pri block" data-act="aNoticeSave">올리기</button></div>`;
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
  const joined = S.members.filter(m => m.user_id !== S.uid && m.joined_at && now - Date.parse(m.joined_at) < 30 * 864e5).sort((a, b) => String(b.joined_at).localeCompare(String(a.joined_at)));
  if (joined.length) add(joined[0].joined_at, `새 팀원 ${joined.length}명`, `${joined.slice(0, 5).map(m => nameOf(m.user_id)).join(", ")}${joined.length > 5 ? " 외 " + (joined.length - 5) + "명" : ""}이(가) 들어왔어요`, "#/players");
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
    ${reqs.filter(g => g.status === "req").map(g => `<div class="card"><div class="row" style="gap:12px"><span class="av">${esc(ini(g.name))}</span><span style="flex:1"><b>${esc(g.name)}</b> <span class="tag gray">용병</span><br><span class="hint">${esc([nameOf(g.u) + " 신청", g.rel, g.pos, ago(g.at)].filter(Boolean).join(", "))}</span></span></div><div class="row"><button class="btn block" data-act="guestNo" data-u="${esc(g.u)}" data-k="${esc(g.k)}">거절</button><button class="btn pri block" data-act="guestOk" data-eid="${esc(e.id)}" data-u="${esc(g.u)}" data-k="${esc(g.k)}">수락</button></div></div>`).join("") || `<div class="card empty"><b>확인할 신청이 없어요</b></div>`}
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

function owedOf(u) {
  const fee = Number(S.settings.fee) || 0; const items = [];
  if (feeMode() === "monthly") monthsList().forEach(m => { if (!paidOf("m-" + m, u)) items.push({ kind: "dues", key: "m-" + m, label: mLabel(m), amount: fee }); });
  if (feeMode() === "per_game") past().filter(isPlay).forEach(e => { if (cameTo(e, u) && !paidOf("e-" + e.id, u)) items.push({ kind: "dues", key: "e-" + e.id, label: md(e.date) + " 경기", amount: fee }); });
  finesOf(u).filter(f => !f.paid).forEach(f => items.push({ kind: "fine", id: f.id, label: (f.reason || "벌금") + " 벌금", amount: Number(f.amount) || 0 }));
  return { items, total: items.reduce((n, x) => n + x.amount, 0), months: items.filter(x => x.kind === "dues").length, fines: items.filter(x => x.kind === "fine").reduce((n, x) => n + x.amount, 0) };
}
function duesRemindText() {
  const ps = people().map(x => ({ ...x, o: owedOf(x.uid) })).filter(x => x.o.total); const b = S.settings.bank || {};
  return `[${S.team.name}] 회비 안내\n${ps.map(x => `${x.name} ${won(x.o.total)}`).join("\n")}${b.account ? `\n${b.bank || ""} ${b.account} ${b.holder || ""}` : ""}\n매니볼 회비 탭에서 입금하기를 누르고 보내 주세요.`;
}
function vSpend() {
  const f = S.form; const chip = (k, v, l) => `<button class="chip sm ${String(f[k]) === String(v) ? "on" : ""}" data-act="pick" data-k="${k}" data-v="${v}">${l}</button>`;
  const d = n => new Date(Date.now() + 9 * 3600e3 - n * 864e5).toISOString().slice(0, 10);
  return `${top("직접 기록", "#/ledger")}<div class="body"><div class="card">
    <div class="field"><span class="lab">종류</span><div class="chips">${chip("type", "out", "나간 돈")}${chip("type", "in", "들어온 돈")}</div></div>
    <label class="field"><span class="lab">금액</span><div class="row"><input class="inp" data-bind="amount" value="${esc(f.amount || "")}" inputmode="numeric" placeholder="얼마" style="flex:1"><span>원</span></div></label>
    <div class="field"><span class="lab">날짜</span><div class="chips">${chip("date", d(0), "오늘 " + md(d(0)))}${chip("date", d(1), "어제 " + md(d(1)))}${chip("date", d(2), "그저께 " + md(d(2)))}</div></div>
    <div class="field"><span class="lab">분류</span><div class="chips">${(f.type === "in" ? ["회비", "참가비", "후원", "기타"] : ["구장비", "장비", "회식", "기타"]).map(c => chip("cat", c, c)).join("")}</div></div>
    <label class="field"><span class="lab">메모</span><input class="inp" data-bind="label" value="${esc(f.label || "")}" maxlength="40" placeholder="내용"></label>
    <span class="hint">현금으로 쓰거나 받은 돈을 적어요. 팀원 통장 내역에도 똑같이 보여요.</span>
  </div></div><div class="cta"><button class="btn pri block" data-act="aSpendSave">저장하기</button></div>`;
}
function vUpload() {
  const m = UI.match; const up = D("team").ledger || {};
  if (!m) return `${top("거래내역 올리기", "#/dues")}<div class="body">
    <div class="card"><b>통장 내역으로 한 번에 확인해요</b><span class="hint">보낸 사람 이름과 금액이 맞으면 납부 완료로 바꾸고, 나간 돈은 통장 내역에 적어 둬요.</span>
      <div class="list">${[["카카오뱅크 앱에서 모임통장을 열어요", ""], ["거래내역을 파일로 저장해요", "엑셀이나 CSV"], ["저장한 파일을 아래에 올려요", ""]].map(([a, b], i) => `<div class="li"><span class="av" style="width:32px;height:32px">${i + 1}</span><span style="flex:1"><b>${a}</b>${b ? `<br><span class="hint">${b}</span>` : ""}</span></div>`).join("")}</div>
      <label class="btn pri" style="cursor:pointer">파일 고르기<input type="file" id="upFile" accept=".csv,.xlsx,.xls,.txt" style="display:none"></label>
      <span class="hint">안심: 날짜, 보낸 사람, 금액만 읽어요. 파일은 이 휴대폰 안에서만 읽고 어디에도 올리지 않아요.</span>${up.uploadAt ? `<span class="hint">마지막으로 올린 날 ${md(up.uploadAt.slice(0, 10))}, ${esc(nameOf(up.uploadBy))}</span>` : ""}</div></div>`;
  const auto = m.rows.filter(r => r.kind === "auto"), ask = m.rows.filter(r => r.kind === "ask"), out = m.rows.filter(r => r.kind === "out");
  return `${top("맞춰본 결과", "#/upload")}<div class="body">
    <div class="card"><b>새 거래 ${m.rows.length}건을 찾았어요</b><span class="hint">${m.since ? md(m.since) + " 이후 내역이에요. " : ""}확인하고 반영해 주세요.</span></div>
    ${auto.length ? `<div class="card"><b>자동으로 맞췄어요 ${auto.length}건</b><div class="list">${auto.map(r => `<div class="li"><span style="width:22px;color:#15803D;font-weight:900">✓</span><span style="flex:1"><b>${esc(nameOf(r.uid))}</b><br><span class="hint">${esc(md(r.date) + ", " + r.what)}</span></span><b style="color:#15803D">+ ${won(r.amount)}</b></div>`).join("")}</div></div>` : ""}
    ${ask.length ? `<div class="card"><b>누가 보냈는지 골라 주세요 ${ask.length}건</b>${ask.map(r => `<div style="display:flex;flex-direction:column;gap:6px;border-top:1px solid #F3F4F6;padding-top:10px"><div class="spread"><span>${esc(md(r.date))}, 보낸 사람 <b>${esc(r.name)}</b></span><b style="color:#15803D">+ ${won(r.amount)}</b></div><select class="inp" data-match="${r.i}" aria-label="보낸 사람 고르기"><option value="">팀원 아님 (통장 내역에만)</option>${people().map(x => `<option value="${esc(x.uid)}" ${r.uid === x.uid ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></div>`).join("")}<span class="hint">이름이 비슷한 팀원을 먼저 골라 뒀어요</span></div>` : ""}
    ${out.length ? `<div class="card"><b>나간 돈 ${out.length}건</b>${out.map(r => `<div style="display:flex;flex-direction:column;gap:6px;border-top:1px solid #F3F4F6;padding-top:10px"><div class="spread"><span>${esc(md(r.date) + ", " + r.name)}</span><b style="color:#B91C1C">- ${won(r.amount)}</b></div><div class="chips">${["구장비", "장비", "회식", "기타"].map(c => `<button class="chip sm ${r.cat === c ? "on" : ""}" data-act="aMatchCat" data-i="${r.i}" data-v="${c}">${c}</button>`).join("")}</div></div>`).join("")}</div>` : ""}
  </div><div class="cta"><button class="btn pri block" data-act="aMatchApply">${m.rows.length}건 반영하기</button><span class="hint" style="text-align:center">반영하면 팀원 회비 화면에도 바로 보여요</span></div>`;
}
async function readBankFile(file) {
  let rows = [];
  if (/\.xlsx?$/i.test(file.name)) { const XLSX = await import("xlsx"); const wb = XLSX.read(await file.arrayBuffer(), { type: "array" }); rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false }); }
  else { const txt = await file.text(); rows = txt.split(/\r?\n/).map(l => { const out = []; let cur = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if ((ch === "," || ch === "\t") && !q) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out; }); }
  const hi = rows.findIndex(r => r.some(c => /거래일|일시|날짜/.test(String(c))) && r.some(c => /금액|입금|출금/.test(String(c))));
  if (hi < 0) throw new Error("거래내역 표를 찾지 못했어요. 날짜, 내용, 금액 칸이 있는 파일인지 확인해 주세요");
  const h = rows[hi].map(c => String(c || "").replace(/\s/g, ""));
  const col = re => h.findIndex(c => re.test(c));
  const cD = col(/거래일|일시|날짜/), cN = col(/적요|내용|보낸|받는|거래처|입금자|메모/), cIn = col(/입금/), cOut = col(/출금/), cAmt = col(/^거래금액$|^금액$/), cType = col(/구분|거래구분/);
  const num = v => Number(String(v || "").replace(/[^0-9-]/g, "")) || 0;
  return rows.slice(hi + 1).map(r => { const dm = String(r[cD] || "").match(/(\d{4})\D*(\d{1,2})\D*(\d{1,2})/); if (!dm) return null;
    let amt = cIn >= 0 || cOut >= 0 ? (num(r[cIn]) || -num(r[cOut])) : num(r[cAmt]); if (cType >= 0 && /출금/.test(r[cType]) && amt > 0) amt = -amt;
    return amt ? { date: `${dm[1]}-${dm[2].padStart(2, "0")}-${dm[3].padStart(2, "0")}`, name: String(r[cN] || "").trim().slice(0, 30), amount: amt } : null; }).filter(Boolean);
}
function buildMatch(tx) {
  const since = (D("team").ledger || {}).uploadAt ? (D("team").ledger || {}).uploadLast || "" : "";
  const ps = people(); const sim = n => ps.find(x => n && (n === x.name || n.includes(x.name) || x.name.includes(n) || (n.length >= 2 && x.name.startsWith(n.slice(0, 2)))));
  const rows = tx.filter(t => !since || t.date > since).map((t, i) => {
    if (t.amount < 0) return { i, kind: "out", date: t.date, name: t.name, amount: -t.amount, cat: /구장|풋살|축구장/.test(t.name) ? "구장비" : /마트|스포츠/.test(t.name) ? "장비" : "기타" };
    const exact = ps.find(x => x.name === t.name); const o = exact ? owedOf(exact.uid) : null;
    if (exact && o && o.total && (o.total === t.amount || o.items.some(it => it.amount === t.amount))) return { i, kind: "auto", date: t.date, name: t.name, amount: t.amount, uid: exact.uid, what: o.total === t.amount ? o.items.map(x => x.label).join(", ") : o.items.find(it => it.amount === t.amount).label };
    const g = sim(t.name); return { i, kind: "ask", date: t.date, name: t.name, amount: t.amount, uid: g ? g.uid : "" };
  });
  return { rows, since, last: tx.reduce((m2, t) => t.date > m2 ? t.date : m2, since || "") };
}
function vPlayerAdmin(u) {
  const x = people().find(p => p.uid === u); if (!x) return vPlayers(); const y = todayStr().slice(0, 4); const evs = past().filter(e => e.date.startsWith(y));
  const n = evs.filter(e => cameTo(e, u)).length, late = evs.filter(e => (e.check || {})[u] === "late").length, abs = evs.filter(e => (e.check || {})[u] === "absent").length;
  let streak = 0; for (const e of evs) { if (cameTo(e, u)) break; streak++; }
  const o = owedOf(u); const j = joinedOf(u); const owner = S.role === "owner";
  const hist = []; if (feeMode() === "monthly") monthsList().slice(0, 4).forEach(m => hist.push([mLabel(m) + " 회비", paidOf("m-" + m, u)])); finesOf(u).slice(0, 4).forEach(f => hist.push([(f.reason || "벌금") + " 벌금 " + md(f.date || todayStr()), !!f.paid]));
  return `${top("선수 정보", "#/players")}<div class="body">
    <div class="card" style="align-items:center;text-align:center"><span class="av" style="width:72px;height:72px;font-size:28px">${esc(ini(x.name))}</span><b style="font-size:22px">${esc(x.name)} <span class="tag">${ROLE[x.role]}</span></b>${o.months ? `<span class="tag" style="background:#FEF2F2;color:#B91C1C">${o.months > 1 ? o.months + "달" : Number(ym().slice(5)) + "월"} 미납</span>` : ""}<span class="hint">${esc([x.p.num ? x.p.num + "번" : "", x.p.pos1, x.p.foot].filter(Boolean).join(", "))}</span>${j ? `<span class="hint">${j.slice(0, 4)}년 ${Number(j.slice(5, 7))}월에 들어왔어요</span>` : ""}</div>
    <div class="card"><div class="spread"><b>이번 시즌</b><a class="hint" href="#/records" style="text-decoration:none">기록 보기 ›</a></div>${tilesA([tileA(n + "/" + evs.length, "출석"), tileA(late, "지각", "#B45309"), tileA(abs, "무단 결석", "#B91C1C")])}${streak >= 3 ? `<span class="hint" style="color:#B45309">최근 ${streak}번 연속 불참이에요</span>` : ""}</div>
    <div class="card"><div class="spread"><b>회비와 벌금</b><a class="hint" href="#/dues" style="text-decoration:none">회비에서 보기 ›</a></div>${hist.length ? `<div class="list">${hist.map(([l, p]) => `<div class="li"><span style="flex:1">${esc(l)}</span><span class="tag ${p ? "" : "gray"}" style="${p ? "" : "background:#FEF2F2;color:#B91C1C"}">${p ? "납부" : "미납"}</span></div>`).join("")}</div>` : `<span class="hint">기록이 없어요.</span>`}${o.total ? `<div class="spread"><span>밀린 돈</span><b style="color:#B91C1C">${won(o.total)}</b></div><button class="btn sm" data-act="aCash" data-u="${esc(u)}" style="align-self:flex-start">현금으로 받음</button>` : ""}</div>
    <div class="card"><b>포지션</b><div class="field"><span class="hint">1선호</span><div class="chips">${POS[sport()].map(p => `<button class="chip sm ${x.p.pos1 === p ? "on" : ""}" data-act="aSetPos" data-u="${esc(u)}" data-k="pos1" data-v="${p}">${p}</button>`).join("")}</div></div><div class="field"><span class="hint">2선호</span><div class="chips">${POS[sport()].filter(p => p !== x.p.pos1).map(p => `<button class="chip sm ${x.p.pos2 === p ? "on" : ""}" data-act="aSetPos" data-u="${esc(u)}" data-k="pos2" data-v="${p}">${p}</button>`).join("")}</div></div><span class="hint">누르면 바로 바뀌고 다음 라인업부터 반영돼요</span></div>
    ${u !== S.uid ? `<div class="card"><div class="spread"><b>역할</b><span class="hint">팀장만 바꿀 수 있어요</span></div>${owner ? `${x.role === "member" ? `<button class="btn" data-act="aPromote" data-u="${esc(u)}">운영진으로 지정</button>` : x.role === "admin" ? `<button class="btn" data-act="setRole" data-u="${esc(u)}" data-v="member">팀원으로 바꾸기</button><button class="btn" data-act="giveOwner" data-u="${esc(u)}">팀장 넘기기</button>` : ""}<button class="btn danger" data-act="kick" data-u="${esc(u)}">팀에서 내보내기</button>` : `<span class="hint">${ROLE[x.role]}</span>`}</div>` : `<a class="btn" href="#/me">내 프로필 수정</a>`}
  </div>`;
}
function vRulesEdit() {
  const f = S.form;
  return `${top("팀 수칙 수정", "#/players")}<div class="body"><div class="card">
    ${(f.rules || []).map((r, i) => `<div class="row" style="gap:6px"><input class="inp" data-rule="${i}" data-f="label" value="${esc(r.label)}" placeholder="수칙" style="flex:2" aria-label="수칙 ${i + 1}"><input class="inp" data-rule="${i}" data-f="amount" value="${esc(r.amount || "")}" inputmode="numeric" placeholder="벌금 (없으면 글 수칙)" style="flex:1.2" aria-label="벌금 ${i + 1}"><button class="iconbtn" data-act="ruleDel" data-i="${i}" aria-label="삭제">✕</button></div>`).join("")}
    <button class="btn sm" data-act="ruleAdd" style="align-self:flex-start">+ 수칙 추가</button>
    <label class="spread" style="min-height:44px"><span><b>팀원에게 다시 동의 받기</b><br><span class="hint">저장하면 팀원이 다음에 들어올 때 바뀐 수칙에 동의해요</span></span><input type="checkbox" data-bind="reagree" ${f.reagree ? "checked" : ""} style="width:24px;height:24px;accent-color:#15803D"></label>
    <span class="hint">벌금 금액을 바꾸면 그다음 일정부터 적용돼요. 이미 매긴 벌금은 그대로예요.</span>
  </div></div><div class="cta"><button class="btn pri block" data-act="aRulesSave">저장하기</button></div>`;
}
function vUniform() {
  const f = S.form; const me = myProfile() || {};
  return `${top("팀 유니폼", "#/players")}<div class="body"><div class="card" style="align-items:center"><span class="hint">팀원마다 자기 등번호가 들어가요. 예시는 ${esc(me.name || "나")} ${esc(me.num || "7")}번</span>${jersey(200, me.num || "7", f.kit)}</div>
    <div class="card"><span class="lab">유니폼 색</span><div class="chips">${KIT.map(([c, l]) => `<button class="chip sm ${f.kit === c ? "on" : ""}" data-act="pick" data-k="kit" data-v="${c}"><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${c};border:1px solid #D1D5DB;vertical-align:-2px"></span> ${l}</button>`).join("")}</div>
      <span class="hint">사진으로 올리는 기능은 사진 저장 공간을 연결한 뒤에 열려요. 지금은 팀 색으로 기본 유니폼이 보여요.</span>
      <span class="hint">팀원 홈 화면의 선수 카드와 가입할 때 선수 등록 화면에 쓰여요.</span></div>
  </div><div class="cta"><button class="btn pri block" data-act="aUniformSave">저장하기</button></div>`;
}
const AACT3 = {
  aPaySel: t => { UI.paySel = { ...(UI.paySel || {}), [t.dataset.id]: t.checked }; render(); },
  aPayBulk: async t => {
    const sel = UI.paySel || {}; const list = []; Object.entries(D("payreq")).forEach(([u, d]) => Object.entries((d && d.items) || {}).forEach(([k, it]) => { if (it && it.status === "req" && sel[u + "|" + k] !== false) list.push([u, k, it]); }));
    if (!list.length) return; t.disabled = true;
    try { for (const [u, k, it] of list) { for (const ref of it.refs || []) { if (ref.kind === "dues") { const cur = { ...(D("dues")[ref.key] || {}) }; cur[u] = "paid"; cur._at = { ...(cur._at || {}), [u]: todayStr() }; await setDoc("dues", ref.key, cur); } else if (ref.kind === "fine" && D("fines")[ref.id]) await setDoc("fines", ref.id, { ...D("fines")[ref.id], paid: true, paidAt: todayStr() }); } await patchDoc("payreq", u, { items: { [k]: { status: "ok", doneAt: new Date().toISOString() } } }); }
      UI.paySel = {}; await syncMyDues(list.map(x => x[0])); render(); toast(`${[...new Set(list.map(x => nameOf(x[0])))].join(", ")} 납부를 확인했어요`); } catch (err) { t.disabled = false; fail(err); }
  },
  aCash: t => { const u = t.dataset.u; const o = owedOf(u);
    confirmBox("현금으로 받았어요", `${nameOf(u)}, ${o.items.map(x => x.label).join(", ")} ${won(o.total)}을 받은 걸로 할까요?`, "받음", async () => {
      try { for (const it of o.items) { if (it.kind === "dues") { const cur = { ...(D("dues")[it.key] || {}) }; cur[u] = "paid"; cur._at = { ...(cur._at || {}), [u]: todayStr() }; await setDoc("dues", it.key, cur); } else await setDoc("fines", it.id, { ...D("fines")[it.id], paid: true, paidAt: todayStr() }); }
        const items = ((D("team").ledger || {}).items || []).concat([{ id: uid36("l"), date: todayStr(), type: "in", cat: "회비", label: nameOf(u) + " " + o.items.map(x => x.label).join(", ") + " (현금)", amount: o.total }]); await setDoc("team", "ledger", { ...(D("team").ledger || {}), items });
        await syncMyDues([u]); render(); toast("받음으로 바꾸고 통장 내역에 적었어요"); } catch (err) { fail(err); } }); },
  aDuesRemind: () => { const text = duesRemindText(); const ps = people().filter(x => owedOf(x.uid).total);
    sheet(`<h3>미납 ${ps.length}명에게 알려요</h3><span class="hint">팀원 알림함에 회비 알림이 가고, 단톡방에 붙여 넣을 문구도 복사돼요</span><div class="hint" style="white-space:pre-wrap;background:#F9FAFB;border-radius:12px;padding:12px;color:#374151;max-height:40vh;overflow:auto">${esc(text)}</div><div class="row"><button class="btn block" data-act="closeSheet">취소</button><button class="btn pri block" id="drSend">알림 보내기</button></div>`);
    $("#drSend").onclick = async () => { try { await setDoc("team", "duesRemind", { at: new Date().toISOString(), by: S.uid, to: ps.map(x => x.uid) }); try { await navigator.clipboard.writeText(text); } catch (err) { /* 복사 실패 */ } closeSheet(); toast("알렸어요. 단톡방 문구도 복사했어요"); } catch (err) { fail(err); } }; },
  aSaveDues: async t => { const f = S.form; t.disabled = true;
    try { await setDoc("team", "settings", { ...S.settings, feeMode: f.feeMode, fee: f.feeMode === "none" ? 0 : Number(String(f.fee || "").replace(/\D/g, "")) || 0, dueDay: f.feeMode === "monthly" ? f.dueDay || "5" : "", bank: { bank: String(f.bank || "").trim(), account: String(f.account || "").trim(), holder: String(f.holder || "").trim() }, remindEve: !!f.remindEve, remindAfter: !!f.remindAfter }); await syncMyDues(); toast("저장했어요"); location.hash = "#/dues"; } catch (err) { t.disabled = false; fail(err); } },
  aSpendSave: async t => { const f = S.form; const amount = Number(String(f.amount || "").replace(/\D/g, "")); if (!amount) { toast("금액을 적어 주세요"); return; } t.disabled = true;
    const items = ((D("team").ledger || {}).items || []).concat([{ id: uid36("l"), date: f.date || todayStr(), type: f.type === "in" ? "in" : "out", cat: f.cat || "기타", label: String(f.label || f.cat || "기타").trim().slice(0, 40), amount }]);
    try { await setDoc("team", "ledger", { ...(D("team").ledger || {}), items }); toast("기록했어요"); location.hash = "#/ledger"; } catch (err) { t.disabled = false; fail(err); } },
  aMatchCat: t => { const r = UI.match.rows.find(x => x.i === Number(t.dataset.i)); if (r) r.cat = t.dataset.v; render(); },
  aMatchApply: async t => { const m = UI.match; if (!m) return; t.disabled = true; const items = ((D("team").ledger || {}).items || []).slice(); const touched = new Set();
    try {
      for (const r of m.rows) {
        if (r.kind === "out") { items.push({ id: uid36("l"), date: r.date, type: "out", cat: r.cat, label: r.name, amount: r.amount }); continue; }
        items.push({ id: uid36("l"), date: r.date, type: "in", cat: r.uid ? "회비" : "기타", label: r.uid ? nameOf(r.uid) + " 입금" : r.name, amount: r.amount });
        if (!r.uid) continue; let left = r.amount; const o = owedOf(r.uid); touched.add(r.uid);
        for (const it of o.items) { if (left < it.amount) continue; left -= it.amount; if (it.kind === "dues") { const cur = { ...(D("dues")[it.key] || {}) }; cur[r.uid] = "paid"; cur._at = { ...(cur._at || {}), [r.uid]: r.date }; await setDoc("dues", it.key, cur); } else await setDoc("fines", it.id, { ...D("fines")[it.id], paid: true, paidAt: r.date }); }
        const pr = Object.entries(((D("payreq")[r.uid] || {}).items) || {}).filter(([, it]) => it.status === "req"); for (const [k] of pr) await patchDoc("payreq", r.uid, { items: { [k]: { status: "ok", doneAt: new Date().toISOString() } } });
      }
      await setDoc("team", "ledger", { ...(D("team").ledger || {}), items, uploadAt: new Date().toISOString(), uploadBy: S.uid, uploadLast: m.last });
      await syncMyDues([...touched]); UI.match = null; toast(`${m.rows.length}건을 반영했어요`); location.hash = "#/dues";
    } catch (err) { t.disabled = false; fail(err); } },
  aSetPos: async t => { const u = t.dataset.u; const r = S.rsvp[u] || {}; const p = { ...(r.profile || {}) }; p[t.dataset.k] = p[t.dataset.k] === t.dataset.v && t.dataset.k === "pos2" ? "" : t.dataset.v; if (p.pos2 === p.pos1) p.pos2 = "";
    try { await patchDoc("rsvp", u, { profile: p }); render(); } catch (err) { fail(err); } },
  aPromote: t => { const u = t.dataset.u; confirmBox(`${nameOf(u)} 님을 운영진으로 지정할까요?`, "운영진은 일정 올리기, 라인업 짜기, 현장 출석과 벌금, 회비 확인과 알림, 선수 포지션 바꾸기를 할 수 있어요. 운영진 지정과 해제, 내보내기는 팀장만 할 수 있어요.", "지정하기", async () => { const { error } = await sb.rpc("set_member_role", { p_team: S.tid, p_user: u, p_role: "admin" }); if (error) fail(error); else { toast("운영진으로 지정했어요"); refreshMembers(); } }); },
  aRulesSave: async t => { const f = S.form; t.disabled = true; const rules = (f.rules || []).filter(r => String(r.label).trim()).map(r => ({ label: String(r.label).trim().slice(0, 40), amount: Number(String(r.amount || "").replace(/\D/g, "")) || 0 }));
    try { await setDoc("team", "settings", { ...S.settings, rules, rulesAt: new Date().toISOString(), rulesAgreeAt: f.reagree ? new Date().toISOString() : (S.settings.rulesAgreeAt || "") }); toast(f.reagree ? "저장했어요. 팀원이 다음에 들어오면 다시 동의해요" : "저장했어요"); location.hash = "#/players"; } catch (err) { t.disabled = false; fail(err); } },
  aUniformSave: async t => { t.disabled = true; try { await setDoc("team", "settings", { ...S.settings, uniformColor: S.form.kit || S.settings.uniformColor }); toast("저장했어요"); location.hash = "#/players"; } catch (err) { t.disabled = false; fail(err); } },
  aNoticeSave: async t => {
    const f = S.form; if (!String(f.title || "").trim()) { toast("제목을 적어 주세요"); return; } t.disabled = true;
    const opts = (f.opts || []).filter(o => String(o.label).trim()).map((o, i) => ({ id: "o" + (i + 1), label: String(o.label).trim().slice(0, 40) }));
    if (f.poll && opts.length < 2) { t.disabled = false; toast("설문 보기를 두 개 이상 적어 주세요"); return; }
    try {
      if (f.pinned) for (const [id, n] of Object.entries(D("notices"))) if (n.pinned) await setDoc("notices", id, { ...n, pinned: false });
      await setDoc("notices", uid36("n"), { title: String(f.title).trim(), body: String(f.body || "").trim(), pinned: !!f.pinned, by: S.uid, at: new Date().toISOString(), poll: f.poll ? { opts, until: f.until ? new Date(f.until + "T23:59:00+09:00").toISOString() : "" } : null });
      toast("공지를 올렸어요"); location.hash = "#/notices";
    } catch (err) { t.disabled = false; fail(err); }
  },
};
function adminForm(r) {
  if (r === "/dues-settings") { const st = S.settings; const b = st.bank || {}; S.form = { feeMode: st.feeMode || "none", fee: st.fee ? String(st.fee) : "", dueDay: st.dueDay || "5", bank: b.bank || "", account: b.account || "", holder: b.holder || "", remindEve: !!st.remindEve, remindAfter: !!st.remindAfter }; return true; }
  if (r === "/spend") { S.form = { type: "out", date: new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10), cat: "구장비", amount: "", label: "" }; return true; }
  if (r === "/upload") { UI.match = null; return true; }
  if (r === "/rules-edit") { S.form = { rules: (S.settings.rules || []).map(x => ({ label: x.label, amount: x.amount ? String(x.amount) : "" })), reagree: false }; return true; }
  if (r === "/uniform") { S.form = { kit: S.settings.uniformColor || "#164F33" }; return true; }
  if (r === "/notice-new") { S.form = { title: "", body: "", pinned: false, poll: "", opts: [{ label: "" }, { label: "" }], until: "" }; return true; }
  return false;
}
document.addEventListener("change", async ev => {
  const t = ev.target;
  if (t.id === "upFile" && t.files && t.files[0]) { try { const tx = await readBankFile(t.files[0]); UI.match = buildMatch(tx); if (!UI.match.rows.length) { toast("새 거래가 없어요"); UI.match = null; } render(); } catch (err) { toast(String(err.message || err)); } }
  if (t.dataset && t.dataset.match != null && UI.match) { const r = UI.match.rows.find(x => x.i === Number(t.dataset.match)); if (r) r.uid = t.value; }
});

export { AACT1, AACT2, AACT3, adminForm, eventFormInit, playerSheet, remindLeft, remindSheet, rosterSheet, vCalendarAdmin, vCheck, vCheckDone, vDues, vDuesSettings, vEvent, vEventForm, vGame, vGuests, vHomeAdmin, vLedger, vNoticeNew, vNotifyAdmin, vPlayerAdmin, vPlayers, vPosReq, vRecords, vResult, vRosterImport, vRulesEdit, vSchedule, vScrim, vSpend, vSquad, vUniform, vUpload };
