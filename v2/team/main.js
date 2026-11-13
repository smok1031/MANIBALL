// 매니볼 실제 앱: 로그인, 팀, 초대, 선수, 일정과 참석, 현장 출석과 벌금, 회비, 기록과 MOM, 공지와 설문, 용병, 라인업, 내전
// 서버는 Supabase(teams, members, docs). 예시 데이터는 없다.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "../../src/config.js";
import { memberRoute, memberForm, MACT } from "./member.js";
import { planLineup, canPlay, pinRows, FIELD, isKeeper } from "./lineup-core.js";
import { vSpend, vUpload, vRulesEdit, vUniform, vPlayerAdmin, AACT3, adminForm, vCheckDone, AACT2, vNotifyAdmin, vCalendarAdmin, vGuests, vScrim, eventFormInit, AACT1, playerSheet, remindLeft, remindSheet, rosterSheet, vCheck, vDues, vDuesSettings, vEvent, vEventForm, vGame, vHomeAdmin, vLedger, vNoticeNew, vPlayers, vPosReq, vRecords, vResult, vRosterImport, vSchedule, vSquad } from "./admin.js";

const URL_ = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL;
const KEY_ = import.meta.env.VITE_SUPABASE_KEY || SUPABASE_KEY;
const sb = createClient(URL_, KEY_, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
const KAKAO_KEY = "e5c9ffdb309018215f5fcbc89eddb201"; // REST API 키 (공개 값)
const APP = location.origin + location.pathname.replace(/index\.html$/, "");
const KAKAO_REDIRECT = new URL("../../", APP).href; // 카카오에 등록된 주소: 사이트 첫 주소가 이 화면으로 넘겨준다
const KK = "kei-web-kakao";
const qs = new URLSearchParams(location.search);
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* 없어도 된다 */ } } };
const WD = "일월화수목금토";
// 풋살 포지션: 골레이로(골키퍼), 픽소(수비), 아라(측면), 피보(공격)
const POS = { futsal: ["골레이로", "픽소", "아라", "피보"], soccer: ["GK", "LB", "LWB", "CB", "RB", "RWB", "CDM", "CM", "LM", "RM", "CAM", "LW", "RW", "ST"] };
const QN = { futsal: 8, soccer: 4 };
const ROLE = { owner: "팀장", admin: "운영진", member: "팀원" };
const KIT = [["#164F33", "초록"], ["#111827", "검정"], ["#1E3A8A", "파랑"], ["#991B1B", "빨강"], ["#F5B841", "노랑"], ["#F3F4F6", "흰색"]];
const numColor = c => ["#F5B841", "#F3F4F6"].includes(c) ? "#111827" : "#FFFFFF";

const S = { d: {}, session: null, uid: "", teams: [], tid: "", role: "", team: null, members: [], invite: "", settings: {}, events: {}, rsvp: {}, ready: false, flow: "", form: {}, ch: null };
// 운영진 화면과 팀원 화면은 따로 그린다. 운영진도 "팀원 화면 보기"로 자기 참석과 카드를 본다
// 운영진은 운영진 화면만 쓴다. 팀원 화면 검토용 주소(?view=member)로 들어올 때만 이 창에서 팀원 화면을 보여 준다
const ss = { get: k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) { /* 없어도 된다 */ } } };
const viewMode = () => (isAdmin() && ss.get("mb-review") !== "member") ? "admin" : "member";
function setView(v) { ss.set("mb-review", v === "member" ? "member" : null); }
const isAdmin = () => S.role === "owner" || S.role === "admin";

/* ---------- 작은 도구 ---------- */
let toastT = 0;
function toast(m) { const l = $("#layer"); let t = l.querySelector(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); l.appendChild(t); } t.textContent = m; clearTimeout(toastT); toastT = setTimeout(() => t.remove(), 2600); }
function sheet(html) { $("#layer").innerHTML = `<div class="scrim" data-act="closeSheet"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`; }
function closeSheet() { $("#layer").innerHTML = ""; }
function confirmBox(title, msg, ok, fn, danger) {
  sheet(`<h3>${esc(title)}</h3><div class="hint">${esc(msg)}</div><div class="row"><button class="btn block" data-act="closeSheet">취소</button><button class="btn block ${danger ? "danger" : "pri"}" id="okBtn">${esc(ok)}</button></div>`);
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
  S.teams = mem.map(m => ({ id: m.team_id, role: m.role, name: names[m.team_id] || "팀" }));
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
  if (isAdmin()) S.invite = await getInvite(tid);
  ls.set("mb-team", tid);
  watch(tid);
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
    put(n.coll, n.id, n.data); render();
  };
  S.ch = sb.channel("mb-" + tid)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "docs", filter: "team_id=eq." + tid }, onDoc)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "docs", filter: "team_id=eq." + tid }, onDoc)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "members", filter: "team_id=eq." + tid }, refreshMembers)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "members", filter: "team_id=eq." + tid }, refreshMembers)
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
async function setDoc(c, id, data) {
  const { error } = await sb.from("docs").upsert({ team_id: S.tid, coll: c, id, data }, { onConflict: "team_id,coll,id" });
  if (error) throw error; put(c, id, data);
}
async function patchDoc(c, id, patch) {
  const exists = c === "rsvp" ? !!S.rsvp[id] : c === "events" ? !!S.events[id] : c === "team" ? (id === "settings" || !!D("team")[id]) : !!D(c)[id];
  if (!exists) { await setDoc(c, id, patch); return; }
  const { data, error } = await sb.rpc("doc_patch", { p_team: S.tid, p_coll: c, p_id: id, p_patch: patch });
  if (error) throw error; put(c, id, data.data);
}
async function delDoc(c, id) { const { error } = await sb.from("docs").delete().eq("team_id", S.tid).eq("coll", c).eq("id", id); if (error) throw error; drop(c, id); }
const GUARD = { vote_closed: "경기가 시작돼서 바꿀 수 없어요", no_event: "지워진 일정이에요", bad_vote: "저장할 수 없는 응답이에요", team_limit: "팀은 한 사람당 5개까지 만들 수 있어요", bad_code: "초대 링크가 바뀌었거나 잘못됐어요. 운영진에게 새 링크를 받아 주세요", mom_locked: "MOM 투표는 한 번만 낼 수 있어요", mom_closed: "MOM 투표 시간이 아니에요", no_player: "팀에 없는 사람이에요", poll_closed: "마감된 설문이에요", no_option: "없는 보기예요", no_poll: "지워진 설문이에요", owner_only: "팀장만 할 수 있어요", not_self: "나에게는 할 수 없어요", not_allowed: "운영진만 할 수 있어요", owner_has_members: "팀원이 남아 있어서 먼저 팀장을 넘겨야 해요" };
function fail(e) { const m = errMsg(e); const k = Object.keys(GUARD).find(x => m.includes(x)); toast(k ? GUARD[k] : /JWT|fetch|network/i.test(m) ? "연결이 끊겼어요. 잠시 후 다시 해 주세요" : "저장하지 못했어요. 잠시 후 다시 해 주세요"); console.error(e); }

/* ---------- 사람과 참석 ---------- */
// 예전 풋살 포지션 이름(GK, DF, LW, RW, FW)으로 저장된 팀원은 풋살 이름으로 보여 준다
const FUT_OLD = { GK: "골레이로", DF: "픽소", LW: "아라", RW: "아라", MF: "아라", FW: "피보" };
const posFix = x => sport() === "futsal" && FUT_OLD[x] ? FUT_OLD[x] : x;
const profileOf = u => { const p = (S.rsvp[u] && S.rsvp[u].profile) || null; if (!p || sport() !== "futsal") return p; const a = posFix(p.pos1), b = posFix(p.pos2); return { ...p, pos1: a, pos2: b === a ? "" : b }; };
const myProfile = () => profileOf(S.uid);
const nameOf = u => (profileOf(u) && profileOf(u).name) || (S.members.find(m => m.user_id === u) || {}).display_name || "이름 없음";
const people = () => S.members.map(m => ({ uid: m.user_id, role: m.role, name: nameOf(m.user_id), p: profileOf(m.user_id) || {} }));
function att(e) {
  const out = { yes: [], late: [], no: [], none: [], wait: [], cap: Number(e.cap) || 0 };
  const going = [];
  people().forEach(x => {
    const r = ((S.rsvp[x.uid] || {}).ev || {})[e.id];
    const s = r && r.s;
    if (s === "yes" || s === "late") going.push({ ...x, s, q: Number(r.q) || 0, at: r.at || "" });
    else if (s === "no") out.no.push(x); else out.none.push(x);
  });
  going.sort((a, b) => (a.at || "~") < (b.at || "~") ? -1 : 1);
  going.forEach((x, i) => { if (out.cap && i >= out.cap) out.wait.push(x); else (x.s === "late" ? out.late : out.yes).push(x); });
  out.in = out.yes.length + out.late.length;
  return out;
}
const myVote = e => (((S.rsvp[S.uid] || {}).ev || {})[e.id]) || {};
// 투표 마감: 경기 시작 전까지(기본), 경기 전날 21시, 경기 당일 6시. 열림 예약(openAt) 전에는 누를 수 없다
function closeAt(e) { if (e.voteClose === "eve21") return new Date(e.date + "T21:00:00+09:00").getTime() - 864e5; if (e.voteClose === "day06") return new Date(e.date + "T06:00:00+09:00").getTime(); return evStart(e); }
const voteState = e => started(e) ? "done" : (e.openAt && Date.now() < Date.parse(e.openAt)) ? "soon" : Date.now() >= closeAt(e) ? "closed" : "open";
const closeText = e => e.voteClose === "eve21" ? "경기 전날 21:00 마감" : e.voteClose === "day06" ? "경기 당일 06:00 마감" : "경기 시작 전까지";
// 동그라미 안 글자: 괄호 같은 기호는 건너뛴다
const ini = n => (String(n || "").replace(/[^0-9A-Za-z\uAC00-\uD7A3]/g, "")[0] || "?");
const upcoming = () => Object.values(S.events).filter(e => !started(e) || (Date.now() - evStart(e)) < 3 * 3600e3).sort((a, b) => evStart(a) - evStart(b));
const past = () => Object.values(S.events).filter(e => started(e)).sort((a, b) => evStart(b) - evStart(a));

