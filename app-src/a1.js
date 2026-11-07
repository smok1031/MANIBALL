"use strict";
/* ---------- helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = n => String(n).padStart(2, "0");
const won = n => (Number(n) || 0).toLocaleString("ko-KR") + "원";
const clone = o => o === undefined ? undefined : JSON.parse(JSON.stringify(o));
const nowIso = () => new Date().toISOString();
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => ymd(new Date());
const thisMonth = () => todayStr().slice(0, 7);
const WD = "일월화수목금토";
function parseD(s) { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); }
function fmtDate(s) { const d = parseD(s); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})`; }
function shiftMonth(m, k) { const [y, mo] = m.split("-").map(Number); const d = new Date(y, mo - 1 + k, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
function fmtMonth(m) { const [y, mo] = m.split("-").map(Number); return `${y}년 ${mo}월`; }
function fmtStamp(iso) { const d = new Date(iso); if (!iso || isNaN(d)) return ""; return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
const digits = v => String(v ?? "").replace(/\D/g, "");

/* ---------- constants ---------- */
const POS = ["GK", "DF", "MF", "FW"];
const POS_KO = { GK: "골키퍼", DF: "수비", MF: "미드필더", FW: "공격" };
// 세부 포지션: 주 포지션(pos1), 부 포지션(pos2). pos는 묶음(GK/DF/MF/FW)으로 계속 저장
const DPOS = { GK: ["GK"], DF: ["CB", "LB", "RB", "LWB", "RWB"], MF: ["CDM", "CM", "CAM", "LM", "RM"], FW: ["LW", "RW", "ST", "CF"] };
const DGROUP = {}; Object.entries(DPOS).forEach(([g, list]) => list.forEach(c => { DGROUP[c] = g; }));
const posLabel = p => p && p.pos1 ? p.pos1 + (p.pos2 && p.pos2 !== p.pos1 ? `, ${p.pos2}` : "") : (p && POS_KO[p.pos]) || "";
// 라인업 자리마다 잘 맞는 세부 포지션 (앞일수록 잘 맞음)
const SPOT_FIT = { GK: ["GK"], LB: ["LB", "LWB", "CB"], RB: ["RB", "RWB", "CB"], CB: ["CB", "CDM"], LWB: ["LWB", "LB", "LM", "LW"], RWB: ["RWB", "RB", "RM", "RW"], DM: ["CDM", "CM", "CB"], CM: ["CM", "CDM", "CAM"], AM: ["CAM", "CM", "CF"], LM: ["LM", "LW", "LWB"], RM: ["RM", "RW", "RWB"], LW: ["LW", "LM", "RW", "ST"], RW: ["RW", "RM", "LW", "ST"], ST: ["ST", "CF", "LW", "RW", "CAM"], FIXO: ["CB", "CDM", "LB", "RB"], ALA: ["LW", "RW", "LM", "RM", "LWB", "RWB", "CAM", "CM"], PIVO: ["ST", "CF", "CAM"], DF: ["CB", "LB", "RB", "CDM", "LWB", "RWB"], FW: ["ST", "CF", "LW", "RW", "CAM"] };
const ATT = { yes: "참석", late: "늦참", no: "불참" };
const ATT_SUB = { yes: "갈게요", late: "늦게 가요", no: "못 가요" };
const CHECK = { in: "출석", late: "지각", absent: "결석", excused: "늦참" };
const FORMAT_KO = { "11": "11인 축구", futsal: "풋살" };
// [group, x%, y%, label]  (our goal at bottom)
const FORMATIONS = {
  "11": {
    "4-4-2": [["GK",50,90,"GK"],["DF",14,72,"LB"],["DF",37,76,"CB"],["DF",63,76,"CB"],["DF",86,72,"RB"],["MF",14,49,"LM"],["MF",37,52,"CM"],["MF",63,52,"CM"],["MF",86,49,"RM"],["FW",37,24,"ST"],["FW",63,24,"ST"]],
    "4-3-3": [["GK",50,90,"GK"],["DF",14,72,"LB"],["DF",37,76,"CB"],["DF",63,76,"CB"],["DF",86,72,"RB"],["MF",27,51,"CM"],["MF",50,57,"DM"],["MF",73,51,"CM"],["FW",17,26,"LW"],["FW",50,20,"ST"],["FW",83,26,"RW"]],
    "4-2-3-1": [["GK",50,90,"GK"],["DF",14,72,"LB"],["DF",37,76,"CB"],["DF",63,76,"CB"],["DF",86,72,"RB"],["MF",36,59,"DM"],["MF",64,59,"DM"],["MF",16,38,"LW"],["MF",50,40,"AM"],["MF",84,38,"RW"],["FW",50,18,"ST"]],
    "3-5-2": [["GK",50,90,"GK"],["DF",26,75,"CB"],["DF",50,78,"CB"],["DF",74,75,"CB"],["MF",11,49,"LWB"],["MF",32,55,"CM"],["MF",50,45,"AM"],["MF",68,55,"CM"],["MF",89,49,"RWB"],["FW",37,22,"ST"],["FW",63,22,"ST"]]
  },
  futsal: {
    "1-2-1": [["GK",50,88,"GK"],["DF",50,68,"FIXO"],["MF",18,46,"ALA"],["MF",82,46,"ALA"],["FW",50,22,"PIVO"]],
    "2-2": [["GK",50,88,"GK"],["DF",27,66,"DF"],["DF",73,66,"DF"],["FW",27,30,"FW"],["FW",73,30,"FW"]],
    "3-1": [["GK",50,88,"GK"],["MF",17,60,"ALA"],["DF",50,66,"FIXO"],["MF",83,60,"ALA"],["FW",50,24,"PIVO"]]
  }
};
const QUARTERS = { "11": 4, futsal: 8 };
const DEFAULT_SETTINGS = () => ({ teamName: "", fee: 30000, cap: 14, checkBefore: 10, lateCancelH: 3, account: "", shareLink: "", sample: false, finePresets: [{ id: "late", label: "지각", amount: 5000 }, { id: "noshow", label: "무단 불참", amount: 10000 }], guestFee: 10000, dutyItems: [{ id: "ball", label: "공", what: "공과 펌프" }, { id: "bib", label: "조끼", what: "조끼, 끝나고 빨아 오기" }, { id: "water", label: "물", what: "생수" }] });

