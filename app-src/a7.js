
/* ---------- 게스트 (운영진 참석 탭) ---------- */
function guestCard(e) {
  const pend = guestReqs().filter(g => g.eid === e.id); const gs = guestsOf(e); const c = attCounts(e);
  const full = c.capAll !== Infinity && c.all >= c.capAll;
  if (!pend.length && !gs.length && started(e)) return "";
  return `<section class="card"><div class="labrow"><span class="lab">게스트</span><span class="hint">정원에 포함, 게스트비 ${won(S.settings.guestFee || 0)}</span></div>
    ${pend.map(g => `<div class="row" style="min-height:52px;border-top:1px solid var(--line3)"><div class="grow"><b>${esc(g.name)}</b> <span class="chip soft">${esc(g.pos || "")}</span><div class="tiny muted">${esc(g.pid ? pname(g.pid) + " 초대" : "")}${g.at ? ", " + esc(fmtStamp(g.at)) : ""}</div></div><button class="btn" data-act="guestNo" data-u="${esc(g.u)}" data-k="${esc(g.key)}">거절</button><button class="btn primary" data-act="guestOk" data-u="${esc(g.u)}" data-k="${esc(g.key)}" ${full ? "disabled" : ""}>승인</button></div>`).join("")}
    ${full && pend.length ? `<div class="status">정원이 찼어요. 더 받으려면 누군가 빠져야 해요.</div>` : ""}
    ${gs.map(g => `<div class="row" style="min-height:44px;border-top:1px solid var(--line3)"><div class="grow"><b>${esc(g.name)}</b> <span class="tiny muted">${esc(g.pos || "")}${g.pid ? ", " + esc(pname(g.pid)) + " 초대" : ""}</span></div><span class="chip clay">확정</span><button class="btn muted" data-act="guestRemove" data-gid="${esc(g.id)}" aria-label="${esc(g.name)} 게스트 빼기">빼기</button></div>`).join("")}
    ${started(e) ? "" : `<button class="btn block" data-act="guestOpen" data-eid="${e.id}">+ 게스트 추가</button>`}</section>`;
}
function guestSheet(e) {
  let pos = "MF";
  const op = isOpView();
  openSheet(op ? "게스트 추가" : "친구 데려오기", `<form id="gf"><div class="hint" style="margin-bottom:10px">${esc(fmtDate(e.date))} ${esc(evTitle(e))}. 게스트는 정원에 포함되고, 게스트비 ${won(S.settings.guestFee || 0)}은 데려온 사람에게 붙어요.${op ? " 운영진이 추가하면 바로 확정돼요." : " 운영진이 승인하면 확정돼요."}</div>
    <label class="field">이름<input name="name" required maxlength="20" placeholder="예: 최민준"></label>
    <div class="field">주로 뛰는 자리<div class="pick c4" id="gpos">${["GK", "DF", "MF", "FW"].map(p => `<button type="button" data-v="${p}" aria-pressed="${p === pos}">${p}</button>`).join("")}</div></div>
    <div class="btnrow"><button type="button" class="btn" data-act="closeSheet">취소</button><button class="btn primary" type="submit">${op ? "추가" : "운영진에게 요청"}</button></div></form>`, sh => {
    $("#gpos", sh).onclick = ev => { const b = ev.target.closest("button"); if (!b) return; pos = b.dataset.v; sh.querySelectorAll("#gpos button").forEach(x => x.setAttribute("aria-pressed", x.dataset.v === pos)); };
    $("#gf", sh).addEventListener("submit", ev => {
      ev.preventDefault(); const name = ev.target.elements["name"].value.trim(); if (!name) return;
      if (Store.preview) { toast("미리보기 화면이라 저장되지 않아요"); return; }
      const gid = uid(); const pid = myPid() || "";
      if (op) {
        const c = attCounts(e); if (c.capAll !== Infinity && c.all >= c.capAll) { toast("정원이 찼어요"); return; }
        evPatch(e.id, { guests: { [gid]: { name, pos, pid, at: nowIso() } } });
        if (pid && Number(S.settings.guestFee) > 0) setDoc("fines/" + gid, { id: gid, pid, date: e.date, reason: `게스트비 (${name})`, amount: Number(S.settings.guestFee) || 0, paid: false, presetId: "guest", eventId: e.id, by: Store.me || "" });
        closeSheet(); render(); scheduleSync(); toast(`${name} 게스트를 추가했어요`);
      } else {
        patchDoc("guestreq/" + Store.me, { items: { [gid]: { eid: e.id, name, pos, pid, at: nowIso(), status: "req" } } });
        closeSheet(); render(); toast("요청했어요. 승인되면 알림함에 떠요");
      }
    });
  });
}