/* ---------- 화면 조각 ---------- */
const BACK = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"></path></svg>`;
const LOGO = s => `<span role="img" aria-label="매니볼" style="width:${s}px;height:${s}px;border-radius:${Math.round(s * .28)}px;background:#1E6B45;display:inline-flex;align-items:center;justify-content:center;flex:none;box-shadow:0 0 0 1px rgba(255,255,255,.25)"><svg width="${Math.round(s * .75)}" height="${Math.round(s * .75)}" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="22" fill="none" stroke="#FFFFFF" stroke-width="5"></circle><circle cx="23" cy="26" r="3.5" fill="#F5B841"></circle><circle cx="23" cy="38" r="3.5" fill="#F5B841"></circle><path d="M30 26 H43 M30 38 H41" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round"></path></svg></span>`;
const KAKAO = `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3.5c-5 0-9 3.1-9 7 0 2.5 1.7 4.7 4.2 5.9l-1 3.6c-.1.3.3.6.6.4l4.2-2.8c.3 0 .7.1 1 .1 5 0 9-3.1 9-7s-4-7.2-9-7.2z"/></svg>`;
function jersey(size, num, color) {
  return `<span style="position:relative;width:${size}px;height:${size}px;display:inline-flex;align-items:center;justify-content:center;flex:none"><svg width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true"><path d="M30 12 L40 8 Q50 17 60 8 L70 12 L93 27 L84 45 L74 40 L74 92 Q50 97 26 92 L26 40 L16 45 L7 27 Z" fill="${esc(color || "#164F33")}"></path><path d="M40 8 Q50 21 60 8" fill="none" stroke="#F5B841" stroke-width="3"></path><path d="M7 27 L16 45 M93 27 L84 45" stroke="#F5B841" stroke-width="3"></path></svg><b data-live="num" style="position:absolute;left:0;right:0;top:40%;text-align:center;color:${numColor(color || "#164F33")};font-size:${Math.round(size * .29)}px;font-weight:900;line-height:1;letter-spacing:-2px">${esc(num || "")}</b></span>`;
}
const top = (title, back, right) => `<header class="top">${back ? `<a class="iconbtn" href="${back}" aria-label="뒤로">${BACK}</a>` : `<span style="width:8px"></span>`}<h1>${esc(title)}</h1>${right || ""}</header>`;
function nav(on) {
  const t = [["#/", "홈"], ["#/schedule", "일정"], ["#/records", "기록"], ["#/dues", "회비"], ["#/players", "선수"]];
  return `<nav class="nav" aria-label="하단 메뉴">${t.map(([h, l]) => `<a href="${h}" class="${on === l ? "on" : ""}"${on === l ? ' aria-current="page"' : ""}>${l}</a>`).join("")}</nav>`;
}
function eventCard(e, opts = {}) {
  const a = att(e); const v = myVote(e); const mine = !!myProfile();
  const closed = started(e);
  const sub = e.type === "match" ? (e.opponent ? "vs " + e.opponent : "상대팀 미정") : e.type === "scrim" ? "내전 (A팀 대 B팀)" : "훈련";
  return `<div class="card">
    <a href="#/event/${esc(e.id)}" style="text-decoration:none;color:inherit;display:flex;gap:12px;align-items:center">
      <span class="datebox ${closed ? "gray" : ""}"><span>${wd(e.date)}</span><b>${Number(e.date.slice(8, 10))}</b></span>
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px"><span class="row" style="gap:6px"><span class="tag ${e.type === "training" ? "blue" : ""}">${e.type === "match" ? "경기" : e.type === "scrim" ? "내전" : "훈련"}</span><b style="font-size:16px">${esc(e.time || "")}${e.end ? " ~ " + esc(e.end) : ""}</b></span><span class="hint">${esc(e.place || "장소 미정")}, ${esc(sub)}</span></span>
      <span class="hint" style="flex:none">${dLabel(e)}</span>
    </a>
    <div class="spread hint"><span>참석 <b style="color:#111827">${a.in}</b>${a.cap ? " / 정원 " + a.cap : ""}${a.wait.length ? ", 대기 " + a.wait.length : ""}</span><span>미응답 ${a.none.length}</span></div>
    ${mine && !closed && !opts.noVote ? voteRow(e, v) : ""}
    ${mine && v.s === "late" && !closed && !opts.noVote ? lateRow(e, v) : ""}
  </div>`;
}
function voteRow(e, v) {
  const b = (s, l) => `<button class="vote ${v.s === s ? "on " + s : ""}" data-act="vote" data-eid="${esc(e.id)}" data-v="${s}" aria-pressed="${v.s === s}">${l}</button>`;
  return `<div class="seg3">${b("yes", "참석")}${b("late", "늦참")}${b("no", "불참")}</div>`;
}
function lateRow(e, v) {
  const n = QN[sport()];
  return `<div class="field"><span class="hint">몇 쿼터부터 뛸 수 있어요?</span><div class="chips">${Array.from({ length: n - 1 }, (_, i) => i + 2).map(q => `<button class="chip sm ${Number(v.q) === q ? "on" : ""}" data-act="lateQ" data-eid="${esc(e.id)}" data-q="${q}">${q}Q부터</button>`).join("")}</div></div>`;
}

/* ---------- 로그인 전 ---------- */
function vLogin(err) {
  return `<div class="hero" style="flex:1;display:flex;flex-direction:column;padding:56px 24px 32px;gap:28px">
    <div class="row" style="gap:12px">${LOGO(48)}<span style="display:flex;flex-direction:column;line-height:1.1"><b style="font-size:26px;font-weight:900">매니볼</b><span style="font-size:11px;letter-spacing:3px;color:#BBF7D0;font-weight:700">MANIBALL</span></span></div>
    <h1 style="margin:0;font-size:34px;line-height:1.25;font-weight:900;letter-spacing:-1px">운영진이 매주<br>손으로 하던 일,<br><span style="color:#F5B841">이제 앱이 해요</span></h1>
    <p style="margin:0;color:#D1FAE5;line-height:1.6">참석 집계, 라인업, 출석과 벌금, 회비까지 링크 하나로.</p>
    <div style="margin-top:auto;display:flex;flex-direction:column;gap:10px">
      ${err ? `<div class="err" role="alert">로그인하지 못했어요. 다시 시도해 주세요.</div>` : ""}
      <button class="btn kakao block" data-act="kakao">${KAKAO}카카오로 시작하기</button>
      <span style="font-size:12px;color:#BBF7D0;text-align:center">로그인하면 <a href="../../privacy.html" style="color:#FFFFFF">개인정보처리방침과 이용약관</a>에 동의하는 것으로 봐요</span>
    </div></div>`;
}
function vInvite(teamName, err) {
  return `<div class="body" style="padding:40px 20px;gap:20px">
    <div class="row" style="gap:10px">${LOGO(36)}<b style="font-size:18px">매니볼</b></div>
    <div class="card" style="align-items:center;text-align:center;padding:28px 16px;gap:10px">
      <span class="av" style="width:64px;height:64px;font-size:24px;background:#1E6B45;color:#FFFFFF">${esc(String(teamName || "팀").slice(0, 1))}</span>
      <b style="font-size:22px">${esc(teamName || "팀")}</b>
      <span class="hint">팀 초대를 받았어요. 카카오로 로그인하면 바로 팀원이 돼요.</span>
    </div>
    <div class="card"><div class="list">${[["카카오로 로그인", "비밀번호 없이 바로 들어와요"], ["선수 등록", "명단에서 내 이름을 고르거나 이름, 등번호, 포지션을 적어요"], ["팀 수칙 동의", "벌금 규칙과 회비 안내"]].map(([a, b], i) => `<div class="li"><span class="av" style="width:32px;height:32px">${i + 1}</span><span style="flex:1"><b>${a}</b><br><span class="hint">${b}</span></span></div>`).join("")}</div><span class="hint" style="text-align:center">1분이면 끝나요</span></div>
    ${err ? `<div class="err" role="alert">로그인하지 못했어요. 다시 시도해 주세요.</div>` : ""}
    <button class="btn kakao block" data-act="kakao">${KAKAO}카카오로 시작하기</button>
    <span class="hint" style="text-align:center">처음 한 번만 하면 다음부터는 바로 들어와요. 앱 설치는 필요 없어요. <a href="../../privacy.html">개인정보처리방침과 이용약관</a></span>
  </div>`;
}

/* ---------- 팀 만들기 ---------- */
function vCreate(edit) {
  const f = S.form;
  const chip = (k, v, l) => `<button class="chip ${f[k] === v ? "on" : ""}" data-act="pick" data-k="${k}" data-v="${v}">${l}</button>`;
  const days = ["1", "5", "10", "25", "말일"];
  return `${top(edit ? "팀 설정" : "팀 만들기", edit ? "#/players" : S.teams.length ? "#/" : "")}<div class="body">
    <div class="card">
      <label class="field"><span class="lab">팀 이름</span><input class="inp" data-bind="name" value="${esc(f.name || "")}" maxlength="40" placeholder="예: 번개 FS" autocomplete="off"></label>
      <div class="field"><span class="lab">종목</span><div class="chips">${chip("sport", "futsal", "풋살팀")}${chip("sport", "soccer", "축구팀")}</div></div>
    </div>
    <div class="card">
      <div class="field"><span class="lab">회비</span><div class="chips">${chip("feeMode", "monthly", "월회비")}${chip("feeMode", "per_game", "경기마다")}${chip("feeMode", "none", "안 받음")}</div></div>
      ${f.feeMode !== "none" ? `<label class="field"><span class="lab">금액</span><input class="inp" data-bind="fee" inputmode="numeric" value="${esc(f.fee || "")}" placeholder="예: 30000"></label>` : ""}
      ${f.feeMode === "monthly" ? `<div class="field"><span class="lab">납부일</span><div class="chips">${days.map(d => chip("dueDay", d, d === "말일" ? "말일" : d + "일")).join("")}</div></div>` : ""}
    </div>
    <div class="card">
      <div class="spread"><span class="lab">팀 수칙</span><span class="hint">벌금은 비워 둬도 돼요</span></div>
      ${(f.rules || []).map((r, i) => `<div class="row"><input class="inp" data-rule="${i}" data-f="label" value="${esc(r.label)}" placeholder="예: 지각 (킥오프 10분 전 기준)" aria-label="수칙 ${i + 1}" style="flex:1"><input class="inp" data-rule="${i}" data-f="amount" value="${esc(r.amount || "")}" inputmode="numeric" placeholder="벌금" aria-label="수칙 ${i + 1} 벌금" style="width:96px;flex:none"><button class="iconbtn" data-act="ruleDel" data-i="${i}" aria-label="수칙 ${i + 1} 지우기">✕</button></div>`).join("")}
      <button class="btn" data-act="ruleAdd">+ 수칙 추가</button>
    </div>
    <div class="card"><span class="lab">유니폼 색</span><div class="row" style="gap:12px">${jersey(64, "7", f.kit)}<div class="chips">${KIT.map(([c, l]) => `<button class="chip sm ${f.kit === c ? "on" : ""}" data-act="pick" data-k="kit" data-v="${c}">${l}</button>`).join("")}</div></div><span class="hint">팀원 홈의 유니폼 카드에 이 색으로 보여요.</span></div>
    ${edit && S.role === "owner" ? `<button class="btn danger" data-act="delTeam">팀 지우기</button>` : ""}
  </div><div class="cta">${edit ? `<button class="btn pri block" data-act="saveSettings">저장</button>` : `<button class="btn pri block" data-act="createTeam">팀 만들기</button><span class="hint" style="text-align:center">설정은 나중에 바꿀 수 있어요</span>`}</div>`;
}