/* ---------- state ---------- */
let S = { settings: DEFAULT_SETTINGS(), players: [], dues: {}, fines: [], events: {}, rsvp: {}, mydues: {}, payreq: {}, notices: [], tally: {}, uvote: {}, guestreq: {} };
const ui = { schedFilter: "up", evTab: "att", evFor: null, attFilter: "in", lineQ: 0, moneyTab: "dues", month: thisMonth(), fineFilter: "unpaid", year: String(new Date().getFullYear()), showInactive: false, fineSel: {}, rptTab: "season", lineSel: -1, lineMsg: "", momPick: {}, splitSeed: 0, mlQ: 0, evQ: 0 };
const LS_KEY = "fc-manager-local-v2";
const LS_OLD = "fc-manager-local-v1";
const PREF_KEY = "fc-manager-prefs";
// Storage layout (one document per item so several people can edit at once):
//   team/settings, players/<id>, contacts/<id>, events/<id>, dues/<YYYY-MM>, fines/<id>   운영진이 씀
//   rsvp/<userId>     본인 선수 연결과 참석 투표 (본인이 씀, 모두가 읽음)
//   mydues/<userId>   본인 회비 현황 (운영진이 씀, 본인만 읽음)
//   payreq/<userId>   '입금했어요' 요청 (본인이 씀, 운영진과 본인만 읽음)
const CORE = ["team", "players", "contacts", "events", "dues", "fines"];
const COLLS = CORE.concat(["rsvp", "mydues", "payreq", "notices", "tally", "uvote", "guestreq"]);
//   notices/<id>      공지와 설문 (운영진이 씀, 모두 읽음)
//   tally/<key>       MOM, 설문, 읽음 집계 (운영진 앱이 맞춰 둠, 모두 읽음)
//   uvote/<userId>    본인 MOM 표, 설문 응답, 읽음, 당번 확인 (본인이 씀, 운영진과 본인만 읽음)
//   guestreq/<userId> 게스트 요청 (본인이 씀, 운영진과 본인만 읽음)
const R = {}; COLLS.forEach(c => R[c] = {});
const Store = { mode: "loading", db: null, dl: null, user: null, me: null, role: "owner", canWrite: true, canVote: true, canMoney: true, isOwner: true, pending: new Map(), inflight: new Map(), settled: new Map(), timers: {}, got: new Set(), confirmed: new Set(), subs: [], err: false, offline: false };

