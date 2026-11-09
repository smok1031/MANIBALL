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
// 내전은 한 팀 인원이 그날그날 달라서, 5인부터 11인까지 포메이션을 둔다. 키는 "인원|이름"
const SCRIM_FORMS = (() => {
  const xs = n => ({ 1: [50], 2: [32, 68], 3: [20, 50, 80], 4: [14, 38, 62, 86], 5: [10, 30, 50, 70, 90] })[n];
  const lab = { DF: { 1: ["CB"], 2: ["CB", "CB"], 3: ["LB", "CB", "RB"], 4: ["LB", "CB", "CB", "RB"], 5: ["LWB", "CB", "CB", "CB", "RWB"] }, MF: { 1: ["CM"], 2: ["CM", "CM"], 3: ["LM", "CM", "RM"], 4: ["LM", "CM", "CM", "RM"], 5: ["LM", "CM", "AM", "CM", "RM"] }, FW: { 1: ["ST"], 2: ["ST", "ST"], 3: ["LW", "ST", "RW"] } };
  const make = (d, m, f) => { const out = [["GK", 50, 90, "GK"]]; [["DF", d, 74], ["MF", m, f ? 50 : 40], ["FW", f, 24]].forEach(([g, n, y]) => { if (n) xs(n).forEach((x, i) => out.push([g, x, y, lab[g][n][i]])); }); return out; };
  const list = { 6: ["2-2-1", "2-1-2", "3-1-1"], 7: ["2-3-1", "3-2-1", "3-1-2"], 8: ["3-3-1", "3-2-2", "2-3-2"], 9: ["3-3-2", "3-4-1", "4-3-1"], 10: ["4-3-2", "3-4-2", "4-4-1"] };
  const out = {};
  Object.keys(FORMATIONS.futsal).forEach(f => { out["5|" + f] = FORMATIONS.futsal[f]; });
  Object.keys(list).forEach(n => list[n].forEach(f => { const [d, m, w] = f.split("-").map(Number); out[n + "|" + f] = make(d, m, w); }));
  Object.keys(FORMATIONS["11"]).forEach(f => { out["11|" + f] = FORMATIONS["11"][f]; });
  return out;
})();
const formName = f => { const [n, name] = String(f || "").split("|"); return name ? `${n}인 ${name}` : String(f || ""); };
const DEFAULT_SETTINGS = () => ({ teamName: "", fee: 30000, cap: 14, checkBefore: 10, lateCancelH: 3, account: "", shareLink: "", sample: false, finePresets: [{ id: "late", label: "지각", amount: 5000 }, { id: "noshow", label: "무단 불참", amount: 10000 }], guestFee: 10000 });

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
//   uvote/<userId>    본인 MOM 표, 설문 응답, 읽음 (본인이 씀, 운영진과 본인만 읽음)
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
  if (own) { Store.canVote = false; Store.canWrite = false; Store.role = "viewer"; toast((window.__WEB ? "팀 멤버가 아니라 저장하지 못했어요. 초대 링크로 다시 들어와 주세요." : "아직 팀원 권한이 없어 저장하지 못했어요. 운영진에게 '사용 가능' 권한을 요청해 주세요.")); }
  else { Store.canWrite = false; Store.canMoney = false; if (Store.role === "op" || Store.role === "owner") Store.role = Store.canVote ? "member" : "viewer"; toast((window.__WEB ? "운영진만 바꿀 수 있어요. 팀장에게 운영진 지정을 요청해 주세요." : "운영진 권한이 없어 저장하지 못했어요. 링크 소유자에게 '편집 가능' 권한을 요청해 주세요.")); }
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
  if (window.__WEB) return;
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
  if (window.__DEMO) html = `<div class="preview"><b>${window.__DEMO === "op" ? "운영진" : "팀원"} 화면 미리보기</b>예요. 예시 데이터라 눌러 봐도 실제 팀에는 저장되지 않아요.${window.__WEB ? ` <a class="linkbtn" href="?demo=${window.__DEMO === "op" ? "member" : "op"}">${window.__DEMO === "op" ? "팀원" : "운영진"} 화면 보기</a>` : ""}</div>` + html;
  if (S.settings.sample && !window.__DEMO) html = `<div class="note">지금 보이는 선수와 기록은 예시입니다. <button class="linkbtn o" data-act="clearSample">예시 모두 지우기</button></div>` + html;
  if (Store.mode === "db" && Store.role === "viewer") html = `<div class="note soft"><b>아직 팀 멤버가 아니에요.</b> ${window.__WEB ? "초대 링크로 다시 들어오면 참석 투표를 할 수 있어요." : "지금은 일정과 기록을 볼 수만 있어요. 참석 투표를 하려면 운영진에게 '사용 가능' 권한을 요청해 주세요."}</div>` + html;
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
  ${linked.length ? linked.map(u => `<section class="card" style="flex-direction:row;align-items:center;gap:10px"><div class="grow"><div style="font-size:14px;font-weight:700">${window.__WEB ? "" : "Claude "}계정 연결됨</div><div class="tiny muted"><span data-uid="${esc(u)}" data-fallback="팀원">팀원</span> 님이 나 찾기에서 골랐어요</div></div><button class="btn muted" data-act="unlink" data-u="${esc(u)}">연결 해제</button></section>`).join("") : isNew ? "" : `<div class="hint" style="padding:0 4px">아직 계정과 연결되지 않았어요. 본인이 링크에서 '나 찾기'로 고르면 연결돼요.</div>`}`;
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
  const roleCard = window.__WEB && typeof window.webRoleCard === "function" ? window.webRoleCard() : Store.mode === "db" ? `<section class="card" style="gap:10px"><div class="labrow"><span class="lab">권한</span><span class="chip ${Store.canWrite ? "clay" : ""}">나는 ${ROLE_KO[Store.role] || ""}</span></div>
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
    <label class="field" style="margin:0">팀원에게 보낼 링크 (공유 문구에 들어가요)<input name="shareLink" value="${esc(s.shareLink)}" placeholder="${window.__WEB ? "비워 두면 이 앱 주소가 들어가요" : "공유 메뉴에서 복사한 이 앱의 링크"}" maxlength="200"></label>
    <div class="field" style="margin:0">벌금 종류<span class="h">'지각', '불참', '직전 취소'라는 말이 들어가면 현장 출석에서 자동으로 붙어요</span></div>
    <div id="presetRows">${s.finePresets.map(p => presetRow(p)).join("")}</div>
    <button type="button" class="btn" data-act="addPreset" style="align-self:flex-start">+ 벌금 종류 추가</button>
    <button class="btn primary big" type="submit">저장</button></form>
  ${view}
  <section class="card"><span class="lab">백업</span><div class="small muted">${Store.mode === "db" ? "데이터는 이 링크에 저장돼 운영진과 팀원 모두에게 이어져요. 가끔 백업 파일을 받아 두세요." : "지금은 이 기기의 브라우저에만 저장돼요. 백업 파일을 꼭 받아 두세요."}</div>
    <div class="btnrow"><button class="btn" data-act="exportData" ${Store.dl ? "" : "disabled"}>백업 파일 받기</button><label class="btn o" for="importFile" style="cursor:pointer">백업에서 복원</label></div><input type="file" id="importFile" accept="application/json,.json" hidden></section>
  <section class="card o"><span class="lab">초기화</span><div class="small muted">선수, 일정, 회비, 벌금 기록을 모두 지워요. 되돌릴 수 없고, ${window.__WEB ? "팀장만" : "링크 소유자만"} 할 수 있어요.</div><button class="btn dark block" data-act="resetAll">모든 데이터 지우기</button></section>`;
}
function presetRow(p) { return `<div class="presets" data-pid="${esc(p.id)}"><input class="inp" aria-label="벌금 이름" name="pl" value="${esc(p.label)}" placeholder="벌금 이름"><input class="inp" aria-label="금액" name="pa" inputmode="numeric" value="${esc(p.amount)}" placeholder="금액"><button type="button" class="iconbtn" data-act="delPreset" aria-label="삭제" style="width:40px;height:40px;border-radius:12px">&times;</button></div>`; }


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
// 새 내전: 참석 투표와 상관없이 팀 선수 중에서 운영진이 한 명씩 조끼팀, 일반팀을 고른다
function viewSquad(e) {
  const op = isOpView(); const all = squadBase(e); const T = teamsOf(e); const t = T.t; const st = effAtt(e).s;
  const A = all.filter(p => t[p.id] === "A"), B = all.filter(p => t[p.id] === "B"), O = all.filter(p => !t[p.id]);
  const goingIds = new Set(roster(e).confirmed.map(p => p.id));
  const Oin = O.filter(p => goingIds.has(p.id)), Orest = O.filter(p => !goingIds.has(p.id));
  const lock = !op || T.saved;
  const vote = p => goingIds.has(p.id) ? (st[p.id] === "late" ? "늦참" : "참석") : st[p.id] === "no" ? "불참" : "";
  const row = p => { const s = t[p.id] || ""; const late = availFrom(e, p.id) > 1 ? `, ${availFrom(e, p.id)}Q부터` : ""; const v = vote(p);
    return `<div class="mrow"><div class="grow"><div class="nm">${esc(p.name)}${v ? ` <span class="tiny ${v === "불참" ? "muted" : ""}" style="font-weight:700${v === "불참" ? "" : ";color:var(--clay)"}">${v}</span>` : ""}</div><div class="tiny muted">${esc([p.pos1, p.pos2].filter(Boolean).join("/") || p.pos || "")}${esc(late)}</div></div>
      ${lock ? `<span class="chip${s === "A" ? " clay" : ""}">${s === "A" ? "조끼팀" : s === "B" ? "일반팀" : "빠짐"}</span>` : `<div class="seg pick" role="group" aria-label="${esc(p.name)} 팀" style="flex:none"><button data-act="teamSet" data-eid="${e.id}" data-pid="${p.id}" data-v="A" aria-pressed="${s === "A"}">조끼</button><button data-act="teamSet" data-eid="${e.id}" data-pid="${p.id}" data-v="B" aria-pressed="${s === "B"}">일반</button></div>`}</div>`; };
  const group = (title, arr, cls, note) => arr.length ? `<section class="card" style="gap:2px"><div class="labrow"><span class="lab"${cls ? ` style="color:var(--clay)"` : ""}>${title}</span><span class="num" style="font-size:18px">${arr.length}명</span></div>${note ? `<div class="tiny muted" style="margin-bottom:4px">${note}</div>` : ""}${arr.map(row).join("")}</section>` : "";
  const gk = arr => arr.some(p => isGk(p) || p.pos2 === "GK");
  const warn = A.length && B.length && (!gk(A) || !gk(B)) ? `${gk(A) ? "일반팀" : "조끼팀"}에 골키퍼가 없어요.` : "";
  return `${backbar("#event-" + e.id, `${esc(bigDate(e, true))} ${esc(evTitle(e))}, 참석 확정 ${goingIds.size}명`, "스쿼드 고르기", op && !T.saved && (A.length || B.length) ? `<button class="btn" data-act="teamClear" data-eid="${e.id}">비우기</button>` : "")}
  ${!all.length ? `<div class="card"><div class="empty"><b>등록된 선수가 없어요</b>선수 탭에서 명단을 먼저 올려 주세요.</div></div>` : `
  ${op && !T.saved ? `<div class="small muted" style="padding:0 4px">참석 투표와 상관없이 한 명씩 <b>조끼</b> 또는 <b>일반</b>을 누르세요. 한 번 더 누르면 빠져요. 고르지 않은 사람은 오늘 스쿼드에 들어가지 않아요.</div>` : ""}
  <div class="small" style="padding:0 4px"><b style="color:var(--clay)">조끼팀 ${A.length}명</b>, <b>일반팀 ${B.length}명</b></div>
  ${warn && !T.saved ? `<div class="status" role="status">${esc(warn)}</div>` : ""}
  ${group("조끼팀", A, true)}${group("일반팀", B)}${lock ? "" : group("참석 투표한 사람", Oin) + group("그 외 선수", Orest, false, "아직 투표 안 했거나 불참으로 낸 사람이에요.")}
  ${op ? (T.saved
    ? `<section class="card"><div role="status" style="font-weight:700;color:var(--clay)">확정했어요. 팀원 일정 화면에 바로 보여요.</div><a class="btn primary block" href="#event-${e.id}" data-act="goEvTab" data-eid="${e.id}" data-v="lineup">팀별 라인업 짜기</a><button class="btn block" data-act="teamShare" data-eid="${e.id}">단톡방 공유 문구</button><button class="btn block" data-act="teamUnconfirm" data-eid="${e.id}">다시 고치기</button></section>`
    : `<div class="btnrow"><button class="btn primary" data-act="teamConfirm" data-eid="${e.id}" ${A.length && B.length ? "" : "disabled"}>스쿼드 확정</button></div><a class="btn block" href="#event-${e.id}" data-act="goEvTab" data-eid="${e.id}" data-v="lineup">팀별 라인업 짜러 가기</a>`)
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
function teamText(e) { const conf = squadBase(e); const T = teamsOf(e).t; return [`[${S.settings.teamName || "우리 팀"}] ${fmtDate(e.date)} ${evTitle(e)} 팀`, `조끼팀: ${conf.filter(p => T[p.id] === "A").map(p => p.name).join(", ")}`, `일반팀: ${conf.filter(p => T[p.id] === "B").map(p => p.name).join(", ")}`].join("\n"); }

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
function lineupSave(e, L, q) {
  const obj = {}; q.forEach((slots, k) => { obj[k + 1] = slots.map(x => x || null); });
  const side = L.side || curSide(e);
  if (side) { saveEv(e, { lineS: { [side]: { formation: L.formation, q: obj } } }); return; }
  saveEv(e, { lineupQ: { formation: L.formation, q: obj }, lineup: null });
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
    lineupSave(e, { formation: t.dataset.v }, q);
  },
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
  if (!Store.canWrite && !READ_ACTS.has(act) && !(Store.canVote && VOTE_ACTS.has(act))) { ev.preventDefault(); toast(VOTE_ACTS.has(act) ? (window.__WEB ? "팀 멤버만 할 수 있어요. 초대 링크로 들어와 주세요." : "아직 팀원 권한이 없어요. 운영진에게 '사용 가능' 권한을 요청해 주세요.") : "운영진만 할 수 있어요."); return; }
  if (!Store.isOwner && OWNER_ACTS.has(act)) { ev.preventDefault(); toast((window.__WEB ? "팀장만 할 수 있어요." : "링크 소유자만 할 수 있습니다.")); return; }
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
  pollVote: t => { const nid = t.dataset.nid, opt = t.dataset.opt; const cur = (myUvote().poll || {})[nid]; uvPatch({ poll: { [nid]: cur === opt ? "" : opt } }); render(); },
  inboxRead: () => { uvPatch({ inboxAt: nowIso() }); render(); toast("모두 읽음으로 바꿨어요"); },
  inboxToggle: t => { const off = prefs().inboxOff || {}; off[t.dataset.k] = !off[t.dataset.k]; setPref("inboxOff", off); render(); },
  momPick: t => { ui.momPick[t.dataset.eid] = t.dataset.pid; render(); },
  momSend: t => { const eid = t.dataset.eid; const pid = ui.momPick[eid]; const e = S.events[eid]; if (!pid || !e || !momOpen(e)) return; if ((myUvote().mom || {})[eid]) return; uvPatch({ mom: { [eid]: pid } }); render(); toast(`${pname(pid)} 선수에게 투표했어요`); },
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
["voteSheet", "evQ", "mlQ", "lineSide", "goEvTab", "rptTab", "claimPick", "posSel", "inboxToggle", "momPick", "teamShare", "pePos", "peRest", "noticeEdit"].forEach(a => READ_ACTS.add(a));
["claimConfirm", "posSend", "guestOpen", "pollVote", "inboxRead", "momSend"].forEach(a => VOTE_ACTS.add(a));
/* 화면을 그린 뒤 할 일: 공지를 열면 읽음으로 표시 */
function afterRender(v) {
  if (v === "notice" && Store.canVote && !Store.preview && Store.me && S.notices.length) {
    const seen = myUvote().seen || {}; const add = {}; S.notices.forEach(n => { if (!seen[n.id]) add[n.id] = nowIso(); });
    if (Object.keys(add).length) setTimeout(() => uvPatch({ seen: add }), 400);
  }
}


/* ---------- 팀원 화면 미리보기 (예시 데이터, 저장 안 됨) ---------- */
function demoBoot() {
  saveLocal = function () { return true; };
  Store.mode = "local"; Store.me = "demo-me"; Store.role = "member"; Store.canWrite = false; Store.canMoney = false; Store.canVote = true; Store.isOwner = false;
  Store.real = { role: "member", canWrite: false, canMoney: false, canVote: true, isOwner: false };
  const OP = window.__DEMO === "op";
  if (OP) { Object.assign(Store, { me: "demo-op", role: "owner", canWrite: true, canMoney: true, isOwner: true }); Store.real = { role: "owner", canWrite: true, canMoney: true, canVote: true, isOwner: true }; }
  const D = makeDemo();
  if (OP) demoOpExtras(D); COLLS.forEach(c => { R[c] = D[c] || {}; });
  derive();
  // 다음 내전 라인업은 앱의 자동 배치로 만든다
  const lid = D.__lineupEvent; const e = S.events[lid];
  if (e) {
    R.events[lid].teams = autoTeams(e, 3); derive();
    // 내전: 팀마다 7인 포메이션으로 쿼터별 자리와 휴식을 자동으로 짜 둔다
    ["A", "B"].forEach(side => { ui.lineSide = side; ui.lineSideEv = lid; R.events[lid].lineS = Object.assign(R.events[lid].lineS || {}, { [side]: { formation: "7|2-3-1", q: {} } }); derive();
      const out = autoRotate(S.events[lid]); const L = lineupOf(S.events[lid], side); const q = {}; L.q.forEach((_, k) => { q[k + 1] = out[k + 1]; }); R.events[lid].lineS[side] = { formation: L.formation, q }; derive(); });
    ui.lineSide = null; ui.lineSideEv = null;
  }
  applyRole(); route();
}
// 운영진 미리보기에서 처리할 일이 보이도록 확인 요청을 몇 개 넣는다
function demoOpExtras(D) {
  const ME = D.rsvp["demo-me"].pid, pid = Object.keys(D.players).find(k => D.players[k].name === "황종민");
  D.rsvp["demo-op"] = { pid: Object.keys(D.players).find(k => D.players[k].name === "정성목"), claimAt: nowIso() };
  D.fines.df1 = { id: "df1", pid: ME, date: D.mydues["demo-me"].fines.df1.date, reason: "지각", amount: 2000, paid: false, presetId: "late" };
  D.payreq["demo-me"] = { items: { "fine-df1": { kind: "fine", ref: "df1", amount: 2000, label: "지각 벌금", pid: ME, at: new Date(Date.now() - 864e5).toISOString(), status: "req" } } };
  // 회비: 지난 달까지는 거의 다 냈고, 이번 달은 절반 남짓
  const ids = Object.keys(D.players), m = thisMonth();
  for (let k = 0; k <= 6; k++) { const mm = shiftMonth(m, -k); D.dues[mm] = {}; ids.forEach((id, i) => { if (k > 0 ? i % 13 !== 5 || k > 2 : i % 5 < 3) D.dues[mm][id] = "paid"; }); }
  const next = Object.values(D.events).filter(e => e.date > todayStr()).sort((a, b) => a.date < b.date ? 1 : -1)[0];
  if (next && pid) D.guestreq["demo-g"] = { items: { gq1: { eid: next.id, name: "최민준", pos: "MF", pid, at: new Date(Date.now() - 3600e3).toISOString(), status: "req" } } };
}
function makeDemo() {
  const RO = [["1","김성우","ST","CAM"],["3","김영효","RWB","LWB"],["4","조수현","CB","RWB"],["5","이세영","LW","RWB"],["6","용호연","CAM","CB"],["7","김동욱","CDM","CB"],["8","권기현","CB","ST"],["10","주지운","CAM","CDM"],["11","황종민","RW","LW"],["12","이동환","CAM","CDM"],["14","김준엽","CB","CDM"],["15","정석광","CDM","CB"],["16","박정진","CDM","ST"],["17","이진우","RW","RWB"],["18","류영준","ST","LW"],["19","이동혁","LW","ST"],["20","박정민","CDM","CB"],["22","최태영","RW","LW"],["23","임희택","RWB","CDM"],["25","안성필","RWB","CB"],["27","김종한","LW","ST"],["37","김준수","CB","CAM"],["42","김휘승","CAM","CB"],["53","김대영","CDM","CB"],["72","한시현","RW","CDM"],["77","최휘용","CAM","CDM"],["91","송정의","CB","GK"],["93","홍지호","CB","CDM"],["95","조진혁","ST","RW"],["99","정성목","GK","RW"]];
  const D = {}; COLLS.forEach(c => { D[c] = {}; });
  const id = n => "d" + n; const byName = {};
  RO.forEach(([num, name, p1, p2]) => { const pid = id(num); byName[name] = pid; D.players[pid] = { id: pid, name, num, pos1: p1, pos2: p2, pos: DGROUP[p1], active: true, joined: "2026-01-01" }; });
  const ME = byName["이세영"];
  const t0 = parseD(todayStr()); const day = k => { const d = new Date(t0); d.setDate(d.getDate() + k); return ymd(d); };
  const iso = (k, hh, mm) => { const d = new Date(t0); d.setDate(d.getDate() + k); d.setHours(hh, mm || 0, 0, 0); return d.toISOString(); };
  D.team.settings = { ...DEFAULT_SETTINGS(), teamName: "KEI FC", cap: 14, fee: 20000, checkBefore: 10, lateCancelH: 24, account: "[예시 은행 계좌번호]", guestFee: 10000,
    finePresets: [{ id: "late", label: "지각", amount: 2000 }, { id: "noshow", label: "무단 불참", amount: 10000 }, { id: "cancel", label: "직전 취소", amount: 6000 }] };
  const core = ["정성목", "김성우", "김영효", "조수현", "이세영", "용호연", "김동욱", "권기현", "황종민", "이동환", "김준엽", "이진우", "류영준", "송정의"].map(n => byName[n]);
  const ev = (k, o, yes, extra) => { const att = {}, attAt = {}; yes.forEach((pid, i) => { att[pid] = "yes"; attAt[pid] = iso(Math.min(k - 5, -1), 9, i); }); const eid = "de" + (k < 0 ? "m" + (-k) : "p" + k) + (o.tag || ""); D.events[eid] = { id: eid, format: "11", time: "20:00", place: "보라매 축구장", ...o, date: day(k), att, attAt, ...(extra || {}) }; delete D.events[eid].tag; return eid; };
  const chk = (yes, over) => Object.assign(Object.fromEntries(yes.map(p => [p, "in"])), over || {});
  const p = n => byName[n];
  // 지난 일정
  const a1 = core.filter(x => x !== p("류영준")).concat([p("주지운")]);
  ev(-28, { type: "match", opponent: "강서 유나이티드", place: "신정 체육공원" }, a1, { check: chk(a1, { [ME]: "in" }), score: { us: 1, them: 3 }, goals: [{ id: "g1", pid: p("김성우"), assist: ME, q: 2 }] });
  const a2 = core.slice();
  ev(-21, { type: "match", opponent: "한양 FC" }, a2, { check: chk(a2), score: { us: 2, them: 2 }, goals: [{ id: "g2", pid: p("김성우"), assist: p("황종민"), q: 1 }, { id: "g3", pid: p("류영준"), assist: ME, q: 3 }] });
  const a3 = core.slice();
  const e3 = ev(-14, { type: "scrim" }, a3, { check: chk(a3, { [ME]: "late", [p("류영준")]: "late" }), score: { us: 3, them: 2 }, goals: [{ id: "g4", pid: p("김성우"), assist: ME, q: 1 }, { id: "g5", pid: ME, assist: p("용호연"), q: 2 }, { id: "g6", pid: p("류영준"), assist: "", q: 4 }] });
  const a4 = core.filter(x => x !== p("김동욱")).concat([p("김준수")]);
  const eMom = ev(0, { type: "scrim", time: "06:30", tag: "a", place: "보라매 축구장 (조기)" }, a4, { check: chk(a4), score: { us: 4, them: 3 }, goals: [{ id: "g7", pid: ME, assist: p("이진우"), q: 1 }, { id: "g8", pid: p("김성우"), assist: "", q: 2 }] });
  // 다가오는 일정
  const f1 = ["정성목", "김성우", "조수현", "용호연", "황종민", "이동환", "김준엽", "이진우", "류영준", "송정의"].map(p);
  ev(1, { type: "scrim", format: "futsal", place: "보라매 풋살장", cap: "12" }, f1);
  const scr = core.filter(x => x !== ME);
  const lid = ev(6, { type: "scrim", fieldFee: 120000 }, scr.concat([p("김준수")]), { teamsAt: iso(-1, 21) });
  D.events[lid].att[p("류영준")] = "late"; D.events[lid].lateQ = { [p("류영준")]: 3 };
  ev(13, { type: "match", opponent: "FC 서울", cap: "18" }, ["정성목", "김성우", "김영효", "조수현", "용호연", "김동욱", "권기현", "황종민", "이동환"].map(p));
  D.__lineupEvent = lid;
  // 나 (이세영): 다음 내전에 참석, 다른 일정은 내가 고르도록 비워 둠
  D.rsvp["demo-me"] = { pid: ME, claimAt: iso(-60, 10), ev: { [lid]: { s: "yes", at: iso(1, 9, 30).replace(/T.*/, "T00:00:30.000Z"), upd: iso(-2, 9), q: 0 } } };
  D.rsvp["demo-me"].ev[lid].at = iso(-1, 9, 4);
  // 내 회비 (본인 문서)
  const m = thisMonth(), pm = shiftMonth(m, -1), pm2 = shiftMonth(m, -2);
  D.mydues["demo-me"] = { pid: ME, months: Object.fromEntries([1, 2, 3, 4, 5, 6].map(k => [shiftMonth(m, -k), "paid"])), fines: { df1: { date: day(-14), reason: "지각", amount: 2000, paid: false }, df0: { date: day(-35), reason: "지각", amount: 2000, paid: true } } };
  // 공지와 설문
  D.notices.n1 = { id: "n1", title: "출석 체크는 모임 10분 전에 부릅니다", body: "10분 전에 없으면 지각이고 벌금 2,000원이에요. 늦을 것 같으면 앱에서 미리 늦참으로 바꿔 주세요. 늦참으로 바꾼 사람은 지각으로 치지 않아요.", pinned: true, at: iso(-3, 10) };
  D.notices.n2 = { id: "n2", title: "12월 회식 언제가 좋아요?", body: "", pinned: false, at: iso(-1, 20), poll: { opts: [{ id: "o1", label: "12월 12일 (토) 저녁" }, { id: "o2", label: "12월 13일 (일) 점심" }, { id: "o3", label: "12월 19일 (토) 저녁" }], until: day(2) + "T23:59" } };
  D.notices.n3 = { id: "n3", title: "겨울 유니폼 사이즈 조사 결과", body: "M 9벌, L 14벌, XL 5벌로 주문해요.", at: iso(-10, 12) };
  D.tally["poll-n2"] = { n: 19, c: { o1: 9, o2: 4, o3: 6 }, v: [] };
  D.tally["mom-" + eMom] = { n: 9, c: { [p("김성우")]: 4, [p("정성목")]: 3, [p("류영준")]: 2 }, v: [] };
  D.tally["mom-" + e3] = { n: 12, c: { [ME]: 5, [p("김성우")]: 4, [p("정성목")]: 3 }, v: [] };
  D.uvote["demo-me"] = { inboxAt: iso(-2, 9) };
  return D;
}

/* ---------- boot: 웹에서는 로그인과 팀 선택 뒤 web.js가 부른다 ---------- */
window.KEI_APP = { start() { applyBig(); setSync(); initStore(); } };