/* ---------- 선수 등록, 수칙 동의 ---------- */
function vProfile(editing) {
  const f = S.form; const pos = POS[sport()];
  const pchip = (k, v) => `<button class="chip ${f[k] === v ? "on" : ""}" data-act="pick" data-k="${k}" data-v="${v}">${v}</button>`;
  const nick = suggestedName();
  return `${top(editing ? "프로필 수정" : "선수 등록 1/2", editing ? "#/" : "")}<div class="body">
    ${!editing && nick ? `<div class="hint" style="background:#F0FDF4;color:#166534;border-radius:12px;padding:10px 12px">카카오 로그인이 끝났어요. 닉네임 ${esc(nick)}을(를) 불러왔어요.</div>` : ""}
    <div class="hero" style="border-radius:20px;padding:20px;display:flex;align-items:center;gap:16px">
      ${jersey(96, f.num, S.settings.uniformColor)}
      <span style="display:flex;flex-direction:column;gap:6px;min-width:0"><b data-live="name" style="font-size:22px;font-weight:900">${esc(f.name || "이름")}</b><span style="font-size:13px;color:#BBF7D0">${esc(S.team ? S.team.name : "")}</span><span class="row" style="gap:6px"><span class="pill" style="background:#FFFFFF;color:#1E6B45;font-size:13px"><span style="opacity:.7">1선호</span><b>${esc(f.pos1 || "-")}</b></span>${f.pos2 ? `<span class="pill" style="background:rgba(255,255,255,.16);color:#FFFFFF;font-size:13px"><span style="opacity:.7">2선호</span><b>${esc(f.pos2)}</b></span>` : ""}</span></span>
    </div>
    <div class="card">
      <label class="field"><span class="lab">팀에서 부를 이름</span><input class="inp" data-bind="name" data-live-src="name" value="${esc(f.name || "")}" maxlength="20" placeholder="예: 이서준"></label>
      <label class="field"><span class="lab">등번호</span><input class="inp" data-bind="num" data-live-src="num" value="${esc(f.num || "")}" inputmode="numeric" maxlength="3" placeholder="예: 7"></label>
      ${(() => { const taken = new Set(people().filter(x => x.uid !== S.uid).map(x => String(x.p.num || "")).concat(unclaimed().map(x => String(x.num || "")))); const free = []; for (let i = 1; i <= 99 && free.length < 8; i++) if (!taken.has(String(i))) free.push(i); return taken.has(String(f.num || "-")) ? `<span class="err">다른 팀원이 쓰는 번호예요</span>` : `<span class="hint">비어 있는 번호 ${free.join(", ")}</span>`; })()}
      <div class="field"><span class="lab">1선호 포지션</span><div class="chips">${pos.map(p => pchip("pos1", p)).join("")}</div></div>
      <div class="field"><span class="lab">2선호 포지션</span><div class="chips">${pos.filter(p => p !== f.pos1).map(p => pchip("pos2", p)).join("")}<button class="chip ${!f.pos2 ? "on" : ""}" data-act="pick" data-k="pos2" data-v="">없음</button></div></div>
      <div class="field"><span class="lab">주발</span><div class="chips">${["오른발", "왼발", "양발"].map(x => pchip("foot", x)).join("")}</div></div>
    </div>
  </div><div class="cta"><button class="btn pri block" data-act="saveProfile">${editing ? "저장" : "다음"}</button></div>`;
}
function vRules() {
  const rules = S.settings.rules || []; const st = S.settings; const bk = st.bank || {};
  return `${top("팀 수칙 2/2", "")}<div class="body">
    <div class="card"><b style="font-size:18px">${esc(S.team ? S.team.name : "")} 수칙이에요</b><span class="hint">읽고 동의하면 바로 시작해요.</span>
      <span class="lab">벌금과 수칙</span>${rules.length ? `<div class="list">${rules.map(r => `<div class="li"><span style="flex:1">${esc(r.label)}</span>${Number(r.amount) ? `<b>${won(r.amount)}</b>` : `<span class="hint">글 수칙</span>`}</div>`).join("")}</div>` : `<span class="hint">아직 정한 수칙이 없어요.</span>`}
      ${st.feeMode && st.feeMode !== "none" ? `<span class="lab">회비</span><div style="background:#F9FAFB;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:4px"><b>${won(st.fee)}${st.feeMode === "per_game" ? " / 경기" : " / 월" + (st.dueDay ? ", 매월 " + st.dueDay + "일까지" : "")}</b>${bk.account ? `<span class="hint">${esc([bk.bank, bk.holder ? "예금주 " + bk.holder : ""].filter(Boolean).join(", "))}</span>` : ""}</div>` : ""}
      <label class="row" style="gap:10px;min-height:44px;cursor:pointer"><input type="checkbox" data-bind="agreeChk" ${S.form.agreeChk ? "checked" : ""} style="width:22px;height:22px;accent-color:#15803D"><b>수칙을 읽었고 지킬게요</b></label>
    </div>
    <span class="hint" style="text-align:center">수칙이 바뀌면 알림으로 알려 드려요</span>
  </div><div class="cta"><button class="btn pri block" data-act="agree">${esc(S.team ? S.team.name : "")} 시작하기</button></div>`;
}

/* ---------- 초대 ---------- */
const inviteUrl = () => S.invite ? APP + "?join=" + S.invite : "";
function vInviteMsg() {
  const msg = S.form.msg ?? `${S.team ? S.team.name : "우리 팀"} 팀 관리 앱이에요. 링크 누르고 카카오로 로그인하면 끝! 이제 참석은 여기서 눌러 주세요.`;
  return `${top("팀원 초대하기", "#/")}<div class="body">
    <div class="card"><span class="lab">단톡방에 올릴 문구</span><textarea class="inp" data-bind="msg" aria-label="초대 문구">${esc(msg)}</textarea>
      <div class="spread" style="border:1px solid #E5E7EB;border-radius:12px;padding:12px"><span style="font-size:14px;word-break:break-all">${esc(inviteUrl() || "링크를 만드는 중이에요")}</span><button class="btn sm" data-act="copyLink">복사</button></div>
      <span class="hint">이 링크로 들어온 사람은 팀원이 돼요. 링크가 엉뚱한 곳에 퍼졌으면 새 링크를 만들어 예전 링크를 막아요.</span>
      <button class="btn sm" data-act="newCode" style="align-self:flex-start">새 링크 만들기</button>
    </div>
  </div><div class="cta"><button class="btn kakao block" data-act="share">${KAKAO}카카오톡 단톡방에 보내기</button><a class="btn block" href="#/">완료</a></div>`;
}

/* ---------- 홈 ---------- */
function seasonStats(u) {
  const year = todayStr().slice(0, 4);
  const evs = past().filter(e => e.date.startsWith(year));
  const mine = evs.filter(e => cameTo(e, u)).length;
  const mom = evs.filter(momClosed).filter(e => momWinners(e).includes(u)).length;
  return { n: evs.length, mine, mom, rate: evs.length ? Math.round(mine * 100 / evs.length) : 0 };
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
const ruleKind = r => r.kind || (/지각/.test(r.label) ? "late" : /결석/.test(r.label) ? "absent" : /취소/.test(r.label) ? "cancel" : "");
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
    const data = { dues, paidAt, fines: finesOf(u).map(f => ({ id: f.id, date: f.date, eventId: f.eventId || "", reason: f.reason, amount: f.amount, paid: !!f.paid, paidAt: f.paidAt || "" })), fee: Number(S.settings.fee) || 0, mode: feeMode() };
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
  return `${top("공지", "#/", isAdmin() ? `<a class="btn sm pri" href="#/notice-new">+ 공지 쓰기</a>` : "")}<div class="body">${ns.length ? ns.map(n => noticeCard(n, true)).join("") : `<div class="card empty"><b>아직 공지가 없어요</b></div>`}</div>`;
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
  const ps = [...a.yes, ...a.late].map(x => ({ uid: x.uid, name: x.name, from: x.s === "late" ? (x.q || 1) : 1, pos: [x.p.pos1, x.p.pos2] }));
  guestsOf(e).forEach(g => ps.push({ uid: "g:" + g.id, name: g.name + " (용병)", from: 1, pos: [posFix(g.pos)] }));
  return ps;
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
  return { fkey: d.fkey, formation, q: r.q, pins: JSON.parse(JSON.stringify(d.pins)) };
}
const qText = (qs, qn) => qs.length === qn ? "전 쿼터" : qs.slice().sort((a, b) => a - b).join(", ") + "쿼터";
function pinWhy(x, ps) { const p = ps.find(y => y.uid === x.u); const n = p ? p.name : "참석 명단에 없는 선수";
  return x.why === "noslot" ? `${n} ${x.pos}: 이 포메이션에 ${x.pos} 자리가 없어서 빠져요` : x.why === "late" ? `${n}: ${p.from}쿼터부터 와서 ${x.ks.join(", ")}쿼터 지정은 빠져요` : x.why === "gone" ? `${n}: 참석에서 빠져서 지정도 빠져요` : `${n} ${x.pos} ${x.k}쿼터: 자리가 겹쳐서 빠져요`; }
