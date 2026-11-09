
/* ---------- sheets ---------- */
function openSheet(title, html, onMount) {
  const root = $("#sheetroot");
  root.innerHTML = `<div class="scrim" data-act="closeSheetScrim"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="grab"></div><h3>${esc(title)}</h3>${html}</div></div>`;
  document.body.style.overflow = "hidden";
  if (onMount) onMount($(".sheet", root));
}
function closeSheet() { $("#sheetroot").innerHTML = ""; document.body.style.overflow = ""; if (renderPending) { renderPending = false; render(); } }
function confirmSheet(title, msg, okLabel, onOk) {
  openSheet(title, `<p class="small muted" style="margin-top:0">${esc(msg)}</p><div class="btnrow"><button class="btn" data-act="closeSheet">취소</button><button class="btn danger" id="okBtn">${esc(okLabel)}</button></div>`, sh => { $("#okBtn", sh).onclick = () => { closeSheet(); onOk(); }; });
}
function copyText(text, ta) {
  const fallback = () => { if (ta) { ta.focus(); ta.select(); } toast("문구를 선택했어요. 길게 눌러 복사하세요"); };
  try { navigator.clipboard.writeText(text).then(() => toast("복사했어요. 단톡방에 붙여 넣으세요"), fallback); } catch (err) { fallback(); }
}
function textSheet(title, text, note) {
  openSheet(title, `${note ? `<div class="hint" style="margin-bottom:8px">${note}</div>` : ""}
    <div class="field"><label for="shareTxt" class="flabel">미리보기</label><textarea id="shareTxt" readonly style="min-height:170px">${esc(text)}</textarea></div>
    <div class="btnrow"><button class="btn" data-act="closeSheet">닫기</button><button class="btn primary" id="copyBtn">문구 복사</button></div>`, sh => {
    $("#copyBtn", sh).onclick = () => copyText(text, $("#shareTxt", sh));
  });
}

