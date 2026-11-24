// 매니볼 실제 앱: 로그인, 팀, 초대, 선수, 일정과 참석, 현장 출석과 벌금, 회비, 기록과 MOM, 공지와 설문, 용병, 라인업, 내전
// 서버는 Supabase(teams, members, docs). 예시 데이터는 없다.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "../../src/config.js";
import { memberRoute, memberForm, MACT } from "./member.js";
import { planLineup, canPlay, FIELD, isKeeper, fitOf } from "./lineup-core.js";
import { adminRoute, adminForm, AACT, eventFormInit, remindLeft, remindSheet, playerSheet, rosterSheet } from "./admin.js";
import { hd as uiHd, navBar, C, IC, teamLogo, setSec } from "./ui.js";
import { pushInit, pushToggle, pushDetach, kakaoOff } from "./push.js";
import { chatLoad, chatOnChange, CHACT } from "./chat.js";
import { isPC, onPCChange, pcShell, pcSplit } from "./pc.js";
import { XACT } from "./xteam.js";

const URL_ = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL;
const KEY_ = import.meta.env.VITE_SUPABASE_KEY || SUPABASE_KEY;
// 다른 용도로 쓰는 Supabase 프로젝트에 넣을 때는 public 대신 따로 만든 스키마(예: maniball)를 쓴다
const DB_SCHEMA = import.meta.env.VITE_SUPABASE_SCHEMA || "public";
// 저장(쓰기) 요청을 세어 둔다: 점검으로 넘어가거나 새 버전으로 새로 고치기 전에 보내던 저장을 끝까지 기다린다(MB_FLUSH).
// 점검 시작 10초 전부터는 새 저장을 보내지 않고 바로 실패로 돌려서, 화면이 먼저 바뀌었다가 사라지는 일이 없게 한다.
let inflight = 0; const idle = [];
const isWrite = (url, init) => { const m = ((init && init.method) || "GET").toUpperCase(); return m !== "GET" && m !== "HEAD" && /\/rest\/v1\//.test(String(url)); };
const maintFail = () => new Response(JSON.stringify({ code: "42501", message: "maintenance", details: null, hint: null }), { status: 403, headers: { "Content-Type": "application/json" } });
const markUnsaved = () => { try { sessionStorage.setItem("mb-unsaved", String((Number(sessionStorage.getItem("mb-unsaved")) || 0) + 1)); } catch (e) { /* 무시 */ } };
async function trackedFetch(url, init) {
  if (!isWrite(url, init)) return fetch(url, init);
  if (window.MB_MAINT && window.MB_MAINT.locked && window.MB_MAINT.locked()) return maintFail();
  inflight++;
  try {
    const r = await fetch(url, init);
    if (!r.ok && r.status !== 409) { try { const t = await r.clone().text(); if (/maintenance/.test(t)) markUnsaved(); } catch (e) { /* 무시 */ } }
    return r;
  } finally { inflight--; if (!inflight) idle.splice(0).forEach(f => f()); }
}
window.MB_FLUSH = () => inflight ? new Promise(res => idle.push(res)) : Promise.resolve();
const sb = createClient(URL_, KEY_, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }, db: { schema: DB_SCHEMA }, global: { fetch: trackedFetch } });
const KAKAO_KEY = "e5c9ffdb309018215f5fcbc89eddb201"; // REST API 키 (공개 값)
const APP = location.origin + location.pathname.replace(/index\.html$/, "");
const KAKAO_REDIRECT = new URL("../../", APP).href; // 카카오에 등록된 주소: 사이트 첫 주소가 이 화면으로 넘겨준다
const KK = (import.meta.env.VITE_STAGE === "test" ? "t-" : "") + "kei-web-kakao";
const qs = new URLSearchParams(location.search);
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// 테스트 사이트는 같은 주소(github.io)를 쓰므로 저장 이름 앞에 t-를 붙여 운영 사이트와 섞이지 않게 한다
const STAGE = import.meta.env.VITE_STAGE === "test" ? "t-" : "";
// 이 탭에서 팀에 한 번 들어갔는지 (새로고침마다 팀 고르기로 돌아가지 않게. 새로 열거나 로그인하면 다시 고른다)
const picked = { get: () => { try { return sessionStorage.getItem(STAGE + "mb-picked") === "1"; } catch (e) { return false; } }, set: () => { try { sessionStorage.setItem(STAGE + "mb-picked", "1"); } catch (e) { /* 없어도 됨 */ } }, clear: () => { try { sessionStorage.removeItem(STAGE + "mb-picked"); } catch (e) { /* 없어도 됨 */ } } };
const ls = { get: k => { try { return localStorage.getItem(STAGE + k); } catch (e) { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(STAGE + k) : localStorage.setItem(STAGE + k, v); } catch (e) { /* 없어도 된다 */ } } };
const WD = "일월화수목금토";
// 풋살 포지션: 골레이로(골키퍼), 픽소(수비), 아라(측면), 피보(공격)
const POS = { futsal: ["골레이로", "픽소", "아라", "피보"], soccer: ["GK", "LB", "CB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"] };
// 유니폼 (2026-11-23): 팀 설정의 HOME, AWAY 색. 경기마다 상대 유니폼 색과 우리가 입을 쪽을 정하고, 골키퍼는 본인이 고른 색
// 내전은 A팀 HOME, B팀 AWAY. 색을 정하지 않은 팀은 흰색. 유니폼 위 글자는 대비가 더 높은 쪽(먹색 또는 크림)으로
const KITS = [["흰색", "#FFFFFF"], ["검정", "#1E1E1E"], ["남색", "#23336B"], ["파랑", "#2F6BD8"], ["하늘", "#8EC8F2"], ["빨강", "#D23A33"], ["주황", "#F08A24"], ["노랑", "#F6D02F"], ["초록", "#2E9E4F"], ["보라", "#6B4AA8"], ["분홍", "#F2A7C3"], ["회색", "#9A9A9A"]];
const isKit = n => KITS.some(k => k[0] === n);
const kitHex = n => (KITS.find(k => k[0] === n) || KITS[0])[1];
const onKit = hex => { const v = parseInt(String(hex).slice(1), 16); const c = [v >> 16 & 255, v >> 8 & 255, v & 255].map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; return (L + 0.05) / 0.0556 >= 0.98 / (L + 0.05) ? "#121110" : "#FBF7EF"; };
const teamKit = () => { const k = (S.settings && S.settings.kit) || {}; return { home: isKit(k.home) ? k.home : "흰색", away: isKit(k.away) ? k.away : "흰색" }; };
// 비슷해서 헷갈리는 색끼리 (같은 색이거나 이 목록에 있으면 겹친다고 본다)
const KIT_NEAR = { 남색: ["파랑", "검정", "보라"], 파랑: ["남색", "하늘"], 하늘: ["파랑"], 검정: ["남색"], 빨강: ["주황", "분홍"], 주황: ["빨강", "노랑"], 노랑: ["주황"], 분홍: ["빨강"], 보라: ["남색"], 흰색: ["회색"], 회색: ["흰색"], 초록: [] };
const kitClash = (a, b) => !!a && !!b && (a === b || (KIT_NEAR[a] || []).includes(b));
const recKitFor = oppKit => { if (!isKit(oppKit)) return ""; const t = teamKit(); const h = kitClash(oppKit, t.home), w = kitClash(oppKit, t.away); return h && !w ? "away" : w && !h ? "home" : ""; };
const kitSideOf = (e, side) => side === "A" ? "home" : side === "B" ? "away" : (e && (e.kit === "home" || e.kit === "away") ? e.kit : recKitFor(e && e.oppKit) || "home");
const gkKitOf = u => { const p = (S.rsvp[u] && S.rsvp[u].profile) || {}; return isKit(p.gkKit) ? p.gkKit : "회색"; };
const JPATH = "M13 3 H19 C20 6 22 7 24 7 C26 7 28 6 29 3 H35 L46 12 L40 19 L37 17 V41 H11 V17 L8 19 L2 12 Z";
// 유니폼 아이콘: 어느 크기든 테두리가 2px로 보이게 선 굵기를 맞춘다
const jerseyIcon = (hex, w, o = {}) => `<svg viewBox="-2 -2 52 48" aria-hidden="true" style="display:block;flex:none;width:${w}px;height:${Math.round(w * 48 / 52)}px;overflow:visible"><path d="${JPATH}" fill="${hex}" stroke="#121110" stroke-width="${((o.bw || 2) * 52 / w).toFixed(2)}" stroke-linejoin="round"${o.dash ? ' stroke-dasharray="4 3"' : ""}/></svg>`;
// 색 고르기 칸 (12색, 6칸씩 두 줄). 누르면 data-act에 data-v(색 이름)가 간다
const kitPicker = (act, cur, extra = "", off = false) => `<div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px">${KITS.map(([n, h]) => `<button type="button" data-act="${act}" data-v="${n}" ${extra} aria-label="${n}" aria-pressed="${cur === n}" ${off ? "disabled" : ""} style="height:44px;padding:0;border:2px solid ${cur === n ? "#121110" : "transparent"};border-radius:10px;background:transparent;display:flex;align-items:center;justify-content:center"><span style="width:28px;height:28px;box-sizing:border-box;border-radius:50%;border:2px solid #121110;background:${h};display:flex;align-items:center;justify-content:center">${cur === n ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${onKit(h)}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>` : ""}</span></button>`).join("")}</div>`;
// 2026-11-20 측면 포지션을 하나로 묶음: 윙백은 풀백으로, 측면 미드필더는 윙어로 (예전 값은 posFix가 바꿔 읽는다)
const SOC_OLD = { LWB: "LB", RWB: "RB", LM: "LW", RM: "RW" };
const QN = { futsal: 8, soccer: 4 };
const ROLE = { owner: "Admin", admin: "운영진", member: "팀원" };
const KIT = [["#164F33", "초록"], ["#111827", "검정"], ["#1E3A8A", "파랑"], ["#991B1B", "빨강"], ["#F5B841", "노랑"], ["#F3F4F6", "흰색"]];
const numColor = c => ["#F5B841", "#F3F4F6"].includes(c) ? "#111827" : "#FFFFFF";

const S = { d: {}, session: null, uid: "", teams: [], tid: "", role: "", team: null, members: [], invite: "", settings: {}, events: {}, rsvp: {}, ready: false, flow: "", form: {}, ch: null };
// 운영진 화면과 팀원 화면은 따로 그린다. 운영진도 "팀원 화면 보기"로 자기 참석과 카드를 본다
// 운영진은 운영진 화면만 쓴다. 팀원 화면 검토용 주소(?view=member)로 들어올 때만 이 창에서 팀원 화면을 보여 준다
const ss = { get: k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) { /* 없어도 된다 */ } } };
// 팀원 화면 검토(?view=member)는 Admin만 한다
const viewMode = () => (isAdmin() && !(S.role === "owner" && ss.get("mb-review") === "member")) ? "admin" : "member";
function setView(v) { ss.set("mb-review", v === "member" ? "member" : null); }
const isAdmin = () => S.role === "owner" || S.role === "admin";
// 내보내기: Admin은 운영진과 팀원을, 운영진은 팀원만 (Admin은 아무도 못 내보낸다)
const canKick = x => !!x && x.uid !== S.uid && x.role !== "owner" && (S.role === "owner" || (S.role === "admin" && x.role === "member"));

/* ---------- 작은 도구 ---------- */
let toastT = 0;
function toast(m) { const l = $("#layer"); let t = l.querySelector(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); l.appendChild(t); } t.textContent = m; clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 2600); }
/* ---------- 입력 칸 자판 ----------
   숫자 칸(inputmode="numeric")은 숫자 키패드가 뜨고 숫자만 들어간다. 금액 칸은 쉼표를 붙인다 (저장할 때는 숫자만 읽음)
   글자 칸은 자동 대문자, 자동 고침, 맞춤법 밑줄을 끈다. 웹에서는 한글 자판을 강제로 띄울 수 없다 */
const isMoney = t => t.dataset.bind === "fee" || t.dataset.bind === "amount" || t.dataset.f === "amount";
const fmtMoney = v => { const d = String(v || "").replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 9); return d ? Number(d).toLocaleString("ko-KR") : ""; };
function cleanNum(t) {
  if (t.getAttribute("inputmode") !== "numeric" || t.type === "number") return;
  const old = t.value, caret = t.selectionStart == null ? old.length : t.selectionStart;
  const keep = t.dataset.bind === "account" ? /[0-9-]/ : /\d/;
  const next = isMoney(t) ? fmtMoney(old) : old.split("").filter(c => keep.test(c)).join("");
  if (next === old) return;
  const before = old.slice(0, caret).split("").filter(c => keep.test(c)).length;
  t.value = next;
  let pos = 0, seen = 0; while (pos < next.length && seen < before) { if (keep.test(next[pos])) seen++; pos++; }
  try { t.setSelectionRange(pos, pos); } catch (e) { /* 지원 안 하는 칸 */ }
}
function tuneInputs(root) {
  root.querySelectorAll("input, textarea").forEach(el => {
    if (el.tagName === "INPUT" && !["", "text", "search"].includes(el.getAttribute("type") || "")) return;
    if (el.getAttribute("inputmode") === "numeric") { if (el.dataset.bind !== "account") el.setAttribute("pattern", "[0-9]*"); if (isMoney(el) && el.value) el.value = fmtMoney(el.value); return; }
    el.setAttribute("autocapitalize", "off"); el.setAttribute("autocorrect", "off"); el.spellcheck = false;
    if (el.tagName === "INPUT" && !el.hasAttribute("autocomplete")) el.setAttribute("autocomplete", "off");
  });
}
function sheet(html) { $("#layer").innerHTML = `<div class="scrim" data-act="closeSheet"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`; tuneInputs($("#layer")); }
function closeSheet() { $("#layer").innerHTML = ""; }
function confirmBox(title, msg, ok, fn, danger) {
  $("#layer").innerHTML = `<div class="dlg" data-act="closeSheet"><div role="alertdialog" aria-modal="true"><h3>${esc(title)}</h3><span style="font-size:14px;line-height:1.6">${esc(msg)}</span><div class="grid2"><button class="btn" data-act="closeSheet">취소</button><button class="btn ${danger ? "c" : "o"}" id="okBtn">${esc(ok)}</button></div></div></div>`;
  $("#okBtn").onclick = () => { closeSheet(); fn(); };
}
const rand = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, "0")).join("");
async function sha256hex(t) { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)); return Array.from(new Uint8Array(d), b => b.toString(16).padStart(2, "0")).join(""); }
const uid36 = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const won = n => (Number(n) || 0).toLocaleString("ko-KR") + "원";
const todayStr = () => { const d = new Date(Date.now() + 9 * 3600e3); return d.toISOString().slice(0, 10); };
function evStart(e) { const t = /^\d{2}:\d{2}$/.test(e.time || "") ? e.time : "23:59"; return new Date(`${e.date}T${t}:00+09:00`); }
const started = e => Date.now() >= evStart(e).getTime();
function dLabel(e) { const d = Math.round((new Date(e.date + "T00:00:00+09:00") - new Date(todayStr() + "T00:00:00+09:00")) / 864e5); return d === 0 ? "오늘" : d > 0 ? "D-" + d : ""; }
function wd(date) { return WD[new Date(date + "T12:00:00+09:00").getUTCDay()]; }
const md = date => Number(date.slice(5, 7)) + "." + date.slice(8, 10);
const sport = () => S.settings.sport === "soccer" ? "soccer" : "futsal";
const errMsg = e => String((e && (e.message || e.error_description)) || e || "");

/* ---------- 서버 ---------- */
async function loadTeams() {
  const { data: mem, error } = await sb.from("members").select("team_id,role,display_name").eq("user_id", S.uid);
  if (error) throw error;
  const ids = mem.map(m => m.team_id); let names = {};
  if (ids.length) { const { data } = await sb.from("teams").select("id,name").in("id", ids); names = Object.fromEntries((data || []).map(t => [t.id, t.name])); }
  S.teams = mem.map(m => ({ id: m.team_id, role: m.role, name: names[m.team_id] || "팀", dn: m.display_name || "" }));
}
// 팀 고르기 화면에 쓸 종목, 인원, 다음 일정 (팀마다 한 번에 모아서 읽는다)
async function loadTeamsInfo() {
  const ids = S.teams.map(t => t.id); if (!ids.length) return;
  const [m, s, e] = await Promise.all([
    sb.from("members").select("team_id").in("team_id", ids),
    sb.from("docs").select("team_id,sport:data->>sport").eq("coll", "team").eq("id", "settings").in("team_id", ids),
    sb.from("docs").select("team_id,date:data->>date,time:data->>time,type:data->>type,place:data->>place,opponent:data->>opponent").eq("coll", "events").in("team_id", ids).gte("data->>date", todayStr()).limit(1000),
  ]);
  const info = {}; ids.forEach(id => { info[id] = { n: 0, sport: "", next: null }; });
  (m.data || []).forEach(r => { if (info[r.team_id]) info[r.team_id].n++; });
  (s.data || []).forEach(r => { if (info[r.team_id]) info[r.team_id].sport = r.sport === "soccer" ? "soccer" : "futsal"; });
  (e.data || []).forEach(r => { const x = info[r.team_id]; if (!x || !/^\d{4}-\d{2}-\d{2}$/.test(r.date || "")) return; const k = r.date + " " + (r.time || "99:99"); if (!x.next || k < x.nextK) { x.next = r; x.nextK = k; } });
  S.teamsInfo = info;
}
async function loadTeam(tid) {
  S.tid = tid;
  const [m, t, d] = await Promise.all([
    sb.from("members").select("*").eq("team_id", tid).order("joined_at"),
    sb.from("teams").select("id,name").eq("id", tid).maybeSingle(),
    sb.from("docs").select("coll,id,data").eq("team_id", tid).neq("coll", "gone").limit(5000),
  ]);
  if (m.error || t.error || d.error) throw m.error || t.error || d.error;
  S.members = m.data || []; S.team = t.data;
  const me = S.members.find(x => x.user_id === S.uid); S.role = me ? me.role : "";
  S.settings = {}; S.events = {}; S.rsvp = {}; S.d = {};
  (d.data || []).forEach(r => put(r.coll, r.id, r.data));
  if (isAdmin()) { const [inv] = await Promise.all([getInvite(tid), loadReqs()]); S.invite = inv; } else S.reqs = [];
  ls.set("mb-team", tid);
  watch(tid);
  chatLoad().then(scheduleRender).catch(() => {});
}
// 가입 신청 (Admin, 운영진만 볼 수 있다. 서버 정책도 같다)
async function loadReqs() {
  if (!S.tid || !isAdmin()) { S.reqs = []; return; }
  const { data, error } = await sb.from("join_requests").select("user_id,display_name,kakao_name,message,device,created_at").eq("team_id", S.tid).eq("status", "pending").order("created_at");
  S.reqs = error ? [] : data || [];
}
// 내가 남긴 가입 신청 (승인을 기다리는 화면용)
async function loadMyReqs() {
  const { data, error } = await sb.from("join_requests").select("team_id,team_name,status,created_at").eq("user_id", S.uid).order("created_at");
  S.myReqs = error ? [] : data || [];
}
// 초대 코드는 운영진만 서버 함수로 받는다 (새 규칙을 넣기 전이면 예전 방식으로)
async function getInvite(tid) {
  const { data, error } = await sb.rpc("team_invite_code", { p_team: tid });
  if (!error) return data || "";
  const { data: t } = await sb.from("teams").select("invite_code").eq("id", tid).maybeSingle();
  return (t && t.invite_code) || "";
}
function put(c, id, data) {
  if (c === "team" && id === "settings") S.settings = data || {};
  else if (c === "events") S.events[id] = { ...data, id };
  else if (c === "rsvp") S.rsvp[id] = data || {};
  else (S.d[c] = S.d[c] || {})[id] = data || {};
}
function drop(c, id) { if (c === "events") delete S.events[id]; else if (c === "rsvp") delete S.rsvp[id]; else if (S.d[c]) delete S.d[c][id]; }
const D = c => S.d[c] || {};
function watch(tid) {
  if (S.ch) sb.removeChannel(S.ch);
  const onDoc = p => {
    const n = p.new || {}; if (n.team_id !== tid) return;
    if (n.coll === "gone") { const i = n.id.indexOf(":"); const c = n.id.slice(0, i), id = n.id.slice(i + 1); if (c === "member") refreshMembers(); else drop(c, id); render(); return; }
    put(n.coll, n.id, n.data); scheduleRender();
  };
  S.ch = sb.channel("mb-" + tid)
    .on("postgres_changes", { event: "INSERT", schema: DB_SCHEMA, table: "docs", filter: "team_id=eq." + tid }, onDoc)
    .on("postgres_changes", { event: "UPDATE", schema: DB_SCHEMA, table: "docs", filter: "team_id=eq." + tid }, onDoc)
    .on("postgres_changes", { event: "INSERT", schema: DB_SCHEMA, table: "members", filter: "team_id=eq." + tid }, refreshMembers)
    .on("postgres_changes", { event: "UPDATE", schema: DB_SCHEMA, table: "members", filter: "team_id=eq." + tid }, refreshMembers)
    .on("postgres_changes", { event: "*", schema: DB_SCHEMA, table: "join_requests", filter: "team_id=eq." + tid }, () => loadReqs().then(render).catch(() => {}))
    .on("postgres_changes", { event: "*", schema: DB_SCHEMA, table: "chat", filter: "team_id=eq." + tid }, chatOnChange)
    .subscribe();
}
async function refreshMembers() {
  const { data } = await sb.from("members").select("*").eq("team_id", S.tid).order("joined_at");
  if (!data) return; S.members = data;
  const me = data.find(x => x.user_id === S.uid);
  if (!me) { ls.set("mb-team", null); location.replace(APP); return; }
  if (me.role !== S.role) { S.role = me.role; if (isAdmin()) S.invite = await getInvite(S.tid); }
  render();
}
document.addEventListener("keydown", ev => { if (ev.key === "Enter" && ev.target.getAttribute && ev.target.getAttribute("role") === "button" && ev.target.dataset.act) ev.target.click(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden && S.ready) refreshMembers(); });
// 화면은 먼저 바꾸고(기다리지 않게), 서버가 거절하면 되돌린다
const clone = x => x === undefined ? undefined : JSON.parse(JSON.stringify(x));
function getDoc(c, id) { if (c === "team" && id === "settings") return S.settings; if (c === "events") { const e = S.events[id]; if (!e) return undefined; const x = { ...e }; delete x.id; return x; } if (c === "rsvp") return S.rsvp[id]; return (S.d[c] || {})[id]; }
function restore(c, id, old) { if (old === undefined) drop(c, id); else put(c, id, old); scheduleRender(); }
const deepMerge = (a, b) => (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) ? Object.keys({ ...a, ...b }).reduce((o, k) => { o[k] = k in b ? deepMerge(a[k], b[k]) : a[k]; return o; }, {}) : b;
// 점검 직전(시작 10초 전부터)에는 화면을 바꾸기 전에 막는다: 눌렀다가 사라지는 일이 없게
const maintLocked = () => !!(window.MB_MAINT && window.MB_MAINT.locked && window.MB_MAINT.locked());
const MAINT_ERR = () => Object.assign(new Error("maintenance"), { code: "42501" });
async function setDoc(c, id, data) {
  if (maintLocked()) throw MAINT_ERR();
  const old = clone(getDoc(c, id)); put(c, id, data); scheduleRender();
  const { error } = await sb.from("docs").upsert({ team_id: S.tid, coll: c, id, data }, { onConflict: "team_id,coll,id" });
  if (error) { restore(c, id, old); throw error; }
}
async function patchDoc(c, id, patch) {
  const exists = c === "rsvp" ? !!S.rsvp[id] : c === "events" ? !!S.events[id] : c === "team" ? (id === "settings" || !!D("team")[id]) : !!D(c)[id];
  if (!exists) { await setDoc(c, id, patch); return; }
  if (maintLocked()) throw MAINT_ERR();
  const old = clone(getDoc(c, id)); put(c, id, deepMerge(clone(old) || {}, patch)); scheduleRender();
  const { data, error } = await sb.rpc("doc_patch", { p_team: S.tid, p_coll: c, p_id: id, p_patch: patch });
  if (error) { restore(c, id, old); throw error; } if (data && data.data) put(c, id, data.data); scheduleRender();
}
async function delDoc(c, id) { const { error } = await sb.from("docs").delete().eq("team_id", S.tid).eq("coll", c).eq("id", id); if (error) throw error; drop(c, id); }
const GUARD = { too_fast: "너무 빨리 반복하고 있어요. 잠시 뒤에 다시 해 주세요", event_canceled: "취소된 일정이라 바꿀 수 없어요", maintenance: "점검이 곧 시작돼서 저장되지 않았어요. 다시 열리면 한 번 더 눌러 주세요", not_closed: "아직 벌금 기준 시각 전이에요. 투표에서 바로 바꿔 주세요", need_late_cancel: "벌금 기준 시각이 지나서 사유를 남기고 불참으로 바꿔야 해요", mom_self: "MOM은 다른 사람에게만 줄 수 있어요", mom_not_came: "이날 온 사람만 MOM 투표를 할 수 있어요", guest_closed: "지금은 이 경기 용병 신청을 받지 않아요", event_started: "경기가 시작돼서 바꿀 수 없어요", not_going: "참석이나 늦참일 때만 바꿀 수 있어요", need_agree: "벌금에 동의해야 바꿀 수 있어요", admin_only: "Admin이나 운영진만 할 수 있어요", no_request: "이미 처리된 신청이에요", bad_request: "이름을 확인해 주세요", request_limit: "가입 신청은 한 번에 5팀까지 남길 수 있어요", vote_closed: "투표가 마감돼서 바꿀 수 없어요", no_event: "지워진 일정이에요", bad_vote: "저장할 수 없는 응답이에요", team_limit: "팀은 한 사람당 5개까지 만들 수 있어요", bad_code: "초대 링크가 바뀌었거나 잘못됐어요. 운영진에게 새 링크를 받아 주세요", mom_locked: "MOM 투표는 한 번만 낼 수 있어요", mom_closed: "MOM 투표 시간이 아니에요", no_player: "팀에 없는 사람이에요", poll_closed: "마감된 설문이에요", no_option: "없는 보기예요", no_poll: "지워진 설문이에요", owner_only: "Admin만 할 수 있어요", bad_inquiry: "평가 내용을 확인해 주세요", kick_denied: "운영진은 팀원만 내보낼 수 있어요", next_not_admin: "다음 Admin은 운영진 중에서 골라 주세요", owner_cannot_leave: "Admin은 다음 Admin을 정해야 나갈 수 있어요", not_self: "나에게는 할 수 없어요", not_allowed: "운영진만 할 수 있어요", owner_has_members: "팀원이 남아 있어요. 팀 설정에서 다음 Admin을 정하고 팀을 나가 주세요" };
function fail(e) { const m = errMsg(e); const k = Object.keys(GUARD).find(x => m.includes(x)); toast(k ? GUARD[k] : /JWT|fetch|network/i.test(m) ? "연결이 끊겼어요. 잠시 후 다시 해 주세요" : "저장하지 못했어요. 잠시 후 다시 해 주세요"); console.error(e); }

