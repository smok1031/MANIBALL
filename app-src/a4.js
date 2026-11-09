
/* ---------- 운영진 홈 ---------- */
function viewOpHome() {
  if (!S.players.length) return `<div class="card"><div class="empty"><b>팀을 시작해 볼까요?</b>먼저 팀 이름과 정원, 회비, 벌금 규칙을 정하고, 선수 명단을 붙여 넣어 한 번에 등록하세요. 그다음 일정을 올리면 팀원들이 참석 투표를 할 수 있어요.</div>
    <a class="btn primary big" href="#config">팀 이름과 규칙 정하기</a><button class="btn block" data-act="bulkOpen">명단 붙여 넣어 한 번에 등록</button></div>`;
  const parts = [];
  if (typeof window.webHomeCards === "function") { const w = window.webHomeCards(); if (w) parts.push(w); }
  const n = todoCount();
  parts.push(`<a class="card soft" href="#todo" style="flex-direction:row;align-items:center;gap:10px;border-radius:16px;padding:12px 14px"><span class="num" style="font-size:30px;line-height:1">${n}</span><span class="grow" style="font-weight:700">${n ? "오늘 처리할 일이 있어요" : "오늘 처리할 일이 없어요"}</span>${ICON.chev}</a>`);
  const next = eventsSorted().find(e => !started(e));
  if (next) {
    const c = attCounts(next); const tot = Math.max(activePlayers().length, 1);
    parts.push(`<a class="rule" href="#event-${next.id}"><div class="labrow"><span class="lab">다음 일정</span><span class="chip ink">${isScrim(next) ? "내전" : next.type === "match" ? "경기" : "훈련"}, ${esc(FORMAT_KO[next.format] || "")}</span></div>
      <span class="date-xl">${esc(bigDate(next))}</span><span class="small muted">${evSub(next, false).replace(esc(evTitle(next)) + ", ", "")}</span>
      <div class="barline" aria-hidden="true" style="height:12px;margin-top:4px"><span style="width:${c.in / tot * 100}%;background:var(--clay)"></span><span style="width:${c.wait / tot * 100}%;background:var(--tan)"></span><span style="width:${c.no / tot * 100}%;background:var(--tile)"></span></div>
      <div class="tiles3" style="grid-template-columns:repeat(4,minmax(0,1fr))"><div><div class="num" style="font-size:22px;color:var(--clay)">${c.all}${c.capAll === Infinity ? "" : "/" + c.capAll}</div><div class="tiny muted">확정</div></div><div><div class="num" style="font-size:22px">${c.wait}</div><div class="tiny muted">대기</div></div><div><div class="num" style="font-size:22px">${c.no}</div><div class="tiny muted">불참</div></div><div><div class="num" style="font-size:22px">${c.none}</div><div class="tiny muted">미응답</div></div></div></a>`);
  } else parts.push(`<div class="card"><span class="lab">다음 일정</span><div class="small muted">예정된 일정이 없어요.</div><button class="btn block" data-act="newEvent">일정 올리기</button></div>`);
  const reqs = pendingReqs(); const regs = Object.keys(S.rsvp).filter(u => S.rsvp[u].reqName && !claimOf(u)).length; const pq = posReqUids().length;
  parts.push(`<div class="tiles3" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;text-align:left">
    <a class="card" href="#players" style="gap:4px"><span class="lab">선수 요청</span><span class="num" style="font-size:32px;line-height:1;color:${regs + pq ? "var(--clay)" : "var(--ink)"}">${regs + pq}건</span><span class="tiny muted">등록 ${regs}, 포지션 ${pq}</span></a>
    <a class="card" href="#money" data-act="goReq" style="gap:4px"><span class="lab">입금 확인</span><span class="num" style="font-size:32px;line-height:1;color:${reqs.length ? "var(--clay)" : "var(--ink)"}">${reqs.length}건</span><span class="tiny muted ell">${reqs.length ? reqs.slice(0, 3).map(r => esc(pname(r.pid))).join(", ") : "확인할 요청 없음"}</span></a></div>`);
  const m = thisMonth(); const act = activePlayers(); const payable = act.filter(p => duesState(m, p.id) !== "exempt");
  const paid = payable.filter(p => duesState(m, p.id) === "paid"); const unpaid = payable.filter(p => duesState(m, p.id) !== "paid");
  if (Number(S.settings.fee) > 0) parts.push(`<a class="card" href="#money" data-act="goDues"><div class="labrow"><span class="lab">${Number(m.slice(5))}월 회비</span><span class="num" style="font-size:17px">${won(paid.length * (S.settings.fee || 0))}</span></div>
    <div class="row" style="align-items:baseline;gap:6px"><span class="big" style="font-size:40px">${paid.length}</span><span class="num muted" style="font-size:20px">/ ${payable.length}명 납부</span></div>
    <div class="barline r"><span style="width:${payable.length ? paid.length / payable.length * 100 : 0}%;background:var(--clay)"></span></div>
    ${unpaid.length ? `<div class="chips">${unpaid.slice(0, 14).map(p => `<span class="chip line">${esc(p.name)}</span>`).join("")}${unpaid.length > 14 ? `<span class="chip">외 ${unpaid.length - 14}명</span>` : ""}</div>` : `<div class="small" style="font-weight:700;color:var(--clay)">이번 달 회비를 모두 냈어요.</div>`}</a>`);
  const uf = unpaidFines(); const ufSum = uf.reduce((s, f) => s + (Number(f.amount) || 0), 0);
  parts.push(`<a class="card" href="#money" data-act="goFines" style="flex-direction:row;align-items:center;gap:12px"><div class="grow"><div class="lab">팀 미납 벌금</div><div class="num" style="font-size:30px;line-height:1.1">${ufSum.toLocaleString("ko-KR")}<span style="font-family:var(--f-body);font-size:14px;font-weight:600;margin-left:2px">원</span></div></div><span class="chip soft">${uf.length}건</span>${ICON.chev}</a>`);
  const n0 = S.notices[0];
  parts.push(`<div class="card" style="flex-direction:row;align-items:center;gap:10px"><a href="#notice" class="grow" style="text-decoration:none;color:inherit;min-width:0"><span class="lab">공지와 설문</span><div class="small ell">${n0 ? esc(n0.title) : "아직 공지가 없어요"}</div></a><button class="btn" data-act="noticeNew">+ 공지 쓰기</button></div>`);
  parts.push(seasonCard());
  return parts.join("");
}
function seasonCard() {
  const years = Array.from(new Set(Object.values(S.events).map(e => e.date.slice(0, 4)).concat([String(new Date().getFullYear())]))).sort().reverse();
  const y = ui.year; const matches = eventsSorted().filter(e => e.date.startsWith(y) && hasScore(e) && !isScrim(e) && e.date <= todayStr());
  const rec = { W: 0, D: 0, L: 0, gf: 0, ga: 0 }; matches.forEach(e => { rec[resultOf(e)]++; rec.gf += e.score.us; rec.ga += e.score.them; });
  const form = matches.slice(-5).map(e => { const r = resultOf(e); return `<span class="${r}" title="${esc(fmtDate(e.date))}">${{ W: "승", D: "무", L: "패" }[r]}</span>`; }).join("");
  const rk = ui.rankTab || "goals"; const stAll = S.players.map(p => ({ p, ...playerStats(p.id, y) }));
  let list;
  if (rk === "mom") list = seasonMomRank(y).map(([pid, v]) => ({ name: pname(pid), v }));
  else list = stAll.filter(x => x[rk] > 0).sort((a, b) => b[rk] - a[rk] || String(a.p.name).localeCompare(String(b.p.name), "ko")).slice(0, 5).map(x => ({ name: x.p.name, v: x[rk] }));
  const unit = { goals: "골", assists: "개", apps: "회", mom: "회" }[rk];
  let last = null, lastRk = 0;
  return `<section class="card"><div class="labrow"><span class="lab">${esc(y)} 시즌</span><select id="yearSel" aria-label="연도" class="inp" style="width:auto;min-height:32px;padding:0 8px">${years.map(yy => `<option ${yy === y ? "selected" : ""}>${yy}</option>`).join("")}</select></div>
    <div class="tiles3"><div><div class="big" style="font-size:34px;color:var(--clay)">${rec.W}</div><div class="tiny muted">승</div></div><div><div class="big" style="font-size:34px">${rec.D}</div><div class="tiny muted">무</div></div><div><div class="big" style="font-size:34px;color:var(--muted)">${rec.L}</div><div class="tiny muted">패</div></div></div>
    <div class="row between small muted"><span>득점 <b class="num" style="font-size:17px;color:var(--ink)">${rec.gf}</b> 실점 <b class="num" style="font-size:17px;color:var(--ink)">${rec.ga}</b></span><span class="form">${form || `<span class="hint">경기 결과 없음</span>`}</span></div>
    <div class="seg" role="group" aria-label="순위 기준">${[["goals", "득점"], ["assists", "도움"], ["apps", "출석"], ["mom", "MOM"]].map(([k, l]) => `<button data-act="rankTab" data-v="${k}" aria-pressed="${rk === k}">${l}</button>`).join("")}</div>
    ${list.length ? list.map((x, i) => { const r = x.v === last ? lastRk : i + 1; last = x.v; lastRk = r; return `<div class="rank"><span class="n ${r === 1 ? "top" : ""}">${r}</span><span class="grow ell" style="font-weight:700">${esc(x.name)}</span><span class="v">${x.v}${unit}</span></div>`; }).join("") : `<div class="hint">아직 기록이 없어요.</div>`}</section>`;
}

