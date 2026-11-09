
/* ---------- routing ---------- */
function route() {
  if (Store.mode === "loading" || Store.mode === "nodata") return;
  render();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
function currentView() { const h = decodeURIComponent(location.hash.slice(1)) || "home"; return h; }
const isOpView = () => Store.canWrite && !Store.preview;
const WDE = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
function bigDate(e, noTime) { const d = parseD(e.date); return `${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${WDE[d.getDay()]}${!noTime && e.time ? " " + e.time : ""}`; }
const shortDate = e => { const d = parseD(e.date); return `${pad(d.getMonth() + 1)}.${pad(d.getDate())}`; };
function evSub(e, noCheck) { return [evTitle(e), e.place, !noCheck && checkTime(e) ? `출석 체크 ${checkTime(e)}` : ""].filter(Boolean).map(esc).join(", "); }
const qText = r => r.st === "on" ? r.lab : r.st === "late" ? "합류 전" : "휴식";
const ICON = {
  back: `<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`,
  chev: `<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="color:var(--muted);flex:none"><path d="m9 6 6 6-6 6"/></svg>`,
  bell: `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 20a1.9 1.9 0 0 0 3.4 0"/></svg>`,
  gear: `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`
};
function backbar(href, sub, title, right) {
  return `<div class="backbar"><a class="back" href="${href}" aria-label="뒤로">${ICON.back}</a><div class="t">${sub ? `<div class="sub">${sub}</div>` : ""}${title ? `<h1 class="title">${title}</h1>` : ""}</div>${right || ""}</div>`;
}
function tabOf(v) {
  if (v === "home" || v === "todo" || v === "config" || v === "notice" || v === "inbox" || v === "mypos" || v === "claim" || v.startsWith("mom-")) return "home";
  if (v === "schedule" || /^(event|lineup|split)-/.test(v)) return "schedule";
  if (v === "players" || v.startsWith("player-")) return "players";
  return v;
}
function renderChrome() {
  const name = String(S.settings.teamName || "").trim() || "팀 매니저";
  const pid = myPid(); const unread = pid ? unreadCount() : 0;
  const top = $("#top");
  top.innerHTML = `<a class="teamname" href="#home">${esc(name)}</a>${isOpView() ? `<span class="chip soft rolechip">${Store.role === "owner" && window.__WEB ? "팀장" : "운영진"}</span>` : Store.preview ? `<span class="chip line rolechip">팀원 화면</span>` : ""}
    <span class="sync" id="sync"><i></i><span>연결 중</span></span>
    ${pid ? `<a class="iconbtn" href="#inbox" aria-label="알림함${unread ? `, 새 알림 ${unread}개` : ""}">${ICON.bell}${unread ? `<span class="badge">${unread > 9 ? "9+" : unread}</span>` : ""}</a>` : ""}
    <a class="iconbtn" href="#config" aria-label="설정">${ICON.gear}</a>`;
  const nav = $("#tabs"); const v = tabOf(currentView());
  if (Store.mode === "nodata") { nav.hidden = true; return; }
  let items;
  if (isOpView()) items = [["home", "홈"], ["schedule", "일정"], null, ["money", "회비"], ["players", "선수"]];
  else if (Store.canVote || Store.preview || Store.mode === "local") items = [["home", "홈"], ["schedule", "일정"], null, ["money", "내 회비"], ["stats", "내 기록"]];
  else items = [["home", "홈"], ["schedule", "일정"]];
  nav.classList.toggle("n2", items.length === 2);
  nav.firstElementChild.innerHTML = items.map(it => it ? `<a href="#${it[0]}" data-tab="${it[0]}"${it[0] === v ? ' aria-current="page"' : ""}>${it[1]}</a>` : `<button class="vote" data-act="voteSheet" aria-label="참석 투표">투표</button>`).join("");
  nav.hidden = false;
  setSync();
}

function render() {
  renderPending = false;
  const v = currentView();
  ui.promo = Store.mode === "loading" ? "" : promoBanner();
  const opOnly = v === "players" || v.startsWith("player-") || v === "todo";
  if (opOnly && !isOpView()) { location.replace("#home"); return; }
  let html = "";
  const ev = id => S.events[id];
  const missing = `<div class="card"><div class="empty"><b>일정을 찾을 수 없습니다</b>삭제되었을 수 있어요.</div><a class="btn block" href="#schedule">일정 목록으로</a></div>`;
  if (v === "home") html = isOpView() ? viewOpHome() : viewMemberHome();
  else if (v === "schedule") html = isOpView() ? viewOpSched() : viewMemberSched();
  else if (v.startsWith("event-")) { const e = ev(v.slice(6)); html = e ? (isOpView() ? viewOpEvent(e) : viewMemberEvent(e)) : missing; }
  else if (v.startsWith("lineup-")) { const e = ev(v.slice(7)); html = e ? viewMemberLineup(e) : missing; }
  else if (v.startsWith("split-")) { const e = ev(v.slice(6)); html = e ? viewSplit(e) : missing; }
  else if (v.startsWith("mom-")) { const e = ev(v.slice(4)); html = e ? viewMom(e) : missing; }
  else if (v === "players") html = viewPlayers();
  else if (v.startsWith("player-")) html = viewPlayerEdit(v.slice(7));
  else if (v === "money") html = Store.canMoney ? viewOpMoney() : viewMyMoney();
  else if (v === "stats") html = viewReport();
  else if (v === "config") html = viewConfig();
  else if (v === "claim") html = viewClaim();
  else if (v === "mypos") html = viewMyPos();
  else if (v === "notice") html = viewNotice();
  else if (v === "inbox") html = viewInbox();
  else if (v === "todo") html = viewTodo();
  else html = isOpView() ? viewOpHome() : viewMemberHome();
  if (Store.mode === "local" && !window.__DEMO) html = `<div class="note">이 화면에서는 데이터가 이 기기의 브라우저에만 저장됩니다. 설정에서 백업 파일을 만들어 두세요.</div>` + html;
  if (window.__DEMO) html = `<div class="preview"><b>팀원 화면 미리보기</b>예요. 예시 데이터라 눌러 봐도 실제 팀에는 저장되지 않아요.</div>` + html;
  if (S.settings.sample && !window.__DEMO) html = `<div class="note">지금 보이는 선수와 기록은 예시입니다. <button class="linkbtn o" data-act="clearSample">예시 모두 지우기</button></div>` + html;
  if (Store.mode === "db" && Store.role === "viewer") html = `<div class="note soft"><b>아직 팀원 권한을 받지 않았어요.</b> 지금은 일정과 기록을 볼 수만 있어요. 참석 투표를 하려면 운영진에게 '사용 가능' 권한을 요청해 주세요.</div>` + html;
  if (Store.preview) html = `<div class="preview"><div><b>${Store.preview === "member" ? (Store.previewPid ? esc(pname(Store.previewPid)) + " 선수의 화면" : "팀원 화면") : "권한 받기 전 화면"}</b>을 미리 보는 중이에요. 눌러 봐도 저장되지 않아요.</div><div class="btnrow" style="margin-top:8px">${Store.preview === "member" ? `<button class="btn" data-act="previewPick">다른 선수로 보기</button>` : ""}<button class="btn primary" data-act="previewOff">미리보기 끝내기</button></div></div>` + html;
  $("#main").innerHTML = html;
  renderChrome();
  if (typeof afterRender === "function") afterRender(v);
  fillNames();
}

/* ---------- 공통 블록 ---------- */
function voteGroup(e, st, act) {
  return `<div class="sqgroup" role="group" aria-label="참석 투표">${Object.keys(ATT).map(k => `<button data-act="${act || "myVote"}" data-eid="${e.id}" data-v="${k}" aria-pressed="${!!st && st.s === k}">${ATT[k]}</button>`).join("")}</div>`;
}
function myLatePicker(e, st) {
  if (!st || st.s !== "late") return "";
  const n = quartersOf(e);
  return `<div class="card" style="gap:8px;border-radius:16px;padding:12px 14px"><div style="font-weight:700">몇 쿼터부터 올 수 있어요?</div>
    <div class="sqgroup q" role="radiogroup" aria-label="합류 쿼터">${Array.from({ length: n }, (_, k) => k + 1).map(k => `<button role="radio" data-act="myLateQ" data-eid="${e.id}" data-q="${k}" aria-checked="${st.q === k}" aria-label="${k}쿼터부터 참석">${k}Q</button>`).join("")}</div>
    <div class="small muted" role="status">${st.q ? `${st.q}쿼터부터 라인업에 들어가요. 늦참으로 미리 바꾸면 지각 벌금이 없어요.` : "고른 쿼터부터 라인업에 들어가요. 늦참으로 미리 바꾸면 지각 벌금이 없어요."}</div></div>`;
}
function myStatusLine(e, st) {
  if (!st) return "";
  if (!st.s) return `<div class="status quiet">아직 응답하지 않았어요. 위에서 골라 주세요.</div>`;
  if (st.s === "no") return `<div class="status" role="status">불참으로 응답했어요.${Number(S.settings.lateCancelH) ? ` 경기 ${S.settings.lateCancelH}시간 이내에 참석에서 불참으로 바꾸면 직전 취소로 기록돼요.` : ""}</div>`;
  if (st.wait) return `<div class="status" role="status">지금은 대기 ${st.wait}번이에요. 확정 인원이 빠지면 자동으로 올라가요.</div>`;
  return "";
}
function statusChip(st) {
  if (!st || !st.s) return `<span class="chip line">미응답</span>`;
  if (st.s === "no") return `<span class="chip">불참</span>`;
  if (st.wait) return `<span class="chip soft">대기 ${st.wait}번</span>`;
  return `<span class="chip clay">${st.s === "late" ? "늦참 확정" : "참석 확정"}</span>`;
}
function planTiles(e, pid) {
  const P = myPlan(e, pid); if (!P || !P.any || (!P.conf && !P.on)) return "";
  return `<div class="qtiles" style="--n:${Math.min(P.N, 4)}">${P.rows.map(r => `<div class="qt ${r.st === "on" ? "" : r.st}"><span class="q">${r.k + 1}Q</span><b>${esc(qText(r))}</b></div>`).join("")}</div>`;
}
function promoBanner() {
  const pid = myPid(); if (!pid) return "";
  const seen = prefs().seen || {}; let html = ""; const next = {}; let changed = false;
  eventsSorted().filter(e => !started(e)).forEach(e => {
    const st = myState(e); if (!st) return;
    const now = st.confirmed ? "in" : st.wait ? "wait" : "";
    const before = seen[e.id] || "";
    if (before === "wait" && now === "in" && !html) html = `<div class="promo" role="status"><div class="grow"><b>대기에서 참석 확정됐어요</b><div class="small">${esc(fmtDate(e.date))} ${esc(evTitle(e))}, 앞사람이 빠져서 자동으로 올라왔어요.</div></div><button class="btn" data-act="closePromo" data-eid="${e.id}">확인</button></div>`;
    next[e.id] = before === "wait" && now === "in" ? "wait" : now;
    if (next[e.id] !== before) changed = true;
  });
  if (changed) setPref("seen", next);
  return html;
}
function teamLabel(e, pid) { if (!isScrim(e) || !e.teamsAt) return ""; const T = teamsOf(e).t; return T[pid] === "A" ? "조끼팀" : T[pid] === "B" ? "일반팀" : ""; }
function claimPrompt() {
  const req = myReq();
  if (req) return `<div class="card"><div class="labrow"><span class="lab">등록 요청을 보냈어요</span><span class="chip soft">확인 대기</span></div><div class="small">${esc(req.reqName)} 이름으로 요청했어요. 운영진이 확인하면 바로 투표할 수 있어요.</div><a class="btn block" href="#claim">명단에서 다시 찾기</a></div>`;
  return `<div class="card hot"><span class="lab">처음이네요</span><div class="hl">명단에서 나를 골라 주세요</div><div class="small muted">처음 한 번만 고르면 다음부터는 버튼 한 번으로 참석 투표를 할 수 있어요.</div><a class="btn primary big" href="#claim">나 찾기</a></div>`;
}

/* ---------- 팀원 홈 ---------- */
function viewMemberHome() {
  if (!S.players.length) return `<div class="card"><div class="empty"><b>아직 팀 명단이 없어요</b>운영진이 선수를 등록하면 여기서 참석 투표를 할 수 있어요.</div></div>`;
  const parts = []; const pid = myPid();
  parts.push(ui.promo || "");
  if (Store.canVote && !pid && Store.mode !== "local" && !Store.preview) parts.push(claimPrompt());
  const n0 = S.notices.find(n => n.pinned) || S.notices[0];
  if (n0) parts.push(`<a class="card" href="#notice" style="flex-direction:row;align-items:center;gap:10px;border-radius:16px;padding:10px 12px;min-height:48px"><span class="chip ink">${n0.poll && pollOpen(n0) ? "설문" : "공지"}</span><span class="grow ell" style="font-weight:600;font-size:14px">${esc(n0.title)}</span>${ICON.chev}</a>`);
  if (pid) {
    const me = eventsSorted().filter(e => momOpen(e) && cameTo(e, pid)).pop();
    if (me) { const voted = (myUvote().mom || {})[me.id]; const t = momTally(me);
      parts.push(voted ? `<a class="card" href="#mom-${me.id}" style="flex-direction:row;align-items:center"><span class="grow"><span class="lab">${esc(shortDate(me))} MOM</span><div class="small">${esc(pname(voted))} 선수에게 투표했어요. 결과 보기</div></div>${ICON.chev}</a>`
        : `<section class="card hot"><div class="labrow"><span class="lab">${esc(evTitle(me))}, 오늘의 MOM은?</span><span class="chip soft">익명 투표</span></div><div class="hl">${attendees(me).length}명 중 ${t.n}명이 투표했어요</div><a class="btn primary block" href="#mom-${me.id}">투표하러 가기</a></section>`); }
  }
  const upcoming = eventsSorted().filter(e => !started(e)); const next = upcoming[0];
  if (next) {
    const st = myState(next); const c = attCounts(next); const team = pid ? teamLabel(next, pid) : "";
    const orderTxt = st && st.s && st.s !== "no" && !st.wait ? `${c.capAll === Infinity ? "" : c.capAll + "명 중 "}${st.order}번째${team ? ", " + team : ""}` : `${c.all}${c.capAll === Infinity ? "" : " / " + c.capAll}명 확정${c.wait ? `, 대기 ${c.wait}` : ""}`;
    parts.push(`<section class="rule" aria-label="다음 일정">
      <a href="#event-${next.id}" style="text-decoration:none;color:inherit;display:flex;flex-direction:column;gap:6px"><span class="lab">다음 일정</span><span class="date-xl">${esc(bigDate(next))}</span><span class="small muted">${evSub(next)}</span></a>
      ${st ? `<div class="row" style="flex-wrap:wrap">${statusChip(st)}<span class="small muted">${esc(orderTxt)}</span></div>` : `<div class="small muted">${esc(orderTxt)}</div>`}
      ${st ? voteGroup(next, st) : ""}${st ? myLatePicker(next, st) : ""}${st ? myStatusLine(next, st) : ""}
      ${pid ? `<a href="#lineup-${next.id}" style="text-decoration:none;color:inherit">${planTiles(next, pid)}</a>` : ""}
    </section>`);
    const pend = pid ? upcoming.slice(1).filter(e => { const s2 = myState(e); return s2 && !s2.s; }) : [];
    if (pend.length) parts.push(`<section class="card flat"><div class="lh"><span class="lab">아직 응답 안 한 일정</span></div><div class="list">${pend.slice(0, 4).map(e => `<a class="li" href="#event-${e.id}"><span class="num" style="font-size:22px;width:56px">${esc(shortDate(e))}</span><span class="grow ell"><b>${esc(evTitle(e))}</b> <span class="small muted">${esc(e.time || "")}</span></span><span class="mark">미응답</span></a>`).join("")}</div></section>`);
  } else parts.push(`<div class="card"><span class="lab">다음 일정</span><div class="small muted">예정된 일정이 없어요.</div></div>`);
  if (pid) {
    const M = myMoney(pid); const due = M.items.filter(i => i.req !== "ok"); const sum = due.reduce((s, i) => s + i.amount, 0);
    if (due.length) parts.push(`<a class="card" href="#money" style="flex-direction:row;align-items:center"><span class="grow"><span class="lab">내 회비</span><div><span class="num" style="font-size:24px">${sum.toLocaleString("ko-KR")}</span>원 ${due.some(i => i.req === "req") ? "확인 기다리는 중" : "남았어요"}</div></span>${ICON.chev}</a>`);
    const mine = playerById(pid); const pr = myPosReq();
    if (mine && !isOpView()) parts.push(`<a class="card" href="#mypos" style="flex-direction:row;align-items:center"><span class="grow"><span class="lab">내 포지션</span><div style="font-weight:700">${esc(posLabel(mine)) || "아직 없음"}</div></span>${pr && pr.status === "req" ? `<span class="chip soft">변경 요청 중</span>` : ""}${ICON.chev}</a>`);
    const y = String(new Date().getFullYear()); const R0 = reportData(pid, y + "-01-01", y + "-12-31");
    parts.push(`<a class="card" href="#stats"><div class="labrow"><span class="lab">내 시즌</span><span class="linkbtn">자세히</span></div><div class="tiles3"><div class="tile in"><div class="big">${R0.played ? Math.round(R0.came / R0.played * 100) : 0}%</div><div class="k">출석률</div></div><div class="tile in"><div class="big">${R0.streak}</div><div class="k">연속 출석</div></div><div class="tile in"><div class="big">${R0.mom}</div><div class="k">MOM</div></div></div></a>`);
  }
  return parts.join("");
}

/* ---------- 팀원 일정 ---------- */
function viewMemberSched() {
  const today = todayStr(); const all = eventsSorted();
  const up = all.filter(e => !started(e)); const past = all.filter(e => started(e)).reverse().slice(0, 12);
  const mark = e => { const st = myState(e); if (!st) return ""; if (!st.s) return `<span class="mark">미응답</span>`; if (st.s === "no") return `<span class="mark">불참</span>`; if (st.wait) return `<span class="mark">대기 ${st.wait}</span>`; return `<span class="mark on">${ATT[st.s]}</span>`; };
  return `<div class="titlebar"><h1 class="title">일정</h1></div>
  <section><div class="lab" style="border-top:2px solid var(--ink);padding:12px 4px 6px">다가오는 일정</div>
  ${up.length ? up.map(e => { const c = attCounts(e); return `<a class="sline" href="#event-${e.id}"><span class="d">${esc(shortDate(e))}</span><span class="grow"><b>${esc(evTitle(e))} ${esc(e.time || "")}</b><br><span class="small muted">${esc(e.place || FORMAT_KO[e.format] || "")}, ${c.all}${c.capAll === Infinity ? "명" : "/" + c.capAll}</span></span>${mark(e)}</a>`; }).join("") : `<div class="empty">다가오는 일정이 없어요. 운영진이 일정을 올리면 여기에 보여요.</div>`}</section>
  ${past.length ? `<section><div class="lab" style="border-top:2px solid var(--ink);padding:12px 4px 6px;margin-top:8px">지난 일정</div>${past.map(e => `<a class="sline past" href="#event-${e.id}"><span class="d">${esc(shortDate(e))}</span><span class="grow">${esc(evTitle(e))}</span>${hasScore(e) ? `<b class="num" style="font-size:22px">${e.score.us}:${e.score.them}</b>` : ""}</a>`).join("")}</section>` : ""}`;
}

/* ---------- 팀원 일정 상세 ---------- */
function viewMemberEvent(e) {
  if (ui.evFor !== e.id) { ui.evFor = e.id; ui.evTab = started(e) ? (isPlay(e) ? "rec" : "check") : "att"; ui.evQ = 0; }
  const pid = myPid(); const st = myState(e); const locked = started(e);
  let top = "";
  if (st && !locked) top = voteGroup(e, st) + myLatePicker(e, st) + myStatusLine(e, st);
  else if (st && locked) top = `<div class="status quiet">경기가 시작돼서 투표가 닫혔어요.${st.s ? ` 내 응답: ${ATT[st.s]}` : ""}</div>`;
  else if (Store.canVote && !pid && !Store.preview) top = claimPrompt();
  const tabs = [["att", "참석"], ["lineup", "라인업"], ["check", "출석"], ["rec", "기록"]];
  if (!tabs.some(t => t[0] === ui.evTab)) ui.evTab = "att";
  const body = ui.evTab === "att" ? mAtt(e) : ui.evTab === "lineup" ? mLineup(e) : ui.evTab === "check" ? mCheck(e) : mRec(e);
  return `${backbar("#schedule", "", "")}
  <section class="stack" style="gap:6px;padding:0 4px"><h1 class="date-xl">${esc(bigDate(e))}</h1><div class="small muted">${evSub(e)}</div></section>
  ${top}
  <div class="utabs" role="tablist" aria-label="보기">${tabs.map(([k, l]) => `<button role="tab" data-act="evTab" data-v="${k}" aria-selected="${ui.evTab === k}">${l}</button>`).join("")}</div>
  ${body}`;
}
function mAtt(e) {
  const r = roster(e); const c = attCounts(e); const pid = myPid(); const gs = guestsOf(e);
  const nm = p => { const q = lateQ(e, p.id); const t = `${esc(p.num || "")} ${esc(p.name)}${q ? ` (${q}Q~)` : effAtt(e).s[p.id] === "late" ? " (늦참)" : ""}`; return p.id === pid ? `<b class="me">${t}</b>` : t; };
  const my = pid ? myGuestReqs(e.id) : [];
  return `<div class="stack" style="gap:0">
    <div class="row between" style="font-weight:700;padding:0 0 6px"><span>참석 확정</span><span class="num" style="font-size:20px">${c.all}${c.capAll === Infinity ? "" : "/" + c.capAll}</span></div>
    ${r.confirmed.length || gs.length ? `<div class="names2">${r.confirmed.map(p => `<span>${nm(p)}</span>`).join("")}${gs.map(g => `<span class="muted">게스트 ${esc(g.name)}</span>`).join("")}</div>` : `<div class="empty">아직 참석한 사람이 없어요.</div>`}
    ${r.wait.length ? `<div class="small muted" style="padding-top:8px">대기 ${r.wait.map((p, i) => `${i + 1}: ${esc(p.num || "")} ${esc(p.name)}`).join(", ")}</div>` : ""}
    ${gs.length ? `<div class="hint" style="padding-top:6px">게스트는 정원에 포함돼요. ${gs.map(g => `${esc(g.name)}${g.pid ? `(${esc(pname(g.pid))} 초대)` : ""}`).join(", ")}</div>` : ""}
  </div>
  ${pid && !started(e) ? `<section class="card"><div class="labrow"><span class="lab">친구 데려오기</span><span class="hint">게스트비 ${won(S.settings.guestFee || 0)}</span></div>
    ${my.length ? my.map(g => `<div class="row between small"><span><b>${esc(g.name)}</b> ${esc(g.pos || "")}</span><span class="chip ${g.status === "ok" ? "clay" : g.status === "no" ? "" : "soft"}">${g.status === "ok" ? "승인" : g.status === "no" ? "거절" : "승인 대기"}</span></div>`).join("") : `<div class="small muted">같이 뛸 친구가 있으면 요청하세요. 운영진이 승인하면 확정되고, 게스트비는 데려온 사람에게 붙어요.</div>`}
    <button class="btn block" data-act="guestOpen" data-eid="${e.id}">게스트 요청하기</button></section>` : ""}`;
}
function mLineup(e) {
  const pid = myPid(); const L = lineupOf(e); const any = L.q.some(qs => qs.some(Boolean));
  const teams = isScrim(e) && e.teamsAt ? teamsOf(e).t : null;
  const sideTabs = isScrim(e) ? sideSeg(e, L.side) : "";
  const teamBlock = teams ? `<section class="card"><div class="labrow"><span class="lab">오늘의 팀</span>${pid && teams[pid] ? `<span class="chip ${teams[pid] === "A" ? "clay" : "ink"}">나는 ${teams[pid] === "A" ? "조끼팀" : "일반팀"}</span>` : ""}</div>
    <div class="small"><b style="color:var(--clay)">조끼팀</b> ${squadBase(e).filter(p => teams[p.id] === "A").map(p => esc(p.name)).join(", ")}</div><div class="small"><b>일반팀</b> ${squadBase(e).filter(p => teams[p.id] === "B").map(p => esc(p.name)).join(", ")}</div></section>` : "";
  if (!any) return teamBlock + sideTabs + `<div class="empty"><b>아직 라인업 전이에요</b>운영진이 라인업을 짜면 몇 쿼터에 어느 자리로 뛰고 언제 쉬는지 여기에 보여요.</div>`;
  const k = Math.min(ui.evQ || 0, L.N - 1); const P = pid ? myPlan(e, pid) : null;
  return `${teamBlock}<div class="stack">
    ${P && (P.conf || P.on) ? `<span class="lab">내 출전</span><div class="qbox" style="--n:${Math.min(L.N, 4)}">${P.rows.slice(0, 8).map(r => `<div class="${r.st === "on" ? "on" : ""}"><div class="q">${r.k + 1}Q</div><b>${esc(qText(r))}</b></div>`).join("")}</div>` : ""}
    ${sideTabs}<div class="labrow"><span class="lab">쿼터별 라인업 (${esc(formName(L.formation))})</span><span class="hint">운영진이 짠 배치</span></div>
    <div class="utabs" role="tablist" aria-label="쿼터">${L.q.map((_, j) => `<button role="tab" data-act="evQ" data-v="${j}" aria-selected="${j === k}">${j + 1}Q</button>`).join("")}</div>
    ${pitchHtml(e, L, k, { small: true, me: pid })}
    <div class="small"><span class="muted" style="font-weight:700">벤치</span> ${benchOf(e, L, k).map(x => esc(x.name) + (x.late ? ` (${x.from}Q 합류)` : "")).join(", ") || "없음"}</div>
    <div class="hint">라인업이 바뀌면 알림함에 떠요. 바꾸고 싶으면 운영진에게 말해 주세요.</div>
    <a class="btn block" href="#lineup-${e.id}" style="border:2px solid var(--ink);border-radius:0">누가 언제 쉬는지 전체 보기</a>
  </div>`;
}
// 내전 팀 고르기 탭 (조끼팀 / 일반팀)
function sideSeg(e, side) {
  const n = s => sidePool(e, s).length;
  return `<div class="seg" role="group" aria-label="팀">${[["A", "조끼팀"], ["B", "일반팀"]].map(([s, l]) => `<button data-act="lineSide" data-eid="${e.id}" data-v="${s}" aria-pressed="${s === side}">${l} ${n(s)}명</button>`).join("")}</div>`;
}
function benchOf(e, L, k) {
  const used = new Set(L.q[k].filter(Boolean));
  return (L.side ? sidePool(e, L.side) : roster(e).confirmed).filter(p => !used.has(p.id)).map(p => ({ ...p, from: availFrom(e, p.id), late: availFrom(e, p.id) > k + 1 }));
}
function pitchHtml(e, L, k, o) {
  const slots = L.q[k];
  return `<div class="pitch ${o.small ? "sm" : ""}"><i class="ln box"></i><i class="ln mid"></i><i class="ln circle"></i><i class="ln pb"></i>${o.small ? "" : `<i class="ln pt"></i>`}
    ${L.spots.map(([grp, x, y, lab], i) => { const p = slots[i] ? playerById(slots[i]) : null; const me = p && o.me && p.id === o.me; const sel = o.sel === i;
      const cls = `slot ${p ? "" : "empty"} ${grp === "GK" ? "gk" : ""} ${me ? "me" : ""} ${sel ? "sel" : ""}`;
      const inner = `<span class="l">${esc(lab)}</span><span class="n">${p ? (me && !o.edit ? "나" : esc(p.name)) : "비어 있음"}</span>`;
      return o.edit ? `<button class="${cls}" style="left:${x}%;top:${y}%" data-act="slotTap" data-i="${i}" aria-pressed="${sel}" aria-label="${k + 1}쿼터 ${esc(lab)} 자리, ${p ? esc(p.name) : "비어 있음"}">${inner}</button>` : `<div class="${cls}" style="left:${x}%;top:${y}%">${inner}</div>`;
    }).join("")}</div>`;
}
function playTable(e, L, k, mePid) {
  const conf = L.side ? sidePool(e, L.side) : roster(e).confirmed; if (!conf.length) return `<div class="hint">${L.side ? "이 팀에 고른 사람이 아직 없어요." : "참석이 확정된 사람이 생기면 여기에 표시돼요."}</div>`;
  return `<div class="ptable" style="--n:${L.N}">${conf.map(p => { let tot = 0; const cells = L.q.map((qs, j) => { const on = qs.includes(p.id); if (on) tot++; const late = availFrom(e, p.id) > j + 1; return `<span class="cell ${on ? "on" : late ? "late" : ""} ${j === k ? "cur" : ""}" title="${j + 1}쿼터 ${on ? "출전" : late ? "합류 전" : "휴식"}"></span>`; }).join("");
    return `<div class="prow"><span class="nm ${p.id === mePid ? "me" : ""}">${esc(p.name)}${p.id === mePid ? " (나)" : ""}</span>${cells}<span class="tot">${tot}쿼터</span></div>`; }).join("")}</div>`;
}
function legendHtml(rest) { return `<span class="legend"><span><i style="background:var(--clay)"></i>출전</span><span><i style="background:var(--surface2)"></i>${rest || "휴식"}</span><span><i style="background:var(--clay-s);border:1px dashed var(--tan)"></i>합류 전</span></span>`; }
function mCheck(e) {
  const pid = myPid(); const t = checkTime(e); const saved = checkStarted(e); const A = effAtt(e);
  let mine = "";
  if (pid) { const conf = roster(e).ids.has(pid);
    if (saved && (e.check || {})[pid]) mine = `내 결과: <b>${CHECK[(e.check || {})[pid]]}</b>`;
    else if (!conf) mine = A.s[pid] === "no" ? "불참으로 응답해서 출석 체크 대상이 아니에요." : "참석 확정 명단에 없어서 출석 체크 대상이 아니에요.";
    else if (A.s[pid] === "late") mine = `늦참 신청${lateQ(e, pid) ? `, ${lateQ(e, pid)}쿼터부터` : ""}. 늦게 와도 지각으로 치지 않아요.`;
    else mine = `참석 확정. ${t ? t + "까지" : "모임 시간까지"} 도착하면 출석이에요. 운영진이 현장에서 없는 사람만 체크해요.`; }
  const cnt = checkCounts(e);
  const pastMine = pid ? eventsSorted().filter(x => started(x) && x.id !== e.id && checkStarted(x) && (x.check || {})[pid]).reverse().slice(0, 4) : [];
  const unpaid = pid ? myFines(pid).filter(f => !f.paid) : [];
  return `<section class="rule"><div class="labrow"><span class="lab">이번 경기 출석 체크</span><span class="chip">${saved ? "체크 완료" : "아직 체크 전"}</span></div>
    <div class="date-l" style="color:var(--clay)">${esc(t || "현장 확인")}</div><div style="font-size:14px">${mine || (saved ? `출석 ${cnt.in + cnt.excused}명, 지각 ${cnt.late}명, 결석 ${cnt.absent}명` : "아직 출석 체크 전이에요.")}</div></section>
  ${S.settings.finePresets.length ? `<section><span class="lab">벌금 기준</span>${S.settings.finePresets.map(p => `<div class="plain"><span class="grow">${esc(p.label)}</span><span class="num" style="font-size:17px">${(Number(p.amount) || 0).toLocaleString("ko-KR")}</span></div>`).join("")}<div class="hint" style="padding-top:4px">늦참으로 미리 바꾼 사람은 지각으로 치지 않아요.</div></section>` : ""}
  ${pastMine.length ? `<section><span class="lab">내 지난 출석</span>${pastMine.map(x => { const v = x.check[pid]; return `<div class="plain"><span class="num" style="font-size:16px;width:70px">${esc(shortDate(x))} ${WDE[parseD(x.date).getDay()]}</span><span class="grow">${esc(evTitle(x))}</span><span class="${v === "late" || v === "absent" ? "chip clay" : "small"}" style="font-weight:700">${CHECK[v]}</span></div>`; }).join("")}${unpaid.length ? `<a class="linkbtn" href="#money">미납 벌금 ${won(unpaid.reduce((s, f) => s + (Number(f.amount) || 0), 0))} 내러 가기</a>` : ""}</section>` : ""}`;
}
function mRec(e) {
  const pid = myPid();
  if (!isPlay(e)) return e.memo ? `<section class="card"><span class="lab">메모</span><div class="small" style="white-space:pre-wrap">${esc(e.memo)}</div></section>` : `<div class="empty">훈련 메모가 없어요.</div>`;
  if (!hasScore(e)) return `<div class="note">경기가 끝나면 점수와 골, 도움이 여기에 올라와요.</div>${momOpen(e) && pid && cameTo(e, pid) ? `<a class="btn primary big" href="#mom-${e.id}">이 경기 MOM 투표하러 가기</a>` : ""}`;
  const r = resultOf(e); const goals = e.goals || []; const scrim = isScrim(e);
  const T = scrim && e.teamsAt ? teamsOf(e).t : null; const myTeam = T && pid ? T[pid] : "";
  const L = lineFor(e, pid); const myQ = pid ? L.q.filter(qs => qs.includes(pid)).length : 0;
  const lUs = scrim ? (myTeam === "B" ? "일반팀" : "조끼팀") + (myTeam ? " (나)" : "") : esc(S.settings.teamName || "우리 팀");
  const lThem = scrim ? (myTeam === "B" ? "조끼팀" : "일반팀") : esc(e.opponent || "상대 팀");
  return `<section class="rule"><div class="labrow"><span class="lab">${esc(shortDate(e))} ${WDE[parseD(e.date).getDay()]} ${esc(evTitle(e))}</span><span class="chip ${r === "W" ? "clay" : r === "L" ? "ink" : ""}">${{ W: "승", D: "무", L: "패" }[r]}</span></div>
    <div class="scoreboard"><div><div class="small" style="font-weight:700">${lUs}</div><div class="big" style="font-size:56px;color:var(--clay)">${e.score.us}</div></div><div class="big muted" style="font-size:30px">:</div><div><div class="small" style="font-weight:700">${lThem}</div><div class="big" style="font-size:56px">${e.score.them}</div></div></div></section>
  <section><span class="lab">득점</span>${goals.length ? goals.map(g => `<div class="plain"><span style="font-weight:700;font-size:13px;width:26px">${g.q ? esc(g.q) + "Q" : ""}</span><span class="grow" style="font-weight:700">${g.pid === pid ? `<span class="chip clay" style="font-size:14px">${esc(pname(g.pid))}</span>` : esc(pname(g.pid))}</span><span class="small muted">${g.assist ? "도움 " + esc(pname(g.assist)) : "도움 없음"}</span></div>`).join("") : `<div class="hint">득점 기록이 없어요.</div>`}</section>
  ${pid ? `<div class="tiles3"><div class="tile"><div class="big">${goals.filter(g => g.pid === pid).length}</div><div class="k">내 골</div></div><div class="tile"><div class="big">${goals.filter(g => g.assist === pid).length}</div><div class="k">내 도움</div></div><div class="tile"><div class="big">${L.q.some(qs => qs.some(Boolean)) ? `${myQ}<span style="font-family:var(--f-body);font-size:13px">쿼터</span>` : "-"}</div><div class="k">출전</div></div></div>` : ""}
  ${momOpen(e) && pid && cameTo(e, pid) ? `<a class="btn primary big" href="#mom-${e.id}">이 경기 MOM 투표하러 가기</a>` : (S.tally["mom-" + e.id] && !momOpen(e) ? `<a class="btn block" href="#mom-${e.id}">MOM 결과 보기</a>` : "")}`;
}

/* ---------- 팀원 라인업 확인 (전체) ---------- */
function viewMemberLineup(e) {
  const pid = myPid(); const L = lineupOf(e); const k = Math.min(ui.mlQ || 0, L.N - 1); const any = L.q.some(qs => qs.some(Boolean));
  const seg = `<nav class="seg" aria-label="일정 보기">${[["att", "참석"], ["lineup", "라인업"], ["check", "출석"], ["rec", "기록"]].map(([v, l]) => v === "lineup" ? `<a href="#lineup-${e.id}" aria-current="page">${l}</a>` : `<a href="#event-${e.id}" data-act="goEvTab" data-eid="${e.id}" data-v="${v}">${l}</a>`).join("")}</nav>`;
  const head = `${backbar("#event-" + e.id, pid ? esc(pname(pid)) + ", 팀원" : "팀원", "라인업 확인")}<section class="stack" style="gap:4px;padding:0 4px"><div class="date-l">${esc(bigDate(e))}</div><div class="small muted">${evSub(e)}</div></section>${seg}`;
  const tabs = isScrim(e) ? `<div style="padding:0 4px">${sideSeg(e, L.side)}</div>` : "";
  if (!any) return head + tabs + `<div class="card"><div class="empty"><b>아직 라인업 전이에요</b>운영진이 라인업을 짜면 여기에 보여요.</div></div>`;
  const P = pid ? myPlan(e, pid) : null; const i = pid ? L.q[k].indexOf(pid) : -1;
  const rest = P ? P.rows.filter(r => r.st === "rest").map(r => r.k + 1 + "쿼터") : [];
  return `${head}${tabs}
  ${P && (P.conf || P.on) && (!L.side || P.side === L.side) ? `<section class="card hot" style="gap:8px"><span class="lab">내 출전</span>${planTiles(e, pid)}<div class="small muted">${P.on ? `${rest.length ? rest.join(", ") + "에 쉬고, " : "쉬는 쿼터 없이 "}${P.N}개 쿼터 중 ${P.on}개를 뛰어요.` : "아직 라인업에 들어가 있지 않아요."}</div></section>` : ""}
  <section class="card" style="gap:10px"><div class="labrow"><span class="lab">쿼터별 위치</span><span class="chip ink num" style="font-size:14px">${esc(formName(L.formation))}</span></div>
    <div class="seg" role="tablist" aria-label="쿼터">${L.q.map((_, j) => `<button role="tab" data-act="mlQ" data-v="${j}" aria-selected="${j === k}">${j + 1}Q</button>`).join("")}</div>
    ${pitchHtml(e, L, k, { me: pid })}
    ${pid ? `<div role="status" style="font-size:14px;font-weight:700;color:${i >= 0 ? "var(--clay)" : "var(--muted)"}">${k + 1}쿼터: ${i >= 0 ? `${esc(L.spots[i][3])} 자리에서 뛰어요` : roster(e).ids.has(pid) ? "쉬는 쿼터예요" : "라인업에 없어요"}</div>` : ""}
    <div class="benchrow"><span class="k">이 쿼터 휴식</span>${benchOf(e, L, k).map(x => `<span class="bench ${x.id === pid ? "me" : x.late ? "late" : ""}">${x.id === pid ? "나 (" + esc(x.name) + ")" : esc(x.name) + (x.late ? ` (${x.from}Q 합류)` : "")}</span>`).join("") || `<span class="small muted">없음</span>`}</div>
  </section>
  <section class="card" style="gap:4px"><div class="labrow" style="margin-bottom:4px"><span class="lab">누가 언제 쉬나</span>${legendHtml()}</div>${playTable(e, L, k, pid)}<div class="hint" style="padding-top:4px">운영진이 짠 라인업이라 여기서는 바꿀 수 없어요. 바뀌면 알림함에 떠요.</div></section>`;
}

/* ---------- 내 회비 ---------- */
function viewMyMoney() {
  const pid = myPid();
  if (!pid) return `<div class="titlebar"><h1 class="title">내 회비</h1></div>${Store.canVote ? claimPrompt() : `<div class="card"><div class="empty"><b>팀원 권한을 받으면 내 회비와 벌금을 볼 수 있어요</b></div></div>`}`;
  const M = myMoney(pid); const acct = String(S.settings.account || "").trim(); const fee = Number(S.settings.fee) || 0;
  const open = M.items.filter(i => i.req !== "req" && i.req !== "ok"); const waiting = M.items.filter(i => i.req === "req");
  const sum = open.reduce((s, i) => s + i.amount, 0);
  const st = it => it.req === "req" ? `<b class="muted">확인 대기</b>` : it.req === "no" ? `<b style="color:var(--clay)">확인 안 됨</b>` : `<b style="color:var(--clay)">아직이에요</b>`;
  const head = open.length ? `${sum.toLocaleString("ko-KR")}원만 내면 돼요` : waiting.length ? "총무가 확인하는 중이에요" : "이번 달은 다 냈어요";
  const duesRow = M.canSeeDues && fee ? `<div class="row between" style="font-size:16px"><span>${Number(M.month.slice(5))}월 회비 <span class="num" style="font-size:19px">${fee.toLocaleString("ko-KR")}</span>원</span>${M.dues === "paid" ? "<b>냈어요</b>" : M.dues === "exempt" ? `<b class="muted">면제</b>` : st(M.items.find(i => i.kind === "dues") || {})}</div>` : "";
  const fineRows = M.items.filter(i => i.kind === "fine").map(it => `<div class="row between" style="font-size:16px"><span>${esc(it.label)} <span class="num" style="font-size:19px">${it.amount.toLocaleString("ko-KR")}</span>원</span>${st(it)}</div>`).join("");
  const jm = String((playerById(pid) || {}).joined || "").slice(0, 7);
  const months = [-1, -2, -3, -4, -5].map(k => shiftMonth(thisMonth(), k)).filter(m => !jm || m >= jm);
  const paidF = myFines(pid).filter(f => f.paid).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6);
  return `<div class="titlebar"><h1 class="title">내 회비</h1></div>
  <section class="card hot" style="gap:12px;padding:18px"><div class="hl" style="font-size:22px">${head}</div>${duesRow}${fineRows}
    ${M.items.some(i => i.req === "no") ? `<div class="status">총무가 입금을 확인하지 못한 항목이 있어요. 다시 확인해 주세요.</div>` : ""}
    ${acct ? `<div class="acct"><div class="small muted">이 계좌로 보내 주세요</div><div style="font-size:17px;font-weight:700;word-break:break-all">${esc(acct)}</div></div><button class="btn big" data-act="copyAcct" style="border-width:2px">계좌번호 복사하기</button>` : ""}
    ${open.length ? `<button class="btn primary big" data-act="payReq" style="min-height:58px;font-size:18px">입금했어요 (${won(sum)})</button>` : waiting.length ? `<button class="btn primary big" disabled style="min-height:58px;font-size:18px">확인 기다리는 중</button>` : ""}
  </section>
  <section class="card" style="padding:16px 18px"><span class="lab">지난 기록</span>
    ${months.map(m => { const s = myDuesState(m, pid); return `<div class="row between"><span>${Number(m.slice(5))}월 회비</span><span class="${s ? "" : "muted"}">${s === "paid" ? "냈어요" : s === "exempt" ? "면제" : "미납"}</span></div>`; }).join("")}
    ${paidF.map(f => `<div class="row between"><span>${f.date ? Number(f.date.slice(5, 7)) + "월 " + Number(f.date.slice(8, 10)) + "일 " : ""}${esc(f.reason || "벌금")} <span class="num" style="font-size:17px">${(Number(f.amount) || 0).toLocaleString("ko-KR")}</span>원</span><span>냈어요</span></div>`).join("")}
    <div class="hint">본인 기록만 보여요. 다른 사람의 납부 여부는 운영진만 볼 수 있어요.</div></section>`;
}