/* ---------- 사람과 참석 ---------- */
// 예전 풋살 포지션 이름(GK, DF, LW, RW, FW)으로 저장된 팀원은 풋살 이름으로 보여 준다
const FUT_OLD = { GK: "골레이로", DF: "픽소", LW: "아라", RW: "아라", MF: "아라", FW: "피보" };
const posFix = x => sport() === "futsal" ? FUT_OLD[x] || x : SOC_OLD[x] || x;
const profileOf = u => { const p = (S.rsvp[u] && S.rsvp[u].profile) || null; if (!p) return p; const a = posFix(p.pos1), b = posFix(p.pos2); return { ...p, pos1: a, pos2: b === a ? "" : b }; };
const myProfile = () => profileOf(S.uid);
const nameOf = u => (profileOf(u) && profileOf(u).name) || (S.members.find(m => m.user_id === u) || {}).display_name || "이름 없음";
const people = () => S.members.map(m => ({ uid: m.user_id, role: m.role, name: nameOf(m.user_id), p: profileOf(m.user_id) || {} }));
// 풋살은 늦참이 없다: 고를 수 없고, 예전에 늦참으로 낸 표는 참석으로 센다
export const noLate = () => sport() === "futsal";
function att(e) {
  const out = { yes: [], late: [], no: [], none: [], wait: [], cap: Number(e.cap) || 0 };
  const going = [];
  people().forEach(x => {
    const r = ((S.rsvp[x.uid] || {}).ev || {})[e.id];
    const s = r && r.s === "late" && noLate() ? "yes" : r && r.s;
    if (s === "yes" || s === "late") going.push({ ...x, s, q: Number(r.q) || 0, at: r.at || "" });
    else if (s === "no") out.no.push(x); else out.none.push(x);
  });
  // 받은 용병도 정원 안에 들어가고, 정원이 찼으면 받은 순서대로 대기 뒤에 선다 (inCap 표시가 있는 용병만)
  // 예전 버전에서 받은 용병(inCap 없음)은 예전처럼 정원 밖에 둔다: 업데이트로 팀원이 대기로 밀리는 일이 없게
  const extra = [];
  Object.entries(e.guests || {}).forEach(([id, g]) => (g && g.inCap ? going : extra).push({ uid: "g:" + id, name: (g && g.name) || "용병", guest: true, role: "guest", s: "yes", q: 0, at: (g && g.at) || "", p: { pos1: posFix((g && g.pos) || ""), pos2: posFix((g && g.pos2) || "") } }));
  going.sort((a, b) => (a.at || "~") < (b.at || "~") ? -1 : 1);
  going.forEach((x, i) => { if (out.cap && i >= out.cap) out.wait.push(x); else (x.s === "late" ? out.late : out.yes).push(x); });
  out.yes.push(...extra);
  out.in = out.yes.length + out.late.length;
  return out;
}
const myVote = e => { const v = (((S.rsvp[S.uid] || {}).ev || {})[e.id]) || {}; return v.s === "late" && noLate() ? { ...v, s: "yes", q: 0 } : v; };
// 투표 마감: 경기 전날 정한 시각(eve, voteTime) 또는 경기 시작 전까지. 예전 값(eve21, day06)도 읽는다
// 마감 뒤 경기 시작 전까지는 본인이 불참 변경 신청(late_cancel)으로만 바꾼다. 열림 예약(openAt) 전에는 누를 수 없다
const voteTimeOf = e => e.voteClose === "eve21" ? "21:00" : /^\d\d:\d\d$/.test(e.voteTime || "") ? e.voteTime : "21:00";
function closeAt(e) {
  if (e.voteClose === "eve" || e.voteClose === "eve21") return new Date(e.date + "T" + voteTimeOf(e) + ":00+09:00").getTime() - 864e5;
  if (e.voteClose === "day06") return new Date(e.date + "T06:00:00+09:00").getTime();
  return evStart(e).getTime();
}
// 불참 벌금 기준 시각 (기본 운영 규칙, Admin이 정함): 투표 마감 뒤, 경기 당일 0시, 직접 정하기(경기 N일 전 오전/오후 H시). 마감보다 늦을 수는 없다
function fineAt(e) {
  const st = S.settings || {}; const ca = Number(closeAt(e)); const day0 = Date.parse(e.date + "T00:00:00+09:00");
  let t = ca;
  if (st.fineFrom === "day") t = day0;
  else if (st.fineFrom === "custom") { const d = Math.max(1, Math.min(14, Number(st.fineDays) || 1)); const h12 = Math.min(12, Math.max(1, Number(st.fineHour) || 12)); const h = st.fineAp === "am" ? (h12 === 12 ? 0 : h12) : (h12 === 12 ? 12 : h12 + 12); t = day0 - d * 864e5 + h * 3600e3; }
  return Math.min(t, ca);
}
const fineNow = e => voteState(e) === "open" && Date.now() >= fineAt(e);
const hmK = t => { const d = new Date(t + 9 * 3600e3); return `${d.getUTCMonth() + 1}.${String(d.getUTCDate()).padStart(2, "0")} ${"일월화수목금토"[d.getUTCDay()]} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`; };
const fineText = e => { const fa = fineAt(e), ca = Number(closeAt(e)); if (fineNow(e)) return "불참 벌금 기준 시각이 지났어요."; return fa < ca ? `${hmK(fa)}부터는 불참으로 바꾸면 벌금이 붙어요.` : `마감(${hmK(ca)}) 전까지 바꿀 수 있어요.`; };
// 벌금 기준 시각이 지난 뒤(또는 마감 뒤) 참석, 늦참에서 불참으로: 서버 함수가 벌금과 사유를 남긴다
async function lateCancel(e, reason, agree) {
  const { data, error } = await sb.rpc("late_cancel", { p_team: S.tid, p_event: e.id, p_reason: String(reason || "").trim().slice(0, 80), p_agree: !!agree });
  if (error) throw error;
  try { await loadTeam(S.tid); } catch (err) { /* 실시간으로 곧 바뀐다 */ }
  return data;
}
const voteState = e => started(e) ? "done" : (e.openAt && Date.now() < Date.parse(e.openAt)) ? "soon" : Date.now() >= closeAt(e) ? "closed" : "open";
const ampm = hm => { const [h, m] = hm.split(":").map(Number); return (h < 12 ? "오전 " : "오후 ") + (h % 12 === 0 ? 12 : h % 12) + ":" + String(m).padStart(2, "0"); };
// 마감 후 불참으로 빠진 사람 때문에 대기에서 참석으로 올라왔으면 그 시각 (빠진 사람이 그대로 있었다면 대기였는지 다시 세어 본다)
function promotedAt(e, u) {
  const lc = e.lateCancel || {}; const ids = Object.keys(lc); const cap = Number(e.cap) || 0;
  if (!ids.length || !cap) return "";
  const a = att(e); if (![...a.yes, ...a.late].some(x => x.uid === u)) return "";
  const going = [];
  people().forEach(x => { if (lc[x.uid]) { going.push({ uid: x.uid, at: lc[x.uid].at || "" }); return; } const r = (((S.rsvp[x.uid] || {}).ev || {})[e.id]) || {}; if (r.s === "yes" || r.s === "late") going.push({ uid: x.uid, at: r.at || "" }); });
  going.sort((p, q) => (p.at || "~") < (q.at || "~") ? -1 : 1);
  if (going.findIndex(x => x.uid === u) < cap) return "";
  return ids.map(k => lc[k].t || "").sort().pop() || "";
}
const closeText = e => (e.voteClose === "eve" || e.voteClose === "eve21" ? `경기 전날 ${ampm(voteTimeOf(e))} 마감` : e.voteClose === "day06" ? "경기 당일 06:00 마감" : "경기 시작 전까지");
// 동그라미 안 글자: 괄호 같은 기호는 건너뛴다
const ini = n => (String(n || "").replace(/[^0-9A-Za-z\uAC00-\uD7A3]/g, "")[0] || "?");
const upcoming = () => Object.values(S.events).filter(e => !started(e) || (Date.now() - evStart(e)) < 3 * 3600e3).sort((a, b) => evStart(a) - evStart(b));
// 취소된 일정 (59번): 운영진이 사유를 남기고 취소한 일정. 기록, 출석, MOM, 성적에서 빠진다
const isCanceled = e => !!(e && e.cancel && e.cancel.at);
const past = () => Object.values(S.events).filter(e => started(e) && !isCanceled(e)).sort((a, b) => evStart(b) - evStart(a));

/* ---------- 화면 조각 ---------- */
const BACK = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"></path></svg>`;
const LOGO = s => `<span role="img" aria-label="매니볼" style="width:${s}px;height:${s}px;border-radius:${Math.round(s * .28)}px;background:#1E6B45;display:inline-flex;align-items:center;justify-content:center;flex:none;box-shadow:0 0 0 1px rgba(255,255,255,.25)"><svg width="${Math.round(s * .75)}" height="${Math.round(s * .75)}" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="22" fill="none" stroke="#FFFFFF" stroke-width="5"></circle><circle cx="23" cy="26" r="3.5" fill="#F5B841"></circle><circle cx="23" cy="38" r="3.5" fill="#F5B841"></circle><path d="M30 26 H43 M30 38 H41" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round"></path></svg></span>`;
// 카카오 로그인 공식 심볼(말풍선). 모양, 비율, 색(#000000)을 바꾸지 않는다 (카카오 로그인 디자인 가이드)
const KAKAO = `<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path fill="#000000" fill-rule="evenodd" clip-rule="evenodd" d="M9.00002 0.599976C4.02917 0.599976 0 3.71296 0 7.55229C0 9.94003 1.55847 12.0452 3.93152 13.2969L2.93303 16.9446C2.84481 17.2669 3.21341 17.5238 3.49646 17.337L7.87334 14.4483C8.24268 14.4839 8.61815 14.5047 9.00002 14.5047C13.9706 14.5047 18 11.3917 18 7.55229C18 3.71296 13.9706 0.599976 9.00002 0.599976"/></svg>`;
function jersey(size, num, color) {
  return `<span style="position:relative;width:${size}px;height:${size}px;display:inline-flex;align-items:center;justify-content:center;flex:none"><svg width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true"><path d="M30 12 L40 8 Q50 17 60 8 L70 12 L93 27 L84 45 L74 40 L74 92 Q50 97 26 92 L26 40 L16 45 L7 27 Z" fill="${esc(color || "#164F33")}"></path><path d="M40 8 Q50 21 60 8" fill="none" stroke="#F5B841" stroke-width="3"></path><path d="M7 27 L16 45 M93 27 L84 45" stroke="#F5B841" stroke-width="3"></path></svg><b data-live="num" style="position:absolute;left:0;right:0;top:40%;text-align:center;color:${numColor(color || "#164F33")};font-size:${Math.round(size * .29)}px;font-weight:900;line-height:1;letter-spacing:-2px">${esc(num || "")}</b></span>`;
}
// 뒤로 가기: 들어온 순서를 기억해 온 곳으로 돌아간다. 처음 들어왔거나 기록이 없으면 화면마다 정한 곳으로
const ROOTS = ["/", "/schedule", "/records", "/team", "/ops"];
const FORM_RT = /^\/(new$|edit\/|notice-new$|notice-edit\/|settings$|rules-edit$|policy$|result\/|check\/|posreq$|scrim\/)/;
const HK = STAGE + "mb-hist";
const hist = { get() { try { return JSON.parse(sessionStorage.getItem(HK) || "[]"); } catch (e) { return []; } }, set(a) { try { sessionStorage.setItem(HK, JSON.stringify(a.slice(-30))); } catch (e) { /* 저장이 막혀도 정한 곳으로 돌아간다 */ } } };
function trackRoute(r) {
  let a = hist.get();
  if (ROOTS.includes(r)) a = [r];
  else if (a.length >= 2 && a[a.length - 2] === r) a.pop();
  else if (a[a.length - 1] !== r) {
    if (a.length && FORM_RT.test(a[a.length - 1])) a.pop(); // 저장하고 넘어오면 폼 화면은 기록에서 뺀다
    const i = a.indexOf(r); a = i >= 0 ? a.slice(0, i + 1) : [...a, r];
  }
  hist.set(a);
}
const backHref = fallback => { const a = hist.get(); const r = route(); return a.length >= 2 && a[a.length - 1] === r ? "#" + a[a.length - 2] : fallback; };
const top = (title, back, right) => uiHd(title, back ? backHref(back) : "", { right: right || "" });
const nav = on => navBar(on);
function eventCard(e, opts = {}) {
  const a = att(e); const v = myVote(e); const mine = !!myProfile();
  const closed = started(e);
  const sub = e.type === "match" ? (e.opponent ? "vs " + e.opponent : "상대팀 미정") : e.type === "scrim" ? "내전 (A팀 대 B팀)" : "훈련";
  return `<div class="card">
    <a href="#/event/${esc(e.id)}" style="text-decoration:none;color:inherit;display:flex;gap:12px;align-items:center">
      <span class="datebox ${closed ? "gray" : ""}"><span>${wd(e.date)}</span><b>${Number(e.date.slice(8, 10))}</b></span>
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px"><span class="row" style="gap:8px"><span class="tag ${e.type === "training" ? "blue" : ""}">${e.type === "match" ? "경기" : e.type === "scrim" ? "내전" : "훈련"}</span><b style="font-size:16px">${esc(e.time || "")}${e.end ? " ~ " + esc(e.end) : ""}</b></span><span class="hint">${esc(e.place || "장소 미정")}, ${esc(sub)}</span></span>
      <span class="hint" style="flex:none">${dLabel(e)}</span>
    </a>
    <div class="spread hint"><span>참석 <b style="color:#111827">${a.in}</b>${a.cap ? " / 정원 " + a.cap : ""}${a.wait.length ? ", 대기 " + a.wait.length : ""}</span><span>미응답 ${a.none.length}</span></div>
    ${mine && !closed && !opts.noVote ? voteRow(e, v) : ""}
    ${mine && v.s === "late" && !noLate() && !closed && !opts.noVote ? lateRow(e, v) : ""}
  </div>`;
}
function voteRow(e, v) {
  const b = (s, l) => `<button class="vote ${v.s === s ? "on " + s : ""}" data-act="vote" data-eid="${esc(e.id)}" data-v="${s}" aria-pressed="${v.s === s}">${l}</button>`;
  return noLate() ? `<div class="seg3" style="grid-template-columns:repeat(2,minmax(0,1fr))">${b("yes", "참석")}${b("no", "불참")}</div>` : `<div class="seg3">${b("yes", "참석")}${b("late", "늦참")}${b("no", "불참")}</div>`;
}
function lateRow(e, v) {
  const n = QN[sport()];
  return `<div class="field"><span class="hint">몇 쿼터부터 뛸 수 있어요?</span><div class="chips">${Array.from({ length: n - 1 }, (_, i) => i + 2).map(q => `<button class="chip sm ${Number(v.q) === q ? "on" : ""}" data-act="lateQ" data-eid="${esc(e.id)}" data-q="${q}">${q}Q부터</button>`).join("")}</div></div>`;
}

/* ---------- 로그인 전 ---------- */
const KKB = (label, act = "kakao") => `<button class="kkb" data-act="${act}">${KAKAO}${label}</button>`;
const MBRAND = (sz = 44) => `<span style="display:inline-flex;align-items:center;gap:8px"><span role="img" aria-label="매니볼" style="width:${sz}px;height:${sz}px;border-radius:12px;background:${C.fc};border:2px solid ${C.ink};display:inline-flex;align-items:center;justify-content:center;flex:none"><svg width="${Math.round(sz * .75)}" height="${Math.round(sz * .75)}" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="22" fill="none" stroke="${C.ink}" stroke-width="5"></circle><circle cx="23" cy="26" r="3.6" fill="${C.orange}"></circle><circle cx="23" cy="38" r="3.6" fill="${C.orange}"></circle><path d="M30 26 H43 M30 38 H41" fill="none" stroke="${C.ink}" stroke-width="5" stroke-linecap="round"></path></svg></span><span style="display:flex;flex-direction:column;line-height:1"><b class="bh" style="font-size:${Math.round(sz * .55)}px">매니볼</b><span class="bc" style="font-size:12px;letter-spacing:3px;margin-top:4px">MANIBALL</span></span></span>`;
const PRIV = `<a href="../../privacy.html" style="display:inline-block;padding:8px 0">개인정보처리방침과 이용약관</a>`;
const ERRBOX = `<div role="alert" style="display:flex;gap:8px;align-items:flex-start;border:2px solid ${C.ink};border-radius:12px;background:${C.white};box-shadow:4px 4px 0 ${C.ink};padding:12px 16px"><b style="flex:none;width:22px;height:22px;border-radius:50%;background:${C.ink};color:${C.bg};display:flex;align-items:center;justify-content:center;font-size:14px">!</b><span style="display:flex;flex-direction:column;gap:4px"><b style="font-size:16px">로그인하지 못했어요</b><span style="font-size:12px">카카오 화면에서 취소했거나 연결이 끊겼어요. 다시 눌러 주세요.</span></span></div>`;
// PC 로그인 (PC 시안): 위 띠에 로고와 둘러보기, 가운데 왼쪽 패스 카드, 오른쪽 카카오 카드
function vLoginPC(err, tag, li) {
  return `<div class="lgp"><header class="lgt">${MBRAND(36)}<a href="../../">매니볼 둘러보기</a></header>
    <div class="lgm"><div class="lgl"><div class="paper" style="position:relative;background:${C.white};border-radius:12px">
      <div style="padding:32px 32px 20px;display:flex;flex-direction:column;gap:12px"><b style="font-size:14px">매니볼 패스</b><h1 class="bh" style="margin:0;font-weight:400;font-size:44px;line-height:1.25">운영진이 매주 손으로 하던 일,<br>이제 매니볼이 해요</h1></div>
      <div class="pcut" aria-hidden="true"></div>
      <div style="padding:20px 32px 28px;display:flex;flex-wrap:wrap;gap:8px">${tag("참석 투표", C.white)}${tag("라인업", C.white)}${tag("출석과 벌금", C.white)}${tag("회비", C.white)}${tag("MOM", C.white)}</div>
      <span aria-hidden="true" style="position:absolute;right:24px;top:-30px;width:84px;height:84px;border-radius:50%;border:2.5px solid ${C.ink};background:${C.bg};transform:rotate(12deg);display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1"><b style="font-size:24px">입장</b></span>
    </div>
    <ul class="lgli">${li("참석 투표는 티켓 한 장으로", C.white)}${li("내 자리와 쉬는 쿼터를 바로 확인", C.white)}${li("내가 낼 돈과 계좌를 한 화면에서", C.white)}</ul></div>
    <div class="lgr"><h2 class="bh">카카오로 들어와요</h2><span style="font-size:14px;line-height:1.6">휴대폰에서 쓰던 그 계정이에요. 같은 계정이면 팀과 기록이 그대로 보여요.</span>
      ${err ? ERRBOX : ""}${KKB("카카오 로그인")}${STAGE ? `<button class="btn" data-act="demo" style="height:52px;border-radius:12px;background:${C.white};border:2px solid ${C.ink};box-shadow:4px 4px 0 ${C.ink};font-size:16px">로그인 없이 체험하기</button><span class="note" style="font-size:12px">테스트 사이트에서만 보여요. 나만의 체험 팀에서 Admin으로 모든 기능을 써 볼 수 있고, 하루 뒤 지워져요.</span>` : ""}
      <span class="note" style="font-size:12px;line-height:1.6">카카오 창이 새로 열려요. 로그인하면 ${PRIV}에 동의하는 것으로 봐요.</span></div></div>
  </div>`;
}
function vLogin(err) {
  const tag = (t, c) => `<span style="font-size:12px;font-weight:700;border:2px solid ${C.ink};border-radius:8px;padding:4px 8px;background:${c}">${t}</span>`;
  const li = (t, c) => `<li style="display:flex;align-items:center;gap:12px;font-size:16px"><span aria-hidden="true" style="flex:none;width:28px;height:28px;border:2px solid ${C.ink};border-radius:8px;background:${c};display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${C.ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"></path></svg></span>${t}</li>`;
  if (isPC()) return vLoginPC(err, tag, li);
  return `<div style="flex:1;display:flex;flex-direction:column;padding:36px 24px 32px;gap:24px">
    ${MBRAND(44)}
    <div class="paper" style="position:relative;margin-top:8px;background:${C.white};border-radius:12px">
      <div style="padding:24px 24px 16px;display:flex;flex-direction:column;gap:8px"><b style="font-size:14px">매니볼 패스</b><h1 class="bh" style="margin:0;font-weight:400;font-size:32px;line-height:1.25">운영진이 매주<br>손으로 하던 일,<br>이제 매니볼이 해요</h1></div>
      <div class="pcut" aria-hidden="true"></div>
      <div style="padding:16px 24px 24px;display:flex;flex-wrap:wrap;gap:8px">${tag("참석 투표", C.white)}${tag("라인업", C.white)}${tag("출석과 벌금", C.white)}${tag("회비", C.white)}${tag("MOM", C.white)}</div>
      <span aria-hidden="true" style="position:absolute;right:18px;top:-26px;width:70px;height:70px;border-radius:50%;border:2.5px solid ${C.ink};background:${C.bg};transform:rotate(12deg);display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.1"><b style="font-size:20px">입장</b></span>
    </div>
    <ul style="list-style:none;margin:4px 0 0;padding:0;display:flex;flex-direction:column;gap:12px">${li("참석 투표는 티켓 한 장으로", C.white)}${li("내 자리와 쉬는 쿼터를 바로 확인", C.white)}${li("내가 낼 돈과 계좌를 한 화면에서", C.white)}</ul>
    <div style="margin-top:auto;display:flex;flex-direction:column;gap:12px">${err ? ERRBOX : ""}${KKB("카카오 로그인")}${STAGE ? `<button class="btn" data-act="demo" style="height:52px;border-radius:12px;background:${C.white};border:2px solid ${C.ink};box-shadow:4px 4px 0 ${C.ink};font-weight:700">로그인 없이 체험하기</button><span class="note" style="text-align:center;font-size:12px">테스트 사이트에서만 보여요. 나만의 체험 팀에서 Admin으로 모든 기능을 써 볼 수 있고, 하루 뒤 지워져요.</span>` : ""}
      <span class="note" style="text-align:center;font-size:12px">처음 한 번만 로그인하면 다음부터 바로 들어와요. 앱 설치는 필요 없어요.<br>로그인하면 ${PRIV}에 동의하는 것으로 봐요.</span>
      <a href="../../" style="text-align:center;font-size:14px;padding:12px 8px;min-height:44px;box-sizing:border-box">매니볼 둘러보기</a></div>
  </div>`;
}
const STEPS = (arr) => `<ol style="list-style:none;margin:0;padding:0;border-top:2px solid ${C.ink}">${arr.map(([a, b, c], i) => `<li style="display:flex;align-items:center;gap:16px;min-height:62px;border-bottom:2px solid ${C.line}"><span class="bc" style="flex:none;width:32px;height:32px;border-radius:50%;border:2px solid ${C.ink};background:${C.white};display:flex;align-items:center;justify-content:center;font-size:16px">${i + 1}</span><span style="display:flex;flex-direction:column;gap:4px"><b style="font-size:16px">${a}</b><span style="font-size:12px;color:${C.sub}">${b}</span></span></li>`).join("")}</ol>`;
const INVCARD = (name, sub, note) => `<div class="paper" style="background:${C.white};border-radius:12px;padding:16px 0;display:flex;flex-direction:column;gap:16px">
    <div style="display:flex;align-items:center;gap:16px;padding:0 24px"><span role="img" aria-label="팀" style="flex:none;width:64px;height:64px;border-radius:12px;border:2px solid ${C.ink};background:${C.fc};color:${C.white};display:flex;align-items:center;justify-content:center" class="bh"><span style="font-size:24px">${esc(ini(name))}</span></span><span style="display:flex;flex-direction:column;gap:4px;min-width:0"><b style="font-size:12px">초대장</b><b class="bh" style="font-size:24px;line-height:1.1;overflow:hidden;text-overflow:ellipsis">${esc(name || "팀")}</b>${sub ? `<span style="font-size:12px">${sub}</span>` : ""}</span></div>
    ${note ? `<div class="pcut" aria-hidden="true"></div><div style="padding:0 24px;font-size:14px;line-height:1.6">${note}</div>` : ""}</div>`;
