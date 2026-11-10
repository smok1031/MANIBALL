// 매니볼 실제 앱 (1단계): 로그인, 팀 만들기, 초대, 선수 등록, 일정, 참석 투표
// 서버는 1차 앱과 같은 Supabase(teams, members, docs)를 쓴다. 예시 데이터는 없다.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "../../src/config.js";

const URL_ = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL;
const KEY_ = import.meta.env.VITE_SUPABASE_KEY || SUPABASE_KEY;
const sb = createClient(URL_, KEY_, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
const KAKAO_KEY = "e5c9ffdb309018215f5fcbc89eddb201"; // REST API 키 (공개 값)
const APP = location.origin + location.pathname.replace(/index\.html$/, "");
const qs = new URLSearchParams(location.search);
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* 없어도 된다 */ } } };
const WD = "일월화수목금토";
const POS = { futsal: ["GK", "DF", "LW", "RW", "FW"], soccer: ["GK", "LB", "CB", "RB", "CM", "LW", "RW", "ST"] };
const QN = { futsal: 8, soccer: 4 };
const ROLE = { owner: "팀장", admin: "운영진", member: "팀원" };
const KIT = [["#164F33", "초록"], ["#111827", "검정"], ["#1E3A8A", "파랑"], ["#991B1B", "빨강"], ["#F5B841", "노랑"], ["#F3F4F6", "흰색"]];
const numColor = c => ["#F5B841", "#F3F4F6"].includes(c) ? "#111827" : "#FFFFFF";