function prefs() { try { return JSON.parse(localStorage.getItem(PREF_KEY) || "{}") || {}; } catch (e) { return {}; } }
function setPref(k, v) { try { const p = prefs(); p[k] = v; localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (e) {} }

const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
function deepMerge(base, patch) {
  const out = isObj(base) ? { ...base } : {};
  Object.entries(patch).forEach(([k, v]) => { if (v === undefined) return; out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k], v) : clone(v); });
  return out;
}
function coalesce(prev, op) {
  if (!prev || op.t !== "update") return op;
  if (prev.t === "set") return { t: "set", data: deepMerge(prev.data, op.patch) };
  if (prev.t === "update") return { t: "update", patch: deepMerge(prev.patch, op.patch) };
  return { t: "set", data: deepMerge({}, op.patch) };
}
function applyOp(doc, op) {
  if (op.t === "delete") return undefined;
  if (op.t === "set") return clone(op.data);
  return doc ? deepMerge(doc, op.patch) : undefined;
}
let ATTC = new Map();
function derive() {
  const D = {}; COLLS.forEach(c => D[c] = { ...R[c] });
  const overlay = m => m.forEach((op, path) => { const [c, id] = path.split("/"); if (!D[c]) return; const nv = applyOp(D[c][id], op); if (nv === undefined) delete D[c][id]; else D[c][id] = nv; });
  overlay(Store.settled); overlay(Store.inflight); overlay(Store.pending);
  S.settings = Object.assign(DEFAULT_SETTINGS(), D.team.settings ? clone(D.team.settings) : {});
  if (!Array.isArray(S.settings.finePresets)) S.settings.finePresets = [];
  S.players = Object.entries(D.players).filter(([, p]) => isObj(p) && typeof p.name === "string").map(([id, p]) => ({ ...clone(p), id, phone: (D.contacts[id] && D.contacts[id].phone) || "" }));
  S.events = {}; Object.entries(D.events).forEach(([id, e]) => { if (isObj(e) && e.date) S.events[id] = { ...clone(e), id }; });
  S.dues = {}; Object.entries(D.dues).forEach(([m, d]) => { const o = {}; Object.entries(d || {}).forEach(([k, v]) => { if (v === "paid" || v === "exempt") o[k] = v; }); S.dues[m] = o; });
  S.fines = Object.entries(D.fines).filter(([, f]) => isObj(f)).map(([id, f]) => ({ ...clone(f), id }));
  S.rsvp = {}; Object.entries(D.rsvp).forEach(([u, d]) => { if (isObj(d)) S.rsvp[u] = clone(d); });
  S.mydues = {}; Object.entries(D.mydues).forEach(([u, d]) => { if (isObj(d)) S.mydues[u] = clone(d); });
  S.payreq = {}; Object.entries(D.payreq).forEach(([u, d]) => { if (isObj(d)) S.payreq[u] = clone(d); });
  S.notices = Object.entries(D.notices).filter(([, n]) => isObj(n) && (n.title || n.body)).map(([id, n]) => ({ ...clone(n), id })).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(b.at || "").localeCompare(String(a.at || "")));
  S.tally = {}; Object.entries(D.tally).forEach(([k, d]) => { if (isObj(d)) S.tally[k] = clone(d); });
  S.uvote = {}; Object.entries(D.uvote).forEach(([u, d]) => { if (isObj(d)) S.uvote[u] = clone(d); });
  S.guestreq = {}; Object.entries(D.guestreq).forEach(([u, d]) => { if (isObj(d)) S.guestreq[u] = clone(d); });
  ATTC = new Map();
}
function docExists(path) {
  const [c, id] = path.split("/");
  const op = Store.pending.get(path) || Store.inflight.get(path);
  if (op) return op.t !== "delete";
  return !!(R[c] && R[c][id]);
}