function vInvite(teamName, err) {
  return `<div style="flex:1;display:flex;flex-direction:column;padding:32px 24px 32px;gap:20px">
    ${MBRAND(36)}
    <h1 class="bh" style="margin:0;font-weight:400;font-size:32px">팀 초대를 받았어요</h1>
    ${INVCARD(teamName, "", "카카오로 로그인하고 가입 신청을 남기면, 운영진이 확인한 뒤 팀원이 돼요.")}
    ${STEPS([["카카오로 로그인", "비밀번호 없이 바로 들어와요", "#FEE500"], ["가입 신청 남기기", "팀에서 쓰는 이름을 적어요", C.green], ["운영진 승인", "승인되면 바로 투표할 수 있어요", C.blue]])}
    <div style="margin-top:auto;display:flex;flex-direction:column;gap:12px">${err ? ERRBOX : ""}${KKB("카카오 로그인하고 가입하기")}<span class="note" style="text-align:center;font-size:12px">처음 한 번만 하면 다음부터 바로 들어와요. ${PRIV}</span></div>
  </div>`;
}

/* ---------- 팀 만들기 ---------- */
// 팀 고르기: 앱을 첫 화면으로 열면 먼저 고른다 (팀이 하나여도). 팀 안에서 '다른 팀, 새 팀'을 눌러도 이 화면 (뒤로 있음)
// 팀 고르기 종목 로고 (사용자가 만든 풋살, 축구 로고)
const SPORT_LOGO = { futsal: `<svg width="52" height="52" viewBox="6 6 88 88" role="img" aria-label="풋살" style="flex: none; display: block"><rect x="6" y="6" width="88" height="88" rx="22" fill="#1D4ED8"></rect><g fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linejoin="round" opacity="0.9"><rect x="18" y="15" width="64" height="70" rx="1"></rect><line x1="18" y1="50" x2="82" y2="50"></line><path d="M34 15 A10 10 0 0 0 44 25 L56 25 A10 10 0 0 0 66 15"></path><path d="M34 85 A10 10 0 0 1 44 75 L56 75 A10 10 0 0 1 66 85"></path></g><rect x="25" y="37" width="50" height="26" rx="6" fill="#1D4ED8"></rect><text x="50" y="61" text-anchor="middle" font-family="Inter, 'Noto Sans KR', sans-serif" font-weight="800" font-size="30" fill="#FFFFFF">FS</text></svg>`, soccer: `<svg width="52" height="52" viewBox="6 6 88 88" role="img" aria-label="축구" style="flex: none; display: block"><rect x="6" y="6" width="88" height="88" rx="22" fill="#15803D"></rect><g fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linejoin="round" opacity="0.9"><rect x="18" y="15" width="64" height="70" rx="1"></rect><line x1="18" y1="50" x2="82" y2="50"></line><rect x="33" y="15" width="34" height="13"></rect><rect x="41" y="15" width="18" height="6"></rect><rect x="33" y="72" width="34" height="13"></rect><rect x="41" y="79" width="18" height="6"></rect></g><rect x="25" y="37" width="50" height="26" rx="6" fill="#15803D"></rect><text x="50" y="61" text-anchor="middle" font-family="Inter, 'Noto Sans KR', sans-serif" font-weight="800" font-size="30" fill="#FFFFFF">FC</text></svg>` };
function vTeams() {
  const sw = S.teamsMode === "switch", info = S.teamsInfo || {}, last = ls.get("mb-team");
  const myName = (S.teams.find(t => t.dn) || {}).dn || suggestedName();
  const RT = { owner: "blue", admin: "orange", member: "" };
  const card = t => {
    const x = info[t.id] || {}; const on = sw ? t.id === S.tid : t.id === last; const e = x.next;
    const what = e ? `${md(e.date)} ${wd(e.date)} ${e.time ? e.time + " " : ""}${e.type === "match" ? "경기" : e.type === "scrim" ? "내전" : "훈련"}` : "아직 없어요";
    return `<button data-act="teamGo" data-id="${esc(t.id)}" style="display:flex;align-items:center;gap:16px;width:100%;text-align:left;padding:16px 16px 16px 16px;border:2px solid ${C.ink};border-radius:12px;background:${C.white};box-shadow:4px 4px 0 ${C.ink}">
      ${x.sport ? teamLogo(52, x.sport) : `<span class="bh" style="flex:none;width:52px;height:52px;border-radius:14px;border:2px solid ${C.ink};background:${C.bg};display:flex;align-items:center;justify-content:center;font-size:20px">${esc(ini(t.name))}</span>`}
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px"><span style="display:flex;align-items:center;gap:8px;min-width:0"><b style="font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.name)}</b><span class="tag ${RT[t.role] || ""}" style="${RT[t.role] ? "" : `background:${C.white};color:${C.ink}`}">${ROLE[t.role] || "팀원"}</span></span>
      <span style="font-size:12px">${x.sport ? (x.sport === "soccer" ? "축구팀" : "풋살팀") + " " : ""}${x.n ? "팀원 " + x.n + "명" : ""}</span>${S.teamsInfo ? `<b style="font-size:12px">다음 일정 ${esc(what)}</b>` : ""}</span>${IC.chev}</button>`;
  };
  const head = sw ? uiHd("팀 바꾸기", "#", { backAct: "teamsBack" }) : `<header class="hd" style="padding:0 12px 0 24px">${MBRAND(32).replace("font-size:18px", "font-size:18px")}<span style="flex:1"></span><button class="lnk" data-act="logout">로그아웃</button></header>`;
  return `${head}<div class="body" style="gap:16px;padding-top:${sw ? 4 : 14}px">
    ${sw ? `<span style="font-size:14px">들어갈 팀을 골라 주세요</span>` : `<div style="display:flex;flex-direction:column;gap:8px;padding-bottom:4px"><h1 class="bh" style="margin:0;font-weight:400;font-size:24px">어느 팀으로 들어갈까요?</h1><span style="font-size:14px;color:${C.sub}">${esc(myName ? myName + "님이" : "")} 속한 팀이에요. 들어갈 때마다 여기서 골라요.</span></div>`}
    ${S.teams.map(card).join("")}
    <button data-act="newTeam" style="height:56px;border:2px dashed ${C.ink};border-radius:12px;background:${C.white};font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center;gap:8px">${IC.plus}새 팀 만들기</button>
    <span class="note">다른 팀은 그 팀의 초대 링크로 들어오면 여기에 더해져요.</span></div>`;
}
async function showTeams(mode) {
  S.teamsMode = mode; S.teamsInfo = null; S.flow = "teams"; window.scrollTo(0, 0); render();
  try { await loadTeamsInfo(); } catch (e) { /* 이름과 권한만 보여 준다 */ }
  if (S.flow === "teams") render();
}
const DEV = { phone: "휴대폰", pc: "PC" };
const stamp = iso => { const d = new Date(new Date(iso).getTime() + 9 * 3600e3); return `${d.getUTCMonth() + 1}.${String(d.getUTCDate()).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`; };
// 초대 링크로 들어왔고 아직 팀원이 아니면: 가입 신청을 남긴다
function vJoinReq() {
  const f = S.form, t = S.joinTeam || {};
  return `<div style="flex:1;display:flex;flex-direction:column;padding:32px 24px 32px;gap:16px">
    ${MBRAND(36)}
    <h1 class="bh" style="margin:0;font-weight:400;font-size:24px">가입 신청</h1>
    ${INVCARD(t.name, "", "가입 신청을 남기면 운영진이 확인하고 받아 줘요. 받으면 바로 들어갈 수 있어요.")}
    <label class="fld"><span class="lb">팀에서 쓰는 이름</span><input class="inp" data-bind="name" value="${esc(f.name || "")}" maxlength="20" placeholder="예: 김민준" autocomplete="off"></label>
    <label class="fld"><span class="lb">운영진에게 한마디 <span style="font-weight:500;color:${C.sub}">안 써도 돼요</span></span><textarea class="inp" data-bind="msg" maxlength="100" style="min-height:80px" placeholder="예: 수요일 풋살 같이 하는 김민준입니다">${esc(f.msg || "")}</textarea></label>
    <span class="note">지금 로그인된 카카오 계정은 <b style="color:${C.ink}">${esc(suggestedName() || "이름 없음")}</b>이에요. 평소 쓰는 계정이 아니면 <button class="lnk" data-act="logout" style="min-height:0;padding:0;font-size:12px">로그아웃</button>하고 그 계정으로 다시 들어와 주세요.</span>
    <button class="btn o block" data-act="joinSend" style="margin-top:auto">가입 신청 보내기</button>
  </div>`;
}
function vJoinWait() {
  const rs = S.myReqs || [];
  const one = r => r.status === "rejected"
    ? `<div class="box clay" style="align-items:center;text-align:center;gap:8px;padding:24px 16px;border-radius:18px"><b class="bh" style="font-size:24px">가입이 거절됐어요</b><span style="font-size:14px">${esc(r.team_name || "팀")} 운영진이 신청을 거절했어요. 궁금하면 운영진에게 직접 물어봐 주세요.</span><button class="btn block" data-act="joinCancel" data-id="${esc(r.team_id)}">확인</button></div>`
    : `<div class="box" style="align-items:center;text-align:center;gap:8px;padding:24px 16px;border-radius:18px;box-shadow:4px 4px 0 ${C.ink}"><span style="width:56px;height:56px;border-radius:50%;border:2px solid ${C.ink};background:${C.green};display:inline-flex;align-items:center;justify-content:center">${IC.clock}</span><b class="bh" style="font-size:24px">가입 승인을 기다리고 있어요</b><b style="font-size:16px">${esc(r.team_name || "팀")}</b><span style="font-size:14px;line-height:1.6">운영진이 받으면 바로 들어갈 수 있어요. 이 화면은 저절로 새로 고쳐져요.</span><span class="note">신청 ${esc(stamp(r.created_at))}</span><button class="btn block" data-act="joinCancel" data-id="${esc(r.team_id)}">신청 취소</button></div>`;
  return `<div style="flex:1;display:flex;flex-direction:column;padding:32px 24px 32px;gap:16px">
    ${MBRAND(36)}
    ${rs.map(one).join("")}
    ${S.teams.length ? `<button class="btn block" data-act="joinLeave">내 팀으로 가기</button>` : `<button class="btn block" data-act="newTeam">새 팀 만들기</button>`}
    <button class="lnk" data-act="logout" style="align-self:center">로그아웃</button>
  </div>`;
}
const devNow = () => /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? "phone" : "pc";
let joinPoll = 0;
function startJoinWait() {
  S.flow = "joinWait"; render(); clearInterval(joinPoll);
  joinPoll = setInterval(checkJoin, 15000);
}
// 승인됐는지 확인: 팀 목록에 새 팀이 생겼으면 바로 들어간다
async function checkJoin() {
  if (S.flow !== "joinWait" || document.hidden) return;
  const before = new Set(S.teams.map(t => t.id)), wait = new Set((S.myReqs || []).map(r => r.team_id));
  try { await loadTeams(); await loadMyReqs(); } catch (e) { return; }
  const ok = S.teams.find(t => !before.has(t.id) && wait.has(t.id));
  if (ok) { clearInterval(joinPoll); toast("가입이 승인됐어요"); S.flow = ""; S.ready = false; render(); return enter(ok.id); }
  if (!(S.myReqs || []).length) { clearInterval(joinPoll); S.flow = ""; return S.teams.length ? enter((S.teams.find(x => x.id === ls.get("mb-team")) || S.teams[0]).id) : startCreate(); }
  render();
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && S.flow === "joinWait") checkJoin(); });
function vCreate() {
  const f = S.form;
  const chip = (k, v, l) => `<button type="button" class="chip${f[k] === v ? " on" : ""}" data-act="pick" data-k="${k}" data-v="${v}">${l}</button>`;
  return `${S.teams.length ? uiHd("팀 만들기", "#", { backAct: "createBack" }) : uiHd("팀 만들기", "")}<div class="body">
    <label class="fld"><span class="lb">팀 이름</span><input class="inp" data-bind="name" value="${esc(f.name || "")}" maxlength="40" placeholder="예: 번개 FC" autocomplete="off"></label>
    <div class="fld"><span class="lb">종목</span><div class="chips">${chip("sport", "futsal", "풋살팀")}${chip("sport", "soccer", "축구팀")}</div><span class="note">종목은 팀을 만든 뒤에는 바꿀 수 없어요.</span></div>
    <div class="fld"><span class="lb">회비</span><div class="chips">${chip("feeMode", "monthly", "월회비")}${chip("feeMode", "per_game", "경기마다")}${chip("feeMode", "none", "안 받음")}</div>
      ${f.feeMode !== "none" ? `<input class="inp" data-bind="fee" inputmode="numeric" value="${esc(f.fee || "")}" placeholder="금액, 예: 30000" aria-label="회비 금액">` : ""}
      ${f.feeMode === "monthly" ? `<div class="chips">${["1", "5", "10", "25", "말일"].map(d => chip("dueDay", d, d === "말일" ? "말일까지" : d + "일까지")).join("")}</div>` : ""}</div>
    <label class="fld"><span class="lb">팀 수칙</span><textarea class="inp" data-bind="rulesText" style="min-height:140px" placeholder="1. 경기 10분 전까지 와요&#10;2. 못 오면 투표 마감 전에 불참으로 바꿔요">${esc(f.rulesText || "")}</textarea><span class="note">"1. 2."처럼 번호를 직접 적어요.</span></label>
    <section style="display:flex;flex-direction:column;gap:8px"><b style="font-size:14px;border-bottom:2px solid ${C.ink};padding-bottom:8px">벌금 <span style="font-weight:500;color:${C.sub}">금액을 적은 것만 매겨져요</span></b>
      ${(f.rules || []).map((r, i) => `<div style="display:grid;grid-template-columns:1fr 104px 46px;gap:8px"><input class="inp" data-rule="${i}" data-f="label" value="${esc(r.label)}" placeholder="예: 지각" maxlength="40" aria-label="벌금 ${i + 1} 이름"><input class="inp" data-rule="${i}" data-f="amount" value="${esc(r.amount || "")}" inputmode="numeric" placeholder="금액" aria-label="벌금 ${i + 1} 금액" style="text-align:right;font-weight:700"><button type="button" class="btn c" data-act="ruleDel" data-i="${i}" aria-label="벌금 ${i + 1} 지우기" style="padding:0;height:52px">✕</button></div>`).join("")}
      <button type="button" data-act="ruleAdd" style="height:52px;border:2px dashed ${C.ink};border-radius:12px;background:transparent;font-weight:700;font-size:16px">벌금 항목 더하기</button></section>
    <span class="note">정원, 투표 마감, 출석 시간, 불참 벌금 기준 같은 기본 운영 규칙은 만든 뒤 운영 탭에서 Admin이 바꿔요.</span>
  </div><div class="cta"><button class="btn o block" data-act="createTeam">팀 만들기</button></div>`;
}

