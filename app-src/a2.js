
/* ---------- derived data ---------- */
const playerById = id => S.players.find(p => p.id === id);
const pname = id => id === "__og" ? "상대 자책골" : (playerById(id)?.name || "삭제된 선수");
const activePlayers = () => S.players.filter(p => p.active !== false).sort(sortPlayers);
function sortPlayers(a, b) { const pa = POS.indexOf(a.pos), pb = POS.indexOf(b.pos); if (pa !== pb) return (pa < 0 ? 9 : pa) - (pb < 0 ? 9 : pb); return (Number(a.num) || 999) - (Number(b.num) || 999) || String(a.name).localeCompare(String(b.name), "ko"); }
const eventsSorted = () => Object.values(S.events).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
const isPast = e => e.date < todayStr();
const isPlay = e => !!e && (e.type === "match" || e.type === "scrim");
const hasScore = e => isPlay(e) && e.score && Number.isFinite(e.score.us) && Number.isFinite(e.score.them);
function resultOf(e) { if (!hasScore(e)) return null; return e.score.us > e.score.them ? "W" : e.score.us < e.score.them ? "L" : "D"; }
const going = v => v === "yes" || v === "late";
const quartersOf = e => QUARTERS[e.format === "futsal" ? "futsal" : "11"];
const evTitle = e => e.type === "scrim" ? (e.title || "내전") : e.type === "match" ? (e.opponent ? (e.opponent === "내전" ? "내전" : "vs " + e.opponent) : "경기") : (e.title || "훈련");
function eventStart(e) {
  const d = parseD(e.date);
  if (/^\d{2}:\d{2}$/.test(e.time || "")) { const [h, m] = e.time.split(":").map(Number); d.setHours(h, m, 0, 0); } else d.setHours(23, 59, 0, 0);
  return d;
}
const started = e => Date.now() >= eventStart(e).getTime();
function phaseOf(e) { if (started(e)) return "after"; if (e.date === todayStr()) return "day"; return "before"; }

/* 계정과 선수 연결 */
function claimOf(u) { const d = S.rsvp[u]; return d && d.pid && playerById(d.pid) ? d.pid : ""; }
const myPid = () => Store.preview ? (Store.preview === "member" ? Store.previewPid || "" : "") : Store.me && Store.canVote ? claimOf(Store.me) : "";
const uidsOf = pid => Object.keys(S.rsvp).filter(u => S.rsvp[u].pid === pid);
const myReq = () => !Store.preview && Store.me && S.rsvp[Store.me] && S.rsvp[Store.me].reqName && !claimOf(Store.me) ? S.rsvp[Store.me] : null;