/* ---------- 공지와 설문 ---------- */
function relTime(iso) {
  const t = Date.parse(iso); if (!t) return "";
  const d = (Date.now() - t) / 60000; if (d < 0) { const dd = new Date(t); return `${dd.getMonth() + 1}월 ${dd.getDate()}일`; }
  if (d < 2) return "방금"; if (d < 60) return Math.round(d) + "분 전"; if (d < 1440) return Math.round(d / 60) + "시간 전"; if (d < 2880) return "어제";
  const dd = new Date(t); return `${dd.getMonth() + 1}월 ${dd.getDate()}일`;
}
function viewNotice() {
  const op = isOpView(); const N = activePlayers().length; const uv = myUvote();
  const list = S.notices; const head = list.slice(0, 6), old = list.slice(6);
  const card = n => {
    const meta = `<div class="row" style="gap:8px">${n.pinned ? `<span class="chip ink">고정 공지</span>` : ""}<span class="tiny muted">운영진, ${esc(relTime(n.at))}</span><span class="grow"></span>${op ? `<button class="btn muted" data-act="noticeEdit" data-id="${esc(n.id)}" style="min-height:32px">수정</button>` : ""}</div>`;
    if (!n.poll || !(n.poll.opts || []).length) return `<article class="card" style="padding:16px">${meta}<h2 style="margin:0;font-size:17px;font-weight:700">${esc(n.title)}</h2>${n.body ? `<p class="small" style="margin:0;color:var(--ink2);white-space:pre-wrap">${esc(n.body)}</p>` : ""}${op ? `<div class="tiny muted">읽음 ${seenCount(n)} / ${N}명</div>` : ""}</article>`;
    const open = pollOpen(n); const t = pollTally(n); const mine = (uv.poll || {})[n.id]; const showRes = op || !!mine || !open;
    const max = Math.max(1, ...Object.values(t.c));
    const until = n.poll.until ? new Date(Date.parse(n.poll.until)) : null;
    return `<section class="card hot" style="gap:10px">${meta}<div class="labrow"><span class="chip soft">${open ? `설문${until ? `, ${until.getMonth() + 1}/${until.getDate()} ${pad(until.getHours())}:${pad(until.getMinutes())} 마감` : ""}` : "설문 마감"}</span><span class="tiny muted">${t.n}명 응답</span></div>
      <h2 class="hl" style="margin:0;font-size:20px">${esc(n.title)}</h2>${n.body ? `<p class="small" style="margin:0;color:var(--ink2);white-space:pre-wrap">${esc(n.body)}</p>` : ""}
      <div class="stack" style="gap:8px" role="radiogroup" aria-label="${esc(n.title)}">${n.poll.opts.map(o => { const cnt = t.c[o.id] || 0; const w = showRes && t.n ? Math.round(cnt / t.n * 100) : 0;
        return `<div><button class="opt" role="radio" aria-checked="${mine === o.id}" data-act="pollVote" data-nid="${esc(n.id)}" data-opt="${esc(o.id)}" ${open && !Store.preview && (Store.canVote || op) ? "" : "disabled"}><i class="${cnt === max && cnt ? "top" : ""}" style="width:${w}%"></i><span><b>${esc(o.label)}</b>${showRes ? `<span class="num" style="font-size:19px">${cnt}명</span>` : ""}</span></button>${op && cnt ? `<div class="tiny muted" style="padding:2px 4px">${esc(pollVoters(n, o.id).join(", "))}</div>` : ""}</div>`; }).join("")}</div>
      <div class="small muted" role="status">${!open ? "마감된 설문이에요." : mine ? "투표했어요. 마감 전까지 다시 눌러 바꿀 수 있어요." : "하나를 눌러 투표하세요. 누가 어디에 투표했는지는 운영진만 봐요."}</div>${op ? `<div class="tiny muted">읽음 ${seenCount(n)} / ${N}명</div>` : ""}</section>`;
  };
  return `${backbar("#home", "", "공지와 설문", op ? `<button class="btn primary" data-act="noticeNew">+ 공지 쓰기</button>` : "")}
  ${list.length ? head.map(card).join("") : `<div class="card"><div class="empty"><b>아직 공지가 없어요</b>${op ? "회식 날짜, 유니폼 사이즈 같은 걸 단톡방 대신 여기서 모아 보세요." : "운영진이 공지를 올리면 여기에 보여요."}</div></div>`}
  ${old.length ? `<section class="rule"><span class="lab">지난 공지</span>${old.map(n => `<div class="plain" style="flex-direction:column;align-items:flex-start;gap:0"><b style="font-weight:600">${esc(n.title)}</b><span class="tiny muted">${n.poll ? "설문, " : ""}${esc(relTime(n.at))}</span></div>`).join("")}</section>` : ""}`;
}
function noticeSheet(n) {
  const isNew = !n; n = n || { id: uid(), title: "", body: "", pinned: false, poll: null };
  const hasPoll = !!(n.poll && (n.poll.opts || []).length);
  const d = new Date(Date.now() + 2 * 864e5); const untilDef = n.poll && n.poll.until ? n.poll.until.slice(0, 16) : `${ymd(d)}T23:59`;
  openSheet(isNew ? "공지 쓰기" : "공지 수정", `<form id="nf">
    <label class="field">제목<input name="title" required maxlength="60" value="${esc(n.title)}" placeholder="예: 12월 회식 언제가 좋아요?"></label>
    <label class="field">내용 (선택)<textarea name="body" maxlength="600">${esc(n.body || "")}</textarea></label>
    <label class="cbox" style="border:0"><input type="checkbox" name="pinned" ${n.pinned ? "checked" : ""}><span>맨 위에 고정</span></label>
    <label class="cbox" style="border:0"><input type="checkbox" name="poll" id="nPoll" ${hasPoll ? "checked" : ""}><span>설문으로 만들기</span></label>
    <div id="pollBox" ${hasPoll ? "" : "hidden"}><label class="field">보기 (한 줄에 하나)<textarea name="opts" placeholder="12월 12일 (토) 저녁&#10;12월 13일 (일) 점심">${esc(hasPoll ? n.poll.opts.map(o => o.label).join("\n") : "")}</textarea></label>
      <label class="field">마감<input type="datetime-local" name="until" value="${esc(untilDef)}"></label></div>
    <div class="btnrow">${isNew ? `<button type="button" class="btn" data-act="closeSheet">취소</button>` : `<button type="button" class="btn" id="nDel">삭제</button>`}<button class="btn primary" type="submit">${isNew ? "올리기" : "저장"}</button></div></form>`, sh => {
    $("#nPoll", sh).onchange = ev => { $("#pollBox", sh).hidden = !ev.target.checked; };
    $("#nf", sh).addEventListener("submit", ev => {
      ev.preventDefault(); const f = ev.target; const title = f.elements["title"].value.trim(); if (!title) return;
      let poll = null;
      if (f.elements["poll"].checked) {
        const labels = f.elements["opts"].value.split("\n").map(x => x.trim()).filter(Boolean).slice(0, 8);
        if (labels.length < 2) { toast("보기를 두 개 이상 적어 주세요"); return; }
        const old = (n.poll && n.poll.opts) || [];
        poll = { opts: labels.map((l, i) => ({ id: (old.find(o => o.label === l) || {}).id || "o" + uid().slice(-5) + i, label: l })), until: f.elements["until"].value || "" };
      }
      setDoc("notices/" + n.id, { id: n.id, title, body: f.elements["body"].value.trim(), pinned: f.elements["pinned"].checked, poll, at: n.at || nowIso(), by: n.by || Store.me || "" });
      closeSheet(); if (currentView() !== "notice") location.hash = "notice"; else render(); toast(isNew ? "공지를 올렸어요. 팀원 홈 맨 위에 보여요" : "저장했어요");
    });
    const del = $("#nDel", sh); if (del) del.onclick = () => confirmSheet("공지 삭제", "이 공지와 설문 결과를 지울까요?", "삭제", () => { delDoc("notices/" + n.id); render(); toast("삭제했어요"); });
  });
}

