
/* ---------- actions ---------- */
function curEvent() { const v = currentView(); return v.startsWith("event-") ? S.events[v.slice(6)] : null; }
function saveEv(e, patch) { evPatch(e.id, patch); render(); }
const evById = t => S.events[t.dataset.eid] || curEvent();

// 팀원 본인 투표: rsvp/<내 id> 문서에만 쓴다
function myVote(e, v) {
  const pid = myPid(); if (!pid || !e) return;
  if (started(e) && !Store.canWrite) { toast("경기가 시작돼서 바꿀 수 없어요. 운영진에게 말해 주세요."); return; }
  const A = effAtt(e); const cur = A.s[pid] || ""; if (cur === v) return;
  const wasIn = roster(e).ids.has(pid); const now = nowIso();
  const entry = { s: v, upd: now, q: v === "late" ? (A.q[pid] || 0) : 0, at: going(v) ? (going(cur) ? (A.at[pid] || now) : now) : "" };
  if (going(cur) && v === "no") { entry.cancelAt = now; entry.cancelIn = wasIn; } else if (going(v)) { entry.cancelAt = ""; entry.cancelIn = false; }
  patchDoc("rsvp/" + Store.me, { pid, ev: { [e.id]: entry } });
  render();
  const st = myState(S.events[e.id] || e);
  if (st && going(v) && st.wait) toast(`정원이 차서 대기 ${st.wait}번이에요. 자리가 나면 자동으로 올라가요`);
  else if (going(v) && going(cur)) toast(v === "late" ? "늦참으로 바꿨어요. 순서는 그대로예요" : "참석으로 바꿨어요. 순서는 그대로예요");
  else if (v === "no" && wasIn) toast("불참으로 바꿨어요. 다시 참석하면 대기열 맨 뒤로 가요");
}
function opSetAtt(e, pid, nv) {
  const A = effAtt(e); const cur = A.s[pid] || ""; const now = nowIso();
  const wasIn = roster(e).ids.has(pid);
  const patch = { att: { [pid]: nv }, attUpd: { [pid]: now }, attAt: { [pid]: going(nv) ? (going(cur) ? (A.at[pid] || now) : now) : "" }, lateQ: { [pid]: nv === "late" ? (A.q[pid] || 0) : 0 } };
  if (going(cur) && nv === "no") { patch.cancelAt = { [pid]: now }; patch.cancelIn = { [pid]: wasIn }; }
  else if (going(nv)) { patch.cancelAt = { [pid]: "" }; patch.cancelIn = { [pid]: false }; }
  saveEv(e, patch);
  if (going(nv) && !going(cur)) { const pos = roster(S.events[e.id] || e).waitPos(pid); if (pos) toast(`정원 ${capOf(e)}명이 차서 ${pname(pid)} 선수는 대기 ${pos}번입니다`); }
}
function lineupSave(e, L, q, extra) {
  const obj = {}; q.forEach((slots, k) => { obj[k + 1] = slots.map(x => x || null); });
  const side = L.side || curSide(e);
  const body = Object.assign({ formation: L.formation, q: obj }, extra || {});
  if (side) { saveEv(e, { lineS: { [side]: body } }); return; }
  saveEv(e, { lineupQ: body, lineup: null });
}
function halfSave(e, L, k, i, pid) {
  const side = L.side || curSide(e); const body = { h: { [k + 1]: { [i]: pid || null } } };
  if (side) saveEv(e, { lineS: { [side]: body } }); else saveEv(e, { lineupQ: Object.assign({ formation: L.formation }, body) });
}