/* ---------- 선수 등록, 수칙 동의 ---------- */
function vProfile(editing) {
  const f = S.form; const pos = POS[sport()];
  const pchip = (k, v) => `<button type="button" class="chip${f[k] === v ? " on" : ""}" data-act="pick" data-k="${k}" data-v="${v}" style="height:44px;font-family:'Barlow Condensed','IBM Plex Sans KR',sans-serif;font-size:16px;padding:0 4px">${v}</button>`;
  const taken = new Set(people().filter(x => x.uid !== S.uid).map(x => String(x.p.num || ""))); const free = []; for (let i = 1; i <= 99 && free.length < 8; i++) if (!taken.has(String(i))) free.push(i);
  const g = sport() === "soccer" ? "grid5" : "grid4";
  return `${uiHd(editing ? "내 정보" : "선수 등록 1/2", editing ? "#/" : "", { sub: S.team ? S.team.name : "" })}<div class="body">
    <div class="box blue" style="flex-direction:row;align-items:center;gap:16px;border-radius:20px;padding:16px 16px"><span class="bc" data-live="num" style="flex:none;width:72px;height:72px;border-radius:16px;background:${C.ink};color:${C.bg};display:flex;align-items:center;justify-content:center;font-size:40px">${esc(f.num || "")}</span><span style="display:flex;flex-direction:column;gap:8px;min-width:0"><b class="bh" data-live="name" style="font-size:24px;line-height:1.1">${esc(f.name || "이름")}</b><span class="bc" style="font-size:16px">1선호 ${esc(f.pos1 || "-")}  2선호 ${esc(f.pos2 || "-")}</span></span></div>
    <label class="fld"><span class="lb">팀에서 부를 이름</span><input class="inp" data-bind="name" data-live-src="name" value="${esc(f.name || "")}" maxlength="20" placeholder="예: 이서준"></label>
    <label class="fld"><span class="lb">등번호</span><input class="inp" data-bind="num" data-live-src="num" value="${esc(f.num || "")}" inputmode="numeric" maxlength="3" placeholder="예: 7">${taken.has(String(f.num || "-")) ? `<span class="err">다른 팀원이 쓰는 번호예요</span>` : `<span class="note">비어 있는 번호 ${free.join(", ")}</span>`}</label>
    <div class="fld"><span class="lb">1선호 포지션</span><div class="${g}">${pos.map(p => pchip("pos1", p)).join("")}</div></div>
    <div class="fld"><span class="lb">2선호 포지션</span><div class="${g}">${pos.filter(p => p !== f.pos1).map(p => pchip("pos2", p)).join("")}<button type="button" class="chip${!f.pos2 ? " on" : ""}" data-act="pick" data-k="pos2" data-v="" style="height:44px;padding:0 4px">없음</button></div></div>
  </div><div class="cta"><button class="btn o block" data-act="saveProfile">${editing ? "저장하기" : "다음"}</button></div>`;
}
// 팀 기본 운영 규칙 (팀 만들 때 정하고, 팀 설정에서 Admin만 바꿈): 일정 만들 때 기본값, 지각 기준, 내전 기준
export const POLICY_DEF = { voteClose: "eve", voteTime: "21:00", waitCap: 0, checkBefore: 10, scrimMin: 20, scrimDays: 3 };
export const pol = k => { const v = (S.settings || {})[k]; if (k === "cap") return Number(v) || (sport() === "soccer" ? 22 : 12); if (v === undefined || v === null || v === "") return POLICY_DEF[k]; return typeof POLICY_DEF[k] === "number" ? (Number.isFinite(Number(v)) ? Number(v) : POLICY_DEF[k]) : v; };
const PBOUND = { pCap: [2, 40], pWait: [0, 30], pScrimMin: [4, 40], pScrimDays: [1, 7] };
const capDef = f => f.sport === "soccer" ? 22 : 12;
export const policyFormInit = st => ({ pVoteClose: st.voteClose === "start" ? "start" : "eve", pVoteTime: st.voteTime || POLICY_DEF.voteTime, pCap: Number(st.cap) ? String(st.cap) : "", pWait: String(Number(st.waitCap) || 0), pCheck: String(st.checkBefore === undefined || st.checkBefore === "" ? POLICY_DEF.checkBefore : Number(st.checkBefore) || 0), pScrimMin: String(Number(st.scrimMin) || POLICY_DEF.scrimMin), pScrimDays: String(Number(st.scrimDays) || POLICY_DEF.scrimDays) });
export function policyFromForm(f) {
  const cl = (v, [a, b], d) => { const n = Number(v); return Number.isFinite(n) && String(v) !== "" ? Math.max(a, Math.min(b, Math.round(n))) : d; };
  return { voteClose: f.pVoteClose === "start" ? "start" : "eve", voteTime: /^\d\d:\d\d$/.test(f.pVoteTime || "") ? f.pVoteTime : POLICY_DEF.voteTime, cap: cl(f.pCap, PBOUND.pCap, capDef(f)), waitCap: cl(f.pWait, PBOUND.pWait, 0), checkBefore: cl(f.pCheck, [0, 60], POLICY_DEF.checkBefore), scrimMin: cl(f.pScrimMin, PBOUND.pScrimMin, POLICY_DEF.scrimMin), scrimDays: cl(f.pScrimDays, PBOUND.pScrimDays, POLICY_DEF.scrimDays) };
}
const hm12 = t => { const [h, m] = String(t).split(":").map(Number); return (h < 12 ? "오전 " : "오후 ") + (h % 12 || 12) + (m ? ":" + String(m).padStart(2, "0") : "시"); };
export function policyLines(p) {
  return [["투표 마감", p.voteClose === "start" ? "경기 시작 전까지" : "경기 전날 " + hm12(p.voteTime), "마감 뒤에 불참으로 바꾸면 수칙의 불참 벌금이 붙어요"],
    ["정원과 대기", `${p.cap}명, 대기 ${p.waitCap ? p.waitCap + "명까지" : "제한 없음"}`, "일정 만들 때 기본으로 들어가요"],
    ["지각 기준", p.checkBefore ? `킥오프 ${p.checkBefore}분 전` : "킥오프 시간", "현장 출석에서 이 시간 뒤에 오면 지각이에요"],
    ["내전 기준", `${p.scrimDays}일 전까지 ${p.scrimMin}명 이상`, "상대팀이 미정일 때 참석과 대기를 합친 인원이에요"]];
}
export function policyForm(f, canEdit) {
  const p = policyFromForm(f);
  if (!canEdit) return `<div class="card"><div class="spread"><span class="lab">기본 운영 규칙</span><span class="hint">Admin만 바꿀 수 있어요</span></div><div class="list">${policyLines(p).map(([a, b, c]) => `<div class="li"><span style="flex:1">${a}<br><span class="hint">${c}</span></span><b>${esc(b)}</b></div>`).join("")}</div></div>`;
  const ch = (k, v, l) => `<button class="chip sm ${String(f[k] || "") === String(v) ? "on" : ""}" data-act="pick" data-k="${k}" data-v="${v}">${l}</button>`;
  const step = (k, val, unit, zero) => `<div class="row" style="gap:8px"><button class="btn sm" data-act="pStep" data-k="${k}" data-d="-1" aria-label="줄이기">−</button><b style="min-width:76px;text-align:center">${zero && !Number(val) ? zero : val + unit}</b><button class="btn sm" data-act="pStep" data-k="${k}" data-d="1" aria-label="늘리기">+</button></div>`;
  return `<div class="card"><div class="spread"><span class="lab">기본 운영 규칙</span><span class="hint">일정마다 바꿀 수도 있어요</span></div>
    <div class="field"><span class="lab">투표 마감</span><div class="chips">${ch("pVoteClose", "eve", "경기 전날")}${ch("pVoteClose", "start", "경기 시작 전까지")}</div>
      ${p.voteClose === "eve" ? `<div class="row" style="gap:8px"><span>경기 전날</span><input class="inp" type="time" data-bind="pVoteTime" value="${esc(p.voteTime)}" aria-label="투표 마감 시간" style="width:140px;flex:none"><span>까지</span></div>` : ""}
      <span class="hint">마감 뒤에는 투표를 못 바꾸고, 불참으로 바꾸면 수칙의 불참 벌금이 붙어요</span></div>
    <div class="spread"><span class="lab">정원</span>${step("pCap", p.cap, "명")}</div>
    <div class="spread"><span class="lab">대기</span>${step("pWait", p.waitCap, "명", "제한 없음")}</div>
    <div class="field"><span class="lab">지각 기준</span><div class="row" style="gap:8px"><span>킥오프</span><input class="inp" type="number" inputmode="numeric" min="0" max="60" data-bind="pCheck" value="${esc(String(p.checkBefore))}" aria-label="지각 기준 몇 분 전" style="width:84px;flex:none;text-align:right"><span>분 전</span></div><span class="hint">0으로 두면 킥오프 시간부터 지각이에요</span></div>
    <div class="field"><span class="lab">내전 기준</span><span class="hint">상대팀이 미정일 때, 경기 며칠 전까지 참석과 대기를 합쳐 몇 명이 넘으면 내전을 검토할지 정해요</span>
      <div class="spread"><span>경기</span>${step("pScrimDays", p.scrimDays, "일 전까지")}</div><div class="spread"><span>총인원 [대기포함]</span>${step("pScrimMin", p.scrimMin, "명 이상")}</div></div>
  </div>`;
}
// 팀 수칙: 수칙은 글로 (1. 2. 직접 번호), 벌금은 금액이 있는 항목만. 예전 "글 수칙"(벌금 0원)은 번호 붙인 글로 바꿔 보여 준다
export const rulesTextOf = st => typeof (st || {}).rulesText === "string" ? st.rulesText : ((st || {}).rules || []).filter(r => !Number(r.amount)).map((r, i) => `${i + 1}. ${r.label}`).join("\n");
export const fineRulesOf = st => ((st || {}).rules || []).filter(r => Number(r.amount) > 0);
export function rulesView(st, empty = "아직 정한 수칙이 없어요.") {
  const txt = rulesTextOf(st).trim(); const fines = fineRulesOf(st);
  if (!txt && !fines.length) return `<span class="hint">${empty}</span>`;
  return `${txt ? `<div style="white-space:pre-wrap;line-height:1.7;font-size:16px;color:#111827">${esc(txt)}</div>` : ""}${fines.length ? `<span class="lab" style="margin-top:4px">벌금</span><div class="list">${fines.map(r => `<div class="li"><span style="flex:1">${esc(r.label)}</span><b>${won(r.amount)}</b></div>`).join("")}</div>` : ""}`;
}
export function rulesForm(f) {
  return `<div class="card"><span class="lab">팀 수칙</span><textarea class="inp" data-bind="rulesText" style="min-height:160px;line-height:1.7" placeholder="1. 경기 10분 전까지 와요&#10;2. 못 오면 투표 마감 전에 불참으로 바꿔요&#10;3. 회비는 매달 5일까지 내요">${esc(f.rulesText || "")}</textarea><span class="hint">번호를 직접 붙여 적어요. 줄을 바꾸면 그대로 보여요.</span></div>
    <div class="card"><div class="spread"><span class="lab">벌금</span><span class="hint">금액을 적은 것만 벌금으로 매겨져요</span></div>
      ${(f.rules || []).map((r, i) => `<div class="row" style="gap:8px"><input class="inp" data-rule="${i}" data-f="label" value="${esc(r.label)}" placeholder="예: 지각 (킥오프 10분 전 기준)" aria-label="벌금 ${i + 1} 이름" style="flex:1"><input class="inp" data-rule="${i}" data-f="amount" value="${esc(r.amount || "")}" inputmode="numeric" placeholder="금액" aria-label="벌금 ${i + 1} 금액" style="width:96px;flex:none"><button class="iconbtn" data-act="ruleDel" data-i="${i}" aria-label="벌금 ${i + 1} 지우기">✕</button></div>`).join("")}
      <button class="btn sm" data-act="ruleAdd" style="align-self:flex-start">+ 벌금 추가</button>
      <span class="hint">지각, 결석은 현장 출석에서, 불참(직전 취소)은 마감 후 불참 변경에서 이 금액으로 자동으로 매겨져요.</span></div>`;
}
// 편집 칸 값으로 저장할 수칙 글과 벌금 목록
export function rulesFromForm(f) {
  const rulesText = String(f.rulesText || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 2000);
  const rules = (f.rules || []).map(r => { const label = String(r.label || "").trim().slice(0, 40); const kind = r.kind && r.klabel === label ? r.kind : ruleKind({ label }); return { label, amount: Number(String(r.amount || "").replace(/\D/g, "")) || 0, ...(kind ? { kind } : {}) }; }).filter(r => r.label && r.amount > 0);
  return { rulesText, rules };
}
export const rulesFormInit = st => ({ rulesText: rulesTextOf(st), rules: fineRulesOf(st).map(r => ({ label: r.label, amount: String(r.amount), kind: r.kind || "", klabel: r.label })) });
function vRules() {
  const st = S.settings; const bk = st.bank || {}; const txt = rulesTextOf(st).trim(); const fines = fineRulesOf(st);
  return `${uiHd("팀 수칙 2/2", "", { sub: S.team ? S.team.name : "" })}<div class="body">
    <span style="font-size:16px;line-height:1.6">읽고 동의하면 바로 시작해요.</span>
    <section class="box gray" style="border-radius:18px;padding:16px 16px"><b class="bh" style="font-size:20px">팀 수칙</b><p style="margin:0;font-size:16px;line-height:1.8;white-space:pre-line">${txt ? esc(txt) : "아직 정한 수칙이 없어요."}</p></section>
    ${fines.length ? `<section style="display:flex;flex-direction:column"><b style="font-size:16px;border-bottom:2px solid ${C.ink};padding-bottom:8px">벌금</b>${fines.map(r => `<div class="spread" style="min-height:52px;border-bottom:2px solid ${C.line}"><span>${esc(r.label)}</span><b class="bc" style="font-size:24px">${won(r.amount)}</b></div>`).join("")}</section>` : ""}
    ${st.feeMode && st.feeMode !== "none" ? `<div class="box clay" style="border-radius:14px;gap:4px"><span style="font-size:12px;font-weight:700">회비</span><b class="bc" style="font-size:24px">${won(st.fee)}${st.feeMode === "per_game" ? " / 경기" : " / 월"}</b><span style="font-size:12px">${st.feeMode === "monthly" ? "매달 " + (st.dueDay === "말일" ? "말일" : (st.dueDay || "5") + "일") + "까지" : "경기에 온 날마다"}${bk.account ? `, ${esc(bk.bank || "")} ${esc(bk.account)}` : ""}</span></div>` : ""}
    <label class="row" style="gap:12px;min-height:48px;cursor:pointer;border-top:2px solid ${C.ink};padding-top:12px"><input type="checkbox" data-bind="agreeChk" ${S.form.agreeChk ? "checked" : ""} style="width:24px;height:24px;accent-color:${C.ink}"><b style="font-size:16px">수칙을 읽었고 지킬게요</b></label>
  </div><div class="cta"><button class="btn o block" data-act="agree">${esc(S.team ? S.team.name : "")} 시작하기</button></div>`;
}

/* ---------- 초대 ---------- */
const inviteUrl = () => S.invite ? APP + "?join=" + S.invite : "";
function vInviteMsg() {
  return `${uiHd("팀원 초대하기", "#/")}<div class="body">
    <span style="font-size:16px;line-height:1.6">팀을 만들었어요. 이 링크를 팀 단톡방에 올려 주세요.</span>
    <div class="box" style="flex-direction:row;align-items:center;gap:8px;padding:8px 8px 8px 16px;border-radius:12px"><span class="bc" style="flex:1;min-width:0;font-size:16px;word-break:break-all">${esc((inviteUrl() || "링크를 만드는 중이에요").replace(/^https?:\/\//, ""))}</span><button class="btn sm" data-act="copyLink">복사</button></div>
    <span class="note">이 링크로 들어온 사람은 가입 신청을 남기고, 운영진이 받으면 팀원이 돼요. 가입 승인제는 운영 탭의 팀 설정에서 바꿔요.</span>
  </div><div class="cta"><a class="btn o block" href="#/">완료</a></div>`;
}

// 팀 지우기 팝업: 운영진 중에서 다음 Admin을 고르고 나가기, 또는 매니볼에 평가를 남기고 팀 지우기
function delSheet() {
  const ads = S.members.filter(m => m.role === "admin"); const pick = S.delNext && ads.some(m => m.user_id === S.delNext) ? S.delNext : "";
  const radio = on => `<span style="width:22px;height:22px;border-radius:50%;box-sizing:border-box;flex:none;border:${on ? "7px solid #15803D" : "2px solid #D1D5DB"}"></span>`;
  sheet(`<h3>팀 지우기</h3><span class="hint">Admin은 다음 Admin을 지정한 뒤에 팀에서 나갈 수 있어요.</span>
    <div class="card" style="background:#F9FAFB"><b>다음 Admin 지정</b><span class="hint">운영진 중에서만 고를 수 있어요</span>${ads.length ? `<div class="list">${ads.map(m => `<button class="li" style="border:0;background:none;text-align:left;width:100%" data-act="delPick" data-u="${esc(m.user_id)}"><span class="av">${esc(ini(nameOf(m.user_id)))}</span><span style="flex:1"><b>${esc(nameOf(m.user_id))}</b> <span class="tag gray">운영진</span></span>${radio(pick === m.user_id)}</button>`).join("")}</div>` : `<span class="hint" style="color:#B45309">운영진이 없어요. 먼저 선수 탭에서 운영진을 지정해 주세요.</span>`}
    <button class="btn block" data-act="delLeave" style="background:${pick ? "#DC2626" : "#E5E7EB"};color:${pick ? "#FFFFFF" : "#9CA3AF"}" ${pick ? "" : "disabled"}>${pick ? esc(nameOf(pick)) + " 님을 Admin으로 지정하고 나가기" : "다음 Admin을 골라 주세요"}</button></div>
    <div class="card" style="background:#F9FAFB"><b>팀을 아예 없애려면</b><span class="hint">매니볼에 평가를 남기면 팀을 지울 수 있어요. 일정, 참석, 회비, 기록이 모두 지워지고 되돌릴 수 없어요.</span><button class="btn" data-act="inqOpen">매니볼에 평가 후 지우기</button></div>
    <button class="btn" data-act="closeSheet">닫기</button>`);
}

/* ---------- 홈 ---------- */
function seasonStats(u) {
  const year = todayStr().slice(0, 4);
  const evs = past().filter(e => e.date.startsWith(year));
  const aevs = evs.filter(held); const mine = aevs.filter(e => attended(e, u)).length;
  const mom = evs.filter(momClosed).filter(e => momWinners(e).includes(u)).length;
  return { n: aevs.length, mine, mom, rate: aevs.length ? Math.round(mine * 100 / aevs.length) : 0 };
}




/* ---------- 일정 ---------- */

/* ---------- 운영진 일정: 참석 현황과 운영 버튼 (팀원처럼 투표 버튼을 두지 않는다) ---------- */
 // 미응답 알림: 운영진 모두 합쳐 1시간에 한 번 (바꿀 수 없음)
const remindInfo = () => D("team").remind || null;







/* ---------- 선수, 준비 중 탭 ---------- */


/* ========== 2단계: 회비, 현장 출석과 벌금, 기록과 MOM, 공지, 용병, 선수 관리, 라인업, 내전 ========== */
const UI = { month: "", side: "A", q: 1 };
const ym = () => todayStr().slice(0, 7);
function monthsList() {
  const st = S.settings.since || ym(); const out = []; let [y, m] = st.split("-").map(Number); const [cy, cm] = ym().split("-").map(Number);
  while (y < cy || (y === cy && m <= cm)) { out.push(`${y}-${String(m).padStart(2, "0")}`); m++; if (m > 12) { m = 1; y++; } if (out.length > 36) break; }
  return out.reverse();
}
const mLabel = m => Number(m.slice(5)) + "월";
const ruleKind = r => r.kind || (/지각/.test(r.label) ? "late" : /결석|말없이|무단/.test(r.label) ? "absent" : /취소|불참/.test(r.label) ? "cancel" : "");
const ruleAmt = k => { const r = (S.settings.rules || []).find(x => ruleKind(x) === k); return r ? Number(r.amount) || 0 : 0; };
const feeMode = () => S.settings.feeMode || "none";
const isPlay = e => e.type === "match" || e.type === "scrim";
const evName = e => e.type === "scrim" ? "내전" : e.type === "match" ? (e.opponent ? "vs " + e.opponent : "경기") : "훈련";
const duesKey = ref => (feeMode() === "per_game" ? "e-" : "m-") + ref;
const paidOf = (key, u) => (D("dues")[key] || {})[u] === "paid";
const finesOf = u => Object.entries(D("fines")).map(([id, f]) => ({ id, ...f })).filter(f => f.uid === u).sort((a, b) => String(b.date).localeCompare(String(a.date)));
const momDeadline = e => new Date(new Date(e.date + "T12:00:00+09:00").getTime() + 864e5);
const momOpen = e => isPlay(e) && started(e) && !!e.score && Date.now() < momDeadline(e).getTime();
const momClosed = e => isPlay(e) && Date.now() >= momDeadline(e).getTime();
// 출석률: 실제로 열린 경기(시작, 취소 아님)에 현장 출석을 받았고, 그 자리에서 왔음 또는 지각으로 체크된 경우만 센다. 투표만으로는 세지 않는다.
const checkTaken = e => !!e.checkDone || Object.entries(e.check || {}).some(([k, v]) => !k.startsWith("g:") && (v === "in" || v === "late" || v === "absent"));
const held = e => started(e) && !isCanceled(e) && checkTaken(e);
const attended = (e, u) => held(e) && ["in", "late"].includes((e.check || {})[u]);
function cameTo(e, u) { const c = (e.check || {})[u]; if (c) return c === "in" || c === "late"; const r = (((S.rsvp[u] || {}).ev || {})[e.id]) || {}; return r.s === "yes" || r.s === "late"; }
function momWinners(e) { const t = D("tally")["mom-" + e.id]; if (!t || !t.c) return []; const max = Math.max(0, ...Object.values(t.c)); return max ? Object.keys(t.c).filter(k => t.c[k] === max) : []; }
const myUv = () => D("uvote")[S.uid] || {};
const guestsOf = e => Object.entries(e.guests || {}).map(([id, g]) => ({ id, ...g }));

// 운영진: 팀원마다 본인만 보는 회비와 벌금 요약(mydues)을 맞춰 둔다
async function syncMyDues(only) {
  if (!isAdmin()) return;
  const keys = feeMode() === "per_game" ? past().filter(e => isPlay(e)).map(e => "e-" + e.id) : feeMode() === "monthly" ? monthsList().map(m => "m-" + m) : [];
  for (const m of S.members) {
    const u = m.user_id; if (only && !only.includes(u)) continue;
    const dues = {}; keys.forEach(k => { if (feeMode() === "per_game") { const e = S.events[k.slice(2)]; if (!e || !cameTo(e, u)) return; } dues[k] = paidOf(k, u) ? "paid" : ""; });
    const paidAt = {}; Object.keys(dues).forEach(k => { const at = ((D("dues")[k] || {})._at || {})[u]; if (at && dues[k] === "paid") paidAt[k] = at; });
    const data = { dues, paidAt, fines: finesOf(u).map(f => ({ id: f.id, date: f.date, eventId: f.eventId || "", reason: f.reason, amount: f.amount, paid: !!f.paid, paidAt: f.paidAt || "", at: f.at || "" })), fee: Number(S.settings.fee) || 0, mode: feeMode() };
    if (JSON.stringify(D("mydues")[u] || null) !== JSON.stringify(data)) { try { await setDoc("mydues", u, data); } catch (e) { console.error(e); } }
  }
}

/* ---------- 회비 ---------- */





/* ---------- 현장 출석과 벌금 ---------- */


/* ---------- 기록과 MOM ---------- */




/* ---------- 공지와 설문 ---------- */
const noticesList = () => Object.entries(D("notices")).map(([id, n]) => ({ id, ...n })).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(b.at).localeCompare(String(a.at)));
function noticeCard(n, full) {
  const t = D("tally")["poll-" + n.id] || { n: 0, c: {} }; const my = (myUv().poll || {})[n.id] || ""; const open = n.poll && (!n.poll.until || Date.now() < Date.parse(n.poll.until));
  const seen = (D("tally")["seen-" + n.id] || {}).n || 0;
  return `<div class="card">${n.pinned ? `<span class="tag" style="align-self:flex-start">고정</span>` : ""}<b style="font-size:16px">${esc(n.title)}</b>${n.body ? `<div style="white-space:pre-wrap;font-size:14px;color:#374151;line-height:1.6">${esc(full ? n.body : String(n.body).slice(0, 120))}</div>` : ""}
    ${n.poll && n.poll.opts ? `<div class="list">${n.poll.opts.map(o => `<button class="li" style="border:0;border-bottom:1px solid #F3F4F6;background:none;text-align:left;width:100%" data-act="pollVote" data-nid="${esc(n.id)}" data-opt="${esc(o.id)}" ${open ? "" : "disabled"}><span style="flex:1">${my === o.id ? "● " : "○ "}${esc(o.label)}</span><span class="hint">${(t.c || {})[o.id] || 0}명</span></button>`).join("")}</div><span class="hint">${open ? "누르면 투표돼요. 다시 누르면 취소돼요" : "마감된 설문이에요"}, ${t.n || 0}명 참여</span>` : ""}
    <div class="spread hint"><span>${esc(String(n.at || "").slice(5, 10).replace("-", "."))}</span><span>${seen}명 읽음</span></div>
    ${isAdmin() && full ? `<div class="row"><button class="btn sm" data-act="noticePin" data-id="${esc(n.id)}">${n.pinned ? "고정 풀기" : "맨 위에 고정"}</button><button class="btn sm danger" data-act="noticeDel" data-id="${esc(n.id)}">지우기</button></div>` : ""}</div>`;
}
function vNotices() {
  const ns = noticesList();
  return `${top("공지", "#/", isAdmin() && viewMode() === "admin" ? `<a class="btn sm pri" href="#/notice-new">+ 공지 쓰기</a>` : "")}<div class="body">${ns.length ? ns.map(n => noticeCard(n, true)).join("") : `<div class="card empty"><b>아직 공지가 없어요</b></div>`}</div>`;
}


/* ---------- 용병 ---------- */
function guestReqs(e) {
  const out = [];
  Object.entries(D("guestreq")).forEach(([u, d]) => Object.entries((d && d.items) || {}).forEach(([k, g]) => { if (g && g.eid === e.id) out.push({ u, k, ...g }); }));
  return out;
}
function guestSheet(eid) {
  sheet(`<h3>용병 신청</h3><span class="hint">같이 뛸 지인을 적어 주세요. 운영진이 수락하면 명단에 들어가요.</span>
    <input class="inp" id="gName" placeholder="이름" maxlength="20" aria-label="용병 이름"><div class="chips">${POS[sport()].map(p => `<button class="chip sm" data-gpos="${p}">${p}</button>`).join("")}</div>
    <input class="inp" id="gRel" placeholder="나와의 관계 (예: 회사 동료)" maxlength="30" aria-label="관계"><div class="row"><button class="btn block" data-act="closeSheet">취소</button><button class="btn pri block" id="gSend">신청하기</button></div>`);
  let pos = ""; document.querySelectorAll("[data-gpos]").forEach(b => b.onclick = () => { pos = b.dataset.gpos; document.querySelectorAll("[data-gpos]").forEach(x => x.classList.toggle("on", x === b)); });
  $("#gSend").onclick = async () => {
    const name = $("#gName").value.trim(); if (!name) { toast("이름을 적어 주세요"); return; }
    try { await patchDoc("guestreq", S.uid, { items: { [uid36("g")]: { eid, name: name.slice(0, 20), pos, rel: $("#gRel").value.trim().slice(0, 30), at: new Date().toISOString(), status: "req" } } }); closeSheet(); render(); toast("용병을 신청했어요. 운영진이 수락하면 알려 드려요"); } catch (e) { fail(e); }
  };
}