/* ---------- 알림함 ---------- */
function viewInbox() {
  const items = inboxItems(); const off = prefs().inboxOff || {};
  const cats = [["vote", "투표 마감 전 알림"], ["line", "라인업, MOM"], ["money", "내 벌금과 회비"], ["notice", "공지와 설문"]];
  return `${backbar("#home", "", "알림함", `<button class="btn" data-act="inboxRead">모두 읽음</button>`)}
  ${items.length ? `<div class="card" style="padding:0;overflow:hidden;gap:0">${items.map(i => `<a class="ibx ${i.unread ? "unread" : ""}" href="${esc(i.href)}" style="text-decoration:none;color:var(--ink)"><span class="ic ${i.ic}" aria-hidden="true">${esc(i.tag)}</span><div class="grow"><div class="row" style="gap:6px;align-items:baseline"><span class="grow" style="font-weight:${i.unread ? 700 : 600};font-size:14px">${esc(i.title)}</span><span class="tiny muted" style="flex:none">${esc(relTime(i.t))}</span></div><div class="small muted">${esc(i.body)}</div></div>${i.unread ? `<span class="dotu" aria-label="안 읽음"></span>` : ""}</a>`).join("")}</div>` : `<div class="card"><div class="empty"><b>새 알림이 없어요</b>투표 마감, 라인업, 벌금, 공지가 생기면 여기에 모여요.</div></div>`}
  <section class="card" style="gap:2px"><span class="lab" style="margin-bottom:4px">어떤 알림을 받을까요</span>${cats.map(([k, l]) => `<button class="switch" role="switch" aria-checked="${!off[k]}" data-act="inboxToggle" data-k="${k}"><span class="grow" style="font-size:14px;font-weight:600">${l}</span><span class="tr" aria-hidden="true"><i></i></span></button>`).join("")}
    <div class="hint" style="margin-top:4px">지금은 앱 안 알림함에 모여요. 웹 버전에서는 휴대폰 알림이나 카카오 알림톡으로도 받을 수 있게 할 수 있어요.</div></section>`;
}