/* ---------- 운영진 일정 ---------- */
function viewOpSched() {
  const all = eventsSorted(); const up = ui.schedFilter !== "past";
  const list = up ? all.filter(e => !started(e)) : all.filter(e => started(e)).reverse();
  const next = all.find(e => !started(e));
  const kind = e => isScrim(e) ? ["내전", "clay"] : e.type === "match" ? ["경기", "ink"] : ["훈련", ""];
  return `<div class="titlebar"><h1 class="title">일정</h1><button class="btn primary" data-act="newEvent" style="min-height:44px;border-radius:14px;font-size:14px">+ 일정 올리기</button></div>
  <div class="seg" role="group" aria-label="일정 보기"><button data-act="schedFilter" data-v="up" aria-pressed="${up}">다가오는 일정</button><button data-act="schedFilter" data-v="past" aria-pressed="${!up}">지난 일정</button></div>
  ${list.length ? list.map(e => { const d = parseD(e.date); const c = attCounts(e); const k = kind(e); const r = resultOf(e);
    return `<a class="evcard ${next && e.id === next.id ? "hot" : ""}" href="#event-${e.id}"><div class="datebox"><div class="m">${d.getMonth() + 1}월</div><div class="d">${d.getDate()}</div><div class="w">${WD[d.getDay()]}요일</div></div>
      <div class="grow" style="display:flex;flex-direction:column;gap:2px"><div class="row" style="gap:6px"><span class="chip ${k[1]}">${k[0]}</span><span class="tiny muted">${esc(FORMAT_KO[e.format] || "")}</span></div><b class="ell">${esc(evTitle(e))}</b><span class="tiny muted ell">${[e.time, e.place].filter(Boolean).map(esc).join(", ") || "&nbsp;"}</span></div>
      <div style="text-align:right;flex:none">${hasScore(e) ? `<div class="num" style="font-size:24px;color:${r === "W" ? "var(--clay)" : r === "L" ? "var(--muted)" : "var(--ink)"}">${e.score.us} : ${e.score.them}</div><div class="tiny muted">${{ W: "승", D: "무", L: "패" }[r]}</div>` : `<div class="num" style="font-size:20px">${c.all}${c.capAll === Infinity ? "" : "/" + c.capAll}</div><div class="tiny muted">${c.wait ? `대기 ${c.wait}` : "명 확정"}</div>`}</div></a>`; }).join("")
    : `<div class="card"><div class="empty"><b>${up ? "다가오는 일정이 없어요" : "지난 일정이 없어요"}</b>${up ? "위 버튼으로 경기나 내전을 올리세요." : "날짜가 지난 일정이 여기 쌓여요."}</div></div>`}`;
}