/* write helpers: every change goes through these */
function write(path, op, delay) {
  if (Store.mode === "local") {
    const [c, id] = path.split("/");
    const cur = R[c][id];
    const nv = applyOp(cur, op.t === "update" && !cur ? { t: "set", data: deepMerge({}, op.patch) } : op);
    if (nv === undefined) delete R[c][id]; else R[c][id] = nv;
    if (!saveLocal()) toast("이 기기에 저장하지 못했습니다. 설정에서 백업해 주세요.");
    derive(); setSync(); return;
  }
  if (Store.mode !== "db") return;
  Store.pending.set(path, coalesce(Store.pending.get(path), op));
  derive(); setSync();
  clearTimeout(Store.timers[path]);
  Store.timers[path] = setTimeout(() => flush(path), delay == null ? 300 : delay);
}
const setDoc = (path, data, delay) => write(path, { t: "set", data }, delay);
const patchDoc = (path, patch, delay) => write(path, docExists(path) ? { t: "update", patch } : { t: "set", data: deepMerge({}, patch) }, delay);
const delDoc = (path, delay) => write(path, { t: "delete" }, delay);
function evPatch(id, patch, delay) {
  patchDoc("events/" + id, { ...patch, updatedBy: Store.me || "", updatedAt: nowIso() }, delay);
}

async function flush(path, retried) {
  if (Store.inflight.has(path)) return;
  const op = Store.pending.get(path); if (!op) return;
  Store.pending.delete(path); Store.inflight.set(path, op); setSync();
  const ref = Store.db.doc(path);
  try {
    if (op.t === "set") await ref.set(clone(op.data));
    else if (op.t === "update") await ref.update(clone(op.patch));
    else await ref.delete();
    Store.err = false;
  } catch (e) {
    const code = e && e.code;
    Store.inflight.delete(path);
    if (code === "unavailable" && !retried) {
      const later = Store.pending.get(path);
      Store.pending.set(path, later ? coalesce(op, later) : op);
      setTimeout(() => flush(path, true), 800 + Math.random() * 800);
      return;
    }
    const [c, id] = path.split("/");
    if (code === "invalid_argument" && op.t === "update" && !(R[c] && R[c][id])) toast("다른 운영진이 이미 삭제한 항목입니다.");
    else if (code === "invalid_argument" || code === "not_granted" || code === "permission_denied") { downgrade(path); }
    else if (code === "quota_exceeded") { Store.err = true; toast("저장 공간이 가득 찼습니다. 오래된 일정을 지워 주세요."); }
    else { Store.err = true; toast("저장하지 못했습니다. 잠시 후 다시 시도해 주세요."); }
    derive(); requestRender(); setSync();
    if (Store.pending.has(path)) flush(path);
    return;
  }
  Store.inflight.delete(path);
  // keep showing this write until the next snapshot of its collection arrives
  Store.settled.delete(path); Store.settled.set(path, op);
  if (Store.pending.has(path)) { flush(path); return; }
  derive(); requestRender(); setSync();
}
const anyBusy = () => Store.pending.size > 0 || Store.inflight.size > 0;
// a refused write tells us this person has less access than we assumed
function downgrade(path) {
  const own = /^(rsvp|payreq|uvote|guestreq)\//.test(path) && path.endsWith("/" + Store.me);
  if (own) { Store.canVote = false; Store.canWrite = false; Store.role = "viewer"; toast("아직 팀원 권한이 없어 저장하지 못했어요. 운영진에게 '사용 가능' 권한을 요청해 주세요."); }
  else { Store.canWrite = false; Store.canMoney = false; if (Store.role === "op" || Store.role === "owner") Store.role = Store.canVote ? "member" : "viewer"; toast("운영진 권한이 없어 저장하지 못했어요. 링크 소유자에게 '편집 가능' 권한을 요청해 주세요."); }
  applyRole();
}

function setSync() {
  const el = $("#sync"); if (!el) return;
  let cls = "", txt = "";
  if (Store.mode === "loading") { txt = "불러오는 중"; }
  else if (Store.mode === "local") { cls = window.__DEMO ? "ok" : "busy"; txt = window.__DEMO ? "미리보기" : "이 기기에만 저장"; }
  else if (Store.err) { cls = "err"; txt = "저장 실패"; }
  else if (anyBusy()) { cls = "busy"; txt = "저장 중"; }
  else if (Store.offline) { cls = "err"; txt = "연결 안 됨"; }
  else if (Store.role === "viewer") { cls = ""; txt = "권한 대기"; }
  else { cls = "ok"; txt = "저장됨"; }
  el.className = "sync " + cls; el.lastElementChild.textContent = txt;
}
const ROLE_KO = { owner: "소유자", op: "운영진", member: "팀원", viewer: "권한 대기" };
function applyRole() {
  document.body.classList.toggle("ro", !Store.canWrite);
  document.body.classList.toggle("nomoney", !Store.canMoney);
  document.body.classList.toggle("notowner", !Store.isOwner);
  if (typeof renderChrome === "function" && Store.mode !== "loading") renderChrome();
  setSync();
}
// 운영진이 팀원 화면을 미리 보는 모드. 화면만 바뀌고 아무것도 저장하지 않는다
function setPreview(mode) {
  const r = Store.real; if (!r || !r.canWrite) return;
  Store.preview = mode || "";
  if (!mode) Object.assign(Store, { role: r.role, canWrite: r.canWrite, canMoney: r.canMoney, canVote: r.canVote, isOwner: r.isOwner });
  else Object.assign(Store, { role: mode, canWrite: false, canMoney: false, isOwner: false, canVote: mode === "member" });
  Store.previewPid = mode === "member" ? claimOf(Store.me) : "";
  closeSheet(); applyRole(); window.scrollTo(0, 0); render();
}
function applyBig() {
  const on = !!prefs().big;
  document.documentElement.classList.toggle("big", on);
  const b = $("#bigBtn"); if (b) b.setAttribute("aria-pressed", String(on));
}

