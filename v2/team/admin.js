// 운영진 화면: 디자인 시안 [운영진] 1-1 ~ 5-9. 팀원 화면은 member.js에 있다.
import { D, LOGO, POS, ROLE, S, UI, att, cameTo, dotDate, duesKey, esc, evName, evStart, eventCard, feeMode, guestReqs, guestsOf, isAdmin, isPlay, joinedOf, lateRow, mLabel, md, momClosed, momDeadline, momOpen, momWinners, monthsList, myProfile, myUv, myVote, nameOf, nav, noticeCard, noticesList, paidOf, parseRoster, past, people, profileOf, remindInfo, ruleAmt, scrimReady, sheet, sport, started, todayStr, top, unclaimed, upcoming, voteRow, wd, won, ym } from "./main.js";

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
  const next = upcoming()[0]; const a = next ? att(next) : null;
  const noProfile = S.members.filter(m => !profileOf(m.user_id)).length;
  const todo = [];
  if (!S.members.some(m => m.user_id !== S.uid)) todo.push(["팀원을 초대해 주세요", "초대 링크를 단톡방에 올리면 돼요", "#/invite", "초대하기"]);
  if (!next) todo.push(["다가오는 일정이 없어요", "일정을 올리면 팀원이 참석을 눌러요", "#/new", "일정 만들기"]);
  if (next && a.none.length) todo.push([`참석 미응답 ${a.none.length}명`, `${md(next.date)} ${wd(next.date)} ${next.type === "match" ? "경기" : "훈련"}`, "#/event/" + next.id, "보기"]);
  if (unclaimed().length) todo.push([`아직 앱에 안 들어온 선수 ${unclaimed().length}명`, "초대 링크를 단톡방에 올리면 명단에서 이름만 고르면 돼요", "#/invite", "초대하기"]);
  if (noProfile) todo.push([`선수 등록을 안 한 멤버 ${noProfile}명`, "들어와서 이름과 번호를 적으면 명단에 보여요", "#/players", "보기"]);
  const pr = Object.values(D("payreq")).reduce((n, d) => n + Object.values((d && d.items) || {}).filter(it => it && it.status === "req").length, 0);
  if (pr) todo.push([`입금 확인 요청 ${pr}건`, "통장에 들어왔는지 보고 확인을 눌러 주세요", "#/dues", "확인"]);
  Object.values(S.events).filter(e => !started(e)).forEach(e => { const n = guestReqs(e).filter(g => g.status === "req").length; if (n) todo.push([`용병 신청 ${n}명`, `${md(e.date)} ${evName(e)}`, "#/event/" + e.id, "보기"]); });
  const posN = people().filter(x => ((S.rsvp[x.uid] || {}).posReq || {}).status === "req").length;
  if (posN) todo.push([`포지션 변경 요청 ${posN}건`, "선수 목록에서 이름을 눌러 수락하거나 거절해요", "#/players", "보기"]);
  const admN = S.role === "owner" ? S.members.filter(m => m.admin_req && m.role === "member").length : 0;
  if (admN) todo.push([`운영진 신청 ${admN}명`, "선수 목록에서 이름을 눌러 수락하거나 거절해요", "#/players", "보기"]);
  Object.values(S.events).filter(scrimReady).forEach(e => { const d = Math.round((new Date(e.date + "T00:00:00+09:00") - new Date(todayStr() + "T00:00:00+09:00")) / 864e5); if (d >= 3) todo.push(["내전을 할 수 있어요", `${md(e.date)} 상대팀 미정, 참석과 대기 ${att(e).in + att(e).wait.length}명`, "#/event/" + e.id, "보기"]); });
  const today = Object.values(S.events).find(e => e.date === todayStr() && !Object.keys(e.check || {}).length);
  if (today) todo.push(["오늘 현장 출석을 불러 주세요", `${today.time || ""} ${evName(today)}`, "#/check/" + today.id, "출석"]);
  past().filter(e => e.type !== "training" && !e.score && Date.now() - evStart(e) < 7 * 864e5).forEach(e => todo.push(["경기 결과를 넣어 주세요", `${md(e.date)} ${evName(e)}, 넣으면 MOM 투표가 열려요`, "#/result/" + e.id, "입력"]));
  return `<header class="top" style="padding:10px 12px">${LOGO(32)}<span style="flex:1;line-height:1.2"><b style="font-size:17px">${esc(S.team.name)}</b><br><span class="hint" style="font-size:12px">${sport() === "soccer" ? "축구팀" : "풋살팀"}, 팀원 ${S.members.length}명, 나는 ${ROLE[S.role]}</span></span>${S.teams.length > 1 ? `<button class="iconbtn" data-act="switchTeam" aria-label="다른 팀">⇄</button>` : ""}</header>
  <div class="body">
    <div class="card"><div class="spread"><b style="font-size:16px">운영진이 할 일</b><span class="hint">${todo.length}개</span></div>
      ${todo.length ? `<div class="list">${todo.map(t => `<div class="li"><span style="flex:1;min-width:0"><b style="font-size:15px">${esc(t[0])}</b><br><span class="hint">${esc(t[1])}</span></span><a class="btn sm" href="${t[2]}">${esc(t[3])}</a></div>`).join("")}</div>` : `<span class="hint">지금은 할 일이 없어요.</span>`}
    </div>
    ${next ? `<div class="spread"><b>다음 일정</b><a href="#/schedule" class="hint" style="text-decoration:none">전체</a></div>${adminEventCard(next)}` : ""}
    ${homeExtras()}
    <div class="row" style="gap:8px"><a class="btn block" href="#/new">+ 일정 만들기</a><a class="btn block" href="#/invite">팀원 초대</a></div>
    <a class="btn" href="#/notices">공지와 설문</a>
    ${myProfile() ? `<button class="btn" data-act="viewMember">팀원 화면 보기 (내 참석, 내 선수 카드)</button>` : ""}
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
      <span class="hint" style="font-size:12px">경기 시작 전까지 투표가 열려 있어요${un ? `. 미응답 중 ${un}명은 아직 앱에 안 들어왔어요` : ""}</span></div>
    ${greq ? `<div class="spread" style="background:#FFFBEB;border-radius:12px;padding:10px 12px;font-size:13px;color:#92400E"><span><b>용병 신청 ${greq}건</b> 수락을 기다려요</span><a href="#/event/${esc(e.id)}" style="font-weight:700;text-decoration:none;color:#92400E">확인</a></div>` : ""}
    ${scrimReady(e) ? `<div style="display:flex;flex-direction:column;gap:10px;background:#EEF2FF;border-radius:14px;padding:12px 14px"><span style="font-size:13px;color:#3730A3;line-height:1.5"><b>내전 가능</b> 상대팀이 미정이고 참석과 대기를 합쳐 ${a.in + a.wait.length}명이에요.</span><a class="btn sm" href="#/event/${esc(e.id)}" style="background:#3730A3;color:#FFFFFF">내전 검토하기</a></div>` : ""}
    <div style="display:grid;grid-template-columns:repeat(${e.type === "training" ? 2 : 3},minmax(0,1fr));gap:8px"><button class="btn sm" data-act="remindOpen" data-eid="${esc(e.id)}" style="background:#FEF2F2;color:#B91C1C;font-size:13px;padding:8px 2px;white-space:nowrap">미응답 알리기</button>${e.type !== "training" ? `<a class="btn sm pri" href="#/lineup/${esc(e.id)}" style="font-size:13px;padding:8px 2px;white-space:nowrap">라인업 짜기</a>` : ""}<a class="btn sm" href="#/check/${esc(e.id)}" style="font-size:13px;padding:8px 2px;white-space:nowrap">현장 출석</a></div>`}
  </div>`;
}
function vScheduleAdmin() {
  const m = UI.month || ym(); const [y, mo] = m.split("-").map(Number);
  const inMonth = e => e.date.slice(0, 7) === m;
  const up = upcoming().filter(inMonth), done = past().filter(inMonth);
  const later = upcoming().filter(e => e.date.slice(0, 7) > m).length;
  return `<header class="top" style="padding:10px 12px">${LOGO(32)}<h1 style="font-size:20px;font-weight:900">일정</h1><a class="btn sm pri" href="#/new">+ 일정 만들기</a></header><div class="body">
    <div class="spread card" style="padding:6px;flex-direction:row"><button class="iconbtn" data-act="monthGo" data-d="-1" aria-label="이전 달">‹</button><b style="font-size:16px">${y}년 ${mo}월</b><button class="iconbtn" data-act="monthGo" data-d="1" aria-label="다음 달">›</button></div>
    <b style="font-size:15px;color:#374151">다가오는 일정</b>
    ${up.length ? up.map(adminEventCard).join("") : `<div class="card empty"><b>${mo}월에 남은 일정이 없어요</b><span class="hint">${later ? `다음 달에 일정 ${later}개가 있어요.` : "일정을 만들면 팀원이 참석을 눌러요."}</span><a class="btn pri" href="#/new">일정 만들기</a></div>`}
    ${done.length ? `<b style="font-size:15px;color:#374151;margin-top:8px">지난 일정</b>${done.map(adminEventCard).join("")}` : ""}
  </div>${nav("일정")}`;
}
function remindSheet(eid) {
  const e = S.events[eid]; if (!e) return; const a = att(e); const un = unclaimed();
  const left = remindLeft(); const r = remindInfo();
  const names = a.none.map(x => x.name).concat(un.map(p => p.name));
  const ago = r && r.at ? Math.max(1, Math.round((Date.now() - Date.parse(r.at)) / 60000)) : 0;
  sheet(`<h3>미응답 ${names.length}명에게 알려요</h3><span class="hint">${esc(md(e.date) + " " + wd(e.date) + " " + (e.time || "") + " " + evName(e))}, 경기 시작 전까지 투표</span>
    <div class="list" style="max-height:38vh;overflow:auto">${a.none.map(x => `<div class="li"><b style="flex:1">${esc(x.name)}</b><span class="hint">앱 알림</span></div>`).join("")}${un.map(p => `<div class="li"><b style="flex:1">${esc(p.name)}</b><span class="tag gray">가입 전</span></div>`).join("") || ""}${names.length ? "" : `<span class="hint">미응답이 없어요.</span>`}</div>
    <div style="background:#FFFBEB;border-radius:14px;padding:12px 14px;font-size:13px;line-height:1.5;color:#92400E">${left ? `<b>${ago}분 전에 ${esc(nameOf(r.by))} 님이 알렸어요</b><br>미응답 알림은 운영진 모두 합쳐 1시간에 한 번만 보낼 수 있어요.` : `미응답 알림은 운영진 모두 합쳐 1시간에 한 번만 보낼 수 있어요.${r && r.at ? ` 마지막 알림은 ${esc(nameOf(r.by))} 님이 보냈어요.` : ""}`}<br>앱에 들어온 사람은 홈에 알림이 뜨고, 단톡방에 붙여 넣을 문구도 복사돼요.</div>
    <div class="row"><button class="btn block" data-act="closeSheet">닫기</button>${left ? `<button class="btn block" disabled>${Math.ceil(left / 60000)}분 뒤 가능</button>` : `<button class="btn pri block" data-act="remindSend" data-eid="${esc(e.id)}" ${names.length ? "" : "disabled"}>알리기</button>`}</div>`);
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
  const chip = (k, v, l) => `<button class="chip ${f[k] === v ? "on" : ""}" data-act="pick" data-k="${k}" data-v="${v}">${l}</button>`;
  return `${top(isNew ? "일정 만들기" : "일정 수정", isNew ? "#/schedule" : "#/event/" + id)}<div class="body">
    <div class="card">
      <div class="field"><span class="lab">종류</span>${f.type === "scrim" ? `<span class="hint">내전으로 바뀐 일정이에요. A팀과 B팀은 스쿼드 나누기에서 정해요.</span>` : `<div class="chips">${chip("type", "match", "경기")}${chip("type", "training", "훈련")}</div>`}</div>
      <label class="field"><span class="lab">날짜</span><input class="inp" type="date" data-bind="date" value="${esc(f.date || "")}" min="${todayStr()}"></label>
      <div class="row" style="gap:8px"><label class="field" style="flex:1"><span class="lab">시작</span><input class="inp" type="time" data-bind="time" value="${esc(f.time || "")}"></label><label class="field" style="flex:1"><span class="lab">끝</span><input class="inp" type="time" data-bind="end" value="${esc(f.end || "")}"></label></div>
      <label class="field"><span class="lab">장소</span><input class="inp" data-bind="place" value="${esc(f.place || "")}" maxlength="40" placeholder="예: 잠실 풋살장 2번 코트"></label>
      ${f.type === "match" ? `<label class="field"><span class="lab">상대팀</span><input class="inp" data-bind="opponent" value="${esc(f.opponent || "")}" maxlength="30" placeholder="비워 두면 상대팀 미정"></label>` : ""}
      <div class="field"><span class="lab">정원</span><div class="row"><button class="btn sm" data-act="cap" data-d="-1" aria-label="정원 줄이기">−</button><b style="min-width:56px;text-align:center;font-size:18px">${f.cap ? f.cap + "명" : "제한 없음"}</b><button class="btn sm" data-act="cap" data-d="1" aria-label="정원 늘리기">+</button></div><span class="hint">정원이 차면 다음 신청은 대기로 들어가요.</span></div>
      <label class="field"><span class="lab">메모</span><textarea class="inp" data-bind="memo" placeholder="준비물, 주차 같은 안내" style="min-height:72px">${esc(f.memo || "")}</textarea></label>
      <span class="hint">참석 투표는 일정 시작 전까지 열려 있어요.</span>
    </div>
    ${isNew ? "" : `<button class="btn danger" data-act="delEvent" data-eid="${esc(id)}">일정 지우기</button>`}
  </div><div class="cta"><button class="btn pri block" data-act="saveEvent" data-eid="${esc(id || "")}">${isNew ? "일정 올리기" : "저장"}</button></div>`;
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
  const e = S.events[id]; if (!e) return vEvent(id);
  const a = att(e); const list = [...a.yes, ...a.late, ...a.no, ...a.none, ...a.wait];
  const ck = e.check || {}; const cnt = { in: 0, late: 0, absent: 0 }; Object.values(ck).forEach(v => { if (cnt[v] != null) cnt[v]++; });
  const late = ruleAmt("late"), abs = ruleAmt("absent");
  const b = (u, v, l) => `<button class="chip sm ${ck[u] === v ? "on" : ""}" data-act="checkSet" data-eid="${esc(e.id)}" data-u="${esc(u)}" data-v="${v}">${l}</button>`;
  return `${top("현장 출석", "#/event/" + e.id)}<div class="body">
    <div class="card"><b>${esc(md(e.date) + " " + wd(e.date) + " " + (e.time || "") + " " + evName(e))}</b><div class="stat"><span><b>${cnt.in}</b><span>출석</span></span><span><b>${cnt.late}</b><span>지각</span></span><span><b>${cnt.absent}</b><span>결석</span></span></div><span class="hint">참석이라고 한 사람이 먼저 나와요. 온 사람은 출석, 늦게 온 사람은 지각, 안 온 사람은 결석으로 눌러요.</span></div>
    <div class="card"><div class="list">${list.map(x => `<div class="li" style="flex-wrap:wrap"><span style="flex:1;min-width:120px"><b>${esc(x.name)}</b><br><span class="hint">${x.s === "late" ? "늦참 신청" + (x.q ? ", " + x.q + "Q부터" : "") : a.yes.includes(x) ? "참석 신청" : a.no.includes(x) ? "불참" : a.wait.includes(x) ? "대기" : "미응답"}</span></span><span class="chips">${b(x.uid, "in", "출석")}${b(x.uid, "late", "지각")}${b(x.uid, "absent", "결석")}</span></div>`).join("")}</div></div>
    <div class="card"><b>팀 수칙대로 벌금</b><span class="hint">지각 ${won(late)}, 결석 ${won(abs)} (참석이나 늦참이라고 했는데 안 온 사람만)</span><button class="btn pri" data-act="finesApply" data-eid="${esc(e.id)}">벌금 매기기</button></div>
  </div>`;
}
function vRecords() {
  const year = todayStr().slice(0, 4);
  const evs = past().filter(e => e.date.startsWith(year));
  const games = evs.filter(e => e.type === "match" && e.score);
  const w = games.filter(e => +e.score.us > +e.score.them).length, d = games.filter(e => +e.score.us === +e.score.them).length, l = games.length - w - d;
  const attRank = people().map(x => ({ ...x, n: evs.filter(e => cameTo(e, x.uid)).length })).sort((a, b) => b.n - a.n).slice(0, 5);
  const momC = {}; evs.filter(momClosed).forEach(e => momWinners(e).forEach(u => { momC[u] = (momC[u] || 0) + 1; }));
  const mine = evs.filter(e => cameTo(e, S.uid)).length;
  return `<header class="top"><span style="width:8px"></span><h1>기록</h1></header><div class="body">
    <div class="card"><span class="hint">${year} 시즌</span><div class="stat"><span><b>${games.length}</b><span>경기</span></span><span><b style="font-size:19px;line-height:1.6">${w}승 ${d}무 ${l}패</b><span>전적</span></span><span><b>${mine}</b><span>내 출석</span></span></div></div>
    <b>지난 일정</b>
    ${evs.length ? evs.map(e => { const win = momWinners(e); return `<a class="card" href="#/game/${esc(e.id)}" style="text-decoration:none;color:inherit"><div class="row" style="gap:12px"><span class="datebox gray"><span>${wd(e.date)}</span><b>${Number(e.date.slice(8, 10))}</b></span><span style="flex:1;min-width:0"><span class="row" style="gap:6px"><span class="tag ${e.type === "match" ? "" : "blue"}">${e.type === "match" ? "경기" : e.type === "scrim" ? "내전" : "훈련"}</span><b>${e.score ? (e.type === "scrim" ? `A팀 ${e.score.us} : ${e.score.them} B팀` : `${e.score.us} : ${e.score.them}`) : isPlay(e) ? "결과 대기" : esc(e.place || "")}</b></span><br><span class="hint">${esc(evName(e))}${momOpen(e) ? ", MOM 투표 중" : win.length && momClosed(e) ? ", MOM " + win.map(nameOf).join(", ") : ""}${cameTo(e, S.uid) ? ", 나 출석" : ""}</span></span>${isAdmin() && isPlay(e) && !e.score ? `<span class="tag gray">입력</span>` : ""}</div></a>`; }).join("") : `<div class="card empty"><b>아직 지난 일정이 없어요</b></div>`}
    <div class="card"><b>출석 순위</b><div class="list">${attRank.map((x, i) => `<div class="li"><b style="width:20px">${i + 1}</b><span style="flex:1">${esc(x.name)}</span><span class="hint">${x.n} / ${evs.length}</span></div>`).join("")}</div></div>
    ${Object.keys(momC).length ? `<div class="card"><b>MOM</b><div class="list">${Object.entries(momC).sort((a, b) => b[1] - a[1]).map(([u, n]) => `<div class="li"><span style="flex:1">${esc(nameOf(u))}</span><b>${n}회</b></div>`).join("")}</div></div>` : ""}
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
  const e = S.events[id]; if (!e) return vRecords(); const f = S.form;
  const came = people().filter(x => cameTo(e, x.uid));
  return `${top("결과 입력", "#/game/" + e.id)}<div class="body">
    <div class="card"><b>${e.type === "scrim" ? "A팀 대 B팀" : "우리 대 " + esc(e.opponent || "상대")}</b>
      <div class="row" style="justify-content:center;gap:16px">${["us", "them"].map(k => `<span style="display:flex;flex-direction:column;align-items:center;gap:6px"><span class="hint">${k === "us" ? (e.type === "scrim" ? "A팀" : "우리") : (e.type === "scrim" ? "B팀" : "상대")}</span><span class="row"><button class="btn sm" data-act="score" data-k="${k}" data-d="-1" aria-label="줄이기">−</button><b style="font-size:32px;min-width:40px;text-align:center">${Number(f[k]) || 0}</b><button class="btn sm" data-act="score" data-k="${k}" data-d="1" aria-label="늘리기">+</button></span></span>`).join("")}</div></div>
    <div class="card"><b>골 넣은 사람</b><span class="hint">누를 때마다 한 골씩 더해요. 골 칩을 누르면 빠져요.</span><div class="chips">${came.map(x => `<button class="chip sm" data-act="goalAdd" data-u="${esc(x.uid)}">${esc(x.name)}</button>`).join("")}</div>
      <div class="chips">${(f.goals || []).map((g, i) => `<button class="chip sm on" data-act="goalDel" data-i="${i}">${esc(nameOf(g.uid))} ✕</button>`).join("")}</div></div>
    <span class="hint">결과를 저장하면 출석한 팀원이 다음 날 12시까지 MOM 투표를 할 수 있어요.</span>
  </div><div class="cta"><button class="btn pri block" data-act="saveResult" data-eid="${esc(e.id)}">저장</button></div>`;
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
  const e = S.events[id]; if (!e) return vSchedule();
  const a = att(e); const ps = [...a.yes, ...a.late, ...a.wait]; const T = e.teams || {};
  const nA = ps.filter(p => (T[p.uid] || "") === "A").length, nB = ps.filter(p => (T[p.uid] || "") === "B").length;
  return `${top("내전 스쿼드", "#/event/" + e.id, `<button class="btn sm" data-act="squadAuto" data-eid="${esc(e.id)}">자동으로 나누기</button>`)}<div class="body">
    <div class="card"><div class="stat"><span><b>${ps.length}</b><span>전체</span></span><span><b>${nA}</b><span>A팀 조끼</span></span><span><b>${nB}</b><span>B팀</span></span></div></div>
    <div class="card"><div class="list">${ps.map(p => `<div class="li"><span style="flex:1"><b>${esc(p.name)}</b><br><span class="hint">${esc([p.p.pos1, p.p.pos2].filter(Boolean).join(", "))}</span></span><button class="chip sm ${T[p.uid] === "A" ? "on" : ""}" data-act="squadSet" data-eid="${esc(e.id)}" data-u="${esc(p.uid)}" data-v="A">A 조끼</button><button class="chip sm ${T[p.uid] === "B" ? "on" : ""}" data-act="squadSet" data-eid="${esc(e.id)}" data-u="${esc(p.uid)}" data-v="B">B 일반</button></div>`).join("")}</div></div>
  </div>`;
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

export { playerSheet, remindLeft, remindSheet, rosterSheet, vCheck, vDues, vDuesSettings, vEvent, vEventForm, vGame, vHomeAdmin, vLedger, vNoticeNew, vPlayers, vPosReq, vRecords, vResult, vRosterImport, vSchedule, vSquad };