/* ---------- 운영진 일정 상세 ---------- */
function viewOpEvent(e) {
  if (ui.evFor !== e.id) { ui.evFor = e.id; const mins = (eventStart(e).getTime() - Date.now()) / 60000; ui.evTab = mins > 90 ? "att" : mins > -180 && !checkStarted(e) ? "check" : isPlay(e) ? "rec" : "check"; ui.attFilter = "in"; ui.lineQ = 0; ui.lineSel = -1; ui.lineMsg = ""; }
  const titles = { att: "참석 관리", lineup: "라인업 짜기", check: "현장 출석", rec: isPlay(e) ? "경기 기록" : "메모" };
  if (!titles[ui.evTab]) ui.evTab = "att";
  const body = ui.evTab === "att" ? opAtt(e) : ui.evTab === "lineup" ? opLineup(e) : ui.evTab === "check" ? opCheck(e) : opRec(e);
  const links = [];
  if (isScrim(e) && e.type !== "scrim") links.push(`<a class="btn" href="#split-${e.id}">팀 나누기${e.teamsAt ? " (확정)" : ""}</a>`);
  if (S.tally["mom-" + e.id] || momOpen(e)) links.push(`<a class="btn" href="#mom-${e.id}">MOM</a>`);
  return `${backbar("#schedule", "운영진", titles[ui.evTab], `<button class="btn" data-act="shareEvent" data-id="${e.id}">공유</button><button class="btn" data-act="editEvent" data-id="${e.id}">수정</button>`)}
  <section class="stack" style="gap:4px;padding:0 4px"><div class="date-l">${esc(bigDate(e))}</div><div class="small muted">${evSub(e)}${Number(e.fieldFee) ? `, 구장비 ${won(e.fieldFee)}` : ""}</div></section>
  <div class="seg" role="group" aria-label="일정 보기">${[["att", "참석"], ["lineup", "라인업"], ["check", "현장 출석"], ["rec", isPlay(e) ? "기록" : "메모"]].map(([k, l]) => `<button data-act="evTab" data-v="${k}" aria-pressed="${ui.evTab === k}">${l}</button>`).join("")}</div>
  ${links.length ? `<div class="btnrow">${links.join("")}</div>` : ""}
  ${body}
  ${e.updatedBy ? `<div class="hint center">마지막 수정 <span data-uid="${esc(e.updatedBy)}" data-fallback="운영진">운영진</span>${e.updatedAt ? ", " + esc(fmtStamp(e.updatedAt)) : ""}</div>` : ""}`;
}
function opAtt(e) {
  const act = activePlayers(); const c = attCounts(e); const r = roster(e); const A = effAtt(e);
  if (!act.length) return `<div class="card"><div class="empty"><b>등록된 선수가 없어요</b>선수 탭에서 먼저 선수를 추가하세요.</div></div>`;
  const sets = { in: r.confirmed, wait: r.wait, no: S.players.filter(p => A.s[p.id] === "no").sort(sortPlayers), none: act.filter(p => !A.s[p.id]) };
  const f = sets[ui.attFilter] ? ui.attFilter : "in";
  const labels = { in: "확정", wait: "대기", no: "불참", none: "미응답" };
  const titles = { in: "확정 명단 (누른 순서)", wait: "대기열", no: "불참", none: "아직 응답 안 함" };
  const full = c.capAll !== Infinity && c.all >= c.capAll;
  const rows = sets[f].map((p, i) => {
    const v = A.s[p.id] || ""; const q = lateQ(e, p.id);
    const when = A.at[p.id] && going(v) ? A.at[p.id] : A.upd[p.id];
    const meta = [v === "late" ? `늦참${q ? ", " + q + "Q부터" : ""}` : "", fmtStamp(when), uidsOf(p.id).length && A.src[p.id] === "me" ? "본인 응답" : ""].filter(Boolean).join(", ") || "응답 없음";
    return `<div class="arow"><div class="row" style="gap:8px"><span class="no">${f === "in" || f === "wait" ? i + 1 : ""}</span><div class="grow"><div style="font-weight:700;white-space:nowrap">${esc(p.name)} <span class="tiny muted" style="font-weight:600">${esc(p.pos1 || p.pos || "")}</span></div><div class="tiny muted ell">${esc(meta)}</div></div>
      <div class="rgroup" style="grid-template-columns:repeat(3,44px)" role="group" aria-label="${esc(p.name)} 참석 바꾸기">${Object.entries(ATT).map(([k, l]) => `<button data-act="setAtt" data-pid="${p.id}" data-v="${k}" aria-pressed="${v === k}">${l}</button>`).join("")}</div></div>
      ${v === "late" ? `<div class="lateq"><span>몇 쿼터부터?</span>${Array.from({ length: quartersOf(e) }, (_, k) => k + 1).slice(0, 8).map(k => `<button data-act="setLateQ" data-pid="${p.id}" data-q="${k}" aria-pressed="${q === k}">${k}Q</button>`).join("")}</div>` : ""}</div>`;
  }).join("");
  const log = Object.keys(A.upd).concat(Object.keys(A.cancelAt)).filter((v, i, a) => a.indexOf(v) === i).map(pid => { const p = playerById(pid); if (!p) return null; const t = [A.upd[pid], A.at[pid], A.cancelAt[pid]].filter(Boolean).sort().pop(); if (!t) return null; let txt = A.s[pid] ? ATT[A.s[pid]] : "응답 취소"; if (A.cancelAt[pid] && A.s[pid] === "no") txt = "참석 → 불참"; return { t, txt: `<b>${esc(p.name)}</b> ${txt}${A.src[pid] === "me" ? " (본인)" : ""}` }; }).filter(Boolean).sort((a, b) => b.t.localeCompare(a.t)).slice(0, 5);
  return `<section class="card"><div class="row" style="align-items:baseline;gap:6px"><span class="big" style="font-size:40px">${c.all}</span><span class="muted" style="font-weight:600">${c.capAll === Infinity ? "명 참석" : `/ ${c.capAll}명 확정`}</span><span class="grow"></span>${c.capAll === Infinity ? "" : `<span class="chip ${full ? "clay" : ""}">${full ? "정원 참" : `${c.capAll - c.all}자리 남음`}</span>`}</div>
    <div class="fseg" role="group" aria-label="명단 보기">${Object.keys(labels).map(k => `<button data-act="attFilter" data-v="${k}" aria-pressed="${f === k}"><b>${sets[k].length}</b><span>${labels[k]}</span></button>`).join("")}</div>
    <div class="hint">참석을 누른 순서대로 ${c.capAll === Infinity ? "기록돼요" : `${c.capAll}명까지 확정되고, 그 뒤로는 대기열에 들어가요. 확정 인원이 빠지면 대기 1번부터 자동으로 올라가요`}.${c.guests ? ` 게스트 ${c.guests}명 포함.` : ""}</div>
    ${f === "none" && sets.none.length ? `<div class="btnrow"><button class="btn" data-act="shareNudge" data-id="${e.id}">미응답 ${sets.none.length}명 알림 문구</button><button class="btn" data-act="allYes">모두 참석 처리</button></div>` : ""}</section>
  ${guestCard(e)}
  <section class="card flat"><div class="lh"><span class="lab">${titles[f]}</span></div>${rows || `<div class="empty">해당하는 사람이 없어요.</div>`}</section>
  ${log.length ? `<section class="card" style="gap:4px"><span class="lab" style="margin-bottom:4px">최근 변경</span>${log.map(l => `<div class="log"><span class="t">${esc(fmtStamp(l.t))}</span><span>${l.txt}</span></div>`).join("")}</section>` : ""}`;
}
function opLineup(e) {
  const L = lineupOf(e); const k = Math.min(ui.lineQ, L.N - 1); const conf = roster(e).confirmed;
  const sel = ui.lineSel; const bench = benchOf(e, L, k);
  const confIds = new Set((L.side ? sidePool(e, L.side) : conf).map(p => p.id)); const stale = Array.from(new Set(L.q.flat().filter(id => id && !confIds.has(id)))).map(id => pname(id));
  const hint = ui.lineMsg || (sel >= 0 ? `${L.spots[sel] ? L.spots[sel][3] : ""} 자리를 골랐어요. ${L.side ? "휴식" : "벤치"}에서 넣을 사람을 누르거나, 다른 자리를 누르면 서로 바꿔요.` : `자리를 누르고 ${L.side ? "휴식" : "벤치"}에서 사람을 고르면 바뀌어요.`);
  const scrim = !!L.side;
  let top = `<div class="forms" role="group" aria-label="포메이션">${Object.keys(L.forms).map(f => `<button data-act="formation" data-v="${f}" aria-pressed="${f === L.formation}">${f}</button>`).join("")}</div>`;
  if (scrim) {
    const nA = sidePool(e, "A").length, nB = sidePool(e, "B").length, nOut = 0;
    const size = L.formation.split("|")[0];
    const sizes = Array.from(new Set(Object.keys(SCRIM_FORMS).map(k => k.split("|")[0])));
    top = `<div class="row between" style="gap:8px"><div class="small"><b>스쿼드</b> 조끼팀 ${nA}명, 일반팀 ${nB}명${nOut ? `, 안 고른 사람 ${nOut}명` : ""}</div><a class="btn sm" href="#split-${e.id}">스쿼드 고르기</a></div>
      ${sideSeg(e, L.side)}
      <div class="field" style="margin:0"><span class="flabel">${L.side === "A" ? "조끼팀" : "일반팀"} 한 번에 뛰는 인원</span><div class="forms" role="group" aria-label="인원">${sizes.map(n => `<button data-act="scrimN" data-v="${n}" aria-pressed="${n === size}">${n}인</button>`).join("")}</div></div>
      <div class="forms" role="group" aria-label="포메이션">${Object.keys(SCRIM_FORMS).filter(k => k.startsWith(size + "|")).map(f => `<button data-act="formation" data-v="${f}" aria-pressed="${f === L.formation}">${f.split("|")[1]}</button>`).join("")}</div>`;
    if (!nA && !nB) return `<section class="card" style="gap:10px">${top}<div class="empty"><b>먼저 스쿼드를 골라 주세요</b>팀 선수 중에서 조끼팀과 일반팀에 넣을 사람을 한 명씩 고르면, 팀마다 쿼터별 자리와 휴식을 짤 수 있어요.</div><a class="btn primary big" href="#split-${e.id}">스쿼드 고르기</a></section>`;
  }
  return `<section class="card" style="gap:10px">
    ${top}
    <div class="seg" role="group" aria-label="쿼터">${L.q.map((_, j) => `<button data-act="lineQ" data-v="${j}" aria-pressed="${j === k}">${j + 1}Q</button>`).join("")}</div>
    ${pitchHtml(e, L, k, { edit: true, sel })}
    <div role="status" style="font-size:13px;font-weight:600;color:${sel >= 0 ? "var(--clay-d)" : "var(--muted)"}">${esc(hint)}</div>
    ${stale.length ? `<div class="status">${L.side ? "이 팀 스쿼드가 아닌 사람이" : "참석 확정이 아닌 사람이"} 배치에 남아 있어요: ${esc(stale.join(", "))}. 자동 배치를 다시 누르면 정리돼요.</div>` : ""}
    <div class="benchrow"><span class="k">${scrim ? "휴식" : "벤치"}</span>${bench.map(x => `<button class="bench ${x.late ? "late" : sel >= 0 ? "armed" : ""}" data-act="benchTap" data-pid="${x.id}" ${x.late ? "disabled" : ""}>${esc(x.name)}${x.late ? ` (${x.from}Q~)` : ""}</button>`).join("") || `<span class="small muted">없음</span>`}</div>
    <button class="btn primary big" data-act="autoLineup">${scrim ? (L.side === "A" ? "조끼팀" : "일반팀") + " 출전 시간 고르게 자동 배치" : "출전 시간 고르게 자동 배치"}</button>
    <div class="btnrow"><button class="btn" data-act="copyQ">${k + 1}Q를 전 쿼터에 복사</button><button class="btn" data-act="clearQ">${k + 1}Q 비우기</button></div>
    <div class="hint">${scrim ? "자리를 누르고 휴식 칸에서 사람을 고르면 직접 넣을 수 있어요. 자동 배치는 이 팀 스쿼드만 쿼터마다 돌려서 출전 시간을 맞추고, 주, 부 포지션에 맞는 자리에 넣어요." : "자동 배치는 확정 인원(대기 제외)을 쿼터마다 돌려서 출전 시간을 맞추고, 주, 부 포지션에 맞는 자리에 넣어요."} 늦참은 합류 쿼터부터 들어가요.</div>
  </section>
  <section class="card" style="gap:4px"><div class="labrow" style="margin-bottom:4px"><span class="lab">${scrim ? (L.side === "A" ? "조끼팀 " : "일반팀 ") + "누가 언제 쉬나" : "출전 시간"}</span>${legendHtml(scrim ? "휴식" : "벤치")}</div>${playTable(e, L, k)}</section>`;
}
function opCheck(e) {
  const people = checkPeople(e); const c = checkCounts(e); const t = checkTime(e); const saved = checkStarted(e); const cancels = lateCancels(e);
  if (!people.length && !cancels.length) return `<div class="card"><div class="empty"><b>출석을 체크할 인원이 없어요</b>참석 탭에서 확정 인원이 생기면 여기에 명단이 만들어져요.</div></div>`;
  const grid = people.map(p => { const v = checkOf(e, p.id); const q = lateQ(e, p.id); const note = effAtt(e).s[p.id] === "late" ? `늦참 신청${q ? `, ${q}Q부터` : ""}` : !roster(e).ids.has(p.id) ? "명단 외" : "";
    return `<button class="ck ${v}" data-act="cycleCheck" data-pid="${p.id}" aria-label="${esc(p.name)}, 지금 ${CHECK[v]}, 눌러서 바꾸기"><span class="grow"><span class="nm">${esc(p.name)}</span>${note ? `<span class="nt">${esc(note)}</span>` : ""}</span><span class="st">${CHECK[v]}</span></button>`; }).join("");
  let fineCard = ""; const cands = fineCands(e);
  if (cands.length) {
    let total = 0, count = 0;
    const items = cands.map(cd => { const done = eventFine(e, cd.p.id, cd.pre); const amt = cd.pre ? Number(cd.pre.amount) || 0 : 0;
      if (done) return `<div class="cbox" style="cursor:default"><span class="grow"><b>${esc(cd.p.name)}</b> <span class="small muted">${esc(cd.why)}</span></span><span class="chip ${done.paid ? "" : "soft"}">${done.paid ? "납부" : "부과됨"}</span></div>`;
      if (!cd.pre) return `<div class="cbox" style="cursor:default"><span class="grow"><b>${esc(cd.p.name)}</b> <span class="small muted">${esc(cd.why)}, 해당 벌금 종류 없음</span></span></div>`;
      const on = fineOn(cd.key); if (on) { total += amt; count++; }
      return `<label class="cbox"><input type="checkbox" data-finesel="${esc(cd.key)}" ${on ? "checked" : ""}><span class="grow"><b>${esc(cd.p.name)}</b> <span class="small muted">${esc(cd.why)}</span></span><span class="num" style="font-size:17px">${amt.toLocaleString("ko-KR")}</span></label>`; }).join("");
    fineCard = `<section class="card"><div class="labrow"><span class="lab">벌금 부과</span><span class="hint">사정이 있으면 체크를 푸세요</span></div>${items}<button class="btn primary big" data-act="imposeFines" ${count ? "" : "disabled"}>${count ? `${count}명에게 벌금 부과 (${won(total)})` : "부과할 사람이 없어요"}</button></section>`;
  }
  const imposed = S.fines.filter(f => f.eventId === e.id && f.presetId !== "field" && f.presetId !== "guest");
  const names = kind => people.filter(p => checkOf(e, p.id) === kind);
  const result = saved || imposed.length ? `<section class="card hot"><div class="labrow"><span class="lab">출석 결과</span><button class="btn" data-act="shareCheck">단톡방 공유 문구</button></div>
    ${["late", "absent"].map(k => names(k).length ? `<div class="small"><b>${CHECK[k]} ${names(k).length}명</b> <span class="muted">${names(k).map(p => esc(p.name)).join(", ")}</span></div>` : "").join("")}
    ${imposed.length ? `<div class="chips">${imposed.map(f => `<span class="chip ${f.paid ? "" : "soft"}">${esc(pname(f.pid))} ${esc(f.reason || "")} ${won(f.amount)}${f.paid ? " 납부" : ""}</span>`).join("")}</div>` : `<div class="hint">부과된 벌금이 없어요.</div>`}</section>` : "";
  return `<section class="card hot"><div class="row between" style="align-items:flex-end"><div><div class="tiny muted" style="font-weight:700">${t ? `모임 ${esc(e.time)}, 출석 체크` : "출석 체크"}</div><div class="date-l" style="font-size:48px;color:var(--clay)">${esc(t || "현장")}</div></div>
    <div class="cnt"><div><b>${c.in + c.excused}</b><span>출석</span></div><div class="late"><b>${c.late}</b><span>지각</span></div><div class="absent"><b>${c.absent}</b><span>결석</span></div></div></div>
    <div class="small" style="color:var(--ink2)">온 사람은 그대로 두고 <b>없는 사람 이름만 누르세요.</b> 한 번 누르면 지각, 한 번 더 누르면 결석이에요.${saved ? "" : " 처음 누르는 순간 나머지는 출석으로 저장돼요."}</div>
    <div class="btnrow">${saved ? "" : `<button class="btn" data-act="checkSaveAll">이대로 저장 (전원 출석)</button>`}<button class="btn" data-act="checkAdd">명단 외 인원 추가</button></div></section>
  ${people.length ? `<section class="ckgrid" aria-label="출석 명단">${grid}</section>` : ""}
  ${cancels.length ? `<section class="card" style="gap:4px"><span class="lab">직전 취소 (경기 ${esc(S.settings.lateCancelH)}시간 이내)</span>${cancels.map(p => `<div style="font-size:14px"><b>${esc(p.name)}</b> <span class="tiny muted">${esc(fmtStamp(effAtt(e).cancelAt[p.id]))} 참석 → 불참</span></div>`).join("")}</section>` : ""}
  ${fineCard}${result}`;
}
function opRec(e) {
  const memo = `<section class="card"><label class="field" style="margin:0">메모<textarea class="inp" id="memo" data-input="memo" placeholder="준비물, 정산, 경기 소감 등">${esc(e.memo || "")}</textarea></label><div class="hint">입력을 멈추면 자동 저장돼요.</div></section>`;
  if (!isPlay(e)) return memo;
  const sc = e.score || {}; const us = Number.isFinite(sc.us) ? sc.us : null, them = Number.isFinite(sc.them) ? sc.them : null;
  const goals = e.goals || []; const mismatch = us !== null && goals.length > 0 && goals.length !== us;
  const r = resultOf(e); const scrim = isScrim(e);
  return `<section class="card hot"><div class="scoreboard">
      <div class="stack" style="gap:6px;align-items:center"><span class="small ell" style="font-weight:700">${scrim ? "조끼팀" : esc(S.settings.teamName || "우리 팀")}</span><div class="stepper"><button data-act="score" data-side="us" data-d="-1" aria-label="우리 팀 점수 빼기">-</button><span class="big" style="color:var(--clay)">${us ?? "-"}</span><button class="plus" data-act="score" data-side="us" data-d="1" aria-label="우리 팀 점수 더하기">+</button></div></div>
      <span class="big muted" style="font-size:30px">:</span>
      <div class="stack" style="gap:6px;align-items:center"><span class="small ell" style="font-weight:700">${scrim ? "일반팀" : esc(e.opponent || "상대 팀")}</span><div class="stepper"><button data-act="score" data-side="them" data-d="-1" aria-label="상대 팀 점수 빼기">-</button><span class="big">${them ?? "-"}</span><button class="plus them" data-act="score" data-side="them" data-d="1" aria-label="상대 팀 점수 더하기">+</button></div></div></div>
    <div class="center">${r ? `<span class="chip ${r === "W" ? "clay" : r === "L" ? "ink" : ""}" style="font-size:13px;padding:3px 12px">${{ W: "승", D: "무", L: "패" }[r]}</span> <button class="linkbtn" data-act="clearScore">결과 지우기</button>` : `<span class="hint">+ 를 누르면 결과가 기록돼요. 0 대 0 이면 <button class="linkbtn" data-act="score00">0 : 0 으로 기록</button></span>`}</div></section>
  <section class="card"><div class="labrow"><span class="lab">득점 기록</span><button class="btn" data-act="addGoal">+ 골 추가</button></div>
    ${mismatch ? `<div class="status">득점 기록은 ${goals.length}골인데 스코어는 ${us}골이에요.</div>` : ""}
    ${goals.length ? goals.map((g, i) => `<div class="goal"><span class="ball">${i + 1}</span><div class="grow"><div style="font-weight:700">${esc(pname(g.pid))}${g.q ? ` <span class="chip">${esc(g.q)}Q</span>` : ""}</div><div class="tiny muted">${g.assist ? "도움 " + esc(pname(g.assist)) : "도움 없음"}</div></div><button class="btn muted" data-act="delGoal" data-i="${i}" aria-label="${i + 1}번째 골 지우기" style="min-height:34px">지우기</button></div>`).join("") : `<div class="hint">골을 넣은 선수와 도움을 기록하면 시즌 순위에 반영돼요.</div>`}</section>${memo}`;
}

