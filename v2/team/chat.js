// 대화: 일정마다 방 하나 (방 이름 = 일정 id). 매니볼 모바일 시안 4-6 대화와 같은 모양.
// 글 쓰기와 가리기는 서버 함수(chat_send, chat_hide)로만 한다. 욕설은 서버가 그 단어만 *** 로 가려 저장하고,
// 가린 글이 있으면 운영진에게 휴대폰 알림이 간다. 끝난 방(일정 날짜가 지났거나 취소)은 읽기만 한다.
import { S, sb, esc, render, toast, fail, ls, isAdmin, viewMode, isCanceled, md, wd, evName, evStart, isPlay, maintLocked, todayStr, att, confirmBox, closeAt, hmK, myUv, patchDoc, noticesList, momDeadline, cameTo } from "./main.js";
import { hd, hdTab, empty, initial, navBar } from "./ui.js";
import { isPC } from "./pc.js";

export const CH = { rows: {}, tid: "", loading: false, loaded: false, missing: false, tab: "up", sending: false, stick: false, last: "", merc: null, xload: "", xbusy: false };
const LIMIT = 2000;
const VS = { yes: "참석", late: "늦참", no: "불참" };
const H24 = 864e5;

// 불러오기: 팀을 열 때 한 번, 그 뒤는 실시간으로 받는다
export async function chatLoad(force) {
  if (!S.tid) return;
  if (CH.tid !== S.tid) { CH.rows = {}; CH.loaded = false; CH.missing = false; CH.tid = S.tid; CH.merc = null; CH.xload = ""; }
  if (CH.loading || (CH.loaded && !force)) return;
  CH.loading = true;
  const { data, error } = await sb.from("chat").select("id,team_id,room,user_id,name,body,masked,hidden,kind,created_at").eq("team_id", S.tid).order("id", { ascending: false }).limit(LIMIT);
  CH.loading = false;
  if (error) { CH.missing = true; return; } // 서버에 대화 표가 아직 없을 때 (SQL 실행 전)
  (data || []).forEach(r => { CH.rows[r.id] = r; });
  CH.loaded = true; CH.missing = false;
  chatLoadExtra().then(render).catch(() => {});
}
// 다른 팀에 있는 방: 상대 팀이 연 매칭 방, 용병으로 간 경기 방
async function chatLoadExtra() {
  if (CH.xbusy || CH.xload === S.tid) return; CH.xbusy = true;
  try {
    const { data } = await sb.rpc("chat_merc_rooms");
    CH.merc = Array.isArray(data) ? data : [];
    const rooms = CH.merc.map(m => ({ team: m.team, room: m.room }))
      .concat(isAdmin() ? Object.values(S.events).filter(e => e.xmatch && e.xmatch.team).map(e => matchHost(e)).filter(h => h.team !== S.tid) : []);
    for (const h of rooms) {
      const { data: rows } = await sb.from("chat").select("id,team_id,room,user_id,name,body,masked,hidden,kind,created_at").eq("team_id", h.team).eq("room", h.room).order("id", { ascending: false }).limit(500);
      (rows || []).forEach(r => { CH.rows[r.id] = r; });
    }
    CH.xload = S.tid;
  } catch (e) { CH.merc = CH.merc || []; }
  CH.xbusy = false;
}
// 실시간: 새 글, 가린 글 (우리 팀 방, 매칭 방, 용병으로 간 방)
export function chatOnChange(p) {
  const n = p && p.new; if (!n || !n.id) return;
  const mine = n.team_id === S.tid || (CH.merc || []).some(m => m.team === n.team_id && m.room === n.room) || (String(n.room).startsWith("m-") && Object.values(S.events).some(e => { if (!e.xmatch) return false; const h = matchHost(e); return h.team === n.team_id && h.room === n.room; }));
  if (!mine) return;
  const lg = document.querySelector(".pcr .chlog");
  const nearBottom = lg ? lg.scrollTop + lg.clientHeight >= lg.scrollHeight - 160 : innerHeight + scrollY >= document.documentElement.scrollHeight - 160;
  CH.rows[n.id] = n;
  if (/^#\/chat/.test(location.hash) && nearBottom) CH.stick = true;
  render();
}

// 방 규칙 (서버의 chat_room_open, chat_open_at과 같다)
// 경기 방은 투표 마감 때 열린다. 마감이 경기 24시간 전보다 늦으면 24시간 전에 열린다
export const openAt = e => Math.min(Number(closeAt(e)), evStart(e).getTime() - H24);
const datedUp = e => /^\d{4}-\d{2}-\d{2}$/.test((e && e.date) || "") && e.date >= todayStr();
const isOpen = e => !!e && !isCanceled(e) && datedUp(e) && Date.now() >= openAt(e);
const isLocked = e => !!e && !isCanceled(e) && datedUp(e) && Date.now() < openAt(e);
const roomsUp = () => Object.values(S.events).filter(e => datedUp(e)).sort((a, b) => evStart(a) - evStart(b));
const roomsPast = () => Object.values(S.events).filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.date || "") && e.date < todayStr()).sort((a, b) => evStart(b) - evStart(a)).slice(0, 30);
const roomsMatch = () => Object.values(S.events).filter(e => e.xmatch && e.xmatch.team && /^\d{4}-\d{2}-\d{2}$/.test(e.date || "")).sort((a, b) => evStart(b) - evStart(a)).slice(0, 30);
const titleOf = e => `${md(e.date)} ${wd(e.date)} ${evName(e)}`;
const adminView = () => isAdmin() && viewMode() === "admin";
const myName = () => { const m = S.members.find(x => x.user_id === S.uid); return (m && m.display_name) || ""; };
const teamName = () => (S.team && S.team.name) || "우리 팀";
// 매칭 방은 두 팀 중 팀 번호가 앞선 팀에 둔다 (양쪽이 같은 방을 찾게)
function matchHost(e) { const o = e.xmatch.team; return S.tid < o ? { team: S.tid, room: "m-" + e.id } : { team: o, room: "m-" + (e.xmatch.event || "") }; }
// 방 설명: key = all | 일정 id | m-일정 id | x~팀~일정
function rd(key) {
  if (key === "all") return { key, kind: "all", team: S.tid, room: "all", title: `${teamName()} 전체 대화방` };
  if (key.startsWith("m-")) { const e = S.events[key.slice(2)]; if (!e || !e.xmatch || !e.xmatch.team) return null; const h = matchHost(e); return { key, kind: "match", team: h.team, room: h.room, e, title: `${e.opponent || "상대 팀"} 매칭 방` }; }
  if (key.startsWith("x~")) { const [, t, r] = key.split("~"); const m = (CH.merc || []).find(x => x.team === t && x.room === r); if (!m) return null; return { key, kind: "merc", team: t, room: r, e: m.ev, m, title: `${m.tname} ${titleOf(m.ev)}` }; }
  const e = S.events[key]; if (!e) return null; return { key, kind: "ev", team: S.tid, room: key, e, title: titleOf(e) };
}
const msgsAll = d => Object.values(CH.rows).filter(r => r.team_id === d.team && r.room === d.room).sort((a, b) => a.id - b.id);
// 일정 방에 내가 있는지: 운영진, 정원 안 참석과 늦참. 나간 사람은 나가기 전 글까지만 본다
const inRoomNow = e => isAdmin() || [...att(e).yes, ...att(e).late].some(x => x.uid === S.uid);
function cutOf(d) {
  if (d.kind !== "ev") return Infinity;
  if (inRoomNow(d.e)) return Infinity;
  const lf = msgsAll(d).filter(r => r.kind === "left" && r.user_id === S.uid).pop();
  return lf ? lf.id : -1;
}
const msgsOf = d => { const c = cutOf(d); return c < 0 ? [] : msgsAll(d).filter(r => r.id <= c); };
const writableTime = e => isOpen(e);
const canWrite = d => d.kind === "all" ? true : d.kind === "match" ? !isCanceled(d.e) && datedUp(d.e) : isOpen(d.e) && (d.kind === "merc" || inRoomNow(d.e));