/* ---------- MOM ---------- */
function viewMom(e) {
  const pid = myPid(); const open = momOpen(e); const voted = (myUvote().mom || {})[e.id]; const came = pid && cameTo(e, pid);
  const cands = attendees(e); const t = momTally(e); const showRes = voted || !open || isOpView();
  const score = hasScore(e) ? `, ${isScrim(e) ? `${e.score.us} 대 ${e.score.them}` : `${e.score.us} 대 ${e.score.them} ${{ W: "승", D: "무", L: "패" }[resultOf(e)]}`}` : "";
  const pick = ui.momPick[e.id] || ""; const y = e.date.slice(0, 4); const rank = seasonMomRank(y);
  const results = Object.entries(t.c).sort((a, b) => b[1] - a[1]).slice(0, 3); const max = results.length ? results[0][1] : 1;
  let top;
  if (open && came && !voted && !Store.preview) top = `<div class="note">같이 뛴 사람 중 한 명을 골라 주세요. <b>누가 누구를 뽑았는지는 화면에 나오지 않아요.</b> 내일 정오 마감.</div>
    <div class="pick c2" role="radiogroup" aria-label="MOM 후보">${cands.map(p => { const self = p.id === pid; const on = pick === p.id; return `<button role="radio" aria-checked="${on}" data-act="momPick" data-eid="${e.id}" data-pid="${p.id}" ${self ? "disabled" : ""} style="min-height:56px;border-radius:14px;justify-content:flex-start;display:flex;align-items:center;gap:8px;text-align:left"><span class="kit" style="width:30px;height:30px;border-radius:10px;font-size:16px;${on ? "background:rgba(255,255,255,.2);color:inherit" : ""}">${esc(p.num || "")}</span><span style="min-width:0"><span style="display:block;font-size:15px">${esc(p.name)}</span><span style="display:block;font-size:12px;opacity:.8;font-weight:500">${self ? "나 (고를 수 없음)" : esc(p.pos1 || POS_KO[p.pos] || "")}</span></span></button>`; }).join("")}</div>
    <button class="btn primary big" data-act="momSend" data-eid="${e.id}" ${pick ? "" : "disabled"}>${pick ? esc(pname(pick)) + " 선수에게 투표" : "한 명을 골라 주세요"}</button>`;
  else if (voted) top = `<div class="status" role="status">${esc(pname(voted))} 선수에게 투표했어요. ${open ? "마감 전까지는 바꿀 수 없어요." : ""}</div>`;
  else if (open && pid && !came) top = `<div class="status quiet">이 경기에 출석한 사람만 투표할 수 있어요.</div>`;
  else if (!open) top = `<div class="status quiet">투표가 마감됐어요.</div>`;
  else top = "";
  return `${backbar("#event-" + e.id, `${esc(fmtDate(e.date))} ${esc(evTitle(e))}${esc(score)}`, open ? "오늘의 MOM" : "MOM 결과")}
  ${top}
  ${showRes ? `<section class="card"><span class="lab">${open ? "지금까지 결과" : "최종 결과"} (${t.n}명 투표)</span>${results.length ? results.map(([id, v], i) => `<div class="vbar"><div class="row between" style="font-weight:700"><span>${esc(pname(id))}${!open && i === 0 ? ` <span class="chip clay">MOM</span>` : ""}</span><span class="num" style="font-size:19px">${v}표</span></div><div class="barline r"><span style="width:${Math.round(v / max * 100)}%;background:${i === 0 ? "var(--clay)" : "var(--tan)"}"></span></div></div>`).join("") : `<div class="hint">아직 표가 없어요.</div>`}${isOpView() && open ? `<div class="hint">결과는 운영진 앱이 열려 있을 때 모아서 보여 줘요.</div>` : ""}</section>` : ""}
  <section class="rule"><span class="lab">${esc(y)} 시즌 MOM 순위</span>${rank.length ? rank.map(([id, v], i) => `<div class="rank"><span class="n ${i === 0 ? "top" : ""}">${i + 1}</span><span class="grow" style="font-weight:700">${esc(pname(id))}</span><span class="v">${v}회</span></div>`).join("") : `<div class="hint">아직 MOM이 없어요.</div>`}</section>`;
}