const ACT = {
  closeSheet: () => closeSheet(),
  previewMember: () => { setPreview("member"); location.hash = "home"; },
  previewViewer: () => { setPreview("viewer"); location.hash = "home"; },
  previewOff: () => { setPreview(""); location.hash = "config"; },
  previewPick: () => playerPicker("어느 선수의 화면으로 볼까요", { list: activePlayers(), current: Store.previewPid }, pid => { Store.previewPid = pid; window.scrollTo(0, 0); render(); }),
  closeSheetScrim: (t, ev) => { if (ev.target === t) closeSheet(); },
  toggleBig: () => { setPref("big", !prefs().big); applyBig(); render(); },
  closePromo: t => { const seen = prefs().seen || {}; seen[t.dataset.eid] = "in"; setPref("seen", seen); render(); },
  rankTab: t => { ui.rankTab = t.dataset.v; render(); },
  // 팀원
  myVote: t => { myVote(evById(t), t.dataset.v); if ($("#sheetroot [data-vs]")) voteSheet(); },
  myLateQ: t => {
    const e = evById(t); const pid = myPid(); if (!e || !pid) return;
    if (started(e) && !Store.canWrite) return;
    const A = effAtt(e); const q = Number(t.dataset.q); const nq = lateQ(e, pid) === q ? 0 : q;
    patchDoc("rsvp/" + Store.me, { pid, ev: { [e.id]: { s: "late", at: A.at[pid] || nowIso(), q: nq, upd: nowIso() } } }); render(); if ($("#sheetroot [data-vs]")) voteSheet();
  },
  claimOpen: () => { location.hash = "claim"; },
  posReqOpen: () => posReqSheet(),
  posReqCancel: () => { patchDoc("rsvp/" + Store.me, { posReq: null }); render(); },
  posOk: t => {
    const u = t.dataset.u; const r = S.rsvp[u] && S.rsvp[u].posReq; if (!r || !playerById(r.pid)) return;
    patchDoc("players/" + r.pid, { pos1: r.pos1, pos2: r.pos2 || "", pos: DGROUP[r.pos1] || "" });
    patchDoc("rsvp/" + u, { posReq: { status: "ok", doneAt: nowIso() } }); render(); toast(`${pname(r.pid)} 선수 포지션을 바꿨어요. 팀원 알림함에 떠요`);
  },
  posNo: t => { patchDoc("rsvp/" + t.dataset.u, { posReq: { status: "no", doneAt: nowIso() } }); render(); toast("요청을 반려했어요. 팀원 화면에 안내가 보여요"); },
  goLineup: t => { ui.evFor = t.dataset.eid; ui.evTab = "lineup"; },
  claimNew: () => claimNewSheet(),
  unclaim: () => confirmSheet("연결 해제", `${pname(myPid())} 선수와의 연결을 끊을까요? 다시 '나 찾기'로 고를 수 있어요.`, "연결 해제", () => { patchDoc("rsvp/" + Store.me, { pid: "" }); render(); toast("연결을 해제했어요"); }),
  copyAcct: () => copyText(String(S.settings.account || "").trim()),
  payReq: () => {
    const pid = myPid(); if (!pid) return;
    const M = myMoney(pid); const items = {}; let n = 0, sum = 0;
    M.items.filter(i => i.req !== "req" && i.req !== "ok").forEach(i => { items[i.key] = { kind: i.kind, ref: i.ref, amount: i.amount, label: i.label, pid, at: nowIso(), status: "req" }; n++; sum += i.amount; });
    if (!n) return;
    patchDoc("payreq/" + Store.me, { items }); render(); toast(`${won(sum)} 입금 확인을 요청했어요. 총무가 확인하면 납부 완료로 바뀌어요`);
  },
  // 운영진: 선수
  newPlayer: () => { ui.newPid = ""; location.hash = "player-new"; },
  newPlayerGo: (t, ev) => { ev.preventDefault(); ui.newPid = ""; location.hash = "player-new"; },
  editPlayer: t => { location.hash = "player-" + t.dataset.id; },
  toggleInactive: () => { ui.showInactive = !ui.showInactive; render(); },
  bulkOpen: () => bulkSheet(),
  reqOk: t => {
    const u = t.dataset.u; const d = S.rsvp[u]; if (!d || !d.reqName) return;
    const id = uid(); setDoc("players/" + id, { id, name: d.reqName, num: "", pos: d.reqPos || "", active: true, joined: todayStr() });
    patchDoc("rsvp/" + u, { pid: id, reqName: "", claimAt: nowIso() }); render(); toast(`${d.reqName} 선수를 등록하고 계정과 연결했어요`);
  },
  reqNo: t => { patchDoc("rsvp/" + t.dataset.u, { reqName: "" }); render(); toast("요청을 거절했어요"); },
  // 일정
  newEvent: () => eventSheet(null),
  editEvent: t => eventSheet(S.events[t.dataset.id]),
  shareEvent: t => { const e = S.events[t.dataset.id]; if (e) textSheet("공유 문구", eventShareText([e]), "단톡방에 붙여 넣으세요."); },
  shareNudge: t => { const e = S.events[t.dataset.id]; if (e) textSheet("미응답자 알림 문구", nudgeText(e), "단톡방에 붙여 넣으세요."); },
  schedFilter: t => { ui.schedFilter = t.dataset.v; render(); },
  evTab: t => { ui.evTab = t.dataset.v; render(); },
  attFilter: t => { ui.attFilter = t.dataset.v; render(); },
  setAtt: t => { const e = curEvent(); if (!e) return; const pid = t.dataset.pid, v = t.dataset.v; const cur = effAtt(e).s[pid] || ""; opSetAtt(e, pid, cur === v ? "" : v); },
  setLateQ: t => {
    const e = curEvent(); if (!e) return; const pid = t.dataset.pid, q = Number(t.dataset.q); const A = effAtt(e);
    saveEv(e, { att: { [pid]: "late" }, attAt: { [pid]: A.at[pid] || nowIso() }, attUpd: { [pid]: nowIso() }, lateQ: { [pid]: lateQ(e, pid) === q ? 0 : q } });
  },
  allYes: () => {
    const e = curEvent(); if (!e) return; const A = effAtt(e); const att = {}, attAt = {}, attUpd = {}; const base = Date.now();
    activePlayers().filter(p => !A.s[p.id]).forEach((p, i) => { att[p.id] = "yes"; attAt[p.id] = new Date(base + i).toISOString(); attUpd[p.id] = attAt[p.id]; });
    saveEv(e, { att, attAt, attUpd });
    const w = attCounts(S.events[e.id] || e).wait;
    toast(w ? `모두 참석으로 표시했습니다. ${w}명은 대기열에 있습니다` : "모두 참석으로 표시했습니다");
  },
  // 현장 출석
  cycleCheck: t => {
    const e = curEvent(); if (!e) return; const pid = t.dataset.pid;
    const cur = checkOf(e, pid); const wasLate = effAtt(e).s[pid] === "late";
    const order = wasLate ? ["excused", "in", "late", "absent"] : ["in", "late", "absent"];
    const next = order[(order.indexOf(cur) + 1) % order.length];
    const patch = {};
    if (!checkStarted(e)) checkPeople(e).forEach(p => { patch[p.id] = checkOf(e, p.id); });
    patch[pid] = next;
    saveEv(e, { check: patch });
  },
  checkSaveAll: () => { const e = curEvent(); if (!e) return; const patch = {}; checkPeople(e).forEach(p => { patch[p.id] = checkOf(e, p.id); }); saveEv(e, { check: patch }); toast("출석을 저장했어요"); },
  checkAdd: () => {
    const e = curEvent(); if (!e) return;
    const inList = new Set(checkPeople(e).map(p => p.id));
    const others = activePlayers().filter(p => !inList.has(p.id));
    const r = roster(e);
    playerPicker("명단 외 인원 추가", { sections: [["대기", others.filter(p => r.wait.includes(p))], ["그 외 선수", others.filter(p => !r.wait.includes(p))]] }, pid => {
      const cur = S.events[e.id]; if (!cur) return;
      const patch = {}; if (!checkStarted(cur)) checkPeople(cur).forEach(p => { patch[p.id] = checkOf(cur, p.id); });
      patch[pid] = "in"; saveEv(cur, { check: patch }); toast(`${pname(pid)} 선수를 출석으로 추가했습니다`);
    });
  },
  imposeFines: () => {
    const e = curEvent(); if (!e) return; let n = 0, sum = 0;
    fineCands(e).forEach(cd => {
      if (!cd.pre || eventFine(e, cd.p.id, cd.pre) || !fineOn(cd.key)) return;
      const id = uid() + n; n++; sum += Number(cd.pre.amount) || 0;
      setDoc("fines/" + id, { id, pid: cd.p.id, date: e.date, reason: cd.why === cd.pre.label ? cd.pre.label : `${cd.why}`, amount: Number(cd.pre.amount) || 0, paid: false, presetId: cd.pre.id, eventId: e.id, by: Store.me || "" }, 300 + n * 60);
    });
    render(); toast(n ? `${n}명, ${won(sum)} 부과했어요. 해당 팀원의 내 회비 화면에도 보여요` : "부과할 사람이 없습니다");
  },
  shareCheck: () => { const e = curEvent(); if (e) textSheet("출석 결과 공유", shareText(e), "단톡방에 붙여 넣으세요. 링크를 가진 팀원은 앱에서도 같은 내용을 볼 수 있어요."); },
  // 기록
  score: t => {
    const e = curEvent(); if (!e) return;
    const sc = e.score && Number.isFinite(e.score.us) ? { ...e.score } : { us: 0, them: 0 };
    sc[t.dataset.side] = Math.max(0, (sc[t.dataset.side] || 0) + Number(t.dataset.d));
    saveEv(e, { score: sc });
  },
  score00: () => { const e = curEvent(); if (!e) return; saveEv(e, { score: { us: 0, them: 0 } }); },
  clearScore: () => { const e = curEvent(); if (!e) return; saveEv(e, { score: null }); },
  addGoal: () => { const e = curEvent(); if (e) goalSheet(e); },
  delGoal: t => { const e = curEvent(); if (!e) return; saveEv(e, { goals: (e.goals || []).filter((_, i) => i !== Number(t.dataset.i)) }); },
  // 라인업
  lineQ: t => { ui.lineQ = Number(t.dataset.v) || 0; ui.lineSel = -1; ui.lineMsg = ""; render(); },
  lineSide: t => { ui.lineSide = t.dataset.v === "B" ? "B" : "A"; ui.lineSideEv = t.dataset.eid; ui.lineSel = -1; ui.lineMsg = ""; render(); },
  scrimN: t => { const e = curEvent(); if (!e) return; const f = Object.keys(SCRIM_FORMS).find(k => k.startsWith(t.dataset.v + "|")); if (f) ACT.formation({ dataset: { v: f } }); },
  formation: t => {
    const e = curEvent(); if (!e) return; const L = lineupOf(e);
    const spots = L.forms[t.dataset.v]; if (!spots) return;
    const q = L.q.map(old => {
      const pool = L.spots.map((s, i) => ({ grp: s[0], pid: old[i] })).filter(x => x.pid);
      const slots = spots.map(() => null);
      spots.forEach((s, i) => { const k = pool.findIndex(x => x.grp === s[0]); if (k >= 0) { slots[i] = pool[k].pid; pool.splice(k, 1); } });
      spots.forEach((s, i) => { if (!slots[i] && pool.length) slots[i] = pool.shift().pid; });
      return slots;
    });
    lineupSave(e, { formation: t.dataset.v }, q, { h: null });
  },
  halfPick: () => {
    const e = curEvent(); if (!e) return; const L = lineupOf(e); const k = Math.min(ui.lineQ, L.N - 1); const i = ui.lineSel; if (i < 0 || !L.q[k][i]) return;
    const base = L.side ? sidePool(e, L.side) : roster(e).confirmed; const on = new Set(L.q[k].filter(Boolean));
    const free = base.filter(p => !on.has(p.id) && availFrom(e, p.id) <= k + 1);
    const others = activePlayers().filter(p => !on.has(p.id) && !free.includes(p));
    playerPicker(`${k + 1}쿼터 ${L.spots[i][3]} 후반 교체`, { current: L.h[k][i] || "", tag: pid => { const j = halfInOf(L, k, pid); return j >= 0 && j !== i ? `(지금 후반 ${L.spots[j][3]})` : ""; }, sections: [["이번 쿼터 쉬는 사람", free], ["그 외 선수", others]], extra: [] }, pid => {
      const cur = S.events[e.id]; if (!cur) return; const L2 = lineupOf(cur); const j = halfInOf(L2, k, pid);
      if (j >= 0 && j !== i) halfSave(cur, L2, k, j, null);
      halfSave(cur, L2, k, i, pid); ui.lineSel = -1; ui.lineMsg = `${k + 1}쿼터 ${L2.spots[i][3]}: ${pname(L2.q[k][i])} 전반, ${pname(pid)} 후반이에요.`; render();
    });
  },
  halfClear: () => { const e = curEvent(); if (!e) return; const L = lineupOf(e); const k = Math.min(ui.lineQ, L.N - 1); const i = ui.lineSel; if (i < 0) return; halfSave(e, L, k, i, null); ui.lineSel = -1; ui.lineMsg = "반쿼터 교체를 없앴어요."; render(); },
  lineupPdf: t => { const e = S.events[t.dataset.eid] || curEvent(); if (e) lineupPdf(e); },
  pickSlot: t => {
    const e = curEvent(); if (!e) return; const L = lineupOf(e); const k = Math.min(ui.lineQ, L.N - 1); const i = Number(t.dataset.i);
    const slots = L.q[k];
    const rr = roster(e); const base = L.side ? sidePool(e, L.side) : rr.confirmed;
    const avail = base.filter(p => availFrom(e, p.id) <= k + 1);
    const late = base.filter(p => availFrom(e, p.id) > k + 1);
    const others = activePlayers().filter(p => !base.includes(p));
    const where = pid => { const j = slots.indexOf(pid); return j >= 0 ? `(지금 ${L.spots[j][3]})` : ""; };
    playerPicker(`${k + 1}쿼터 ${L.spots[i][3]} 자리`, { current: slots[i], tag: where, sections: [["이번 쿼터 가능", avail], ["아직 안 옴", late], ["그 외 선수", others]], extra: slots[i] ? [["__none", "이 자리 비우기"]] : [] }, pid => {
      const cur = S.events[e.id]; if (!cur) return; const L2 = lineupOf(cur);
      const sl = L2.q[k].slice();
      if (pid === "__none") sl[i] = null;
      else { const j = sl.indexOf(pid); if (j >= 0) sl[j] = sl[i]; sl[i] = pid; }
      const q = L2.q.slice(); q[k] = sl; lineupSave(cur, L2, q);
    });
  },
  autoLineup: () => {
    const e = curEvent(); if (!e) return; const L = lineupOf(e);
    const base = L.side ? sidePool(e, L.side) : roster(e).confirmed;
    if (!base.length) { toast(L.side ? "먼저 이 팀 스쿼드를 골라 주세요" : "참석 탭에서 확정 인원이 생기면 배치할 수 있어요"); return; }
    const out = autoRotate(e); const q = L.q.map((_, k) => out[k + 1]);
    lineupSave(e, L, q);
    const cnt = {}; q.forEach(sl => sl.forEach(id => { if (id) cnt[id] = (cnt[id] || 0) + 1; }));
    const vals = base.filter(p => availFrom(e, p.id) === 1).map(p => cnt[p.id] || 0);
    toast(vals.length ? `배치했어요. 정시에 오는 사람은 ${Math.min(...vals)}에서 ${Math.max(...vals)}쿼터씩 뛰어요` : "배치했어요");
  },
  copyQ: () => { const e = curEvent(); if (!e) return; const L = lineupOf(e); const k = Math.min(ui.lineQ, L.N - 1); const q = L.q.map(() => L.q[k].slice()); lineupSave(e, L, q); toast(`${k + 1}쿼터 배치를 모든 쿼터에 복사했어요`); },
  clearQ: () => { const e = curEvent(); if (!e) return; const L = lineupOf(e); const k = Math.min(ui.lineQ, L.N - 1); const q = L.q.slice(); q[k] = L.spots.map(() => null); lineupSave(e, L, q); },
  // 회비와 벌금
  moneyTab: t => { ui.moneyTab = t.dataset.v; render(); },
  goDues: () => { ui.moneyTab = "dues"; ui.month = thisMonth(); },
  goFines: () => { ui.moneyTab = "fines"; ui.fineFilter = "unpaid"; },
  goReq: () => { ui.moneyTab = "req"; },
  month: t => { ui.month = shiftMonth(ui.month, Number(t.dataset.d)); render(); },
  cycleDue: t => {
    const m = ui.month; const cur = duesState(m, t.dataset.pid);
    const next = cur === "" ? "paid" : cur === "paid" ? "exempt" : "";
    patchDoc("dues/" + m, { [t.dataset.pid]: next }); render(); scheduleSync();
  },
  allPaid: () => {
    const m = ui.month; const patch = {};
    activePlayers().forEach(p => { if (!duesState(m, p.id)) patch[p.id] = "paid"; });
    patchDoc("dues/" + m, patch); render(); scheduleSync(); toast("모두 납부로 표시했습니다");
  },
  shareDues: () => {
    const m = ui.month; const un = activePlayers().filter(p => !duesState(m, p.id));
    const acct = String(S.settings.account || "").trim();
    textSheet("미납자 알림 문구", [`[${S.settings.teamName || "우리 팀"}] ${fmtMonth(m)} 회비 ${won(S.settings.fee)}`, `아직 안 낸 분: ${un.map(p => p.name).join(", ")}`, acct ? `입금 계좌: ${acct}` : "", "입금 후 앱에서 '입금했어요'를 눌러 주세요."].filter(Boolean).join("\n"), "단톡방에 붙여 넣으세요.");
  },
  payOk: t => {
    const u = t.dataset.u, k = t.dataset.k; const it = S.payreq[u] && S.payreq[u].items && S.payreq[u].items[k]; if (!it) return;
    if (it.kind === "dues") patchDoc("dues/" + it.ref, { [it.pid]: "paid" });
    else if (it.kind === "fine" && S.fines.some(f => f.id === it.ref)) patchDoc("fines/" + it.ref, { paid: true });
    patchDoc("payreq/" + u, { items: { [k]: { status: "ok", doneAt: nowIso() } } }); render(); scheduleSync(); toast("확인 완료, 납부 처리했어요");
  },
  payNo: t => { patchDoc("payreq/" + t.dataset.u, { items: { [t.dataset.k]: { status: "no", doneAt: nowIso() } } }); render(); toast("확인 안 됨으로 표시했어요. 팀원 화면에 안내가 보여요"); },
  fineFilter: t => { ui.fineFilter = t.dataset.v; render(); },
  newFine: () => { if (!S.players.length) { toast("선수를 먼저 등록해 주세요"); return; } fineSheet(null); },
  editFine: t => fineSheet(S.fines.find(f => f.id === t.dataset.id)),
  toggleFine: t => { const f = S.fines.find(x => x.id === t.dataset.id); if (!f) return; patchDoc("fines/" + f.id, { paid: !f.paid }); render(); },
  addPreset: () => { const box = $("#presetRows"); box.insertAdjacentHTML("beforeend", presetRow({ id: uid(), label: "", amount: "" })); box.lastElementChild.querySelector("input").focus(); },
  delPreset: t => { t.closest(".presets").remove(); },
  exportData: async () => {
    if (!Store.dl) return;
    const data = JSON.stringify({ app: "fc-manager", version: 2, exportedAt: nowIso(), ...clone({ settings: S.settings, players: S.players, dues: S.dues, fines: S.fines, events: S.events, links: S.rsvp }) }, null, 1);
    try { const r = await Store.dl.save({ filename: `축구팀-백업-${todayStr()}.json`, data }); if (r && r.status === "saved") toast("백업 파일을 저장했습니다"); }
    catch (e) { if (e && e.code !== "cancelled" && e.code !== "declined") toast("백업 파일을 만들지 못했습니다"); }
  },
  resetAll: () => confirmSheet("모든 데이터 지우기", "선수, 일정, 회비, 벌금 기록이 모두 사라집니다. 먼저 백업 파일을 받아 두는 것을 권합니다.", "모두 지우기", () => replaceAll({ settings: DEFAULT_SETTINGS(), players: [], dues: {}, fines: [], events: {} }, "모든 데이터를 지웠습니다")),
  loadSample: () => replaceAll(makeSample(), "예시 데이터를 넣었습니다"),
  clearSample: () => confirmSheet("예시 지우기", "예시 선수와 기록을 모두 지우고 빈 상태로 시작할까요? 그동안 직접 입력한 내용도 함께 지워집니다.", "지우기", () => replaceAll({ settings: { ...DEFAULT_SETTINGS(), teamName: "" }, players: [], dues: {}, fines: [], events: {} }, "예시를 지웠습니다. 이제 내 팀을 등록해 보세요")),
};