/* 일정별 실제 참석 상태: 운영진 입력(events) + 본인 투표(rsvp) 중 나중 것 */
function effAtt(e) {
  if (ATTC.has(e.id)) return ATTC.get(e.id);
  const out = { s: {}, at: {}, q: {}, upd: {}, src: {}, cancelAt: {}, cancelIn: {} };
  const att = e.att || {}, attAt = e.attAt || {}, lq = e.lateQ || {}, au = e.attUpd || {}, ca = e.cancelAt || {}, ci = e.cancelIn || {};
  Object.keys(att).forEach(pid => { if (!att[pid]) return; out.s[pid] = att[pid]; out.at[pid] = attAt[pid] || ""; out.q[pid] = Number(lq[pid]) || 0; out.upd[pid] = au[pid] || ""; out.src[pid] = "op"; });
  Object.keys(ca).forEach(pid => { if (ca[pid]) { out.cancelAt[pid] = ca[pid]; out.cancelIn[pid] = !!ci[pid]; } });
  Object.keys(S.rsvp).forEach(u => {
    const d = S.rsvp[u]; const pid = d.pid; if (!pid || !playerById(pid)) return;
    const m = d.ev && d.ev[e.id]; if (!isObj(m)) return;
    const opUpd = au[pid] || "";
    if (opUpd && String(m.upd || "") <= opUpd) return;
    if (m.s) { out.s[pid] = m.s; out.at[pid] = m.at || ""; out.q[pid] = Number(m.q) || 0; } else delete out.s[pid];
    out.upd[pid] = m.upd || ""; out.src[pid] = "me";
    if (m.cancelAt) { out.cancelAt[pid] = m.cancelAt; out.cancelIn[pid] = !!m.cancelIn; } else { delete out.cancelAt[pid]; delete out.cancelIn[pid]; }
  });
  ATTC.set(e.id, out); return out;
}
function lateQ(e, pid) { const A = effAtt(e); if (A.s[pid] !== "late") return 0; const q = Number(A.q[pid]) || 0; return q >= 1 && q <= quartersOf(e) ? q : 0; }
function capOf(e) {
  const raw = e.cap !== undefined && e.cap !== null && e.cap !== "" ? e.cap : S.settings.cap;
  const n = Number(raw); return n > 0 ? n : Infinity;
}
// 참석을 누른 순서대로 정원까지 확정, 나머지는 대기열
function roster(e) {
  const A = effAtt(e);
  const list = S.players.filter(p => going(A.s[p.id])).sort((a, b) => String(A.at[a.id] || "").localeCompare(String(A.at[b.id] || "")) || a.id.localeCompare(b.id));
  const cap = Math.max(0, capOf(e) - guestsOf(e).length);
  const confirmed = list.slice(0, cap), wait = list.slice(cap);
  return { confirmed, wait, cap, ids: new Set(confirmed.map(p => p.id)), waitPos: id => { const k = wait.findIndex(p => p.id === id); return k < 0 ? 0 : k + 1; } };
}
function attCounts(e) {
  const A = effAtt(e); const c = { yes: 0, late: 0, no: 0, none: 0, wait: 0, cap: Infinity, in: 0 };
  const r = roster(e); c.cap = r.cap; c.wait = r.wait.length; c.in = r.confirmed.length; c.guests = guestsOf(e).length; c.capAll = capOf(e); c.all = c.in + c.guests;
  r.confirmed.forEach(p => { c[A.s[p.id]]++; });
  activePlayers().forEach(p => { const v = A.s[p.id]; if (v === "no") c.no++; else if (!going(v)) c.none++; });
  return c;
}
const capText = c => c.cap === Infinity ? "" : ` / ${c.cap}`;
function myState(e) {
  const pid = myPid(); if (!pid) return null;
  const A = effAtt(e); const r = roster(e);
  return { pid, s: A.s[pid] || "", q: lateQ(e, pid), confirmed: r.ids.has(pid), wait: r.waitPos(pid), order: r.confirmed.findIndex(p => p.id === pid) + 1, cap: r.cap, count: r.confirmed.length, waitN: r.wait.length };
}
// 직전 취소: 확정 상태에서 경기 N시간 이내에 불참으로 바꾼 사람
function lateCancels(e) {
  const A = effAtt(e); const H = Number(S.settings.lateCancelH) || 0; if (!H) return [];
  const start = eventStart(e).getTime();
  return Object.keys(A.cancelAt).filter(pid => {
    if (going(A.s[pid]) || !A.cancelIn[pid]) return false;
    const t = Date.parse(A.cancelAt[pid]); return t && t <= start && start - t <= H * 3600e3;
  }).map(playerById).filter(Boolean);
}
/* 현장 출석 */
function checkTime(e) {
  if (!/^\d{2}:\d{2}$/.test(e.time || "")) return "";
  const [h, m] = e.time.split(":").map(Number); let t = h * 60 + m - (Number(S.settings.checkBefore) || 0);
  t = (t + 1440) % 1440; return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}
const checkStarted = e => Object.values(e.check || {}).some(Boolean);
function checkPeople(e) {
  const r = roster(e); const chk = e.check || {};
  const listed = new Set(r.confirmed.map(p => p.id));
  return r.confirmed.concat(S.players.filter(p => !listed.has(p.id) && chk[p.id]).sort(sortPlayers));
}
// 저장 전에는 확정 인원 전원 출석(늦참 신청자는 늦참)으로 본다
function checkOf(e, pid) { const v = (e.check || {})[pid]; if (v) return v; return effAtt(e).s[pid] === "late" ? "excused" : "in"; }
function checkCounts(e) {
  const c = { in: 0, late: 0, absent: 0, excused: 0 };
  checkPeople(e).forEach(p => { c[checkOf(e, p.id)]++; });
  return c;
}
const presetFor = kind => {
  const ps = S.settings.finePresets;
  if (kind === "late") return ps.find(p => /지각/.test(p.label)) || ps[0];
  if (kind === "cancel") return ps.find(p => /직전|취소/.test(p.label)) || ps.find(p => /불참|결석|노쇼/.test(p.label));
  return ps.find(p => /불참|결석|노쇼/.test(p.label));
};
const eventFine = (e, pid, preset) => preset && S.fines.find(f => f.eventId === e.id && f.pid === pid && f.presetId === preset.id);
function fineCands(e) {
  const out = [];
  checkPeople(e).forEach(p => { const v = checkOf(e, p.id); if (v === "late" || v === "absent") out.push({ p, kind: v, why: v === "late" ? "지각" : "무단 불참" }); });
  lateCancels(e).forEach(p => out.push({ p, kind: "cancel", why: "직전 취소" }));
  return out.map(c => ({ ...c, pre: presetFor(c.kind), key: e.id + ":" + c.p.id + ":" + c.kind }));
}
const fineOn = key => ui.fineSel[key] !== false;