/* ---------- 오늘 할 일 ---------- */
function viewTodo() {
  const n = todoCount(); const parts = [];
  const next = eventsSorted().find(e => !started(e));
  if (next) { const A = effAtt(next); const none = activePlayers().filter(p => !A.s[p.id]);
    if (none.length) parts.push(`<section class="card hot"><div class="labrow"><span class="lab">${esc(bigDate(next, true))} ${esc(evTitle(next))} 투표</span><span class="chip soft">${esc(relTime(eventStart(next).toISOString()).replace("전", "후")) || "곧"} 마감</span></div>
      <div class="row" style="align-items:baseline;gap:8px"><span class="big" style="font-size:52px;color:var(--clay)">${none.length}</span><span class="hl" style="font-size:20px">명이 아직 답이 없어요</span></div>
      <div class="small muted">${none.map(p => esc(p.name)).join(", ")}</div><button class="btn primary block" data-act="shareNudge" data-id="${next.id}">${none.length}명에게 보낼 알림 문구</button></section>`); }
  const reqs = pendingReqs();
  if (reqs.length) parts.push(`<section class="card" style="gap:4px"><span class="lab" style="margin-bottom:4px">입금했다는 요청 ${reqs.length}건</span>${reqs.map(r => `<div class="row" style="min-height:52px;border-bottom:1px solid var(--line3)"><div class="grow"><b>${esc(pname(r.pid))}</b><div class="tiny muted">${esc(r.label || "")}</div></div><span class="num" style="font-size:19px">${(Number(r.amount) || 0).toLocaleString("ko-KR")}</span><button class="btn dark" data-act="payOk" data-u="${esc(r.u)}" data-k="${esc(r.key)}">확인</button></div>`).join("")}</section>`);
  const gq = guestReqs();
  if (gq.length) parts.push(`<section class="card" style="gap:4px"><span class="lab" style="margin-bottom:4px">게스트 요청 ${gq.length}건</span>${gq.map(g => { const e = S.events[g.eid]; return `<div class="row" style="min-height:52px;border-bottom:1px solid var(--line3)"><div class="grow"><b>${esc(g.name)}</b> <span class="chip soft">${esc(g.pos || "")}</span><div class="tiny muted">${esc(shortDate(e))} ${esc(evTitle(e))}, ${esc(pname(g.pid))} 초대</div></div><button class="btn" data-act="guestNo" data-u="${esc(g.u)}" data-k="${esc(g.key)}">거절</button><button class="btn primary" data-act="guestOk" data-u="${esc(g.u)}" data-k="${esc(g.key)}">승인</button></div>`; }).join("")}</section>`);
  const regs = Object.keys(S.rsvp).filter(u => S.rsvp[u].reqName && !claimOf(u)).length + posReqUids().length;
  if (regs) parts.push(`<a class="card" href="#players" style="flex-direction:row;align-items:center"><span class="grow"><span class="lab">선수 요청 ${regs}건</span><div class="small muted">등록 요청이나 포지션 변경 요청을 확인해 주세요.</div></span>${ICON.chev}</a>`);
  feeEvents().forEach(e => { const F = feeSplit(e);
    parts.push(`<section class="rule"><span class="lab">${esc(shortDate(e))} ${esc(evTitle(e))} 구장비 정산</span><div class="tiles3"><div class="tile"><div class="big" style="font-size:24px">${F.fee.toLocaleString("ko-KR")}</div><div class="k">구장비</div></div><div class="tile"><div class="big" style="font-size:24px">${F.ppl.length}명</div><div class="k">${started(e) && checkStarted(e) ? "출석" : "참석 확정"}</div></div><div class="tile" style="background:var(--clay-s);border-color:var(--clay-s);color:var(--clay-d)"><div class="big" style="font-size:24px">${F.per.toLocaleString("ko-KR")}</div><div class="k" style="color:inherit">1인당</div></div></div>
      <button class="btn block" data-act="feeCharge" data-eid="${e.id}">${F.ppl.length}명에게 ${won(F.per)}씩 청구하기</button><div class="hint">청구하면 각자 내 회비 화면에 '구장비'로 보여요. 100원 단위로 올려 나눠요.</div></section>`); });
  const w = watchList();
  if (w.length) parts.push(`<section class="card" style="gap:6px"><span class="lab">신경 써 볼 사람</span>${w.map(x => `<a class="row" href="#player-${x.p.id}" style="min-height:40px;text-decoration:none;color:inherit"><b class="grow">${esc(x.p.name)}</b><span class="small muted">${esc(x.why)}</span></a>`).join("")}<div class="tiny muted">운영진만 보는 목록이에요.</div></section>`);
  return `${backbar("#home", "운영진", `오늘 할 일 ${n}개`)}${parts.length ? parts.join("") : `<div class="card"><div class="empty"><b>오늘 처리할 일이 없어요</b>미응답, 입금 확인, 게스트 요청, 구장비 정산이 생기면 여기에 모여요.</div></div>`}
  <div class="hint" style="padding:0 4px">구장비는 일정 올리기나 수정에서 금액을 넣으면 여기에 정산 카드가 생겨요.</div>`;
}