const S = { session: null, uid: "", teams: [], tid: "", role: "", team: null, members: [], invite: "", settings: {}, events: {}, rsvp: {}, ready: false, flow: "", form: {}, ch: null };
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
    sb.from("docs").select("coll,id,data").eq("team_id", tid).in("coll", ["team", "events", "rsvp"]),
  ]);
  if (m.error || t.error || d.error) throw m.error || t.error || d.error;
  S.members = m.data || []; S.team = t.data;
  const me = S.members.find(x => x.user_id === S.uid); S.role = me ? me.role : "";
  S.settings = {}; S.events = {}; S.rsvp = {};
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
}
function drop(c, id) { if (c === "events") delete S.events[id]; else if (c === "rsvp") delete S.rsvp[id]; }
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
document.addEventListener("visibilitychange", () => { if (!document.hidden && S.ready) refreshMembers(); });
async function setDoc(c, id, data) {
  const { error } = await sb.from("docs").upsert({ team_id: S.tid, coll: c, id, data }, { onConflict: "team_id,coll,id" });
  if (error) throw error; put(c, id, data);
}
async function patchDoc(c, id, patch) {
  const exists = c === "rsvp" ? !!S.rsvp[id] : c === "events" ? !!S.events[id] : true;
  if (!exists) { await setDoc(c, id, patch); return; }
  const { data, error } = await sb.rpc("doc_patch", { p_team: S.tid, p_coll: c, p_id: id, p_patch: patch });
  if (error) throw error; put(c, id, data.data);
}
async function delDoc(c, id) { const { error } = await sb.from("docs").delete().eq("team_id", S.tid).eq("coll", c).eq("id", id); if (error) throw error; drop(c, id); }
const GUARD = { vote_closed: "경기가 시작돼서 바꿀 수 없어요", no_event: "지워진 일정이에요", bad_vote: "저장할 수 없는 응답이에요", team_limit: "팀은 한 사람당 5개까지 만들 수 있어요", bad_code: "초대 링크가 바뀌었거나 잘못됐어요. 운영진에게 새 링크를 받아 주세요" };
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
  const sub = e.type === "match" ? (e.opponent ? "vs " + e.opponent : "상대팀 미정") : "훈련";
  return `<div class="card">
    <a href="#/event/${esc(e.id)}" style="text-decoration:none;color:inherit;display:flex;gap:12px;align-items:center">
      <span class="datebox ${closed ? "gray" : ""}"><span>${wd(e.date)}</span><b>${Number(e.date.slice(8, 10))}</b></span>
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px"><span class="row" style="gap:6px"><span class="tag ${e.type === "match" ? "" : "blue"}">${e.type === "match" ? "경기" : "훈련"}</span><b style="font-size:16px">${esc(e.time || "")}${e.end ? " ~ " + esc(e.end) : ""}</b></span><span class="hint">${esc(e.place || "장소 미정")}, ${esc(sub)}</span></span>
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
    <div class="card"><span class="lab">유니폼 색</span><div class="row" style="gap:12px">${jersey(64, "7", f.kit)}<div class="chips">${KIT.map(([c, l]) => `<button class="chip sm ${f.kit === c ? "on" : ""}" data-act="pick" data-k="kit" data-v="${c}">${l}</button>`).join("")}</div></div><span class="hint">팀원 홈의 유니폼 카드에 이 색으로 보여요. 사진 올리기는 다음 단계에서 열려요.</span></div>
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
  const mine = evs.filter(e => { const r = (((S.rsvp[u] || {}).ev || {})[e.id]) || {}; return r.s === "yes" || r.s === "late"; }).length;
  return { n: evs.length, mine, rate: evs.length ? Math.round(mine * 100 / evs.length) : 0 };
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
        <div class="stat"><span><b>${st.mine}</b><span>내 참석</span></span><span><b>-</b><span>평균 쿼터</span></span><span><b style="color:#B45309">0</b><span>MOM</span></span></div></div>
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
  if (noProfile) todo.push([`선수 등록을 안 한 멤버 ${noProfile}명`, "들어와서 이름과 번호를 적으면 명단에 보여요", "#/players", "보기"]);
  return `<header class="top" style="padding:10px 12px">${LOGO(32)}<span style="flex:1;line-height:1.2"><b style="font-size:17px">${esc(S.team.name)}</b><br><span class="hint" style="font-size:12px">${sport() === "soccer" ? "축구팀" : "풋살팀"}, 팀원 ${S.members.length}명, 나는 ${ROLE[S.role]}</span></span>${S.teams.length > 1 ? `<button class="iconbtn" data-act="switchTeam" aria-label="다른 팀">⇄</button>` : ""}</header>
  <div class="body">
    <div class="card"><div class="spread"><b style="font-size:16px">운영진이 할 일</b><span class="hint">${todo.length}개</span></div>
      ${todo.length ? `<div class="list">${todo.map(t => `<div class="li"><span style="flex:1;min-width:0"><b style="font-size:15px">${esc(t[0])}</b><br><span class="hint">${esc(t[1])}</span></span><a class="btn sm" href="${t[2]}">${esc(t[3])}</a></div>`).join("")}</div>` : `<span class="hint">지금은 할 일이 없어요.</span>`}
    </div>
    ${next ? `<div class="spread"><b>다음 일정</b><a href="#/schedule" class="hint" style="text-decoration:none">전체</a></div>${eventCard(next)}` : ""}
    <div class="row" style="gap:8px"><a class="btn block" href="#/new">+ 일정 만들기</a><a class="btn block" href="#/invite">팀원 초대</a></div>
    ${myProfile() ? `<a class="btn" href="#/member">내 선수 카드 보기 (팀원 화면)</a>` : ""}
    ${myProfile() ? "" : `<div class="card"><b>나도 선수로 등록하기</b><span class="hint">팀장도 선수로 등록하면 참석을 누르고 명단에 보여요.</span><a class="btn" href="#/me">선수 등록</a></div>`}
  </div>${nav("홈")}`;
}

/* ---------- 일정 ---------- */
function vSchedule() {
  const ev = upcoming();
  return `<header class="top"><span style="width:8px"></span><h1>일정</h1>${isAdmin() ? `<a class="btn sm pri" href="#/new">+ 일정 만들기</a>` : ""}</header><div class="body">
    ${ev.length ? ev.map(e => eventCard(e)).join("") : `<div class="card empty"><b>다가오는 일정이 없어요</b><span class="hint">${isAdmin() ? "일정을 만들면 팀원이 참석을 눌러요." : "운영진이 일정을 올리면 여기에 보여요."}</span>${isAdmin() ? `<a class="btn pri" href="#/new">일정 만들기</a>` : ""}</div>`}
    ${past().length ? `<b style="margin-top:8px">지난 일정</b>${past().slice(0, 10).map(e => eventCard(e, { noVote: true })).join("")}` : ""}
  </div>${nav("일정")}`;
}
function vEvent(id) {
  const e = S.events[id]; if (!e) return `${top("일정", "#/schedule")}<div class="body"><div class="card empty"><b>지워진 일정이에요</b></div></div>`;
  const a = att(e);
  const grp = (t, arr, fmt) => `<div class="card"><div class="spread"><b>${t}</b><span class="hint">${arr.length}명</span></div>${arr.length ? `<div class="chips">${arr.map(x => `<span class="pill" style="background:#F3F4F6">${esc(x.name)}${fmt ? fmt(x) : ""}</span>`).join("")}</div>` : `<span class="hint">없어요</span>`}</div>`;
  return `${top(md(e.date) + " " + wd(e.date) + " " + (e.type === "match" ? "경기" : "훈련"), "#/schedule", isAdmin() ? `<a class="btn sm" href="#/edit/${esc(e.id)}">수정</a>` : "")}<div class="body">
    ${eventCard(e)}
    ${e.memo ? `<div class="card"><b>메모</b><div class="hint" style="white-space:pre-wrap;color:#374151">${esc(e.memo)}</div></div>` : ""}
    ${grp("참석", a.yes)}${grp("늦참", a.late, x => x.q ? `, ${x.q}Q부터` : "")}${a.cap ? grp("대기", a.wait, (x) => "") : ""}${grp("불참", a.no)}${grp("미응답", a.none)}
    ${a.cap ? `<span class="hint">정원이 차면 다음 신청은 대기로 들어가고, 자리가 나면 순서대로 올라가요.</span>` : ""}
  </div>`;
}
function vEventForm(id) {
  const f = S.form; const isNew = !id;
  const chip = (k, v, l) => `<button class="chip ${f[k] === v ? "on" : ""}" data-act="pick" data-k="${k}" data-v="${v}">${l}</button>`;
  return `${top(isNew ? "일정 만들기" : "일정 수정", isNew ? "#/schedule" : "#/event/" + id)}<div class="body">
    <div class="card">
      <div class="field"><span class="lab">종류</span><div class="chips">${chip("type", "match", "경기")}${chip("type", "training", "훈련")}</div></div>
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
  const ps = people().sort((a, b) => (a.role === "member") - (b.role === "member") || a.name.localeCompare(b.name, "ko"));
  return `<header class="top"><span style="width:8px"></span><h1>선수</h1>${isAdmin() ? `<a class="btn sm" href="#/settings">팀 설정</a><a class="btn sm pri" href="#/invite">+ 초대</a>` : ""}</header><div class="body">
    <div class="card"><div class="spread"><b>${ps.length}명</b><span class="hint">운영진 ${ps.filter(x => x.role !== "member").length}명</span></div>
      <div class="list">${ps.map(x => `<div class="li"><span class="av">${esc(x.p.num || x.name.slice(0, 1))}</span><span style="flex:1;min-width:0"><b>${esc(x.name)}</b>${x.uid === S.uid ? ` <span class="hint">나</span>` : ""}<br><span class="hint">${x.p.num ? esc(x.p.num) + "번, " : ""}${esc([x.p.pos1, x.p.pos2].filter(Boolean).join(", ") || (profileOf(x.uid) ? "포지션 미정" : "선수 등록 전"))}</span></span>${x.role !== "member" ? `<span class="tag">${ROLE[x.role]}</span>` : ""}</div>`).join("")}</div>
    </div>
    ${S.settings.rules && S.settings.rules.length ? `<div class="card"><b>우리 팀 수칙</b><div class="list">${S.settings.rules.map(r => `<div class="li"><span style="flex:1">${esc(r.label)}</span>${Number(r.amount) ? `<b>${won(r.amount)}</b>` : ""}</div>`).join("")}</div></div>` : ""}
    <div class="card"><div class="row" style="justify-content:space-between"><span class="hint">로그인: 카카오</span><span class="row"><button class="btn sm" data-act="switchTeam">다른 팀, 새 팀</button><button class="btn sm" data-act="logout">로그아웃</button></span></div><a class="hint" href="../../privacy.html">개인정보처리방침과 이용약관</a></div>
  </div>${nav("선수")}`;
}
const vSoon = (t, on) => `<header class="top"><span style="width:8px"></span><h1>${t}</h1></header><div class="body"><div class="card empty"><b>${t}은 다음 단계에서 열려요</b><span class="hint">지금은 팀 만들기, 초대, 선수 등록, 일정과 참석 투표를 점검할 수 있어요.</span></div></div>${nav(on)}`;