// 읽은 자리: 이 기기에 방마다 마지막으로 본 글 번호를 둔다
let READ = null, READ_K = "";
const readKey = () => "mb-chat-read:" + S.tid + ":" + S.uid;
function reads() { const k = readKey(); if (READ_K !== k) { READ_K = k; try { READ = JSON.parse(ls.get(k) || "{}") || {}; } catch (e) { READ = {}; } } return READ; }
function markRead(key, id) { const r = reads(); if ((r[key] || 0) >= id) return; r[key] = id; ls.set(readKey(), JSON.stringify(r)); }
function unreadOf(d) {
  const last = reads()[d.key] || 0; const me = myName();
  let n = 0, at = false;
  msgsOf(d).forEach(r => { if (r.id > last && r.user_id !== S.uid && !r.hidden && !r.kind) { n++; if (me && r.body.indexOf("@" + me) >= 0) at = true; } });
  return { n, at };
}
const allKeys = () => ["all"].concat(roomsUp().concat(roomsPast()).map(e => e.id), isAdmin() ? roomsMatch().map(e => "m-" + e.id) : [], (CH.merc || []).map(m => `x~${m.team}~${m.room}`));
// 하단 메뉴 '대화' 칸의 숫자 (전체 대화방은 알림을 켠 때만 센다)
export function chatUnread() {
  if (!CH.loaded || CH.tid !== S.tid) return 0;
  return allKeys().reduce((t, k) => { if (k === "all" && !allOn()) return t; const d = rd(k); return d ? t + unreadOf(d).n : t; }, 0);
}

const hm = iso => { const d = new Date(Date.parse(iso) + 9 * 3600e3); return d.toISOString().slice(11, 16); };
const dayOf = iso => new Date(Date.parse(iso) + 9 * 3600e3).toISOString().slice(0, 10);
const dayLabel = ds => `${md(ds)} ${wd(ds)}`;
const hmT = t => hmK(t);
// 글 모양: @이름은 굵게 밑줄, *** 는 가린 말
function bodyHtml(t) {
  return String(t).split(/(@[^\s@]+|\*\*\*)/).filter(Boolean).map(s => s === "***" ? `<span class="mk" aria-label="가린 말">***</span>` : s[0] === "@" ? `<span class="at">${esc(s)}</span>` : esc(s)).join("");
}

// 알림: 기본은 나를 부른 글(@이름)과 운영진 글. 모든 글, 끔. 전체 대화방은 따로 켜고 끈다 (기본 꺼짐)
const ALARM = [["mention", "@와 운영진 글만", "지금은 나를 부른 글과 운영진 글만 알림이 와요"], ["all", "모든 글", "지금은 모든 글에 알림이 와요"], ["off", "알림 끔", "지금은 대화 알림이 꺼져 있어요"]];
const alarmMode = () => { const v = (myUv() || {}).chat; return ALARM.some(a => a[0] === v) ? v : "mention"; };
const allOn = () => (myUv() || {}).chatAll === "on";
const BELL = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#121110" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0"></path></svg>`;
const MUTE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B5650" stroke-width="2.2" stroke-linecap="round" aria-label="알림 꺼짐"><path d="M6 8a6 6 0 0 1 9.3-5M18 8v5l2 3H8M10 20a2 2 0 0 0 4 0M3 3l18 18"></path></svg>`;
function alarmBtn() {
  const a = ALARM.find(x => x[0] === alarmMode());
  return `<button type="button" class="chal" data-act="chatAlarm" aria-label="${esc(a[2])}. 눌러서 바꿔요">${BELL}<span>${esc(a[1])}</span></button>`;
}
const PEOPLE_I = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#121110" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.6a3 3 0 0 1 0 5.8"></path></svg>`;
const lastLine = (d, ms) => { const last = ms.filter(r => !r.kind).pop(); return last ? `${esc(last.name)}: ${last.hidden ? "가린 글이에요" : esc(last.body)}` : ""; };
const whenOf = ms => { const last = ms[ms.length - 1]; return last ? (dayOf(last.created_at) === todayStr() ? hm(last.created_at) : md(dayOf(last.created_at))) : ""; };