function posReqSheet() {
  const p = playerById(myPid()); if (!p) return; const r = myPosReq();
  const live = r && r.status !== "no";
  const sel = { pos1: live ? r.pos1 || "" : p.pos1 || "", pos2: live ? r.pos2 || "" : p.pos2 || "" };
  openSheet("포지션 변경 요청", `<form id="prf"><div class="hint" style="margin-bottom:10px">지금 등록된 포지션은 <b>${esc(posLabel(p)) || "없음"}</b>이에요. 바꾸고 싶은 포지션을 고르면 운영진이 확인한 뒤 바꿔 줘요.</div>
    ${["pos1", "pos2"].map(f => `<div class="field"><span class="flabel">${f === "pos1" ? "주 포지션" : "부 포지션 (선택)"}</span><div class="dpick" id="r${f}Pick">${POS.map(g => `<div class="pick">${DPOS[g].map(c => `<button type="button" data-v="${c}" aria-pressed="${sel[f] === c}">${c}</button>`).join("")}</div>`).join("")}</div></div>`).join("")}
    <div class="btnrow"><button type="button" class="btn" data-act="closeSheet">취소</button><button class="btn primary" type="submit">요청 보내기</button></div></form>`, sh => {
    ["pos1", "pos2"].forEach(f => $("#r" + f + "Pick", sh).addEventListener("click", ev => { const b = ev.target.closest("button"); if (!b) return; sel[f] = sel[f] === b.dataset.v ? "" : b.dataset.v; sh.querySelectorAll("#r" + f + "Pick button").forEach(x => x.setAttribute("aria-pressed", x.dataset.v === sel[f])); }));
    $("#prf", sh).addEventListener("submit", ev => {
      ev.preventDefault();
      if (Store.preview) { toast("미리보기 화면이라 저장되지 않아요"); return; }
      const main = sel.pos1 || sel.pos2, sub = sel.pos1 && sel.pos2 !== sel.pos1 ? sel.pos2 : "";
      if (!main) { toast("주 포지션을 골라 주세요"); return; }
      if (main === (p.pos1 || "") && sub === (p.pos2 || "")) { toast("지금 포지션과 같아요"); return; }
      patchDoc("rsvp/" + Store.me, { pid: p.id, posReq: { pid: p.id, pos1: main, pos2: sub, at: nowIso(), status: "req" } });
      closeSheet(); render(); toast("포지션 변경을 요청했어요. 운영진이 확인하면 바뀌어요");
    });
  });
}
function playerSheet(p) {
  const isNew = !p; p = p || { id: uid(), name: "", num: "", pos: "", phone: "", active: true };
  const y = String(new Date().getFullYear()); const st = playerStats(p.id, y);
  const uf = S.fines.filter(f => f.pid === p.id && !f.paid);
  const months = [0, -1, -2, -3, -4, -5].map(k => shiftMonth(thisMonth(), k)).reverse();
  const linked = isNew ? [] : uidsOf(p.id);
  openSheet(isNew ? "선수 추가" : "선수 정보", `<form id="pf"><fieldset ${Store.canWrite ? "" : "disabled"} style="border:0;padding:0;margin:0;min-width:0">
    <div class="grid2" style="grid-template-columns:1fr 90px"><div class="field"><label for="pName">이름</label><input id="pName" name="name" required maxlength="20" value="${esc(p.name)}"></div>
    <div class="field"><label for="pNum">등번호</label><input id="pNum" name="num" inputmode="numeric" maxlength="3" value="${esc(p.num ?? "")}"></div></div>
    ${["pos1", "pos2"].map(f => `<div class="field"><span class="flabel">${f === "pos1" ? "주 포지션" : "부 포지션 (선택)"}</span><div class="dpick" id="${f}Pick">${POS.map(g => `<div class="pick">${DPOS[g].map(c => `<button type="button" data-v="${c}" aria-pressed="${p[f] === c}">${c}</button>`).join("")}</div>`).join("")}</div></div>`).join("")}
    ${Store.canMoney ? `<div class="field"><label for="pPhone">연락처 (선택, 운영진만 볼 수 있음)</label><input id="pPhone" name="phone" inputmode="tel" value="${esc(p.phone || "")}"></div>` : ""}
    ${Store.canWrite ? `<label class="row small" style="margin-bottom:14px"><input type="checkbox" name="active" ${p.active !== false ? "checked" : ""} style="width:20px;height:20px"> 활동 중 <span class="hint">(끄면 휴면 선수로 옮겨지고 참석, 회비 대상에서 빠집니다)</span></label>` : ""}
    ${isNew ? "" : `<div class="note" style="margin-bottom:14px"><div class="row between small"><span>${y}년 출석 <b class="num">${st.apps}</b>/${st.played}회</span><span>골 <b class="num">${st.goals}</b> 도움 <b class="num">${st.assists}</b></span></div>
      ${Store.canMoney ? `<div class="row small" style="margin-top:6px;gap:4px;flex-wrap:wrap">${months.map(mm => { const s = duesState(mm, p.id); return `<span class="chip ${s === "paid" ? "good" : s === "exempt" ? "" : "bad"}">${Number(mm.slice(5))}월 ${s === "paid" ? "납부" : s === "exempt" ? "면제" : "미납"}</span>`; }).join("")}</div>` : ""}
      ${uf.length ? `<div class="small" style="margin-top:6px">미납 벌금 ${uf.length}건, ${won(uf.reduce((s, f) => s + (Number(f.amount) || 0), 0))}</div>` : ""}</div>`}
    </fieldset>
    ${Store.canWrite && linked.length ? `<div class="note" style="margin-bottom:14px">${linked.map(u => `<div class="row between"><span>연결된 계정: <b data-uid="${esc(u)}" data-fallback="팀원">팀원</b></span><button type="button" class="btn sm" data-unlink="${esc(u)}">연결 해제</button></div>`).join("")}</div>` : ""}
    ${Store.canWrite ? `<div class="btnrow">${isNew ? `<button type="button" class="btn" data-act="closeSheet">취소</button>` : `<button type="button" class="btn danger" id="pDel">삭제</button>`}<button class="btn primary" type="submit">${isNew ? "추가" : "저장"}</button></div>` : `<button type="button" class="btn block" data-act="closeSheet">닫기</button>`}
  </form>`, sh => {
    fillNames();
    const sel = { pos1: p.pos1 || "", pos2: p.pos2 || "" };
    ["pos1", "pos2"].forEach(f => $("#" + f + "Pick", sh).addEventListener("click", ev => { const b = ev.target.closest("button"); if (!b || !Store.canWrite) return; sel[f] = sel[f] === b.dataset.v ? "" : b.dataset.v; sh.querySelectorAll("#" + f + "Pick button").forEach(x => x.setAttribute("aria-pressed", x.dataset.v === sel[f])); }));
    sh.querySelectorAll("[data-unlink]").forEach(b => b.onclick = () => { patchDoc("rsvp/" + b.dataset.unlink, { pid: "" }); closeSheet(); render(); toast("계정 연결을 해제했어요"); });
    $("#pf", sh).addEventListener("submit", ev => {
      ev.preventDefault(); if (!Store.canWrite) return; const f = ev.target;
      const name = f.elements["name"].value.trim(); if (!name) { f.elements["name"].focus(); return; }
      const num = digits(f.elements["num"].value);
      if (num && S.players.some(x => x.id !== p.id && x.active !== false && String(x.num) === num)) toast(`등번호 ${num}번을 쓰는 활동 선수가 이미 있습니다.`);
      const { phone: _ph, ...rest } = p;
      const main = sel.pos1 || sel.pos2, sub = sel.pos1 && sel.pos2 !== sel.pos1 ? sel.pos2 : "";
      const np = { ...rest, name, num, pos1: main, pos2: sub, pos: main ? DGROUP[main] : (p.pos1 ? "" : p.pos || ""), active: f.elements["active"].checked };
      if (isNew) np.joined = todayStr();
      setDoc("players/" + p.id, np);
      if (f.elements["phone"]) { const phone = f.elements["phone"].value.trim(); if (phone !== (p.phone || "")) { if (phone) setDoc("contacts/" + p.id, { phone }); else delDoc("contacts/" + p.id); } }
      closeSheet(); render(); toast(isNew ? `${name} 선수를 추가했습니다` : "저장했습니다");
      if (isNew && S.players.length === 1 && currentView() !== "players") location.hash = "players";
    });
    const del = $("#pDel", sh);
    if (del) del.onclick = () => confirmSheet("선수 삭제", `${p.name} 선수를 삭제할까요? 지난 기록에는 '삭제된 선수'로 표시됩니다. 그만둔 선수라면 삭제 대신 '활동 중'을 꺼서 휴면으로 두는 것을 권합니다.`, "삭제", () => {
      delDoc("players/" + p.id); if (p.phone) delDoc("contacts/" + p.id); render(); toast("삭제했습니다");
    });
  });
}