function pinSheet(eid) {
  const e = S.events[eid]; if (!e) return; const side = e.type === "scrim" ? UI.side : "main"; const ps = lineupPlayers(e, side); const d = draftOf(e, side);
  const formation = formOf(d.fkey, curLineup(e, side)); const qn = QN[sport()]; const st = UI.pin; const p = ps.find(x => x.uid === st.u);
  const posList = [...new Set(formation)];
  const qOk = k => { if (!p || !st.pos) return false; if (p.from > k) return false;
    if (d.pins.some(x => x.u === p.uid && x.qs.includes(k))) return false;
    return d.pins.filter(x => x.pos === st.pos && x.qs.includes(k)).length < formation.filter(s => s === st.pos).length; };
  const qWhy = k => !p || !st.pos ? "" : p.from > k ? `${p.from}쿼터부터 와요` : d.pins.some(x => x.u === p.uid && x.qs.includes(k)) ? "이미 지정한 쿼터" : !qOk(k) ? `${st.pos} 자리가 다 찼어요` : "";
  const okQs = Array.from({ length: qn }, (_, i) => i + 1).filter(qOk);
  sheet(`<h3>지정</h3><span class="hint">꼭 그 자리, 그 쿼터에 뛰어야 하는 선수를 정해요. 자동 배치는 지정을 그대로 두고 나머지만 채워요.</span>
    <b style="font-size:14px">1. 선수</b><div class="chips" style="max-height:30vh;overflow:auto">${ps.map(x => `<button class="chip sm ${x.uid === st.u ? "on" : ""}" data-act="pinU" data-u="${esc(x.uid)}">${esc(x.name)} <span style="font-size:11px;opacity:.7">${esc([x.pos[0], x.pos[1]].filter(Boolean).join("/"))}</span></button>`).join("")}</div>
    <b style="font-size:14px">2. 자리</b>${p ? `<div class="chips">${posList.map(x => { const pref = x === FIELD ? "" : p.pos[0] === x ? "1선호" : p.pos[1] === x ? "2선호" : ""; return `<button class="chip sm ${x === st.pos ? "on" : ""}" data-act="pinPos" data-v="${esc(x)}">${esc(x)}${pref ? ` <span style="font-size:11px;opacity:.75">${pref}</span>` : ""}</button>`; }).join("")}</div><span class="hint">${formation.includes(FIELD) ? "골레이로나 필드 중에 골라요" : "1선호, 2선호가 아닌 자리도 지정할 수 있어요. 자동 배치는 1선호, 2선호 자리에만 넣어요"}</span>` : `<span class="hint">선수를 먼저 골라 주세요</span>`}
    <b style="font-size:14px">3. 쿼터</b>${p && st.pos ? `<div class="chips"><button class="chip sm ${okQs.length && okQs.every(k => st.qs.includes(k)) ? "on" : ""}" data-act="pinQ" data-v="all">전체</button>${Array.from({ length: qn }, (_, i) => i + 1).map(k => qOk(k) ? `<button class="chip sm ${st.qs.includes(k) ? "on" : ""}" data-act="pinQ" data-v="${k}">${k}Q</button>` : `<button class="chip sm" disabled style="opacity:.35" title="${esc(qWhy(k))}">${k}Q</button>`).join("")}</div>${Array.from({ length: qn }, (_, i) => i + 1).filter(k => !qOk(k)).length ? `<span class="hint">${Array.from({ length: qn }, (_, i) => i + 1).filter(k => !qOk(k)).map(k => k + "Q " + qWhy(k)).join(", ")}</span>` : ""}` : `<span class="hint">자리를 먼저 골라 주세요</span>`}
    <button class="btn pri" data-act="pinSave" data-eid="${esc(eid)}" ${p && st.pos && st.qs.length ? "" : "disabled"}>${p && st.pos && st.qs.length ? `${esc(p.name)}, ${esc(st.pos)}, ${qText(st.qs, qn)} 지정하기` : "지정하기"}</button><button class="btn" data-act="closeSheet">닫기</button>`);
}
function vLineup(id) {
  const e = S.events[id]; if (!e) return `${top("라인업", "#/schedule")}<div class="body"><div class="card empty"><b>지워진 일정이에요</b></div></div>`;
  const side = e.type === "scrim" ? UI.side : "main"; const L = curLineup(e, side); const edit = isAdmin() && viewMode() === "admin";
  const ps = lineupPlayers(e, side); const qn = QN[sport()]; const k = Math.min(UI.q, qn);
  const nm = u => !u ? "" : u.startsWith("g:") ? (((e.guests || {})[u.slice(2)] || {}).name || "용병") : nameOf(u);
  const cnt = {}; if (L) Object.values(L.q || {}).forEach(q => Object.values(q).forEach(u => { cnt[u] = (cnt[u] || 0) + 1; }));
  const q = (L && L.q && L.q[k]) || {}; const bench = ps.filter(p => !Object.values(q).includes(p.uid));
  const dr = draftOf(e, side); const fkey = (L && L.fkey) || dr.fkey; const fl = L ? L.formation : formOf(fkey) || []; const a = att(e); const fs = sport() === "futsal";
  const rows = L ? rowsOf(L.formation, L.fkey) : [];
  const pinned = (u, pos) => dr.pins.some(x => x.u === u && x.pos === pos && x.qs.includes(k));
  const skipped = pinRows(ps, fl, qn, dr.pins).skipped; const stale = L && JSON.stringify(L.pins || []) !== JSON.stringify(dr.pins);
  const pinCard = !edit ? "" : `<div class="card" style="gap:8px"><div class="spread"><b>지정 ${new Set(dr.pins.map(x => x.u)).size}명</b><button class="btn sm" data-act="pinOpen" data-eid="${esc(e.id)}">+ 지정</button></div>
    <span class="hint">${dr.pins.length ? "자동 배치는 지정을 그대로 두고 나머지만 채워요" : "꼭 그 자리, 그 쿼터에 뛰어야 하는 선수가 있으면 자동 배치 전에 먼저 정해요"}</span>
    ${dr.pins.length ? `<div class="list">${dr.pins.map((x, i) => `<div class="li"><span style="flex:1"><b>${esc((ps.find(y => y.uid === x.u) || {}).name || "참석 명단에 없음")}</b> <span class="hint">${esc(x.pos)}, ${qText(x.qs, qn)}</span></span><button class="btn sm" data-act="pinDel" data-eid="${esc(e.id)}" data-i="${i}">빼기</button></div>`).join("")}</div>` : ""}
    ${skipped.length ? `<div class="err">${Object.values(skipped.reduce((m, x) => { const id = x.u + x.pos + x.why; (m[id] = m[id] || { ...x, ks: [] }).ks.push(x.k); return m; }, {})).map(x => esc(pinWhy(x, ps))).join("<br>")}</div>` : ""}
    ${stale ? `<div class="err">지정을 바꿨어요. 자동 배치를 다시 눌러야 라인업에 들어가요</div>` : ""}</div>`;
  const pOf = u => ps.find(p => p.uid === u);
  const spot = x => { const u = q[x.i]; const sel = UI.sel === x.i; const me = u === S.uid; const off = u && !canPlay(pOf(u), x.pos) && !pinned(u, x.pos);
    return `<button ${edit ? `data-act="lineSpot" data-i="${x.i}"` : "disabled"} style="border:0;background:none;color:#FFFFFF;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:60px;opacity:1"><span style="width:44px;height:44px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:15px;${sel ? "background:#F5B841;color:#1E6B45" : me ? "background:#F5B841;color:#1E6B45" : "background:#FFFFFF;color:#1E6B45"}">${u ? esc(((u.startsWith("g:") ? "" : (profileOf(u) || {}).num) || ini(nm(u)))) : "+"}</span><span style="font-size:12px;font-weight:700">${esc(x.pos)}${u && pinned(u, x.pos) ? ` <span style="font-size:10px;background:#F5B841;color:#1E6B45;border-radius:6px;padding:0 4px;font-weight:900">지정</span>` : ""}</span><span style="font-size:11px;${off ? "background:#B91C1C;border-radius:6px;padding:1px 6px" : "opacity:.9"}">${esc(u ? nm(u) + (off ? " (포지션 아님)" : "") : "빈자리")}</span></button>`; };
  return `${top("라인업" + (edit ? " 짜기" : ""), "#/event/" + e.id, edit && L ? `<button class="btn sm pri" data-act="saveLineup" data-eid="${esc(e.id)}">저장</button>` : "")}<div class="body">
    <div class="card" style="gap:6px"><b>${esc(md(e.date) + " " + wd(e.date) + " " + (e.time || "") + " " + evName(e))}</b><span class="hint">참석 ${a.yes.length}명${a.late.length ? ", 늦참 " + a.late.length + "명" : ""}${guestsOf(e).length ? ", 용병 " + guestsOf(e).length + "명" : ""}</span>
      ${edit && (L || !fs || fl.length) ? `<button class="btn sm" data-act="lineForm" data-eid="${esc(e.id)}" style="align-self:flex-start">${fs ? (futsalN(fkey) ? esc(fkey) : fl.length + "대" + fl.length) : fl.length + "대" + fl.length + ", " + esc(fkey)} ▾</button>` : ""}</div>
    ${edit && fs && !L && !fl.length ? `<div class="card" style="gap:8px"><b>몇 명이 뛰나요?</b><span class="hint">골레이로를 포함한 한 팀 인원이에요. 참석 ${ps.length}명</span><div class="chips">${FUTSAL_N.map(n => `<button class="chip" data-act="lineFormPick" data-eid="${esc(e.id)}" data-k="${n}대${n}">${n}대${n}</button>`).join("")}</div></div>` : pinCard}
    ${e.type === "scrim" ? `<div class="chips"><button class="chip ${side === "A" ? "on" : ""}" data-act="lineSide" data-v="A">A팀 (조끼)</button><button class="chip ${side === "B" ? "on" : ""}" data-act="lineSide" data-v="B">B팀</button></div>` : ""}
    ${!L ? `<div class="card empty"><b>아직 라인업이 없어요</b><span class="hint">${edit ? (fs ? "쿼터별 자리와 휴식을 고르게 짜요." : "포지션에 맞춰 쿼터별 자리와 휴식을 고르게 짜요.") : "운영진이 라인업을 알리면 여기에 보여요."}</span>${edit && fl.length ? `<button class="btn pri" data-act="autoLineup" data-eid="${esc(e.id)}">${fs ? "휴식 자동 배치" : "포지션 맞춰 휴식 자동 배치"}</button>` : ""}</div>` : `
    <div class="chips">${Array.from({ length: qn }, (_, i) => i + 1).map(n => `<button class="chip sm ${n === k ? "on" : ""}" data-act="lineQ" data-v="${n}">${n}Q</button>`).join("")}</div>
    <div style="background:#1E6B45;border-radius:20px;padding:18px 8px;display:flex;flex-direction:column;gap:16px;background-image:linear-gradient(rgba(255,255,255,.08) 2px,transparent 2px);background-size:100% 25%">${rows.map(r => `<div style="display:flex;justify-content:space-around">${r.map(spot).join("")}</div>`).join("")}</div>
    ${(() => { const emp = L.formation.map((pos, i) => q[i] ? "" : pos).filter(Boolean); if (!emp.length) return ""; if (fs) return `<div class="err">${k}쿼터 빈자리 ${emp.join(", ")}: ${emp.includes("골레이로") ? "골레이로를 1선호나 2선호로 둔 선수가 없어요. " + (edit ? "지정으로 골레이로를 정해 주세요. " : "") : ""}${emp.includes(FIELD) ? "뛸 수 있는 인원이 모자라요." : ""}</div>`;
      return `<div class="err">${k}쿼터 빈자리 ${emp.join(", ")}: 이 포지션을 1선호나 2선호로 둔 선수가 없거나 모두 뛰고 있어요. ${edit ? "포메이션을 바꾸거나 지정으로 선수를 넣어 주세요." : ""}</div>`; })()}
    ${edit ? `<span class="hint">${UI.sel != null ? `${esc(L.formation[UI.sel])} 자리에 들어갈 수 있는 선수만 누를 수 있어요` : fs ? "자리를 누르고 휴식 선수를 누르면 바뀌어요. 골레이로 자리는 골레이로가 1선호, 2선호인 선수만 들어가요" : "자리를 누르고 휴식 선수를 누르면 바뀌어요. 선수는 자기 포지션에만 들어가요"}</span>` : ""}
    <div class="card"><b>${k}쿼터 휴식 ${bench.length}명</b><div class="chips">${bench.map(p => { const ok = edit && UI.sel != null && canPlay(p, L.formation[UI.sel]) && p.from <= k; return `<button class="chip sm" ${edit ? `data-act="lineBench" data-u="${esc(p.uid)}" data-eid="${esc(e.id)}"` : "disabled"} style="${p.uid === S.uid ? "font-weight:900;" : ""}${edit && UI.sel != null && !ok ? "opacity:.4;" : ""}">${esc(p.name)} <span style="font-size:11px;opacity:.7">${esc([p.pos[0], p.pos[1]].filter(Boolean).join("/"))}</span>${p.from > k ? " (" + p.from + "Q부터)" : ""}</button>`; }).join("") || `<span class="hint">없어요</span>`}</div></div>
    ${edit ? `<button class="btn" data-act="autoLineup" data-eid="${esc(e.id)}">${fs ? "휴식 자동 배치" : "포지션 맞춰 휴식 자동 배치"}</button>` : ""}
    <div class="card"><div class="spread"><b>쿼터 수</b><a class="hint" href="#/rest/${esc(e.id)}" style="text-decoration:none">${ps.length}명 모두 보기 ›</a></div><span class="hint">${fs ? "골레이로" : "GK"}는 계속 뛰고, 필드는 고르게 쉬도록 맞췄어요</span><div class="list">${ps.slice().sort((x, y) => (cnt[y.uid] || 0) - (cnt[x.uid] || 0)).slice(0, 5).map(p => `<div class="li"><span style="flex:1;${p.uid === S.uid ? "font-weight:900" : ""}">${esc(p.name)}</span><b>${cnt[p.uid] || 0}</b></div>`).join("")}</div></div>
    ${edit ? `<div class="row"><button class="btn block" data-act="linePrint">한 장 저장</button><button class="btn pri block" data-act="lineShare" data-eid="${esc(e.id)}">팀원에게 공유</button></div>` : ""}`}
  </div>`;
}