/* ===================== 대화 목록 ===================== */
export function vChat() {
  if (isPC()) return pcChat("");
  return `${hdTab("대화", alarmBtn())}<div class="body" style="gap:12px">${listInner("")}</div>${navBarChat()}`;
}
const TABN = { up: "경기 방은 투표 마감 때 열려요. 마감이 경기 24시간 전보다 늦으면 24시간 전에 열리고, 그때 참석한 사람이 들어와요.", past: "끝난 경기 방은 읽기만 할 수 있어요. 경기 기록과 함께 남아요.", match: "매칭이 잡히면 양 팀 운영진만 있는 방이 열려요. 팀원에게는 보이지 않아요.", merc: "용병으로 받아 준 팀의 그 경기 방만 보여요. 경기가 끝나면 그 방에서 나가요." };
// 방 목록 (휴대폰 목록 화면과 PC 왼쪽 칸이 같이 쓴다). cur: PC에서 지금 연 방
function listInner(cur) {
  if (!CH.loaded && !CH.loading && !CH.missing) chatLoad().then(render).catch(() => {});
  const hasMatch = isAdmin() && roomsMatch().length; const hasMerc = (CH.merc || []).length;
  const TBS = [["up", "다가오는 일정"], ["past", "지난 일정"]].concat(hasMatch ? [["match", "매칭 방"]] : [], hasMerc ? [["merc", "용병으로 간 방"]] : []);
  const tab = TBS.some(x => x[0] === CH.tab) ? CH.tab : "up";
  const keys = tab === "past" ? roomsPast().map(e => e.id) : tab === "match" ? roomsMatch().map(e => "m-" + e.id) : tab === "merc" ? (CH.merc || []).map(m => `x~${m.team}~${m.room}`) : roomsUp().map(e => e.id);
  const tabs = TBS.map(([k, l]) => `<button type="button" class="chtab" data-act="chatTab" data-v="${k}" aria-pressed="${tab === k}">${l}</button>`).join("");
  const pc = isPC();
  // 전체 대화방 (팀원만, 맨 위)
  const A = rd("all"); const ams = msgsOf(A); const au = unreadOf(A);
  const allCard = `<a class="chr chall${cur === "all" ? " on" : ""}" href="#/chat/all" aria-label="${esc(A.title)}, 팀원만${au.n ? ", 안 읽은 글 " + au.n + "개" : ""}"${cur === "all" ? ' aria-current="true"' : ""}><span class="chd ic" aria-hidden="true">${PEOPLE_I}</span><span class="cht"><b>${esc(A.title)} <i class="chtag">팀원만</i></b><span>${lastLine(A, ams) || "팀원끼리 이야기하는 방이에요"}</span></span><span class="chm"><span>${whenOf(ams)}</span><span class="row">${allOn() ? "" : MUTE}${au.n ? `<span class="chn" aria-hidden="true">${au.n > 99 ? "99+" : au.n}</span>` : ""}</span></span></a>`;
  const rows = keys.map(k => {
    const d = rd(k); if (!d) return "";
    const e = d.e; const ms = msgsOf(d); const u = unreadOf(d);
    const locked = d.kind !== "match" && isLocked(e); const done = !locked && !(d.kind === "match" ? !isCanceled(e) && datedUp(e) : isOpen(e));
    const outside = d.kind === "ev" && !locked && !done && !inRoomNow(e) && cutOf(d) < 0;
    const sub = locked ? `대화방은 ${hmT(openAt(e))}에 열려요` : outside ? "참석한 사람만 있는 방이에요" : lastLine(d, ms) || (done ? "글이 없어요" : "아직 글이 없어요. 먼저 말을 걸어 보세요.");
    const chip = locked ? "열리기 전" : outside ? "참석 전" : done ? (isCanceled(e) ? "취소" : "끝남") : "";
    const right = `<span>${locked ? md(e.date) : whenOf(ms)}</span><span class="row">${u.at ? `<span class="cha" aria-hidden="true">@</span>` : ""}${u.n ? `<span class="chn" aria-hidden="true">${u.n > 99 ? "99+" : u.n}</span>` : ""}${chip ? `<span class="chx">${chip}</span>` : ""}</span>`;
    const kindTag = pc ? `<i class="chtag">${d.kind === "match" ? "매칭" : d.kind === "merc" ? "용병" : e.type === "scrim" ? "내전" : e.type === "training" ? "훈련" : "경기"}</i>` : "";
    const pcSub = pc ? `<span class="chps">${esc(e.place || "장소 미정")}, ${esc(e.time || "")}</span>` : "";
    const aria = `${d.title}${u.n ? ", 안 읽은 글 " + u.n + "개" : ""}${locked ? ", 열리기 전" : done ? ", 읽기만 가능" : ""}`;
    return `<a class="chr${k === cur ? " on" : ""}" href="#/chat/${encodeURIComponent(k)}" aria-label="${esc(aria)}"${k === cur ? ' aria-current="true"' : ""}><span class="chd${!done && !locked ? "" : " off"}" aria-hidden="true"><b>${md(e.date)}</b><span>${wd(e.date)}</span></span><span class="cht"><b>${esc(d.title)}${kindTag}</b><span>${sub}</span>${pcSub}</span><span class="chm">${right}</span></a>`;
  }).join("");
  const body = CH.missing ? empty("대화를 준비하고 있어요", "서버 준비가 끝나면 바로 쓸 수 있어요.")
    : !CH.loaded ? `<div class="loading">불러오는 중이에요</div>`
    : keys.length ? rows : empty(tab === "past" ? "지난 일정이 없어요" : tab === "match" ? "매칭 방이 없어요" : "다가오는 일정이 없어요", tab === "up" ? "일정이 올라오면 방이 함께 생겨요." : "");
  return `${pc ? `<div class="chpcbar">${alarmBtn()}</div>` : ""}${CH.missing ? "" : allCard}<div class="chtabs" role="group" aria-label="방 고르기">${tabs}</div><span style="font-size:12px;line-height:1.5;color:var(--sub)">${TABN[tab]}</span>${body}`;
}
// PC: 왼쪽 방 목록, 오른쪽 방. 방을 안 골랐으면 마지막에 본 방이나 목록의 첫 방을 연다
function pcChat(id) {
  let key = id;
  if (id && S.events[id] && /^\d{4}-\d{2}-\d{2}$/.test(S.events[id].date || "")) CH.tab = S.events[id].date < todayStr() ? "past" : "up";
  if (id && id.startsWith("m-")) CH.tab = "match"; if (id && id.startsWith("x~")) CH.tab = "merc";
  if (!key) { const list = (CH.tab === "past" ? roomsPast() : roomsUp()).map(e => e.id); key = (CH.last && (list.includes(CH.last) || CH.last === "all")) ? CH.last : list[0] || "all"; }
  const d = key ? rd(key) : null;
  const right = d ? roomInner(d, true) : `<div class="pce">${empty("방을 골라 주세요", "왼쪽에서 방을 누르면 여기에 대화가 보여요.")}</div>`;
  return `${hdTab("대화")}<div class="pcsplit"><div class="pcl">${listInner(key)}</div><section class="pcr" aria-label="대화방">${right}</section></div>`;
}
// 하단 메뉴 (ui.js가 대화 칸에 안 읽은 글 수를 함께 그린다)
const navBarChat = () => navBar("대화");