/* ---------- 라인업 ---------- */
// 자리와 비슷한 포지션 (정확히 맞는 사람이 없을 때 다음으로 고른다)
function lineupPlayers(e, side) {
  if (e.type === "scrim" && e.teams && Object.keys(e.teams).length) {
    return Object.entries(e.teams).filter(([, sd]) => sd === side).map(([u]) => {
      if (u.startsWith("g:")) { const g = (e.guests || {})[u.slice(2)] || {}; return { uid: u, name: (g.name || "용병") + " (용병)", from: 1, pos: [posFix(g.pos)] }; }
      const p = profileOf(u) || {}; const v = (((S.rsvp[u] || {}).ev || {})[e.id]) || {};
      return { uid: u, name: nameOf(u), from: v.s === "late" ? (v.q || 1) : 1, pos: [p.pos1, p.pos2] };
    });
  }
  const a = att(e);
  return [...a.yes, ...a.late].map(x => ({ uid: x.uid, name: x.guest ? x.name + " (용병)" : x.name, from: x.s === "late" ? (x.q || 1) : 1, pos: [x.p.pos1, x.p.pos2] }));
}
// 라인업 짜는 중인 값: 운영진이 고른 포메이션과 지정. 저장하면 라인업에 같이 들어간다
function draftOf(e, side) {
  const key = e.id + side; const d = S.form.ldraft;
  if (d && d.for === key) return d;
  const L = curLineup(e, side); const forms = FORMS[sport()];
  return (S.form.ldraft = { for: key, fkey: (L && L.fkey) || (sport() === "futsal" ? "" : Object.keys(forms)[0]), pins: JSON.parse(JSON.stringify((L && L.pins) || [])) });
}
// 풋살 "6대6"이면 GK 1명과 필드 5명
const futsalN = fkey => { const n = parseInt(fkey, 10); return FUTSAL_N.includes(n) && String(fkey) === n + "대" + n ? n : 0; };
const formOf = (fkey, L) => sport() === "futsal" ? (futsalN(fkey) ? ["골레이로", ...Array(futsalN(fkey) - 1).fill(FIELD)] : (L && L.formation) || null) : FORMS.soccer[fkey] || (L && L.formation) || Object.values(FORMS.soccer)[0];
// 자동 배치: 지정한 선수를 먼저 넣고, 나머지는 자기 1선호, 2선호 포지션에만 들어간다 (lineup-core.js). 포메이션은 운영진이 고른 것을 쓴다
function autoLineup(e, side) {
  const d = draftOf(e, side); const formation = formOf(d.fkey, curLineup(e, side)); const qn = QN[sport()];
  const r = planLineup(lineupPlayers(e, side), formation, qn, Math.random, d.pins);
  return { fkey: d.fkey, formation, q: r.q, pins: JSON.parse(JSON.stringify(d.pins)), auto: true };
}
const qText = (qs, qn) => qs.length === qn ? "전 쿼터" : qs.slice().sort((a, b) => a - b).join(", ") + "쿼터";
// 경기장 위 자리 좌표: 줄(rowsOf)마다 위에서 아래로, 줄 안에서는 왼쪽에서 오른쪽으로
function spotXY(formation, fkey) {
  const rows = rowsOf(formation, fkey); const out = {}; const R = rows.length;
  rows.forEach((r, ri) => {
    const y = R === 1 ? 50 : 11 + ri * (80 / (R - 1)); const n = r.length;
    const xs = n === 1 ? [50] : n === 2 ? [33, 67] : n === 3 ? [16, 50, 84] : Array.from({ length: n }, (_, j) => 12 + j * 76 / (n - 1));
    r.forEach((x, j) => { out[x.i] = { x: xs[j], y, tight: n >= 5 }; });
  });
  return out;
}
// 고정: 이 선수를 이 자리에 고른 쿼터 동안 둔다. 자동 배치를 다시 해도 그대로 있다
function fixSheet(eid) {
  const e = S.events[eid]; if (!e) return; const side = e.type === "scrim" ? UI.side : "main"; const st = UI.fix; const d = draftOf(e, side);
  const L = curLineup(e, side); const formation = L ? L.formation : formOf(d.fkey); const qn = QN[sport()]; const pos = formation[st.i];
  const p = lineupPlayers(e, side).find(x => x.uid === st.u); if (!p) return;
  const why = k => p.from > k ? `${p.from}쿼터부터 와요` : d.pins.some(x => x.u === p.uid && x.pos !== pos && x.qs.includes(k)) ? "다른 자리에 고정돼 있어요" : d.pins.filter(x => x.u !== p.uid && x.pos === pos && x.qs.includes(k)).length >= formation.filter(s => s === pos).length ? `${pos} 자리가 다 고정돼 있어요` : "";
  const ks = Array.from({ length: qn }, (_, i) => i + 1); const okQs = ks.filter(k => !why(k));
  sheet(`<h3>${esc(p.name)}, ${esc(pos)} 자리 고정</h3><span class="hint">고정할 쿼터를 골라요. 자동 배치를 다시 눌러도 고정한 자리는 그대로예요.${canPlay(p, pos) ? "" : ` ${esc(p.name)}의 1선호, 2선호는 ${esc([p.pos[0], p.pos[1]].filter(Boolean).join(", ") || "없음")}예요.`}</span>
    <div class="chips"><button class="chip sm ${okQs.length && okQs.every(k => st.qs.includes(k)) ? "on" : ""}" data-act="fixQ" data-v="all">전체</button>${ks.map(k => why(k) ? `<button class="chip sm" disabled style="opacity:.35">${k}Q</button>` : `<button class="chip sm ${st.qs.includes(k) ? "on" : ""}" data-act="fixQ" data-v="${k}">${k}Q</button>`).join("")}</div>
    ${ks.filter(why).length ? `<span class="hint">${ks.filter(why).map(k => k + "Q " + why(k)).join(", ")}</span>` : ""}
    <button class="btn pri" data-act="fixSave" data-eid="${esc(eid)}" ${st.qs.length ? "" : "disabled"}>${st.qs.length ? qText(st.qs, qn) + " 고정하기" : "고정하기"}</button><button class="btn" data-act="closeSheet">닫기</button>`);
}
function applyFix(e, side, u, i, qs) {
  const d = draftOf(e, side); const cur = curLineup(e, side); const formation = cur ? cur.formation : formOf(d.fkey); const pos = formation[i];
  const L = JSON.parse(JSON.stringify(cur || { fkey: d.fkey, formation, q: {} }));
  d.pins = d.pins.map(x => x.u === u ? { ...x, qs: x.qs.filter(k => !qs.includes(k)) } : x).filter(x => x.qs.length);
  const same = d.pins.find(x => x.u === u && x.pos === pos);
  if (same) same.qs = [...new Set([...same.qs, ...qs])].sort((a, b) => a - b); else d.pins.push({ u, pos, qs: qs.slice() });
  qs.forEach(k => {
    const row = L.q[k] = L.q[k] || {};
    const held = j => d.pins.some(x => x.u !== u && x.pos === formation[j] && x.qs.includes(k) && row[j] === x.u);
    const idx = !held(i) ? i : formation.findIndex((s, j) => s === pos && !held(j));
    Object.keys(row).forEach(j => { if (row[j] === u) delete row[j]; });
    if (idx >= 0) row[idx] = u;
  });
  L.pins = JSON.parse(JSON.stringify(d.pins)); S.form.lineup = L; S.form.lineupFor = e.id + side;
}
function vLineup(id) {
  const e = S.events[id]; if (!e) return `${top("라인업", "#/schedule")}<div class="body"><div class="card empty"><b>지워진 일정이에요</b></div></div>`;
  const side = e.type === "scrim" ? UI.side : "main"; const L = curLineup(e, side); const edit = isAdmin() && viewMode() === "admin";
  if (!edit && !e.lineupAt && !e.lineupOld) return `${top("라인업", "#/schedule")}<div class="body"><div class="card empty"><b>라인업 준비 중이에요</b><span class="hint">운영진이 라인업을 알리면 여기서 내 출전과 휴식 쿼터를 볼 수 있어요</span></div></div>`; // 운영진이 알리기 전에는 팀원에게 안 보여 준다
  const ps = lineupPlayers(e, side); const qn = QN[sport()]; const k = Math.min(UI.q, qn); const fs = sport() === "futsal"; const a = att(e);
  const nm = u => !u ? "" : u.startsWith("g:") ? (((e.guests || {})[u.slice(2)] || {}).name || "용병") : nameOf(u);
  const dr = draftOf(e, side); const fkey = (L && L.fkey) || dr.fkey; const fl = L ? L.formation : (edit ? formOf(fkey) || [] : []);
  const q = (L && L.q && L.q[k]) || {}; const bench = ps.filter(p => !Object.values(q).includes(p.uid)); const pOf = u => ps.find(p => p.uid === u);
  const pinned = (u, pos) => !!u && dr.pins.some(x => x.u === u && x.pos === pos && x.qs.includes(k));
  const cnt = {}; if (L) Object.values(L.q || {}).forEach(r => Object.values(r).forEach(u => { cnt[u] = (cnt[u] || 0) + 1; }));
  const played = u => Array.from({ length: qn }, (_, i) => Object.values((L && L.q && L.q[i + 1]) || {}).includes(u));
  const xy = spotXY(fl, fkey); const sel = edit && UI.sel != null && fl[UI.sel] ? UI.sel : null;
  const mineAt = n => { const r = (L && L.q && L.q[n]) || {}; const j = Object.keys(r).find(x => r[x] === S.uid); return j != null ? Number(j) : null; };
  const myI = mineAt(k); const inLine = !!pOf(S.uid);
  const mtag = i => { const p = xy[i]; const me = myI === i;
    return `<span aria-label="${esc(fl[i])}${me ? ", 내 자리" : ""}" style="position:absolute;left:${p.x}%;top:${p.y}%;transform:translate(-50%,-50%);border-radius:10px;padding:4px ${p.tight ? 6 : 8}px;min-width:44px;box-sizing:border-box;font-size:${p.tight ? 11 : 12}px;font-weight:700;text-align:center;line-height:1.35;white-space:nowrap;${me ? "background:#DCFCE7;color:#111827;box-shadow:0 0 0 3px #15803D,0 2px 6px rgba(0,0,0,.2)" : "background:rgba(255,255,255,.72);color:#6B7280;box-shadow:0 2px 6px rgba(0,0,0,.15)"}"><span style="font-size:10px;color:#6B7280">${esc(fl[i])}</span>${me ? "<br>나" : ""}</span>`; };
  const tag = i => {
    if (!edit) return mtag(i);
    const pos = fl[i]; const u = q[i]; const p = xy[i]; const fixd = pinned(u, pos); const off = u && !fixd && !canPlay(pOf(u), pos); const keep = isKeeper(pos);
    const bg = !u ? "rgba(255,255,255,0.72)" : u === S.uid && !edit ? "#DCFCE7" : keep ? "#FEF3C7" : "#FFFFFF";
    return `<button ${edit ? `data-act="lineSpot" data-i="${i}"` : "disabled"} aria-label="${esc(pos)} ${esc(u ? nm(u) : "빈자리")}" style="position:absolute;left:${p.x}%;top:${p.y}%;transform:translate(-50%,-50%);border:0;background:${bg};color:${u ? "#111827" : "#6B7280"};border-radius:10px;padding:4px ${p.tight ? 6 : 8}px;min-width:44px;min-height:40px;font-size:${p.tight ? 11 : 12}px;font-weight:700;text-align:center;line-height:1.35;box-shadow:0 2px 6px rgba(0,0,0,.15);white-space:nowrap;opacity:1;${sel === i ? "outline:2px solid #15803D;outline-offset:1px;" : ""}"><span style="color:#6B7280;font-size:10px">${esc(pos)}${fixd ? ` <span style="background:#15803D;color:#FFFFFF;border-radius:5px;padding:0 4px;font-size:9px">고정</span>` : ""}</span><br>${u ? esc(nm(u)) : "빈자리"}${off ? `<br><span style="color:#B91C1C;font-size:10px">포지션 아님</span>` : ""}</button>`;
  };
  const pitch = `<div style="position:relative;height:${fs ? 300 : 360}px;border-radius:18px;overflow:hidden;background:#4E7A45">
      <div style="position:absolute;left:0;right:0;top:0;height:25%;background:#558450"></div><div style="position:absolute;left:0;right:0;top:50%;height:25%;background:#558450"></div>
      <div style="position:absolute;left:0;right:0;top:50%;border-top:1.5px solid rgba(255,255,255,.55)"></div>
      <div style="position:absolute;left:50%;top:50%;width:60px;height:60px;transform:translate(-50%,-50%);border:1.5px solid rgba(255,255,255,.55);border-radius:50%"></div>
      <div style="position:absolute;left:28%;right:28%;bottom:0;height:15%;border:1.5px solid rgba(255,255,255,.55);border-bottom:0;border-radius:40px 40px 0 0"></div>
      ${fl.map((_, i) => tag(i)).join("")}${!edit && inLine && myI == null ? `<div style="position:absolute;inset:0;background:rgba(17,24,39,.5);display:flex;align-items:center;justify-content:center"><span style="background:#111827;color:#FFFFFF;border-radius:999px;padding:8px 16px;font-size:16px;font-weight:900">${k}쿼터는 쉬어요</span></div>` : ""}</div>`;
  const qtabs = `<div style="display:grid;grid-template-columns:repeat(${qn},minmax(0,1fr));gap:4px;background:#E5E7EB;border-radius:12px;padding:4px">${Array.from({ length: qn }, (_, i) => i + 1).map(n => `<button data-act="lineQ" data-v="${n}" style="border:0;border-radius:9px;padding:8px 0;font-size:12px;font-weight:700;${n === k ? "background:#111827;color:#FFFFFF" : "background:transparent;color:#6B7280"}">${n}Q</button>`).join("")}</div>`;
  const selCard = () => {
    const pos = fl[sel]; const u = q[sel]; const fixd = pinned(u, pos);
    return `<div class="card" style="padding:12px 16px;gap:8px;border:1.5px solid #15803D"><div class="spread"><span><b>${esc(pos)} 자리</b> <span class="hint">${k}쿼터</span><br><span style="font-size:16px;font-weight:700">${u ? esc(nm(u)) : "비어 있어요"}</span>${fixd ? ` <span class="tag">고정</span>` : ""}</span>
      ${u ? (fixd ? `<button class="btn sm" data-act="unfix" data-eid="${esc(e.id)}" data-u="${esc(u)}">고정 풀기</button>` : `<button class="btn sm pri" data-act="fixOpen" data-eid="${esc(e.id)}" data-u="${esc(u)}" data-i="${sel}">고정</button>`) : ""}</div>
      <span class="hint">${u ? (fixd ? `${qText(dr.pins.filter(x => x.u === u && x.pos === pos).flatMap(x => x.qs), qn)} 고정돼 있어요. 고정 풀기는 ${k}쿼터만 풀어요.` : "휴식 선수를 누르면 이 자리에 들어가요. 고정하면 자동 배치를 다시 해도 이 자리에 그대로 있어요.") : "휴식 선수를 누르면 이 자리에 들어가요."}</span></div>`;
  };
  const restCard = `<div class="card" style="padding:16px;gap:8px"><b style="font-size:14px">${k}쿼터 휴식 ${bench.length}명</b><div style="display:flex;flex-wrap:wrap;gap:8px">${bench.map(p => {
      const late = p.from > k; const ok = sel == null || (canPlay(p, fl[sel]) && !late);
      return `<button ${edit ? `data-act="lineBench" data-u="${esc(p.uid)}" data-eid="${esc(e.id)}"` : "disabled"} style="border:1px solid ${late ? "#FDE68A" : "#E5E7EB"};background:${late ? "#FFFBEB" : "#FFFFFF"};color:${late ? "#92400E" : "#111827"};border-radius:999px;padding:8px 11px;font-size:12px;min-height:36px;${p.uid === S.uid ? "font-weight:900;" : ""}${ok ? "" : "opacity:.45;"}">${esc(p.name)}${late ? ` ${p.from}Q부터` : ` <span style="font-size:12px;color:#6B7280">${esc([p.pos[0], p.pos[1]].filter(Boolean).join("/"))}</span>`}</button>`;
    }).join("") || `<span class="hint">없어요</span>`}</div></div>`;
  const field = ps.filter(p => !Object.entries((L && L.q) || {}).some(([, r]) => Object.entries(r).some(([i, u]) => u === p.uid && isKeeper(L.formation[i]))));
  const fc = field.map(p => cnt[p.uid] || 0).filter(n => n > 0); const mn = fc.length ? Math.min(...fc) : 0, mx = fc.length ? Math.max(...fc) : 0;
  const countCard = !L ? "" : `<div class="card" style="padding:16px;gap:8px"><div class="spread"><b style="font-size:14px">쿼터 수</b><span style="font-size:12px;color:#15803D;font-weight:700">${mn === mx ? `필드 1인 ${mx}쿼터씩 맞췄어요` : `필드 1인 ${mn}~${mx}쿼터로 고르게 맞췄어요`}</span></div>
      ${ps.slice().sort((x, y) => (cnt[y.uid] || 0) - (cnt[x.uid] || 0)).slice(0, 5).map(p => `<div style="display:flex;align-items:center;gap:8px;font-size:12px"><b style="width:56px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${p.uid === S.uid ? "font-weight:900" : ""}">${esc(p.name.replace(" (용병)", ""))}</b><span style="flex:1;display:grid;grid-template-columns:repeat(${qn},minmax(0,1fr));gap:4px">${played(p.uid).map(on => `<i style="height:8px;border-radius:2px;background:${on ? "#15803D" : "#E5E7EB"}"></i>`).join("")}</span><b style="width:26px;text-align:right">${cnt[p.uid] || 0}</b></div>`).join("")}
      <a href="#/rest/${esc(e.id)}" style="font-size:12px;font-weight:700;text-decoration:none;text-align:center;padding-top:4px;color:#15803D">${ps.length}명 모두 보기</a></div>`;
  const myQs = Array.from({ length: qn }, (_, i) => mineAt(i + 1)); const myN = myQs.filter(x => x != null).length;
  const myCard = edit || !L ? "" : !inLine ? `<div class="card" style="gap:8px"><b>이번 라인업에 내 이름이 없어요</b><span class="hint">참석으로 바꿨는데 안 보이면 운영진에게 말해 주세요.</span></div>` : `<div class="card" style="padding:16px;gap:12px"><div class="spread" style="align-items:baseline"><b style="font-size:16px">내 출전</b><span style="font-size:12px;color:#6B7280">${qn}쿼터 중 <b style="color:#15803D">${myN}쿼터 출전</b>, ${qn - myN}쿼터 휴식</span></div>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px">${myQs.map((j, i) => `<button data-act="lineQ" data-v="${i + 1}" aria-label="${i + 1}쿼터 ${j != null ? esc(L.formation[j]) : "휴식"}" style="border:0;border-radius:12px;padding:8px 0;min-height:44px;display:flex;flex-direction:column;align-items:center;gap:4px;${j != null ? "background:#DCFCE7;color:#166534" : "background:#F3F4F6;color:#6B7280"}${i + 1 === k ? ";box-shadow:inset 0 0 0 2px #15803D" : ""}"><span style="font-size:12px;font-weight:700">${i + 1}Q</span><b style="font-size:12px">${j != null ? esc(L.formation[j]) : "휴식"}</b></button>`).join("")}</div>
      <span style="font-size:12px;color:#6B7280">쿼터를 누르면 아래 포메이션에서 내 자리를 볼 수 있어요</span></div>`;
  const myLine = edit || !L || !inLine ? "" : `<div class="card" style="padding:12px 16px;flex-direction:row;justify-content:space-between;align-items:center;font-size:14px"><span>${k}쿼터</span><b style="color:${myI == null ? "#6B7280" : "#15803D"}">${myI == null ? "휴식" : esc(fl[myI]) + "로 출전"}</b></div>`;
  const memNote = edit || !L ? "" : `<span style="font-size:12px;color:#9CA3AF;text-align:center">다른 팀원의 자리와 쿼터 수는 운영진 화면에서만 보여요</span>`;
  const emp = L && L.auto ? fl.map((pos, i) => q[i] ? "" : pos).filter(Boolean) : [];
  const empBox = !edit || !emp.length ? "" : fs ? `<div class="err">${k}쿼터 빈자리 ${emp.join(", ")}: ${emp.includes("골레이로") ? "골레이로를 1선호나 2선호로 둔 선수가 없어요. 자리를 누르고 고정으로 골레이로를 정해 주세요. " : ""}${emp.includes(FIELD) ? "뛸 수 있는 인원이 모자라요." : ""}</div>` : `<div class="err">${k}쿼터 빈자리 ${emp.join(", ")}: 이 포지션을 1선호나 2선호로 둔 선수가 없거나 모두 뛰고 있어요. 포메이션을 바꾸거나 자리를 눌러 고정으로 넣어 주세요.</div>`;
  const formBtn = edit && (L || !fs || fl.length) ? `<button data-act="lineForm" data-eid="${esc(e.id)}" style="flex:none;background:#FFFFFF;border:1px solid #E5E7EB;color:#111827;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:700;min-height:40px">${fs ? esc(futsalN(fkey) ? fkey : fl.length + "대" + fl.length) : fl.length + "대" + fl.length + ", " + esc(fkey)} ▾</button>` : "";
  const askN = edit && fs && !L && !fl.length;
  return `${top("라인업" + (edit ? " 짜기" : ""), "#/event/" + e.id, edit && L ? `<button class="btn sm pri" data-act="saveLineup" data-eid="${esc(e.id)}">저장</button>` : "")}<div class="body" style="gap:12px">
    <div class="spread"><span><b style="font-size:16px">${esc(md(e.date) + " " + wd(e.date) + " " + (e.time || "") + " " + evName(e))}</b><br><span style="font-size:12px;color:#6B7280">참석 ${a.yes.length}명${a.late.length ? ", 늦참 " + a.late.length + "명" : ""}${guestsOf(e).length ? ", 용병 " + guestsOf(e).length + "명" : ""}</span></span>${formBtn}</div>
    ${e.type === "scrim" ? `<div class="chips"><button class="chip sm ${side === "A" ? "on" : ""}" data-act="lineSide" data-v="A">A팀 (조끼)</button><button class="chip sm ${side === "B" ? "on" : ""}" data-act="lineSide" data-v="B">B팀</button></div>` : ""}
    ${askN ? `<div class="card" style="gap:8px"><b>몇 명이 뛰나요?</b><span class="hint">골레이로를 포함한 한 팀 인원이에요. 참석 ${ps.length}명</span><div class="chips">${FUTSAL_N.map(n => `<button class="chip" data-act="lineFormPick" data-eid="${esc(e.id)}" data-k="${n}대${n}">${n}대${n}</button>`).join("")}</div></div>`
      : !L && !edit ? `<div class="card empty"><b>아직 라인업이 없어요</b><span class="hint">운영진이 라인업을 알리면 여기에 보여요.</span></div>`
      : `${myCard}${qtabs}${pitch}
    ${edit ? (sel != null ? selCard() : `<span style="font-size:12px;color:#6B7280;text-align:center">선수를 눌러 휴식 선수와 바꾸거나, 그 자리에 고정해요</span>`) : ""}
    ${empBox}
    ${edit ? restCard : myLine + memNote}
    ${edit ? `<button class="btn pri block" data-act="autoLineup" data-eid="${esc(e.id)}" style="font-size:16px">${fs ? "휴식 자동 배치" : "포지션 맞춰 휴식 자동 배치"}</button>` : ""}
    ${edit ? countCard : ""}`}
  </div>${edit && L ? `<div class="cta"><button class="btn pri block" data-act="lineShare" data-eid="${esc(e.id)}">팀원에게 알리기</button></div>` : ""}`;
}

/* ---------- 내전 ---------- */
// 내전 검토: 상대 미정 경기에서, 경기 N일 전(기본 운영 규칙)부터 참석과 대기를 합친 인원이 기준 이상이면
function scrimReady(e) { if (e.type !== "match" || e.opponent || e.scrimKeep || started(e)) return false; if (Date.now() < new Date(e.date + "T00:00:00+09:00").getTime() - pol("scrimDays") * 864e5) return false; const a = att(e); return a.in + a.wait.length >= pol("scrimMin"); }


/* ---------- 선수 관리 ---------- */



/* ---------- 미리 등록한 명단 ---------- */
// 운영진이 명단(players)을 넣어 두면, 팀원은 처음 들어올 때 자기 이름을 골라 연결한다 (rsvp.pid)
const rosterAll = () => Object.entries(D("players")).map(([id, p]) => ({ id, ...p }));
const claimedPids = () => new Set(S.members.map(m => (S.rsvp[m.user_id] || {}).pid).filter(Boolean));
const unclaimed = () => { const c = claimedPids(); return rosterAll().filter(p => !c.has(p.id)).sort((a, b) => (Number(a.num) || 999) - (Number(b.num) || 999)); };
const joinedOf = u => { const pid = (S.rsvp[u] || {}).pid; return pid && D("players")[pid] ? D("players")[pid].joined || "" : ""; };
const dotDate = d => d ? d.slice(0, 4) + "." + Number(d.slice(5, 7)) + "." + Number(d.slice(8, 10)) : "";
function vClaim() {
  const list = unclaimed();
  return `${top("명단에서 내 이름 고르기", S.flow ? "" : "#/")}<div class="body">
    <div class="card"><b style="font-size:18px">${esc(S.team ? S.team.name : "")} 명단이에요</b><span class="hint">운영진이 미리 올려 둔 명단이에요. 내 이름을 누르면 번호와 포지션이 그대로 들어가요.</span></div>
    <div class="card"><div class="list">${list.map(p => `<button class="li" style="border:0;border-bottom:1px solid #F3F4F6;background:none;text-align:left;width:100%" data-act="claim" data-pid="${esc(p.id)}"><span class="av">${esc(p.num || p.name.slice(0, 1))}</span><span style="flex:1"><b>${esc(p.name)}</b><br><span class="hint">${esc([p.num ? p.num + "번" : "", p.pos1, p.pos2].filter(Boolean).join(", "))}</span></span></button>`).join("") || `<span class="hint">남은 이름이 없어요.</span>`}</div></div>
    <button class="btn" data-act="noClaim">명단에 내 이름이 없어요</button>
  </div>`;
}
const POS_ALL = ["GK", "LB", "LWB", "CB", "RB", "RWB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST", "DF", "FW", "골레이로", "픽소", "아라", "피보"];
function parseRoster(text) {
  const rows = []; const bad = [];
  String(text || "").split(/\r?\n/).forEach((line, i) => {
    const raw = line.trim(); if (!raw) return;
    let f = raw.split(/\t|,/).map(x => x.trim());
    if (f.length < 3) f = raw.split(/\s+/);
    const name = (f[0] || "").replace(/\s+/g, "");
    const up = x => String(x || "").toUpperCase().replace(/\s/g, "");
    const pos1 = SOC_OLD[up(f[1])] || up(f[1]), pos2 = SOC_OLD[up(f[2])] || up(f[2]); const num = String(f[3] || "").replace(/\D/g, "").slice(0, 3);
    const dm = String(f.slice(4).join(" ")).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    const joined = dm ? `${dm[1]}-${dm[2].padStart(2, "0")}-${dm[3].padStart(2, "0")}` : "";
    if (!name || (pos1 && !POS_ALL.includes(pos1)) || (pos2 && !POS_ALL.includes(pos2))) { bad.push(i + 1); return; }
    rows.push({ name: name.slice(0, 20), pos1, pos2, num, joined });
  });
  return { rows, bad };
}


const ACT4 = {
  monthGo: t => { const [y, m] = (UI.month || ym()).split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + Number(t.dataset.d), 1)); UI.month = d.toISOString().slice(0, 7); render(); },
  remindOpen: t => remindSheet(t.dataset.eid),
  remindSend: async t => {
    const e = S.events[t.dataset.eid]; if (!e) return; if (remindLeft()) { remindSheet(e.id); return; }
    const pick = [...document.querySelectorAll("[data-rm]")].filter(x => x.checked).map(x => x.dataset.rm);
    t.disabled = true;
    try {
      await setDoc("team", "remind", { at: new Date().toISOString(), by: S.uid, eid: e.id, to: pick });
      closeSheet(); render();
      toast("미응답 " + pick.length + "명에게 알렸어요");
    } catch (err) { t.disabled = false; fail(err); }
  },
};
const ACT3 = {
  claim: t => {
    const p = D("players")[t.dataset.pid]; if (!p) return;
    confirmBox("내 이름이 맞나요?", `${p.name}${p.num ? ", " + p.num + "번" : ""}${p.pos1 ? ", " + [p.pos1, p.pos2].filter(Boolean).join(", ") : ""}`, "맞아요", async () => {
      try {
        const profile = { name: p.name, num: p.num || "", pos1: p.pos1 || "", pos2: p.pos2 || "" };
        await patchDoc("rsvp", S.uid, { pid: t.dataset.pid, profile });
        await sb.rpc("set_my_name", { p_team: S.tid, p_name: profile.name });
        if (S.flow) { if (!isAdmin() && !(S.rsvp[S.uid] || {}).agreedAt) { S.flow = "rules"; render(); return; } S.flow = ""; S.ready = true; }
        toast("연결했어요"); location.hash = "#/"; render();
      } catch (e) { fail(e); }
    });
  },
  noClaim: () => { S.afterProfile = ""; startProfile(); },
  rosterPreview: () => render(),
  rosterOpen: t => rosterSheet(t.dataset.pid),
  rosterDel: t => { closeSheet(); confirmBox("명단에서 빼기", "이 이름을 명단에서 뺄까요?", "빼기", async () => { try { await delDoc("players", t.dataset.pid); render(); } catch (e) { fail(e); } }, true); },
  rosterSave: async t => {
    const { rows } = parseRoster(S.form.text); if (!rows.length) return; t.disabled = true;
    try {
      const byName = {}; rosterAll().forEach(p => { byName[p.name] = p.id; });
      let linked = 0;
      for (const r of rows) {
        const pid = byName[r.name] || uid36("p");
        await setDoc("players", pid, { ...(D("players")[pid] || {}), ...r });
        // 이미 들어온 팀원과 이름이 같으면 연결하고 번호와 포지션을 맞춘다
        const m = S.members.find(x => nameOf(x.user_id) === r.name);
        if (m) { const cur = S.rsvp[m.user_id] || {}; if (!cur.pid || cur.pid === pid) { await patchDoc("rsvp", m.user_id, { pid, profile: { ...(cur.profile || {}), name: r.name, num: r.num, pos1: r.pos1, pos2: r.pos2 } }); linked++; } }
      }
      toast(`${rows.length}명을 등록했어요${linked ? `. ${linked}명은 이미 들어온 팀원과 연결했어요` : ""}`); S.form = {}; location.hash = "#/players";
    } catch (e) { t.disabled = false; fail(e); }
  },
};
const ACT2 = {
  goTo: t => { closeSheet(); location.hash = t.dataset.h; },
  duesRef: t => { UI.ref = t.dataset.v; render(); },
  duesToggle: async t => { const key = t.dataset.key, u = t.dataset.u; const cur = { ...(D("dues")[key] || {}) }; cur[u] = cur[u] === "paid" ? "" : "paid"; cur._at = { ...(cur._at || {}), [u]: cur[u] ? todayStr() : "" }; try { await setDoc("dues", key, cur); render(); await syncMyDues([u]); } catch (e) { fail(e); } },
  payOk: async t => {
    const u = t.dataset.u, k = t.dataset.k; const it = (((D("payreq")[u] || {}).items) || {})[k]; if (!it) return;
    try {
      for (const ref of it.refs || []) { if (ref.kind === "dues") { const cur = { ...(D("dues")[ref.key] || {}) }; cur[u] = "paid"; cur._at = { ...(cur._at || {}), [u]: todayStr() }; await setDoc("dues", ref.key, cur); } else if (ref.kind === "fine" && D("fines")[ref.id]) await setDoc("fines", ref.id, { ...D("fines")[ref.id], paid: true, paidAt: todayStr() }); }
      await patchDoc("payreq", u, { items: { [k]: { status: "ok", doneAt: new Date().toISOString() } } }); render(); await syncMyDues([u]); toast("확인했어요. 납부로 바뀌었어요");
    } catch (e) { fail(e); }
  },
  payNo: async t => { try { await patchDoc("payreq", t.dataset.u, { items: { [t.dataset.k]: { status: "no", doneAt: new Date().toISOString() } } }); render(); toast("확인 안 됨으로 표시했어요"); } catch (e) { fail(e); } },
  fineToggle: async t => { const f = D("fines")[t.dataset.id]; if (!f) return; try { await setDoc("fines", t.dataset.id, { ...f, paid: !f.paid, paidAt: f.paid ? "" : todayStr() }); render(); await syncMyDues([f.uid]); } catch (e) { fail(e); } },
  paySheet: () => {
    const my = D("mydues")[S.uid] || {}; const b = S.settings.bank || {};
    const refs = []; let total = 0;
    Object.entries(my.dues || {}).forEach(([k, v]) => { if (v !== "paid") { refs.push({ kind: "dues", key: k }); total += Number(S.settings.fee) || 0; } });
    (my.fines || []).forEach(f => { if (!f.paid) { refs.push({ kind: "fine", id: f.id }); total += Number(f.amount) || 0; } });
    sheet(`<h3>입금하기</h3><div class="card" style="background:#F9FAFB"><span class="hint">보낼 금액</span><b style="font-size:24px">${won(total)}</b>${b.account ? `<span>${esc(b.bank || "")} ${esc(b.account)}<br><span class="hint">예금주 ${esc(b.holder || "")}</span></span><button class="btn sm" id="copyAcc" style="align-self:flex-start">계좌 복사</button>` : `<span class="hint">운영진이 아직 계좌를 적지 않았어요. 운영진에게 물어봐 주세요.</span>`}</div><span class="hint">보낸 뒤 아래 버튼을 누르면 운영진이 확인해요.</span><div class="row"><button class="btn block" data-act="closeSheet">닫기</button><button class="btn pri block" id="paySent">입금했어요</button></div>`);
    if ($("#copyAcc")) $("#copyAcc").onclick = async () => { try { await navigator.clipboard.writeText(b.account); toast("계좌를 복사했어요"); } catch (e) { toast("길게 눌러 복사해 주세요"); } };
    $("#paySent").onclick = async () => { try { await patchDoc("payreq", S.uid, { items: { [uid36("p")]: { refs, amount: total, label: refs.length + "건", at: new Date().toISOString(), status: "req" } } }); closeSheet(); render(); toast("운영진에게 알렸어요"); } catch (e) { fail(e); } };
  },
  saveBank: async t => { t.disabled = true; try { await setDoc("team", "settings", { ...S.settings, bank: { bank: String(S.form.bank || "").trim(), account: String(S.form.account || "").trim(), holder: String(S.form.holder || "").trim() } }); toast("저장했어요"); location.hash = "#/dues"; } catch (e) { t.disabled = false; fail(e); } },
  ledgerAdd: async () => {
    const f = S.form; const amount = Number(String(f.amount || "").replace(/\D/g, "")); if (!amount || !String(f.label || "").trim()) { toast("금액과 내용을 적어 주세요"); return; }
    const items = ((D("team").ledger || {}).items || []).concat([{ id: uid36("l"), date: f.date || todayStr(), type: f.type === "out" ? "out" : "in", label: String(f.label).trim().slice(0, 40), amount }]);
    try { await setDoc("team", "ledger", { items }); S.form = { type: f.type }; render(); toast("기록했어요"); } catch (e) { fail(e); }
  },
  ledgerDel: t => confirmBox("내역 지우기", "이 내역을 지울까요?", "지우기", async () => { const items = ((D("team").ledger || {}).items || []).filter(x => x.id !== t.dataset.id); try { await setDoc("team", "ledger", { items }); render(); } catch (e) { fail(e); } }, true),
  checkSet: async t => { const e = S.events[t.dataset.eid]; if (!e) return; const ck = { ...(e.check || {}) }; const u = t.dataset.u; ck[u] = ck[u] === t.dataset.v ? "" : t.dataset.v; const at = { ...(e.checkAt || {}) }; if (ck[u] === "in" || ck[u] === "late") at[u] = at[u] || new Date(Date.now() + 9 * 3600e3).toISOString().slice(11, 16); else delete at[u]; try { await setDoc("events", e.id, { ...e, check: ck, checkAt: at, checkedAt: new Date().toISOString() }); render(); } catch (err) { fail(err); } },
  finesApply: async t => {
    const e = S.events[t.dataset.eid]; if (!e) return; const ck = e.check || {}; const a = att(e); const going = new Set([...a.yes, ...a.late].map(x => x.uid));
    const late = ruleAmt("late"), abs = ruleAmt("absent"); let n = 0;
    try {
      for (const [u, v] of Object.entries(ck)) {
        if (u.startsWith("g:")) continue;
        const id = "f-" + e.id + "-" + u; const amount = v === "late" ? late : v === "absent" && going.has(u) ? abs : 0;
        const old = D("fines")[id] || {}; const rr = (S.settings.rules || []).find(r => ruleKind(r) === (v === "late" ? "late" : "absent"));
        if (amount) { await setDoc("fines", id, { uid: u, date: e.date, eventId: e.id, reason: rr ? rr.label : v === "late" ? "지각" : "말없이 불참", amount, paid: old.paid || false, paidAt: old.paidAt || "", at: old.at || new Date().toISOString() }); n++; }
        else if (D("fines")[id]) await delDoc("fines", id);
      }
      await setDoc("events", e.id, { ...S.events[e.id], checkDone: new Date().toISOString() });
      await syncMyDues(); toast(n ? `벌금 ${n}건을 매기고 출석을 마쳤어요` : "출석을 마쳤어요"); location.hash = "#/manage/" + e.id;
    } catch (err) { fail(err); }
  },
  score: t => { S.form[t.dataset.k] = Math.max(0, (Number(S.form[t.dataset.k]) || 0) + Number(t.dataset.d)); render(); },
  goalAdd: t => { (S.form.goals = S.form.goals || []).push({ uid: t.dataset.u }); render(); },
  goalDel: t => { S.form.goals.splice(Number(t.dataset.i), 1); render(); },
  saveResult: async t => { const e = S.events[t.dataset.eid]; if (!e) return; t.disabled = true; try { await setDoc("events", e.id, { ...e, score: { us: Number(S.form.us) || 0, them: Number(S.form.them) || 0 }, scoredAt: e.scoredAt || new Date().toISOString(), goals: (S.form.goals || []).map(g => ({ uid: g.uid })) }); await syncMyDues(); toast("저장했어요. MOM 투표가 열렸어요"); location.hash = "#/game/" + e.id; } catch (err) { t.disabled = false; fail(err); } },
  momPick: t => { UI.mom = t.dataset.u; render(); },
  momSend: async t => { const e = S.events[t.dataset.eid]; if (!e || !UI.mom) return; t.disabled = true; try { await patchDoc("uvote", S.uid, { mom: { [e.id]: UI.mom } }); UI.mom = ""; render(); toast("투표했어요"); } catch (err) { t.disabled = false; fail(err); } },
  pollVote: async t => { const nid = t.dataset.nid, opt = t.dataset.opt; const cur = (myUv().poll || {})[nid]; try { await patchDoc("uvote", S.uid, { poll: { [nid]: cur === opt ? "" : opt } }); setTimeout(refreshTally, 500); render(); } catch (e) { fail(e); } },
  optAdd: () => { (S.form.opts = S.form.opts || []).push({ label: "" }); render(); },
  noticeSave: async t => {
    const f = S.form; if (!String(f.title || "").trim()) { toast("제목을 적어 주세요"); return; } t.disabled = true;
    const opts = (f.opts || []).filter(o => String(o.label).trim()).map((o, i) => ({ id: "o" + (i + 1), label: String(o.label).trim().slice(0, 40) }));
    const id = uid36("n");
    try { await setDoc("notices", id, { title: String(f.title).trim(), body: String(f.body || "").trim(), pinned: !!f.pinned, at: new Date().toISOString(), poll: f.poll && opts.length >= 2 ? { opts, until: f.until ? new Date(f.until + "T23:59:00+09:00").toISOString() : "" } : null }); toast("공지를 올렸어요"); location.hash = "#/notices"; } catch (e) { t.disabled = false; fail(e); }
  },
  noticePin: async t => { const n = D("notices")[t.dataset.id]; try { await setDoc("notices", t.dataset.id, { ...n, pinned: !n.pinned }); render(); } catch (e) { fail(e); } },
  noticeDel: t => confirmBox("공지 지우기", "이 공지와 설문 응답이 사라져요.", "지우기", async () => { try { await delDoc("notices", t.dataset.id); render(); } catch (e) { fail(e); } }, true),
  guestReq: t => guestSheet(t.dataset.eid),
  guestOk: async t => {
    const e = S.events[t.dataset.eid]; const g = (((D("guestreq")[t.dataset.u] || {}).items) || {})[t.dataset.k]; if (!e || !g) return;
    try { await setDoc("events", e.id, { ...e, guests: { ...(e.guests || {}), [t.dataset.k]: { name: g.name, pos: g.pos || "", by: t.dataset.u, at: new Date().toISOString(), inCap: true } } }); await patchDoc("guestreq", t.dataset.u, { items: { [t.dataset.k]: { status: "ok", doneAt: new Date().toISOString() } } }); render(); toast("명단에 넣었어요"); } catch (err) { fail(err); }
  },
  guestNo: async t => { try { await patchDoc("guestreq", t.dataset.u, { items: { [t.dataset.k]: { status: "no", doneAt: new Date().toISOString() } } }); render(); toast("거절했어요"); } catch (e) { fail(e); } },
  guestDel: async t => { const e = S.events[t.dataset.eid]; if (!e) return; const gs = { ...(e.guests || {}) }; delete gs[t.dataset.g]; try { await setDoc("events", e.id, { ...e, guests: gs }); render(); } catch (err) { fail(err); } },
  lineQ: t => { UI.q = Number(t.dataset.v); UI.sel = null; render(); },
  lineSide: t => { UI.side = t.dataset.v; S.form.lineup = null; S.form.ldraft = null; UI.sel = null; render(); },
  fixOpen: t => { UI.fix = { u: t.dataset.u, i: Number(t.dataset.i), qs: [Math.min(UI.q, QN[sport()])] }; fixSheet(t.dataset.eid); },
  fixQ: t => { const eid = $("[data-act=fixSave]").dataset.eid; const v = t.dataset.v; const st = UI.fix;
    if (v === "all") { const ok = [...$("#layer").querySelectorAll("[data-act=fixQ]:not([data-v=all])")].map(b => Number(b.dataset.v)); st.qs = ok.every(k => st.qs.includes(k)) ? [] : ok; }
    else { const k = Number(v); st.qs = st.qs.includes(k) ? st.qs.filter(x => x !== k) : [...st.qs, k].sort((a, b) => a - b); }
    fixSheet(eid); },
  fixSave: t => { const e = S.events[t.dataset.eid]; const st = UI.fix; if (!e || !st || !st.qs.length) return; const side = e.type === "scrim" ? UI.side : "main";
    applyFix(e, side, st.u, st.i, st.qs); const p = lineupPlayers(e, side).find(x => x.uid === st.u); UI.fix = null; UI.sel = null; closeSheet(); render(); toast(`${p ? p.name : "선수"}, ${qText(st.qs, QN[sport()])} 고정했어요. 저장해야 팀원에게 보여요`); },
  unfix: t => { const e = S.events[t.dataset.eid]; if (!e) return; const side = e.type === "scrim" ? UI.side : "main"; const d = draftOf(e, side); const k = Math.min(UI.q, QN[sport()]);
    d.pins = d.pins.map(x => x.u === t.dataset.u ? { ...x, qs: x.qs.filter(z => z !== k) } : x).filter(x => x.qs.length);
    const cur = curLineup(e, side); if (cur) { const L = JSON.parse(JSON.stringify(cur)); L.pins = JSON.parse(JSON.stringify(d.pins)); S.form.lineup = L; S.form.lineupFor = e.id + side; }
    render(); toast(`${k}쿼터 고정을 풀었어요`); },
  lineSpot: t => { const i = Number(t.dataset.i); UI.sel = UI.sel === i ? null : i; render(); },
  lineBench: t => { const e = S.events[t.dataset.eid]; if (!e || UI.sel == null) { toast("먼저 바꿀 자리를 눌러 주세요"); return; } const side = e.type === "scrim" ? UI.side : "main";
    const d = draftOf(e, side); const cur = curLineup(e, side); const formation = cur ? cur.formation : formOf(d.fkey); const k = Math.min(UI.q, QN[sport()]);
    const pl = lineupPlayers(e, side).find(p => p.uid === t.dataset.u); const slot = formation[UI.sel]; if (!pl || !slot) return;
    if (pl.from > k) { toast(`${pl.name}는 ${pl.from}쿼터부터 와요`); return; }
    if (!canPlay(pl, slot)) { UI.fix = { u: pl.uid, i: UI.sel, qs: [k] }; fixSheet(e.id); return; }
    const L = JSON.parse(JSON.stringify(cur || { fkey: d.fkey, formation, q: {} })); const row = L.q[k] = L.q[k] || {}; const old = row[UI.sel];
    if (old) d.pins = d.pins.map(x => x.u === old && x.pos === slot ? { ...x, qs: x.qs.filter(z => z !== k) } : x).filter(x => x.qs.length);
    row[UI.sel] = pl.uid; L.pins = JSON.parse(JSON.stringify(d.pins)); S.form.lineup = L; S.form.lineupFor = e.id + side; UI.sel = null; render(); },
  lineForm: t => { const e = S.events[t.dataset.eid]; const forms = FORMS[sport()];
    if (sport() === "futsal") { sheet(`<h3>몇 명이 뛰나요?</h3><span class="hint">골레이로를 포함한 한 팀 인원이에요. 참석 ${att(e).in}명</span><div class="chips">${FUTSAL_N.map(n => `<button class="chip" data-act="lineFormPick" data-eid="${esc(e.id)}" data-k="${n}대${n}">${n}대${n}</button>`).join("")}</div><button class="btn" data-act="closeSheet">닫기</button>`); return; }
    sheet(`<h3>포메이션 고르기</h3><span class="hint">참석 ${att(e).in}명</span><div class="list">${(sport() === "soccer" ? PICK : Object.keys(forms)).map(k => `<button class="li" data-act="lineFormPick" data-eid="${esc(e.id)}" data-k="${esc(k)}" style="border:0;border-bottom:1px solid #F3F4F6;background:none;text-align:left;width:100%"><span style="flex:1"><b>${sport() === "soccer" ? "11대11" : forms[k].length + "대" + forms[k].length}, ${esc(k)}</b><br><span class="hint">${esc(FORM_DESC[k] || forms[k].join(", "))}</span></span></button>`).join("")}</div><button class="btn" data-act="closeSheet">닫기</button>`); },
  lineFormPick: t => { closeSheet(); const e = S.events[t.dataset.eid]; const side = e.type === "scrim" ? UI.side : "main"; { const d = draftOf(e, side); d.fkey = t.dataset.k; const nf = formOf(t.dataset.k) || []; const before = d.pins.length; d.pins = d.pins.filter(x => nf.includes(x.pos)); if (d.pins.length < before) setTimeout(() => toast("새 포메이션에 없는 자리의 고정은 풀었어요"), 1800); }
    const what = sport() === "futsal" ? t.dataset.k + "로 정했어요" : "포메이션을 골랐어요";
    if (!curLineup(e, side)) { render(); toast(`${what}. 지정할 선수가 있으면 먼저 정하고 자동 배치를 눌러 주세요`); return; }
    S.form.lineup = autoLineup(e, side); S.form.lineupFor = e.id + side; UI.q = 1; UI.sel = null; render(); toast(`${sport() === "futsal" ? t.dataset.k + "로 바꾸고" : "포메이션을 바꾸고"} 다시 짰어요. 저장해야 팀원에게 보여요`); },
  autoLineup: t => { const e = S.events[t.dataset.eid]; if (!e) return; const side = e.type === "scrim" ? UI.side : "main"; if (!formOf(draftOf(e, side).fkey, curLineup(e, side))) { toast("몇 명이 뛸지 먼저 골라 주세요"); return; }
    S.form.lineup = autoLineup(e, side); S.form.lineupFor = e.id + side; UI.q = 1; UI.sel = null; render(); const how = sport() === "futsal" ? "휴식을 고르게" : "포지션에 맞춰"; toast(draftOf(e, side).pins.length ? `지정은 그대로 두고 나머지를 ${how} 짰어요. 저장해야 팀원에게 보여요` : `${how} 짰어요. 저장해야 팀원에게 보여요`); },
  saveLineup: async t => { const e = S.events[t.dataset.eid]; if (!e) return; const side = e.type === "scrim" ? UI.side : "main"; const L = curLineup(e, side); if (!L) return; try { await setDoc("events", e.id, { ...e, lineup: { ...(e.lineup || {}), [side]: L } }); S.form.lineup = null; render(); toast("저장했어요. 팀원에게 알리기를 누르면 팀원에게 보여요"); } catch (err) { fail(err); } },
  lineShare: t => { const e = S.events[t.dataset.eid]; if (!e) return; const n = lineupPlayers(e, e.type === "scrim" ? UI.side : "main").length;
    confirmBox("라인업을 알릴까요?", `${md(e.date)} ${wd(e.date)} ${e.time || ""} ${evName(e)}, 참석 ${n}명. 팀원 라인업 화면과 알림함에 보여요. 나중에 바꿔도 다시 알릴 수 있어요.`, `${n}명에게 알리기`, async () => { const side = e.type === "scrim" ? UI.side : "main"; const L = curLineup(e, side); try { await setDoc("events", e.id, { ...e, lineup: { ...(e.lineup || {}), [side]: L }, lineupAt: new Date().toISOString() }); S.form.lineup = null; render(); toast("라인업을 알렸어요"); } catch (err) { fail(err); } }); },
  scrimConvert: t => confirmBox("내전으로 바꾸기", "상대팀 없이 우리끼리 A팀과 B팀으로 나눠서 해요. 대기자도 모두 참석으로 올라가고, 신청한 사람 모두에게 보여요.", "바꾸기", async () => { const e = S.events[t.dataset.eid]; const a = att(e); const T = {}; [...a.yes, ...a.late, ...a.wait].forEach((x, i) => { T[x.uid] = i % 2 ? "B" : "A"; }); try { await setDoc("events", e.id, { ...e, type: "scrim", cap: 0, teams: T, scrimAt: new Date().toISOString() }); toast("내전으로 바꿨어요. 스쿼드를 나눠 주세요"); location.hash = "#/squad/" + e.id; } catch (err) { fail(err); } }),
  squadSet: async t => { const e = S.events[t.dataset.eid]; const T = { ...(e.teams || {}) }; T[t.dataset.u] = T[t.dataset.u] === t.dataset.v ? "" : t.dataset.v; try { await setDoc("events", e.id, { ...e, teams: T }); render(); } catch (err) { fail(err); } },
  squadAuto: async t => {
    const e = S.events[t.dataset.eid]; const a = att(e); let ids = Object.keys(e.teams || {}); if (!ids.length) ids = [...a.yes, ...a.late, ...a.wait].map(x => x.uid);
    const order = POS[sport()]; const pos = u => u.startsWith("g:") ? posFix(((e.guests || {})[u.slice(2)] || {}).pos || "") : ((profileOf(u) || {}).pos1 || "");
    ids.sort((x, y) => (order.indexOf(pos(x)) + 99) % 99 - (order.indexOf(pos(y)) + 99) % 99); const T = {}; ids.forEach((u, i) => { T[u] = (i % 4 === 0 || i % 4 === 3) ? "A" : "B"; });
    try { await setDoc("events", e.id, { ...e, teams: T }); render(); toast("포지션별로 고르게 나눴어요"); } catch (err) { fail(err); }
  },

  playerOpen: t => playerSheet(t.dataset.u),
  setRole: async t => { closeSheet(); const { error } = await sb.rpc("set_member_role", { p_team: S.tid, p_user: t.dataset.u, p_role: t.dataset.v }); if (error) fail(error); else { toast("바꿨어요"); refreshMembers(); } },
  kick: t => { const u = t.dataset.u; confirmBox("팀에서 내보내기", `${nameOf(u)} 님을 내보낼까요? 다시 들어오려면 초대 링크가 필요해요.`, "내보내기", async () => { const { error } = await sb.rpc("remove_member", { p_team: S.tid, p_user: u }); if (error) fail(error); else { toast("내보냈어요"); refreshMembers(); } }, true); },
  posSend: async t => { const f = S.form; if (!f.pos1) { toast("1선호를 골라 주세요"); return; } t.disabled = true; try { await patchDoc("rsvp", S.uid, { posReq: { pos1: f.pos1, pos2: f.pos2 || "", note: String(f.note || "").trim().slice(0, 60), at: new Date().toISOString(), status: "req" } }); toast("요청을 보냈어요"); location.hash = "#/players"; } catch (e) { t.disabled = false; fail(e); } },
  posCancel: async () => { try { await patchDoc("rsvp", S.uid, { posReq: null }); render(); } catch (e) { fail(e); } },
  posOk: async t => { closeSheet(); const u = t.dataset.u; const r = S.rsvp[u] || {}; const req = r.posReq || {}; try { await patchDoc("rsvp", u, { profile: { ...(r.profile || {}), pos1: req.pos1, pos2: req.pos2 || "" }, posReq: { status: "ok", doneAt: new Date().toISOString() } }); render(); toast("포지션을 바꿨어요"); } catch (e) { fail(e); } },
  posNo: async t => { closeSheet(); try { await patchDoc("rsvp", t.dataset.u, { posReq: { status: "no", doneAt: new Date().toISOString() } }); render(); toast("거절했어요"); } catch (e) { fail(e); } },
};
// 공지를 열면 읽음으로 남긴다 (몇 명이 읽었는지만 모인다)
async function markSeen() {
  const seen = myUv().seen || {}; const add = {}; Object.keys(D("notices")).forEach(id => { if (!seen[id]) add[id] = 1; });
  if (!Object.keys(add).length || !S.uid) return;
  try { await patchDoc("uvote", S.uid, { seen: add }); setTimeout(refreshTally, 500); } catch (e) { console.error(e); }
}
async function refreshTally() { const { data } = await sb.from("docs").select("id,data").eq("team_id", S.tid).eq("coll", "tally"); if (data) { S.d.tally = {}; data.forEach(r => { S.d.tally[r.id] = r.data; }); render(); } }