/* ---------- 내전 ---------- */
function scrimReady(e) { if (e.type !== "match" || e.opponent || e.scrimKeep || started(e)) return false; const a = att(e); return a.in + a.wait.length >= 20; }


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
    const pos1 = up(f[1]), pos2 = up(f[2]); const num = String(f[3] || "").replace(/\D/g, "").slice(0, 3);
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
    t.disabled = true; const a = att(e); const names = a.none.filter(x => pick.includes(x.uid)).map(x => x.name).concat(unclaimed().map(p => p.name));
    try {
      await setDoc("team", "remind", { at: new Date().toISOString(), by: S.uid, eid: e.id, to: pick });
      closeSheet(); render();
      const text = `[${S.team.name}] ${md(e.date)} ${wd(e.date)} ${e.time || ""} ${evName(e)} 참석 응답 부탁해요\n아직 안 누른 분: ${names.join(", ")}\n${APP}`;
      try { await navigator.clipboard.writeText(text); toast("알렸어요. 단톡방 문구도 복사했어요"); } catch (err) { toast("알렸어요"); }
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
  duesRemind: async () => {
    const mode = feeMode(); const key = duesKey(UI.ref); const ev = S.events[UI.ref];
    const un = people().filter(x => (mode === "monthly" || (ev && cameTo(ev, x.uid))) && !paidOf(key, x.uid)).map(x => x.name);
    const b = S.settings.bank || {};
    const text = `[${S.team.name}] ${mode === "monthly" ? mLabel(UI.ref) + " 회비" : "경기 회비"} ${won(S.settings.fee)} 아직 안 낸 분: ${un.join(", ")}${b.account ? `\n${b.bank || ""} ${b.account} ${b.holder || ""}` : ""}\n매니볼 회비 탭에서 입금했어요를 눌러 주세요.`;
    try { await navigator.clipboard.writeText(text); toast("문구를 복사했어요. 단톡방에 붙여 넣어 주세요"); } catch (e) { sheet(`<h3>보낼 문구</h3><textarea class="inp" readonly>${esc(text)}</textarea><button class="btn" data-act="closeSheet">닫기</button>`); }
  },
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
    sheet(`<h3>입금하기</h3><div class="card" style="background:#F9FAFB"><span class="hint">보낼 금액</span><b style="font-size:26px">${won(total)}</b>${b.account ? `<span>${esc(b.bank || "")} ${esc(b.account)}<br><span class="hint">예금주 ${esc(b.holder || "")}</span></span><button class="btn sm" id="copyAcc" style="align-self:flex-start">계좌 복사</button>` : `<span class="hint">운영진이 아직 계좌를 적지 않았어요. 운영진에게 물어봐 주세요.</span>`}</div><span class="hint">보낸 뒤 아래 버튼을 누르면 운영진이 확인해요.</span><div class="row"><button class="btn block" data-act="closeSheet">닫기</button><button class="btn pri block" id="paySent">입금했어요</button></div>`);
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
        if (amount) { await setDoc("fines", id, { uid: u, date: e.date, eventId: e.id, reason: v === "late" ? "지각" : "무단 결석", amount, paid: (D("fines")[id] || {}).paid || false }); n++; }
        else if (D("fines")[id]) await delDoc("fines", id);
      }
      await syncMyDues(); toast(n ? `벌금 ${n}건을 매겼어요` : "매길 벌금이 없어요"); location.hash = "#/check-done/" + e.id;
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
    try { await setDoc("events", e.id, { ...e, guests: { ...(e.guests || {}), [t.dataset.k]: { name: g.name, pos: g.pos || "", by: t.dataset.u, at: new Date().toISOString() } } }); await patchDoc("guestreq", t.dataset.u, { items: { [t.dataset.k]: { status: "ok", doneAt: new Date().toISOString() } } }); render(); toast("명단에 넣었어요"); } catch (err) { fail(err); }
  },
  guestNo: async t => { try { await patchDoc("guestreq", t.dataset.u, { items: { [t.dataset.k]: { status: "no", doneAt: new Date().toISOString() } } }); render(); toast("거절했어요"); } catch (e) { fail(e); } },
  guestDel: async t => { const e = S.events[t.dataset.eid]; if (!e) return; const gs = { ...(e.guests || {}) }; delete gs[t.dataset.g]; try { await setDoc("events", e.id, { ...e, guests: gs }); render(); } catch (err) { fail(err); } },
  lineQ: t => { UI.q = Number(t.dataset.v); UI.sel = null; render(); },
  lineSide: t => { UI.side = t.dataset.v; S.form.lineup = null; S.form.ldraft = null; UI.sel = null; render(); },
  pinOpen: t => { UI.pin = { u: "", pos: "", qs: [] }; pinSheet(t.dataset.eid); },
  pinU: t => { const eid = $("[data-act=pinSave]").dataset.eid; UI.pin = { u: t.dataset.u, pos: "", qs: [] }; pinSheet(eid); },
  pinPos: t => { const eid = $("[data-act=pinSave]").dataset.eid; UI.pin.pos = t.dataset.v; UI.pin.qs = []; pinSheet(eid); },
  pinQ: t => { const eid = $("[data-act=pinSave]").dataset.eid; const v = t.dataset.v; const st = UI.pin;
    if (v === "all") { const ok = [...$("#layer").querySelectorAll("[data-act=pinQ]:not([data-v=all])")].map(b => Number(b.dataset.v)); st.qs = ok.every(k => st.qs.includes(k)) ? [] : ok; }
    else { const k = Number(v); st.qs = st.qs.includes(k) ? st.qs.filter(x => x !== k) : [...st.qs, k].sort((a, b) => a - b); }
    pinSheet(eid); },
  pinSave: t => { const e = S.events[t.dataset.eid]; if (!e) return; const side = e.type === "scrim" ? UI.side : "main"; const d = draftOf(e, side); const st = UI.pin; if (!st.u || !st.pos || !st.qs.length) return;
    d.pins.push({ u: st.u, pos: st.pos, qs: st.qs.slice() }); UI.pin = null; closeSheet(); render(); toast(curLineup(e, side) ? "지정했어요. 자동 배치를 다시 누르면 들어가요" : "지정했어요. 자동 배치를 누르면 나머지를 채워요"); },
  pinDel: t => { const e = S.events[t.dataset.eid]; if (!e) return; const d = draftOf(e, e.type === "scrim" ? UI.side : "main"); d.pins.splice(Number(t.dataset.i), 1); render(); },
  lineSpot: t => { const i = Number(t.dataset.i); UI.sel = UI.sel === i ? null : i; render(); },
  lineBench: t => { const e = S.events[t.dataset.eid]; if (!e || UI.sel == null) { toast("먼저 바꿀 자리를 눌러 주세요"); return; } const side = e.type === "scrim" ? UI.side : "main";
    const L = JSON.parse(JSON.stringify(curLineup(e, side))); const pl = lineupPlayers(e, side).find(p => p.uid === t.dataset.u); const slot = L.formation[UI.sel];
    if (!canPlay(pl, slot)) { toast(`${pl ? pl.name : "이 선수"}는 ${pl ? [pl.pos[0], pl.pos[1]].filter(Boolean).join(", ") || "포지션 없음" : ""}가 1선호, 2선호예요. ${slot} 자리에 꼭 넣으려면 지정을 써 주세요`); return; }
    if (pl.from > UI.q) { toast(`${pl.name}는 ${pl.from}쿼터부터 와요`); return; }
    const q = L.q[UI.q] = L.q[UI.q] || {}; q[UI.sel] = t.dataset.u; S.form.lineup = L; S.form.lineupFor = e.id + side; UI.sel = null; render(); },
  lineForm: t => { const e = S.events[t.dataset.eid]; const forms = FORMS[sport()];
    if (sport() === "futsal") { sheet(`<h3>몇 명이 뛰나요?</h3><span class="hint">골레이로를 포함한 한 팀 인원이에요. 참석 ${att(e).in}명</span><div class="chips">${FUTSAL_N.map(n => `<button class="chip" data-act="lineFormPick" data-eid="${esc(e.id)}" data-k="${n}대${n}">${n}대${n}</button>`).join("")}</div><button class="btn" data-act="closeSheet">닫기</button>`); return; }
    sheet(`<h3>포메이션 고르기</h3><span class="hint">참석 ${att(e).in}명</span><div class="list">${Object.keys(forms).map(k => `<button class="li" data-act="lineFormPick" data-eid="${esc(e.id)}" data-k="${esc(k)}" style="border:0;border-bottom:1px solid #F3F4F6;background:none;text-align:left;width:100%"><span style="flex:1"><b>${sport() === "soccer" ? "11대11" : forms[k].length + "대" + forms[k].length}, ${esc(k)}</b><br><span class="hint">${esc(FORM_DESC[k] || forms[k].join(", "))}</span></span></button>`).join("")}</div><button class="btn" data-act="closeSheet">닫기</button>`); },
  lineFormPick: t => { closeSheet(); const e = S.events[t.dataset.eid]; const side = e.type === "scrim" ? UI.side : "main"; draftOf(e, side).fkey = t.dataset.k;
    const what = sport() === "futsal" ? t.dataset.k + "로 정했어요" : "포메이션을 골랐어요";
    if (!curLineup(e, side)) { render(); toast(`${what}. 지정할 선수가 있으면 먼저 정하고 자동 배치를 눌러 주세요`); return; }
    S.form.lineup = autoLineup(e, side); S.form.lineupFor = e.id + side; UI.q = 1; UI.sel = null; render(); toast(`${sport() === "futsal" ? t.dataset.k + "로 바꾸고" : "포메이션을 바꾸고"} 다시 짰어요. 저장해야 팀원에게 보여요`); },
  autoLineup: t => { const e = S.events[t.dataset.eid]; if (!e) return; const side = e.type === "scrim" ? UI.side : "main"; if (!formOf(draftOf(e, side).fkey, curLineup(e, side))) { toast("몇 명이 뛸지 먼저 골라 주세요"); return; }
    S.form.lineup = autoLineup(e, side); S.form.lineupFor = e.id + side; UI.q = 1; UI.sel = null; render(); const how = sport() === "futsal" ? "휴식을 고르게" : "포지션에 맞춰"; toast(draftOf(e, side).pins.length ? `지정은 그대로 두고 나머지를 ${how} 짰어요. 저장해야 팀원에게 보여요` : `${how} 짰어요. 저장해야 팀원에게 보여요`); },
  saveLineup: async t => { const e = S.events[t.dataset.eid]; if (!e) return; const side = e.type === "scrim" ? UI.side : "main"; const L = curLineup(e, side); if (!L) return; try { await setDoc("events", e.id, { ...e, lineup: { ...(e.lineup || {}), [side]: L } }); S.form.lineup = null; render(); toast("저장했어요. 공유를 누르면 팀원에게 보여요"); } catch (err) { fail(err); } },
  lineShare: t => { const e = S.events[t.dataset.eid]; if (!e) return; const n = lineupPlayers(e, e.type === "scrim" ? UI.side : "main").length;
    confirmBox("라인업을 알릴까요?", `${md(e.date)} ${wd(e.date)} ${e.time || ""} ${evName(e)}, 참석 ${n}명. 팀원 라인업 화면과 알림함에 보여요. 나중에 바꿔도 다시 알릴 수 있어요.`, `${n}명에게 알리기`, async () => { const side = e.type === "scrim" ? UI.side : "main"; const L = curLineup(e, side); try { await setDoc("events", e.id, { ...e, lineup: { ...(e.lineup || {}), [side]: L }, lineupAt: new Date().toISOString() }); S.form.lineup = null; render(); toast("라인업을 알렸어요"); } catch (err) { fail(err); } }); },
  linePrint: () => window.print(),
  scrimConvert: t => confirmBox("내전으로 바꾸기", "상대팀 없이 우리끼리 A팀과 B팀으로 나눠서 해요. 대기자도 모두 참석으로 올라가고, 신청한 사람 모두에게 보여요.", "바꾸기", async () => { const e = S.events[t.dataset.eid]; const a = att(e); const T = {}; [...a.yes, ...a.late, ...a.wait].forEach((x, i) => { T[x.uid] = i % 2 ? "B" : "A"; }); try { await setDoc("events", e.id, { ...e, type: "scrim", cap: 0, teams: T, scrimAt: new Date().toISOString() }); toast("내전으로 바꿨어요. 스쿼드를 나눠 주세요"); location.hash = "#/squad/" + e.id; } catch (err) { fail(err); } }),
  squadSet: async t => { const e = S.events[t.dataset.eid]; const T = { ...(e.teams || {}) }; T[t.dataset.u] = T[t.dataset.u] === t.dataset.v ? "" : t.dataset.v; try { await setDoc("events", e.id, { ...e, teams: T }); render(); } catch (err) { fail(err); } },
  squadAuto: async t => {
    const e = S.events[t.dataset.eid]; const a = att(e); let ids = Object.keys(e.teams || {}); if (!ids.length) ids = [...a.yes, ...a.late, ...a.wait].map(x => x.uid);
    const order = POS[sport()]; const pos = u => u.startsWith("g:") ? (((e.guests || {})[u.slice(2)] || {}).pos || "") : ((profileOf(u) || {}).pos1 || "");
    ids.sort((x, y) => (order.indexOf(pos(x)) + 99) % 99 - (order.indexOf(pos(y)) + 99) % 99); const T = {}; ids.forEach((u, i) => { T[u] = (i % 4 === 0 || i % 4 === 3) ? "A" : "B"; });
    try { await setDoc("events", e.id, { ...e, teams: T }); render(); toast("포지션별로 고르게 나눴어요"); } catch (err) { fail(err); }
  },

  playerOpen: t => playerSheet(t.dataset.u),
  setRole: async t => { closeSheet(); const { error } = await sb.rpc("set_member_role", { p_team: S.tid, p_user: t.dataset.u, p_role: t.dataset.v }); if (error) fail(error); else { toast("바꿨어요"); refreshMembers(); } },
  giveOwner: t => { const u = t.dataset.u; confirmBox("팀장 넘기기", `${nameOf(u)} 님에게 팀장을 넘길까요? 나는 운영진이 돼요.`, "넘기기", async () => { const { error } = await sb.rpc("transfer_owner", { p_team: S.tid, p_user: u }); if (error) fail(error); else { toast("팀장을 넘겼어요"); refreshMembers(); } }); },
  kick: t => { const u = t.dataset.u; confirmBox("팀에서 내보내기", `${nameOf(u)} 님을 내보낼까요? 다시 들어오려면 초대 링크가 필요해요.`, "내보내기", async () => { const { error } = await sb.rpc("remove_member", { p_team: S.tid, p_user: u }); if (error) fail(error); else { toast("내보냈어요"); refreshMembers(); } }, true); },
  adminReq: async () => { closeSheet(); const { error } = await sb.rpc("request_admin", { p_team: S.tid }); if (error) fail(error); else { toast("운영진 신청을 보냈어요. 팀장이 수락하면 바뀌어요"); refreshMembers(); } },
  adminCancel: async () => { closeSheet(); const { error } = await sb.rpc("cancel_admin_request", { p_team: S.tid }); if (error) fail(error); else { toast("신청을 취소했어요"); refreshMembers(); } },
  adminAns: async t => { closeSheet(); const { error } = await sb.rpc("answer_admin_request", { p_team: S.tid, p_user: t.dataset.u, p_ok: !!t.dataset.ok }); if (error) fail(error); else { toast(t.dataset.ok ? "운영진이 됐어요" : "거절했어요"); refreshMembers(); } },
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
function render() {
  const app = $("#app"); let html = "";
  if (S.flow === "login") html = vLogin(qs.get("login_error"));
  else if (S.flow === "invite") html = vInvite(S.inviteTeam, qs.get("login_error"));
  else if (S.flow === "create") html = vCreate();
  else if (S.flow === "profile") html = vProfile(false);
  else if (S.flow === "rules") html = vRules();
  else if (S.flow === "claim") html = vClaim();
  else if (!S.ready) html = `<div class="loading">불러오는 중이에요</div>`;
  else {
    const r = route(); let m;
    const mv = viewMode() === "member" ? memberRoute(r) : null;
    if (mv) html = mv;
    else if (viewMode() === "member" && !/^\/(notices|lineup\/.+|rest\/.+|claim)$/.test(r)) html = memberRoute("/");
    else if (r === "/" || r === "") html = vHomeAdmin();
    else if (r === "/notify") html = vNotifyAdmin();
    else if (r === "/calendar") html = vCalendarAdmin();
    else if ((m = r.match(/^\/guests\/(.+)$/))) html = vGuests(decodeURIComponent(m[1]));
    else if ((m = r.match(/^\/scrim\/(.+)$/))) html = vScrim(decodeURIComponent(m[1]));
    else if ((m = r.match(/^\/check-done\/(.+)$/))) html = vCheckDone(decodeURIComponent(m[1]));
    else if ((m = r.match(/^\/player\/(.+)$/))) html = vPlayerAdmin(decodeURIComponent(m[1]));
    else if (r === "/spend") html = vSpend();
    else if (r === "/upload") html = vUpload();
    else if (r === "/rules-edit") html = vRulesEdit();
    else if (r === "/uniform") html = vUniform();
    else if (r === "/schedule") html = vSchedule();
    else if ((m = r.match(/^\/event\/(.+)$/))) html = vEvent(decodeURIComponent(m[1]));
    else if (r === "/new" && isAdmin()) html = vEventForm("");
    else if ((m = r.match(/^\/edit\/(.+)$/)) && isAdmin()) html = vEventForm(decodeURIComponent(m[1]));
    else if (r === "/players") html = vPlayers();
    else if (r === "/invite" && isAdmin()) html = vInviteMsg();
    else if (r === "/me") html = vProfile(true);
    else if (r === "/settings" && isAdmin()) html = vCreate(true);
    else if (r === "/records") html = vRecords();
    else if ((m = r.match(/^\/game\/(.+)$/))) html = vGame(decodeURIComponent(m[1]));
    else if ((m = r.match(/^\/result\/(.+)$/)) && isAdmin()) html = vResult(decodeURIComponent(m[1]));
    else if ((m = r.match(/^\/check\/(.+)$/)) && isAdmin()) html = vCheck(decodeURIComponent(m[1]));
    else if ((m = r.match(/^\/lineup\/(.+)$/))) html = vLineup(decodeURIComponent(m[1]));
    else if ((m = r.match(/^\/rest\/(.+)$/))) html = vRest(decodeURIComponent(m[1]));
    else if ((m = r.match(/^\/squad\/(.+)$/)) && isAdmin()) html = vSquad(decodeURIComponent(m[1]));
    else if (r === "/dues") html = vDues();
    else if (r === "/dues-settings" && isAdmin()) html = vDuesSettings();
    else if (r === "/ledger") html = vLedger();
    else if (r === "/notices") html = vNotices();
    else if (r === "/notice-new" && isAdmin()) html = vNoticeNew();
    else if (r === "/posreq") html = vPosReq();
    else if (r === "/claim" && !(S.rsvp[S.uid] || {}).pid) html = vClaim();
    else if (r === "/roster-import" && isAdmin()) html = vRosterImport();
    else html = vHomeAdmin();
  }
  // 입력 중인 칸은 그대로 두려고, 같은 화면이면 포커스와 커서를 되돌린다
  const act = document.activeElement; const d = (act && act.dataset) || {};
  const sel = d.bind ? `[data-bind="${d.bind}"]` : d.rule != null ? `[data-rule="${d.rule}"][data-f="${d.f}"]` : d.opt != null ? `[data-opt="${d.opt}"]` : "";
  const pos = sel && "selectionStart" in act ? act.selectionStart : null;
  app.innerHTML = html;
  if (sel) { const el = app.querySelector(sel); if (el) { el.focus(); try { if (pos != null) el.setSelectionRange(pos, pos); } catch (e) { /* 날짜 칸 */ } } }
}
let lastRoute = "";
window.addEventListener("hashchange", () => onRoute(false));
function onRoute(force) {
  const r = route(); if (r === lastRoute && !force) return; lastRoute = r;
  // 폼 화면에 들어올 때 폼 값을 채운다
  let m;
  if (viewMode() === "member" && memberForm(r)) { render(); window.scrollTo(0, 0); return; }
  if (viewMode() === "admin" && adminForm(r)) { render(); window.scrollTo(0, 0); return; }
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
  else if (r === "/settings") { const st = S.settings; S.form = { name: (S.team && S.team.name) || st.teamName || "", sport: st.sport || "futsal", feeMode: st.feeMode || "none", fee: st.fee ? String(st.fee) : "", dueDay: st.dueDay || "5", kit: st.uniformColor || "#164F33", rules: (st.rules || []).map(r => ({ label: r.label, amount: r.amount ? String(r.amount) : "" })) }; }
  render(); window.scrollTo(0, 0);
}