/* ---------- 그리기와 길찾기 ---------- */
function route() { return (location.hash || "#/").slice(1); }
function render() {
  const app = $("#app"); let html = "";
  if (S.flow === "login") html = vLogin(qs.get("login_error"));
  else if (S.flow === "invite") html = vInvite(S.inviteTeam, qs.get("login_error"));
  else if (S.flow === "create") html = vCreate();
  else if (S.flow === "profile") html = vProfile(false);
  else if (S.flow === "rules") html = vRules();
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
    else if (r === "/records") html = vSoon("기록", "기록");
    else if (r === "/dues") html = vSoon("회비", "회비");
    else html = isAdmin() ? vHomeAdmin() : vHomeMember();
  }
  // 입력 중인 칸은 그대로 두려고, 같은 화면이면 포커스와 커서를 되돌린다
  const act = document.activeElement; const d = (act && act.dataset) || {};
  const sel = d.bind ? `[data-bind="${d.bind}"]` : d.rule != null ? `[data-rule="${d.rule}"][data-f="${d.f}"]` : "";
  const pos = sel && "selectionStart" in act ? act.selectionStart : null;
  app.innerHTML = html;
  if (sel) { const el = app.querySelector(sel); if (el) { el.focus(); try { if (pos != null) el.setSelectionRange(pos, pos); } catch (e) { /* 날짜 칸 */ } } }
}
let lastRoute = "";
window.addEventListener("hashchange", () => {
  const r = route(); if (r === lastRoute) return; lastRoute = r;
  // 폼 화면에 들어올 때 폼 값을 채운다
  let m;
  if (r === "/new") S.form = { type: "match", date: "", time: "", end: "", place: "", opponent: "", cap: sport() === "soccer" ? 22 : 12, memo: "" };
  else if ((m = r.match(/^\/edit\/(.+)$/)) && S.events[decodeURIComponent(m[1])]) { const e = S.events[decodeURIComponent(m[1])]; S.form = { type: e.type, date: e.date, time: e.time, end: e.end || "", place: e.place || "", opponent: e.opponent || "", cap: Number(e.cap) || 0, memo: e.memo || "" }; }
  else if (r === "/me") { const p = myProfile() || {}; S.form = { name: p.name || nameOf(S.uid), num: p.num || "", pos1: p.pos1 || "", pos2: p.pos2 || "" }; }
  else if (r === "/invite") S.form = {};
  else if (r === "/settings") { const st = S.settings; S.form = { name: (S.team && S.team.name) || st.teamName || "", sport: st.sport || "futsal", feeMode: st.feeMode || "none", fee: st.fee ? String(st.fee) : "", dueDay: st.dueDay || "5", kit: st.uniformColor || "#164F33", rules: (st.rules || []).map(r => ({ label: r.label, amount: r.amount ? String(r.amount) : "" })) }; }
  render(); window.scrollTo(0, 0);
});