// 권한별로 누를 수 있는 것
const READ_ACTS = new Set(["goLineup", "previewMember", "previewViewer", "previewOff", "previewPick", "closeSheet", "closeSheetScrim", "toggleBig", "closePromo", "rankTab", "copyAcct", "editPlayer", "toggleInactive", "schedFilter", "evTab", "attFilter", "lineQ", "moneyTab", "goDues", "goFines", "goReq", "month", "fineFilter", "editFine", "shareCheck", "shareEvent"]);
const VOTE_ACTS = new Set(["posReqOpen", "posReqCancel", "myVote", "myLateQ", "claimOpen", "claimNew", "unclaim", "payReq"]);
const OWNER_ACTS = new Set(["resetAll", "loadSample", "clearSample"]);
document.addEventListener("click", ev => {
  const t = ev.target.closest("[data-act]");
  if (!t) return;
  const act = t.dataset.act; const fn = ACT[act]; if (!fn) return;
  if (Store.mode === "loading" && !/^close/.test(act)) return;
  if (Store.preview && act === "claimOpen") { ACT.previewPick(t); return; }
  if (Store.preview && !READ_ACTS.has(act)) { ev.preventDefault(); toast("미리보기 화면이라 저장되지 않아요"); return; }
  if (!Store.canWrite && !READ_ACTS.has(act) && !(Store.canVote && VOTE_ACTS.has(act))) { ev.preventDefault(); toast(VOTE_ACTS.has(act) ? "아직 팀원 권한이 없어요. 운영진에게 '사용 가능' 권한을 요청해 주세요." : "운영진만 할 수 있어요."); return; }
  if (!Store.isOwner && OWNER_ACTS.has(act)) { ev.preventDefault(); toast("링크 소유자만 할 수 있습니다."); return; }
  fn(t, ev);
});
document.addEventListener("change", ev => {
  const t = ev.target;
  if (t.id === "yearSel") { ui.year = t.value; render(); }
  if (t.dataset && t.dataset.finesel) { ui.fineSel[t.dataset.finesel] = t.checked; t.blur(); render(); }
  if (t.id === "importFile" && t.files && t.files[0] && Store.isOwner) {
    const file = t.files[0]; const rd = new FileReader();
    rd.onload = () => {
      let d; try { d = JSON.parse(rd.result); if (!d || !Array.isArray(d.players) || !isObj(d.events)) throw 0; } catch (e) { toast("백업 파일을 읽지 못했습니다. 이 앱에서 받은 .json 파일인지 확인해 주세요."); return; }
      confirmSheet("백업에서 복원", `${file.name} 의 내용(선수 ${d.players.length}명, 일정 ${Object.keys(d.events || {}).length}개)으로 지금 데이터를 바꿀까요?`, "복원", () => replaceAll(d, "복원했습니다"));
    };
    rd.readAsText(file); t.value = "";
  }
});
document.addEventListener("input", ev => {
  const t = ev.target;
  if (t.dataset.input === "memo" && Store.canWrite) { const e = curEvent(); if (!e) return; evPatch(e.id, { memo: t.value }, 700); }
});
document.addEventListener("submit", ev => {
  if (ev.target.id === "pf") { ev.preventDefault(); savePlayerForm(ev.target); return; }
  if (ev.target.id !== "cfgForm") return;
  ev.preventDefault(); if (!Store.canWrite) return; const f = ev.target;
  const presets = Array.from(f.querySelectorAll(".presets")).map(r => ({ id: r.dataset.pid, label: r.querySelector('[name="pl"]').value.trim(), amount: Number(digits(r.querySelector('[name="pa"]').value)) || 0 })).filter(p => p.label);
  setDoc("team/settings", { ...S.settings, teamName: f.elements["teamName"].value.trim(), cap: Number(digits(f.elements["cap"].value)) || 0, checkBefore: Number(digits(f.elements["checkBefore"].value)) || 0, lateCancelH: Number(digits(f.elements["lateCancelH"].value)) || 0, fee: Number(digits(f.elements["fee"].value)) || 0, account: f.elements["account"].value.trim(), shareLink: f.elements["shareLink"].value.trim(), finePresets: presets, guestFee: Number(digits(f.elements["guestFee"].value)) || 0 });
  render(); toast("설정을 저장했습니다");
});
document.addEventListener("keydown", ev => { if (ev.key === "Escape" && $("#sheetroot").innerHTML) closeSheet(); });

