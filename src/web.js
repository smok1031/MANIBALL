// KEI FC 팀 매니저 웹 셸
// 로그인(카카오, 이메일), 팀 만들기와 초대 링크, 팀 고르기를 맡고,
// 팀 데이터는 Supabase의 docs 표를 앱이 쓰던 문서 저장소 모양(window.claude)으로 이어 준다.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

const URL_ = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL;
const KEY_ = import.meta.env.VITE_SUPABASE_KEY || SUPABASE_KEY;
const BASE = import.meta.env.BASE_URL;
const LS = { team: "kei-web-team", join: "kei-web-join", pick: "kei-web-pick" };
const qs = new URLSearchParams(location.search);
// 카카오에 등록한 리다이렉트 주소와 늘 같도록 index.html은 떼고 폴더 주소로 맞춘다
const APP_URL = location.origin + location.pathname.replace(/index\.html$/, "");
window.__SHARE_LINK = APP_URL;

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* 저장 못 해도 동작은 한다 */ } },
};
const ROLE = { owner: "팀장", admin: "운영진", member: "팀원" };
const state = { screen: "", session: null, uid: "", teams: [], tid: "", role: "", members: [], team: null, busy: false };

let toastTimer = 0;
function note(msg) {
  const r = $("#toastroot"); r.innerHTML = `<div class="toast" role="status">${esc(msg)}</div>`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { r.innerHTML = ""; }, 3200);
}
function screen(name, html) {
  state.screen = name;
  $("#teamname").textContent = "KEI FC";
  $("#sync").hidden = true; $("#tabs").hidden = true;
  $("#main").innerHTML = `<div class="auth">${html}</div>`;
  window.scrollTo(0, 0);
}
const hero = (title, sub) => `<div class="hero"><span class="crest" aria-hidden="true">FC</span><div><h1>${esc(title)}</h1><p>${esc(sub)}</p></div></div>`;
const demoLinks = `<div class="shellnote">로그인 없이 둘러보기 <a class="linkbtn" href="?demo=member">팀원 화면</a> <a class="linkbtn" href="?demo=op">운영진 화면</a></div>`;
const KAKAO_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3.5c-5 0-9 3.1-9 7 0 2.5 1.7 4.7 4.2 5.9l-1 3.6c-.1.3.3.6.6.4l4.2-2.8c.3 0 .7.1 1 .1 5 0 9-3.1 9-7s-4-7.2-9-7.2z"/></svg>`;

/* ---------- 앱 불러오기 ---------- */
let appLoading = null;
function loadApp() {
  if (!appLoading) appLoading = new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = BASE + "app.js?v=" + __APP_VER__;
    s.onload = res; s.onerror = () => rej(new Error("app.js"));
    document.body.appendChild(s);
  });
  return appLoading;
}
async function startApp() {
  window.__WEB = true; state.screen = "app";
  $("#sync").hidden = false;
  $("#main").innerHTML = `<div class="loading">팀 데이터를 불러오는 중입니다</div>`;
  try { await loadApp(); } catch (e) { screen("error", `<section class="card"><div class="empty"><b>앱을 불러오지 못했어요</b>네트워크를 확인하고 새로고침해 주세요.</div></section>`); return; }
  try { ROLE_KO.owner = "팀장"; } catch (e) { /* 이름표만 바꾸는 것이라 없어도 된다 */ }
  window.KEI_APP.start();
}

/* ---------- 로그인 ---------- */
let sb = null;
/* ---------- 카카오 로그인: 이메일 동의 없이 ID 토큰으로 로그인 ----------
   Supabase의 기본 카카오 연결은 이메일 동의항목을 항상 요청해서, 비즈 앱이 아니면 KOE205가 난다.
   그래서 카카오 OpenID Connect로 ID 토큰을 받아 Supabase에 넘긴다 (닉네임만 요청). */