function eventSheet(e) {
  const isNew = !e;
  e = e || { id: uid(), type: "match", format: prefs().lastFormat || "11", date: "", time: "", place: prefs().lastPlace || "", opponent: "", title: "", cap: "" };
  if (isNew && !e.date) { const d = new Date(); d.setDate(d.getDate() + 1); e.date = ymd(d); }
  const tpls = isNew ? templates() : [];
  openSheet(isNew ? "일정 올리기" : "일정 수정", `<form id="ef">
    ${tpls.length ? `<div class="field"><span class="flabel">지난 일정으로 빠르게 만들기</span><div class="stack" id="tplList" style="gap:6px">${tpls.map((t, i) => `<button type="button" class="tpl" data-i="${i}" aria-pressed="false"><span class="num" style="font-size:18px;font-weight:700;width:64px;flex:none">${WD[t.wd]} ${esc(t.time || "")}</span><span class="grow ell" style="font-weight:600">${esc(t.type === "scrim" ? "내전" : t.type === "match" ? (t.opponent || "경기") : (t.title || "훈련"))}</span><span class="tiny muted">${esc(FORMAT_KO[t.format])}</span></button>`).join("")}</div></div>` : ""}
    <div class="field"><span class="flabel">종류</span><div class="seg" id="typeSeg"><button type="button" data-v="match" aria-pressed="${e.type === "match"}">경기</button><button type="button" data-v="scrim" aria-pressed="${e.type === "scrim"}">내전</button></div></div>
    <div class="field"><span class="flabel">형식</span><div class="seg" id="fmtSeg"><button type="button" data-v="11" aria-pressed="${e.format !== "futsal"}">11인 축구 (4쿼터)</button><button type="button" data-v="futsal" aria-pressed="${e.format === "futsal"}">풋살 (8쿼터)</button></div></div>
    <div class="grid2"><div class="field"><label for="eDate">날짜</label><input type="date" id="eDate" name="date" required value="${esc(e.date)}"></div><div class="field"><label for="eTime">시간</label><input type="time" id="eTime" name="time" value="${esc(e.time || "")}"></div></div>
    <div class="field" id="oppField"><label for="eOpp">상대 팀</label><input id="eOpp" name="opponent" maxlength="30" value="${esc(e.opponent || "")}" placeholder="예: FC 서울, 내전"></div>
    <div class="hint" id="scrimHint" style="margin:-4px 0 12px">내전은 참석 투표를 받은 뒤, 일정의 라인업 탭에서 조끼팀과 일반팀 스쿼드를 한 명씩 고르고 팀마다 쿼터별 자리와 휴식을 짜요.</div>
    <div class="field" id="titleField"><label for="eTitle">제목 (선택)</label><input id="eTitle" name="title" maxlength="30" value="${esc(e.title || "")}" placeholder="예: 세트피스 훈련"></div>
    <div class="grid2"><div class="field"><label for="ePlace">장소</label><input id="ePlace" name="place" maxlength="40" value="${esc(e.place || "")}" placeholder="예: 보라매 축구장"></div>
    <div class="field"><label for="eCap">정원</label><input id="eCap" name="cap" inputmode="numeric" maxlength="3" value="${esc(e.cap ?? "")}" placeholder="팀 기본 ${Number(S.settings.cap) > 0 ? S.settings.cap + "명" : "없음"}"></div></div>
    ${isNew ? `<label class="row" style="margin-bottom:12px;gap:10px;min-height:44px"><input type="checkbox" id="eRepeat" style="width:22px;height:22px"><span><b>매주 반복</b> <span class="hint">같은 요일, 시간, 장소로 4주치를 한 번에</span></span></label>` : ""}
    <div class="hint" style="margin:-4px 0 12px">투표는 올리는 즉시 열리고 경기 시작 시각에 자동으로 닫혀요.</div>
    <div class="btnrow">${isNew ? `<button type="button" class="btn" data-act="closeSheet">취소</button>` : `<button type="button" class="btn danger" id="eDel">삭제</button>`}<button class="btn primary" type="submit">${isNew ? "올리기" : "저장"}</button></div>
  </form>`, sh => {
    let type = e.type, format = e.format === "futsal" ? "futsal" : "11";
    const sync = () => {
      sh.querySelectorAll("#typeSeg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === type));
      sh.querySelectorAll("#fmtSeg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === format));
      $("#oppField", sh).hidden = type !== "match"; $("#titleField", sh).hidden = type !== "training";
      $("#scrimHint", sh).hidden = type !== "scrim";
    };
    sync();
    $("#typeSeg", sh).onclick = ev => { const b = ev.target.closest("button"); if (b) { type = b.dataset.v; sync(); } };
    $("#fmtSeg", sh).onclick = ev => { const b = ev.target.closest("button"); if (b) { format = b.dataset.v; sync(); } };
    const tl = $("#tplList", sh);
    if (tl) tl.onclick = ev => {
      const b = ev.target.closest(".tpl"); if (!b) return; const t = tpls[Number(b.dataset.i)];
      tl.querySelectorAll(".tpl").forEach(x => x.setAttribute("aria-pressed", x === b));
      type = t.type; format = t.format; sync();
      const f = $("#ef", sh);
      f.elements["date"].value = nextDateFor(t.wd); f.elements["time"].value = t.time; f.elements["place"].value = t.place;
      f.elements["opponent"].value = t.opponent; f.elements["title"].value = t.title; f.elements["cap"].value = t.cap;
    };
    $("#ef", sh).addEventListener("submit", ev => {
      ev.preventDefault(); const f = ev.target;
      if (!f.elements["date"].value) { f.elements["date"].focus(); return; }
      const base = S.events[e.id] || e;
      const patch = { type, format, date: f.elements["date"].value, time: f.elements["time"].value, place: f.elements["place"].value.trim(), opponent: type === "match" ? f.elements["opponent"].value.trim() : "", title: type === "training" ? f.elements["title"].value.trim() : "", cap: digits(f.elements["cap"].value) };
      if (!isNew && format !== base.format && (base.lineup || base.lineupQ)) { patch.lineup = null; patch.lineupQ = null; }
      if (!isNew && type === "training" && base.score) patch.score = null;
      setPref("lastFormat", format); setPref("lastPlace", patch.place);
      if (!isNew) { evPatch(e.id, patch); closeSheet(); render(); toast("저장했습니다"); return; }
      const repeat = $("#eRepeat", sh) && $("#eRepeat", sh).checked;
      const made = [];
      for (let w = 0; w < (repeat ? 4 : 1); w++) {
        const d = parseD(patch.date); d.setDate(d.getDate() + 7 * w);
        const id = w === 0 ? e.id : uid() + w;
        evPatch(id, { ...patch, id, date: ymd(d) }, 0);
        made.push({ ...patch, id, date: ymd(d) });
      }
      closeSheet();
      ui.evFor = null; location.hash = "event-" + made[0].id;
      setTimeout(() => textSheet(made.length > 1 ? `${made.length}주치 일정을 올렸어요` : "일정을 올렸어요", eventShareText(made.map(m => S.events[m.id] || m)), "단톡방에 알리면 투표가 시작돼요. 문구를 복사해서 붙여 넣으세요." + (String(S.settings.shareLink || window.__SHARE_LINK || "").trim() ? "" : " 설정에서 '팀원에게 보낼 링크'를 넣어 두면 링크도 같이 들어가요.")), 50);
    });
    const del = $("#eDel", sh);
    if (del) del.onclick = () => confirmSheet("일정 삭제", "이 일정과 참석, 경기 기록, 라인업을 삭제할까요? 이 일정에서 부과한 벌금은 남습니다.", "삭제", () => {
      delDoc("events/" + e.id); location.hash = "schedule"; toast("삭제했습니다");
    });
  });
}

function playerPicker(title, opts, onPick) {
  const btn = p => `<button class="item" data-pick="${p.id}" ${opts.current === p.id ? 'aria-current="true"' : ""} ${opts.disabled && opts.disabled(p) ? "disabled" : ""}><span class="kit ${p.pos === "GK" ? "gk" : ""}">${esc(p.num ?? "")}</span><div class="grow"><div class="ell" style="font-weight:600">${esc(p.name)}${opts.current === p.id ? ' <span class="chip match">현재</span>' : ""}</div><div class="tiny muted">${esc(posLabel(p))}${opts.tag ? " " + opts.tag(p) : ""}</div></div></button>`;
  const sections = (opts.sections || [["", opts.list]]).filter(s => s[1].length);
  openSheet(title, `${opts.intro ? `<div class="hint" style="margin-bottom:8px">${opts.intro}</div>` : ""}${(opts.extra || []).map(([v, l]) => `<button class="btn block" data-pick="${v}" style="margin-bottom:8px">${esc(l)}</button>`).join("")}
    ${sections.map(([lab, list]) => `${lab ? `<div class="flabel" style="margin-top:6px">${esc(lab)}</div>` : ""}<div class="list">${list.map(btn).join("")}</div>`).join("") || `<div class="empty">선택할 선수가 없습니다.</div>`}
    ${(opts.after || "")}
    <div class="btnrow" style="margin-top:10px"><button class="btn" data-act="closeSheet">닫기</button></div>`, sh => {
    sh.addEventListener("click", ev => { const b = ev.target.closest("[data-pick]"); if (!b || b.disabled) return; closeSheet(); onPick(b.dataset.pick); });
  });
}
function claimSheet() {
  const takenBy = pid => uidsOf(pid).some(u => u !== Store.me);
  playerPicker("명단에서 나를 골라 주세요", {
    intro: "처음 한 번만 고르면 돼요. 이미 다른 계정과 연결된 이름은 고를 수 없어요.",
    list: activePlayers(), current: myPid(),
    disabled: p => takenBy(p.id), tag: p => takenBy(p.id) ? "(이미 연결됨)" : "",
    after: `<button class="btn block" data-act="claimNew" style="margin-top:10px">명단에 내 이름이 없어요</button>`
  }, pid => {
    patchDoc("rsvp/" + Store.me, { pid, claimAt: nowIso(), reqName: "" });
    render(); toast(`${pname(pid)} 선수로 연결했어요. 이제 홈에서 바로 투표할 수 있어요`);
  });
}
function claimNewSheet() {
  let pos = "";
  openSheet("이름을 알려 주세요", `<form id="cn"><div class="hint" style="margin-bottom:8px">운영진에게 등록 요청이 가요. 승인되면 바로 투표할 수 있어요.</div>
    <div class="field"><label for="cnName">이름</label><input id="cnName" name="name" required maxlength="20"></div>
    <div class="field"><span class="flabel">주로 뛰는 자리 (선택)</span><div class="pick" id="cnPos">${POS.map(k => `<button type="button" data-v="${k}" aria-pressed="false">${POS_KO[k]}</button>`).join("")}</div></div>
    <div class="btnrow"><button type="button" class="btn" data-act="closeSheet">취소</button><button class="btn primary" type="submit">등록 요청</button></div></form>`, sh => {
    $("#cnPos", sh).onclick = ev => { const b = ev.target.closest("button"); if (!b) return; pos = pos === b.dataset.v ? "" : b.dataset.v; sh.querySelectorAll("#cnPos button").forEach(x => x.setAttribute("aria-pressed", x.dataset.v === pos)); };
    $("#cn", sh).addEventListener("submit", ev => {
      ev.preventDefault(); const name = ev.target.elements["name"].value.trim(); if (!name) return;
      patchDoc("rsvp/" + Store.me, { pid: "", reqName: name, reqPos: pos, reqAt: nowIso() });
      closeSheet(); render(); toast("등록 요청을 보냈어요");
    });
  });
}
function parseRoster(text) {
  const posMap = { GK: "GK", DF: "DF", MF: "MF", FW: "FW", "골키퍼": "GK", "키퍼": "GK", "수비": "DF", "미드": "MF", "미드필더": "MF", "공격": "FW", "공격수": "FW" };
  return String(text || "").split("\n").map(l => l.trim()).filter(Boolean).map(l => {
    let num = "", pos = ""; const det = []; const nameParts = [];
    l.replace(/^\d+[.)]\s*/, "").split(/[\s,\/\t]+/).forEach(w => { const up = w.toUpperCase(); if (/^\d{1,3}$/.test(w) && !num) num = w; else if (DGROUP[up]) { if (det.length < 2 && !det.includes(up)) det.push(up); } else if (posMap[up] || posMap[w]) pos = posMap[up] || posMap[w]; else if (w) nameParts.push(w); });
    return { name: nameParts.join(" ").slice(0, 20), num, pos: det[0] ? DGROUP[det[0]] : pos, pos1: det[0] || "", pos2: det[1] || "" };
  }).filter(r => r.name);
}
function bulkSheet() {
  openSheet("명단 붙여 넣기", `<div class="hint" style="margin-bottom:8px">단톡방 공지나 엑셀에서 복사해 오세요. 한 줄에 한 명, 등번호와 포지션(ST, CAM, CB 같은 세부 포지션은 주, 부 순서로 두 개까지, 또는 골키퍼, 수비, 미드, 공격)은 있으면 같이 읽어요.</div>
    <div class="field"><label for="bulkTxt" class="flabel">명단</label><textarea id="bulkTxt" style="min-height:150px" placeholder="김도현 1 GK&#10;이준서 2 수비&#10;박지훈"></textarea></div>
    <div class="card" style="box-shadow:none;padding:12px"><div class="small" style="font-weight:700" id="bulkCount">0명을 읽었어요</div><div class="chips" id="bulkPrev" style="margin-top:6px"></div></div>
    <div class="btnrow" style="margin-top:12px"><button class="btn" data-act="closeSheet">취소</button><button class="btn primary" id="bulkOk" disabled>등록하기</button></div>`, sh => {
    const ta = $("#bulkTxt", sh);
    const names = new Set(S.players.map(p => p.name));
    const upd = () => {
      const rows = parseRoster(ta.value);
      const dup = rows.filter(r => names.has(r.name)).length;
      $("#bulkCount", sh).textContent = `${rows.length}명을 읽었어요${dup ? ` (이미 있는 이름 ${dup}명은 건너뛰어요)` : ""}`;
      $("#bulkPrev", sh).innerHTML = rows.map(r => `<span class="chip ${names.has(r.name) ? "" : "match"}">${r.num ? `<b class="num">${esc(r.num)}</b> ` : ""}${esc(r.name)} ${esc(r.pos1 ? r.pos1 + (r.pos2 ? "/" + r.pos2 : "") : r.pos)}</span>`).join("");
      const n = rows.filter(r => !names.has(r.name)).length;
      $("#bulkOk", sh).disabled = !n; $("#bulkOk", sh).textContent = n ? `${n}명 등록하기` : "등록하기";
    };
    ta.addEventListener("input", upd);
    $("#bulkOk", sh).onclick = () => {
      const seen = new Set(); const rows = parseRoster(ta.value).filter(r => { if (names.has(r.name) || seen.has(r.name)) return false; seen.add(r.name); return true; });
      rows.forEach((r, i) => { const id = uid() + i; setDoc("players/" + id, { id, name: r.name, num: r.num, pos: r.pos, pos1: r.pos1, pos2: r.pos2, active: true, joined: todayStr() }, 300 + i * 40); });
      closeSheet(); if (currentView() !== "players") location.hash = "players"; else render(); toast(`${rows.length}명을 등록했어요`);
    };
  });
}

function goalSheet(e) {
  const A = effAtt(e);
  const came = activePlayers().filter(p => going(A.s[p.id]));
  const rest = S.players.filter(p => !came.includes(p)).sort(sortPlayers);
  const N = quartersOf(e);
  let scorer = null, assist = "", q = 0;
  openSheet("골 추가", `<div class="field"><span class="flabel">득점</span><div class="pick" id="gs">${came.concat(rest).map(p => `<button type="button" data-v="${p.id}">${esc(p.name)}</button>`).join("")}<button type="button" data-v="__og">상대 자책골</button></div></div>
    <div class="field"><span class="flabel">도움 (선택)</span><div class="pick" id="ga">${came.concat(rest).map(p => `<button type="button" data-v="${p.id}">${esc(p.name)}</button>`).join("")}</div></div>
    <div class="field"><span class="flabel">몇 쿼터 (선택)</span><div class="qtabs" id="gq" style="--n:${N}">${Array.from({ length: N }, (_, k) => `<button type="button" data-v="${k + 1}" aria-pressed="false">${k + 1}Q</button>`).join("")}</div></div>
    <div class="hint" style="margin:-4px 0 12px">참석한 선수가 앞에 나옵니다. 골을 추가해도 스코어는 따로 바꿔 주세요.</div>
    <div class="btnrow"><button class="btn" data-act="closeSheet">취소</button><button class="btn primary" id="gOk" disabled>추가</button></div>`, sh => {
    const paint = () => {
      sh.querySelectorAll("#gs button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === scorer));
      sh.querySelectorAll("#ga button").forEach(b => { b.setAttribute("aria-pressed", b.dataset.v === assist); b.disabled = b.dataset.v === scorer; });
      sh.querySelectorAll("#gq button").forEach(b => b.setAttribute("aria-pressed", Number(b.dataset.v) === q));
      $("#gOk", sh).disabled = !scorer;
    };
    paint();
    $("#gs", sh).onclick = ev => { const b = ev.target.closest("button"); if (!b) return; scorer = b.dataset.v; if (assist === scorer) assist = ""; paint(); };
    $("#ga", sh).onclick = ev => { const b = ev.target.closest("button"); if (!b || b.disabled) return; assist = assist === b.dataset.v ? "" : b.dataset.v; paint(); };
    $("#gq", sh).onclick = ev => { const b = ev.target.closest("button"); if (!b) return; const v = Number(b.dataset.v); q = q === v ? 0 : v; paint(); };
    $("#gOk", sh).onclick = () => {
      e = S.events[e.id]; if (!e) { closeSheet(); return; }
      const goals = (e.goals || []).concat([{ id: uid(), pid: scorer, assist: scorer === "__og" ? "" : assist, q }]);
      goals.sort((a, b) => (Number(a.q) || Number(a.min) || 99) - (Number(b.q) || Number(b.min) || 99));
      evPatch(e.id, { goals }); closeSheet(); render(); toast("골을 기록했습니다");
    };
  });
}

function fineSheet(fine) {
  const isNew = !fine;
  if (!isNew && !Store.canWrite) { toast(`${pname(fine.pid)} ${fine.reason || ""} ${won(fine.amount)}, ${fine.paid ? "납부 완료" : "미납"}`); return; }
  fine = fine || { id: uid(), pid: "", date: todayStr(), reason: "", amount: "", paid: false, presetId: "" };
  const ps = S.players.slice().sort(sortPlayers).filter(p => p.active !== false || p.id === fine.pid);
  openSheet(isNew ? "벌금 추가" : "벌금 수정", `<form id="ff">
    <div class="field"><label for="fP">선수</label><select id="fP" name="pid" required><option value="">선택하세요</option>${ps.map(p => `<option value="${p.id}" ${p.id === fine.pid ? "selected" : ""}>${esc(p.num ? p.num + " " : "")}${esc(p.name)}</option>`).join("")}</select></div>
    <div class="field"><span class="flabel">종류</span><div class="pick" id="fPre">${S.settings.finePresets.map(p => `<button type="button" data-id="${esc(p.id)}" aria-pressed="${fine.presetId === p.id}">${esc(p.label)} ${won(p.amount)}</button>`).join("")}</div></div>
    <div class="grid2"><div class="field"><label for="fR">사유</label><input id="fR" name="reason" maxlength="30" value="${esc(fine.reason)}"></div><div class="field"><label for="fA">금액 (원)</label><input id="fA" name="amount" inputmode="numeric" required value="${esc(fine.amount)}"></div></div>
    <div class="grid2"><div class="field"><label for="fD">날짜</label><input type="date" id="fD" name="date" value="${esc(fine.date)}"></div><label class="row small" style="align-self:end;min-height:44px;margin-bottom:12px"><input type="checkbox" name="paid" ${fine.paid ? "checked" : ""} style="width:20px;height:20px"> 납부 완료</label></div>
    <div class="btnrow">${isNew ? `<button type="button" class="btn" data-act="closeSheet">취소</button>` : `<button type="button" class="btn danger" id="fDel">삭제</button>`}<button class="btn primary" type="submit">${isNew ? "추가" : "저장"}</button></div></form>`, sh => {
    let presetId = fine.presetId || "";
    $("#fPre", sh).onclick = ev => {
      const b = ev.target.closest("button"); if (!b) return;
      const p = S.settings.finePresets.find(x => x.id === b.dataset.id); if (!p) return;
      presetId = p.id; $("#fR", sh).value = p.label; $("#fA", sh).value = p.amount;
      sh.querySelectorAll("#fPre button").forEach(x => x.setAttribute("aria-pressed", x === b));
    };
    $("#ff", sh).addEventListener("submit", ev => {
      ev.preventDefault(); const f = ev.target;
      const amount = Number(digits(f.elements["amount"].value));
      if (!f.elements["pid"].value) { f.elements["pid"].focus(); return; }
      if (!amount) { f.elements["amount"].focus(); toast("금액을 입력해 주세요"); return; }
      const nf = { ...fine, pid: f.elements["pid"].value, reason: f.elements["reason"].value.trim(), amount, date: f.elements["date"].value || todayStr(), paid: f.elements["paid"].checked, presetId };
      if (isNew) nf.by = Store.me || "";
      setDoc("fines/" + nf.id, nf); closeSheet(); render(); toast(isNew ? "벌금을 추가했습니다" : "저장했습니다");
    });
    const del = $("#fDel", sh);
    if (del) del.onclick = () => confirmSheet("벌금 삭제", "이 벌금 기록을 삭제할까요?", "삭제", () => { delDoc("fines/" + fine.id); render(); toast("삭제했습니다"); });
  });
}