/* local mode (page opened outside Claude): same layout, kept in this browser */
function saveLocal() { try { localStorage.setItem(LS_KEY, JSON.stringify(R)); return true; } catch (e) { return false; } }
function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) { const d = JSON.parse(raw); COLLS.forEach(c => { R[c] = isObj(d[c]) ? d[c] : {}; }); }
    else { const old = localStorage.getItem(LS_OLD); if (old) { stateToR(sanitize(JSON.parse(old))).forEach(([p, data]) => { const [c, id] = p.split("/"); R[c][id] = data; }); saveLocal(); } }
  } catch (e) {}
  derive();
}

/* whole-state helpers (backup, sample, reset) */
const SAFE_ID = /^[A-Za-z0-9_-]{1,60}$/;
function sanitize(d) {
  const out = {};
  out.players = (Array.isArray(d.players) ? d.players : []).filter(p => p && SAFE_ID.test(p.id) && typeof p.name === "string");
  out.fines = (Array.isArray(d.fines) ? d.fines : []).filter(f => f && SAFE_ID.test(f.id));
  out.events = {};
  Object.entries(isObj(d.events) ? d.events : {}).forEach(([k, e]) => { if (SAFE_ID.test(k) && e && e.id === k && /^\d{4}-\d{2}-\d{2}$/.test(e.date)) out.events[k] = e; });
  out.dues = {};
  Object.entries(isObj(d.dues) ? d.dues : {}).forEach(([m, v]) => { if (/^\d{4}-\d{2}$/.test(m) && isObj(v)) out.dues[m] = v; });
  out.settings = isObj(d.settings) ? { ...d.settings, finePresets: (Array.isArray(d.settings.finePresets) ? d.settings.finePresets : []).filter(p => p && SAFE_ID.test(p.id)) } : DEFAULT_SETTINGS();
  return out;
}
function stateToR(d) {
  const docs = [["team/settings", clone(d.settings)]];
  d.players.forEach(p => { const { phone, ...rest } = p; docs.push(["players/" + p.id, clone(rest)]); if (phone) docs.push(["contacts/" + p.id, { phone }]); });
  Object.values(d.events).forEach(e => docs.push(["events/" + e.id, clone(e)]));
  Object.entries(d.dues).forEach(([m, v]) => docs.push(["dues/" + m, clone(v)]));
  d.fines.forEach(f => docs.push(["fines/" + f.id, clone(f)]));
  return docs;
}
function replaceAll(d, msg) {
  const docs = stateToR(sanitize(d));
  const keep = new Set(docs.map(x => x[0]));
  const ops = docs.map(([p, data]) => [p, { t: "set", data }]);
  CORE.forEach(c => Object.keys(R[c]).forEach(id => { const p = c + "/" + id; if (!keep.has(p)) ops.push([p, { t: "delete" }]); }));
  ops.forEach(([p, op], i) => write(p, op, 300 + i * 60));
  if (currentView() === "home") render(); else location.hash = "home";
  toast(msg);
}