/* 쿼터별 라인업 */
// 내전: 운영진이 고른 쪽(조끼팀/일반팀)의 라인업을 다룬다. 팀원은 자기 팀이 먼저 보인다
const squadBase = e => e && e.type === "scrim" ? S.players.filter(p => p.active !== false || (e.teams || {})[p.id]) : roster(e).confirmed;
const sidePool = (e, side) => { const T = teamsOf(e).t; return squadBase(e).filter(p => T[p.id] === side); };
function curSide(e) {
  if (!isScrim(e)) return null;
  if (ui.lineSideEv === e.id && (ui.lineSide === "A" || ui.lineSide === "B")) return ui.lineSide;
  const pid = myPid(); const s = pid && teamsOf(e).t[pid]; return s === "B" ? "B" : "A";
}
function scrimDefaultForm(e, side) {
  if (e.format === "futsal") return "5|" + Object.keys(FORMATIONS.futsal)[0];
  const n = Math.max(5, Math.min(11, sidePool(e, side).length || 11));
  return Object.keys(SCRIM_FORMS).find(k => k.startsWith(n + "|"));
}
const lineFor = (e, pid) => isScrim(e) ? lineupOf(e, teamsOf(e).t[pid] || curSide(e)) : lineupOf(e);
function lineupOf(e, side) {
  if (isScrim(e)) {
    side = side === "A" || side === "B" ? side : curSide(e);
    const forms = SCRIM_FORMS; const N = quartersOf(e); const src = (e.lineS || {})[side];
    const ok = src && forms[src.formation];
    const formation = ok ? src.formation : scrimDefaultForm(e, side); const qs = ok ? src.q || {} : {};
    const spots = forms[formation];
    const q = Array.from({ length: N }, (_, k) => spots.map((_, i) => { const id = (qs[k + 1] || [])[i]; return id && playerById(id) ? id : null; }));
    return { fmt: e.format === "futsal" ? "futsal" : "11", forms, formation, spots, q, N, side };
  }
  const fmt = e.format === "futsal" ? "futsal" : "11"; const forms = FORMATIONS[fmt]; const N = quartersOf(e);
  let formation = Object.keys(forms)[0], qs = {};
  if (e.lineupQ && forms[e.lineupQ.formation]) { formation = e.lineupQ.formation; qs = e.lineupQ.q || {}; }
  else if (e.lineup && forms[e.lineup.formation]) { formation = e.lineup.formation; for (let k = 1; k <= N; k++) qs[k] = e.lineup.slots || []; }
  const spots = forms[formation];
  const q = Array.from({ length: N }, (_, k) => spots.map((_, i) => { const id = (qs[k + 1] || [])[i]; return id && playerById(id) ? id : null; }));
  return { fmt, forms, formation, spots, q, N };
}
const availFrom = (e, pid) => lateQ(e, pid) || 1;
const isGk = p => (p.pos1 || p.pos) === "GK";
// 내 쿼터별 출전 계획: 출전(자리), 휴식, 합류 전
function myPlan(e, pid) {
  if (!e || !pid) return null;
  const L = lineFor(e, pid); const conf = isScrim(e) ? sidePool(e, L.side).some(p => p.id === pid) : roster(e).ids.has(pid);
  const rows = L.q.map((qs, k) => { const i = qs.indexOf(pid); if (i >= 0) return { k, st: "on", lab: L.spots[i][3] }; if (conf && availFrom(e, pid) > k + 1) return { k, st: "late" }; return { k, st: "rest" }; });
  const on = rows.filter(r => r.st === "on").length;
  return { any: L.q.some(qs => qs.some(Boolean)), conf, rows, on, N: L.N, side: L.side };
}
function myPosReq() {
  const pid = myPid(); if (!pid) return null;
  const u = Store.preview ? uidsOf(pid)[0] : Store.me; const r = u && S.rsvp[u] && S.rsvp[u].posReq;
  return r && r.pid === pid ? r : null;
}
function posReqUids() { return Object.keys(S.rsvp).filter(u => { const r = S.rsvp[u].posReq; return r && (r.status === "req" || !r.status) && r.pos1 && claimOf(u) === r.pid; }); }
// 자리 적합도: 낮을수록 잘 맞음
function spotFit(spot, p) {
  const [grp, , , lab] = spot; const fit = SPOT_FIT[lab] || SPOT_FIT[grp] || [];
  const a = fit.indexOf(p.pos1 || ""), b = fit.indexOf(p.pos2 || "");
  if (a >= 0) return a; if (b >= 0) return 10 + b;
  const g1 = p.pos1 ? DGROUP[p.pos1] : p.pos, g2 = p.pos2 ? DGROUP[p.pos2] : "";
  if (g1 === grp) return 20; if (g2 === grp) return 25;
  const near = { DF: ["MF"], MF: ["DF", "FW"], FW: ["MF"] };
  if ((near[grp] || []).includes(g1)) return 30; if (!g1) return 35;
  return g1 === "GK" ? 60 : 40;
}
function autoRotate(e) {
  const L = lineupOf(e); const pool = (L.side ? sidePool(e, L.side) : roster(e).confirmed).filter(p => p.active !== false);
  const played = {}, gkPlayed = {}, prev = {}; const order = new Map(pool.map((p, i) => [p.id, i]));
  pool.forEach(p => { played[p.id] = 0; gkPlayed[p.id] = 0; });
  const gkIdx = L.spots.findIndex(s => s[0] === "GK");
  const out = {};
  for (let k = 1; k <= L.N; k++) {
    const avail = pool.filter(p => availFrom(e, p.id) <= k);
    const remain = p => L.N - Math.max(k, availFrom(e, p.id)) + 1;
    const slots = L.spots.map(() => null); const used = new Set();
    const byNeed = (a, b) => played[a.id] - played[b.id] || remain(a) - remain(b) || isGk(a) - isGk(b) || order.get(a.id) - order.get(b.id);
    if (gkIdx >= 0) {
      // 주 포지션 GK가 먼저, 없으면 부 포지션 GK
      const gkRank = p => isGk(p) ? 0 : p.pos2 === "GK" ? 1 : 9;
      const gks = avail.filter(p => gkRank(p) < 9).sort((a, b) => gkRank(a) - gkRank(b) || gkPlayed[a.id] - gkPlayed[b.id] || played[a.id] - played[b.id] || order.get(a.id) - order.get(b.id));
      const pick = gks[0] || avail.slice().sort(byNeed)[0];
      if (pick) { slots[gkIdx] = pick.id; used.add(pick.id); gkPlayed[pick.id]++; }
    }
    const fieldN = L.spots.length - (gkIdx >= 0 ? 1 : 0);
    const chosen = avail.filter(p => !used.has(p.id)).sort(byNeed).slice(0, fieldN);
    const placed = new Set();
    // 지난 쿼터와 같은 자리가 잘 맞으면 그대로 두고, 나머지는 자리 적합도가 높은 순서로 짝짓기
    chosen.forEach(p => { const ps = prev[p.id]; if (ps != null && ps !== gkIdx && slots[ps] === null && spotFit(L.spots[ps], p) < 20) { slots[ps] = p.id; placed.add(p.id); } });
    const pairs = [];
    L.spots.forEach((s, i) => { if (slots[i] === null && i !== gkIdx) chosen.forEach(p => { if (!placed.has(p.id)) pairs.push([spotFit(s, p), i, p.id]); }); });
    pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    pairs.forEach(([, i, id]) => { if (slots[i] === null && !placed.has(id)) { slots[i] = id; placed.add(id); } });
    L.spots.forEach((s, i) => { if (slots[i] === null && i !== gkIdx) { const p = chosen.find(x => !placed.has(x.id)); if (p) { slots[i] = p.id; placed.add(p.id); } } });
    // 다듬기: 출전 시간이 같은 벤치 선수와 교체하거나, 필드 안에서 자리를 맞바꿔 더 잘 맞으면 바꾼다
    const byId = new Map(avail.map(p => [p.id, p])); const fitAt = (i, id) => spotFit(L.spots[i], byId.get(id));
    const same = (a, b) => played[a.id] === played[b.id] && remain(a) === remain(b);
    for (let pass = 0, better = true; better && pass < 6; pass++) {
      better = false;
      const benchNow = avail.filter(p => !slots.includes(p.id));
      slots.forEach((id, i) => {
        if (!id || i === gkIdx) return;
        for (const b of benchNow) if (!slots.includes(b.id) && same(b, byId.get(id)) && fitAt(i, b.id) < fitAt(i, id)) { slots[i] = b.id; id = b.id; better = true; }
      });
      for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) {
        if (i === gkIdx || j === gkIdx || !slots[i] || !slots[j]) continue;
        if (fitAt(i, slots[j]) + fitAt(j, slots[i]) < fitAt(i, slots[i]) + fitAt(j, slots[j])) { const t = slots[i]; slots[i] = slots[j]; slots[j] = t; better = true; }
      }
    }
    slots.forEach((id, i) => { if (id) { played[id]++; prev[id] = i; } });
    out[k] = slots;
  }
  return out;
}
function playerStats(pid, year) {
  let apps = 0, goals = 0, assists = 0, played = 0;
  Object.values(S.events).forEach(e => {
    if (e.date > todayStr()) return;
    if (year && !e.date.startsWith(year)) return;
    played++;
    if (checkStarted(e)) { const v = (e.check || {})[pid]; if (v === "in" || v === "late" || v === "excused") apps++; }
    else if (roster(e).ids.has(pid)) apps++;
    if (isPlay(e)) (e.goals || []).forEach(g => { if (g.pid === pid) goals++; if (g.assist === pid) assists++; });
  });
  return { apps, goals, assists, played };
}
function duesState(m, pid) { return (S.dues[m] || {})[pid] || ""; }
// 회비: 운영진은 전체 장부를, 팀원은 본인 문서를 본다
function myDuesState(m, pid) {
  if (Store.canMoney || Store.preview) return duesState(m, pid);
  const d = Store.me && S.mydues[Store.me]; return d && d.pid === pid && d.months ? (d.months[m] || "") : "";
}
const unpaidFines = () => S.fines.filter(f => !f.paid);
// 내 벌금: 운영진은 전체 장부에서, 팀원은 본인 문서에서
function myFines(pid) {
  if (Store.canMoney || Store.preview) return S.fines.filter(f => f.pid === pid);
  const d = Store.me && S.mydues[Store.me]; if (!d || d.pid !== pid || !isObj(d.fines)) return [];
  return Object.entries(d.fines).map(([id, f]) => ({ ...f, id, pid }));
}
function myMoney(pid) {
  const m = thisMonth(); const items = [];
  const ds = myDuesState(m, pid);
  const canSeeDues = Store.canMoney || Store.preview || (Store.me && S.mydues[Store.me]);
  if (canSeeDues && !ds && Number(S.settings.fee) > 0) items.push({ key: "dues-" + m, kind: "dues", ref: m, amount: Number(S.settings.fee) || 0, label: `${Number(m.slice(5))}월 회비` });
  myFines(pid).filter(f => !f.paid).sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach(f => items.push({ key: "fine-" + f.id, kind: "fine", ref: f.id, amount: Number(f.amount) || 0, label: `${f.date ? Number(f.date.slice(5, 7)) + "/" + Number(f.date.slice(8, 10)) + " " : ""}${f.reason || "벌금"}` }));
  const ru = Store.preview ? (uidsOf(pid)[0] || "") : Store.me;
  const reqs = (ru && S.payreq[ru] && S.payreq[ru].items) || {};
  items.forEach(it => { const r = reqs[it.key]; it.req = r && r.status ? r.status : ""; });
  return { month: m, dues: ds, canSeeDues: !!canSeeDues, items };
}
function pendingReqs() {
  const out = [];
  Object.keys(S.payreq).forEach(u => { const items = (S.payreq[u] && S.payreq[u].items) || {}; Object.keys(items).forEach(k => { const it = items[k]; if (it && it.status === "req") out.push({ u, key: k, ...it }); }); });
  return out.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
}
function templates() {
  const seen = new Set(); const out = [];
  eventsSorted().slice().reverse().forEach(e => {
    const wd = parseD(e.date).getDay();
    const key = [e.type, e.format, wd, e.time, e.place, e.opponent || e.title, e.cap].join("|");
    if (seen.has(key) || out.length >= 3) return; seen.add(key);
    out.push({ type: e.type, format: e.format === "futsal" ? "futsal" : "11", wd, time: e.time || "", place: e.place || "", opponent: e.opponent || "", title: e.title || "", cap: e.cap ?? "" });
  });
  return out;
}
function nextDateFor(wd) { const d = new Date(); d.setHours(0, 0, 0, 0); for (let i = 0; i < 8; i++) { if (d.getDay() === wd && i > 0) return ymd(d); d.setDate(d.getDate() + 1); } return ymd(d); }