/* ---------- 선수 ---------- */
function viewPlayers() {
  const all = S.players.slice().sort(sortPlayers); const act = all.filter(p => p.active !== false), ina = all.filter(p => p.active === false);
  const y = String(new Date().getFullYear()); const m = thisMonth();
  const regs = Object.keys(S.rsvp).filter(u => S.rsvp[u].reqName && !claimOf(u)); const preqs = posReqUids();
  const fmt = (a, b) => a ? a + (b ? `, ${b}` : "") : "없음";
  const reqCard = regs.length || preqs.length ? `<section class="card hot" style="gap:8px"><div class="labrow"><span class="lab">요청</span><span class="chip soft">${regs.length + preqs.length}건</span></div>
    ${preqs.map(u => { const r = S.rsvp[u].posReq; const p = playerById(r.pid); return `<div class="stack" style="gap:6px;padding-bottom:8px;border-bottom:1px solid var(--line3)"><div class="row" style="gap:8px"><span class="chip">포지션</span><b class="grow">${esc(pname(r.pid))}</b></div><div style="font-size:14px">${esc(posLabel(p) || "없음")} <span class="muted">&rarr;</span> <b>${esc(fmt(r.pos1, r.pos2))}</b></div><div class="btnrow"><button class="btn" data-act="posNo" data-u="${esc(u)}">반려</button><button class="btn primary" data-act="posOk" data-u="${esc(u)}">승인</button></div></div>`; }).join("")}
    ${regs.map(u => { const d = S.rsvp[u]; return `<div class="stack" style="gap:6px"><div class="row" style="gap:8px"><span class="chip">등록</span><b class="grow">${esc(d.reqName)}</b><span class="tiny muted">명단에 이름이 없대요</span></div><div class="btnrow"><button class="btn" data-act="reqNo" data-u="${esc(u)}">거절</button><button class="btn primary" data-act="reqOk" data-u="${esc(u)}">선수로 등록</button></div></div>`; }).join("")}</section>` : "";
  const row = p => { const st = playerStats(p.id, y); const ds = duesState(m, p.id); const uf = S.fines.some(f => f.pid === p.id && !f.paid);
    return `<a class="li" href="#player-${p.id}"><span class="kit ${isGk(p) ? "gk" : ""}">${esc(p.num ?? "")}</span><div class="grow"><div class="row" style="gap:4px;flex-wrap:wrap"><b>${esc(p.name)}</b>${p.id === myPid() ? `<span class="chip ink">나</span>` : ""}${p.active !== false && Number(S.settings.fee) > 0 && ds !== "paid" && ds !== "exempt" ? `<span class="chip soft">회비</span>` : ""}${uf ? `<span class="chip ink">벌금</span>` : ""}</div><div class="tiny muted">${esc(posLabel(p)) || "포지션 미정"}</div></div>
      <div class="tiny muted" style="text-align:right;white-space:nowrap">출석 <b class="num" style="font-size:15px;color:var(--ink)">${st.apps}</b> 골 <b class="num" style="font-size:15px;color:var(--ink)">${st.goals}</b> 도움 <b class="num" style="font-size:15px;color:var(--ink)">${st.assists}</b></div></a>`; };
  const groups = POS.concat([""]).map(g => { const ps = act.filter(p => (p.pos || "") === g); if (!ps.length) return ""; return `<div class="lh"><span class="lab">${g ? { GK: "골키퍼", DF: "수비수", MF: "미드필더", FW: "공격수" }[g] : "포지션 미정"}</span><span class="tiny muted">${ps.length}명</span></div>${ps.map(row).join("")}`; }).join("");
  return `<div class="titlebar"><h1 class="title">선수 <span class="num muted" style="font-size:24px">${act.length}</span></h1><span class="btnrow" style="flex:none"><button class="btn" data-act="bulkOpen">명단 붙여넣기</button><a class="btn primary" href="#player-new">+ 추가</a></span></div>
  <div class="hint" style="padding:0 4px">통계는 ${y}년 기준. 회비 표시는 ${Number(m.slice(5))}월 미납이에요. 계정 연결 ${act.filter(p => uidsOf(p.id).length).length} / ${act.length}명 (본인이 링크에서 '나 찾기'를 하면 연결돼요).</div>
  ${reqCard}
  ${act.length ? `<div class="card flat" style="padding-bottom:8px"><div class="list">${groups}</div></div>` : `<div class="card"><div class="empty"><b>등록된 선수가 없어요</b>명단을 붙여 넣거나 위 버튼으로 추가하세요.</div></div>`}
  ${ina.length ? `<div class="card flat"><div class="lh"><span class="lab">휴면 선수</span><button class="linkbtn" data-act="toggleInactive">${ui.showInactive ? "접기" : ina.length + "명 보기"}</button></div>${ui.showInactive ? `<div class="list">${ina.map(row).join("")}</div>` : ""}</div>` : ""}`;
}
function viewPlayerEdit(id) {
  const isNew = id === "new"; const p = isNew ? { id: ui.newPid || (ui.newPid = uid()), name: "", num: "", pos: "", phone: "", active: true } : playerById(id);
  if (!p) return `${backbar("#players", "", "선수 정보")}<div class="card"><div class="empty"><b>선수를 찾을 수 없어요</b>삭제되었을 수 있어요.</div></div>`;
  if (!ui.pe || ui.pe.id !== p.id) ui.pe = { id: p.id, p1: p.pos1 || "", p2: p.pos2 || "" };
  const y = String(new Date().getFullYear()); const st = playerStats(p.id, y); const linked = isNew ? [] : uidsOf(p.id);
  const m = thisMonth(); const months = [-5, -4, -3, -2, -1, 0].map(k => shiftMonth(m, k)); const uf = S.fines.filter(f => f.pid === p.id && !f.paid);
  return `${backbar("#players", isNew ? "선수 추가" : "선수 정보", isNew ? "새 선수" : esc(p.name))}
  ${isNew ? "" : `<section class="card" style="flex-direction:row;align-items:center;gap:12px"><span class="kit ${isGk(p) ? "gk" : ""}" style="width:56px;height:56px;border-radius:18px;font-size:30px">${esc(p.num || "")}</span><div class="grow tiles3"><div><div class="num" style="font-size:24px">${st.apps}</div><div class="tiny muted">출석</div></div><div><div class="num" style="font-size:24px">${st.goals}</div><div class="tiny muted">골</div></div><div><div class="num" style="font-size:24px">${st.assists}</div><div class="tiny muted">도움</div></div></div></section>
  <section class="card" style="gap:6px"><span class="lab">회비와 벌금</span><div class="chips">${months.map(mm => { const s = duesState(mm, p.id); return `<span class="chip ${s === "paid" ? "" : s === "exempt" ? "line" : "soft"}">${Number(mm.slice(5))}월 ${s === "paid" ? "납부" : s === "exempt" ? "면제" : "미납"}</span>`; }).join("")}</div>${uf.length ? `<div class="small">미납 벌금 ${uf.length}건, ${won(uf.reduce((s, f) => s + (Number(f.amount) || 0), 0))}</div>` : ""}</section>`}
  <form class="card" id="pf" data-pid="${esc(p.id)}" data-new="${isNew ? 1 : ""}" style="gap:12px">
    <div class="grid2" style="grid-template-columns:2fr 1fr"><label class="field" style="margin:0">이름<input name="name" required maxlength="20" value="${esc(p.name)}"></label><label class="field" style="margin:0">등번호<input name="num" inputmode="numeric" maxlength="3" value="${esc(p.num ?? "")}"></label></div>
    <div class="field" style="margin:0">주 포지션${posPicker("p1", ui.pe.p1, ui.pe.p2, "pePos")}</div>
    <div class="field" style="margin:0">부 포지션${posPicker("p2", ui.pe.p2, ui.pe.p1, "pePos")}</div>
    <label class="field" style="margin:0">연락처 (선택, 운영진만 볼 수 있음)<input name="phone" inputmode="tel" value="${esc(p.phone || "")}"></label>
    <button type="button" class="switch" role="switch" aria-checked="${p.active === false}" data-act="peRest"><span class="grow"><span style="display:block;font-size:14px;font-weight:700">휴면 선수</span><span class="tiny muted">켜면 참석 투표와 회비 목록에서 빠져요</span></span><span class="tr" aria-hidden="true"><i></i></span></button>
    <div class="btnrow">${isNew ? "" : `<button type="button" class="btn" data-act="peDel" data-id="${esc(p.id)}" style="flex:0 0 auto">삭제</button>`}<button class="btn primary big" type="submit" style="flex:1">${isNew ? "추가" : "저장"}</button></div>
  </form>
  ${linked.length ? linked.map(u => `<section class="card" style="flex-direction:row;align-items:center;gap:10px"><div class="grow"><div style="font-size:14px;font-weight:700">Claude 계정 연결됨</div><div class="tiny muted"><span data-uid="${esc(u)}" data-fallback="팀원">팀원</span> 님이 나 찾기에서 골랐어요</div></div><button class="btn muted" data-act="unlink" data-u="${esc(u)}">연결 해제</button></section>`).join("") : isNew ? "" : `<div class="hint" style="padding:0 4px">아직 계정과 연결되지 않았어요. 본인이 링크에서 '나 찾기'로 고르면 연결돼요.</div>`}`;
}