const KAKAO_KEY = "e5c9ffdb309018215f5fcbc89eddb201"; // REST API 키 (공개되는 값, 비밀 아님)
const KK = "kei-web-kakao";
const rand = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, "0")).join("");
async function sha256hex(t) { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)); return Array.from(new Uint8Array(d), b => b.toString(16).padStart(2, "0")).join(""); }
async function kakaoStart() {
  const st = { state: rand(), nonce: rand() };
  try { sessionStorage.setItem(KK, JSON.stringify(st)); } catch (e) { /* 아래에서 실패 안내 */ }
  const q = new URLSearchParams({ client_id: KAKAO_KEY, redirect_uri: APP_URL, response_type: "code", scope: "openid profile_nickname", state: st.state, nonce: await sha256hex(st.nonce) });
  location.assign("https://kauth.kakao.com/oauth/authorize?" + q);
}
function kakaoPending() {
  let st = null; try { st = JSON.parse(sessionStorage.getItem(KK) || "null"); } catch (e) { st = null; }
  return st && qs.get("state") === st.state ? st : null;
}
async function kakaoFinish(st) {
  try { sessionStorage.removeItem(KK); } catch (e) { /* 없어도 된다 */ }
  if (qs.get("error")) throw new Error(qs.get("error_description") || qs.get("error"));
  const r = await fetch("https://kauth.kakao.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: new URLSearchParams({ grant_type: "authorization_code", client_id: KAKAO_KEY, redirect_uri: APP_URL, code: qs.get("code") || "" }) });
  const tok = await r.json().catch(() => ({}));
  if (!r.ok || !tok.id_token) throw new Error(tok.error_code || tok.error || "token " + r.status);
  const { data, error } = await sb.auth.signInWithIdToken({ provider: "kakao", token: tok.id_token, access_token: tok.access_token, nonce: st.nonce });
  if (error) throw error;
  return data.session;
}

async function boot() {
  const kakao = kakaoPending();
  sb = createClient(URL_, KEY_, { auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: !kakao } });
  let urlErr = kakao ? "" : qs.get("error_description") || qs.get("error") || "";
  const jc = (qs.get("join") || "").trim();
  if (jc) store.set(LS.join, jc);
  let session = null;
  if (kakao) {
    screen("loading", `<div class="loading">카카오 로그인 중입니다</div>`);
    try { session = await kakaoFinish(kakao); } catch (e) { session = null; urlErr = String((e && e.message) || "kakao"); }
  }
  if (!session) { try { ({ data: { session } } = await sb.auth.getSession()); } catch (e) { session = null; } }
  if (location.search) history.replaceState(null, "", APP_URL + location.hash);
  sb.auth.onAuthStateChange((ev, s) => {
    if (ev === "SIGNED_OUT") { location.replace(APP_URL); return; }
    if (ev === "SIGNED_IN" && s && (state.screen === "login" || state.screen === "sent")) { state.session = s; afterLogin(); }
  });
  if (!session) { showLogin(urlErr); return; }
  state.session = session; afterLogin();
}

async function showLogin(err) {
  let invite = "";
  const code = store.get(LS.join);
  if (code) {
    try { const { data } = await sb.rpc("team_by_code", { p_code: code }); if (data && data[0]) invite = data[0].name; } catch (e) { invite = ""; }
  }
  screen("login", `${hero("KEI FC 팀 매니저", "일정, 참석, 라인업, 회비를 한곳에서")}
    ${invite ? `<div class="note soft"><b>${esc(invite)}</b> 팀 초대를 받았어요. 로그인하면 바로 들어가요.</div>` : ""}
    ${err ? `<div class="note">로그인하지 못했어요. 다시 시도해 주세요. <span class="tiny muted">${esc(err)}</span></div>` : ""}
    <section class="card" style="gap:12px">
      <button class="btn kakao big" data-web="kakao">${KAKAO_ICON}카카오로 시작하기</button>
      <div class="or">또는 이메일로</div>
      <form id="emailForm" class="namerow"><input class="inp" type="email" name="email" placeholder="이메일 주소" autocomplete="email" aria-label="이메일 주소" required><button class="btn" type="submit">링크 받기</button></form>
      <div class="hint">메일로 온 로그인 링크는 지금 이 브라우저에서 열어 주세요.</div>
    </section>${demoLinks}
    <div class="shellnote">로그인하면 <a class="linkbtn" href="privacy.html">개인정보처리방침과 이용약관</a>에 동의하는 것으로 봐요.</div>`);
}

async function afterLogin() {
  state.uid = state.session.user.id;
  screen("loading", `<div class="loading">팀 정보를 불러오는 중입니다</div>`);
  try { await loadMyTeams(); } catch (e) {
    screen("error", `<section class="card"><div class="empty"><b>팀 정보를 불러오지 못했어요</b>네트워크를 확인해 주세요.</div><button class="btn primary block" data-web="retry">다시 시도</button></section>`);
    return;
  }
  const code = store.get(LS.join);
  if (code) {
    const team = await teamByCode(code);
    if (!team) { store.set(LS.join, null); note("초대 링크가 바뀌었거나 잘못됐어요. 운영진에게 새 링크를 받아 주세요."); }
    else if (state.teams.some(t => t.id === team.id)) { store.set(LS.join, null); enterTeam(team.id); return; }
    else { showJoin(team, code); return; }
  }
  if (store.get(LS.pick) === "1") { store.set(LS.pick, null); showPicker(); return; }
  const last = store.get(LS.team);
  const t = state.teams.find(x => x.id === last) || (state.teams.length === 1 ? state.teams[0] : null);
  if (t) enterTeam(t.id);
  else if (state.teams.length) showPicker();
  else showStart();
}
async function loadMyTeams() {
  const { data: mem, error } = await sb.from("members").select("team_id,role,display_name").eq("user_id", state.uid);
  if (error) throw error;
  const ids = mem.map(m => m.team_id);
  let names = {};
  if (ids.length) {
    const { data: ts, error: e2 } = await sb.from("teams").select("id,name").in("id", ids);
    if (e2) throw e2;
    names = Object.fromEntries(ts.map(t => [t.id, t.name]));
  }
  state.teams = mem.map(m => ({ id: m.team_id, role: m.role, me: m.display_name, name: names[m.team_id] || "팀" }));
}
async function teamByCode(code) {
  try { const { data } = await sb.rpc("team_by_code", { p_code: code }); return (data && data[0]) || null; } catch (e) { return null; }
}
function suggestedName() {
  const m = (state.session && state.session.user.user_metadata) || {};
  return String(m.name || m.full_name || m.nickname || m.preferred_username || m.user_name || "").slice(0, 30);
}
const who = () => { const u = state.session && state.session.user; return (u && (u.email || (u.user_metadata && (u.user_metadata.name || u.user_metadata.nickname)))) || "로그인됨"; };