/* ---------- 내 기록 ---------- */
function viewReport() {
  const pid = myPid();
  if (!pid) return `<div class="titlebar"><h1 class="title">내 기록</h1></div>${Store.canVote ? claimPrompt() : `<div class="card"><div class="empty"><b>팀원 권한을 받으면 내 기록을 볼 수 있어요</b></div></div>`}`;
  const y = String(new Date().getFullYear()); const m = thisMonth(); const season = ui.rptTab !== "month";
  const from = season ? y + "-01-01" : m + "-01", to = season ? y + "-12-31" : m + "-31";
  const D = reportData(pid, from, to); const rate = D.played ? Math.round(D.came / D.played * 100) : 0;
  const bars = monthBars(pid); const maxN = Math.max(1, ...bars.map(b => b.n));
  const posArr = Object.entries(D.pos).sort((a, b) => b[1] - a[1]).slice(0, 3); const posTot = Object.values(D.pos).reduce((s, v) => s + v, 0);
  const pcol = ["var(--clay)", "var(--tile)", "var(--tan)"];
  return `<div class="titlebar"><h1 class="title">내 기록</h1></div>
  <div class="seg" role="group" aria-label="기간"><button data-act="rptTab" data-v="season" aria-pressed="${season}">${y} 시즌</button><button data-act="rptTab" data-v="month" aria-pressed="${!season}">${Number(m.slice(5))}월</button></div>
  <section class="card hot" style="padding:18px;gap:10px"><span class="lab">${season ? y + " 시즌" : Number(m.slice(5)) + "월"} 출석률</span>
    <div class="row" style="align-items:baseline;gap:8px"><span class="big" style="font-size:60px;color:var(--clay)">${rate}%</span><span class="muted">${D.came} / ${D.played}경기</span></div>
    <div class="barline r"><span style="width:${rate}%;background:var(--clay)"></span></div>
    <div style="font-size:14px">${D.streak ? `지금 ${D.streak}경기 연속 출석 중이에요.` : D.played ? "다음 경기부터 다시 연속 출석을 쌓아 봐요." : "아직 지난 경기가 없어요."}</div></section>
  <section class="tiles3" aria-label="기록">${[[D.goals, "골"], [D.assists, "도움"], [D.mom, "MOM"], [D.quarters, "출전 쿼터"], [D.late, "지각"], [D.absent, "결석"]].map(([v, k]) => `<div class="tile"><div class="big" style="font-size:30px">${v}</div><div class="k">${k}</div></div>`).join("")}</section>
  <section class="card" style="gap:10px"><span class="lab">월별 출석</span><div class="mbars">${bars.map(b => `<div><span class="num" style="font-size:14px">${b.c}/${b.n}</span><i class="${b.n && b.c === b.n ? "full" : ""}" style="height:${Math.round(b.c / maxN * 76)}px"></i><span class="tiny muted">${Number(b.m.slice(5))}월</span></div>`).join("")}</div></section>
  ${posArr.length ? `<section class="card"><span class="lab">어느 자리에서 뛰었나 (쿼터 기준)</span>${posArr.map(([lab, v], i) => `<div class="posbar"><b>${esc(lab)}</b><div class="barline r"><span style="width:${Math.round(v / posTot * 100)}%;background:${pcol[i]}"></span></div><span class="v num">${Math.round(v / posTot * 100)}%</span></div>`).join("")}</section>` : ""}
  <div class="hint center">본인 기록만 보이고 순위를 매기지 않아요.</div>`;
}