/* ---------- 그리기와 길찾기 ---------- */
function route() { return (location.hash || "#/").slice(1); }
// 여러 번 바뀌어도 한 번만 다시 그린다. 투표 카드가 움직이는 동안(freezeUntil)은 다시 그리지 않는다
let rq = 0, frT = 0;
function scheduleRender() { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; render(); }); }
function render() {
  const wait = (S.freezeUntil || 0) - Date.now();
  if (wait > 0) { clearTimeout(frT); frT = setTimeout(render, wait + 20); return; }
  const app = $("#app"); let html = "";
  if (S.flow === "login") html = vLogin(qs.get("login_error"));
  else if (S.flow === "invite") html = vInvite(S.inviteTeam, qs.get("login_error"));
  else if (S.flow === "create") html = vCreate();
  else if (S.flow === "teams") html = vTeams();
  else if (S.flow === "joinReq") html = vJoinReq();
  else if (S.flow === "joinWait") html = vJoinWait();
  else if (S.flow === "profile") html = vProfile(false);
  else if (S.flow === "rules") html = vRules();
  else if (!S.ready) html = `<div class="loading">불러오는 중이에요</div>`;
  else {
    const r = route();
    // 지금 화면이 속한 탭 색 (탭 첫 화면은 navBar가 다시 맞춤)
    setSec(/^\/(records|game|season|result)/.test(r) ? "record" : /^\/(team|notices?|rules|money|members|kick|write)/.test(r) ? "team" : /^\/(ops|requests|posreqs|dues|fines|policy|settings|ledger)/.test(r) ? "ops" : /^\/(schedule|event|lineup|manage|roster|check|merc|new|edit|scrim)/.test(r) ? "schedule" : /^\/chat/.test(r) ? "chat" : /^\/(match|hire|seek)$/.test(r) ? "other" : "home");
    if (r === "/invite" && isAdmin()) html = vInviteMsg();
    else if (r === "/me") html = vProfile(true);
    else {
      const page = rr => viewMode() === "admin" ? (adminRoute(rr) || memberRoute(rr)) : memberRoute(rr);
      // PC: 일정, 기록, 팀, 운영은 왼쪽 목록과 오른쪽 상세 두 칸
      html = (isPC() && pcSplit(r, page)) || page(r) || memberRoute("/");
    }
  }
  // PC(가로 1024px 이상): 같은 화면을 왼쪽 메뉴로 감싼다 (로그인, 팀 고르기 같은 흐름은 그대로)
  const pcOn = isPC() && S.ready && !S.flow;
  document.documentElement.classList.toggle("pc", pcOn);
  document.documentElement.classList.toggle("pcwide", !pcOn && /class="lgp"/.test(html.slice(0, 40)));
  if (pcOn) html = pcShell(html);
  // 입력 중인 칸은 그대로 두려고, 같은 화면이면 포커스와 커서를 되돌린다
  const act = document.activeElement; const d = (act && act.dataset) || {};
  const sel = d.bind ? `[data-bind="${d.bind}"]` : d.rule != null ? `[data-rule="${d.rule}"][data-f="${d.f}"]` : d.opt != null ? `[data-opt="${d.opt}"]` : "";
  const pos = sel && "selectionStart" in act ? act.selectionStart : null;
  app.innerHTML = html;
  tuneInputs(app);
  if (sel) { const el = app.querySelector(sel); if (el) { el.focus(); try { if (pos != null) el.setSelectionRange(pos, pos); } catch (e) { /* 날짜 칸 */ } } }
}
let lastRoute = "";
window.addEventListener("hashchange", () => onRoute(false));
function onRoute(force) {
  const r = route(); if (r === lastRoute && !force) return; lastRoute = r; trackRoute(r);
  // 폼 화면에 들어올 때 폼 값을 채운다
  let m;
  if (viewMode() === "admin" && adminForm(r)) { render(); window.scrollTo(0, 0); return; }
  if (memberForm(r)) { render(); window.scrollTo(0, 0); return; }
  if (r === "/new") eventFormInit("");
  else if ((m = r.match(/^\/edit\/(.+)$/)) && S.events[decodeURIComponent(m[1])]) eventFormInit(decodeURIComponent(m[1]));
  else if (r === "/new-old") S.form = { type: "match", date: "", time: "", end: "", place: "", opponent: "", cap: sport() === "soccer" ? 22 : 12, memo: "" };
  else if ((m = r.match(/^\/edit\/(.+)$/)) && S.events[decodeURIComponent(m[1])]) { const e = S.events[decodeURIComponent(m[1])]; S.form = { type: e.type, date: e.date, time: e.time, end: e.end || "", place: e.place || "", opponent: e.opponent || "", cap: Number(e.cap) || 0, memo: e.memo || "" }; }
  else if (r === "/me") { const p = myProfile() || {}; S.form = { name: p.name || nameOf(S.uid), num: p.num || "", pos1: p.pos1 || "", pos2: p.pos2 || "" }; }
  else if (r === "/invite") S.form = {};
  else if (r === "/dues-settings") { const b = S.settings.bank || {}; S.form = { bank: b.bank || "", account: b.account || "", holder: b.holder || "" }; }
  else if (r === "/ledger") S.form = { type: "in", date: todayStr() };
  else if (r === "/notice-new") S.form = { title: "", body: "", pinned: "", poll: "", opts: [{ label: "" }, { label: "" }], until: "" };
  else if (r === "/posreq") { const p = myProfile() || {}; S.form = { pos1: p.pos1 || "", pos2: p.pos2 || "", note: "" }; }
  else if ((m = r.match(/^\/result\/(.+)$/)) && S.events[decodeURIComponent(m[1])]) { const e = S.events[decodeURIComponent(m[1])]; S.form = { us: (e.score || {}).us || 0, them: (e.score || {}).them || 0, goals: (e.goals || []).map(g => ({ uid: g.uid })) }; }
  else if (/^\/(lineup|game)\//.test(r)) { S.form = {}; UI.q = 1; UI.mom = ""; UI.sel = null; }
  else if (r === "/notices") markSeen();
  else if (r === "/roster-import") S.form = { text: "" };
  else if (r === "/settings") { const st = S.settings; S.form = { name: (S.team && S.team.name) || st.teamName || "", sport: st.sport || "futsal", feeMode: st.feeMode || "none", fee: st.fee ? String(st.fee) : "", dueDay: st.dueDay || "5", kit: st.uniformColor || "#164F33", ...rulesFormInit(st), ...policyFormInit(st) }; }
  render(); window.scrollTo(0, 0);
}

/* ---------- 입력 ---------- */
document.addEventListener("input", ev => {
  const t = ev.target;
  cleanNum(t);
  if (t.dataset.bind) {
    S.form[t.dataset.bind] = t.type === "checkbox" ? t.checked : t.value;
    if (t.dataset.liveSrc) document.querySelectorAll(`[data-live="${t.dataset.liveSrc}"]`).forEach(el => { el.textContent = t.value || (t.dataset.liveSrc === "name" ? "이름" : ""); });
  } else if (t.dataset.rule != null) { const r = (S.form.rules || [])[Number(t.dataset.rule)]; if (r) r[t.dataset.f] = t.value; }
  else if (t.dataset.opt != null) { const o = (S.form.opts || [])[Number(t.dataset.opt)]; if (o) o.label = t.value; }
});
// 일정 날짜와 시작 시간을 바꾸면 투표 마감 안내 문장도 다시 그린다
document.addEventListener("change", ev => { const t = ev.target; if ((t.dataset.bind === "date" || t.dataset.bind === "time") && /^\/(new|edit\/.+)$/.test(route())) render(); });
const ACT = {
  closeSheet: (t, ev) => { if (ev.target === t || t.tagName === "BUTTON") closeSheet(); },
  // 테스트 사이트: 로그인 없이 체험하기 (익명 로그인 뒤 TEST FC를 복사한 내 체험 팀으로)
  demo: async t => {
    if (!STAGE) return;
    t.disabled = true;
    try {
      const { error } = await sb.auth.signInAnonymously();
      if (error) throw error;
      await demoEnter(true);
    } catch (e) { console.error(e); t.disabled = false; toast("체험을 시작하지 못했어요. 잠시 뒤 다시 해 주세요"); }
  },
  kakao: async (t, ev, msg) => {
    t.disabled = true;
    try {
      const st = { state: rand(), nonce: rand(), msg: !!msg };
      sessionStorage.setItem(KK, JSON.stringify(st));
      const back = new URL(location.href); back.searchParams.delete("login_error"); if (!msg) back.hash = "";
      sessionStorage.setItem("mb-next", back.href);
      const redirect = KAKAO_REDIRECT;
      location.assign("https://kauth.kakao.com/oauth/authorize?" + new URLSearchParams({ client_id: KAKAO_KEY, redirect_uri: redirect, response_type: "code", scope: "openid profile_nickname" + (STAGE || msg ? " talk_message" : ""), state: st.state, nonce: await sha256hex(st.nonce) }));
    } catch (e) { t.disabled = false; toast("카카오 로그인을 시작하지 못했어요"); }
  },
  pick: t => { S.form[t.dataset.k] = t.dataset.v; if (t.dataset.k === "pos1" && S.form.pos2 === t.dataset.v) S.form.pos2 = ""; render(); },
  ruleAdd: () => { (S.form.rules = S.form.rules || []).push({ label: "", amount: "" }); render(); const ins = document.querySelectorAll('[data-f="label"]'); if (ins.length) ins[ins.length - 1].focus(); },
  pStep: t => { const k = t.dataset.k; const [a, b] = PBOUND[k]; const cur = k === "pCap" ? policyFromForm(S.form).cap : Number(S.form[k]) || 0; S.form[k] = String(Math.max(a, Math.min(b, cur + Number(t.dataset.d)))); render(); },
  ruleDel: t => { S.form.rules.splice(Number(t.dataset.i), 1); render(); },
  createTeam: async t => {
    const f = S.form; const name = String(f.name || "").trim();
    if (!name) { toast("팀 이름을 적어 주세요"); return; }
    t.disabled = true;
    try {
      const { data: tid, error } = await sb.rpc("create_team", { p_name: name });
      if (error) throw error;
      await loadTeams(); await loadTeam(tid);
      await setDoc("team", "settings", { app: "maniball", since: todayStr().slice(0, 7), teamName: name, sport: f.sport, feeMode: f.feeMode, fee: f.feeMode === "none" ? 0 : Number(String(f.fee || "").replace(/\D/g, "")) || 0, dueDay: f.feeMode === "monthly" ? f.dueDay : "", ...rulesFromForm(f), ...policyFromForm(f), uniformColor: f.kit || "#164F33" });
      S.afterProfile = "invite"; startProfile();
    } catch (e) { t.disabled = false; fail(e); }
  },
  saveSettings: async t => {
    const f = S.form; const name = String(f.name || "").trim();
    if (!name) { toast("팀 이름을 적어 주세요"); return; }
    t.disabled = true;
    try {
      const R = rulesFromForm(f); const had = rulesTextOf(S.settings).trim() || fineRulesOf(S.settings).length;
      const rulesAt = had && (R.rulesText !== rulesTextOf(S.settings).trim() || JSON.stringify(R.rules) !== JSON.stringify(fineRulesOf(S.settings).map(r => ({ label: r.label, amount: Number(r.amount) })))) ? new Date().toISOString() : (S.settings.rulesAt || "");
      await setDoc("team", "settings", { ...S.settings, rulesAt, app: "maniball", teamName: name, sport: S.settings.sport || f.sport, feeMode: f.feeMode, fee: f.feeMode === "none" ? 0 : Number(String(f.fee || "").replace(/\D/g, "")) || 0, dueDay: f.feeMode === "monthly" ? f.dueDay : "", ...R, ...(S.role === "owner" ? policyFromForm(f) : {}), uniformColor: f.kit || "#164F33" });
      if (S.team && name !== S.team.name) { const { error } = await sb.from("teams").update({ name: name.slice(0, 40) }).eq("id", S.tid); if (!error) S.team.name = name.slice(0, 40); }
      toast("저장했어요"); location.hash = "#/players";
    } catch (e) { t.disabled = false; fail(e); }
  },
  saveProfile: async t => {
    const f = S.form; const name = String(f.name || "").trim();
    if (!name) { toast("이름을 적어 주세요"); return; }
    if (!f.pos1) { toast("1선호 포지션을 골라 주세요"); return; }
    t.disabled = true;
    try {
      const profile = { ...(myProfile() || {}), name: name.slice(0, 20), num: String(f.num || "").replace(/\D/g, "").slice(0, 3), pos1: f.pos1, pos2: f.pos2 || "", foot: f.foot || "" };
      await patchDoc("rsvp", S.uid, { profile });
      await sb.rpc("set_my_name", { p_team: S.tid, p_name: profile.name });
      if (S.flow === "profile") {
        if (S.afterProfile === "invite") { S.flow = ""; S.ready = true; S.form = {}; lastRoute = "/invite"; location.hash = "#/invite"; render(); return; }
        if (!(S.rsvp[S.uid] || {}).agreedAt) { S.flow = "rules"; render(); return; }
        S.flow = ""; S.ready = true; location.hash = "#/"; render(); return;
      }
      toast("저장했어요"); location.hash = "#/";
    } catch (e) { t.disabled = false; fail(e); }
  },
  agree: async t => { if (!S.form.agreeChk) { toast("수칙을 읽고 체크해 주세요"); return; } t.disabled = true; try { await patchDoc("rsvp", S.uid, { agreedAt: new Date().toISOString() }); S.flow = ""; S.ready = true; location.hash = "#/"; render(); } catch (e) { t.disabled = false; fail(e); } },
  copyLink: async () => { try { await navigator.clipboard.writeText(inviteUrl()); toast("링크를 복사했어요"); } catch (e) { toast("길게 눌러 복사해 주세요"); } },
  newCode: () => confirmBox("새 초대 링크", "지금 링크로는 더 이상 들어올 수 없게 돼요. 이미 들어온 멤버는 그대로예요.", "새 링크 만들기", async () => {
    const { data, error } = await sb.rpc("new_invite_code", { p_team: S.tid }); if (error) { fail(error); return; } S.invite = data; render(); toast("새 링크를 만들었어요");
  }),
  vote: async t => {
    const e = S.events[t.dataset.eid]; if (!e) return; const v = t.dataset.v; const cur = myVote(e);
    if (cur.s === v) return;
    const before = JSON.stringify(S.rsvp[S.uid] || null);
    const entry = { s: v, q: v === "late" ? (Number(cur.q) || 2) : 0 };
    // 운영진은 서버가 신청 시각을 적지 않으므로 직접 적는다 (안 적으면 정원이 찼을 때 늘 대기 맨 뒤로 밀린다)
    if (isAdmin() && (v === "yes" || v === "late")) entry.at = (cur.s === "yes" || cur.s === "late") && cur.at ? cur.at : new Date().toISOString();
    // 바로 보이게 먼저 바꾸고, 서버가 순서와 시각을 적은 값으로 다시 맞춘다
    const mine = S.rsvp[S.uid] = S.rsvp[S.uid] || {}; mine.ev = { ...(mine.ev || {}), [e.id]: { ...cur, ...entry, at: cur.at || new Date().toISOString() } }; render();
    try {
      await patchDoc("rsvp", S.uid, { ev: { [e.id]: entry } }); render();
      const a = att(e); const w = a.wait.findIndex(x => x.uid === S.uid);
      toast(v === "no" ? "불참으로 저장했어요" : w >= 0 ? `정원이 차서 대기 ${w + 1}번이에요` : v === "late" ? "늦참으로 저장했어요. 몇 쿼터부터인지 골라 주세요" : "참석으로 저장했어요");
    } catch (err) { S.rsvp[S.uid] = JSON.parse(before) || undefined; if (!S.rsvp[S.uid]) delete S.rsvp[S.uid]; render(); fail(err); }
  },
  lateQ: async t => { const e = S.events[t.dataset.eid]; if (!e) return; try { await patchDoc("rsvp", S.uid, { ev: { [e.id]: { s: "late", q: Number(t.dataset.q) } } }); render(); toast(t.dataset.q + "쿼터부터로 저장했어요"); } catch (err) { fail(err); } },
  cap: t => { const n = Math.max(0, Math.min(40, (Number(S.form.cap) || 0) + Number(t.dataset.d))); S.form.cap = n; render(); },
  saveEvent: async t => {
    const f = S.form;
    if (!f.date) { toast("날짜를 골라 주세요"); return; }
    if (!f.time) { toast("시작 시간을 골라 주세요"); return; }
    t.disabled = true;
    const id = t.dataset.eid || uid36("e");
    const data = { ...(S.events[id] || {}), id, type: f.type, date: f.date, time: f.time, end: f.end || "", place: String(f.place || "").trim(), opponent: f.type === "match" ? String(f.opponent || "").trim() : "", cap: f.type === "scrim" ? 0 : Number(f.cap) || 0, memo: String(f.memo || "").trim(), updatedAt: new Date().toISOString(), createdAt: (S.events[id] && S.events[id].createdAt) || new Date().toISOString() };
    try { await setDoc("events", id, data); toast(t.dataset.eid ? "저장했어요" : "일정을 올렸어요. 팀원이 바로 참석을 누를 수 있어요"); location.hash = "#/event/" + id; }
    catch (e) { t.disabled = false; fail(e); }
  },
  delEvent: t => confirmBox("일정 지우기", "이 일정과 참석 응답이 모두 사라져요. 되돌릴 수 없어요.", "지우기", async () => { try { await delDoc("events", t.dataset.eid); toast("지웠어요"); location.hash = "#/schedule"; } catch (e) { fail(e); } }, true),
  switchTeam: () => { closeSheet(); showTeams("switch"); },
  teamGo: async t => {
    const id = t.dataset.id;
    if (S.teamsMode === "switch" && id === S.tid && S.ready) { S.flow = ""; render(); return; }
    S.flow = ""; S.ready = false; render(); location.hash = "#/"; lastRoute = ""; await enter(id);
  },
  teamsBack: () => { S.flow = ""; render(); },
  // 마감 후 불참 변경: 벌금에 동의하면 바로 불참으로 바뀌고, 대기 1번이 참석으로 올라간다
  mLateCancel: t => {
    const e = S.events[t.dataset.eid]; if (!e) return;
    const cr = (S.settings.rules || []).find(r => ruleKind(r) === "cancel"); const amt = cr ? Number(cr.amount) || 0 : 0; const next = att(e).wait[0];
    S.form = { lcAgree: false, lcReason: "" };
    sheet(`<h3>불참 변경 신청</h3><div class="hint">투표가 마감돼서 지금 불참으로 바꾸면 팀 수칙대로 벌금이 붙어요. 신청하면 바로 불참으로 바뀌어요.</div>
      ${amt ? `<div style="background:#FEF2F2;color:#991B1B;border-radius:12px;padding:12px 16px;display:flex;justify-content:space-between;gap:8px"><span>${esc(cr.label)}</span><b>${won(amt)}</b></div>` : `<div style="background:#F9FAFB;border-radius:12px;padding:12px 16px;font-size:14px">팀 수칙에 불참 벌금이 없어서 벌금 없이 바뀌어요</div>`}
      ${next ? `<div class="hint">대기 1번 ${esc(next.name)} 님이 참석으로 올라가요</div>` : ""}
      <label class="field"><span class="lab">사유 (안 써도 돼요)</span><input class="inp" data-bind="lcReason" maxlength="80" placeholder="예: 갑자기 야근이 생겼어요" autocomplete="off"></label>
      ${amt ? `<label class="row" style="gap:8px;align-items:center;font-size:16px"><input type="checkbox" data-bind="lcAgree" style="width:22px;height:22px;accent-color:#15803D"><span>벌금 ${won(amt)}을 내는 것에 동의해요</span></label>` : ""}
      <div class="row"><button class="btn block" data-act="closeSheet">취소</button><button class="btn block danger" data-act="mLateCancelGo" data-eid="${esc(e.id)}" data-amt="${amt}">불참으로 바꾸기</button></div>`);
  },
  mLateCancelGo: async t => {
    const e = S.events[t.dataset.eid]; if (!e) return; const amt = Number(t.dataset.amt) || 0;
    if (amt && !S.form.lcAgree) { toast("벌금에 동의해야 바꿀 수 있어요"); return; }
    t.disabled = true;
    const { data, error } = await sb.rpc("late_cancel", { p_team: S.tid, p_event: e.id, p_reason: String(S.form.lcReason || "").trim().slice(0, 80), p_agree: !!S.form.lcAgree });
    if (error) { t.disabled = false; return fail(error); }
    closeSheet(); try { await loadTeam(S.tid); } catch (err) { /* 실시간으로 곧 바뀐다 */ } render();
    toast(data && Number(data.amount) ? `불참으로 바꿨어요. 벌금 ${won(data.amount)}이 회비 화면에 올라갔어요` : "불참으로 바꿨어요");
  },
  joinSend: async t => {
    const name = String(S.form.name || "").trim();
    if (!name) { toast("팀에서 쓰는 이름을 적어 주세요"); return; }
    t.disabled = true;
    try {
      const { data, error } = await sb.rpc("request_join", { p_code: S.joinCode, p_name: name.slice(0, 20), p_message: String(S.form.msg || "").trim().slice(0, 100), p_device: devNow() });
      if (error) throw error;
      if (data === "member") { await loadTeams(); return enter(S.joinTeam.id); }
      S.joinCode = ""; await loadMyReqs(); startJoinWait();
    } catch (e) { t.disabled = false; fail(e); }
  },
  joinCancel: async t => {
    const r = (S.myReqs || []).find(x => x.team_id === t.dataset.id); if (!r) return;
    const go = async () => { const { error } = await sb.rpc("cancel_join", { p_team: r.team_id }); if (error) return fail(error); await loadMyReqs(); if ((S.myReqs || []).length) render(); else { clearInterval(joinPoll); S.flow = ""; if (S.teams.length) enter((S.teams.find(x => x.id === ls.get("mb-team")) || S.teams[0]).id); else startCreate(); } };
    if (r.status === "rejected") go(); else confirmBox("가입 신청 취소", `${r.team_name || "팀"} 가입 신청을 취소할까요?`, "신청 취소", go);
  },
  joinLeave: () => { clearInterval(joinPoll); S.flow = ""; enter((S.teams.find(x => x.id === ls.get("mb-team")) || S.teams[0]).id); },
  reqOk: async t => {
    const r = (S.reqs || []).find(x => x.user_id === t.dataset.id); if (!r) return; t.disabled = true;
    const { error } = await sb.rpc("answer_join", { p_team: S.tid, p_user: r.user_id, p_ok: true });
    if (error) { t.disabled = false; return fail(error); }
    toast(`${r.display_name} 님을 팀원으로 받았어요`); await loadReqs(); await refreshMembers(); render();
  },
  reqNo: t => {
    const r = (S.reqs || []).find(x => x.user_id === t.dataset.id); if (!r) return;
    confirmBox("가입 거절", `${r.display_name} 님의 가입 신청을 거절할까요? 신청한 사람에게 거절됐다고 보여요.`, "거절", async () => {
      const { error } = await sb.rpc("answer_join", { p_team: S.tid, p_user: r.user_id, p_ok: false });
      if (error) return fail(error); toast("거절했어요"); await loadReqs(); render();
    }, true);
  },
  createBack: () => { if (S.fromTeams || !(S.ready && S.tid)) showTeams(S.teamsMode || "entry"); else { S.flow = ""; render(); } },
  enterTeam: async t => { closeSheet(); S.ready = false; render(); await enter(t.dataset.id); },
  newTeam: () => { closeSheet(); S.fromTeams = S.flow === "teams"; startCreate(); },
  // 팀 지우기 (Admin만): 다음 Admin을 지정하고 나가거나, 매니볼에 평가를 남기고 팀을 지운다 (평가는 매니볼을 고치는 데 쓴다)
  delTeam: () => { S.delNext = ""; delSheet(); },
  delPick: t => { S.delNext = t.dataset.u; delSheet(); },
  delLeave: () => { const u = S.delNext; if (!u) { toast("다음 Admin을 골라 주세요"); return; } closeSheet(); confirmBox("Admin을 지정하고 나갈까요?", `${nameOf(u)} 님이 다음 Admin이 되고, 나는 ${S.team.name}에서 나가요. 다시 들어오려면 초대 링크가 필요해요. 되돌릴 수 없어요.`, "지정하고 나가기", async () => {
    const { error } = await sb.rpc("leave_team_as_owner", { p_team: S.tid, p_next: u }); if (error) { fail(error); return; }
    ls.set("mb-team", null); toast("팀에서 나왔어요"); setTimeout(() => location.replace(APP), 600);
  }, true); },
  inqOpen: () => sheet(`<h3>매니볼에 평가 후 지우기</h3><span class="hint">팀을 지우는 이유와 매니볼을 쓰면서 아쉬웠던 점을 남겨 주세요. 더 나은 매니볼을 만드는 데 쓸게요.</span>
    <label class="field"><span class="lab">팀</span><input class="inp" value="${esc(S.team.name)}" disabled></label>
    <label class="field"><span class="lab">평가 내용</span><textarea class="inp" id="inqBody" maxlength="1000" placeholder="예: 팀이 해체돼서 지워요. 회비 화면은 편했어요"></textarea></label>
    <div class="row"><button class="btn block" data-act="delTeam">뒤로</button><button class="btn danger block" data-act="inqSend" style="background:#DC2626;color:#FFFFFF">지우기</button></div>`),
  inqSend: () => {
    const body = String(($("#inqBody") || {}).value || "").trim();
    if (body.length < 2) { toast("평가 내용을 적어 주세요"); return; }
    confirmBox("팀을 지울까요?", `${S.team.name}의 일정, 참석, 회비, 기록, 멤버가 모두 사라져요. 되돌릴 수 없어요.`, "지우기", async () => {
      const { error } = await sb.rpc("delete_team_with_review", { p_team: S.tid, p_body: body }); if (error) { fail(error); return; }
      ls.set("mb-team", null); toast("팀을 지웠어요. 평가해 주셔서 고마워요"); setTimeout(() => location.replace(APP), 900);
    }, true);
  },
  pushToggle: () => pushToggle(),
  kakaoMsg: (t, ev) => ACT.kakao(t, ev, true),
  kakaoMsgOff: () => confirmBox("카카오톡 알림 끄기", "카카오톡 나와의 채팅으로 오던 알림을 끌까요? 카카오 메시지 동의도 함께 거둬요.", "끄기", () => kakaoOff()),
  logout: () => confirmBox("로그아웃", "이 기기에서 로그아웃할까요?", "로그아웃", async () => { await pushDetach(); try { await sb.auth.signOut(); } catch (e) { /* 그래도 처음으로 */ } ls.set("mb-team", null); picked.clear(); location.replace(APP); }),
};
Object.assign(ACT, ACT2, ACT3, ACT4, AACT, MACT, CHACT, XACT);
document.addEventListener("click", ev => {
  const t = ev.target.closest("[data-act]"); if (!t) return;
  const f = ACT[t.dataset.act]; if (!f) return;
  if (t.tagName === "A") ev.preventDefault();
  f(t, ev);
});

/* ---------- 시작 ---------- */
function startCreate() { S.flow = "create"; S.form = { name: "", sport: "futsal", feeMode: "monthly", fee: "", dueDay: "5", ...policyFormInit({}), rulesText: "", rules: [{ label: "지각", amount: "", kind: "late", klabel: "지각" }, { label: "말없이 불참", amount: "", kind: "absent", klabel: "말없이 불참" }, { label: "마감 뒤 불참", amount: "", kind: "cancel", klabel: "마감 뒤 불참" }] }; render(); }
function startProfile() { const p = myProfile() || {}; const dn = nameOf(S.uid); S.flow = "profile"; S.form = { name: p.name || (dn && !["팀원", "이름 없음"].includes(dn) ? dn : "") || suggestedName(), num: p.num || "", pos1: p.pos1 || "", pos2: p.pos2 || "", foot: p.foot || "" }; render(); }
function suggestedName() { const m = (S.session && S.session.user.user_metadata) || {}; return String(m.nickname || m.name || m.full_name || "").slice(0, 20); }
async function enter(tid) {
  hist.set([]); // 팀을 바꾸면 뒤로 가기 기록도 새로
  try { await loadTeam(tid); } catch (e) { fail(e); S.flow = "create"; startCreate(); return; }
  if (!S.role) { ls.set("mb-team", null); await loadTeams(); if (S.teams.length) return enter(S.teams[0].id); return startCreate(); }
  const rs = S.rsvp[S.uid] || {}; if (!isAdmin() && myProfile() && S.settings.rulesAgreeAt && (!rs.agreedAt || rs.agreedAt < S.settings.rulesAgreeAt)) { S.form = {}; S.flow = "rules"; render(); return; }
  if (!myProfile() && !isAdmin()) { S.afterProfile = ""; startProfile(); return; }
  if (!isAdmin() && !(S.rsvp[S.uid] || {}).agreedAt) { S.flow = "rules"; render(); return; }
  S.flow = ""; S.ready = true; picked.set(); onRoute(true);
  syncMyDues().catch(() => {});
}
const isDemo = () => !!(STAGE && S.session && S.session.user && S.session.user.is_anonymous);
async function demoEnter(fresh) {
  const { data: tid, error } = await sb.rpc("demo_start");
  if (error) throw error;
  ls.set("mb-team", tid); picked.set();
  if (fresh) { location.replace(location.pathname + "#/"); location.reload(); return; }
  await loadTeams(); return enter(tid);
}
async function kakaoFinish() {
  let st = null; try { st = JSON.parse(sessionStorage.getItem(KK) || "null"); sessionStorage.removeItem(KK); } catch (e) { /* 없음 */ }
  if (!st || !st.msg) picked.clear(); // 막 로그인했으면 팀 고르기부터 (카카오톡 알림 동의로 다녀온 것은 보던 화면으로)
  if (!st || !qs.get("state") || qs.get("state") !== st.state) throw new Error("state");
  if (qs.get("error")) throw new Error(qs.get("error"));
  const r = await fetch("https://kauth.kakao.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: new URLSearchParams({ grant_type: "authorization_code", client_id: KAKAO_KEY, redirect_uri: KAKAO_REDIRECT, code: qs.get("code") || "" }) });
  const tok = await r.json().catch(() => ({}));
  if (!r.ok || !tok.id_token) throw new Error(tok.error_code || tok.error || "token " + r.status);
  const { error } = await sb.auth.signInWithIdToken({ provider: "kakao", token: tok.id_token, access_token: tok.access_token, nonce: st.nonce });
  if (error) throw error;
  // 카카오톡 메시지 전송에 동의했으면 알림용으로 서버에 맡긴다 (서버가 본인 카카오 계정인지 확인한 뒤 보관)
  if (/(^|\s)talk_message(\s|$)/.test(tok.scope || "")) {
    try { await sb.functions.invoke("push", { body: { action: "kakao_save", access_token: tok.access_token, refresh_token: tok.refresh_token, expires_in: tok.expires_in, refresh_token_expires_in: tok.refresh_token_expires_in } }); } catch (e) { /* 알림만 못 켠 것, 로그인은 그대로 */ }
  }
}
async function boot() {
  // 테스트 사이트 표시 (운영 사이트에는 없다)
  if (STAGE) document.body.insertAdjacentHTML("beforeend", `<div class="stg" aria-hidden="true">테스트 사이트</div>`);
  if (qs.get("state") && (qs.get("code") || qs.get("error"))) {
    let next = ""; try { next = sessionStorage.getItem("mb-next") || ""; sessionStorage.removeItem("mb-next"); } catch (e) { /* 없음 */ }
    let ok = false; try { ok = !!next && new URL(next).origin === location.origin; } catch (e) { /* 잘못된 주소 */ }
    if (!ok) next = APP;
    try { await kakaoFinish(); location.replace(next); }
    catch (e) { console.error(e); location.replace(next + (next.includes("?") ? "&" : "?") + "login_error=kakao"); }
    return;
  }
  const join = (qs.get("join") || "").replace(/[^A-Za-z0-9]/g, "");
  if (join) ls.set("mb-join", join);
  const { data: { session } } = await sb.auth.getSession();
  S.session = session;
  const code = ls.get("mb-join");
  if (!session) {
    if (code) { const { data } = await sb.rpc("team_by_code", { p_code: code }); S.inviteTeam = data && data[0] ? data[0].name : ""; S.flow = S.inviteTeam ? "invite" : "login"; if (!S.inviteTeam) ls.set("mb-join", null); }
    else S.flow = "login";
    render(); return;
  }
  S.uid = session.user.id;
  // 알림을 눌러 들어오면 그 알림의 팀으로 연다
  const qt = (qs.get("team") || "").toLowerCase(); if (/^[0-9a-f-]{36}$/.test(qt)) { ls.set("mb-team", qt); picked.set(); }
  pushInit(sb);
  if (qs.get("view") === "member") setView("member"); else if (qs.get("view") === "admin") setView("admin");
  ls.set("mb-view", null);
  if (location.search) history.replaceState(null, "", APP + location.hash);
  try { await Promise.all([loadTeams(), loadMyReqs()]); } catch (e) { $("#app").innerHTML = `<div class="loading">팀 정보를 불러오지 못했어요. 네트워크를 확인하고 새로고침해 주세요.</div>`; return; }
  if (code) {
    ls.set("mb-join", null);
    const { data } = await sb.rpc("team_by_code", { p_code: code }); const t = data && data[0];
    if (!t) toast("초대 링크가 바뀌었거나 잘못됐어요. 운영진에게 새 링크를 받아 주세요");
    else if (!S.teams.some(x => x.id === t.id)) {
      if ((S.myReqs || []).some(r => r.team_id === t.id && r.status === "pending")) return startJoinWait();
      S.joinCode = code; S.joinTeam = t; S.form = { name: suggestedName(), msg: "" }; S.flow = "joinReq"; render(); return;
    } else return enter(t.id);
  }
  const last = ls.get("mb-team"); const t = S.teams.find(x => x.id === last) || S.teams[0];
  if (!S.teams.length && (S.myReqs || []).length) return startJoinWait();
  // 팀 고르기: 팀이 하나여도 첫 화면으로 열면 먼저 고른다 (초대 링크, 공유받은 주소는 바로)
  if (S.teams.length && !picked.get() && (route() === "/" || route() === "")) return showTeams("entry");
  if (t) return enter(t.id);
  if (isDemo()) return demoEnter(); // 체험 팀이 지워졌으면 새로 만든다
  startCreate();
}
sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") { picked.clear(); location.replace(APP); } });
boot();

// 축구: 대표 포메이션 10개 (자리 이름은 아래 GK에서 위 공격 순서). 풋살: 포메이션 없이 몇 명이 뛸지만 고른다 (formOf)
const FORMS = {
  futsal: {},
  soccer: {
    "4-4-2": ["GK", "LB", "CB", "CB", "RB", "LW", "CM", "CM", "RW", "ST", "ST"],
    "4-3-3": ["GK", "LB", "CB", "CB", "RB", "CDM", "CM", "CM", "LW", "ST", "RW"],
    "4-2-3-1": ["GK", "LB", "CB", "CB", "RB", "CDM", "CDM", "LW", "CAM", "RW", "ST"],
    "4-1-4-1": ["GK", "LB", "CB", "CB", "RB", "CDM", "LW", "CM", "CM", "RW", "ST"],
    "4-4-1-1": ["GK", "LB", "CB", "CB", "RB", "LW", "CM", "CM", "RW", "CAM", "ST"],
    "4-1-2-1-2": ["GK", "LB", "CB", "CB", "RB", "CDM", "CM", "CM", "CAM", "ST", "ST"],
    "3-5-2": ["GK", "CB", "CB", "CB", "LB", "CM", "CDM", "CM", "RB", "ST", "ST"],
    "3-4-3": ["GK", "CB", "CB", "CB", "LB", "CM", "CM", "RB", "LW", "ST", "RW"],
    "5-3-2": ["GK", "LB", "CB", "CB", "CB", "RB", "CM", "CDM", "CM", "ST", "ST"],
    "5-4-1": ["GK", "LB", "CB", "CB", "CB", "RB", "LW", "CDM", "CDM", "RW", "ST"]
  }
};
// 고를 수 있는 축구 포메이션 6개 (아마추어, 동호인 리그에서 많이 쓰는 것). 예전에 저장한 다른 포메이션 라인업도 그대로 보이도록 FORMS에는 10개를 남겨 둔다
const PICK = ["4-4-2", "4-2-3-1", "4-3-3", "4-4-1-1", "4-1-2-1-2", "3-5-2"];
const FORM_DESC = { "4-4-2": "수비 4, 미드 4, 공격 2", "4-3-3": "수비형 미드 1, 윙어 2", "4-2-3-1": "수비형 미드 2, 공격형 미드 1", "4-1-4-1": "수비형 미드 1, 미드 4, 공격 1", "4-4-1-1": "미드 4, 공격형 미드 1, 공격 1", "4-1-2-1-2": "4-4-2 다이아몬드", "3-5-2": "센터백 3, 측면 2, 공격 2", "3-4-3": "센터백 3, 윙백 2, 공격 3", "5-3-2": "수비 5, 미드 3, 공격 2", "5-4-1": "수비 5, 미드 4, 공격 1" };
const FUTSAL_N = [3, 4, 5, 6, 7, 8, 9, 10, 11];
const LINE = p => isKeeper(p) ? 0 : ["DF", "LB", "CB", "RB"].includes(p) ? 1 : ["LWB", "RWB", "CDM", "MF", "CM", "LM", "RM"].includes(p) ? 2 : p === "CAM" ? 3 : 4;
// 경기장 줄: 축구는 포메이션 숫자대로(4-2-3-1이면 4, 2, 3, 1), 풋살은 필드 선수를 3명씩. 옛 라인업은 자리 이름으로 나눈다
function rowsOf(formation, fkey) {
  const idx = formation.map((pos, i) => ({ pos, i })); const gk = idx.filter(x => isKeeper(x.pos)); const field = idx.filter(x => !isKeeper(x.pos));
  const m = String(fkey || "").match(/^\d(-\d)+/); let sizes = m ? m[0].split("-").map(Number) : null;
  if (!sizes && field.length && field.every(x => x.pos === FIELD)) { sizes = []; for (let n = field.length; n > 0; n -= 3) sizes.push(Math.min(3, n)); }
  if (!sizes || sizes.reduce((a, b) => a + b, 0) !== field.length) return [4, 3, 2, 1, 0].map(ln => idx.filter(x => LINE(x.pos) === ln)).filter(r => r.length);
  const rows = []; let at = 0; sizes.forEach(n => { rows.push(field.slice(at, at + n)); at += n; });
  return [...rows.reverse(), gk].filter(r => r.length);
}
function curLineup(e, side) { return (S.form.lineup && S.form.lineupFor === e.id + side) ? S.form.lineup : ((e.lineup || {})[side] || null); }
function vRest(id) {
  const e = S.events[id]; if (!e || !(isAdmin() && viewMode() === "admin")) return vLineup(id); const side = e.type === "scrim" ? UI.side : "main"; const L = curLineup(e, side); const qn = QN[sport()];
  const ps = lineupPlayers(e, side); const cnt = {}; if (L) Object.values(L.q || {}).forEach(q => Object.values(q).forEach(u => { cnt[u] = (cnt[u] || 0) + 1; }));
  const posOf = (u, k) => { const q = (L && L.q && L.q[k]) || {}; const i = Object.keys(q).find(x => q[x] === u); return i != null ? L.formation[i] : ""; };
  return `${top("휴식표", "#/lineup/" + id)}<div class="body"><div class="card" style="overflow-x:auto;padding:12px"><table style="border-collapse:collapse;width:100%;font-size:12px;text-align:center"><thead><tr><th style="text-align:left;padding:8px">선수</th>${Array.from({ length: qn }, (_, i) => `<th style="padding:8px">${i + 1}Q</th>`).join("")}<th style="padding:8px">출전</th></tr></thead><tbody>
    ${ps.slice().sort((x, y) => (cnt[y.uid] || 0) - (cnt[x.uid] || 0)).map(p => `<tr style="border-top:1px solid #F3F4F6;${p.uid === S.uid ? "font-weight:900" : ""}"><td style="text-align:left;padding:8px 8px;white-space:nowrap">${esc(p.name)}</td>${Array.from({ length: qn }, (_, i) => { const ps2 = posOf(p.uid, i + 1); return `<td style="padding:4px"><span style="display:inline-block;min-width:34px;border-radius:8px;padding:4px 4px;font-size:12px;font-weight:700;${ps2 ? "background:#DCFCE7;color:#166534" : "background:#F3F4F6;color:#9CA3AF"}">${ps2 || "휴식"}</span></td>`; }).join("")}<td><b>${cnt[p.uid] || 0}</b></td></tr>`).join("")}
  </tbody></table></div><span class="hint">쿼터마다 ${L ? L.formation.length : 0}명이 뛰어요. ${sport() === "futsal" ? "골레이로" : "GK"}는 계속 뛰고, 나머지는 고르게 쉬어요.</span></div>`;
}

// member.js와 admin.js가 같이 쓰는 것
onPCChange(() => render());
export { MBRAND, held, attended, checkTaken, KITS, isKit, kitHex, onKit, teamKit, kitClash, recKitFor, kitSideOf, gkKitOf, JPATH, jerseyIcon, kitPicker, PICK, fitOf, isCanceled, isDemo, maintLocked, scheduleRender, backHref, delDoc, FUTSAL_N, loadReqs, ls, APP, route, viewMode, fineAt, fineNow, fineText, lateCancel, spotXY, delSheet, curLineup, lineupPlayers, draftOf, formOf, autoLineup, FORMS, FORM_DESC, applyFix, qText, rowsOf, loadTeam, enter, showTeams, inviteUrl, policyFromForm as polFromForm, posFix, profileOf, refreshTally, hmK, promotedAt, ampm, closeAt, voteTimeOf, $, D, KIT, LOGO, POS, QN, ROLE, S, UI, att, cameTo, canKick, closeSheet, closeText, confirmBox, dotDate, esc, evName, evStart, eventCard, fail, feeMode, finesOf, guestReqs, guestsOf, ini, isAdmin, isPlay, jersey, joinedOf, lateRow, mLabel, md, momClosed, momDeadline, momOpen, momWinners, monthsList, myProfile, myUv, myVote, nameOf, nav, noticeCard, noticesList, paidOf, parseRoster, past, patchDoc, people, qs, refreshMembers, remindInfo, render, ruleAmt, ruleKind, sb, scrimReady, setDoc, setView, sheet, sport, started, syncMyDues, toast, todayStr, top, uid36, unclaimed, upcoming, voteRow, voteState, wd, won, ym };