function showJoin(team, code) {
  screen("join", `${hero(team.name, "팀 초대를 받았어요")}
    <form class="card" id="joinForm" style="gap:12px" data-code="${esc(code)}">
      <label class="field" style="margin:0">팀에서 쓸 이름<input name="name" value="${esc(suggestedName())}" maxlength="30" placeholder="예: 이세영" required></label>
      <div class="hint">들어가면 팀원이 돼요. 운영진은 팀장이 따로 정해요.</div>
      <button class="btn primary big" type="submit">팀에 들어가기</button>
    </form>
    <div class="shellnote">${esc(who())} <button class="linkbtn" data-web="logout">다른 계정으로 로그인</button></div>`);
}
function startCards() {
  return `<form class="card" id="codeForm" style="gap:12px"><span class="lab">초대 링크로 들어가기</span>
      <label class="field" style="margin:0">운영진에게 받은 링크나 코드<input name="code" placeholder="링크를 붙여 넣으세요" autocomplete="off" required></label>
      <button class="btn primary block" type="submit">확인</button></form>
    <form class="card" id="createForm" style="gap:12px"><span class="lab">새 팀 만들기</span>
      <label class="field" style="margin:0">팀 이름<input name="name" maxlength="40" placeholder="예: KEI FC" required></label>
      <div class="hint">만든 사람이 팀장이 돼요. 팀원은 설정의 초대 링크로 불러요.</div>
      <button class="btn block" type="submit">팀 만들기</button></form>`;
}
function showStart() {
  screen("start", `${hero("KEI FC 팀 매니저", "아직 들어간 팀이 없어요")}${startCards()}
    <div class="shellnote">${esc(who())} <button class="linkbtn" data-web="logout">로그아웃</button></div>`);
}
function showPicker() {
  screen("pick", `${hero("팀 고르기", "들어갈 팀을 골라 주세요")}
    <div class="stack" style="display:flex;flex-direction:column;gap:8px">${state.teams.map(t => `<button class="teampick" data-web="pick" data-id="${esc(t.id)}"><span class="crest" aria-hidden="true">${esc(String(t.name).slice(0, 2))}</span><span class="grow"><b>${esc(t.name)}</b><span class="tiny muted">${esc(ROLE[t.role] || "")}${t.me ? " " + esc(t.me) : ""}</span></span></button>`).join("")}</div>
    ${startCards()}
    <div class="shellnote">${esc(who())} <button class="linkbtn" data-web="logout">로그아웃</button></div>`);
}
function parseCode(v) {
  v = String(v || "").trim();
  const m = v.match(/[?&]join=([A-Za-z0-9]+)/);
  return m ? m[1] : v.replace(/[^A-Za-z0-9]/g, "");
}

/* ---------- 팀 들어가기 ---------- */
async function loadMembers() {
  const [{ data: mem, error }, { data: team, error: e2 }] = await Promise.all([
    sb.from("members").select("*").eq("team_id", state.tid).order("joined_at"),
    sb.from("teams").select("id,name").eq("id", state.tid).maybeSingle(),
  ]);
  if (error || e2) throw error || e2;
  state.members = mem || []; state.team = team;
  const me = state.members.find(m => m.user_id === state.uid);
  // 초대 코드는 운영진만 서버 함수로 받는다
  if (team && me && (me.role === "owner" || me.role === "admin")) {
    const { data: code, error: e3 } = await sb.rpc("team_invite_code", { p_team: state.tid });
    if (!e3) team.invite_code = code || "";
    else { const { data: t2 } = await sb.from("teams").select("invite_code").eq("id", state.tid).maybeSingle(); team.invite_code = (t2 && t2.invite_code) || ""; }
  }
  return me ? me.role : "";
}
async function enterTeam(tid) {
  state.tid = tid;
  let role = "";
  try { role = await loadMembers(); } catch (e) { role = ""; }
  if (!role) { store.set(LS.team, null); await loadMyTeams().catch(() => {}); if (state.teams.length) showPicker(); else showStart(); return; }
  state.role = role;
  store.set(LS.team, tid);
  window.claude = makeClaude(tid);
  watchMembers(tid);
  startApp();
}
function watchMembers(tid) {
  const onChange = async p => {
    const row = p.new && p.new.team_id ? p.new : p.old;
    if (!row || row.team_id !== tid) return;
    const before = state.role;
    let role = "";
    try { role = await loadMembers(); } catch (e) { return; }
    if (role !== before) { location.reload(); return; }
    if (typeof requestRender === "function") requestRender();
  };
  sb.channel("members-" + tid)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "members", filter: "team_id=eq." + tid }, onChange)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "members", filter: "team_id=eq." + tid }, onChange)
    .subscribe();
  window.__memberGone = () => onChange({ new: { team_id: tid } });
  // 내보내진 사람은 팀 문서를 더는 받지 못하므로, 화면으로 돌아올 때 한 번 확인한다
  document.addEventListener("visibilitychange", () => { if (!document.hidden && state.screen === "app") onChange({ new: { team_id: tid } }); });
}

