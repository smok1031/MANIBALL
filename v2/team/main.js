// 매니볼 실제 앱: 로그인, 팀, 초대, 선수, 일정과 참석, 현장 출석과 벌금, 회비, 기록과 MOM, 공지와 설문, 용병, 라인업, 내전
// 서버는 Supabase(teams, members, docs). 예시 데이터는 없다.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "../../src/config.js";

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
const POS = { futsal: ["GK", "DF", "LW", "RW", "FW"], soccer: ["GK", "LB", "LWB", "CB", "RB", "RWB", "CDM", "CM", "CAM", "LW", "RW", "ST"] };
const QN = { futsal: 8, soccer: 4 };
const ROLE = { owner: "팀장", admin: "운영진", member: "팀원" };
const KIT = [["#164F33", "초록"], ["#111827", "검정"], ["#1E3A8A", "파랑"], ["#991B1B", "빨강"], ["#F5B841", "노랑"], ["#F3F4F6", "흰색"]];
const numColor = c => ["#F5B841", "#F3F4F6"].includes(c) ? "#111827" : "#FFFFFF";

const S = { d: {}, session: null, uid: "", teams: [], tid: "", role: "", team: null, members: [], invite: "", settings: {}, events: {}, rsvp: {}, ready: false, flow: "", form: {}, ch: null };
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
const profileOf = u => (S.rsvp[u] && S.rsvp[u].profile) || null;
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
    ${err ? `<div class="err" role="alert">로그인하지 못했어요. 다시 시도해 주세요.</div>` : ""}
    <button class="btn kakao block" data-act="kakao">${KAKAO}카카오로 시작하기</button>
    <span class="hint" style="text-align:center">앱 설치는 필요 없어요. <a href="../../privacy.html">개인정보처리방침과 이용약관</a></span>
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
  return `${top(editing ? "프로필 수정" : "선수 등록", editing ? "#/" : "")}<div class="body">
    <div class="hero" style="border-radius:20px;padding:20px;display:flex;align-items:center;gap:16px">
      ${jersey(96, f.num, S.settings.uniformColor)}
      <span style="display:flex;flex-direction:column;gap:6px;min-width:0"><b data-live="name" style="font-size:22px;font-weight:900">${esc(f.name || "이름")}</b><span style="font-size:13px;color:#BBF7D0">${esc(S.team ? S.team.name : "")}</span><span class="row" style="gap:6px"><span class="pill" style="background:#FFFFFF;color:#1E6B45;font-size:13px"><span style="opacity:.7">1선호</span><b>${esc(f.pos1 || "-")}</b></span>${f.pos2 ? `<span class="pill" style="background:rgba(255,255,255,.16);color:#FFFFFF;font-size:13px"><span style="opacity:.7">2선호</span><b>${esc(f.pos2)}</b></span>` : ""}</span></span>
    </div>
    <div class="card">
      <label class="field"><span class="lab">팀에서 부를 이름</span><input class="inp" data-bind="name" data-live-src="name" value="${esc(f.name || "")}" maxlength="20" placeholder="예: 이서준"></label>
      <label class="field"><span class="lab">등번호</span><input class="inp" data-bind="num" data-live-src="num" value="${esc(f.num || "")}" inputmode="numeric" maxlength="3" placeholder="예: 7"></label>
      <div class="field"><span class="lab">1선호 포지션</span><div class="chips">${pos.map(p => pchip("pos1", p)).join("")}</div></div>
      <div class="field"><span class="lab">2선호 포지션</span><div class="chips">${pos.filter(p => p !== f.pos1).map(p => pchip("pos2", p)).join("")}<button class="chip ${!f.pos2 ? "on" : ""}" data-act="pick" data-k="pos2" data-v="">없음</button></div></div>
    </div>
  </div><div class="cta"><button class="btn pri block" data-act="saveProfile">${editing ? "저장" : "다음"}</button></div>`;
}
function vRules() {
  const rules = S.settings.rules || [];
  return `${top("팀 수칙", "")}<div class="body">
    <div class="card"><b style="font-size:18px">${esc(S.team ? S.team.name : "")} 수칙이에요</b>
      ${rules.length ? `<div class="list">${rules.map(r => `<div class="li"><span style="flex:1">${esc(r.label)}</span>${Number(r.amount) ? `<b>${won(r.amount)}</b>` : ""}</div>`).join("")}</div>` : `<span class="hint">아직 정한 수칙이 없어요.</span>`}
      ${S.settings.feeMode && S.settings.feeMode !== "none" ? `<div class="spread" style="background:#F9FAFB;border-radius:12px;padding:12px"><span>회비</span><b>${won(S.settings.fee)}${S.settings.feeMode === "per_game" ? " / 경기" : " / 월"}</b></div>` : ""}
    </div>
  </div><div class="cta"><button class="btn pri block" data-act="agree">확인했어요</button></div>`;
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
function homeExtras() {
  const out = [];
  const rm = remindInfo(); const re = rm && S.events[rm.eid];
  if (!isAdmin() && re && !started(re) && Date.now() - Date.parse(rm.at) < 2 * 864e5 && !myVote(re).s && myProfile()) out.push(`<a class="card" href="#/event/${esc(re.id)}" style="text-decoration:none;color:inherit;background:#FEF2F2"><b style="color:#B91C1C">참석 응답을 기다리고 있어요</b><span class="hint">${esc(md(re.date) + " " + wd(re.date) + " " + (re.time || "") + " " + evName(re))}, 운영진이 미응답 알림을 보냈어요</span></a>`);
  const n = noticesList()[0];
  if (n) out.push(`<div class="spread"><b>공지</b><a href="#/notices" class="hint" style="text-decoration:none">전체</a></div>${noticeCard(n, false)}`);
  else if (!isAdmin()) out.push(`<a class="btn" href="#/notices">공지와 설문</a>`);
  past().filter(e => momOpen(e) && cameTo(e, S.uid) && !(myUv().mom || {})[e.id]).slice(0, 1).forEach(e => out.push(`<a class="card" href="#/game/${esc(e.id)}" style="text-decoration:none;color:inherit;background:#FFFBEB"><b>오늘의 MOM을 골라 주세요</b><span class="hint">${esc(md(e.date) + " " + evName(e))}, 다음 날 12시 마감</span></a>`));
  if (!isAdmin()) { const my = D("mydues")[S.uid] || {}; const owe = Object.values(my.dues || {}).filter(v => v !== "paid").length * (Number(S.settings.fee) || 0) + (my.fines || []).filter(f => !f.paid).reduce((s2, f) => s2 + (Number(f.amount) || 0), 0); if (owe) out.push(`<a class="card" href="#/dues" style="text-decoration:none;color:inherit"><div class="spread"><b>낼 돈이 있어요</b><b>${won(owe)}</b></div><span class="hint">회비 탭에서 입금하기를 눌러요</span></a>`); }
  return out.join("");
}
function vHomeMember() {
  const p = myProfile() || {}; const st = seasonStats(S.uid); const next = upcoming()[0];
  return `<div class="hero" style="padding-bottom:56px">
    <header class="row" style="padding:14px 16px 8px;gap:10px">${LOGO(32)}<span style="flex:1;line-height:1.2"><b style="font-size:18px">${esc(S.team.name)}</b><br><span style="font-size:12px;color:#D1D5DB">${sport() === "soccer" ? "축구팀" : "풋살팀"}, 팀원 ${S.members.length}명</span></span>${S.teams.length > 1 ? `<button class="iconbtn" style="color:#FFFFFF" data-act="switchTeam" aria-label="다른 팀">⇄</button>` : ""}${isAdmin() ? `<a class="btn sm" href="#/" style="background:rgba(255,255,255,.16);color:#FFFFFF">운영진 화면</a>` : ""}</header>
    <div style="display:flex;flex-direction:column;align-items:center;text-align:center;padding:0 20px">
      ${jersey(220, p.num, S.settings.uniformColor)}
      <span class="row" style="gap:10px;align-items:baseline"><b style="font-size:30px;font-weight:900;letter-spacing:-1px">${esc(p.name || nameOf(S.uid))}</b>${p.num ? `<span style="color:#BBF7D0">${esc(p.num)}번</span>` : ""}</span>
      <span class="row" style="gap:8px;margin-top:12px">${p.pos1 ? `<span class="pill" style="background:#FFFFFF;color:#1E6B45"><span style="font-size:12px;opacity:.8">1선호</span><b>${esc(p.pos1)}</b></span>` : ""}${p.pos2 ? `<span class="pill" style="background:rgba(255,255,255,.16);color:#FFFFFF"><span style="font-size:12px;opacity:.8">2선호</span><b>${esc(p.pos2)}</b></span>` : ""}</span>
      <a href="#/me" style="margin-top:18px;color:#FFFFFF;text-decoration:none;font-weight:700;padding:11px 28px;border-radius:999px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.45)">프로필 수정</a>
    </div></div>
    <div class="body" style="margin-top:-44px">
      <div class="card" style="box-shadow:0 12px 28px rgba(17,24,39,.1)"><div class="spread"><span class="hint">이번 시즌</span><b>${st.n}번 모임, 참석률 ${st.rate}%</b></div>
        <div class="stat"><span><b>${st.mine}</b><span>내 출석</span></span><span><b>${st.n - st.mine}</b><span>빠진 모임</span></span><span><b style="color:#B45309">${st.mom}</b><span>MOM</span></span></div></div>
      ${homeExtras()}
      ${next ? `<div class="spread"><b>다음 일정</b><a href="#/schedule" class="hint" style="text-decoration:none">전체</a></div>${eventCard(next)}` : `<div class="card empty"><b>아직 올라온 일정이 없어요</b><span class="hint">운영진이 일정을 올리면 여기서 바로 참석을 눌러요.</span></div>`}
    </div>${nav("홈")}`;
}
function vHomeAdmin() {
  const next = upcoming()[0]; const a = next ? att(next) : null;
  const noProfile = S.members.filter(m => !profileOf(m.user_id)).length;
  const todo = [];
  if (!S.members.some(m => m.user_id !== S.uid)) todo.push(["팀원을 초대해 주세요", "초대 링크를 단톡방에 올리면 돼요", "#/invite", "초대하기"]);
  if (!next) todo.push(["다가오는 일정이 없어요", "일정을 올리면 팀원이 참석을 눌러요", "#/new", "일정 만들기"]);
  if (next && a.none.length) todo.push([`참석 미응답 ${a.none.length}명`, `${md(next.date)} ${wd(next.date)} ${next.type === "match" ? "경기" : "훈련"}`, "#/event/" + next.id, "보기"]);
  if (unclaimed().length) todo.push([`아직 앱에 안 들어온 선수 ${unclaimed().length}명`, "초대 링크를 단톡방에 올리면 명단에서 이름만 고르면 돼요", "#/invite", "초대하기"]);
  if (noProfile) todo.push([`선수 등록을 안 한 멤버 ${noProfile}명`, "들어와서 이름과 번호를 적으면 명단에 보여요", "#/players", "보기"]);
  const pr = Object.values(D("payreq")).reduce((n, d) => n + Object.values((d && d.items) || {}).filter(it => it && it.status === "req").length, 0);
  if (pr) todo.push([`입금 확인 요청 ${pr}건`, "통장에 들어왔는지 보고 확인을 눌러 주세요", "#/dues", "확인"]);
  Object.values(S.events).filter(e => !started(e)).forEach(e => { const n = guestReqs(e).filter(g => g.status === "req").length; if (n) todo.push([`용병 신청 ${n}명`, `${md(e.date)} ${evName(e)}`, "#/event/" + e.id, "보기"]); });
  const posN = people().filter(x => ((S.rsvp[x.uid] || {}).posReq || {}).status === "req").length;
  if (posN) todo.push([`포지션 변경 요청 ${posN}건`, "선수 목록에서 이름을 눌러 수락하거나 거절해요", "#/players", "보기"]);
  const admN = S.role === "owner" ? S.members.filter(m => m.admin_req && m.role === "member").length : 0;
  if (admN) todo.push([`운영진 신청 ${admN}명`, "선수 목록에서 이름을 눌러 수락하거나 거절해요", "#/players", "보기"]);
  Object.values(S.events).filter(scrimReady).forEach(e => { const d = Math.round((new Date(e.date + "T00:00:00+09:00") - new Date(todayStr() + "T00:00:00+09:00")) / 864e5); if (d >= 3) todo.push(["내전을 할 수 있어요", `${md(e.date)} 상대팀 미정, 참석과 대기 ${att(e).in + att(e).wait.length}명`, "#/event/" + e.id, "보기"]); });
  const today = Object.values(S.events).find(e => e.date === todayStr() && !Object.keys(e.check || {}).length);
  if (today) todo.push(["오늘 현장 출석을 불러 주세요", `${today.time || ""} ${evName(today)}`, "#/check/" + today.id, "출석"]);
  past().filter(e => e.type !== "training" && !e.score && Date.now() - evStart(e) < 7 * 864e5).forEach(e => todo.push(["경기 결과를 넣어 주세요", `${md(e.date)} ${evName(e)}, 넣으면 MOM 투표가 열려요`, "#/result/" + e.id, "입력"]));
  return `<header class="top" style="padding:10px 12px">${LOGO(32)}<span style="flex:1;line-height:1.2"><b style="font-size:17px">${esc(S.team.name)}</b><br><span class="hint" style="font-size:12px">${sport() === "soccer" ? "축구팀" : "풋살팀"}, 팀원 ${S.members.length}명, 나는 ${ROLE[S.role]}</span></span>${S.teams.length > 1 ? `<button class="iconbtn" data-act="switchTeam" aria-label="다른 팀">⇄</button>` : ""}</header>
  <div class="body">
    <div class="card"><div class="spread"><b style="font-size:16px">운영진이 할 일</b><span class="hint">${todo.length}개</span></div>
      ${todo.length ? `<div class="list">${todo.map(t => `<div class="li"><span style="flex:1;min-width:0"><b style="font-size:15px">${esc(t[0])}</b><br><span class="hint">${esc(t[1])}</span></span><a class="btn sm" href="${t[2]}">${esc(t[3])}</a></div>`).join("")}</div>` : `<span class="hint">지금은 할 일이 없어요.</span>`}
    </div>
    ${next ? `<div class="spread"><b>다음 일정</b><a href="#/schedule" class="hint" style="text-decoration:none">전체</a></div>${adminEventCard(next)}` : ""}
    ${homeExtras()}
    <div class="row" style="gap:8px"><a class="btn block" href="#/new">+ 일정 만들기</a><a class="btn block" href="#/invite">팀원 초대</a></div>
    <a class="btn" href="#/notices">공지와 설문</a>
    ${myProfile() ? `<a class="btn" href="#/member">내 선수 카드 보기 (팀원 화면)</a>` : ""}
    ${myProfile() ? "" : `<div class="card"><b>나도 선수로 등록하기</b><span class="hint">팀장도 선수로 등록하면 참석을 누르고 명단에 보여요.</span><a class="btn" href="${unclaimed().length ? "#/claim" : "#/me"}">선수 등록</a></div>`}
  </div>${nav("홈")}`;
}

/* ---------- 일정 ---------- */
function vSchedule() {
  if (isAdmin()) return vScheduleAdmin();
  const ev = upcoming();
  return `<header class="top"><span style="width:8px"></span><h1>일정</h1></header><div class="body">
    ${ev.length ? ev.map(e => eventCard(e)).join("") : `<div class="card empty"><b>다가오는 일정이 없어요</b><span class="hint">운영진이 일정을 올리면 여기에 보여요.</span></div>`}
    ${past().length ? `<b style="margin-top:8px">지난 일정</b>${past().slice(0, 10).map(e => eventCard(e, { noVote: true })).join("")}` : ""}
  </div>${nav("일정")}`;
}
/* ---------- 운영진 일정: 참석 현황과 운영 버튼 (팀원처럼 투표 버튼을 두지 않는다) ---------- */
const REMIND_GAP = 3600e3; // 미응답 알림: 운영진 모두 합쳐 1시간에 한 번 (바꿀 수 없음)
const remindInfo = () => D("team").remind || null;
const remindLeft = () => { const r = remindInfo(); return r && r.at ? Math.max(0, Date.parse(r.at) + REMIND_GAP - Date.now()) : 0; };
function adminEventCard(e, opt = {}) {
  const a = att(e); const closed = started(e); const pct = a.cap ? Math.min(100, Math.round(a.in * 100 / a.cap)) : 0;
  const greq = guestReqs(e).filter(g => g.status === "req").length; const un = unclaimed().length;
  const sub = e.type === "match" ? (e.opponent ? "vs " + e.opponent : "상대팀 미정") : e.type === "scrim" ? "내전 (A팀 대 B팀)" : "훈련";
  return `<div class="card">
    <div class="row" style="gap:12px"><a href="#/event/${esc(e.id)}" style="text-decoration:none;color:inherit;display:flex;gap:12px;align-items:center;flex:1;min-width:0"><span class="datebox ${closed ? "gray" : ""}"><span>${wd(e.date)}</span><b>${Number(e.date.slice(8, 10))}</b></span><span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px"><span class="row" style="gap:6px"><span class="tag ${e.type === "training" ? "blue" : ""}">${e.type === "match" ? "경기" : e.type === "scrim" ? "내전" : "훈련"}</span><b style="font-size:16px">${esc(e.time || "")}${e.end ? " ~ " + esc(e.end) : ""}</b></span><span class="hint">${esc(e.place || "장소 미정")}, ${esc(sub)}</span></span></a>${closed || opt.detail ? "" : `<a href="#/edit/${esc(e.id)}" class="hint" style="text-decoration:none;padding:8px 0;flex:none">수정</a>`}</div>
    ${closed ? `<div class="spread hint"><span>출석 ${Object.values(e.check || {}).filter(v => v === "in" || v === "late").length}명${e.score ? `, 결과 ${e.score.us} : ${e.score.them}` : ""}</span>${isPlay(e) && !e.score ? `<a href="#/result/${esc(e.id)}" style="font-weight:700;text-decoration:none">결과 입력</a>` : `<a href="#/event/${esc(e.id)}" style="text-decoration:none">보기</a>`}</div>` : `
    <div class="field" style="gap:6px"><div class="spread" style="font-size:13px"><span>참석 <b>${a.in}</b>${a.cap ? " / 정원 " + a.cap : ""}${a.late.length ? ", 늦참 " + a.late.length : ""}${a.no.length ? ", 불참 " + a.no.length : ""}${a.wait.length ? ", 대기 <b>" + a.wait.length + "</b>" : ""}</span><span style="color:#B91C1C;font-weight:700">미응답 ${a.none.length + un}</span></div>
      ${a.cap ? `<div style="height:8px;border-radius:999px;background:#E5E7EB;overflow:hidden"><div style="width:${pct}%;height:100%;background:#15803D"></div></div>` : ""}
      <span class="hint" style="font-size:12px">경기 시작 전까지 투표가 열려 있어요${un ? `. 미응답 중 ${un}명은 아직 앱에 안 들어왔어요` : ""}</span></div>
    ${greq ? `<div class="spread" style="background:#FFFBEB;border-radius:12px;padding:10px 12px;font-size:13px;color:#92400E"><span><b>용병 신청 ${greq}건</b> 수락을 기다려요</span><a href="#/event/${esc(e.id)}" style="font-weight:700;text-decoration:none;color:#92400E">확인</a></div>` : ""}
    ${scrimReady(e) ? `<div style="display:flex;flex-direction:column;gap:10px;background:#EEF2FF;border-radius:14px;padding:12px 14px"><span style="font-size:13px;color:#3730A3;line-height:1.5"><b>내전 가능</b> 상대팀이 미정이고 참석과 대기를 합쳐 ${a.in + a.wait.length}명이에요.</span><a class="btn sm" href="#/event/${esc(e.id)}" style="background:#3730A3;color:#FFFFFF">내전 검토하기</a></div>` : ""}
    <div style="display:grid;grid-template-columns:repeat(${e.type === "training" ? 2 : 3},minmax(0,1fr));gap:8px"><button class="btn sm" data-act="remindOpen" data-eid="${esc(e.id)}" style="background:#FEF2F2;color:#B91C1C;font-size:13px;padding:8px 2px;white-space:nowrap">미응답 알리기</button>${e.type !== "training" ? `<a class="btn sm pri" href="#/lineup/${esc(e.id)}" style="font-size:13px;padding:8px 2px;white-space:nowrap">라인업 짜기</a>` : ""}<a class="btn sm" href="#/check/${esc(e.id)}" style="font-size:13px;padding:8px 2px;white-space:nowrap">현장 출석</a></div>`}
  </div>`;
}
function vScheduleAdmin() {
  const m = UI.month || ym(); const [y, mo] = m.split("-").map(Number);
  const inMonth = e => e.date.slice(0, 7) === m;
  const up = upcoming().filter(inMonth), done = past().filter(inMonth);
  const later = upcoming().filter(e => e.date.slice(0, 7) > m).length;
  return `<header class="top" style="padding:10px 12px">${LOGO(32)}<h1 style="font-size:20px;font-weight:900">일정</h1><a class="btn sm pri" href="#/new">+ 일정 만들기</a></header><div class="body">
    <div class="spread card" style="padding:6px;flex-direction:row"><button class="iconbtn" data-act="monthGo" data-d="-1" aria-label="이전 달">‹</button><b style="font-size:16px">${y}년 ${mo}월</b><button class="iconbtn" data-act="monthGo" data-d="1" aria-label="다음 달">›</button></div>
    <b style="font-size:15px;color:#374151">다가오는 일정</b>
    ${up.length ? up.map(adminEventCard).join("") : `<div class="card empty"><b>${mo}월에 남은 일정이 없어요</b><span class="hint">${later ? `다음 달에 일정 ${later}개가 있어요.` : "일정을 만들면 팀원이 참석을 눌러요."}</span><a class="btn pri" href="#/new">일정 만들기</a></div>`}
    ${done.length ? `<b style="font-size:15px;color:#374151;margin-top:8px">지난 일정</b>${done.map(adminEventCard).join("")}` : ""}
  </div>${nav("일정")}`;
}
function remindSheet(eid) {
  const e = S.events[eid]; if (!e) return; const a = att(e); const un = unclaimed();
  const left = remindLeft(); const r = remindInfo();
  const names = a.none.map(x => x.name).concat(un.map(p => p.name));
  const ago = r && r.at ? Math.max(1, Math.round((Date.now() - Date.parse(r.at)) / 60000)) : 0;
  sheet(`<h3>미응답 ${names.length}명에게 알려요</h3><span class="hint">${esc(md(e.date) + " " + wd(e.date) + " " + (e.time || "") + " " + evName(e))}, 경기 시작 전까지 투표</span>
    <div class="list" style="max-height:38vh;overflow:auto">${a.none.map(x => `<div class="li"><b style="flex:1">${esc(x.name)}</b><span class="hint">앱 알림</span></div>`).join("")}${un.map(p => `<div class="li"><b style="flex:1">${esc(p.name)}</b><span class="tag gray">가입 전</span></div>`).join("") || ""}${names.length ? "" : `<span class="hint">미응답이 없어요.</span>`}</div>
    <div style="background:#FFFBEB;border-radius:14px;padding:12px 14px;font-size:13px;line-height:1.5;color:#92400E">${left ? `<b>${ago}분 전에 ${esc(nameOf(r.by))} 님이 알렸어요</b><br>미응답 알림은 운영진 모두 합쳐 1시간에 한 번만 보낼 수 있어요.` : `미응답 알림은 운영진 모두 합쳐 1시간에 한 번만 보낼 수 있어요.${r && r.at ? ` 마지막 알림은 ${esc(nameOf(r.by))} 님이 보냈어요.` : ""}`}<br>앱에 들어온 사람은 홈에 알림이 뜨고, 단톡방에 붙여 넣을 문구도 복사돼요.</div>
    <div class="row"><button class="btn block" data-act="closeSheet">닫기</button>${left ? `<button class="btn block" disabled>${Math.ceil(left / 60000)}분 뒤 가능</button>` : `<button class="btn pri block" data-act="remindSend" data-eid="${esc(e.id)}" ${names.length ? "" : "disabled"}>알리기</button>`}</div>`);
}
function vEvent(id) {
  const e = S.events[id]; if (!e) return `${top("일정", "#/schedule")}<div class="body"><div class="card empty"><b>지워진 일정이에요</b></div></div>`;
  const a = att(e); const adm = isAdmin(); const day = e.date <= todayStr();
  const grp = (t, arr, fmt) => `<div class="card"><div class="spread"><b>${t}</b><span class="hint">${arr.length}명</span></div>${arr.length ? `<div class="chips">${arr.map(x => `<span class="pill" style="background:#F3F4F6">${esc(x.name)}${fmt ? fmt(x) : ""}</span>`).join("")}</div>` : `<span class="hint">없어요</span>`}</div>`;
  const gs = guestsOf(e); const greq = guestReqs(e); const myG = greq.filter(g => g.u === S.uid);
  const hasLine = e.lineup && Object.keys(e.lineup).length;
  const tools = [];
  if (adm && day && started(e)) tools.push(`<a class="btn block" href="#/check/${esc(e.id)}">현장 출석</a>`);
  if (isPlay(e) && ((adm && started(e)) || (!adm && hasLine))) tools.push(`<a class="btn block" href="#/lineup/${esc(e.id)}">라인업</a>`);
  if (e.type === "scrim" && adm) tools.push(`<a class="btn block" href="#/squad/${esc(e.id)}">스쿼드 나누기</a>`);
  if (started(e) && isPlay(e)) tools.push(`<a class="btn block" href="#/game/${esc(e.id)}">결과와 MOM</a>`);
  const T = e.teams || {};
  const mv = myVote(e);
  return `${top(md(e.date) + " " + wd(e.date) + " " + evName(e), "#/schedule", adm ? `<a class="btn sm" href="#/edit/${esc(e.id)}">수정</a>` : "")}<div class="body">
    ${adm ? adminEventCard(e, { detail: true }) + (myProfile() && !started(e) ? `<div class="card"><b>내 참석</b>${voteRow(e, mv)}${mv.s === "late" ? lateRow(e, mv) : ""}</div>` : "") : eventCard(e)}
    ${adm && scrimReady(e) ? `<div class="card" style="background:#FFFBEB"><b>내전을 할 수 있어요</b><span class="hint">상대팀이 미정이고 참석과 대기를 합쳐 ${a.in + a.wait.length}명이에요. 운영진끼리 상의해서 내전으로 바꾸면 팀원 모두에게 보여요.</span><button class="btn pri" data-act="scrimConvert" data-eid="${esc(e.id)}">내전으로 바꾸기</button></div>` : ""}
    ${tools.length ? `<div class="row" style="flex-wrap:wrap">${tools.join("")}</div>` : ""}
    ${e.memo ? `<div class="card"><b>메모</b><div class="hint" style="white-space:pre-wrap;color:#374151">${esc(e.memo)}</div></div>` : ""}
    ${e.type === "scrim" ? grp("A팀 (조끼)", [...a.yes, ...a.late, ...a.wait].filter(x => T[x.uid] === "A")) + grp("B팀", [...a.yes, ...a.late, ...a.wait].filter(x => T[x.uid] === "B")) : ""}
    ${grp("참석", a.yes)}${grp("늦참", a.late, x => x.q ? `, ${x.q}Q부터` : "")}${a.cap ? grp("대기", a.wait, () => "") : ""}${grp("불참", a.no)}${grp("미응답", a.none)}${unclaimed().length ? `<span class="hint">아직 앱에 안 들어온 선수 ${unclaimed().length}명은 참석을 누를 수 없어요. 초대 링크로 들어와 이름을 고르면 돼요.</span>` : ""}
    ${a.cap ? `<span class="hint">정원이 차면 다음 신청은 대기로 들어가고, 자리가 나면 순서대로 올라가요.</span>` : ""}
    ${e.type !== "training" ? `<div class="card"><div class="spread"><b>용병</b><span class="hint">${gs.length}명</span></div>
      ${gs.length ? `<div class="list">${gs.map(g => `<div class="li"><span style="flex:1"><b>${esc(g.name)}</b><br><span class="hint">${esc([g.pos, nameOf(g.by) + " 님 지인"].filter(Boolean).join(", "))}</span></span>${adm ? `<button class="iconbtn" data-act="guestDel" data-eid="${esc(e.id)}" data-g="${esc(g.id)}" aria-label="빼기">✕</button>` : ""}</div>`).join("")}</div>` : ""}
      ${adm ? greq.filter(g => g.status === "req").map(g => `<div class="li" style="background:#F9FAFB;border-radius:12px;padding:10px"><span style="flex:1"><b>${esc(g.name)}</b> 신청<br><span class="hint">${esc([g.pos, g.rel, nameOf(g.u) + " 님이 신청"].filter(Boolean).join(", "))}</span></span><button class="btn sm" data-act="guestNo" data-u="${esc(g.u)}" data-k="${esc(g.k)}">거절</button><button class="btn sm pri" data-act="guestOk" data-eid="${esc(e.id)}" data-u="${esc(g.u)}" data-k="${esc(g.k)}">수락</button></div>`).join("") : myG.map(g => `<span class="hint">${esc(g.name)} 신청: ${g.status === "ok" ? "수락됐어요" : g.status === "no" ? "이번에는 어려워요" : "운영진이 보고 있어요"}</span>`).join("")}
      ${!started(e) && myProfile() ? `<button class="btn" data-act="guestReq" data-eid="${esc(e.id)}">+ 용병 신청</button>` : ""}</div>` : ""}
  </div>`;
}
function vEventForm(id) {
  const f = S.form; const isNew = !id;
  const chip = (k, v, l) => `<button class="chip ${f[k] === v ? "on" : ""}" data-act="pick" data-k="${k}" data-v="${v}">${l}</button>`;
  return `${top(isNew ? "일정 만들기" : "일정 수정", isNew ? "#/schedule" : "#/event/" + id)}<div class="body">
    <div class="card">
      <div class="field"><span class="lab">종류</span>${f.type === "scrim" ? `<span class="hint">내전으로 바뀐 일정이에요. A팀과 B팀은 스쿼드 나누기에서 정해요.</span>` : `<div class="chips">${chip("type", "match", "경기")}${chip("type", "training", "훈련")}</div>`}</div>
      <label class="field"><span class="lab">날짜</span><input class="inp" type="date" data-bind="date" value="${esc(f.date || "")}" min="${todayStr()}"></label>
      <div class="row" style="gap:8px"><label class="field" style="flex:1"><span class="lab">시작</span><input class="inp" type="time" data-bind="time" value="${esc(f.time || "")}"></label><label class="field" style="flex:1"><span class="lab">끝</span><input class="inp" type="time" data-bind="end" value="${esc(f.end || "")}"></label></div>
      <label class="field"><span class="lab">장소</span><input class="inp" data-bind="place" value="${esc(f.place || "")}" maxlength="40" placeholder="예: 잠실 풋살장 2번 코트"></label>
      ${f.type === "match" ? `<label class="field"><span class="lab">상대팀</span><input class="inp" data-bind="opponent" value="${esc(f.opponent || "")}" maxlength="30" placeholder="비워 두면 상대팀 미정"></label>` : ""}
      <div class="field"><span class="lab">정원</span><div class="row"><button class="btn sm" data-act="cap" data-d="-1" aria-label="정원 줄이기">−</button><b style="min-width:56px;text-align:center;font-size:18px">${f.cap ? f.cap + "명" : "제한 없음"}</b><button class="btn sm" data-act="cap" data-d="1" aria-label="정원 늘리기">+</button></div><span class="hint">정원이 차면 다음 신청은 대기로 들어가요.</span></div>
      <label class="field"><span class="lab">메모</span><textarea class="inp" data-bind="memo" placeholder="준비물, 주차 같은 안내" style="min-height:72px">${esc(f.memo || "")}</textarea></label>
      <span class="hint">참석 투표는 일정 시작 전까지 열려 있어요.</span>
    </div>
    ${isNew ? "" : `<button class="btn danger" data-act="delEvent" data-eid="${esc(id)}">일정 지우기</button>`}
  </div><div class="cta"><button class="btn pri block" data-act="saveEvent" data-eid="${esc(id || "")}">${isNew ? "일정 올리기" : "저장"}</button></div>`;
}

/* ---------- 선수, 준비 중 탭 ---------- */
function vPlayers() {
  const num = x => Number(x) || 999;
  const ps = people().map(x => ({ ...x, kind: "m" }));
  const un = unclaimed().map(p => ({ kind: "p", uid: "", pid: p.id, role: "member", name: p.name, p }));
  const all = ps.concat(un).sort((a, b) => num(a.p.num) - num(b.p.num) || a.name.localeCompare(b.name, "ko"));
  const row = x => x.kind === "p"
    ? `<div class="li" data-act="rosterOpen" data-pid="${esc(x.pid)}" role="button" tabindex="0" style="cursor:pointer"><span class="av" style="background:#F3F4F6;color:#6B7280">${esc(x.p.num || x.name.slice(0, 1))}</span><span style="flex:1;min-width:0"><b>${esc(x.name)}</b><br><span class="hint">${x.p.num ? esc(x.p.num) + "번, " : ""}${esc([x.p.pos1, x.p.pos2].filter(Boolean).join(", "))}</span></span><span class="tag gray">가입 전</span></div>`
    : `<div class="li" ${isAdmin() || x.uid === S.uid ? `data-act="playerOpen" data-u="${esc(x.uid)}" role="button" tabindex="0" style="cursor:pointer"` : ""}><span class="av">${esc(x.p.num || x.name.slice(0, 1))}</span><span style="flex:1;min-width:0"><b>${esc(x.name)}</b>${x.uid === S.uid ? ` <span class="hint">나</span>` : ""}<br><span class="hint">${x.p.num ? esc(x.p.num) + "번, " : ""}${esc([x.p.pos1, x.p.pos2].filter(Boolean).join(", ") || (profileOf(x.uid) ? "포지션 미정" : "선수 등록 전"))}</span></span>${isAdmin() && ((S.rsvp[x.uid] || {}).posReq || {}).status === "req" ? `<span class="tag blue">포지션 요청</span>` : ""}${S.role === "owner" && x.role === "member" && (S.members.find(m => m.user_id === x.uid) || {}).admin_req ? `<span class="tag blue">운영진 신청</span>` : ""}${x.role !== "member" ? `<span class="tag">${ROLE[x.role]}</span>` : ""}</div>`;
  return `<header class="top"><span style="width:8px"></span><h1>선수</h1>${isAdmin() ? `<a class="btn sm" href="#/settings">팀 설정</a><a class="btn sm pri" href="#/invite">+ 초대</a>` : ""}</header><div class="body">
    <div class="card"><div class="spread"><b>${all.length}명</b><span class="hint">앱에 들어옴 ${ps.length}명${un.length ? `, 가입 전 ${un.length}명` : ""}</span></div>
      <div class="list">${all.map(row).join("")}</div>
      <span class="hint">${isAdmin() ? "이름을 누르면 권한, 요청, 내보내기를 볼 수 있어요. 가입 전 선수는 초대 링크로 들어와 자기 이름을 고르면 연결돼요." : "내 이름을 누르면 프로필과 운영진 신청을 볼 수 있어요."}</span>
    </div>
    ${isAdmin() ? `<a class="btn" href="#/roster-import">명단 붙여 넣어 한 번에 등록</a>` : ""}
    ${myProfile() && !isAdmin() ? `<a class="btn" href="#/posreq">포지션 변경 요청</a>` : ""}
    ${S.settings.rules && S.settings.rules.length ? `<div class="card"><b>우리 팀 수칙</b><div class="list">${S.settings.rules.map(r => `<div class="li"><span style="flex:1">${esc(r.label)}</span>${Number(r.amount) ? `<b>${won(r.amount)}</b>` : ""}</div>`).join("")}</div></div>` : ""}
    <div class="card"><div class="row" style="justify-content:space-between"><span class="hint">로그인: 카카오</span><span class="row"><button class="btn sm" data-act="switchTeam">다른 팀, 새 팀</button><button class="btn sm" data-act="logout">로그아웃</button></span></div><a class="hint" href="../../privacy.html">개인정보처리방침과 이용약관</a></div>
  </div>${nav("선수")}`;
}

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
    const data = { dues, fines: finesOf(u).map(f => ({ id: f.id, date: f.date, reason: f.reason, amount: f.amount, paid: !!f.paid })), fee: Number(S.settings.fee) || 0, mode: feeMode() };
    if (JSON.stringify(D("mydues")[u] || null) !== JSON.stringify(data)) { try { await setDoc("mydues", u, data); } catch (e) { console.error(e); } }
  }
}

/* ---------- 회비 ---------- */
function vDues() {
  if (!isAdmin()) return vDuesMember();
  const mode = feeMode(); const reqs = [];
  Object.entries(D("payreq")).forEach(([u, d]) => Object.entries((d && d.items) || {}).forEach(([k, it]) => { if (it && it.status === "req") reqs.push({ u, k, ...it }); }));
  let body = "";
  if (mode === "none") body = `<div class="card"><b>회비를 받지 않는 팀이에요</b><span class="hint">팀 설정에서 월회비나 경기마다로 바꿀 수 있어요.</span><a class="btn sm" href="#/settings" style="align-self:flex-start">팀 설정</a></div>`;
  else {
    const refs = mode === "monthly" ? monthsList() : past().filter(isPlay).slice(0, 12).map(e => e.id);
    if (!UI.ref || !refs.includes(UI.ref)) UI.ref = refs[0] || "";
    const key = duesKey(UI.ref); const ev = mode === "per_game" ? S.events[UI.ref] : null;
    const who = people().filter(x => mode === "monthly" || (ev && cameTo(ev, x.uid)));
    const paid = who.filter(x => paidOf(key, x.uid));
    body = `<div class="card"><div class="chips">${refs.map(r => `<button class="chip sm ${r === UI.ref ? "on" : ""}" data-act="duesRef" data-v="${esc(r)}">${mode === "monthly" ? mLabel(r) : esc(md(S.events[r].date) + " " + evName(S.events[r]))}</button>`).join("") || `<span class="hint">아직 끝난 경기가 없어요</span>`}</div>
      ${UI.ref ? `<div class="spread"><span><b style="font-size:26px">${paid.length}</b> / ${who.length}명</span><b>${won(paid.length * (Number(S.settings.fee) || 0))}</b></div>
      <div class="list">${who.map(x => `<div class="li"><span style="flex:1"><b>${esc(x.name)}</b></span>${paidOf(key, x.uid) ? `<span class="tag">납부</span>` : `<span class="tag gray">미납</span>`}<button class="btn sm" data-act="duesToggle" data-key="${esc(key)}" data-u="${esc(x.uid)}">${paidOf(key, x.uid) ? "취소" : "받음"}</button></div>`).join("")}</div>
      ${who.length > paid.length ? `<button class="btn" data-act="duesRemind">미납 ${who.length - paid.length}명에게 보낼 문구 복사</button>` : ""}` : ""}</div>`;
  }
  const unpaidF = Object.entries(D("fines")).map(([id, f]) => ({ id, ...f })).filter(f => !f.paid).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return `<header class="top"><span style="width:8px"></span><h1>회비</h1><a class="btn sm" href="#/dues-settings">회비 설정</a></header><div class="body">
    ${reqs.length ? `<div class="card"><div class="spread"><b>입금 확인 요청</b><span class="tag">${reqs.length}건</span></div><div class="list">${reqs.map(r => `<div class="li"><span style="flex:1"><b>${esc(nameOf(r.u))}</b><br><span class="hint">${esc(r.label || "")}, ${won(r.amount)}</span></span><button class="btn sm" data-act="payNo" data-u="${esc(r.u)}" data-k="${esc(r.k)}">아님</button><button class="btn sm pri" data-act="payOk" data-u="${esc(r.u)}" data-k="${esc(r.k)}">확인</button></div>`).join("")}</div><span class="hint">통장에 들어온 게 맞는지 보고 눌러 주세요.</span></div>` : ""}
    ${body}
    <div class="card"><div class="spread"><b>벌금 미납</b><b>${won(unpaidF.reduce((s, f) => s + (Number(f.amount) || 0), 0))}</b></div>${unpaidF.length ? `<div class="list">${unpaidF.map(f => `<div class="li"><span style="flex:1"><b>${esc(nameOf(f.uid))}</b><br><span class="hint">${esc(md(f.date || todayStr()))} ${esc(f.reason)}</span></span><b>${won(f.amount)}</b><button class="btn sm" data-act="fineToggle" data-id="${esc(f.id)}">받음</button></div>`).join("")}</div>` : `<span class="hint">미납 벌금이 없어요.</span>`}<span class="hint">벌금은 현장 출석에서 팀 수칙대로 매겨져요.</span></div>
    <a class="btn" href="#/ledger">팀 통장 보기</a>
  </div>${nav("회비")}`;
}
function vDuesMember() {
  const my = D("mydues")[S.uid] || {}; const mode = feeMode();
  const dues = Object.entries(my.dues || {}).sort((a, b) => b[0].localeCompare(a[0]));
  const unpaid = dues.filter(([, v]) => v !== "paid"); const fines = (my.fines || []); const uf = fines.filter(f => !f.paid);
  const reqItems = Object.values(((D("payreq")[S.uid] || {}).items) || {}).filter(it => it.status === "req");
  const total = unpaid.length * (Number(S.settings.fee) || 0) + uf.reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const label = k => k.startsWith("m-") ? mLabel(k.slice(2)) + " 회비" : (S.events[k.slice(2)] ? md(S.events[k.slice(2)].date) + " 경기 회비" : "경기 회비");
  return `<header class="top"><span style="width:8px"></span><h1>회비</h1></header><div class="body">
    ${mode === "none" ? `<div class="card"><b>회비를 받지 않는 팀이에요</b></div>` : ""}
    <div class="card"><span class="hint">내가 낼 돈</span><b style="font-size:28px">${won(total)}</b>
      ${reqItems.length ? `<div class="hint" style="background:#F0FDF4;color:#166534;border-radius:12px;padding:10px 12px">입금했다고 알렸어요. 운영진이 확인하면 납부로 바뀌어요.</div>` : total ? `<button class="btn pri" data-act="paySheet">입금하기</button>` : `<span class="hint">낼 돈이 없어요.</span>`}</div>
    ${dues.length ? `<div class="card"><b>회비</b><div class="list">${dues.map(([k, v]) => `<div class="li"><span style="flex:1">${esc(label(k))}</span>${v === "paid" ? `<span class="tag">납부</span>` : `<span class="tag gray">미납</span>`}</div>`).join("")}</div></div>` : ""}
    <div class="card"><b>내 벌금</b>${fines.length ? `<div class="list">${fines.map(f => `<div class="li"><span style="flex:1">${esc(md(f.date || todayStr()))} ${esc(f.reason)}</span><b>${won(f.amount)}</b>${f.paid ? `<span class="tag">납부</span>` : `<span class="tag gray">미납</span>`}</div>`).join("")}</div>` : `<span class="hint">벌금이 없어요.</span>`}</div>
    <a class="btn" href="#/ledger">팀 통장 보기</a>
  </div>${nav("회비")}`;
}
function vDuesSettings() {
  const f = S.form;
  return `${top("회비 설정", "#/dues")}<div class="body"><div class="card">
    <label class="field"><span class="lab">은행</span><input class="inp" data-bind="bank" value="${esc(f.bank || "")}" placeholder="예: 카카오뱅크"></label>
    <label class="field"><span class="lab">계좌번호</span><input class="inp" data-bind="account" value="${esc(f.account || "")}" inputmode="numeric" placeholder="예: 3333-01-1234567"></label>
    <label class="field"><span class="lab">예금주</span><input class="inp" data-bind="holder" value="${esc(f.holder || "")}" placeholder="예: 정성목"></label>
    <span class="hint">팀원이 입금하기를 누르면 이 계좌가 보여요. 회비 방식과 금액은 팀 설정에서 바꿔요.</span><a class="btn sm" href="#/settings" style="align-self:flex-start">팀 설정</a>
  </div></div><div class="cta"><button class="btn pri block" data-act="saveBank">저장</button></div>`;
}
function vLedger() {
  const items = ((D("team").ledger || {}).items || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const bal = items.reduce((s, x) => s + (x.type === "in" ? 1 : -1) * (Number(x.amount) || 0), 0);
  const f = S.form;
  return `${top("팀 통장", "#/dues")}<div class="body">
    <div class="card"><span class="hint">잔액</span><b style="font-size:28px">${won(bal)}</b></div>
    ${isAdmin() ? `<div class="card"><b>직접 기록</b><div class="chips"><button class="chip sm ${f.type !== "out" ? "on" : ""}" data-act="pick" data-k="type" data-v="in">들어온 돈</button><button class="chip sm ${f.type === "out" ? "on" : ""}" data-act="pick" data-k="type" data-v="out">나간 돈</button></div>
      <div class="row"><input class="inp" type="date" data-bind="date" value="${esc(f.date || todayStr())}" style="flex:1" aria-label="날짜"><input class="inp" data-bind="amount" value="${esc(f.amount || "")}" inputmode="numeric" placeholder="금액" style="flex:1" aria-label="금액"></div>
      <input class="inp" data-bind="label" value="${esc(f.label || "")}" placeholder="내용 (예: 구장비)" aria-label="내용"><button class="btn pri" data-act="ledgerAdd">기록하기</button></div>` : ""}
    <div class="card"><b>내역</b>${items.length ? `<div class="list">${items.map(x => `<div class="li"><span style="flex:1">${esc(md(x.date))} ${esc(x.label)}</span><b style="color:${x.type === "in" ? "#15803D" : "#B91C1C"}">${x.type === "in" ? "+" : "-"} ${won(x.amount)}</b>${isAdmin() ? `<button class="iconbtn" data-act="ledgerDel" data-id="${esc(x.id)}" aria-label="지우기">✕</button>` : ""}</div>`).join("")}</div>` : `<span class="hint">아직 내역이 없어요.</span>`}</div>
  </div>`;
}

/* ---------- 현장 출석과 벌금 ---------- */
function vCheck(id) {
  const e = S.events[id]; if (!e) return vEvent(id);
  const a = att(e); const list = [...a.yes, ...a.late, ...a.no, ...a.none, ...a.wait];
  const ck = e.check || {}; const cnt = { in: 0, late: 0, absent: 0 }; Object.values(ck).forEach(v => { if (cnt[v] != null) cnt[v]++; });
  const late = ruleAmt("late"), abs = ruleAmt("absent");
  const b = (u, v, l) => `<button class="chip sm ${ck[u] === v ? "on" : ""}" data-act="checkSet" data-eid="${esc(e.id)}" data-u="${esc(u)}" data-v="${v}">${l}</button>`;
  return `${top("현장 출석", "#/event/" + e.id)}<div class="body">
    <div class="card"><b>${esc(md(e.date) + " " + wd(e.date) + " " + (e.time || "") + " " + evName(e))}</b><div class="stat"><span><b>${cnt.in}</b><span>출석</span></span><span><b>${cnt.late}</b><span>지각</span></span><span><b>${cnt.absent}</b><span>결석</span></span></div><span class="hint">참석이라고 한 사람이 먼저 나와요. 온 사람은 출석, 늦게 온 사람은 지각, 안 온 사람은 결석으로 눌러요.</span></div>
    <div class="card"><div class="list">${list.map(x => `<div class="li" style="flex-wrap:wrap"><span style="flex:1;min-width:120px"><b>${esc(x.name)}</b><br><span class="hint">${x.s === "late" ? "늦참 신청" + (x.q ? ", " + x.q + "Q부터" : "") : a.yes.includes(x) ? "참석 신청" : a.no.includes(x) ? "불참" : a.wait.includes(x) ? "대기" : "미응답"}</span></span><span class="chips">${b(x.uid, "in", "출석")}${b(x.uid, "late", "지각")}${b(x.uid, "absent", "결석")}</span></div>`).join("")}</div></div>
    <div class="card"><b>팀 수칙대로 벌금</b><span class="hint">지각 ${won(late)}, 결석 ${won(abs)} (참석이나 늦참이라고 했는데 안 온 사람만)</span><button class="btn pri" data-act="finesApply" data-eid="${esc(e.id)}">벌금 매기기</button></div>
  </div>`;
}

/* ---------- 기록과 MOM ---------- */
function vRecords() {
  const year = todayStr().slice(0, 4);
  const evs = past().filter(e => e.date.startsWith(year));
  const games = evs.filter(e => e.type === "match" && e.score);
  const w = games.filter(e => +e.score.us > +e.score.them).length, d = games.filter(e => +e.score.us === +e.score.them).length, l = games.length - w - d;
  const attRank = people().map(x => ({ ...x, n: evs.filter(e => cameTo(e, x.uid)).length })).sort((a, b) => b.n - a.n).slice(0, 5);
  const momC = {}; evs.filter(momClosed).forEach(e => momWinners(e).forEach(u => { momC[u] = (momC[u] || 0) + 1; }));
  const mine = evs.filter(e => cameTo(e, S.uid)).length;
  return `<header class="top"><span style="width:8px"></span><h1>기록</h1></header><div class="body">
    <div class="card"><span class="hint">${year} 시즌</span><div class="stat"><span><b>${games.length}</b><span>경기</span></span><span><b style="font-size:19px;line-height:1.6">${w}승 ${d}무 ${l}패</b><span>전적</span></span><span><b>${mine}</b><span>내 출석</span></span></div></div>
    <b>지난 일정</b>
    ${evs.length ? evs.map(e => { const win = momWinners(e); return `<a class="card" href="#/game/${esc(e.id)}" style="text-decoration:none;color:inherit"><div class="row" style="gap:12px"><span class="datebox gray"><span>${wd(e.date)}</span><b>${Number(e.date.slice(8, 10))}</b></span><span style="flex:1;min-width:0"><span class="row" style="gap:6px"><span class="tag ${e.type === "match" ? "" : "blue"}">${e.type === "match" ? "경기" : e.type === "scrim" ? "내전" : "훈련"}</span><b>${e.score ? (e.type === "scrim" ? `A팀 ${e.score.us} : ${e.score.them} B팀` : `${e.score.us} : ${e.score.them}`) : isPlay(e) ? "결과 대기" : esc(e.place || "")}</b></span><br><span class="hint">${esc(evName(e))}${momOpen(e) ? ", MOM 투표 중" : win.length && momClosed(e) ? ", MOM " + win.map(nameOf).join(", ") : ""}${cameTo(e, S.uid) ? ", 나 출석" : ""}</span></span>${isAdmin() && isPlay(e) && !e.score ? `<span class="tag gray">입력</span>` : ""}</div></a>`; }).join("") : `<div class="card empty"><b>아직 지난 일정이 없어요</b></div>`}
    <div class="card"><b>출석 순위</b><div class="list">${attRank.map((x, i) => `<div class="li"><b style="width:20px">${i + 1}</b><span style="flex:1">${esc(x.name)}</span><span class="hint">${x.n} / ${evs.length}</span></div>`).join("")}</div></div>
    ${Object.keys(momC).length ? `<div class="card"><b>MOM</b><div class="list">${Object.entries(momC).sort((a, b) => b[1] - a[1]).map(([u, n]) => `<div class="li"><span style="flex:1">${esc(nameOf(u))}</span><b>${n}회</b></div>`).join("")}</div></div>` : ""}
  </div>${nav("기록")}`;
}
function vGame(id) {
  const e = S.events[id]; if (!e) return vRecords();
  const came = people().filter(x => cameTo(e, x.uid)); const t = D("tally")["mom-" + e.id] || { n: 0, c: {} };
  const myMom = (myUv().mom || {})[e.id]; const win = momWinners(e);
  const goals = (e.goals || []);
  return `${top(md(e.date) + " " + evName(e), "#/records", isAdmin() && isPlay(e) ? `<a class="btn sm" href="#/result/${esc(e.id)}">${e.score ? "결과 수정" : "결과 입력"}</a>` : "")}<div class="body">
    <div class="card" style="align-items:center;text-align:center">${e.score ? `<b style="font-size:40px">${e.score.us} : ${e.score.them}</b><span class="hint">${e.type === "scrim" ? "A팀 대 B팀" : esc(evName(e))}</span>` : `<b>${isPlay(e) ? "결과를 기다리고 있어요" : "훈련"}</b><span class="hint">${isPlay(e) ? "운영진이 결과를 넣으면 MOM 투표가 열려요" : esc(e.place || "")}</span>`}
      ${goals.length ? `<div class="chips" style="justify-content:center">${goals.map(g => `<span class="pill" style="background:#F3F4F6">골 ${esc(g.name || nameOf(g.uid))}</span>`).join("")}</div>` : ""}</div>
    ${momOpen(e) && cameTo(e, S.uid) ? (myMom ? `<div class="card"><b>MOM 투표를 냈어요</b><span class="hint">${esc(md(momDeadline(e).toISOString().slice(0, 10)))} 12시에 마감돼요. 결과는 마감 뒤에 보여요.</span></div>` : `<div class="card"><b>오늘의 MOM을 골라 주세요</b><span class="hint">익명이에요. 한 번 내면 바꿀 수 없어요.</span><div class="chips">${came.filter(x => x.uid !== S.uid).map(x => `<button class="chip ${UI.mom === x.uid ? "on" : ""}" data-act="momPick" data-u="${esc(x.uid)}">${esc(x.name)}</button>`).join("")}</div><button class="btn pri" data-act="momSend" data-eid="${esc(e.id)}" ${UI.mom ? "" : "disabled"}>투표하기</button></div>`) : ""}
    ${momClosed(e) && e.score ? `<div class="card"><b>MOM</b>${win.length ? `<b style="font-size:22px">${win.map(u => esc(nameOf(u))).join(", ")}</b><span class="hint">${t.n}명 투표</span>` : `<span class="hint">투표가 없었어요.</span>`}</div>` : ""}
    <div class="card"><div class="spread"><b>출석</b><span class="hint">${came.length}명</span></div><div class="chips">${came.map(x => `<span class="pill" style="background:#F3F4F6">${esc(x.name)}${(e.check || {})[x.uid] === "late" ? " (지각)" : ""}</span>`).join("") || `<span class="hint">출석 기록이 없어요</span>`}</div></div>
  </div>`;
}
function vResult(id) {
  const e = S.events[id]; if (!e) return vRecords(); const f = S.form;
  const came = people().filter(x => cameTo(e, x.uid));
  return `${top("결과 입력", "#/game/" + e.id)}<div class="body">
    <div class="card"><b>${e.type === "scrim" ? "A팀 대 B팀" : "우리 대 " + esc(e.opponent || "상대")}</b>
      <div class="row" style="justify-content:center;gap:16px">${["us", "them"].map(k => `<span style="display:flex;flex-direction:column;align-items:center;gap:6px"><span class="hint">${k === "us" ? (e.type === "scrim" ? "A팀" : "우리") : (e.type === "scrim" ? "B팀" : "상대")}</span><span class="row"><button class="btn sm" data-act="score" data-k="${k}" data-d="-1" aria-label="줄이기">−</button><b style="font-size:32px;min-width:40px;text-align:center">${Number(f[k]) || 0}</b><button class="btn sm" data-act="score" data-k="${k}" data-d="1" aria-label="늘리기">+</button></span></span>`).join("")}</div></div>
    <div class="card"><b>골 넣은 사람</b><span class="hint">누를 때마다 한 골씩 더해요. 골 칩을 누르면 빠져요.</span><div class="chips">${came.map(x => `<button class="chip sm" data-act="goalAdd" data-u="${esc(x.uid)}">${esc(x.name)}</button>`).join("")}</div>
      <div class="chips">${(f.goals || []).map((g, i) => `<button class="chip sm on" data-act="goalDel" data-i="${i}">${esc(nameOf(g.uid))} ✕</button>`).join("")}</div></div>
    <span class="hint">결과를 저장하면 출석한 팀원이 다음 날 12시까지 MOM 투표를 할 수 있어요.</span>
  </div><div class="cta"><button class="btn pri block" data-act="saveResult" data-eid="${esc(e.id)}">저장</button></div>`;
}

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
function vNoticeNew() {
  const f = S.form;
  return `${top("공지 쓰기", "#/notices")}<div class="body"><div class="card">
    <label class="field"><span class="lab">제목</span><input class="inp" data-bind="title" value="${esc(f.title || "")}" maxlength="60" placeholder="예: 12월부터 구장이 바뀌어요"></label>
    <label class="field"><span class="lab">내용</span><textarea class="inp" data-bind="body" placeholder="자세한 안내">${esc(f.body || "")}</textarea></label>
    <div class="chips"><button class="chip sm ${f.pinned ? "on" : ""}" data-act="pick" data-k="pinned" data-v="${f.pinned ? "" : "1"}">맨 위에 고정</button><button class="chip sm ${f.poll ? "on" : ""}" data-act="pick" data-k="poll" data-v="${f.poll ? "" : "1"}">설문 붙이기</button></div>
    ${f.poll ? `<div class="field"><span class="lab">보기</span>${(f.opts || []).map((o, i) => `<input class="inp" data-opt="${i}" value="${esc(o.label)}" placeholder="보기 ${i + 1}" aria-label="보기 ${i + 1}">`).join("")}<button class="btn sm" data-act="optAdd" style="align-self:flex-start">+ 보기 추가</button></div><label class="field"><span class="lab">마감</span><input class="inp" type="date" data-bind="until" value="${esc(f.until || "")}"></label>` : ""}
  </div></div><div class="cta"><button class="btn pri block" data-act="noticeSave">올리기</button></div>`;
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
const FORM = { futsal: ["GK", "DF", "LW", "RW", "FW"], soccer: ["GK", "LB", "CB", "CB", "RB", "CDM", "CDM", "LW", "CAM", "RW", "ST"] };
// 자리와 비슷한 포지션 (정확히 맞는 사람이 없을 때 다음으로 고른다)
const NEAR = { LB: ["LWB"], RB: ["RWB"], LWB: ["LB"], RWB: ["RB"], CB: ["CDM"], CDM: ["CM", "CB"], CM: ["CDM", "CAM"], CAM: ["CM", "ST"], LW: ["LM", "RW"], RW: ["RM", "LW"], ST: ["FW", "CAM"], DF: ["CB"], FW: ["ST"] };
function lineupPlayers(e, side) {
  const a = att(e);
  let ps = [...a.yes, ...a.late].map(x => ({ uid: x.uid, name: x.name, from: x.s === "late" ? (x.q || 1) : 1, pos: [x.p.pos1, x.p.pos2] }));
  guestsOf(e).forEach(g => ps.push({ uid: "g:" + g.id, name: g.name + " (용병)", from: 1, pos: [g.pos] }));
  if (e.type === "scrim" && e.teams) ps = ps.filter(p => (e.teams[p.uid] || "A") === side);
  return ps;
}
function autoLineup(e, side) {
  const slots = FORM[sport()]; const qn = QN[sport()]; const ps = lineupPlayers(e, side); const cnt = {}; ps.forEach(p => { cnt[p.uid] = 0; });
  const gk = ps.find(p => p.pos[0] === "GK") || ps.find(p => p.pos[1] === "GK");
  const out = {};
  for (let k = 1; k <= qn; k++) {
    const avail = ps.filter(p => p.from <= k);
    const pick = []; const q = {};
    if (gk && gk.from <= k) { q[0] = gk.uid; pick.push(gk.uid); }
    const field = avail.filter(p => !pick.includes(p.uid)).sort((x, y) => cnt[x.uid] - cnt[y.uid] || Math.random() - 0.5);
    const chosen = field.slice(0, slots.length - pick.length);
    // 포지션이 맞는 사람부터 자리에 앉힌다
    const fit = [p => p.pos[0] === pos0, p => p.pos[1] === pos0, p => (NEAR[pos0] || []).includes(p.pos[0]), p => (NEAR[pos0] || []).includes(p.pos[1])]; let pos0 = "";
    for (const f of fit) slots.forEach((pos, i) => { if (q[i]) return; pos0 = pos; const j = chosen.findIndex(f); if (j >= 0) q[i] = chosen.splice(j, 1)[0].uid; });
    slots.forEach((pos, i) => { if (!q[i] && chosen.length) q[i] = chosen.shift().uid; });
    Object.values(q).forEach(u => { cnt[u] = (cnt[u] || 0) + 1; });
    out[k] = q;
  }
  return { formation: slots, q: out };
}
function vLineup(id) {
  const e = S.events[id]; if (!e) return vSchedule();
  const side = e.type === "scrim" ? UI.side : "main";
  const L = (S.form.lineup && S.form.lineupFor === id + side) ? S.form.lineup : ((e.lineup || {})[side] || null);
  const ps = lineupPlayers(e, side); const qn = QN[sport()];
  const nm = u => u ? (u.startsWith("g:") ? ((e.guests || {})[u.slice(2)] || {}).name + " (용병)" : nameOf(u)) : "";
  const cnt = {}; if (L) Object.values(L.q || {}).forEach(q => Object.values(q).forEach(u => { cnt[u] = (cnt[u] || 0) + 1; }));
  const k = Math.min(UI.q, qn); const q = (L && L.q && L.q[k]) || {};
  const benched = ps.filter(p => !Object.values(q).includes(p.uid));
  const edit = isAdmin();
  return `${top("라인업", "#/event/" + e.id, edit ? `<button class="btn sm" data-act="autoLineup" data-eid="${esc(e.id)}">자동 배치</button>` : "")}<div class="body">
    ${e.type === "scrim" ? `<div class="chips"><button class="chip ${side === "A" ? "on" : ""}" data-act="lineSide" data-v="A">A팀 (조끼)</button><button class="chip ${side === "B" ? "on" : ""}" data-act="lineSide" data-v="B">B팀</button></div>` : ""}
    ${!L ? `<div class="card empty"><b>아직 라인업이 없어요</b><span class="hint">${edit ? "자동 배치를 누르면 포지션에 맞춰 쿼터별 자리와 휴식을 고르게 짜요." : "운영진이 라인업을 짜면 여기에 보여요."}</span>${edit ? `<button class="btn pri" data-act="autoLineup" data-eid="${esc(e.id)}">자동 배치</button>` : ""}</div>` : `
    <div class="chips">${Array.from({ length: qn }, (_, i) => i + 1).map(n => `<button class="chip sm ${n === k ? "on" : ""}" data-act="lineQ" data-v="${n}">${n}Q</button>`).join("")}</div>
    <div class="card" style="background:#1E6B45;color:#FFFFFF"><div class="list">${L.formation.map((pos, i) => `<div class="li" style="border-color:rgba(255,255,255,.15)"><b style="width:40px">${pos}</b>${edit ? `<select class="inp" data-line="${i}" data-eid="${esc(e.id)}" style="flex:1" aria-label="${k}쿼터 ${pos}"><option value="">비움</option>${ps.map(p => `<option value="${esc(p.uid)}" ${q[i] === p.uid ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select>` : `<span style="flex:1;${q[i] === S.uid ? "color:#F5B841;font-weight:900" : ""}">${esc(nm(q[i]) || "-")}</span>`}</div>`).join("")}</div></div>
    <div class="card"><b>${k}쿼터 휴식</b><div class="chips">${benched.map(p => `<span class="pill" style="background:#F3F4F6">${esc(p.name)}${p.from > k ? " (" + p.from + "Q부터)" : ""}</span>`).join("") || `<span class="hint">없어요</span>`}</div></div>
    <div class="card"><b>선수별 출전 쿼터</b><div class="list">${ps.map(p => `<div class="li"><span style="flex:1;${p.uid === S.uid ? "font-weight:900" : ""}">${esc(p.name)}</span><b>${cnt[p.uid] || 0}쿼터</b></div>`).join("")}</div></div>`}
  </div>${edit && L ? `<div class="cta"><button class="btn pri block" data-act="saveLineup" data-eid="${esc(e.id)}">저장하고 팀원에게 보이기</button></div>` : ""}`;
}

/* ---------- 내전 ---------- */
function scrimReady(e) { if (e.type !== "match" || e.opponent || started(e)) return false; const a = att(e); return a.in + a.wait.length >= 20; }
function vSquad(id) {
  const e = S.events[id]; if (!e) return vSchedule();
  const a = att(e); const ps = [...a.yes, ...a.late, ...a.wait]; const T = e.teams || {};
  const nA = ps.filter(p => (T[p.uid] || "") === "A").length, nB = ps.filter(p => (T[p.uid] || "") === "B").length;
  return `${top("내전 스쿼드", "#/event/" + e.id, `<button class="btn sm" data-act="squadAuto" data-eid="${esc(e.id)}">자동으로 나누기</button>`)}<div class="body">
    <div class="card"><div class="stat"><span><b>${ps.length}</b><span>전체</span></span><span><b>${nA}</b><span>A팀 조끼</span></span><span><b>${nB}</b><span>B팀</span></span></div></div>
    <div class="card"><div class="list">${ps.map(p => `<div class="li"><span style="flex:1"><b>${esc(p.name)}</b><br><span class="hint">${esc([p.p.pos1, p.p.pos2].filter(Boolean).join(", "))}</span></span><button class="chip sm ${T[p.uid] === "A" ? "on" : ""}" data-act="squadSet" data-eid="${esc(e.id)}" data-u="${esc(p.uid)}" data-v="A">A 조끼</button><button class="chip sm ${T[p.uid] === "B" ? "on" : ""}" data-act="squadSet" data-eid="${esc(e.id)}" data-u="${esc(p.uid)}" data-v="B">B 일반</button></div>`).join("")}</div></div>
  </div>`;
}

/* ---------- 선수 관리 ---------- */
function playerSheet(u) {
  const x = people().find(p => p.uid === u); if (!x) return; const me = S.members.find(m => m.user_id === S.uid) || {};
  const owner = S.role === "owner"; const isMe = u === S.uid; const req = (S.rsvp[u] || {}).posReq;
  sheet(`<h3>${esc(x.name)}</h3><span class="hint">${esc(ROLE[x.role])}${x.p.num ? ", " + esc(x.p.num) + "번" : ""}${x.p.pos1 ? ", " + esc([x.p.pos1, x.p.pos2].filter(Boolean).join(", ")) : ""}${joinedOf(u) ? ", 가입 " + dotDate(joinedOf(u)) : ""}</span>
    ${isAdmin() && req && req.status === "req" ? `<div class="card" style="background:#F9FAFB"><b>포지션 변경 요청</b><span class="hint">${esc([req.pos1, req.pos2].filter(Boolean).join(", "))}${req.note ? ", " + esc(req.note) : ""}</span><div class="row"><button class="btn block" data-act="posNo" data-u="${esc(u)}">거절</button><button class="btn pri block" data-act="posOk" data-u="${esc(u)}">수락</button></div></div>` : ""}
    ${owner && (S.members.find(m => m.user_id === u) || {}).admin_req && x.role === "member" ? `<div class="card" style="background:#F9FAFB"><b>운영진 신청</b><div class="row"><button class="btn block" data-act="adminAns" data-u="${esc(u)}" data-ok="">거절</button><button class="btn pri block" data-act="adminAns" data-u="${esc(u)}" data-ok="1">수락</button></div></div>` : ""}
    ${owner && !isMe ? `<div class="row">${x.role === "member" ? `<button class="btn block" data-act="setRole" data-u="${esc(u)}" data-v="admin">운영진으로</button>` : x.role === "admin" ? `<button class="btn block" data-act="setRole" data-u="${esc(u)}" data-v="member">팀원으로</button>` : ""}<button class="btn block" data-act="giveOwner" data-u="${esc(u)}">팀장 넘기기</button></div><button class="btn danger" data-act="kick" data-u="${esc(u)}">팀에서 내보내기</button>` : ""}
    ${isMe ? `<button class="btn" data-act="goTo" data-h="#/me">프로필 수정</button>${!isAdmin() ? (me.admin_req ? `<button class="btn" data-act="adminCancel">운영진 신청 취소</button>` : `<button class="btn" data-act="adminReq">운영진 신청</button>`) : ""}` : ""}
    <button class="btn" data-act="closeSheet">닫기</button>`);
}
function vPosReq() {
  const f = S.form; const pos = POS[sport()]; const req = (S.rsvp[S.uid] || {}).posReq;
  return `${top("포지션 변경 요청", "#/players")}<div class="body">
    ${req && req.status === "req" ? `<div class="card"><b>요청을 보냈어요</b><span class="hint">${esc([req.pos1, req.pos2].filter(Boolean).join(", "))}. 운영진이 수락하면 바뀌어요.</span><button class="btn" data-act="posCancel">요청 취소</button></div>` : ""}
    <div class="card"><div class="field"><span class="lab">1선호</span><div class="chips">${pos.map(p => `<button class="chip ${f.pos1 === p ? "on" : ""}" data-act="pick" data-k="pos1" data-v="${p}">${p}</button>`).join("")}</div></div>
      <div class="field"><span class="lab">2선호</span><div class="chips">${pos.filter(p => p !== f.pos1).map(p => `<button class="chip ${f.pos2 === p ? "on" : ""}" data-act="pick" data-k="pos2" data-v="${p}">${p}</button>`).join("")}<button class="chip ${!f.pos2 ? "on" : ""}" data-act="pick" data-k="pos2" data-v="">없음</button></div></div>
      <label class="field"><span class="lab">한마디 (선택)</span><input class="inp" data-bind="note" value="${esc(f.note || "")}" maxlength="60" placeholder="예: 요즘 슈팅 감이 좋아서 앞에서 뛰어 보고 싶어요"></label></div>
  </div><div class="cta"><button class="btn pri block" data-act="posSend">요청 보내기</button></div>`;
}

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
const POS_ALL = ["GK", "LB", "LWB", "CB", "RB", "RWB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST", "DF", "FW"];
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
function vRosterImport() {
  const { rows, bad } = parseRoster(S.form.text);
  return `${top("명단 붙여 넣기", "#/players")}<div class="body">
    <div class="card"><span class="hint">한 줄에 한 명씩: 이름, 1선호, 2선호, 등번호, 가입일. 엑셀에서 복사해 그대로 붙여 넣어도 돼요.</span>
      <textarea class="inp" data-bind="text" style="min-height:200px" placeholder="김성우&#9;ST&#9;CAM&#9;1&#9;2025. 9. 10">${esc(S.form.text || "")}</textarea>
      <button class="btn sm" data-act="rosterPreview" style="align-self:flex-start">확인하기</button></div>
    ${rows.length ? `<div class="card"><div class="spread"><b>${rows.length}명</b>${bad.length ? `<span class="hint" style="color:#B91C1C">${bad.join(", ")}번째 줄은 읽지 못했어요</span>` : ""}</div><div class="list">${rows.map(r => `<div class="li"><span class="av">${esc(r.num || r.name.slice(0, 1))}</span><span style="flex:1"><b>${esc(r.name)}</b><br><span class="hint">${esc([r.pos1, r.pos2].filter(Boolean).join(", "))}${r.joined ? ", 가입 " + dotDate(r.joined) : ""}</span></span></div>`).join("")}</div><span class="hint">이미 들어온 팀원과 이름이 같으면 그 팀원에게 연결하고 번호와 포지션을 맞춰요. 같은 이름의 명단이 있으면 고쳐 써요.</span></div>` : ""}
  </div><div class="cta"><button class="btn pri block" data-act="rosterSave" ${rows.length ? "" : "disabled"}>${rows.length ? rows.length + "명 등록하기" : "명단을 붙여 넣어 주세요"}</button></div>`;
}
function rosterSheet(pid) {
  const p = D("players")[pid]; if (!p) return;
  sheet(`<h3>${esc(p.name)}</h3><span class="hint">${esc([p.num ? p.num + "번" : "", p.pos1, p.pos2].filter(Boolean).join(", "))}${p.joined ? ", 가입 " + dotDate(p.joined) : ""}</span><span class="hint">아직 앱에 들어오지 않았어요. 초대 링크로 들어와 이 이름을 고르면 연결돼요.</span>
    ${isAdmin() ? `<button class="btn danger" data-act="rosterDel" data-pid="${esc(pid)}">명단에서 빼기</button>` : ""}<button class="btn" data-act="closeSheet">닫기</button>`);
}
const ACT4 = {
  monthGo: t => { const [y, m] = (UI.month || ym()).split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + Number(t.dataset.d), 1)); UI.month = d.toISOString().slice(0, 7); render(); },
  remindOpen: t => remindSheet(t.dataset.eid),
  remindSend: async t => {
    const e = S.events[t.dataset.eid]; if (!e) return; if (remindLeft()) { remindSheet(e.id); return; }
    t.disabled = true; const a = att(e); const names = a.none.map(x => x.name).concat(unclaimed().map(p => p.name));
    try {
      await setDoc("team", "remind", { at: new Date().toISOString(), by: S.uid, eid: e.id, to: a.none.map(x => x.uid) });
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
  duesToggle: async t => { const key = t.dataset.key, u = t.dataset.u; const cur = { ...(D("dues")[key] || {}) }; cur[u] = cur[u] === "paid" ? "" : "paid"; try { await setDoc("dues", key, cur); render(); await syncMyDues([u]); } catch (e) { fail(e); } },
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
      for (const ref of it.refs || []) { if (ref.kind === "dues") { const cur = { ...(D("dues")[ref.key] || {}) }; cur[u] = "paid"; await setDoc("dues", ref.key, cur); } else if (ref.kind === "fine" && D("fines")[ref.id]) await setDoc("fines", ref.id, { ...D("fines")[ref.id], paid: true }); }
      await patchDoc("payreq", u, { items: { [k]: { status: "ok", doneAt: new Date().toISOString() } } }); render(); await syncMyDues([u]); toast("확인했어요. 납부로 바뀌었어요");
    } catch (e) { fail(e); }
  },
  payNo: async t => { try { await patchDoc("payreq", t.dataset.u, { items: { [t.dataset.k]: { status: "no", doneAt: new Date().toISOString() } } }); render(); toast("확인 안 됨으로 표시했어요"); } catch (e) { fail(e); } },
  fineToggle: async t => { const f = D("fines")[t.dataset.id]; if (!f) return; try { await setDoc("fines", t.dataset.id, { ...f, paid: !f.paid }); render(); await syncMyDues([f.uid]); } catch (e) { fail(e); } },
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
  checkSet: async t => { const e = S.events[t.dataset.eid]; if (!e) return; const ck = { ...(e.check || {}) }; ck[t.dataset.u] = ck[t.dataset.u] === t.dataset.v ? "" : t.dataset.v; try { await setDoc("events", e.id, { ...e, check: ck, checkedAt: new Date().toISOString() }); render(); } catch (err) { fail(err); } },
  finesApply: async t => {
    const e = S.events[t.dataset.eid]; if (!e) return; const ck = e.check || {}; const a = att(e); const going = new Set([...a.yes, ...a.late].map(x => x.uid));
    const late = ruleAmt("late"), abs = ruleAmt("absent"); let n = 0;
    try {
      for (const [u, v] of Object.entries(ck)) {
        const id = "f-" + e.id + "-" + u; const amount = v === "late" ? late : v === "absent" && going.has(u) ? abs : 0;
        if (amount) { await setDoc("fines", id, { uid: u, date: e.date, eventId: e.id, reason: v === "late" ? "지각" : "무단 결석", amount, paid: (D("fines")[id] || {}).paid || false }); n++; }
        else if (D("fines")[id]) await delDoc("fines", id);
      }
      render(); await syncMyDues(); toast(n ? `벌금 ${n}건을 매겼어요. 팀원 회비 탭에 보여요` : "매길 벌금이 없어요. 수칙의 벌금 금액을 확인해 주세요");
    } catch (err) { fail(err); }
  },
  score: t => { S.form[t.dataset.k] = Math.max(0, (Number(S.form[t.dataset.k]) || 0) + Number(t.dataset.d)); render(); },
  goalAdd: t => { (S.form.goals = S.form.goals || []).push({ uid: t.dataset.u }); render(); },
  goalDel: t => { S.form.goals.splice(Number(t.dataset.i), 1); render(); },
  saveResult: async t => { const e = S.events[t.dataset.eid]; if (!e) return; t.disabled = true; try { await setDoc("events", e.id, { ...e, score: { us: Number(S.form.us) || 0, them: Number(S.form.them) || 0 }, goals: (S.form.goals || []).map(g => ({ uid: g.uid })) }); await syncMyDues(); toast("저장했어요. MOM 투표가 열렸어요"); location.hash = "#/game/" + e.id; } catch (err) { t.disabled = false; fail(err); } },
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
    try { await setDoc("events", e.id, { ...e, guests: { ...(e.guests || {}), [t.dataset.k]: { name: g.name, pos: g.pos || "", by: t.dataset.u, at: new Date().toISOString() } } }); await patchDoc("guestreq", t.dataset.u, { items: { [t.dataset.k]: { status: "ok" } } }); render(); toast("명단에 넣었어요"); } catch (err) { fail(err); }
  },
  guestNo: async t => { try { await patchDoc("guestreq", t.dataset.u, { items: { [t.dataset.k]: { status: "no" } } }); render(); toast("거절했어요"); } catch (e) { fail(e); } },
  guestDel: async t => { const e = S.events[t.dataset.eid]; if (!e) return; const gs = { ...(e.guests || {}) }; delete gs[t.dataset.g]; try { await setDoc("events", e.id, { ...e, guests: gs }); render(); } catch (err) { fail(err); } },
  lineQ: t => { UI.q = Number(t.dataset.v); render(); },
  lineSide: t => { UI.side = t.dataset.v; S.form.lineup = null; render(); },
  autoLineup: t => { const e = S.events[t.dataset.eid]; if (!e) return; const side = e.type === "scrim" ? UI.side : "main"; S.form.lineup = autoLineup(e, side); S.form.lineupFor = e.id + side; UI.q = 1; render(); toast("자동으로 짰어요. 저장해야 팀원에게 보여요"); },
  saveLineup: async t => { const e = S.events[t.dataset.eid]; if (!e) return; const side = e.type === "scrim" ? UI.side : "main"; const L = S.form.lineupFor === e.id + side ? S.form.lineup : (e.lineup || {})[side]; if (!L) return; try { await setDoc("events", e.id, { ...e, lineup: { ...(e.lineup || {}), [side]: L } }); S.form.lineup = null; render(); toast("저장했어요. 팀원 라인업 화면에 보여요"); } catch (err) { fail(err); } },
  scrimConvert: t => confirmBox("내전으로 바꾸기", "상대팀 없이 우리끼리 A팀과 B팀으로 나눠서 해요. 대기자도 모두 참석으로 올라가고, 신청한 사람 모두에게 보여요.", "바꾸기", async () => { const e = S.events[t.dataset.eid]; try { await setDoc("events", e.id, { ...e, type: "scrim", cap: 0, teams: {} }); toast("내전으로 바꿨어요. 스쿼드를 나눠 주세요"); location.hash = "#/squad/" + e.id; } catch (err) { fail(err); } }),
  squadSet: async t => { const e = S.events[t.dataset.eid]; const T = { ...(e.teams || {}) }; T[t.dataset.u] = T[t.dataset.u] === t.dataset.v ? "" : t.dataset.v; try { await setDoc("events", e.id, { ...e, teams: T }); render(); } catch (err) { fail(err); } },
  squadAuto: async t => {
    const e = S.events[t.dataset.eid]; const a = att(e); const ps = [...a.yes, ...a.late, ...a.wait];
    const order = POS[sport()]; ps.sort((x, y) => order.indexOf(x.p.pos1) - order.indexOf(y.p.pos1)); const T = {}; ps.forEach((p, i) => { T[p.uid] = i % 2 ? "B" : "A"; });
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
document.addEventListener("change", ev => {
  const t = ev.target; if (t.dataset.line == null) return;
  const e = S.events[t.dataset.eid]; if (!e) return; const side = e.type === "scrim" ? UI.side : "main";
  const L = S.form.lineupFor === e.id + side && S.form.lineup ? S.form.lineup : JSON.parse(JSON.stringify((e.lineup || {})[side] || autoLineup(e, side)));
  const q = L.q[UI.q] = L.q[UI.q] || {}; const i = Number(t.dataset.line);
  Object.keys(q).forEach(k => { if (q[k] === t.value && Number(k) !== i) delete q[k]; }); if (t.value) q[i] = t.value; else delete q[i];
  S.form.lineup = L; S.form.lineupFor = e.id + side; render();
});

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
    if (r === "/" || r === "") html = isAdmin() ? vHomeAdmin() : vHomeMember();
    else if (r === "/schedule") html = vSchedule();
    else if ((m = r.match(/^\/event\/(.+)$/))) html = vEvent(decodeURIComponent(m[1]));
    else if (r === "/new" && isAdmin()) html = vEventForm("");
    else if ((m = r.match(/^\/edit\/(.+)$/)) && isAdmin()) html = vEventForm(decodeURIComponent(m[1]));
    else if (r === "/players") html = vPlayers();
    else if (r === "/invite" && isAdmin()) html = vInviteMsg();
    else if (r === "/me") html = vProfile(true);
    else if (r === "/member") html = vHomeMember();
    else if (r === "/settings" && isAdmin()) html = vCreate(true);
    else if (r === "/records") html = vRecords();
    else if ((m = r.match(/^\/game\/(.+)$/))) html = vGame(decodeURIComponent(m[1]));
    else if ((m = r.match(/^\/result\/(.+)$/)) && isAdmin()) html = vResult(decodeURIComponent(m[1]));
    else if ((m = r.match(/^\/check\/(.+)$/)) && isAdmin()) html = vCheck(decodeURIComponent(m[1]));
    else if ((m = r.match(/^\/lineup\/(.+)$/))) html = vLineup(decodeURIComponent(m[1]));
    else if ((m = r.match(/^\/squad\/(.+)$/)) && isAdmin()) html = vSquad(decodeURIComponent(m[1]));
    else if (r === "/dues") html = vDues();
    else if (r === "/dues-settings" && isAdmin()) html = vDuesSettings();
    else if (r === "/ledger") html = vLedger();
    else if (r === "/notices") html = vNotices();
    else if (r === "/notice-new" && isAdmin()) html = vNoticeNew();
    else if (r === "/posreq") html = vPosReq();
    else if (r === "/claim" && !(S.rsvp[S.uid] || {}).pid) html = vClaim();
    else if (r === "/roster-import" && isAdmin()) html = vRosterImport();
    else html = isAdmin() ? vHomeAdmin() : vHomeMember();
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
  if (r === "/new") S.form = { type: "match", date: "", time: "", end: "", place: "", opponent: "", cap: sport() === "soccer" ? 22 : 12, memo: "" };
  else if ((m = r.match(/^\/edit\/(.+)$/)) && S.events[decodeURIComponent(m[1])]) { const e = S.events[decodeURIComponent(m[1])]; S.form = { type: e.type, date: e.date, time: e.time, end: e.end || "", place: e.place || "", opponent: e.opponent || "", cap: Number(e.cap) || 0, memo: e.memo || "" }; }
  else if (r === "/me") { const p = myProfile() || {}; S.form = { name: p.name || nameOf(S.uid), num: p.num || "", pos1: p.pos1 || "", pos2: p.pos2 || "" }; }
  else if (r === "/invite") S.form = {};
  else if (r === "/dues-settings") { const b = S.settings.bank || {}; S.form = { bank: b.bank || "", account: b.account || "", holder: b.holder || "" }; }
  else if (r === "/ledger") S.form = { type: "in", date: todayStr() };
  else if (r === "/notice-new") S.form = { title: "", body: "", pinned: "", poll: "", opts: [{ label: "" }, { label: "" }], until: "" };
  else if (r === "/posreq") { const p = myProfile() || {}; S.form = { pos1: p.pos1 || "", pos2: p.pos2 || "", note: "" }; }
  else if ((m = r.match(/^\/result\/(.+)$/)) && S.events[decodeURIComponent(m[1])]) { const e = S.events[decodeURIComponent(m[1])]; S.form = { us: (e.score || {}).us || 0, them: (e.score || {}).them || 0, goals: (e.goals || []).map(g => ({ uid: g.uid })) }; }
  else if (/^\/(lineup|game)\//.test(r)) { S.form = {}; UI.q = 1; UI.mom = ""; }
  else if (r === "/notices") markSeen();
  else if (r === "/roster-import") S.form = { text: "" };
  else if (r === "/settings") { const st = S.settings; S.form = { name: (S.team && S.team.name) || st.teamName || "", sport: st.sport || "futsal", feeMode: st.feeMode || "none", fee: st.fee ? String(st.fee) : "", dueDay: st.dueDay || "5", kit: st.uniformColor || "#164F33", rules: (st.rules || []).map(r => ({ label: r.label, amount: r.amount ? String(r.amount) : "" })) }; }
  render(); window.scrollTo(0, 0);
}

/* ---------- 입력 ---------- */
document.addEventListener("input", ev => {
  const t = ev.target;
  if (t.dataset.bind) {
    S.form[t.dataset.bind] = t.value;
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
      await setDoc("team", "settings", { ...S.settings, app: "maniball", teamName: name, sport: f.sport, feeMode: f.feeMode, fee: f.feeMode === "none" ? 0 : Number(String(f.fee || "").replace(/\D/g, "")) || 0, dueDay: f.feeMode === "monthly" ? f.dueDay : "", rules: (f.rules || []).filter(r => String(r.label).trim()).map(r => ({ label: String(r.label).trim().slice(0, 40), amount: Number(String(r.amount || "").replace(/\D/g, "")) || 0 })), uniformColor: f.kit || "#164F33" });
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
      const profile = { name: name.slice(0, 20), num: String(f.num || "").replace(/\D/g, "").slice(0, 3), pos1: f.pos1, pos2: f.pos2 || "" };
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
  agree: async t => { t.disabled = true; try { await patchDoc("rsvp", S.uid, { agreedAt: new Date().toISOString() }); S.flow = ""; S.ready = true; location.hash = "#/"; render(); } catch (e) { t.disabled = false; fail(e); } },
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
    sheet(`<h3>팀 고르기</h3><div class="list">${S.teams.map(t => `<button class="li" style="border:0;background:none;text-align:left;width:100%" data-act="enterTeam" data-id="${esc(t.id)}"><span class="av">${esc(t.name.slice(0, 1))}</span><span style="flex:1"><b>${esc(t.name)}</b><br><span class="hint">${ROLE[t.role] || ""}</span></span></button>`).join("")}</div><a class="btn" href="#" data-act="newTeam">+ 새 팀 만들기</a>`);
  },
  enterTeam: async t => { closeSheet(); S.ready = false; render(); await enter(t.dataset.id); },
  newTeam: () => { closeSheet(); startCreate(); },
  delTeam: () => confirmBox("팀 지우기", `${S.team.name}의 일정, 참석, 회비, 기록, 멤버가 모두 사라져요. 되돌릴 수 없어요.`, "지우기", async () => {
    const { error } = await sb.rpc("delete_team", { p_team: S.tid }); if (error) { fail(error); return; }
    ls.set("mb-team", null); toast("팀을 지웠어요"); setTimeout(() => location.replace(APP), 600);
  }, true),
  logout: () => confirmBox("로그아웃", "이 기기에서 로그아웃할까요?", "로그아웃", async () => { try { await sb.auth.signOut(); } catch (e) { /* 그래도 처음으로 */ } ls.set("mb-team", null); location.replace(APP); }),
};
Object.assign(ACT, ACT2, ACT3, ACT4);
document.addEventListener("click", ev => {
  const t = ev.target.closest("[data-act]"); if (!t) return;
  const f = ACT[t.dataset.act]; if (!f) return;
  if (t.tagName === "A") ev.preventDefault();
  f(t, ev);
});

/* ---------- 시작 ---------- */
function startCreate() { S.flow = "create"; S.form = { name: "", sport: "futsal", feeMode: "monthly", fee: "", dueDay: "5", kit: "#164F33", rules: [{ label: "지각 (킥오프 10분 전 기준)", amount: "" }, { label: "무단 결석", amount: "" }] }; render(); }
function startProfile() { const p = myProfile() || {}; S.flow = "profile"; S.form = { name: p.name || nameOf(S.uid) || suggestedName(), num: p.num || "", pos1: p.pos1 || "", pos2: p.pos2 || "" }; render(); }
function suggestedName() { const m = (S.session && S.session.user.user_metadata) || {}; return String(m.nickname || m.name || m.full_name || "").slice(0, 20); }
async function enter(tid) {
  try { await loadTeam(tid); } catch (e) { fail(e); S.flow = "create"; startCreate(); return; }
  if (!S.role) { ls.set("mb-team", null); await loadTeams(); if (S.teams.length) return enter(S.teams[0].id); return startCreate(); }
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