async function initStore() {
  let db = null, dl = null, user = null;
  if (window.__DEMO) { demoBoot(); return; }
  try {
    if (window.claude && typeof window.claude.use === "function") {
      [db, dl, user] = await Promise.all(["db", "downloads", "user"].map(n => window.claude.use(n).catch(() => null)));
    }
  } catch (e) { db = null; }
  Store.dl = dl;
  if (!db && window.claude) {
    // opened through the shared link but the store is not available (usually: not signed in)
    Store.mode = "nodata"; Store.role = "viewer"; Store.canWrite = false; Store.canVote = false; Store.canMoney = false; applyRole();
    $("#sync").hidden = true; $("#tabs").hidden = true;
    $("#main").innerHTML = `<div class="card"><div class="empty"><b>팀 정보를 불러올 수 없습니다</b>Claude에 로그인한 상태로 이 링크를 다시 열어 주세요. 로그인하면 일정, 참석 현황, 라인업, 경기 기록을 볼 수 있습니다.</div></div>`;
    return;
  }
  if (!db) { Store.mode = "local"; Store.me = "local-me"; loadLocal(); applyRole(); route(); return; }
  Store.db = db; Store.user = user;
  let role = "viewer";
  if (user) {
    try {
      const [own, edit, cw, me] = await Promise.all([user.isOwner(), user.canEdit(), user.can("data.write"), user.id()]);
      Store.me = me || null;
      role = own ? "owner" : edit ? "op" : cw === false ? "viewer" : "member";
      if (role === "member" && !Store.me) role = "viewer";
    } catch (e) { role = "viewer"; }
  }
  Store.role = role; Store.isOwner = role === "owner";
  Store.canWrite = role === "owner" || role === "op";
  Store.canMoney = Store.canWrite;
  Store.canVote = role !== "viewer" && !!Store.me;
  Store.real = { role, canWrite: Store.canWrite, canMoney: Store.canMoney, canVote: Store.canVote, isOwner: Store.isOwner };
  applyRole();
  // what this person may read
  const sources = ["team", "players", "events", "rsvp", "notices", "tally"].map(c => ({ c }));
  if (Store.canWrite) ["fines", "contacts", "dues", "payreq", "mydues", "uvote", "guestreq"].forEach(c => sources.push({ c }));
  else if (Store.canVote) ["mydues", "payreq", "uvote", "guestreq"].forEach(c => sources.push({ c, id: Store.me }));
  const total = sources.length;
  Store.loadTimer = setTimeout(() => {
    Store.offline = true; setSync();
    if (Store.mode === "loading") $("#main").innerHTML = `<div class="card"><div class="empty"><b>서버에 연결하지 못했습니다</b>네트워크를 확인해 주세요. 연결되면 자동으로 불러옵니다.</div></div>`;
  }, 10000);
  const arrived = (key, c, fromCache) => {
    Store.settled.forEach((_, p) => { if (p.startsWith(c + "/")) Store.settled.delete(p); });
    Store.got.add(key);
    if (!fromCache) Store.confirmed.add(key);
    if (Store.confirmed.size >= total) { clearTimeout(Store.loadTimer); Store.offline = false; }
    derive();
    if (Store.mode === "loading") { if (Store.got.size >= total) { Store.mode = "db"; setSync(); route(); scheduleSync(); } }
    else { setSync(); if (currentView() !== "config") requestRender(); scheduleSync(); }
  };
  const fail = () => {
    Store.err = true; setSync();
    if (Store.mode === "loading") $("#main").innerHTML = `<div class="card"><div class="empty"><b>데이터를 불러오지 못했습니다</b>페이지를 다시 열어 주세요.</div></div>`;
  };
  sources.forEach(src => {
    const key = src.c + (src.id ? "/" + src.id : "");
    if (src.id) {
      Store.subs.push(db.doc(src.c + "/" + src.id).onSnapshot(snap => {
        R[src.c] = snap.exists ? { [src.id]: snap.data() } : {};
        arrived(key, src.c, snap.metadata && snap.metadata.fromCache);
      }, fail));
    } else {
      Store.subs.push(db.collection(src.c).onSnapshot(snap => {
        const next = {}; snap.docs.forEach(d => { next[d.id] = d.data(); }); R[src.c] = next;
        arrived(key, src.c, snap.metadata && snap.metadata.fromCache);
      }, fail));
    }
  });
}