/* ---------- 문서 저장소: Supabase docs 표를 앱의 db 모양으로 ---------- */
function ts(v) {
  if (!v) return 0;
  let s = String(v).replace(" ", "T").replace(/(\.\d{3})\d+/, "$1");
  if (/[+-]\d\d$/.test(s)) s += ":00";
  const n = Date.parse(s);
  return Number.isFinite(n) ? n : 0;
}
function dbError(e) {
  const code = (e && e.code) || ""; const msg = String((e && e.message) || "");
  const out = new Error(msg || "error");
  if (/^[a-z_]{3,30}$/.test(msg)) out.reason = msg; // 서버 규칙이 거절한 이유 (vote_closed 같은)
  if (code === "42501" || /row-level security|permission denied/i.test(msg)) out.code = "permission_denied";
  else if (code === "P0002") out.code = "invalid_argument";
  else if (!code || /^PGRST30/.test(code) || /JWT|fetch|network|Failed/i.test(msg)) out.code = "unavailable";
  else out.code = "unknown";
  return out;
}
function makeClaude(tid) {
  const cache = {}; // coll -> id -> { data, at }
  const subs = new Set();
  let ready = false, loading = null, buffer = null, hiddenAt = 0;
  const put = (c, id, data, at, force) => {
    const m = cache[c] || (cache[c] = {}); const cur = m[id];
    if (!force && cur && at && cur.at && at < cur.at) return false;
    m[id] = { data, at: at || 0 }; return true;
  };
  const drop = (c, id) => { if (cache[c] && cache[c][id]) { delete cache[c][id]; return true; } return false; };
  const snapColl = c => { const m = cache[c] || {}; const docs = Object.keys(m).map(id => ({ id, exists: true, data: () => clone(m[id].data) })); return { docs, size: docs.length, empty: !docs.length, metadata: { fromCache: false } }; };
  const snapDoc = (c, id) => { const d = cache[c] && cache[c][id]; return { id, exists: !!d, data: () => (d ? clone(d.data) : undefined), metadata: { fromCache: false } }; };
  const fire = s => { try { s.cb(s.id ? snapDoc(s.c, s.id) : snapColl(s.c)); } catch (e) { console.error(e); } };
  const emit = (c, id) => subs.forEach(s => { if (s.c === c && (!s.id || id === undefined || s.id === id)) fire(s); });
  const applyChange = p => {
    if (p.eventType === "DELETE") return;
    const n = p.new || {}; if (n.team_id !== tid) return;
    if (n.coll === "gone") { // 같은 팀에서 지운 문서나 내보낸 멤버
      const i = String(n.id).indexOf(":"); const c = n.id.slice(0, i), id = n.id.slice(i + 1);
      if (c === "member") { if (window.__memberGone) window.__memberGone(); return; }
      if (drop(c, id)) emit(c, id);
      return;
    }
    if (put(n.coll, n.id, n.data, ts(n.updated_at))) emit(n.coll, n.id);
  };
  const onChange = p => { if (buffer) buffer.push(p); applyChange(p); };
  async function loadAll() {
    if (loading) return loading;
    buffer = [];
    loading = (async () => {
      const rows = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await sb.from("docs").select("coll,id,data,updated_at").eq("team_id", tid).order("coll").order("id").range(from, from + 999);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 1000) break;
      }
      const missed = buffer || [];
      Object.keys(cache).forEach(k => { delete cache[k]; });
      rows.forEach(r => { if (r.coll !== "gone") put(r.coll, r.id, r.data, ts(r.updated_at), true); });
      missed.forEach(applyChange);
      ready = true;
      subs.forEach(fire);
    })().finally(() => { loading = null; buffer = null; });
    return loading;
  }
  // 표를 바꾸면 서버가 집계(tally)를 다시 센다. 실시간 연결이 없어도 바로 보이도록 한 번 더 받아 온다
  let tallyTimer = 0;
  const refreshTally = () => { clearTimeout(tallyTimer); tallyTimer = setTimeout(async () => {
    const { data, error } = await sb.from("docs").select("id,data,updated_at").eq("team_id", tid).eq("coll", "tally");
    if (error || !data) return;
    const seen = new Set(); data.forEach(r => { seen.add(r.id); put("tally", r.id, r.data, ts(r.updated_at)); });
    Object.keys(cache.tally || {}).forEach(id => { if (!seen.has(id)) drop("tally", id); });
    emit("tally");
  }, 400); };
  const afterWrite = (c, del) => { if (c === "uvote" || (del && (c === "events" || c === "notices"))) refreshTally(); };
  let tries = 0;
  const firstLoad = () => loadAll().catch(() => { if (!ready) setTimeout(firstLoad, Math.min(15000, 2000 * ++tries)); });
  firstLoad();
  sb.channel("docs-" + tid)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "docs", filter: "team_id=eq." + tid }, onChange)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "docs", filter: "team_id=eq." + tid }, onChange)
    .subscribe(status => { if (status === "SUBSCRIBED" && ready) loadAll().catch(() => {}); });
  // 휴대폰에서 오래 꺼 뒀다가 다시 열면 놓친 변경을 한 번에 다시 받는다
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (ready && hiddenAt && Date.now() - hiddenAt > 20000) loadAll().catch(() => {});
  });

  const db = {
    collection: c => ({
      onSnapshot(cb, err) { const s = { c, cb, err }; subs.add(s); if (ready) queueMicrotask(() => { if (subs.has(s)) fire(s); }); return () => subs.delete(s); },
    }),
    doc(path) {
      const [c, id] = String(path).split("/");
      return {
        onSnapshot(cb, err) { const s = { c, id, cb, err }; subs.add(s); if (ready) queueMicrotask(() => { if (subs.has(s)) fire(s); }); return () => subs.delete(s); },
        async set(data) {
          let r;
          try { r = await sb.from("docs").upsert({ team_id: tid, coll: c, id, data }, { onConflict: "team_id,coll,id" }).select("updated_at").single(); } catch (e) { throw dbError(e); }
          if (r.error) throw dbError(r.error);
          put(c, id, clone(data), ts(r.data && r.data.updated_at), true); emit(c, id); afterWrite(c);
          // 설정에서 팀 이름을 바꾸면 초대 화면과 팀 고르기에 보이는 이름도 맞춘다
          if (c === "team" && id === "settings" && data && String(data.teamName || "").trim() && state.team && data.teamName.trim() !== state.team.name && (state.role === "owner" || state.role === "admin")) {
            const name = data.teamName.trim().slice(0, 40);
            sb.from("teams").update({ name }).eq("id", tid).then(({ error }) => { if (!error) state.team.name = name; });
          }
        },
        async update(patch) {
          let r;
          try { r = await sb.rpc("doc_patch", { p_team: tid, p_coll: c, p_id: id, p_patch: patch }); } catch (e) { throw dbError(e); }
          if (r.error) throw dbError(r.error);
          put(c, id, r.data.data, ts(r.data.at), true); emit(c, id); afterWrite(c);
        },
        async delete() {
          let r;
          try { r = await sb.from("docs").delete().eq("team_id", tid).eq("coll", c).eq("id", id).select("id"); } catch (e) { throw dbError(e); }
          if (r.error) throw dbError(r.error);
          if (!(r.data || []).length && cache[c] && cache[c][id]) { const e = new Error("denied"); e.code = "permission_denied"; throw e; }
          if (drop(c, id)) emit(c, id);
          afterWrite(c, true);
        },
      };
    },
  };
  const user = {
    isOwner: async () => state.role === "owner",
    canEdit: async () => state.role === "owner" || state.role === "admin",
    can: async () => true,
    id: async () => state.uid,
    profiles: async ids => Object.fromEntries(ids.map(i => { const m = state.members.find(x => x.user_id === i); return [i, { name: m ? m.display_name : "" }]; })),
  };
  const downloads = {
    async save({ filename, data, mimeType }) {
      const blob = new Blob([typeof data === "string" ? data : JSON.stringify(data)], { type: mimeType || "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename || "download"; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      return { status: "saved" };
    },
  };
  return { use: async n => (n === "db" ? db : n === "user" ? user : n === "downloads" ? downloads : null) };
}

/* ---------- 설정 화면의 팀 카드 ---------- */
const inviteLink = () => (state.team && state.team.invite_code ? APP_URL + "?join=" + state.team.invite_code : "");
const pendingReqs = () => state.members.filter(m => m.role === "member" && m.admin_req).sort((a, b) => (a.admin_req < b.admin_req ? -1 : 1));
window.webRoleCard = () => {
  const r = state.role, admin = r === "owner" || r === "admin", owner = r === "owner";
  const me = state.members.find(m => m.user_id === state.uid) || {};
  const real = (typeof Store !== "undefined" && Store.real) || {};
  const preview = typeof Store !== "undefined" && Store.preview;
  const linked = u => { try { const p = claimOf(u); return p ? pname(p) + " 선수" : "선수 연결 전"; } catch (e) { return ""; } };
  const reqs = pendingReqs();
  const reqBox = owner && reqs.length ? `<div class="acct" style="display:flex;flex-direction:column;gap:6px"><div style="font-weight:700">관리자 신청 ${reqs.length}건</div>
    ${reqs.map(m => `<div class="mrow"><div class="grow"><div class="nm">${esc(m.display_name || "이름 없음")}</div><div class="tiny muted">${esc(linked(m.user_id))}</div></div><button class="btn sm primary" data-web="adminOk" data-u="${esc(m.user_id)}">수락</button><button class="btn sm muted" data-web="adminNo" data-u="${esc(m.user_id)}">거절</button></div>`).join("")}
    <div class="hint">수락하면 운영진이 돼요. 운영진은 일정, 출석, 라인업, 기록, 회비, 벌금, 선수, 공지를 관리해요.</div></div>` : "";
  const myReq = r === "member" ? (me.admin_req
    ? `<div class="acct" style="display:flex;flex-direction:column;gap:8px"><div style="font-weight:700">관리자 신청을 보냈어요</div><div class="small muted">팀장이 수락하면 운영진 화면으로 바뀌어요.</div><button class="btn muted" data-web="adminCancel" style="align-self:flex-start">신청 취소</button></div>`
    : `<div class="hint">본인 참석만 투표하고, 회비와 벌금은 본인 것만 봐요.</div><button class="btn block" data-web="adminReq">관리자 신청</button>`) : "";
  const chip = m => m.role === "member" && m.admin_req ? `<span class="chip">신청 중</span>` : `<span class="chip${m.role === "member" ? "" : " clay"}">${esc(ROLE[m.role] || "")}</span>`;
  const rows = state.members.map(m => `<div class="mrow"><div class="grow"><div class="nm">${esc(m.display_name || "이름 없음")}${m.user_id === state.uid ? ` <span class="tiny muted">나</span>` : ""}</div><div class="tiny muted">${esc(linked(m.user_id))}</div></div>
    ${owner && m.role !== "owner" ? `<select data-web-role="${esc(m.user_id)}" aria-label="${esc(m.display_name || "멤버")} 역할"><option value="admin"${m.role === "admin" ? " selected" : ""}>운영진</option><option value="member"${m.role === "member" ? " selected" : ""}>팀원</option></select><button class="btn sm muted" data-web="giveOwner" data-u="${esc(m.user_id)}">팀장 넘기기</button><button class="btn sm muted" data-web="kick" data-u="${esc(m.user_id)}">내보내기</button>` : chip(m)}</div>`).join("");
  return `<section class="card" style="gap:10px"><div class="labrow"><span class="lab">팀과 권한</span><span class="chip${admin ? " clay" : ""}">나는 ${esc(ROLE[r] || "")}</span></div>
    ${reqBox}
    <div class="field" style="margin:0">팀에서 쓰는 내 이름<div class="namerow"><input class="inp" id="webName" value="${esc(me.display_name || "")}" maxlength="30" aria-label="팀에서 쓰는 내 이름"><button class="btn" data-web="saveName">저장</button></div></div>
    ${admin ? `<div class="acct" style="display:flex;flex-direction:column;gap:8px"><div style="font-weight:700">초대 링크</div><div class="invite">${esc(inviteLink())}</div>
      <div class="btnrow"><button class="btn primary" data-web="invite">초대 문구 보기</button><button class="btn muted" data-web="newCode">새 링크 만들기</button></div>
      <div class="hint">이 링크로 들어온 사람은 모두 팀원이 돼요. 운영진이 필요하면 본인이 관리자 신청을 하고, 팀장이 수락해요. 링크가 엉뚱한 곳에 퍼졌다면 새 링크를 만들어 예전 링크를 막으세요.</div></div>
    <div><div class="labrow"><span class="lab">멤버 ${state.members.length}명</span></div>${rows}</div>
    ${owner ? `<div class="hint">운영진 지정과 해제, 내보내기는 팀장만 할 수 있어요. 목록에서 바로 바꿀 수도 있어요.</div>` : `<div class="hint">운영진 지정과 해제, 내보내기는 팀장만 할 수 있어요.</div>`}` : myReq}
    ${real.canWrite && !preview ? `<button class="btn block" data-act="previewMember">팀원 화면으로 보기</button>` : ""}
    <div class="btnrow"><button class="btn" data-web="switchTeam">다른 팀</button><button class="btn muted" data-web="logout">로그아웃</button></div>
    <div class="shellnote" style="margin:0"><a class="linkbtn" href="privacy.html">개인정보처리방침과 이용약관</a> <button class="linkbtn" data-web="leave">회원 탈퇴</button></div></section>`;
};
// 팀장 홈 맨 위에 관리자 신청을 알린다
window.webHomeCards = () => {
  if (state.role !== "owner") return "";
  const reqs = pendingReqs(); if (!reqs.length) return "";
  return `<a class="card soft" href="#config" style="flex-direction:row;align-items:center;gap:10px;border-radius:16px;padding:12px 14px"><span class="num" style="font-size:30px;line-height:1">${reqs.length}</span><span class="grow"><b style="display:block">관리자 신청이 왔어요</b><span class="small muted">${esc(reqs.map(m => m.display_name || "이름 없음").join(", "))}</span></span>${typeof ICON !== "undefined" ? ICON.chev : ""}</a>`;
};

/* ---------- 버튼과 입력 ---------- */
const rerender = () => { if (typeof render === "function" && state.screen === "app") render(); };
const toastAny = m => (typeof toast === "function" && state.screen === "app" ? toast(m) : note(m));
async function rpc(name, args, okMsg) {
  if (state.busy) return null;
  state.busy = true;
  try {
    const { data, error } = await sb.rpc(name, args);
    if (error) throw error;
    if (okMsg) toastAny(okMsg);
    return { data };
  } catch (e) {
    const m = String((e && e.message) || "");
    toastAny(m.includes("bad_code") ? "초대 링크가 바뀌었거나 잘못됐어요. 운영진에게 새 링크를 받아 주세요." : m.includes("owner_only") ? "팀장만 할 수 있어요." : m.includes("not_self") ? "내 역할은 바꿀 수 없어요." : m.includes("member_only") ? "팀원만 신청할 수 있어요." : m.includes("no_request") ? "이미 처리된 신청이에요." : m.includes("team_limit") ? "팀은 한 사람당 5개까지 만들 수 있어요." : m.includes("owner_has_members") ? "팀원이 있는 팀의 팀장은 먼저 다른 멤버에게 팀장을 넘겨야 탈퇴할 수 있어요." : m.includes("no_member") ? "팀에 없는 멤버예요." : /function|schema cache/i.test(m) ? "서버 설정이 아직 반영되지 않았어요. 팀장에게 알려 주세요." : "처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
    return null;
  } finally { state.busy = false; }
}
const ACTS = {
  retry: () => afterLogin(),
  kakao: async t => {
    t.disabled = true;
    try { await kakaoStart(); } catch (e) { t.disabled = false; note("카카오 로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요."); }
  },
  logout: async () => { try { await sb.auth.signOut(); } catch (e) { /* 아래에서 처음 화면으로 */ } store.set(LS.team, null); location.replace(APP_URL); },
  pick: t => enterTeam(t.dataset.id),
  switchTeam: () => { store.set(LS.pick, "1"); location.reload(); },
  saveName: async () => {
    const v = ($("#webName").value || "").trim(); if (!v) { toastAny("이름을 넣어 주세요"); return; }
    if (await rpc("set_my_name", { p_team: state.tid, p_name: v }, "이름을 바꿨어요")) { await loadMembers().catch(() => {}); rerender(); }
  },
  invite: () => {
    const name = (state.team && state.team.name) || "우리 팀";
    const text = `[${name}] 팀 매니저 초대\n아래 링크를 열고 카카오로 로그인하면 바로 팀원이 돼요.\n참석 투표, 라인업, 내 회비를 여기서 봐요.\n${inviteLink()}`;
    if (typeof textSheet === "function") textSheet("초대 문구", text, "단톡방에 붙여 넣으세요.");
  },
  newCode: () => confirmSheet("새 초대 링크", "지금 링크로는 더 이상 들어올 수 없게 돼요. 이미 들어온 멤버는 그대로예요.", "새 링크 만들기", async () => {
    const r = await rpc("new_invite_code", { p_team: state.tid }, "새 초대 링크를 만들었어요");
    if (r) { await loadMembers().catch(() => {}); rerender(); }
  }),
  adminReq: () => confirmSheet("관리자 신청", "팀장에게 운영진 권한을 신청할까요? 수락되면 일정, 출석, 회비 같은 팀 관리를 할 수 있어요.", "신청하기", async () => {
    if (await rpc("request_admin", { p_team: state.tid }, "관리자 신청을 보냈어요")) { await loadMembers().catch(() => {}); rerender(); }
  }),
  adminCancel: async () => { if (await rpc("cancel_admin_request", { p_team: state.tid }, "신청을 취소했어요")) { await loadMembers().catch(() => {}); rerender(); } },
  adminOk: t => {
    const m = state.members.find(x => x.user_id === t.dataset.u); if (!m) return;
    confirmSheet("관리자 신청 수락", `${m.display_name || "이 멤버"} 님을 운영진으로 바꿀까요? 나중에 멤버 목록에서 다시 팀원으로 바꿀 수 있어요.`, "수락", async () => {
      if (await rpc("answer_admin_request", { p_team: state.tid, p_user: m.user_id, p_ok: true }, `${m.display_name || "멤버"} 님이 운영진이 됐어요`)) { await loadMembers().catch(() => {}); rerender(); }
    });
  },
  adminNo: async t => {
    const m = state.members.find(x => x.user_id === t.dataset.u); if (!m) return;
    if (await rpc("answer_admin_request", { p_team: state.tid, p_user: m.user_id, p_ok: false }, "신청을 거절했어요")) { await loadMembers().catch(() => {}); rerender(); }
  },
  giveOwner: t => {
    const m = state.members.find(x => x.user_id === t.dataset.u); if (!m) return;
    confirmSheet("팀장 넘기기", `${m.display_name || "이 멤버"} 님에게 팀장을 넘길까요? 나는 운영진이 되고, 운영진 지정과 내보내기는 새 팀장만 할 수 있어요.`, "넘기기", async () => {
      if (await rpc("transfer_owner", { p_team: state.tid, p_user: m.user_id }, `${m.display_name || "멤버"} 님이 팀장이 됐어요`)) location.reload();
    });
  },
  leave: () => confirmSheet("회원 탈퇴", "내 계정과 내가 낸 참석 응답, 투표, 입금 요청이 모두 지워지고 되돌릴 수 없어요. 운영진이 기록한 경기 기록과 회비 장부는 팀에 남아요.", "탈퇴하기", async () => {
    if (await rpc("delete_my_account", {}, "탈퇴했어요")) { try { await sb.auth.signOut(); } catch (e) { /* 계정이 이미 지워졌다 */ } store.set(LS.team, null); location.replace(APP_URL); }
  }),
  kick: t => {
    const m = state.members.find(x => x.user_id === t.dataset.u); if (!m) return;
    confirmSheet("멤버 내보내기", `${m.display_name || "이 멤버"} 님을 팀에서 내보낼까요? 다시 들어오려면 초대 링크가 필요해요.`, "내보내기", async () => {
      if (await rpc("remove_member", { p_team: state.tid, p_user: m.user_id }, "내보냈어요")) { await loadMembers().catch(() => {}); rerender(); }
    });
  },
};
document.addEventListener("click", ev => {
  const t = ev.target.closest("[data-web]"); if (!t) return;
  const fn = ACTS[t.dataset.web]; if (!fn) return;
  ev.preventDefault(); fn(t, ev);
});
document.addEventListener("change", async ev => {
  const t = ev.target.closest("[data-web-role]"); if (!t) return;
  const m = state.members.find(x => x.user_id === t.dataset.webRole);
  if (await rpc("set_member_role", { p_team: state.tid, p_user: t.dataset.webRole, p_role: t.value }, `${(m && m.display_name) || "멤버"} 님을 ${ROLE[t.value]}으로 바꿨어요`)) await loadMembers().catch(() => {});
  rerender();
});
document.addEventListener("submit", async ev => {
  const f = ev.target; if (!f || !f.id) return;
  if (!["emailForm", "joinForm", "codeForm", "createForm"].includes(f.id)) return;
  ev.preventDefault();
  const btn = f.querySelector("[type=submit]"); if (btn) btn.disabled = true;
  try {
    if (f.id === "emailForm") {
      const email = f.elements.email.value.trim();
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: APP_URL } });
      if (error) { note(/rate|limit|seconds/i.test(error.message) ? "잠시 후 다시 시도해 주세요. 메일은 짧은 시간에 여러 번 보낼 수 없어요." : "메일을 보내지 못했어요. 주소를 확인해 주세요."); return; }
      screen("sent", `${hero("메일을 보냈어요", email)}<section class="card"><div class="small muted">메일함에서 로그인 링크를 눌러 주세요. 이 브라우저에서 열어야 로그인이 이어져요. 메일이 안 보이면 스팸함도 확인해 주세요.</div><button class="btn block" data-web="back">다른 방법으로 로그인</button></section>`);
    } else if (f.id === "joinForm") {
      const r = await rpc("join_team", { p_code: f.dataset.code, p_name: f.elements.name.value.trim() });
      if (r && r.data) { store.set(LS.join, null); await loadMyTeams().catch(() => {}); enterTeam(r.data); }
    } else if (f.id === "codeForm") {
      const code = parseCode(f.elements.code.value);
      const team = code ? await teamByCode(code) : null;
      if (!team) { note("찾는 팀이 없어요. 링크를 다시 확인해 주세요."); return; }
      if (state.teams.some(t => t.id === team.id)) { enterTeam(team.id); return; }
      showJoin(team, code);
    } else if (f.id === "createForm") {
      const name = f.elements.name.value.trim(); if (!name) return;
      const r = await rpc("create_team", { p_name: name });
      if (r && r.data) { await loadMyTeams().catch(() => {}); enterTeam(r.data); }
    }
  } finally { if (btn && btn.isConnected) btn.disabled = false; }
});
ACTS.back = () => showLogin("");

/* ---------- 미리보기 (예시 데이터, 저장 안 됨) ---------- */
const demo = qs.get("demo");
if (demo === "member" || demo === "op") {
  window.__DEMO = demo === "op" ? "op" : "member";
  window.webRoleCard = () => `<section class="card" style="gap:10px"><div class="labrow"><span class="lab">팀과 권한</span><span class="chip">미리보기</span></div>
    <div class="small muted">실제 앱에서는 여기서 내 이름을 바꾸고, 운영진은 초대 링크를 만들고, 팀장은 운영진을 정해요.</div>
    <a class="btn block" href="${esc(APP_URL)}">로그인 화면으로</a></section>`;
  startApp();
} else if (!URL_ || !KEY_) {
  screen("setup", `${hero("KEI FC 팀 매니저", "서버 연결을 기다리는 중이에요")}
    <section class="card"><div class="small muted">아직 Supabase 연결 정보가 없어요. src/config.js에 Project URL과 publishable key를 넣고 다시 배포하면 로그인할 수 있어요.</div></section>${demoLinks}`);
} else {
  boot();
}