/* ---------- 회비와 벌금 (운영진) ---------- */
function viewOpMoney() {
  const reqs = pendingReqs(); if (!["req", "dues", "fines"].includes(ui.moneyTab)) ui.moneyTab = "dues";
  const tabs = `<div class="titlebar"><h1 class="title">회비와 벌금</h1>${ui.moneyTab === "fines" ? `<button class="btn primary" data-act="newFine">+ 벌금 추가</button>` : ""}</div><div class="seg" role="group" aria-label="회비와 벌금"><button data-act="moneyTab" data-v="req" aria-pressed="${ui.moneyTab === "req"}">확인 요청${reqs.length ? " " + reqs.length : ""}</button><button data-act="moneyTab" data-v="dues" aria-pressed="${ui.moneyTab === "dues"}">월 회비</button><button data-act="moneyTab" data-v="fines" aria-pressed="${ui.moneyTab === "fines"}">벌금</button></div>`;
  if (ui.moneyTab === "fines") return tabs + viewFines();
  if (ui.moneyTab === "req") return tabs + `<section class="card"><span class="lab">팀원이 '입금했어요'를 누른 내역</span>
    ${reqs.length ? reqs.map(r => `<div class="stack" style="gap:8px;padding:10px 0;border-top:1px solid var(--line3)"><div class="row"><div class="grow"><b>${esc(pname(r.pid))}</b> <span class="small muted">${esc(r.label || "")}</span><div class="tiny muted">${esc(fmtStamp(r.at))}에 입금했어요</div></div><span class="num" style="font-size:20px">${(Number(r.amount) || 0).toLocaleString("ko-KR")}</span></div><div class="btnrow"><button class="btn" data-act="payNo" data-u="${esc(r.u)}" data-k="${esc(r.key)}">아직 안 들어왔어요</button><button class="btn primary" data-act="payOk" data-u="${esc(r.u)}" data-k="${esc(r.key)}">입금 확인</button></div></div>`).join("") : `<div class="empty"><b>확인할 요청이 없어요</b>팀원이 내 회비에서 '입금했어요'를 누르면 여기에 모여요.</div>`}</section>
    <section class="card" style="flex-direction:row;align-items:center;gap:10px"><div class="grow"><div class="tiny muted">팀원에게 보이는 계좌</div><div style="font-weight:700;word-break:break-all">${esc(S.settings.account || "아직 없음")}</div></div><a class="btn" href="#config">설정에서 바꾸기</a></section>`;
  const m = ui.month; const act = activePlayers(); const payable = act.filter(p => duesState(m, p.id) !== "exempt"); const paid = payable.filter(p => duesState(m, p.id) === "paid");
  const fee = Number(S.settings.fee) || 0; const unpaidN = payable.length - paid.length;
  return tabs + `<section class="card hot"><div class="monthnav"><button data-act="month" data-d="-1" aria-label="이전 달">&lsaquo;</button><span class="t">${fmtMonth(m)}</span><button data-act="month" data-d="1" aria-label="다음 달">&rsaquo;</button></div>
    <div class="tiles3"><div><div class="big" style="font-size:34px">${paid.length}</div><div class="tiny muted">납부</div></div><div><div class="big" style="font-size:34px;color:var(--clay)">${unpaidN}</div><div class="tiny muted">미납</div></div><div><div class="big" style="font-size:34px">${(paid.length * fee / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}</div><div class="tiny muted">모인 돈 (만 원)</div></div></div>
    <div class="hint">1인 회비 ${won(fee)}. 버튼을 누를 때마다 미납, 납부, 면제 순서로 바뀌어요. 팀원은 본인 것만 볼 수 있어요.</div>
    ${unpaidN ? `<div class="btnrow"><button class="btn" data-act="shareDues">미납자 알림 문구</button><button class="btn" data-act="allPaid">미납 ${unpaidN}명 모두 납부</button></div>` : ""}</section>
  <div class="card flat">${act.length ? `<div class="list">${act.map(p => { const s = duesState(m, p.id); return `<div class="li"><span class="kit ${isGk(p) ? "gk" : ""}">${esc(p.num ?? "")}</span><b class="grow">${esc(p.name)}</b><button class="duebtn" data-act="cycleDue" data-pid="${p.id}" data-s="${s}" aria-label="${esc(p.name)}, 지금 ${s === "paid" ? "납부" : s === "exempt" ? "면제" : "미납"}, 눌러서 바꾸기">${s === "paid" ? "납부" : s === "exempt" ? "면제" : "미납"}</button></div>`; }).join("")}</div>` : `<div class="empty"><b>등록된 선수가 없어요</b></div>`}</div>`;
}
function viewFines() {
  const unpaid = unpaidFines(); const sumU = unpaid.reduce((s, f) => s + (Number(f.amount) || 0), 0); const paidSum = S.fines.filter(f => f.paid).reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const list = (ui.fineFilter === "unpaid" ? unpaid : S.fines).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const per = {}; unpaid.forEach(f => { per[f.pid] = (per[f.pid] || 0) + (Number(f.amount) || 0); });
  return `<section class="card hot"><div class="grid2"><div><div class="tiny muted">미납</div><div class="big" style="font-size:34px;color:var(--clay)">${sumU.toLocaleString("ko-KR")}<span style="font-family:var(--f-body);font-size:13px;font-weight:600">원</span></div></div><div><div class="tiny muted">납부 완료</div><div class="big" style="font-size:34px">${paidSum.toLocaleString("ko-KR")}<span style="font-family:var(--f-body);font-size:13px;font-weight:600">원</span></div></div></div>
    ${Object.keys(per).length ? `<div class="chips">${Object.entries(per).sort((a, b) => b[1] - a[1]).map(([pid, v]) => `<span class="chip soft">${esc(pname(pid))} ${won(v)}</span>`).join("")}</div>` : ""}</section>
  <div class="seg" role="group" aria-label="벌금 보기"><button data-act="fineFilter" data-v="unpaid" aria-pressed="${ui.fineFilter === "unpaid"}">미납 ${unpaid.length}</button><button data-act="fineFilter" data-v="all" aria-pressed="${ui.fineFilter === "all"}">전체 ${S.fines.length}</button></div>
  <div class="card flat">${list.length ? `<div class="list">${list.map(f => `<div class="li" style="min-height:56px"><button class="grow" data-act="editFine" data-id="${f.id}" style="background:none;border:0;padding:0;text-align:left;min-width:0;color:var(--ink)"><div class="ell"><b>${esc(pname(f.pid))}</b> <span class="muted">${esc(f.reason || "")}</span></div><div class="tiny muted">${esc(f.date || "")}</div></button><span class="num" style="font-size:18px">${(Number(f.amount) || 0).toLocaleString("ko-KR")}</span><button class="duebtn" data-act="toggleFine" data-id="${f.id}" data-s="${f.paid ? "paid" : ""}" style="min-width:58px">${f.paid ? "납부" : "미납"}</button></div>`).join("")}</div>` : `<div class="empty"><b>${ui.fineFilter === "unpaid" ? "미납 벌금이 없어요" : "벌금 기록이 없어요"}</b>현장 출석에서 지각, 결석, 직전 취소를 체크하면 바로 부과할 수 있어요.</div>`}</div>
  <div class="hint" style="padding:0 4px">벌금은 현장 출석에서 자동으로 붙어요. 종류와 금액은 설정에서 바꿔요.</div>`;
}