/* ===================== 대화방 ===================== */
export function vChatRoom(id) {
  if (!CH.loaded && !CH.loading && !CH.missing) chatLoad().then(render).catch(() => {});
  const d = rd(id);
  if (!d) return `${hd("대화", "#/chat")}<div class="body">${(id.startsWith("x~") && CH.merc === null) ? `<div class="loading">불러오는 중이에요</div>` : empty("없는 방이에요", "지워진 일정이거나 끝난 방일 수 있어요.")}</div>`;
  if (isPC()) return pcChat(id);
  return roomInner(d, false);
}
const resultText = e => { const sc = e.score || {}; if (sc.us == null || sc.them == null || e.type === "training") return ""; const a = Number(sc.us), b = Number(sc.them); return e.type === "scrim" ? `A팀 ${a} : ${b} B팀` : `${a} : ${b} ${a > b ? "승" : a < b ? "패" : "무"}`; };
const cameN = e => { const c = Object.values(e.check || {}).filter(v => v === "in" || v === "late").length; return c || S.members.filter(m => cameTo(e, m.user_id)).length; };
const mercN = e => Object.values(e.guests || {}).filter(g => g && g.inCap).length;
// 방 내용 (휴대폰은 화면 전체, PC는 오른쪽 칸)
function roomInner(d, pc) {
  const e = d.e; CH.last = d.key;
  const adm = adminView() && d.team === S.tid && d.kind !== "match";
  const ms = msgsOf(d); const all = msgsAll(d);
  if (ms.length) markRead(d.key, ms[ms.length - 1].id);
  const roleOf = u => { const m = S.members.find(x => x.user_id === u); return m ? m.role : ""; };
  const voteOf = u => { if (d.kind !== "ev") return ""; const v = (((S.rsvp[u] || {}).ev || {})[e.id]) || {}; return v.s ? VS[v.s] + (v.s === "late" && v.q ? " " + v.q + "Q" : "") : ""; };
  const isMercRow = r => d.kind !== "match" && !S.members.some(m => m.user_id === r.user_id);
  const me = myName();
  const locked = d.kind === "ev" || d.kind === "merc" ? isLocked(e) : false;
  const writable = canWrite(d) && !CH.missing;
  const cx = e && isCanceled(e);
  const done = e && !locked && !writable && d.kind !== "all";
  // 방 위 티켓
  let tk = "", people = "";
  if (d.kind === "all") {
    const n = (noticesList() || [])[0];
    tk = n ? `<a class="chpin" href="#/notice/${encodeURIComponent(n.id)}"><i>최근 공지</i><span><b>${esc(n.title)}</b><span>${md(dayOf(n.at || new Date().toISOString()))}, 공지에서 봐요</span></span>${IC_CHEV}</a>` : "";
    people = `팀원 ${S.members.length}명, 용병과 대기자는 들어오지 않아요`;
  } else {
    const a = d.kind !== "merc" && !done ? att(e) : null;
    const line1 = `${esc(e.time || "")}${e.end ? " ~ " + esc(e.end) : ""}  ${esc(e.place || "장소 미정")}`;
    let line2, line3;
    if (cx) { line2 = "취소된 일정이에요"; line3 = ""; }
    else if (d.kind === "merc") { line2 = `${esc(d.m.pos || "")}로 참가`; line3 = "용병으로 간 경기"; }
    else if (d.kind === "match") { const a2 = att(e); line2 = `우리 팀원 ${a2.in - mercN(e)} + 용병 ${mercN(e)}`; line3 = "양 팀 운영진만"; }
    else if (done) { line2 = isPlay(e) ? `온 사람 ${cameN(e)}명` : "지난 일정이에요"; line3 = resultText(e); }
    else { line2 = `참석 ${a.in}${a.cap ? " / " + a.cap : "명"}${a.wait.length ? ", 대기 " + a.wait.length : ""}${mercN(e) ? ", 용병 " + mercN(e) : ""}`; line3 = locked ? `대화방은 ${hmT(openAt(e))}에 열려요` : `투표 마감 ${hmK(Number(closeAt(e)))}`; }
    const stub = done && !cx ? `<span class="chstamp" aria-hidden="true"><b>${md(e.date)}</b><b>사용함</b></span>` : `<span class="pf" aria-hidden="true"></span><span class="st"><b>${md(e.date)}</b><span>${cx ? "취소" : wd(e.date)}</span></span>`;
    tk = `<div class="chtk${writable ? "" : " off"}${done && !cx ? " used" : ""}"><span class="l"><b>${line1}</b><span>${line2}</span>${line3 ? `<span class="b3">${line3}</span>` : ""}</span>${stub}</div>`;
    if (d.kind === "ev") {
      const lk = isPlay(e) && done && !cx ? `#/game/${encodeURIComponent(e.id)}` : `#/event/${encodeURIComponent(e.id)}`;
      tk += `<div class="chlkw"><span>${writable || locked ? "참석 투표는 일정에서 바꿔요." : cx ? "취소된 일정이라 읽기만 할 수 있어요." : "결과와 MOM은 기록에서 봐요."}</span><a class="chlk" href="${lk}">${isPlay(e) && done && !cx ? "기록에서 보기" : "일정에서 보기"}</a></div>`;
    } else if (d.kind === "merc") tk += `<div class="chlkw"><span>용병은 그 팀의 이 경기 방만 볼 수 있어요. 경기가 끝나면 방에서 나가요.</span></div>`;
    const mN = mercN(e);
    people = d.kind === "match" ? `우리 운영진과 ${e.opponent || "상대 팀"} 운영진` : d.kind === "merc" ? `${d.m.tname} 팀원과 용병` : `팀원 ${S.members.length}명${mN ? ", 용병 " + mN + "명" : ""}`;
  }
  // 글과 알림 줄
  let prevDay = "", prev = null;
  const sysLine = (t, note) => `<span class="chsys">${t}${note ? `<i class="chnote">${note}</i>` : ""}</span>`;
  const items = [];
  if (d.kind === "ev" || d.kind === "merc") { const oa = openAt(e); if (!locked && !cx) items.push({ t: new Date(oa).toISOString(), sys: `${esc(titleOf(e))} 방이 열렸어요. ${evStart(e).getTime() - H24 <= Number(closeAt(e)) ? "경기 24시간 전이라" : "투표가 마감돼"} 참석한 사람이 들어왔어요.` }); }
  if (d.kind === "match") items.push({ t: (ms[0] && ms[0].created_at) || new Date().toISOString(), sys: `${esc(e.opponent || "상대 팀")}와 ${md(e.date)} ${wd(e.date)} 매칭이 잡혀 매칭 방이 열렸어요. 양 팀 운영진만 있어요.`, first: true });
  if (d.kind === "ev" && e.lineupAt && !locked) items.push({ t: e.lineupAt, sys: "라인업이 올라왔어요. 일정에서 볼 수 있어요." });
  if (d.kind === "ev" && adminView() && !locked) Object.keys(S.rsvp).forEach(u => { const v = (((S.rsvp[u] || {}).ev || {})[e.id]) || {}; if (v.ask && v.ask.at && !v.ask.race) { const m = S.members.find(x => x.user_id === u); items.push({ t: v.ask.at, sys: `대기 ${esc((m && m.display_name) || "팀원")}님에게 자리가 났다고 물어봤어요. ${hmT(Date.parse(v.ask.until))}까지 답을 기다려요.`, note: "운영진만 봐요" }); } });
  ms.forEach((r, i) => {
    if (r.kind === "left") {
      const nx = ms.slice(i + 1).find(x => x.user_id === r.user_id && (x.kind === "join" || x.kind === "left"));
      if (nx && nx.kind === "join" && Date.parse(nx.created_at) - Date.parse(r.created_at) <= 600e3) { r._merged = true; return; }
      const lc = (e.lateCancel || {})[r.user_id]; const why = adminView() && lc && lc.reason ? `운영진만 보는 이유: ${esc(lc.reason)}` : "";
      items.push({ t: r.created_at, sys: `${esc(r.name)}님이 불참으로 바꿔서 대화방에서 나갔어요.`, note: why }); return;
    }
    if (r.kind === "join") {
      const pv = ms.slice(0, i).filter(x => x.user_id === r.user_id && x.kind === "left").pop();
      items.push({ t: r.created_at, sys: pv && pv._merged ? `${esc(r.name)}님이 불참으로 바꿨다가 다시 참석해서 들어왔어요.` : pv ? `${esc(r.name)}님이 참석으로 바꾸고 다시 들어왔어요.` : `${esc(r.name)}님이 대기에서 참석으로 올라와 대화방에 들어왔어요.` }); return;
    }
    if (r.kind === "merc") { items.push({ t: r.created_at, sys: `${esc(r.name)}님이 용병으로 들어왔어요${r.body ? " (" + esc(r.body) + ")" : ""}. 들어온 뒤의 대화만 보여요.` }); return; }
    items.push({ t: r.created_at, r });
  });
  if (done && !cx && d.kind === "ev" && isPlay(e) && e.score) items.push({ t: evStart(e).toISOString(), sys: `경기가 끝났어요. 결과 ${resultText(e)}.${momDeadline(e) ? " MOM 투표는 " + hmK(momDeadline(e).getTime()) + "까지예요." : ""}`, end: true });
  items.sort((a, b) => a.first ? -1 : b.first ? 1 : a.end ? 1 : b.end ? -1 : Date.parse(a.t) - Date.parse(b.t));
  const log = items.map(it => {
    const dd = dayOf(it.t); let out = "";
    if (dd !== prevDay) { out += `<span class="chday">${dayLabel(dd)}</span>`; prevDay = dd; prev = null; }
    if (it.sys) { prev = null; return out + sysLine(it.sys, it.note); }
    const r = it.r;
    const mine = r.user_id === S.uid; const cont = prev && prev.user_id === r.user_id;
    const role = roleOf(r.user_id); const isOp = role === "owner" || role === "admin"; const merc = isMercRow(r);
    const other = d.kind === "match" && !S.members.some(m => m.user_id === r.user_id);
    const gone = !!r.hidden; const callsMe = !gone && me && r.body.indexOf("@" + me) >= 0 && !mine;
    const tag = other ? `<span class="tag">${esc(e.opponent || "상대 팀")}</span>` : isOp ? `<span class="tag ink">운영진</span>` : merc ? `<span class="tag mc">용병</span>` : "";
    const nameRow = !mine && !cont ? `<span class="cnm"><b>${esc(r.name)}</b>${tag}</span>` : "";
    const text = gone ? (r.hidden === "self" ? "보낸 사람이 가린 글이에요." : "운영진이 가린 글이에요.") : bodyHtml(r.body);
    const canHide = writable && !gone && (mine || (adm && d.kind !== "match"));
    out += `<div class="cm${mine ? " me" : ""}${cont ? " cont" : ""}">${!mine && !cont ? `<span class="cav" aria-hidden="true">${esc(initial(r.name))}</span>` : ""}<div class="ccol">${nameRow}${callsMe ? `<span class="tag ink">나를 불렀어요</span>` : ""}<div class="cbr"><span class="cb${gone ? " gone" : ""}${callsMe ? " callme" : ""}">${text}</span><span class="ctm">${hm(r.created_at)}</span></div>${adm && !gone && r.masked ? `<span class="cmk"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#121110" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 20h20z"></path><path d="M12 10v4M12 17v.5"></path></svg>욕설 ${r.masked}개를 가렸어요. 운영진에게 경고 알림이 갔어요</span>` : ""}${canHide ? `<button type="button" class="chide" data-act="chatHide" data-id="${r.id}" aria-label="${mine ? "내가 " + hm(r.created_at) + "에 보낸 글 가리기" : esc(r.name) + "님 " + hm(r.created_at) + " 글 가리기"}">가리기</button>` : ""}</div></div>`;
    prev = r; return out;
  }).join("");
  const outside = d.kind === "ev" && !locked && !cx && cutOf(d) < 0 && !inRoomNow(e);
  const outsideOpen = outside && writableTime(e);
  const intro = d.kind === "all" ? `<span class="chsys">전체 대화방은 팀원만 있어요. 일정 이야기는 일정 방에서 해요.</span>`
    : locked ? `<span class="chsys">아직 열리기 전이에요. ${hmT(openAt(e))}에 열려요. 그 전에는 전체 대화방에서 이야기해요.</span>`
    : outsideOpen ? `<span class="chsys">참석한 사람만 있는 방이에요. 참석으로 바꾸면 들어와요.</span>` : outside ? `<span class="chsys">이 경기에 참석한 사람만 볼 수 있는 방이에요.</span>` : "";
  const bodyEmpty = CH.missing ? `<span class="chsys">대화를 준비하고 있어요. 서버 준비가 끝나면 바로 쓸 수 있어요.</span>` : !CH.loaded ? `<div class="loading">불러오는 중이에요</div>` : "";
  const draft = S.form && typeof S.form.chat === "string" ? S.form.chat : "";
  const left = d.kind === "ev" && !writable && !locked && !done && cutOf(d) >= 0 && cutOf(d) !== Infinity;
  const closedText = left ? "불참으로 바꿔서 나간 방이에요. 나가기 전 대화까지만 보여요. 다시 참석하면 들어와요." : locked ? `${hmT(openAt(e))}에 열려요. 그 전에는 전체 대화방에서 이야기해요.` : outsideOpen ? "참석한 사람만 쓸 수 있어요." : cx ? "취소된 일정이라 읽기만 할 수 있어요." : "경기가 끝나 읽기만 할 수 있어요. 이 방은 기록과 함께 남아요.";
  const foot = writable
    ? `<div class="chc"><div class="row"><label for="chatIn" class="sr">메시지</label><textarea id="chatIn" data-bind="chat" rows="1" maxlength="1000" placeholder="메시지 보내기  @이름으로 부르기">${esc(draft)}</textarea><button type="button" class="chs" data-act="chatSend" data-room="${esc(d.key)}" aria-disabled="${!draft.trim()}">보내기</button></div><span class="hint">@이름으로 부르면 그 사람이 알아보기 쉬워요. 내가 보낸 글은 아래 '가리기'로 가릴 수 있어요.</span></div>`
    : `<div class="chclosed"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#121110" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg><span>${closedText}</span></div>`;
  if (CH.stick) { CH.stick = false; setTimeout(toBottom, 0); }
  const allBtn = d.kind === "all" ? `<button type="button" class="chal${allOn() ? " on" : ""}" data-act="chatAllAlarm" aria-pressed="${allOn()}">${allOn() ? "알림 켜짐" : "알림 꺼짐"}</button>` : "";
  const tagL = d.kind === "all" ? "전체" : d.kind === "match" ? "매칭 방" : d.kind === "merc" ? "용병" : "일정 방";
  const head = pc ? `<header class="pch"><span class="tag">${tagL}</span><b>${esc(d.title)}</b><span>${esc(people)}</span>${allBtn}</header>` : hd(d.title, "#/chat", { sub: people, right: allBtn });
  const rate = d.kind === "ev" && adm && done && !cx ? rateBox(e.id, e) : "";
  return `${head}${tk}<div class="chlog" aria-label="${esc(d.title)} 대화" aria-live="polite">${intro}${bodyEmpty}${log}</div>${rate}${foot}`;
}
const IC_CHEV = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#121110" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>`;
/* ===================== 용병 평가 (끝난 경기 방, 운영진, PC) =====================
   현장 출석으로 온 게 확인된 다른 팀 용병만 평가한다. 경기 날짜 다음 날부터 7일 안에 고칠 수 있다.
   평가는 서버 함수(x_rate)로만 쓰고, 목록은 x_rates_of로 받는다. 안 온 용병은 별점 대신 '안 옴'이 서버 계산으로 남는다. */