/* ---------- 팀 나누기 ---------- */
// 새 내전: 참석 확정 인원 중에서 운영진이 한 명씩 조끼팀, 일반팀을 고른다
function viewSquad(e) {
  const op = isOpView(); const conf = roster(e).confirmed; const T = teamsOf(e); const t = T.t;
  const A = conf.filter(p => t[p.id] === "A"), B = conf.filter(p => t[p.id] === "B"), O = conf.filter(p => !t[p.id]);
  const lock = !op || T.saved;
  const row = p => { const s = t[p.id] || ""; const late = availFrom(e, p.id) > 1 ? `, ${availFrom(e, p.id)}Q부터` : "";
    return `<div class="mrow"><div class="grow"><div class="nm">${esc(p.name)}</div><div class="tiny muted">${esc([p.pos1, p.pos2].filter(Boolean).join("/") || p.pos || "")}${esc(late)}</div></div>
      ${lock ? `<span class="chip${s === "A" ? " clay" : ""}">${s === "A" ? "조끼팀" : s === "B" ? "일반팀" : "빠짐"}</span>` : `<div class="seg pick" role="group" aria-label="${esc(p.name)} 팀" style="flex:none"><button data-act="teamSet" data-eid="${e.id}" data-pid="${p.id}" data-v="A" aria-pressed="${s === "A"}">조끼</button><button data-act="teamSet" data-eid="${e.id}" data-pid="${p.id}" data-v="B" aria-pressed="${s === "B"}">일반</button></div>`}</div>`; };
  const group = (title, arr, cls) => arr.length ? `<section class="card" style="gap:2px"><div class="labrow"><span class="lab"${cls ? ` style="color:var(--clay)"` : ""}>${title}</span><span class="num" style="font-size:18px">${arr.length}명</span></div>${arr.map(row).join("")}</section>` : "";
  const gk = arr => arr.some(p => isGk(p) || p.pos2 === "GK");
  const warn = A.length && B.length && conf.filter(p => isGk(p) || p.pos2 === "GK").length >= 2 && (!gk(A) || !gk(B)) ? `${gk(A) ? "일반팀" : "조끼팀"}에 골키퍼가 없어요.` : "";
  return `${backbar("#event-" + e.id, `${esc(bigDate(e, true))} ${esc(evTitle(e))}, 참석 확정 ${conf.length}명`, "스쿼드 고르기", op && !T.saved && (A.length || B.length) ? `<button class="btn" data-act="teamClear" data-eid="${e.id}">비우기</button>` : "")}
  ${!conf.length ? `<div class="card"><div class="empty"><b>참석 확정 인원이 없어요</b>참석 투표가 들어오면 여기서 한 명씩 팀을 고를 수 있어요.</div></div>` : `
  ${op && !T.saved ? `<div class="small muted" style="padding:0 4px">참석 확정 인원 중에서 한 명씩 <b>조끼</b> 또는 <b>일반</b>을 누르세요. 한 번 더 누르면 빠져요. 고르지 않은 사람은 오늘 스쿼드에 들어가지 않아요.</div>` : ""}
  <div class="small" style="padding:0 4px"><b style="color:var(--clay)">조끼팀 ${A.length}명</b>, <b>일반팀 ${B.length}명</b>${O.length ? `, 안 고른 사람 ${O.length}명` : ""}</div>
  ${warn && !T.saved ? `<div class="status" role="status">${esc(warn)}</div>` : ""}
  ${group("안 고른 사람", O)}${group("조끼팀", A, true)}${group("일반팀", B)}
  ${op ? (T.saved
    ? `<section class="card"><div role="status" style="font-weight:700;color:var(--clay)">확정했어요. 팀원 일정 화면에 바로 보여요.</div><a class="btn primary block" href="#event-${e.id}" data-act="goEvTab" data-eid="${e.id}" data-v="lineup">팀별 라인업 짜기</a><button class="btn block" data-act="teamShare" data-eid="${e.id}">단톡방 공유 문구</button><button class="btn block" data-act="teamUnconfirm" data-eid="${e.id}">다시 고치기</button></section>`
    : `<div class="btnrow"><button class="btn" data-act="teamShuffle" data-eid="${e.id}">고르게 자동으로 나누기</button><button class="btn primary" data-act="teamConfirm" data-eid="${e.id}" ${A.length && B.length ? "" : "disabled"}>스쿼드 확정</button></div><a class="btn block" href="#event-${e.id}" data-act="goEvTab" data-eid="${e.id}" data-v="lineup">팀별 라인업 짜러 가기</a>`)
    : `<div class="hint center">${T.saved ? "운영진이 확정한 스쿼드예요." : "아직 운영진이 스쿼드를 고르는 중이에요."}</div>`}`}`;
}
function viewSplit(e) {
  if (e.type === "scrim") return viewSquad(e);
  const op = isOpView(); const conf = roster(e).confirmed; const T = teamsOf(e);
  const A = conf.filter(p => T.t[p.id] === "A"), B = conf.filter(p => T.t[p.id] === "B");
  const gk = arr => arr.some(p => isGk(p) || p.pos2 === "GK"); const anyGk = conf.filter(p => isGk(p) || p.pos2 === "GK").length >= 2;
  let warn = ""; if (Math.abs(A.length - B.length) > 1) warn = `인원이 ${A.length} 대 ${B.length}이에요. 한 명만 옮기면 맞아요.`; else if (anyGk && (!gk(A) || !gk(B))) warn = `${gk(A) ? "일반팀" : "조끼팀"}에 골키퍼가 없어요.`;
  const btn = (p, side) => `<button class="tp" data-act="teamMove" data-eid="${e.id}" data-pid="${p.id}" aria-label="${esc(p.name)}, ${side === "A" ? "일반팀으로" : "조끼팀으로"} 옮기기" ${op && !T.saved ? "" : "disabled"}><b>${esc(p.name)}</b><span>${esc(p.pos1 || p.pos || "")}</span></button>`;
  return `${backbar("#event-" + e.id, `${esc(bigDate(e, true))} ${esc(evTitle(e))}, 참석 ${conf.length}명`, "팀 나누기", op && !T.saved ? `<button class="btn" data-act="teamShuffle" data-eid="${e.id}">다시 섞기</button>` : "")}
  ${conf.length < 2 ? `<div class="card"><div class="empty"><b>참석 확정 인원이 부족해요</b>두 명 이상 확정되면 팀을 나눌 수 있어요.</div></div>` : `
  ${op && !T.saved ? `<div class="small muted" style="padding:0 4px">포지션과 골키퍼가 고르게 섞이도록 나눴어요. 이름을 누르면 반대 팀으로 옮겨요.</div>` : ""}
  <div class="teams"><section class="team a" aria-label="조끼팀"><div class="row between"><h3>조끼팀</h3><span class="num" style="font-size:20px">${A.length}명</span></div>${A.map(p => btn(p, "A")).join("")}</section>
    <section class="team" aria-label="일반팀"><div class="row between"><h3>일반팀</h3><span class="num" style="font-size:20px">${B.length}명</span></div>${B.map(p => btn(p, "B")).join("")}</section></div>
  ${warn && !T.saved ? `<div class="status" role="status">${esc(warn)}</div>` : ""}
  ${op ? (T.saved ? `<section class="card"><div role="status" style="font-weight:700;color:var(--clay)">확정했어요. 팀원 일정 화면에 바로 보여요.</div><button class="btn primary block" data-act="teamShare" data-eid="${e.id}">단톡방 공유 문구</button><button class="btn block" data-act="teamUnconfirm" data-eid="${e.id}">다시 고치기</button></section>` : `<button class="btn primary big" data-act="teamConfirm" data-eid="${e.id}">이대로 확정하고 공유</button>`) : `<div class="hint center">${T.saved ? "운영진이 확정한 팀이에요." : "아직 운영진이 팀을 확정하지 않았어요."}</div>`}`}`;
}
function teamText(e) { const conf = roster(e).confirmed; const T = teamsOf(e).t; return [`[${S.settings.teamName || "우리 팀"}] ${fmtDate(e.date)} ${evTitle(e)} 팀`, `조끼팀: ${conf.filter(p => T[p.id] === "A").map(p => p.name).join(", ")}`, `일반팀: ${conf.filter(p => T[p.id] === "B").map(p => p.name).join(", ")}`].join("\n"); }