/* 운영진: 회비 현황을 본인만 볼 수 있는 문서(mydues)에 맞춰 둔다 */
let syncTimer = null;
function scheduleSync() { if (!Store.canWrite || Store.mode !== "db" || syncTimer) return; syncTimer = setTimeout(() => { syncTimer = null; syncMyDues(); syncTallies(); }, 1500); }
/* 운영진: MOM 표, 설문 응답, 읽음 수를 모두가 볼 수 있는 집계(tally)로 맞춰 둔다. 누가 누구를 골랐는지는 담지 않는다 */
function tallyNow() {
  const out = {};
  const add = (key, val, u) => { const t = out[key] || (out[key] = { n: 0, c: {}, v: [] }); t.n++; t.v.push(u); if (val) t.c[val] = (t.c[val] || 0) + 1; };
  Object.keys(S.uvote).forEach(u => {
    const d = S.uvote[u] || {};
    Object.entries(d.mom || {}).forEach(([eid, pid]) => { if (pid && S.events[eid]) add("mom-" + eid, pid, u); });
    Object.entries(d.poll || {}).forEach(([nid, opt]) => { if (opt && S.notices.some(n => n.id === nid)) add("poll-" + nid, opt, u); });
    Object.keys(d.seen || {}).forEach(nid => { if (S.notices.some(n => n.id === nid)) add("seen-" + nid, "", u); });
  });
  Object.values(out).forEach(t => t.v.sort());
  return out;
}
function syncTallies() {
  if (!Store.canWrite || Store.mode !== "db") return;
  const want = tallyNow();
  const norm = t => JSON.stringify({ n: t ? t.n : 0, c: Object.fromEntries(Object.keys((t && t.c) || {}).sort().map(k => [k, t.c[k]])), v: ((t && t.v) || []).slice().sort() });
  Object.keys(want).forEach(k => { if (norm(want[k]) !== norm(S.tally[k])) setDoc("tally/" + k, { ...want[k], at: nowIso() }); });
  Object.keys(S.tally).forEach(k => { if (!want[k] && S.tally[k] && S.tally[k].n) setDoc("tally/" + k, { n: 0, c: {}, v: [], at: nowIso() }); });
}
function syncMyDues() {
  if (!Store.canWrite || Store.mode !== "db") return;
  Object.keys(S.rsvp).forEach(u => {
    const pid = claimOf(u); if (!pid) return;
    // 팀원 본인 문서: 회비 납부 기록과 본인 벌금만 담는다
    const months = {}; Object.keys(S.dues).sort().forEach(m => { const v = S.dues[m][pid]; if (v) months[m] = v; });
    const fines = {}; S.fines.filter(f => f.pid === pid).sort((a, b) => String(a.id).localeCompare(String(b.id))).forEach(f => { fines[f.id] = { date: f.date || "", reason: f.reason || "", amount: Number(f.amount) || 0, paid: !!f.paid }; });
    const have = S.mydues[u] || {};
    const same = (a, b) => JSON.stringify(a || {}) === JSON.stringify(b || {});
    const norm = o => Object.fromEntries(Object.keys(o || {}).sort().filter(k => o[k]).map(k => [k, o[k]]));
    const normF = o => Object.fromEntries(Object.keys(o || {}).sort().map(k => [k, { date: o[k].date || "", reason: o[k].reason || "", amount: Number(o[k].amount) || 0, paid: !!o[k].paid }]));
    if (have.pid !== pid || !same(norm(have.months), months) || !same(normF(have.fines), fines)) setDoc("mydues/" + u, { pid, months, fines });
  });
}

/* names of people who last edited something */
const nameCache = {};
async function fillNames() {
  const els = Array.from(document.querySelectorAll("[data-uid]"));
  if (!els.length || !Store.user) return;
  const ids = Array.from(new Set(els.map(e => e.dataset.uid))).filter(Boolean);
  try {
    const missing = ids.filter(id => !(id in nameCache));
    if (missing.length) { const ps = await Store.user.profiles(missing); missing.forEach(id => { nameCache[id] = (ps[id] && ps[id].name) || ""; }); }
  } catch (e) {}
  els.forEach(el => { const id = el.dataset.uid; el.textContent = id === Store.me ? "나" : (nameCache[id] || el.dataset.fallback || "팀원"); });
}

/* ---------- render scheduling ---------- */
let renderPending = false;
function requestRender() {
  const a = document.activeElement;
  if (a && ($("#main").contains(a) || $("#sheetroot").contains(a)) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { renderPending = true; return; }
  if ($("#sheetroot").innerHTML) { renderPending = true; return; }
  render();
}
document.addEventListener("focusout", () => { if (renderPending) setTimeout(() => { if (renderPending && !$("#sheetroot").innerHTML) { renderPending = false; requestRender(); } }, 0); });