export const RV = { room: "", tid: "", list: null, busy: false, err: false, open: "", draft: {} };
const WHY = [["ontime", "시간 약속 지킴"], ["manner", "매너 좋음"], ["fit", "포지션 잘 맞음"], ["late", "늦게 옴"], ["rude", "매너 나쁨"], ["curse", "욕설"]];
const dayAdd = (d, n) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const hasExt = e => Object.values((e && e.guests) || {}).some(g => g && g.ext && g.ext.uid);
async function rateLoad(id) {
  if (RV.busy) return; RV.busy = true;
  const { data, error } = await sb.rpc("x_rates_of", { p_team: S.tid, p_event: id });
  RV.busy = false;
  if (RV.room !== id || RV.tid !== S.tid) { render(); return; }
  if (error) { RV.err = true; RV.list = []; } else { RV.list = Array.isArray(data) ? data : []; }
  render();
}
const STAR = (fill) => `<svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.3L12 17.1l-5.7 3.1 1.2-6.3-4.7-4.4 6.4-.8z" fill="${fill}" stroke="#121110" stroke-width="2" stroke-linejoin="round"></path></svg>`;
function rateBox(id, e) {
  if (!hasExt(e)) return "";
  const today = todayStr(); const last = dayAdd(e.date, 7);
  if (!(e.date < today) || today > last) return "";
  if (RV.room !== id || RV.tid !== S.tid) { RV.room = id; RV.tid = S.tid; RV.list = null; RV.err = false; RV.open = ""; RV.draft = {}; }
  if (RV.list === null) { if (!RV.busy) setTimeout(() => rateLoad(id), 0); return `<section class="xrv" aria-label="용병 평가"><b class="h">용병 평가</b><div class="loading">불러오는 중이에요</div></section>`; }
  if (RV.err) return `<section class="xrv" aria-label="용병 평가"><b class="h">용병 평가</b><span class="n">평가를 준비하고 있어요. 서버 준비가 끝나면 바로 쓸 수 있어요.</span></section>`;
  if (!RV.list.length) return "";
  const note = `현장 출석으로 온 게 확인된 용병만 평가해요. 팀을 대표해 운영진 한 명이 하고, ${md(last)}까지 고칠 수 있어요. 누가 평가했는지는 용병에게 안 보여요.`;
  const rows = RV.list.map(u => {
    const came = u.check === "in" || u.check === "late"; const done = u.rate;
    const isOpen = RV.open === u.key;
    const d = RV.draft[u.key] || { s: done ? done.stars : 0, why: done ? (done.why || []).slice() : [] };
    const chip = came ? (done ? `평가함  별 ${done.stars}개` : "평가 전") : u.checked ? "안 옴, 자동으로 남아요" : "출석 확인 전";
    const chipCls = came ? (done ? " on" : "") : " off";
    const sub = [u.sub || "", u.pos || "", came ? "현장 출석으로 온 게 확인됐어요" : u.checked ? "현장 출석에 없어요" : "현장 출석을 먼저 확인해 주세요"].filter(Boolean).join(", ");
    const form = isOpen ? `<div class="xrf"><span class="xst" role="group" aria-label="별점">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-act="rvStar" data-k="${esc(u.key)}" data-n="${n}" aria-label="별 ${n}개" aria-pressed="${d.s === n}">${STAR(n <= d.s ? "#FCD01A" : "#FFFFFF")}</button>`).join("")}<b>${d.s ? "별 " + d.s + "개" : "별을 골라 주세요"}</b></span>
      <span class="xwy"><span>이유 (여러 개 골라도 돼요)</span><span class="ws">${WHY.map(([k, l]) => `<button type="button" class="chip pill${d.why.includes(k) ? " on" : ""}" data-act="rvWhy" data-k="${esc(u.key)}" data-v="${k}" aria-pressed="${d.why.includes(k)}">${l}</button>`).join("")}</span></span>
      <span class="xra"><button type="button" class="btn sm" data-act="rvOpen" data-k="">닫기</button><button type="button" class="btn sm o" data-act="rvSend" data-k="${esc(u.key)}" aria-disabled="${!d.s}">평가 보내기</button></span></div>` : "";
    return `<div class="xrc${came ? (isOpen ? " open" : "") : " no"}"><span class="xrh"><span class="who"><span class="nm"><b>${esc(u.name || "용병")}</b><span class="xchip${chipCls}">${chip}</span></span><span class="sb">${esc(sub)}</span></span>${came && !isOpen ? `<button type="button" class="btn sm${done ? "" : " o"}" data-act="rvOpen" data-k="${esc(u.key)}" aria-expanded="false">${done ? "고치기" : "평가하기"}</button>` : ""}</span>${form}</div>`;
  }).join("");
  return `<section class="xrv" aria-label="용병 평가"><span class="hw"><b class="h">용병 평가</b><span class="n">${note}</span></span>${rows}</section>`;
}
function rvDraft(k) {
  const u = (RV.list || []).find(x => x.key === k); if (!u) return null;
  if (!RV.draft[k]) RV.draft[k] = { s: u.rate ? u.rate.stars : 0, why: u.rate ? (u.rate.why || []).slice() : [] };
  return RV.draft[k];
}
function toBottom() { const lg = document.querySelector(".pcr .chlog"); if (lg) lg.scrollTop = lg.scrollHeight; else window.scrollTo(0, document.documentElement.scrollHeight); }
// 방에 들어올 때: 쓰던 글은 비우고 맨 아래로
export function chatEnter() { S.form = { chat: "" }; CH.stick = true; }

function chatFail(err) {
  const m = String((err && (err.message || err.details)) || err || "");
  const M = { not_in_room: "참석한 사람만 이 방에 쓸 수 있어요", room_closed: "지금은 이 방에 쓸 수 없어요", too_fast: "너무 빨리 보내고 있어요. 5초 뒤에 보내 주세요", bad_body: "1000자까지 보낼 수 있어요", not_allowed: "남의 글은 운영진만 가릴 수 있어요", no_room: "없는 일정이에요", not_member: "이 팀 사람만 쓸 수 있어요", no_msg: "없는 글이에요" };
  const k = Object.keys(M).find(x => m.includes(x));
  if (k) { toast(M[k]); return; }
  if (/chat_send|chat_hide|function .* does not exist|schema cache/i.test(m)) { toast("대화를 준비하고 있어요. 잠시 뒤에 다시 해 주세요"); return; }
  fail(err);
}

export const CHACT = {
  rvOpen: t => { RV.open = t.dataset.k || ""; if (RV.open) rvDraft(RV.open); render(); },
  rvStar: t => { const d = rvDraft(t.dataset.k); if (!d) return; d.s = Number(t.dataset.n) || 0; render(); },
  rvWhy: t => { const d = rvDraft(t.dataset.k); if (!d) return; const v = t.dataset.v; d.why = d.why.includes(v) ? d.why.filter(z => z !== v) : d.why.concat([v]); render(); },
  rvSend: async t => {
    const k = t.dataset.k; const d = rvDraft(k); const u = (RV.list || []).find(x => x.key === k);
    if (!d || !u) return;
    if (!d.s) { toast("별을 골라 주세요"); return; }
    if (maintLocked()) { fail(new Error("maintenance")); return; }
    if (RV.busy) return; RV.busy = true;
    const { error } = await sb.rpc("x_rate", { p_team: S.tid, p_event: RV.room, p_key: k, p_stars: d.s, p_why: d.why });
    RV.busy = false;
    if (error) {
      const m = String(error.message || ""); const M = { not_came: "현장 출석으로 온 게 확인된 용병만 평가할 수 있어요", too_late: "평가할 수 있는 기간이 지났어요", not_yet: "경기 날짜가 지나야 평가할 수 있어요", not_admin: "운영진만 평가할 수 있어요", not_ext: "다른 팀 용병만 평가할 수 있어요" };
      const x = Object.keys(M).find(z => m.includes(z)); if (x) { toast(M[x]); return; } fail(error); return;
    }
    u.rate = { stars: d.s, why: d.why.slice() }; delete RV.draft[k]; RV.open = ""; render();
    toast(`${u.name || "용병"}님을 평가했어요. 별점은 평가가 3번 모이면 다른 팀에 보여요`);
  },
  chatTab: t => { CH.tab = ["past", "match", "merc"].includes(t.dataset.v) ? t.dataset.v : "up"; if (isPC()) { CH.last = ""; CH.stick = true; if (location.hash !== "#/chat") { location.hash = "#/chat"; return; } } render(); },
  chatSend: async t => {
    const d = rd(t.dataset.room || ""); if (!d) return;
    const body = String((S.form && S.form.chat) || "").trim();
    if (!body) { toast("보낼 말을 적어 주세요"); return; }
    if (!canWrite(d)) { toast("지금은 이 방에 보낼 수 없어요"); return; }
    if (maintLocked()) { fail(new Error("maintenance")); return; }
    if (CH.sending) return; CH.sending = true;
    const { data, error } = await sb.rpc("chat_send", { p_team: d.team, p_room: d.room, p_body: body });
    CH.sending = false;
    if (error || !data) { chatFail(error); return; }
    CH.rows[data.id] = { ...data, team_id: d.team };
    S.form.chat = ""; CH.stick = true; render();
    if (data.masked) toast("욕설은 가려서 보냈어요. 운영진에게 경고 알림이 가요");
  },
  chatAlarm: async () => {
    const i = ALARM.findIndex(a => a[0] === alarmMode()); const nx = ALARM[(i + 1) % ALARM.length];
    try { await patchDoc("uvote", S.uid, { chat: nx[0] }); toast(nx[2]); } catch (e) { fail(e); }
  },
  chatAllAlarm: async () => {
    const on = !allOn();
    try { await patchDoc("uvote", S.uid, { chatAll: on ? "on" : "off" }); toast(on ? "전체 대화방 알림을 켰어요" : "전체 대화방 알림을 껐어요"); } catch (e) { fail(e); }
  },
  chatHide: t => {
    const r = CH.rows[t.dataset.id]; if (!r || r.hidden) return;
    const mine = r.user_id === S.uid;
    confirmBox(mine ? "내 글을 가릴까요?" : "이 글을 가릴까요?", mine ? "가리면 글 내용이 지워지고, 다른 사람에게는 '보낸 사람이 가린 글이에요'로 보여요. 되돌릴 수 없어요." : `${r.name}님 글이 지워지고 '운영진이 가린 글이에요'로 보여요. 되돌릴 수 없어요.`, "가리기", async () => {
      if (maintLocked()) { fail(new Error("maintenance")); return; }
      const { data, error } = await sb.rpc("chat_hide", { p_id: Number(r.id) });
      if (error) { chatFail(error); return; }
      CH.rows[r.id] = { ...r, hidden: data || (mine ? "self" : "admin"), body: "", masked: 0 }; render();
      toast(mine ? "내 글을 가렸어요" : "글을 가렸어요");
    }, true);
  },
};
// 보내기 버튼: 글을 쓰는 동안 바로 켜고 끈다 (화면 전체를 다시 그리지 않고)
document.addEventListener("input", ev => {
  const t = ev.target; if (!t || t.id !== "chatIn") return;
  const b = document.querySelector(".chs"); if (b) b.setAttribute("aria-disabled", String(!t.value.trim()));
  t.style.height = "auto"; t.style.height = Math.min(140, t.scrollHeight + 4) + "px";
});