let toastTimer = null;
function toast(msg) {
  const r = $("#toastroot"); r.innerHTML = `<div class="toast" role="status">${esc(msg)}</div>`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { r.innerHTML = ""; }, 2600);
}

/* ---------- sample data (clearly flagged) ---------- */
function makeSample() {
  const names = [["김도현", 1, "GK"], ["이준서", 2, "DF"], ["박지훈", 4, "DF"], ["최민재", 5, "DF"], ["정우진", 3, "DF"], ["강시우", 6, "MF"], ["조현우", 8, "MF"], ["윤서준", 10, "MF"], ["장하준", 7, "MF"], ["임도윤", 9, "FW"], ["한예준", 11, "FW"], ["오승민", 14, "MF"], ["서지호", 15, "DF"], ["신유찬", 17, "FW"], ["배성호", 21, "GK"], ["문재원", 18, "MF"]];
  const players = names.map(([n, num, pos], i) => ({ id: "s" + i, name: n, num: String(num), pos, phone: "", active: true, joined: "2026-03-01" }));
  const t = parseD(todayStr());
  const day = k => { const d = new Date(t); d.setDate(d.getDate() + k); return ymd(d); };
  const ids = players.map(p => p.id);
  const att = (seed, lateIdx = []) => { const a = {}; ids.forEach((id, i) => { a[id] = (i * 7 + seed) % 5 === 0 ? "no" : lateIdx.includes(i) ? "late" : "yes"; }); return a; };
  const stamp = (a, base) => { const o = {}; Object.keys(a).forEach((id, i) => { o[id] = new Date(Date.parse(base) + i * 60000).toISOString(); }); return o; };
  const events = {
    se1: { id: "se1", type: "match", format: "11", date: day(-21), time: "08:00", place: "예시 대운동장", opponent: "예시 FC 블루", att: att(1, [4]), score: { us: 3, them: 1 }, goals: [{ id: "g1", pid: "s9", assist: "s7", q: 1 }, { id: "g2", pid: "s7", assist: "", q: 2 }, { id: "g3", pid: "s9", assist: "s10", q: 4 }] },
    se2: { id: "se2", type: "training", format: "futsal", date: day(-14), time: "20:00", place: "예시 풋살장", title: "패스 훈련", att: att(2, [6]) },
    se3: { id: "se3", type: "match", format: "futsal", date: day(-7), time: "19:00", place: "예시 풋살장", opponent: "예시 유나이티드", att: att(3), score: { us: 2, them: 2 }, goals: [{ id: "g4", pid: "s10", assist: "s5", q: 3 }, { id: "g5", pid: "s7", assist: "s10", q: 7 }] },
    se4: { id: "se4", type: "match", format: "11", date: day(4), time: "20:00", place: "예시 대운동장", opponent: "내전", att: { s0: "yes", s1: "yes", s2: "yes", s5: "yes", s6: "late", s7: "yes", s9: "yes", s10: "yes", s11: "yes", s12: "yes", s13: "yes", s4: "yes", s8: "late", s14: "yes", s15: "yes", s3: "no" }, lateQ: { s6: 2, s8: 3 } }
  };
  Object.values(events).forEach((e, i) => { e.attAt = stamp(e.att, new Date(Math.min(Date.parse(e.date + "T00:00:00") - 3 * 864e5, Date.now() - 864e5)).toISOString()); });
  const checkOfS = (ev, over) => Object.assign(Object.fromEntries(Object.entries(ev.att).filter(([, v]) => v === "yes" || v === "late").map(([k]) => [k, "in"])), over);
  events.se1.check = checkOfS(events.se1, { s4: "late" });
  events.se3.check = checkOfS(events.se3, { s3: "absent" });
  const m = thisMonth(), pm = shiftMonth(m, -1);
  const dues = { [pm]: Object.fromEntries(ids.map((id, i) => [id, i === 12 ? "exempt" : "paid"])), [m]: Object.fromEntries(ids.slice(0, 8).map(id => [id, "paid"])) };
  const fines = [{ id: "sf1", pid: "s4", date: day(-21), reason: "지각", amount: 5000, paid: true, presetId: "late", eventId: "se1" }, { id: "sf2", pid: "s6", date: day(-14), reason: "지각", amount: 5000, paid: false, presetId: "late", eventId: "se2" }, { id: "sf3", pid: "s3", date: day(-7), reason: "무단 불참", amount: 10000, paid: false, presetId: "noshow", eventId: "se3" }];
  return { settings: { ...DEFAULT_SETTINGS(), teamName: "예시 FC", sample: true, account: "[예시 은행 계좌번호]" }, players, dues, fines, events };
}