/* ---------- 새 기능: 게스트 ---------- */
function guestsOf(e) { return Object.entries((e && e.guests) || {}).filter(([, g]) => isObj(g) && g.name).map(([id, g]) => ({ ...g, id })); }
function guestReqs() {
  const out = [];
  Object.keys(S.guestreq).forEach(u => { const items = (S.guestreq[u] && S.guestreq[u].items) || {}; Object.keys(items).forEach(k => { const g = items[k]; if (isObj(g) && g.status === "req" && S.events[g.eid] && !started(S.events[g.eid])) out.push({ u, key: k, ...g }); }); });
  return out.sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));
}
function myGuestReqs(eid) {
  const u = Store.preview ? uidsOf(myPid())[0] : Store.me; const items = (u && S.guestreq[u] && S.guestreq[u].items) || {};
  return Object.keys(items).map(k => ({ key: k, ...items[k] })).filter(g => isObj(g) && g.eid === eid);
}

/* ---------- 새 기능: 본인 표 (MOM, 설문, 읽음) ---------- */
const myUid = () => Store.preview ? (uidsOf(myPid())[0] || "") : (Store.me || "");
function myUvote() { const u = myUid(); return (u && S.uvote[u]) || {}; }

/* ---------- MOM ---------- */
function momDeadline(e) { const d = parseD(e.date); d.setDate(d.getDate() + 1); d.setHours(12, 0, 0, 0); return d; }
const momOpen = e => isPlay(e) && started(e) && Date.now() < momDeadline(e).getTime() && attendees(e).length >= 2;
function attendees(e) {
  if (checkStarted(e)) return checkPeople(e).filter(p => ["in", "late", "excused"].includes(checkOf(e, p.id)));
  return roster(e).confirmed;
}
function momTally(e) {
  const t = S.tally["mom-" + e.id] || { n: 0, c: {}, v: [] };
  const out = { n: t.n || 0, c: { ...(t.c || {}) } };
  const mine = (myUvote().mom || {})[e.id]; const u = myUid();
  if (mine && u && !(t.v || []).includes(u)) { out.n++; out.c[mine] = (out.c[mine] || 0) + 1; }
  return out;
}
function momWinners(e) { const t = momTally(e); const max = Math.max(0, ...Object.values(t.c)); return max ? Object.keys(t.c).filter(k => t.c[k] === max) : []; }
function momCount(pid, from, to) { return eventsSorted().filter(e => e.date >= from && e.date <= to && !momOpen(e) && started(e)).filter(e => momWinners(e).includes(pid)).length; }
function momEvents() { return eventsSorted().filter(e => started(e) && (S.tally["mom-" + e.id] || momOpen(e))).reverse(); }
function seasonMomRank(year) {
  const c = {}; eventsSorted().filter(e => e.date.startsWith(year) && started(e) && !momOpen(e)).forEach(e => momWinners(e).forEach(pid => { c[pid] = (c[pid] || 0) + 1; }));
  return Object.entries(c).filter(([pid]) => playerById(pid)).sort((a, b) => b[1] - a[1]).slice(0, 5);
}