/* ---------- 가운데 투표 버튼 ---------- */
function voteSheet() {
  const pid = myPid();
  if (!pid) { if (Store.canVote && !Store.preview) { location.hash = "claim"; } else toast(Store.canVote ? "명단에서 본인을 먼저 골라 주세요" : "팀원 권한을 받으면 투표할 수 있어요"); return; }
  const up = eventsSorted().filter(e => !started(e)); const e = up.find(x => { const s = myState(x); return s && !s.s; }) || up[0];
  if (!e) { toast("다가오는 일정이 없어요"); return; }
  const st = myState(e);
  openSheet("참석 투표", `<div data-vs="1" class="stack"><div><div class="date-l">${esc(bigDate(e))}</div><div class="small muted">${evSub(e)}</div></div>
    ${voteGroup(e, st)}${myLatePicker(e, st)}${myStatusLine(e, st) || (st && st.s ? `<div class="status" role="status">${st.s === "late" ? "늦참" : "참석"} 확정 (${st.cap === Infinity ? st.order + "번째" : attCounts(e).capAll + "명 중 " + st.order + "번째"})</div>` : "")}
    <div class="btnrow"><a class="btn" href="#event-${e.id}" data-act="closeSheet">일정 자세히</a><button class="btn primary" data-act="closeSheet">닫기</button></div></div>`);
}