/* ---------- 나 찾기 ---------- */
function viewClaim() {
  const takenBy = pid => uidsOf(pid).some(u => u !== Store.me);
  const req = myReq(); const pick = ui.claimPick || "";
  const name = String(S.settings.teamName || "우리 팀");
  return `<div class="row" style="padding:12px 4px 0;gap:12px"><span class="crest" aria-hidden="true">${esc(Array.from(name.replace(/^FC\s*/i, ""))[0] || "FC")}</span><div><div class="small muted">${esc(name)}에 오신 걸 환영해요</div><h1 class="title">처음이네요, 누구세요?</h1></div></div>
  ${req ? `<div class="status">${esc(req.reqName)} 이름으로 등록을 요청했어요. 운영진이 확인하면 바로 투표할 수 있어요.</div>` : ""}
  <div class="small muted" style="padding:0 4px">명단에서 본인 이름을 한 번만 골라 주세요. 그다음부터는 바로 홈으로 들어가요.</div>
  <div class="claimgrid" role="radiogroup" aria-label="명단">${activePlayers().slice().sort((a, b) => (Number(a.num) || 999) - (Number(b.num) || 999)).map(p => `<button role="radio" data-act="claimPick" data-pid="${p.id}" aria-checked="${pick === p.id}" ${takenBy(p.id) ? "disabled" : ""}><span class="num">${esc(p.num || "")}</span><b>${esc(p.name)}</b></button>`).join("")}</div>
  <div class="hint" style="padding:0 4px">흐린 이름은 이미 다른 계정과 연결된 사람이에요.</div>
  <button class="btn block" data-act="claimNew">명단에 제 이름이 없어요</button>
  ${pick ? `<div style="height:110px"></div><div class="confirmbar"><div class="in"><div style="font-size:14px"><b>${esc(pname(pick))}${playerById(pick) && playerById(pick).num ? ` (${esc(playerById(pick).num)}번)` : ""}</b> 선수로 시작할까요?</div><button class="btn primary big" data-act="claimConfirm">네, 저예요</button></div></div>` : ""}`;
}