/* ---------- 공지와 설문 ---------- */
function pollOpen(n) { return !!(n.poll && n.poll.opts && n.poll.opts.length) && (!n.poll.until || Date.now() < Date.parse(n.poll.until)); }
function pollTally(n) {
  const t = S.tally["poll-" + n.id] || { n: 0, c: {}, v: [] };
  const out = { n: t.n || 0, c: { ...(t.c || {}) } };
  const u = myUid(); const mine = (myUvote().poll || {})[n.id];
  if (u && !Store.canWrite) { const counted = (t.v || []).includes(u); if (mine && !counted) { out.n++; out.c[mine] = (out.c[mine] || 0) + 1; } }
  return out;
}
const seenCount = n => (S.tally["seen-" + n.id] || {}).n || 0;
function pollVoters(n, opt) { return Object.keys(S.uvote).filter(u => ((S.uvote[u] || {}).poll || {})[n.id] === opt).map(u => claimOf(u) ? pname(claimOf(u)) : "팀원"); }

/* ---------- 팀 나누기 ---------- */
function rng(seed) { let x = (seed * 2654435761 >>> 0) || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
function autoTeams(e, seed) {
  const conf = roster(e).confirmed.slice(); const r = rng((seed || 0) + 7);
  const grp = p => isGk(p) ? 0 : p.pos2 === "GK" ? 1 : ({ DF: 2, MF: 3, FW: 4 }[p.pos1 ? DGROUP[p.pos1] : p.pos] || 5);
  const keyed = conf.map(p => ({ p, g: grp(p), k: r() })).sort((a, b) => a.g - b.g || a.k - b.k);
  const out = {}; let a = 0, b = 0, turn = r() < 0.5 ? "A" : "B";
  keyed.forEach((x, i) => {
    let side = turn;
    if (a - b >= 1) side = "B"; else if (b - a >= 1) side = "A";
    out[x.p.id] = side; if (side === "A") a++; else b++;
    turn = side === "A" ? "B" : "A";
  });
  return out;
}
function teamsOf(e) {
  const conf = roster(e).confirmed; const saved = (e && e.teams) || {};
  // 새 내전은 운영진이 한 명씩 고른다. 고르지 않은 사람은 스쿼드 밖
  if (e && e.type === "scrim") { const t = {}; S.players.forEach(p => { if (saved[p.id] === "A" || saved[p.id] === "B") t[p.id] = saved[p.id]; }); return { t, saved: !!e.teamsAt }; }
  const has = conf.length && conf.every(p => saved[p.id] === "A" || saved[p.id] === "B");
  const t = has ? saved : Object.assign(autoTeams(e, 0), Object.fromEntries(Object.entries(saved).filter(([pid, v]) => conf.some(p => p.id === pid) && (v === "A" || v === "B"))));
  return { t, saved: !!(e && e.teamsAt) && has };
}
const isScrim = e => !!e && (e.type === "scrim" || (e.type === "match" && /내전/.test(e.opponent || "")));

/* ---------- 할 일, 신경 써 볼 사람 ---------- */
function feeEvents() { return eventsSorted().filter(e => Number(e.fieldFee) > 0 && !e.feeCharged && roster(e).confirmed.length); }
function feeSplit(e) { const ppl = started(e) && checkStarted(e) ? attendees(e) : roster(e).confirmed; const fee = Number(e.fieldFee) || 0; const per = ppl.length ? Math.ceil(fee / ppl.length / 100) * 100 : 0; return { fee, ppl, per }; }
function watchList() {
  const out = []; const past = eventsSorted().filter(e => started(e)).reverse();
  const m = thisMonth(); const months = [0, -1, -2].map(k => shiftMonth(m, k));
  activePlayers().forEach(p => {
    let streak = 0; for (const e of past) { const A = effAtt(e); const came = checkStarted(e) ? ["in", "late", "excused"].includes((e.check || {})[p.id]) : roster(e).ids.has(p.id); if (came) break; if (A.s[p.id] === "no" || !A.s[p.id]) streak++; else break; }
    if (streak >= 3) out.push({ p, why: `${streak}경기 연속 불참` });
    else {
      const unpaid = months.filter(mm => S.dues[mm] && Object.keys(S.dues[mm]).length && duesState(mm, p.id) === "" && mm >= String(p.joined || "").slice(0, 7)).length;
      if (Number(S.settings.fee) > 0 && unpaid >= 2) out.push({ p, why: `회비 ${unpaid}달 밀림` });
      else { const lates = past.filter(e => e.date.startsWith(m) && (e.check || {})[p.id] === "late").length; if (lates >= 2) out.push({ p, why: `이번 달 지각 ${lates}번` }); }
    }
  });
  return out.slice(0, 6);
}
function todoCount() {
  const next = eventsSorted().find(e => !started(e));
  let n = pendingReqs().length + guestReqs().length + feeEvents().length;
  if (next && attCounts(next).none) n++;
  n += Object.keys(S.rsvp).filter(u => S.rsvp[u].reqName && !claimOf(u)).length + posReqUids().length;
  return n;
}

/* ---------- 내 기록 리포트 ---------- */
function cameTo(e, pid) { return checkStarted(e) ? ["in", "late", "excused"].includes((e.check || {})[pid]) : roster(e).ids.has(pid); }
function reportData(pid, from, to) {
  const evs = eventsSorted().filter(e => started(e) && e.date >= from && e.date <= to);
  let came = 0, goals = 0, assists = 0, quarters = 0, late = 0, absent = 0; const pos = {};
  evs.forEach(e => {
    if (cameTo(e, pid)) came++;
    const ck = (e.check || {})[pid]; if (ck === "late") late++; if (ck === "absent") absent++;
    (e.goals || []).forEach(g => { if (g.pid === pid) goals++; if (g.assist === pid) assists++; });
    const L = lineFor(e, pid); L.q.forEach(qs => { const i = qs.indexOf(pid); if (i >= 0) { quarters++; const lab = L.spots[i][3]; pos[lab] = (pos[lab] || 0) + 1; } });
  });
  let streak = 0; for (const e of evs.slice().reverse()) { if (cameTo(e, pid)) streak++; else break; }
  return { played: evs.length, came, goals, assists, quarters, late, absent, pos, streak, mom: momCount(pid, from, to) };
}
function monthBars(pid) {
  return [-4, -3, -2, -1, 0].map(k => { const m = shiftMonth(thisMonth(), k); const evs = eventsSorted().filter(e => started(e) && e.date.startsWith(m)); return { m, n: evs.length, c: evs.filter(e => cameTo(e, pid)).length }; });
}

/* ---------- 알림함 ---------- */
function inboxItems() {
  const pid = myPid(); if (!pid) return [];
  const out = []; const now = Date.now(); const uv = myUvote();
  eventsSorted().filter(e => !started(e)).forEach(e => {
    const st = myState(e); if (!st) return; const h = (eventStart(e).getTime() - now) / 36e5;
    if (!st.s && h <= 48) out.push({ cat: "vote", tag: "마감", ic: "soft", t: new Date(eventStart(e).getTime() - 48 * 36e5).toISOString(), title: `투표 마감 ${Math.max(1, Math.round(h))}시간 전`, body: `${fmtDate(e.date)} ${evTitle(e)}, 아직 응답하지 않았어요.`, href: "#event-" + e.id });
    const P = myPlan(e, pid);
    const tPast = [e.updatedAt || "", nowIso()].filter(Boolean).sort()[0];
    if (P && P.any && P.conf) out.push({ cat: "line", tag: "라인", ic: "tile", t: tPast, title: "라인업이 나왔어요", body: `${fmtDate(e.date)}: ${P.rows.map(r => `${r.k + 1}Q ${qText(r)}`).join(", ")}`, href: "#lineup-" + e.id });
  });
  eventsSorted().filter(e => momOpen(e) && cameTo(e, pid) && !(uv.mom || {})[e.id]).forEach(e => out.push({ cat: "line", tag: "MOM", ic: "ink", t: eventStart(e).toISOString(), title: "MOM 투표가 열렸어요", body: `${fmtDate(e.date)} ${evTitle(e)}, 내일 정오 마감`, href: "#mom-" + e.id }));
  myFines(pid).filter(f => !f.paid).forEach(f => out.push({ cat: "money", tag: "벌금", ic: "soft", t: (f.date || "") + "T12:00:00", title: "벌금이 부과됐어요", body: `${f.date ? Number(f.date.slice(5, 7)) + "월 " + Number(f.date.slice(8, 10)) + "일 " : ""}${f.reason || "벌금"} ${won(f.amount)}. 본인만 볼 수 있어요.`, href: "#money" }));
  const ru = myUid(); const reqs = (ru && S.payreq[ru] && S.payreq[ru].items) || {};
  Object.values(reqs).forEach(it => { if (isObj(it) && (it.status === "ok" || it.status === "no") && it.doneAt) out.push({ cat: "money", tag: it.status === "ok" ? "확인" : "입금", ic: it.status === "ok" ? "clay" : "soft", t: it.doneAt, title: it.status === "ok" ? "입금이 확인됐어요" : "입금을 확인하지 못했어요", body: `${it.label || ""} ${won(it.amount)}`, href: "#money" }); });
  const pr = myPosReq(); if (pr && (pr.status === "ok" || pr.status === "no")) out.push({ cat: "notice", tag: "포지", ic: "", t: pr.doneAt || pr.at || "", title: pr.status === "ok" ? "포지션 변경 승인" : "포지션 변경 반려", body: `${pr.pos1}${pr.pos2 ? ", " + pr.pos2 : ""}(으)로 바꾸는 요청`, href: "#mypos" });
  S.notices.forEach(n => out.push({ cat: "notice", tag: n.poll ? "설문" : "공지", ic: "", t: n.at || "", title: n.poll ? "새 설문" : "새 공지", body: n.title || "", href: "#notice" }));
  const off = prefs().inboxOff || {};
  return out.filter(i => !off[i.cat]).sort((a, b) => String(b.t).localeCompare(String(a.t))).slice(0, 30).map(i => ({ ...i, unread: String(i.t) > String(uv.inboxAt || "") }));
}
const unreadCount = () => inboxItems().filter(i => i.unread).length;

/* ---------- 단톡방 공유 문구 ---------- */
function shareText(e) {
  const people = checkPeople(e); const c = checkCounts(e);
  const lines = [`[${S.settings.teamName || "우리 팀"}] ${fmtDate(e.date)} ${evTitle(e)} 출석 결과`];
  if (checkTime(e)) lines.push(`출석 체크 ${checkTime(e)} 기준`);
  lines.push(`출석 ${c.in + c.excused}명 / 지각 ${c.late}명 / 결석 ${c.absent}명`);
  ["late", "absent"].forEach(k => { const n = people.filter(p => checkOf(e, p.id) === k); if (n.length) lines.push(`${CHECK[k]}: ${n.map(p => p.name).join(", ")}`); });
  const lc = lateCancels(e); if (lc.length) lines.push(`직전 취소: ${lc.map(p => p.name).join(", ")}`);
  const imposed = S.fines.filter(f => f.eventId === e.id);
  if (imposed.length) { lines.push(""); lines.push("벌금"); imposed.forEach(f => lines.push(`- ${pname(f.pid)} ${f.reason || ""} ${won(f.amount)}${f.paid ? " (납부 완료)" : ""}`)); }
  if (String(S.settings.account || "").trim()) lines.push(`입금 계좌: ${S.settings.account.trim()}`);
  return lines.join("\n");
}
function eventShareText(list) {
  const e = list[0]; const c = attCounts(e);
  const lines = [`[${S.settings.teamName || "우리 팀"}] 참석 투표`];
  list.forEach(ev => lines.push(`${fmtDate(ev.date)}${ev.time ? " " + ev.time : ""} ${evTitle(ev)}`));
  lines.push(`${e.place ? e.place + ", " : ""}${FORMAT_KO[e.format] || ""}`);
  lines.push(`${c.cap === Infinity ? "정원 제한 없음" : `정원 ${c.cap}명, 누른 순서대로 확정`}. 경기 시작 전까지 바꿀 수 있어요.`);
  const link = String(S.settings.shareLink || window.__SHARE_LINK || "").trim();
  lines.push(link ? `투표하기: ${link}` : "앱에서 참석, 늦참, 불참을 눌러 주세요.");
  return lines.join("\n");
}
function nudgeText(e) {
  const A = effAtt(e); const none = activePlayers().filter(p => !A.s[p.id]); const c = attCounts(e);
  const link = String(S.settings.shareLink || window.__SHARE_LINK || "").trim();
  return [`[${S.settings.teamName || "우리 팀"}] ${fmtDate(e.date)}${e.time ? " " + e.time : ""} ${evTitle(e)}`,
    `아직 응답 안 한 분: ${none.map(p => p.name).join(", ")}`,
    `현재 ${c.in}${c.cap === Infinity ? "" : " / " + c.cap}명 확정${c.wait ? `, 대기 ${c.wait}명` : ""}`,
    link ? `투표하기: ${link}` : "앱에서 참석 여부를 눌러 주세요."].join("\n");
}