/* ---------- 설정 ---------- */
function viewConfig() {
  const s = S.settings; const real = Store.real || {};
  const roleCard = Store.mode === "db" ? `<section class="card" style="gap:10px"><div class="labrow"><span class="lab">권한</span><span class="chip ${Store.canWrite ? "clay" : ""}">나는 ${ROLE_KO[Store.role] || ""}</span></div>
    <div class="acct"><div style="font-weight:700">운영진 <span class="tiny muted" style="font-weight:600">Claude 공유에서 편집 가능</span></div><div class="small muted">일정, 현장 출석, 라인업, 기록, 회비, 벌금, 선수, 공지를 관리해요.</div></div>
    <div class="acct"><div style="font-weight:700">팀원 <span class="tiny muted" style="font-weight:600">Claude 공유에서 사용 가능</span></div><div class="small muted">본인 참석만 투표하고, 회비와 벌금은 본인 것만 봐요. 선수 탭은 안 보여요.</div></div>
    ${real.canWrite && !Store.preview ? `<button class="btn block" data-act="previewMember">팀원 화면으로 보기</button>` : ""}
    <div class="hint o">권한은 이 링크의 공유 메뉴에서 사람마다 정해요. 팀원은 모두 '사용 가능'으로 공유해 주세요. 권한 없이 링크만 받은 사람은 '권한 대기'로 보이고 투표는 못 해요. 초기화, 예시 데이터, 백업 복원은 링크 소유자만 할 수 있어요.</div></section>` : "";
  const me = myPid() ? `<section class="card" style="flex-direction:row;align-items:center;gap:10px"><div class="grow"><span class="lab">내 선수</span><div><b>${esc(pname(myPid()))}</b> 선수로 연결돼 있어요.</div></div><button class="btn" data-act="unclaim">연결 해제</button></section>` : "";
  const view = `<section class="card"><button class="switch" role="switch" aria-checked="${!!prefs().big}" data-act="toggleBig"><span class="grow" style="font-size:14px;font-weight:700">큰 글씨로 보기</span><span class="tr" aria-hidden="true"><i></i></span></button></section>`;
  if (!Store.canWrite) return `${backbar("#home", "", "설정")}${roleCard}${me}${view}`;
  return `${backbar("#home", "", "설정")}${roleCard}${me}
  <form class="card" id="cfgForm" style="gap:12px"><span class="lab">팀 정보와 규칙</span>
    <label class="field" style="margin:0">팀 이름<input name="teamName" value="${esc(s.teamName)}" placeholder="예: KEI FC" maxlength="30"></label>
    <div class="grid2"><label class="field" style="margin:0">참석 정원<input name="cap" inputmode="numeric" value="${esc(s.cap)}"></label><label class="field" style="margin:0">출석 체크 (분 전)<input name="checkBefore" inputmode="numeric" value="${esc(s.checkBefore)}"></label>
      <label class="field" style="margin:0">직전 취소 (시간 전)<input name="lateCancelH" inputmode="numeric" value="${esc(s.lateCancelH)}"></label><label class="field" style="margin:0">월 회비 (원)<input name="fee" inputmode="numeric" value="${esc(s.fee)}"></label>
      <label class="field" style="margin:0">게스트비 (원)<input name="guestFee" inputmode="numeric" value="${esc(s.guestFee ?? 0)}"></label></div>
    <label class="field" style="margin:0">팀 계좌 (팀원 화면에 보여요)<input name="account" value="${esc(s.account)}" placeholder="예: 은행명 계좌번호 (예금주)" maxlength="60"></label>
    <label class="field" style="margin:0">팀원에게 보낼 링크 (공유 문구에 들어가요)<input name="shareLink" value="${esc(s.shareLink)}" placeholder="공유 메뉴에서 복사한 이 앱의 링크" maxlength="200"></label>
    <div class="field" style="margin:0">벌금 종류<span class="h">'지각', '불참', '직전 취소'라는 말이 들어가면 현장 출석에서 자동으로 붙어요</span></div>
    <div id="presetRows">${s.finePresets.map(p => presetRow(p)).join("")}</div>
    <button type="button" class="btn" data-act="addPreset" style="align-self:flex-start">+ 벌금 종류 추가</button>
    <button class="btn primary big" type="submit">저장</button></form>
  ${view}
  <section class="card"><span class="lab">백업</span><div class="small muted">${Store.mode === "db" ? "데이터는 이 링크에 저장돼 운영진과 팀원 모두에게 이어져요. 가끔 백업 파일을 받아 두세요." : "지금은 이 기기의 브라우저에만 저장돼요. 백업 파일을 꼭 받아 두세요."}</div>
    <div class="btnrow"><button class="btn" data-act="exportData" ${Store.dl ? "" : "disabled"}>백업 파일 받기</button><label class="btn o" for="importFile" style="cursor:pointer">백업에서 복원</label></div><input type="file" id="importFile" accept="application/json,.json" hidden></section>
  <section class="card o"><span class="lab">초기화</span><div class="small muted">선수, 일정, 회비, 벌금 기록을 모두 지워요. 되돌릴 수 없고, 링크 소유자만 할 수 있어요.</div><button class="btn dark block" data-act="resetAll">모든 데이터 지우기</button></section>`;
}
function presetRow(p) { return `<div class="presets" data-pid="${esc(p.id)}"><input class="inp" aria-label="벌금 이름" name="pl" value="${esc(p.label)}" placeholder="벌금 이름"><input class="inp" aria-label="금액" name="pa" inputmode="numeric" value="${esc(p.amount)}" placeholder="금액"><button type="button" class="iconbtn" data-act="delPreset" aria-label="삭제" style="width:40px;height:40px;border-radius:12px">&times;</button></div>`; }