function savePlayerForm(f) {
  if (!Store.canWrite) return;
  const isNew = !!f.dataset.new; const id = f.dataset.pid; const p = playerById(id) || { id, phone: "" };
  const name = f.elements["name"].value.trim(); if (!name) { f.elements["name"].focus(); return; }
  const num = digits(f.elements["num"].value);
  if (num && S.players.some(x => x.id !== id && x.active !== false && String(x.num) === num)) toast(`등번호 ${num}번을 쓰는 활동 선수가 이미 있어요.`);
  const { phone: _ph, ...rest } = p;
  const main = ui.pe.p1 || ui.pe.p2, sub = ui.pe.p1 && ui.pe.p2 !== ui.pe.p1 ? ui.pe.p2 : "";
  const rest2 = $('[data-act="peRest"]', f); const active = !(rest2 && rest2.getAttribute("aria-checked") === "true");
  const np = { ...rest, id, name, num, pos1: main, pos2: sub, pos: main ? DGROUP[main] : (p.pos1 ? "" : p.pos || ""), active };
  if (isNew) np.joined = todayStr();
  setDoc("players/" + id, np);
  const phone = f.elements["phone"].value.trim(); if (phone !== (p.phone || "")) { if (phone) setDoc("contacts/" + id, { phone }); else delDoc("contacts/" + id); }
  toast(isNew ? `${name} 선수를 추가했어요` : "저장했어요");
  if (isNew) { ui.newPid = ""; location.hash = "players"; } else render();
}
function paintPe(act, state) {
  document.querySelectorAll(`[data-act="${act}"]`).forEach(b => { const k = b.dataset.k, v = b.dataset.v; const sel = state[k] || (k === "p2" ? "없음" : ""); const other = state[k === "p1" ? "p2" : "p1"]; b.setAttribute("aria-checked", String(sel === v)); b.disabled = v !== "없음" && other === v; });
}
const uvPatch = patch => patchDoc("uvote/" + Store.me, patch);
Object.assign(ACT, {
  voteSheet: () => voteSheet(),
  evQ: t => { ui.evQ = Number(t.dataset.v) || 0; render(); },
  mlQ: t => { ui.mlQ = Number(t.dataset.v) || 0; render(); },
  goEvTab: t => { ui.evFor = t.dataset.eid; ui.evTab = t.dataset.v; },
  rptTab: t => { ui.rptTab = t.dataset.v; render(); },
  claimPick: t => { ui.claimPick = t.dataset.pid; render(); },
  claimConfirm: () => { const pid = ui.claimPick; if (!pid || !playerById(pid)) return; patchDoc("rsvp/" + Store.me, { pid, claimAt: nowIso(), reqName: "" }); ui.claimPick = ""; location.hash = "home"; render(); toast(`${pname(pid)} 선수로 연결했어요. 이제 바로 투표할 수 있어요`); },
  posSel: t => { const k = t.dataset.k, v = t.dataset.v; ui.posSel[k] = v === "없음" ? "" : v; if (ui.posSel.p1 && ui.posSel.p1 === ui.posSel.p2) ui.posSel.p2 = ""; render(); },
  posSend: () => { const p = playerById(myPid()); if (!p || !ui.posSel || !ui.posSel.p1) return; const sub = ui.posSel.p2 && ui.posSel.p2 !== ui.posSel.p1 ? ui.posSel.p2 : ""; patchDoc("rsvp/" + Store.me, { pid: p.id, posReq: { pid: p.id, pos1: ui.posSel.p1, pos2: sub, at: nowIso(), status: "req" } }); render(); toast("포지션 변경을 요청했어요. 운영진이 확인하면 바뀌어요"); },
  guestOpen: t => { const e = S.events[t.dataset.eid] || curEvent(); if (e) guestSheet(e); },
  guestOk: t => {
    const u = t.dataset.u, k = t.dataset.k; const g = S.guestreq[u] && S.guestreq[u].items && S.guestreq[u].items[k]; if (!g) return; const e = S.events[g.eid]; if (!e) return;
    const c = attCounts(e); if (c.capAll !== Infinity && c.all >= c.capAll) { toast("정원이 찼어요. 더 받으려면 누군가 빠져야 해요"); return; }
    evPatch(e.id, { guests: { [k]: { name: g.name, pos: g.pos || "", pid: g.pid || "", at: nowIso() } } });
    patchDoc("guestreq/" + u, { items: { [k]: { status: "ok", doneAt: nowIso() } } });
    if (g.pid && Number(S.settings.guestFee) > 0 && playerById(g.pid)) setDoc("fines/" + k, { id: k, pid: g.pid, date: e.date, reason: `게스트비 (${g.name})`, amount: Number(S.settings.guestFee) || 0, paid: false, presetId: "guest", eventId: e.id, by: Store.me || "" });
    render(); scheduleSync(); toast(`${g.name} 게스트를 승인했어요`);
  },
  guestNo: t => { patchDoc("guestreq/" + t.dataset.u, { items: { [t.dataset.k]: { status: "no", doneAt: nowIso() } } }); render(); toast("거절했어요"); },
  guestRemove: t => { const e = curEvent(); if (!e) return; const g = guestsOf(e).find(x => x.id === t.dataset.gid); confirmSheet("게스트 빼기", `${g ? g.name : "게스트"}를 명단에서 뺄까요? 붙은 게스트비는 벌금 화면에서 따로 지워 주세요.`, "빼기", () => { evPatch(e.id, { guests: { [t.dataset.gid]: null } }); render(); }); },
  noticeNew: () => noticeSheet(null),
  noticeEdit: t => noticeSheet(S.notices.find(n => n.id === t.dataset.id)),
  pollVote: t => { const nid = t.dataset.nid, opt = t.dataset.opt; const cur = (myUvote().poll || {})[nid]; const nv = cur === opt ? "" : opt; if (!Store.preview) markVote("poll-" + nid, nv, cur || ""); uvPatch({ poll: { [nid]: nv } }); render(); },
  inboxRead: () => { uvPatch({ inboxAt: nowIso() }); render(); toast("모두 읽음으로 바꿨어요"); },
  inboxToggle: t => { const off = prefs().inboxOff || {}; off[t.dataset.k] = !off[t.dataset.k]; setPref("inboxOff", off); render(); },
  momPick: t => { ui.momPick[t.dataset.eid] = t.dataset.pid; render(); },
  momSend: t => { const eid = t.dataset.eid; const pid = ui.momPick[eid]; const e = S.events[eid]; if (!pid || !e || !momOpen(e)) return; if ((myUvote().mom || {})[eid]) return; if (!Store.preview) markVote("mom-" + eid, pid, ""); uvPatch({ mom: { [eid]: pid } }); render(); toast(`${pname(pid)} 선수에게 투표했어요`); },
  feeCharge: t => {
    const e = S.events[t.dataset.eid]; if (!e) return; const F = feeSplit(e); if (!F.ppl.length || !F.per) return;
    confirmSheet("구장비 청구", `${F.ppl.length}명에게 ${won(F.per)}씩 '구장비'로 청구할까요? 각자 내 회비 화면에 보여요.`, "청구", () => {
      F.ppl.forEach((p, i) => { const id = uid() + "f" + i; setDoc("fines/" + id, { id, pid: p.id, date: e.date, reason: "구장비", amount: F.per, paid: false, presetId: "field", eventId: e.id, by: Store.me || "" }, 300 + i * 50); });
      evPatch(e.id, { feeCharged: true }); render(); scheduleSync(); toast(`${F.ppl.length}명에게 청구했어요`);
    });
  },
  // 내전 스쿼드: 한 명씩 조끼팀, 일반팀, 빼기
  teamSet: t => { const e = S.events[t.dataset.eid]; if (!e) return; const cur = teamsOf(e).t[t.dataset.pid] || ""; const v = t.dataset.v === cur ? null : (t.dataset.v || null); evPatch(e.id, { teams: { [t.dataset.pid]: v }, teamsAt: "" }); render(); },
  teamClear: t => { const e = S.events[t.dataset.eid]; if (!e) return; confirmSheet("스쿼드 비우기", "고른 팀을 모두 지울까요? 라인업은 그대로 남지만 스쿼드에서 빠진 사람은 휴식 칸에서도 사라져요.", "비우기", () => { evPatch(e.id, { teams: Object.fromEntries(Object.keys(e.teams || {}).map(k => [k, null])), teamsAt: "" }); render(); }); },
  teamMove: t => { const e = S.events[t.dataset.eid]; if (!e) return; const T = { ...teamsOf(e).t }; T[t.dataset.pid] = T[t.dataset.pid] === "A" ? "B" : "A"; evPatch(e.id, { teams: T, teamsAt: "" }); render(); },
  teamShuffle: t => { const e = S.events[t.dataset.eid]; if (!e) return; ui.splitSeed = (ui.splitSeed || 0) + 1; evPatch(e.id, { teams: autoTeams(e, ui.splitSeed), teamsAt: "" }); render(); },
  teamConfirm: t => { const e = S.events[t.dataset.eid]; if (!e) return; evPatch(e.id, { teams: { ...teamsOf(e).t }, teamsAt: nowIso() }); render(); textSheet("팀을 확정했어요", teamText(S.events[e.id] || e), "단톡방에 붙여 넣으세요. 팀원 일정 화면에도 바로 보여요."); },
  teamShare: t => { const e = S.events[t.dataset.eid]; if (e) textSheet("팀 공유 문구", teamText(e), "단톡방에 붙여 넣으세요."); },
  teamUnconfirm: t => { const e = S.events[t.dataset.eid]; if (!e) return; evPatch(e.id, { teamsAt: "" }); render(); },
  slotTap: t => {
    const e = curEvent(); if (!e) return; const L = lineupOf(e); const k = Math.min(ui.lineQ, L.N - 1); const i = Number(t.dataset.i); const sel = ui.lineSel;
    if (sel < 0) { ui.lineSel = i; ui.lineMsg = ""; render(); return; }
    if (sel === i) { ui.lineSel = -1; ui.lineMsg = ""; render(); return; }
    const sl = L.q[k].slice(); const a = sl[sel]; sl[sel] = sl[i]; sl[i] = a; const q = L.q.slice(); q[k] = sl;
    ui.lineSel = -1; ui.lineMsg = `${L.spots[sel][3]}와 ${L.spots[i][3]} 자리를 바꿨어요.`; lineupSave(e, L, q);
  },
  benchTap: t => {
    const e = curEvent(); if (!e) return; const L = lineupOf(e); const k = Math.min(ui.lineQ, L.N - 1); const sel = ui.lineSel; const pid = t.dataset.pid;
    if (sel < 0) { ui.lineMsg = "먼저 바꿀 자리를 누르세요."; render(); return; }
    const sl = L.q[k].slice(); const out = sl[sel]; const j = sl.indexOf(pid); if (j >= 0) sl[j] = out; sl[sel] = pid; const q = L.q.slice(); q[k] = sl;
    ui.lineSel = -1; ui.lineMsg = `${out ? pname(out) + " 대신 " : ""}${pname(pid)}, ${L.spots[sel][3]} 자리에 넣었어요.`; lineupSave(e, L, q);
  },
  pePos: t => { const k = t.dataset.k, v = t.dataset.v; ui.pe[k] = v === "없음" ? "" : v; if (ui.pe.p1 && ui.pe.p1 === ui.pe.p2) ui.pe.p2 = ""; paintPe("pePos", ui.pe); },
  peRest: t => { t.setAttribute("aria-checked", String(t.getAttribute("aria-checked") !== "true")); },
  peDel: t => { const p = playerById(t.dataset.id); if (!p) return; confirmSheet("선수 삭제", `${p.name} 선수를 삭제할까요? 지난 기록에는 '삭제된 선수'로 표시돼요. 그만둔 선수라면 삭제 대신 휴면으로 두는 것을 권해요.`, "삭제", () => { delDoc("players/" + p.id); if (p.phone) delDoc("contacts/" + p.id); location.hash = "players"; toast("삭제했어요"); }); },
  unlink: t => { patchDoc("rsvp/" + t.dataset.u, { pid: "" }); render(); toast("계정 연결을 해제했어요"); },
});
["voteSheet", "evQ", "mlQ", "lineSide", "lineupPdf", "goEvTab", "rptTab", "claimPick", "posSel", "inboxToggle", "momPick", "teamShare", "pePos", "peRest", "noticeEdit"].forEach(a => READ_ACTS.add(a));
["claimConfirm", "posSend", "guestOpen", "pollVote", "inboxRead", "momSend"].forEach(a => VOTE_ACTS.add(a));
/* 화면을 그린 뒤 할 일: 공지를 열면 읽음으로 표시 */
function afterRender(v) {
  if (v === "notice" && Store.canVote && !Store.preview && Store.me && S.notices.length) {
    const seen = myUvote().seen || {}; const add = {}; S.notices.forEach(n => { if (!seen[n.id]) add[n.id] = nowIso(); });
    if (Object.keys(add).length) setTimeout(() => uvPatch({ seen: add }), 400);
  }
}