/* ---------- 입력 ---------- */
document.addEventListener("input", ev => {
  const t = ev.target;
  if (t.dataset.bind) {
    S.form[t.dataset.bind] = t.type === "checkbox" ? t.checked : t.value;
    if (t.dataset.liveSrc) document.querySelectorAll(`[data-live="${t.dataset.liveSrc}"]`).forEach(el => { el.textContent = t.value || (t.dataset.liveSrc === "name" ? "이름" : ""); });
  } else if (t.dataset.rule != null) { const r = (S.form.rules || [])[Number(t.dataset.rule)]; if (r) r[t.dataset.f] = t.value; }
  else if (t.dataset.opt != null) { const o = (S.form.opts || [])[Number(t.dataset.opt)]; if (o) o.label = t.value; }
});
const ACT = {
  closeSheet: (t, ev) => { if (ev.target === t || t.tagName === "BUTTON") closeSheet(); },
  kakao: async t => {
    t.disabled = true;
    try {
      const st = { state: rand(), nonce: rand() };
      sessionStorage.setItem(KK, JSON.stringify(st));
      const back = new URL(location.href); back.searchParams.delete("login_error"); back.hash = "";
      sessionStorage.setItem("mb-next", back.href);
      const redirect = KAKAO_REDIRECT;
      location.assign("https://kauth.kakao.com/oauth/authorize?" + new URLSearchParams({ client_id: KAKAO_KEY, redirect_uri: redirect, response_type: "code", scope: "openid profile_nickname", state: st.state, nonce: await sha256hex(st.nonce) }));
    } catch (e) { t.disabled = false; toast("카카오 로그인을 시작하지 못했어요"); }
  },
  pick: t => { S.form[t.dataset.k] = t.dataset.v; if (t.dataset.k === "pos1" && S.form.pos2 === t.dataset.v) S.form.pos2 = ""; render(); },
  ruleAdd: () => { (S.form.rules = S.form.rules || []).push({ label: "", amount: "" }); render(); const ins = document.querySelectorAll('[data-f="label"]'); if (ins.length) ins[ins.length - 1].focus(); },
  ruleDel: t => { S.form.rules.splice(Number(t.dataset.i), 1); render(); },
  createTeam: async t => {
    const f = S.form; const name = String(f.name || "").trim();
    if (!name) { toast("팀 이름을 적어 주세요"); return; }
    t.disabled = true;
    try {
      const { data: tid, error } = await sb.rpc("create_team", { p_name: name });
      if (error) throw error;
      await loadTeams(); await loadTeam(tid);
      await setDoc("team", "settings", { app: "maniball", since: todayStr().slice(0, 7), teamName: name, sport: f.sport, feeMode: f.feeMode, fee: f.feeMode === "none" ? 0 : Number(String(f.fee || "").replace(/\D/g, "")) || 0, dueDay: f.feeMode === "monthly" ? f.dueDay : "", rules: (f.rules || []).filter(r => String(r.label).trim()).map(r => ({ label: String(r.label).trim().slice(0, 40), amount: Number(String(r.amount || "").replace(/\D/g, "")) || 0 })), cap: f.sport === "soccer" ? 22 : 12, uniformColor: f.kit || "#164F33" });
      S.afterProfile = "invite"; startProfile();
    } catch (e) { t.disabled = false; fail(e); }
  },
  saveSettings: async t => {
    const f = S.form; const name = String(f.name || "").trim();
    if (!name) { toast("팀 이름을 적어 주세요"); return; }
    t.disabled = true;
    try {
      const newRules = (f.rules || []).filter(r => String(r.label).trim()).map(r => ({ label: String(r.label).trim().slice(0, 40), amount: Number(String(r.amount || "").replace(/\D/g, "")) || 0 }));
      const rulesAt = JSON.stringify(newRules) !== JSON.stringify(S.settings.rules || []) && (S.settings.rules || []).length ? new Date().toISOString() : (S.settings.rulesAt || "");
      await setDoc("team", "settings", { ...S.settings, rulesAt, app: "maniball", teamName: name, sport: f.sport, feeMode: f.feeMode, fee: f.feeMode === "none" ? 0 : Number(String(f.fee || "").replace(/\D/g, "")) || 0, dueDay: f.feeMode === "monthly" ? f.dueDay : "", rules: (f.rules || []).filter(r => String(r.label).trim()).map(r => ({ label: String(r.label).trim().slice(0, 40), amount: Number(String(r.amount || "").replace(/\D/g, "")) || 0 })), uniformColor: f.kit || "#164F33" });
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
  share: async () => {
    const text = (S.form.msg ?? `${S.team.name} 팀 관리 앱이에요. 링크 누르고 카카오로 로그인하면 끝! 이제 참석은 여기서 눌러 주세요.`) + "\n" + inviteUrl();
    try { if (navigator.share) { await navigator.share({ title: S.team.name, text }); return; } } catch (e) { return; }
    try { await navigator.clipboard.writeText(text); toast("문구와 링크를 복사했어요. 단톡방에 붙여 넣어 주세요"); } catch (e) { toast("길게 눌러 복사해 주세요"); }
  },
  newCode: () => confirmBox("새 초대 링크", "지금 링크로는 더 이상 들어올 수 없게 돼요. 이미 들어온 멤버는 그대로예요.", "새 링크 만들기", async () => {
    const { data, error } = await sb.rpc("new_invite_code", { p_team: S.tid }); if (error) { fail(error); return; } S.invite = data; render(); toast("새 링크를 만들었어요");
  }),
  vote: async t => {
    const e = S.events[t.dataset.eid]; if (!e) return; const v = t.dataset.v; const cur = myVote(e);
    if (cur.s === v) return;
    const before = JSON.stringify(S.rsvp[S.uid] || null);
    const entry = { s: v, q: v === "late" ? (Number(cur.q) || 2) : 0 };
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
  switchTeam: () => {
    sheet(`<h3>팀 고르기</h3><div class="list">${S.teams.map(t => `<button class="li" style="border:0;background:none;text-align:left;width:100%" data-act="enterTeam" data-id="${esc(t.id)}"><span class="av">${esc(ini(t.name))}</span><span style="flex:1"><b>${esc(t.name)}</b><br><span class="hint">${ROLE[t.role] || ""}</span></span></button>`).join("")}</div><a class="btn" href="#" data-act="newTeam">+ 새 팀 만들기</a>`);
  },
  enterTeam: async t => { closeSheet(); S.ready = false; render(); await enter(t.dataset.id); },
  newTeam: () => { closeSheet(); startCreate(); },
  delTeam: () => confirmBox("팀 지우기", `${S.team.name}의 일정, 참석, 회비, 기록, 멤버가 모두 사라져요. 되돌릴 수 없어요.`, "지우기", async () => {
    const { error } = await sb.rpc("delete_team", { p_team: S.tid }); if (error) { fail(error); return; }
    ls.set("mb-team", null); toast("팀을 지웠어요"); setTimeout(() => location.replace(APP), 600);
  }, true),
  logout: () => confirmBox("로그아웃", "이 기기에서 로그아웃할까요?", "로그아웃", async () => { try { await sb.auth.signOut(); } catch (e) { /* 그래도 처음으로 */ } ls.set("mb-team", null); location.replace(APP); }),
};
Object.assign(ACT, ACT2, ACT3, ACT4, AACT1, AACT2, AACT3, MACT);
document.addEventListener("click", ev => {
  const t = ev.target.closest("[data-act]"); if (!t) return;
  const f = ACT[t.dataset.act]; if (!f) return;
  if (t.tagName === "A") ev.preventDefault();
  f(t, ev);
});

/* ---------- 시작 ---------- */
function startCreate() { S.flow = "create"; S.form = { name: "", sport: "futsal", feeMode: "monthly", fee: "", dueDay: "5", kit: "#164F33", rules: [{ label: "지각 (킥오프 10분 전 기준)", amount: "" }, { label: "무단 결석", amount: "" }] }; render(); }
function startProfile() { const p = myProfile() || {}; S.flow = "profile"; S.form = { name: p.name || nameOf(S.uid) || suggestedName(), num: p.num || "", pos1: p.pos1 || "", pos2: p.pos2 || "", foot: p.foot || "" }; render(); }
function suggestedName() { const m = (S.session && S.session.user.user_metadata) || {}; return String(m.nickname || m.name || m.full_name || "").slice(0, 20); }
async function enter(tid) {
  try { await loadTeam(tid); } catch (e) { fail(e); S.flow = "create"; startCreate(); return; }
  if (!S.role) { ls.set("mb-team", null); await loadTeams(); if (S.teams.length) return enter(S.teams[0].id); return startCreate(); }
  const rs = S.rsvp[S.uid] || {}; if (!isAdmin() && myProfile() && S.settings.rulesAgreeAt && (!rs.agreedAt || rs.agreedAt < S.settings.rulesAgreeAt)) { S.form = {}; S.flow = "rules"; render(); return; }
  if (!myProfile() && !isAdmin()) { S.afterProfile = ""; if (unclaimed().length) { S.flow = "claim"; render(); return; } startProfile(); return; }
  if (!isAdmin() && !(S.rsvp[S.uid] || {}).agreedAt) { S.flow = "rules"; render(); return; }
  S.flow = ""; S.ready = true; onRoute(true);
  syncMyDues().catch(() => {});
}
async function kakaoFinish() {
  let st = null; try { st = JSON.parse(sessionStorage.getItem(KK) || "null"); sessionStorage.removeItem(KK); } catch (e) { /* 없음 */ }
  if (!st || !qs.get("state") || qs.get("state") !== st.state) throw new Error("state");
  if (qs.get("error")) throw new Error(qs.get("error"));
  const r = await fetch("https://kauth.kakao.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: new URLSearchParams({ grant_type: "authorization_code", client_id: KAKAO_KEY, redirect_uri: KAKAO_REDIRECT, code: qs.get("code") || "" }) });
  const tok = await r.json().catch(() => ({}));
  if (!r.ok || !tok.id_token) throw new Error(tok.error_code || tok.error || "token " + r.status);
  const { error } = await sb.auth.signInWithIdToken({ provider: "kakao", token: tok.id_token, access_token: tok.access_token, nonce: st.nonce });
  if (error) throw error;
}
async function boot() {
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
  if (qs.get("view") === "member") setView("member"); else if (qs.get("view") === "admin") setView("admin");
  ls.set("mb-view", null);
  if (location.search) history.replaceState(null, "", APP + location.hash);
  try { await loadTeams(); } catch (e) { $("#app").innerHTML = `<div class="loading">팀 정보를 불러오지 못했어요. 네트워크를 확인하고 새로고침해 주세요.</div>`; return; }
  if (code) {
    ls.set("mb-join", null);
    const { data } = await sb.rpc("team_by_code", { p_code: code }); const t = data && data[0];
    if (!t) toast("초대 링크가 바뀌었거나 잘못됐어요. 운영진에게 새 링크를 받아 주세요");
    else if (!S.teams.some(x => x.id === t.id)) {
      const { error } = await sb.rpc("join_team", { p_code: code, p_name: suggestedName() });
      if (error) fail(error); else { await loadTeams(); return enter(t.id); }
    } else return enter(t.id);
  }
  const last = ls.get("mb-team"); const t = S.teams.find(x => x.id === last) || S.teams[0];
  if (t) return enter(t.id);
  startCreate();
}
sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") location.replace(APP); });
boot();

// 축구: 대표 포메이션 10개 (자리 이름은 아래 GK에서 위 공격 순서). 풋살: 포메이션 없이 몇 명이 뛸지만 고른다 (formOf)
const FORMS = {
  futsal: {},
  soccer: {
    "4-4-2": ["GK", "LB", "CB", "CB", "RB", "LM", "CM", "CM", "RM", "ST", "ST"],
    "4-3-3": ["GK", "LB", "CB", "CB", "RB", "CDM", "CM", "CM", "LW", "ST", "RW"],
    "4-2-3-1": ["GK", "LB", "CB", "CB", "RB", "CDM", "CDM", "LW", "CAM", "RW", "ST"],
    "4-1-4-1": ["GK", "LB", "CB", "CB", "RB", "CDM", "LM", "CM", "CM", "RM", "ST"],
    "4-4-1-1": ["GK", "LB", "CB", "CB", "RB", "LM", "CM", "CM", "RM", "CAM", "ST"],
    "4-1-2-1-2": ["GK", "LB", "CB", "CB", "RB", "CDM", "CM", "CM", "CAM", "ST", "ST"],
    "3-5-2": ["GK", "CB", "CB", "CB", "LWB", "CM", "CDM", "CM", "RWB", "ST", "ST"],
    "3-4-3": ["GK", "CB", "CB", "CB", "LWB", "CM", "CM", "RWB", "LW", "ST", "RW"],
    "5-3-2": ["GK", "LWB", "CB", "CB", "CB", "RWB", "CM", "CDM", "CM", "ST", "ST"],
    "5-4-1": ["GK", "LWB", "CB", "CB", "CB", "RWB", "LM", "CDM", "CDM", "RM", "ST"]
  }
};
const FORM_DESC = { "4-4-2": "수비 4, 미드 4, 공격 2", "4-3-3": "수비형 미드 1, 윙어 2", "4-2-3-1": "수비형 미드 2, 공격형 미드 1", "4-1-4-1": "수비형 미드 1, 미드 4, 공격 1", "4-4-1-1": "미드 4, 공격형 미드 1, 공격 1", "4-1-2-1-2": "4-4-2 다이아몬드", "3-5-2": "센터백 3, 윙백 2, 공격 2", "3-4-3": "센터백 3, 윙백 2, 공격 3", "5-3-2": "수비 5, 미드 3, 공격 2", "5-4-1": "수비 5, 미드 4, 공격 1" };
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
  const e = S.events[id]; if (!e) return vLineup(id); const side = e.type === "scrim" ? UI.side : "main"; const L = curLineup(e, side); const qn = QN[sport()];
  const ps = lineupPlayers(e, side); const cnt = {}; if (L) Object.values(L.q || {}).forEach(q => Object.values(q).forEach(u => { cnt[u] = (cnt[u] || 0) + 1; }));
  const posOf = (u, k) => { const q = (L && L.q && L.q[k]) || {}; const i = Object.keys(q).find(x => q[x] === u); return i != null ? L.formation[i] : ""; };
  return `${top("휴식표", "#/lineup/" + id)}<div class="body"><div class="card" style="overflow-x:auto;padding:12px"><table style="border-collapse:collapse;width:100%;font-size:13px;text-align:center"><thead><tr><th style="text-align:left;padding:6px">선수</th>${Array.from({ length: qn }, (_, i) => `<th style="padding:6px">${i + 1}Q</th>`).join("")}<th style="padding:6px">출전</th></tr></thead><tbody>
    ${ps.slice().sort((x, y) => (cnt[y.uid] || 0) - (cnt[x.uid] || 0)).map(p => `<tr style="border-top:1px solid #F3F4F6;${p.uid === S.uid ? "font-weight:900" : ""}"><td style="text-align:left;padding:8px 6px;white-space:nowrap">${esc(p.name)}</td>${Array.from({ length: qn }, (_, i) => { const ps2 = posOf(p.uid, i + 1); return `<td style="padding:4px"><span style="display:inline-block;min-width:34px;border-radius:8px;padding:4px 2px;font-size:11px;font-weight:700;${ps2 ? "background:#DCFCE7;color:#166534" : "background:#F3F4F6;color:#9CA3AF"}">${ps2 || "휴식"}</span></td>`; }).join("")}<td><b>${cnt[p.uid] || 0}</b></td></tr>`).join("")}
  </tbody></table></div><span class="hint">쿼터마다 ${L ? L.formation.length : 0}명이 뛰어요. ${sport() === "futsal" ? "골레이로" : "GK"}는 계속 뛰고, 나머지는 고르게 쉬어요.</span></div>`;
}

// member.js와 admin.js가 같이 쓰는 것
export { $, D, KIT, LOGO, POS, QN, ROLE, S, UI, att, cameTo, closeSheet, closeText, confirmBox, dotDate, esc, evName, evStart, eventCard, fail, feeMode, finesOf, guestReqs, guestsOf, ini, isAdmin, isPlay, jersey, joinedOf, lateRow, mLabel, md, momClosed, momDeadline, momOpen, momWinners, monthsList, myProfile, myUv, myVote, nameOf, nav, noticeCard, noticesList, paidOf, parseRoster, past, patchDoc, people, qs, refreshMembers, remindInfo, render, ruleAmt, ruleKind, sb, scrimReady, setDoc, setView, sheet, sport, started, syncMyDues, toast, todayStr, top, uid36, unclaimed, upcoming, voteRow, voteState, wd, won, ym };