/* ---------- 내 포지션 ---------- */
const POS_ALL = ["GK", "CB", "LB", "RB", "LWB", "RWB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST", "CF"];
function posPicker(key, sel, other, act) {
  const list = key === "p2" ? POS_ALL.concat(["없음"]) : POS_ALL;
  return `<div class="pick c4" role="radiogroup" aria-label="${key === "p1" ? "주 포지션" : "부 포지션"}">${list.map(p => { const on = (sel || (key === "p2" ? "없음" : "")) === p; const dis = p !== "없음" && other === p; return `<button role="radio" data-act="${act}" data-k="${key}" data-v="${p}" aria-checked="${on}" ${dis ? "disabled" : ""}>${p}</button>`; }).join("")}</div>`;
}
function viewMyPos() {
  const pid = myPid(); const p = playerById(pid);
  if (!p) return backbar("#home", "", "내 포지션") + (Store.canVote ? claimPrompt() : "");
  const r = myPosReq(); const live = r && r.status === "req";
  if (!ui.posSel || ui.posSel.pid !== pid) ui.posSel = { pid, p1: p.pos1 || "", p2: p.pos2 || "" };
  const sel = ui.posSel; const same = sel.p1 === (p.pos1 || "") && (sel.p2 || "") === (p.pos2 || "");
  const reqText = sel.p1 + (sel.p2 && sel.p2 !== "없음" ? ", " + sel.p2 : "");
  return `${backbar("#home", esc(p.name), "내 포지션")}
  <section class="card hot"><div class="labrow"><span class="lab">지금 포지션</span>${live ? `<span class="chip soft">변경 요청 중</span>` : ""}</div>
    <div class="row" style="gap:8px;align-items:baseline"><span class="big" style="font-size:44px">${esc(p.pos1 || "없음")}</span>${p.pos2 ? `<span class="big muted" style="font-size:26px">${esc(p.pos2)}</span>` : ""}</div>
    <div class="hint">주 포지션, 부 포지션 순서예요. 자동 라인업이 이걸 보고 자리를 정해요.</div></section>
  ${r && r.status === "no" ? `<div class="status">${esc(r.pos1)}${r.pos2 ? ", " + esc(r.pos2) : ""}(으)로 바꾸는 요청을 운영진이 반려했어요. <button class="linkbtn" data-act="posReqCancel">확인</button></div>` : ""}
  ${live ? `<section class="card"><div role="status" style="font-weight:700">${esc(r.pos1)}${r.pos2 ? ", " + esc(r.pos2) : ""}(으)로 바꿔 달라고 요청했어요</div><div class="small muted">운영진이 승인하면 알림함에 뜨고, 다음 라인업부터 반영돼요.</div><button class="btn block" data-act="posReqCancel">요청 취소</button></section>`
    : `<section class="card" style="gap:12px"><div class="field" style="margin:0">바꾸고 싶은 주 포지션${posPicker("p1", sel.p1, sel.p2, "posSel")}</div><div class="field" style="margin:0">부 포지션${posPicker("p2", sel.p2, sel.p1, "posSel")}</div>${sel.p1 ? `<div style="font-size:14px">요청: <b>${esc(reqText)}</b></div>` : ""}</section>
    <button class="btn primary big" data-act="posSend" ${same || !sel.p1 ? "disabled" : ""}>${same ? "지금과 같아요" : !sel.p1 ? "주 포지션을 골라 주세요" : "운영진에게 변경 요청"}</button>`}`;
}