/* ---------- 입력 ---------- */
document.addEventListener("input", ev => {
  const t = ev.target;
  if (t.dataset.bind) {
    S.form[t.dataset.bind] = t.value;
    if (t.dataset.liveSrc) document.querySelectorAll(`[data-live="${t.dataset.liveSrc}"]`).forEach(el => { el.textContent = t.value || (t.dataset.liveSrc === "name" ? "이름" : ""); });
  } else if (t.dataset.rule != null) { const r = S.form.rules[Number(t.dataset.rule)]; if (r) r[t.dataset.f] = t.value; }
});
const ACT = {
  closeSheet: (t, ev) => { if (ev.target === t || t.tagName === "BUTTON") closeSheet(); },
  kakao: async t => {
    t.disabled = true;
    try {
      const st = { state: rand(), nonce: rand() };
      sessionStorage.setItem("kei-web-kakao", JSON.stringify(st));
      const back = new URL(location.href); back.searchParams.delete("login_error"); back.hash = "";
      sessionStorage.setItem("mb-next", back.href);
      const redirect = new URL("../../", APP).href; // 카카오에 등록된 주소(1차 앱)에서 로그인을 끝내고 돌아온다
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
      await setDoc("team", "settings", { app: "maniball", teamName: name, sport: f.sport, feeMode: f.feeMode, fee: f.feeMode === "none" ? 0 : Number(String(f.fee || "").replace(/\D/g, "")) || 0, dueDay: f.feeMode === "monthly" ? f.dueDay : "", rules: (f.rules || []).filter(r => String(r.label).trim()).map(r => ({ label: String(r.label).trim().slice(0, 40), amount: Number(String(r.amount || "").replace(/\D/g, "")) || 0 })), cap: f.sport === "soccer" ? 22 : 12, uniformColor: f.kit || "#164F33" });
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
    const data = { id, type: f.type, date: f.date, time: f.time, end: f.end || "", place: String(f.place || "").trim(), opponent: f.type === "match" ? String(f.opponent || "").trim() : "", cap: Number(f.cap) || 0, memo: String(f.memo || "").trim(), updatedAt: new Date().toISOString(), createdAt: (S.events[id] && S.events[id].createdAt) || new Date().toISOString() };
    try { await setDoc("events", id, data); toast(t.dataset.eid ? "저장했어요" : "일정을 올렸어요. 팀원이 바로 참석을 누를 수 있어요"); location.hash = "#/event/" + id; }
    catch (e) { t.disabled = false; fail(e); }
  },
  delEvent: t => confirmBox("일정 지우기", "이 일정과 참석 응답이 모두 사라져요. 되돌릴 수 없어요.", "지우기", async () => { try { await delDoc("events", t.dataset.eid); toast("지웠어요"); location.hash = "#/schedule"; } catch (e) { fail(e); } }, true),
  switchTeam: () => {
    sheet(`<h3>팀 고르기</h3><div class="list">${S.teams.map(t => `<button class="li" style="border:0;background:none;text-align:left;width:100%" data-act="enterTeam" data-id="${esc(t.id)}"><span class="av">${esc(t.name.slice(0, 1))}</span><span style="flex:1"><b>${esc(t.name)}</b><br><span class="hint">${ROLE[t.role] || ""}</span></span></button>`).join("")}</div><a class="btn" href="#" data-act="newTeam">+ 새 팀 만들기</a>`);
  },
  enterTeam: async t => { closeSheet(); S.ready = false; render(); await enter(t.dataset.id); },
  newTeam: () => { closeSheet(); startCreate(); },
  logout: () => confirmBox("로그아웃", "이 기기에서 로그아웃할까요?", "로그아웃", async () => { try { await sb.auth.signOut(); } catch (e) { /* 그래도 처음으로 */ } ls.set("mb-team", null); location.replace(APP); }),
};
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
  if (!myProfile() && !isAdmin()) { S.afterProfile = ""; startProfile(); return; }
  if (!isAdmin() && !(S.rsvp[S.uid] || {}).agreedAt) { S.flow = "rules"; render(); return; }
  S.flow = ""; S.ready = true; lastRoute = route(); render();
}
async function boot() {
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
