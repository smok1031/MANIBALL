// 대화: 일정마다 방 하나 (방 이름 = 일정 id). 매니볼 모바일 시안 4-6 대화와 같은 모양.
// 글 쓰기와 가리기는 서버 함수(chat_send, chat_hide)로만 한다. 욕설은 서버가 그 단어만 *** 로 가려 저장하고,
// 가린 글이 있으면 운영진에게 휴대폰 알림이 간다. 취소된 방은 읽기만 하고, 경기 방은 경기 끝나고 2시간 뒤 사라진다(서버도 그때 닫는다).
// 사진은 비공개 저장소(mb-chat)에 올리고 글에 붙인다. 알림은 방마다 켜고 끈다(켜면 나를 부른 글만).
import { S, sb, esc, render, toast, fail, ls, isAdmin, viewMode, isCanceled, md, wd, evName, evStart, isPlay, maintLocked, todayStr, att, confirmBox, closeAt, hmK, myUv, patchDoc, noticesList, momDeadline, cameTo } from "./main.js";
import { hd, hdTab, empty, initial, navBar } from "./ui.js";
import { isPC } from "./pc.js";

export const CH = { rows: {}, tid: "", loading: false, loaded: false, missing: false, tab: "up", sending: false, stick: false, last: "", merc: null, xload: "", xbusy: false,
  room: "", pick: [], more: false, inv: null, pv: null, urls: {}, signing: false };
const LIMIT = 2000;
const VS = { yes: "참석", late: "늦참", no: "불참" };
const H24 = 864e5;
const H2 = 72e5;
const BUCKET = "mb-chat";
const MAXPH = 4;

// 불러오기: 팀을 열 때 한 번, 그 뒤는 실시간으로 받는다
export async function chatLoad(force) {
  if (!S.tid) return;
  if (CH.tid !== S.tid) { CH.rows = {}; CH.loaded = false; CH.missing = false; CH.tid = S.tid; CH.merc = null; CH.xload = ""; }
  if (CH.loading || (CH.loaded && !force)) return;
  CH.loading = true;
  const { data, error } = await sb.from("chat").select("id,team_id,room,user_id,name,body,masked,hidden,kind,photos,created_at").eq("team_id", S.tid).order("id", { ascending: false }).limit(LIMIT);
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
      const { data: rows } = await sb.from("chat").select("id,team_id,room,user_id,name,body,masked,hidden,kind,photos,created_at").eq("team_id", h.team).eq("room", h.room).order("id", { ascending: false }).limit(500);
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

// 방 규칙 (서버의 chat_room_open, chat_open_at, chat_gone_at과 같다)
// 경기 방은 투표 마감 때 열린다. 마감이 경기 24시간 전보다 늦으면 24시간 전에 열린다
export const openAt = e => Math.min(Number(closeAt(e)), evStart(e).getTime() - H24);
// 끝나는 시각: 끝 시각이 없으면 시작 2시간 뒤. 끝이 시작보다 이르면 다음 날로 본다. 방은 그 2시간 뒤 사라진다
export function evEnd(e) {
  if (/^\d{2}:\d{2}$/.test(e.end || "")) { const t = new Date(`${e.date}T${e.end}:00+09:00`).getTime(); return new Date(/^\d{2}:\d{2}$/.test(e.time || "") && e.end <= e.time ? t + H24 : t); }
  return new Date(evStart(e).getTime() + H2);
}
export const goneAt = e => evEnd(e).getTime() + H2;
const validDate = e => /^\d{4}-\d{2}-\d{2}$/.test((e && e.date) || "");
const datedUp = e => validDate(e) && Date.now() < goneAt(e);
const ended = e => Date.now() >= evEnd(e).getTime();
const isOpen = e => !!e && !isCanceled(e) && datedUp(e) && Date.now() >= openAt(e);
const isLocked = e => !!e && !isCanceled(e) && datedUp(e) && Date.now() < openAt(e);
const roomsUp = () => Object.values(S.events).filter(e => datedUp(e)).sort((a, b) => evStart(a) - evStart(b));
const roomsMatch = () => Object.values(S.events).filter(e => e.xmatch && e.xmatch.team && datedUp(e)).sort((a, b) => evStart(a) - evStart(b));
const mercUp = () => (CH.merc || []).filter(m => m.ev && datedUp(m.ev));
const titleOf = e => `${md(e.date)} ${wd(e.date)} ${evName(e)}`;
const adminView = () => isAdmin() && viewMode() === "admin";
const myName = () => { const m = S.members.find(x => x.user_id === S.uid); return (m && m.display_name) || ""; };
const teamName = () => (S.team && S.team.name) || "우리 팀";
// 매칭 방은 두 팀 중 팀 번호가 앞선 팀에 둔다 (양쪽이 같은 방을 찾게)
function matchHost(e) { const o = e.xmatch.team; return S.tid < o ? { team: S.tid, room: "m-" + e.id } : { team: o, room: "m-" + (e.xmatch.event || "") }; }
// 방 설명: key = all | 일정 id | m-일정 id | x~팀~일정
function rd(key) {
  if (key === "all") return { key, kind: "all", team: S.tid, room: "all", title: `${teamName()} 전체 대화방` };
  if (key === "ops") return isAdmin() ? { key, kind: "ops", team: S.tid, room: "ops", title: `${teamName()} 운영진 대화방` } : null;
  if (key.startsWith("m-")) { const e = S.events[key.slice(2)]; if (!e || !e.xmatch || !e.xmatch.team || !datedUp(e)) return null; const h = matchHost(e); return { key, kind: "match", team: h.team, room: h.room, e, title: `${e.opponent || "상대 팀"} 매칭 방` }; }
  if (key.startsWith("x~")) { const [, t, r] = key.split("~"); const m = mercUp().find(x => x.team === t && x.room === r); if (!m) return null; return { key, kind: "merc", team: t, room: r, e: m.ev, m, title: `${m.tname} ${titleOf(m.ev)}` }; }
  const e = S.events[key]; if (!e || !datedUp(e)) return null; return { key, kind: "ev", team: S.tid, room: key, e, title: titleOf(e) };
}
const msgsAll = d => Object.values(CH.rows).filter(r => r.team_id === d.team && r.room === d.room).sort((a, b) => a.id - b.id);
// 일정 방에 내가 있는지: 운영진, 정원 안 참석과 늦참, 운영진이 초대한 사람. 나간 사람은 나가기 전 글까지만 본다
const invRow = d => { const r = msgsAll(d).filter(x => x.user_id === S.uid && (x.kind === "inv" || x.kind === "left")).pop(); return r && r.kind === "inv" ? r : null; };
const inRoomNow = d => isAdmin() || [...att(d.e).yes, ...att(d.e).late].some(x => x.uid === S.uid) || !!invRow(d);
function cutOf(d) {
  if (d.kind !== "ev") return Infinity;
  if (inRoomNow(d)) return Infinity;
  const lf = msgsAll(d).filter(r => r.kind === "left" && r.user_id === S.uid).pop();
  return lf ? lf.id : -1;
}
const msgsOf = d => { const c = cutOf(d); return c < 0 ? [] : msgsAll(d).filter(r => r.id <= c); };
const writableTime = e => isOpen(e);
// 팀 방: 전체 대화방과 운영진 대화방 (일정과 상관없이 늘 열려 있음)
const teamRoom = d => d.kind === "all" || d.kind === "ops";
const canWrite = d => d.kind === "all" ? true : d.kind === "ops" ? isAdmin() : d.kind === "match" ? !isCanceled(d.e) && datedUp(d.e) : isOpen(d.e) && (d.kind === "merc" || inRoomNow(d));

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
const allKeys = () => (isAdmin() ? ["ops", "all"] : ["all"]).concat(roomsUp().map(e => e.id), isAdmin() ? roomsMatch().map(e => "m-" + e.id) : [], mercUp().map(m => `x~${m.team}~${m.room}`));
// 하단 메뉴 '대화' 칸의 숫자 (알림을 켠 방만 센다)
export function chatUnread() {
  if (!CH.loaded || CH.tid !== S.tid) return 0;
  return allKeys().reduce((t, k) => { if (!roomOn(k)) return t; const d = rd(k); return d ? t + unreadOf(d).n : t; }, 0);
}

const hm = iso => { const d = new Date(Date.parse(iso) + 9 * 3600e3); return d.toISOString().slice(11, 16); };
const dayOf = iso => new Date(Date.parse(iso) + 9 * 3600e3).toISOString().slice(0, 10);
const dayLabel = ds => `${md(ds)} ${wd(ds)}`;
const hmT = t => hmK(t);
// 오늘이면 시각만, 아니면 날짜와 시각 (사라지는 시각)
const hmS = t => { const iso = new Date(t).toISOString(); return dayOf(iso) === todayStr() ? hm(iso) : hmK(t); };
// 글 모양: @이름은 굵게 밑줄, *** 는 가린 말
function bodyHtml(t) {
  return String(t).split(/(@[^\s@]+|\*\*\*)/).filter(Boolean).map(s => s === "***" ? `<span class="mk" aria-label="가린 말">***</span>` : s[0] === "@" ? `<span class="at">${esc(s)}</span>` : esc(s)).join("");
}

// 알림: 방마다 켜고 끈다(uvote.ra). 켜면 나를 부른 글(@내 이름)만 온다. 전체 대화방만 기본이 끔
// 전에 고른 값도 이어 받는다: 전체 대화방은 chatAll이 'on'이면 켜짐, 다른 방은 chat이 'off'이면 꺼짐 (서버 chat_notify와 같다)
function roomOn(key) {
  const u = myUv() || {}; const v = ((u.ra && typeof u.ra === "object") ? u.ra : {})[key];
  if (v === "on" || v === "off") return v === "on";
  return key === "all" ? u.chatAll === "on" : u.chat !== "off";
}
const BELL_P = "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0";
const MUTE_P = "M8.7 3.7A6 6 0 0 1 18 8c0 3 .6 5 1.3 6.4M17 17H3s3-2 3-9c0-.6.1-1.2.3-1.8M10 21a2 2 0 0 0 4 0M3 3l18 18";
const MUTE = `<svg class="chmu" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B5650" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="알림 꺼짐"><path d="${MUTE_P}"></path></svg>`;
const bellBtn = key => { const on = roomOn(key);
  return `<button type="button" class="chbell${on ? " on" : ""}" data-act="chatBell" data-k="${esc(key)}" aria-pressed="${on}" aria-label="${on ? "이 방 알림 켜짐, 나를 부른 글만 와요. 누르면 꺼요" : "이 방 알림 꺼짐. 누르면 켜요"}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#121110" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${on ? BELL_P : MUTE_P}"></path></svg></button>`; };
const CLOCK = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#121110" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>`;
const SHIELD_I = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#121110" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6z"></path><path d="M9 12l2 2 4-4"></path></svg>`;
const PEOPLE_I = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#121110" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.6a3 3 0 0 1 0 5.8"></path></svg>`;
const phN = r => (Array.isArray(r.photos) ? r.photos.length : 0);
const lastLine = (d, ms) => { const last = ms.filter(r => !r.kind).pop(); return last ? `${esc(last.name)}: ${last.hidden ? "가린 글이에요" : last.body ? esc(last.body) : phN(last) ? "사진 " + phN(last) + "장" : ""}` : ""; };
const whenOf = ms => { const last = ms[ms.length - 1]; return last ? (dayOf(last.created_at) === todayStr() ? hm(last.created_at) : md(dayOf(last.created_at))) : ""; };

/* ===================== 대화 목록 ===================== */
export function vChat() {
  if (isPC()) return pcChat("");
  return `${hdTab("대화")}<div class="body" style="gap:12px">${listInner("")}</div>${navBarChat()}`;
}
// 방 목록 (휴대폰 목록 화면과 PC 왼쪽 칸이 같이 쓴다). cur: PC에서 지금 연 방
function listInner(cur) {
  if (!CH.loaded && !CH.loading && !CH.missing) chatLoad().then(render).catch(() => {});
  const hasMatch = isAdmin() && roomsMatch().length; const hasMerc = mercUp().length;
  const TBS = [["up", "다가오는 일정"]].concat(hasMatch ? [["match", "매칭 방"]] : [], hasMerc ? [["merc", "용병으로 간 방"]] : []);
  const tab = TBS.some(x => x[0] === CH.tab) ? CH.tab : "up";
  const keys = tab === "match" ? roomsMatch().map(e => "m-" + e.id) : tab === "merc" ? mercUp().map(m => `x~${m.team}~${m.room}`) : roomsUp().map(e => e.id);
  const tabs = TBS.length > 1 ? `<div class="chtabs" role="group" aria-label="방 고르기">${TBS.map(([k, l]) => `<button type="button" class="chtab" data-act="chatTab" data-v="${k}" aria-pressed="${tab === k}">${l}</button>`).join("")}</div>` : "";
  const pc = isPC();
  const muteOf = k => roomOn(k) ? "" : MUTE;
  // 운영진 대화방과 전체 대화방 (맨 위)
  const A = rd("all"); const ams = msgsOf(A); const au = unreadOf(A);
  const O = rd("ops"); let opsCard = "";
  if (O) { const oms = msgsOf(O); const ou = unreadOf(O);
    opsCard = `<a class="chr chops${cur === "ops" ? " on" : ""}" href="#/chat/ops" aria-label="${esc(O.title)}, 운영진만${ou.n ? ", 안 읽은 글 " + ou.n + "개" : ""}${roomOn("ops") ? "" : ", 알림 꺼짐"}"${cur === "ops" ? ' aria-current="true"' : ""}><span class="chd ic" aria-hidden="true">${SHIELD_I}</span><span class="cht"><b>${esc(O.title)} <i class="chtag ink">운영진만</i></b><span>${lastLine(O, oms) || "운영진끼리 이야기하는 방이에요"}</span></span><span class="chm"><span>${whenOf(oms)}</span><span class="row">${muteOf("ops")}${ou.n ? `<span class="chn" aria-hidden="true">${ou.n > 99 ? "99+" : ou.n}</span>` : ""}</span></span></a>`; }
  const allCard = `<a class="chr chall${cur === "all" ? " on" : ""}" href="#/chat/all" aria-label="${esc(A.title)}, 팀원만${au.n ? ", 안 읽은 글 " + au.n + "개" : ""}${roomOn("all") ? "" : ", 알림 꺼짐"}"${cur === "all" ? ' aria-current="true"' : ""}><span class="chd ic" aria-hidden="true">${PEOPLE_I}</span><span class="cht"><b>${esc(A.title)} <i class="chtag">팀원만</i></b><span>${lastLine(A, ams) || "팀원끼리 이야기하는 방이에요"}</span></span><span class="chm"><span>${whenOf(ams)}</span><span class="row">${muteOf("all")}${au.n ? `<span class="chn" aria-hidden="true">${au.n > 99 ? "99+" : au.n}</span>` : ""}</span></span></a>`;
  const rows = keys.map(k => {
    const d = rd(k); if (!d) return "";
    const e = d.e; const ms = msgsOf(d); const u = unreadOf(d);
    const locked = d.kind !== "match" && isLocked(e); const cx = isCanceled(e);
    const outside = d.kind === "ev" && !locked && !cx && !inRoomNow(d);
    const left = outside && cutOf(d) >= 0;
    const goes = !locked && !cx && !outside && ended(e);
    const sub = locked ? `대화방은 ${hmT(openAt(e))}에 열려요` : outside && !left ? "참석한 사람만 있는 방이에요" : lastLine(d, ms) || (cx ? "글이 없어요" : "아직 글이 없어요. 먼저 말을 걸어 보세요.");
    const chip = locked ? "열리기 전" : left ? "나감" : outside ? "참석 전" : cx ? "취소" : "";
    const right = `<span>${locked ? md(e.date) : whenOf(ms)}</span><span class="row">${muteOf(k)}${u.at ? `<span class="cha" aria-hidden="true">@</span>` : ""}${u.n ? `<span class="chn" aria-hidden="true">${u.n > 99 ? "99+" : u.n}</span>` : ""}${chip ? `<span class="chx">${chip}</span>` : ""}</span>`;
    const kindTag = pc ? `<i class="chtag">${d.kind === "match" ? "매칭" : d.kind === "merc" ? "용병" : e.type === "scrim" ? "내전" : e.type === "training" ? "훈련" : "경기"}</i>` : "";
    const pcSub = pc ? `<span class="chps">${esc(e.place || "장소 미정")}, ${esc(e.time || "")}</span>` : "";
    const gone = goes ? `<span class="chgo">${CLOCK}${hmS(goneAt(e))}에 사라져요</span>` : "";
    const aria = `${d.title}${u.n ? ", 안 읽은 글 " + u.n + "개" : ""}${locked ? ", 열리기 전" : cx || left ? ", 읽기만 가능" : ""}${roomOn(k) ? "" : ", 알림 꺼짐"}${goes ? ", " + hmS(goneAt(e)) + "에 사라져요" : ""}`;
    return `<a class="chr${k === cur ? " on" : ""}" href="#/chat/${encodeURIComponent(k)}" aria-label="${esc(aria)}"${k === cur ? ' aria-current="true"' : ""}><span class="chd${!cx && !locked && !left ? "" : " off"}" aria-hidden="true"><b>${md(e.date)}</b><span>${wd(e.date)}</span></span><span class="cht"><b>${esc(d.title)}${kindTag}</b><span class="chl">${gone}<span>${sub}</span></span>${pcSub}</span><span class="chm">${right}</span></a>`;
  }).join("");
  const body = CH.missing ? empty("대화를 준비하고 있어요", "서버 준비가 끝나면 바로 쓸 수 있어요.")
    : !CH.loaded ? `<div class="loading">불러오는 중이에요</div>`
    : keys.length ? rows : empty(tab === "match" ? "매칭 방이 없어요" : tab === "merc" ? "용병으로 간 방이 없어요" : "다가오는 일정이 없어요", tab === "up" ? "일정이 올라오면 방이 함께 생겨요." : "");
  return `${CH.missing ? "" : opsCard + allCard}${tabs}${body}`;
}
// PC: 왼쪽 방 목록, 오른쪽 방. 방을 안 골랐으면 마지막에 본 방이나 목록의 첫 방을 연다
function pcChat(id) {
  let key = id;
  if (id && S.events[id]) CH.tab = "up";
  if (id && id.startsWith("m-")) CH.tab = "match"; if (id && id.startsWith("x~")) CH.tab = "merc";
  if (!key) { const list = roomsUp().map(e => e.id); key = (CH.last && (list.includes(CH.last) || CH.last === "all" || (CH.last === "ops" && isAdmin()))) ? CH.last : list[0] || "all"; }
  const d = key ? rd(key) : null;
  const right = d ? roomInner(d, true) : id ? `<div class="pce">${goneEmpty(id)}</div>` : `<div class="pce">${empty("방을 골라 주세요", "왼쪽에서 방을 누르면 여기에 대화가 보여요.")}</div>`;
  return `${hdTab("대화")}<div class="pcsplit"><div class="pcl">${listInner(key)}</div><section class="pcr" aria-label="대화방">${right}</section>${sheets(d)}</div>`;
}
// 하단 메뉴 (ui.js가 대화 칸에 안 읽은 글 수를 함께 그린다)
const navBarChat = () => navBar("대화");
// 없어진 방: 경기 끝나고 2시간이 지난 방은 목록과 화면에서 사라진다 (글은 서버에 남는다)
function goneEmpty(id) {
  const e = S.events[id] || (id.startsWith("m-") ? S.events[id.slice(2)] : null);
  if (id.startsWith("x~") && CH.merc === null) return `<div class="loading">불러오는 중이에요</div>`;
  if (e && validDate(e) && !datedUp(e)) return empty("사라진 방이에요", `경기 끝나고 2시간이 지나 방이 사라졌어요.${isPlay(e) ? " 결과와 MOM은 기록에서 봐요." : ""}`);
  return empty("없는 방이에요", "지워진 일정이거나 사라진 방일 수 있어요.");
}

/* ===================== 대화방 ===================== */
export function vChatRoom(id) {
  if (!CH.loaded && !CH.loading && !CH.missing) chatLoad().then(render).catch(() => {});
  const d = rd(id);
  if (isPC()) return pcChat(id);
  if (!d) return `${hd("대화", "#/chat")}<div class="body">${goneEmpty(id)}</div>`;
  return roomInner(d, false) + sheets(d);
}
const resultText = e => { const sc = e.score || {}; if (sc.us == null || sc.them == null || e.type === "training") return ""; const a = Number(sc.us), b = Number(sc.them); return e.type === "scrim" ? `A팀 ${a} : ${b} B팀` : `${a} : ${b} ${a > b ? "승" : a < b ? "패" : "무"}`; };
const cameN = e => { const c = Object.values(e.check || {}).filter(v => v === "in" || v === "late").length; return c || S.members.filter(m => cameTo(e, m.user_id)).length; };
const mercN = e => Object.values(e.guests || {}).filter(g => g && g.inCap).length;
// 방 내용 (휴대폰은 화면 전체, PC는 오른쪽 칸)
function roomInner(d, pc) {
  const e = d.e; CH.last = d.key;
  if (CH.room !== d.key) { CH.room = d.key; dropPick(); CH.more = false; CH.inv = null; CH.pv = null; }
  const adm = adminView() && d.team === S.tid && d.kind !== "match";
  const ms = msgsOf(d);
  if (ms.length) markRead(d.key, ms[ms.length - 1].id);
  const roleOf = u => { const m = S.members.find(x => x.user_id === u); return m ? m.role : ""; };
  const isMercRow = r => d.kind !== "match" && !S.members.some(m => m.user_id === r.user_id);
  const me = myName();
  const locked = d.kind === "ev" || d.kind === "merc" ? isLocked(e) : false;
  const writable = canWrite(d) && !CH.missing;
  const cx = e && isCanceled(e);
  const outside = d.kind === "ev" && !locked && !cx && !inRoomNow(d);
  const left = outside && cutOf(d) >= 0;
  const goes = !!e && !teamRoom(d) && !locked && !cx && !outside && ended(e);
  // 방 위 티켓
  let tk = "", people = "";
  if (d.kind === "ops") {
    tk = `<div class="chopsbar"><span class="ic" aria-hidden="true">${SHIELD_I}</span><span><b>운영진만 있는 방이에요.</b> 팀원에게는 이 방이 보이지 않아요. 운영진이 되면 들어오고, 팀원으로 바뀌면 나가요.</span></div>`;
    people = `운영진 ${S.members.filter(m => m.role === "owner" || m.role === "admin").length}명, 팀원에게는 보이지 않아요`;
  } else if (d.kind === "all") {
    const n = (noticesList() || [])[0];
    tk = n ? `<a class="chpin" href="#/notice/${encodeURIComponent(n.id)}"><i>최근 공지</i><span><b>${esc(n.title)}</b><span>${md(dayOf(n.at || new Date().toISOString()))}, 공지에서 봐요</span></span>${IC_CHEV}</a>` : "";
    people = `팀원 ${S.members.length}명, 용병과 대기자는 들어오지 않아요`;
  } else {
    const line1 = `${esc(e.time || "")}${e.end ? " ~ " + esc(e.end) : ""}  ${esc(e.place || "장소 미정")}`;
    let line2, line3;
    const mN = mercN(e); const res = resultText(e);
    if (cx) { line2 = "취소된 일정이에요"; line3 = ""; }
    else if (d.kind === "merc") { line2 = `${esc(d.m.pos || "")}로 참가`; line3 = ended(e) ? "경기 끝" : "용병으로 간 경기"; }
    else if (d.kind === "match") { const a2 = att(e); line2 = `우리 팀원 ${a2.in - mN} + 용병 ${mN}`; line3 = ended(e) ? "경기 끝, 양 팀 운영진만" : "양 팀 운영진만"; }
    else if (ended(e)) { line2 = isPlay(e) ? `온 사람 ${cameN(e)}명${mN ? ", 용병 " + mN : ""}` : "끝난 일정이에요"; line3 = "경기 끝" + (res ? ", " + res : ""); }
    else { const a = att(e); line2 = `참석 ${a.in}${a.cap ? " / " + a.cap : "명"}${a.wait.length ? ", 대기 " + a.wait.length : ""}${mN ? ", 용병 " + mN : ""}`; line3 = locked ? `대화방은 ${hmT(openAt(e))}에 열려요` : `투표 마감 ${hmK(Number(closeAt(e)))}`; }
    tk = `<div class="chtkw"><div class="chtk${writable ? "" : " off"}"><span class="l"><b>${line1}</b><span>${line2}</span>${line3 ? `<span class="b3">${line3}</span>` : ""}</span><span class="pf" aria-hidden="true"></span><span class="st"><b>${md(e.date)}</b><span>${cx ? "취소" : wd(e.date)}</span></span></div></div>`;
    if (goes && !left) tk += `<div class="chgone" role="status"><span class="ic" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#121110" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg></span><span><b>이 방은 ${hmS(goneAt(e))}에 사라져요.</b> 경기 끝나고 2시간 뒤예요.${d.kind === "merc" ? "" : adm ? " 결과와 MOM은 기록에 남고, 용병 평가는 기록의 이 경기에서 해요." : " 결과와 MOM은 기록에 남아요."}</span></div>`;
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
    if (r.kind === "inv") {
      // 한 번에 여러 명을 초대하면 한 줄로 (같은 운영진이 1분 안에)
      const pv = ms[i - 1];
      if (pv && pv.kind === "inv" && pv.body === r.body && Date.parse(r.created_at) - Date.parse(pv.created_at) <= 60e3 && pv._inv) { pv._inv.names.push(esc(r.name)); r._inv = pv._inv; return; }
      const it = { t: r.created_at, names: [esc(r.name)], by: esc(r.body || "운영진"), sys: "-" }; r._inv = it;
      items.push(it); return;
    }
    if (r.kind === "merc") { items.push({ t: r.created_at, sys: `${esc(r.name)}님이 용병으로 들어왔어요${r.body ? " (" + esc(r.body) + ")" : ""}. 들어온 뒤의 대화만 보여요.` }); return; }
    items.push({ t: r.created_at, r });
  });
  items.forEach(it => { if (it.names) it.sys = `${it.by}님이 ${it.names.join(", ")}님을 대화방에 초대했어요.`; });
  if (goes) items.push({ t: evEnd(e).toISOString(), sys: `경기가 끝났어요. 이 방은 ${hmS(goneAt(e))}에 사라져요.`, end: true });
  items.sort((a, b) => a.first ? -1 : b.first ? 1 : Date.parse(a.t) - Date.parse(b.t));
  const need = [];
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
    const phs = gone ? [] : (Array.isArray(r.photos) ? r.photos : []);
    const text = gone ? (r.hidden === "self" ? "보낸 사람이 가린 글이에요." : "운영진이 가린 글이에요.") : bodyHtml(r.body);
    const canHide = writable && !gone && (mine || (adm && d.kind !== "match"));
    phs.forEach(p => need.push(p));
    const pics = phs.length ? `<div class="cbr"><span class="cph${phs.length > 1 ? " n2" : ""}">${phs.map((p, j) => { const u = signed(p);
      return `<button type="button" class="cphb" data-act="chatPv" data-id="${r.id}" data-i="${j}" aria-label="${esc(r.name)}님이 보낸 사진${phs.length > 1 ? ", " + (j + 1) + "번째" : ""}, 눌러서 크게 보기">${u ? `<img src="${esc(u)}" alt="" loading="lazy" decoding="async">` : `<span class="cphl" aria-hidden="true"></span>`}</button>`; }).join("")}</span>${r.body || gone ? "" : `<span class="ctm">${hm(r.created_at)}</span>`}</div>` : "";
    const bubble = r.body || gone ? `<div class="cbr"><span class="cb${gone ? " gone" : ""}${callsMe ? " callme" : ""}">${text}</span><span class="ctm">${hm(r.created_at)}</span></div>` : "";
    out += `<div class="cm${mine ? " me" : ""}${cont ? " cont" : ""}">${!mine && !cont ? `<span class="cav" aria-hidden="true">${esc(initial(r.name))}</span>` : ""}<div class="ccol">${nameRow}${callsMe ? `<span class="tag ink">나를 불렀어요</span>` : ""}${pics}${bubble}${adm && !gone && r.masked ? `<span class="cmk"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#121110" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 20h20z"></path><path d="M12 10v4M12 17v.5"></path></svg>욕설 ${r.masked}개를 가렸어요. 운영진에게 경고 알림이 갔어요</span>` : ""}${canHide ? `<button type="button" class="chide" data-act="chatHide" data-id="${r.id}" aria-label="${mine ? "내가 " + hm(r.created_at) + "에 보낸 글 가리기" : esc(r.name) + "님 " + hm(r.created_at) + " 글 가리기"}">가리기</button>` : ""}</div></div>`;
    prev = r; return out;
  }).join("");
  signLater(need);
  const outsideOpen = outside && !left && writableTime(e);
  const intro = d.kind === "ops" ? `<span class="chsys">운영진 대화방이에요. 운영 이야기는 여기서 해요.</span>` : d.kind === "all" ? `<span class="chsys">전체 대화방은 팀원만 있어요. 일정 이야기는 일정 방에서 해요.</span>`
    : locked ? `<span class="chsys">아직 열리기 전이에요. ${hmT(openAt(e))}에 열려요. 그 전에는 전체 대화방에서 이야기해요.</span>`
    : outsideOpen ? `<span class="chsys">참석한 사람만 있는 방이에요. 참석으로 바꾸면 들어와요.</span>` : outside && !left ? `<span class="chsys">이 경기에 참석한 사람만 볼 수 있는 방이에요.</span>` : "";
  const bodyEmpty = CH.missing ? `<span class="chsys">대화를 준비하고 있어요. 서버 준비가 끝나면 바로 쓸 수 있어요.</span>` : !CH.loaded ? `<div class="loading">불러오는 중이에요</div>` : "";
  const draft = S.form && typeof S.form.chat === "string" ? S.form.chat : "";
  const pick = CH.pick || [];
  const closedText = left ? "<b>불참으로 바꿔서 이 방에서 나갔어요.</b> 나가기 전 대화까지만 보이고, 새 글은 안 와요. 다시 들어와야 하면 운영진이 초대해 줄 수 있어요." : locked ? `${hmT(openAt(e))}에 열려요. 그 전에는 전체 대화방에서 이야기해요.` : outsideOpen ? "참석한 사람만 쓸 수 있어요." : cx ? "취소된 일정이라 읽기만 할 수 있어요." : "경기가 끝나 읽기만 할 수 있어요.";
  const picks = pick.length ? `<div class="chpk"><div class="chpkl" role="list" aria-label="보낼 사진">${pick.map((p, j) => `<span role="listitem" class="chpki"><img src="${esc(p.url)}" alt="보낼 사진 ${j + 1}"><button type="button" data-act="chatPhDel" data-i="${j}" aria-label="${j + 1}번째 사진 빼기"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FBF7EF" stroke-width="3.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg></button></span>`).join("")}</div><span class="hint">사진 ${pick.length}장, 한 번에 ${MAXPH}장까지 보내요. 큰 사진은 줄여서 올려요</span></div>` : "";
  const foot = writable
    ? `<div class="chc">${picks}<div class="row"><label class="chphb"><input type="file" id="chatPh" accept="image/*" multiple class="sr" aria-label="사진 올리기, 한 번에 ${MAXPH}장까지"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#121110" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4.5h16a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1zM3 16l5-5 4 4 3-3 6 6"></path><circle cx="15.5" cy="9" r="1.6"></circle></svg></label><label for="chatIn" class="sr">메시지</label><textarea id="chatIn" data-bind="chat" rows="1" maxlength="1000" placeholder="${pick.length ? "사진에 붙일 말 (없어도 돼요)" : "메시지  @이름으로 부르기"}">${esc(draft)}</textarea><button type="button" class="chs" data-act="chatSend" data-room="${esc(d.key)}" aria-disabled="${!draft.trim() && !pick.length || !!CH.sending}">${CH.sending ? "보내는 중" : "보내기"}</button></div></div>`
    : `<div class="chclosed"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#121110" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg><span>${closedText}</span></div>`;
  if (CH.stick) { CH.stick = false; setTimeout(toBottom, 0); }
  const tagL = d.kind === "ops" ? "운영진 대화방" : d.kind === "all" ? "전체 대화방" : d.kind === "match" ? "매칭 방" : d.kind === "merc" ? "용병으로 간 방" : "일정 방";
  const bell = left || outside ? "" : bellBtn(d.key);
  const canInv = canInvite(d);
  const more = canInv ? `<span class="chmw"><button type="button" class="chmore" data-act="chatMore" aria-label="방 메뉴" aria-haspopup="menu" aria-expanded="${!!CH.more}"><svg width="22" height="22" viewBox="0 0 24 24" fill="#121110" aria-hidden="true"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg></button>${CH.more ? `<div class="chmenu" role="menu" aria-label="방 메뉴"><button type="button" role="menuitem" data-act="chatInvOpen"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#121110" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 3 17.5V19M9 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 8v6M16 11h6"></path></svg>대화상대 초대</button></div>` : ""}</span>` : "";
  const head = pc ? `<header class="pch"><span class="tag" aria-hidden="true">${tagL}</span><span class="chpt"><b>${esc(d.title)}</b><span>${esc(people)}</span></span>${bell}${more}</header>` : hd(d.title, "#/chat", { sub: people, right: `<span class="chhr">${bell}${more}</span>` });
  return `${head}${tk}<div class="chlog" aria-label="${esc(d.title)} 대화" aria-live="polite">${intro}${bodyEmpty}${log}</div>${foot}`;
}
const IC_CHEV = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#121110" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>`;
/* ===================== 용병 평가 (기록의 경기 상세, 운영진) =====================
   경기 방은 경기 끝나고 2시간 뒤 사라지니, 평가는 기록의 그 경기에서 한다.
   현장 출석으로 온 게 확인된 다른 팀 용병만 평가한다. 경기 날짜 다음 날부터 7일 안에 고칠 수 있다.
   평가는 서버 함수(x_rate)로만 쓰고, 목록은 x_rates_of로 받는다. 안 온 용병은 별점 대신 '안 옴'이 서버 계산으로 남는다. */
export const RV = { room: "", tid: "", list: null, busy: false, err: false, open: "", draft: {} };
const WHY = [["ontime", "시간 약속 지킴"], ["manner", "매너 좋음"], ["fit", "포지션 잘 맞음"], ["late", "늦게 옴"], ["rude", "매너 나쁨"], ["curse", "욕설"]];
const dayAdd = (d, n) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const hasExt = e => Object.values((e && e.guests) || {}).some(g => g && g.ext && g.ext.uid);
const rateDays = e => { const today = todayStr(); return e.date < today && today <= dayAdd(e.date, 7); };
const leftOf = list => (list || []).filter(u => (u.check === "in" || u.check === "late") && !u.rate).length;
// 기록 목록의 '용병 평가 N명' 칩: 평가할 수 있는 경기만 한 번씩 물어본다
const RVN = {};
export function rateLeft(e) {
  if (!hasExt(e) || !rateDays(e)) return 0;
  const k = S.tid + ":" + e.id;
  if (!(k in RVN)) { RVN[k] = 0; sb.rpc("x_rates_of", { p_team: S.tid, p_event: e.id }).then(({ data, error }) => { if (!error && Array.isArray(data)) { RVN[k] = leftOf(data); if (RVN[k]) render(); } }).catch(() => {}); }
  return RVN[k] || 0;
}
async function rateLoad(id) {
  if (RV.busy) return; RV.busy = true;
  const { data, error } = await sb.rpc("x_rates_of", { p_team: S.tid, p_event: id });
  RV.busy = false;
  if (RV.room !== id || RV.tid !== S.tid) { render(); return; }
  if (error) { RV.err = true; RV.list = []; } else { RV.list = Array.isArray(data) ? data : []; RVN[S.tid + ":" + id] = leftOf(RV.list); }
  render();
}
const STAR = (fill) => `<svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.3L12 17.1l-5.7 3.1 1.2-6.3-4.7-4.4 6.4-.8z" fill="${fill}" stroke="#121110" stroke-width="2" stroke-linejoin="round"></path></svg>`;
export function rateBox(id, e) {
  if (!hasExt(e) || !rateDays(e)) return "";
  const last = dayAdd(e.date, 7);
  if (RV.room !== id || RV.tid !== S.tid) { RV.room = id; RV.tid = S.tid; RV.list = null; RV.err = false; RV.open = ""; RV.draft = {}; }
  if (RV.list === null) { if (!RV.busy) setTimeout(() => rateLoad(id), 0); return `<section class="xrv" aria-label="용병 평가"><b class="h">용병 평가</b><div class="loading">불러오는 중이에요</div></section>`; }
  if (RV.err) return `<section class="xrv" aria-label="용병 평가"><b class="h">용병 평가</b><span class="n">평가를 준비하고 있어요. 서버 준비가 끝나면 바로 쓸 수 있어요.</span></section>`;
  if (!RV.list.length) return "";
  const nleft = leftOf(RV.list);
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
  return `<section class="xrv" aria-label="용병 평가"><span class="hw"><span class="xrt"><b class="h">용병 평가</b><span class="xdue${nleft ? " on" : ""}">${nleft ? md(last) + " " + wd(last) + "까지" : "다 했어요"}</span></span><span class="n">${note}</span></span>${rows}</section>`;
}
function rvDraft(k) {
  const u = (RV.list || []).find(x => x.key === k); if (!u) return null;
  if (!RV.draft[k]) RV.draft[k] = { s: u.rate ? u.rate.stars : 0, why: u.rate ? (u.rate.why || []).slice() : [] };
  return RV.draft[k];
}
function toBottom() { const lg = document.querySelector(".pcr .chlog"); if (lg) lg.scrollTop = lg.scrollHeight; else window.scrollTo(0, document.documentElement.scrollHeight); }
// 방에 들어올 때: 쓰던 글은 비우고 맨 아래로
export function chatEnter() { S.form = { chat: "" }; CH.stick = true; }

/* ===================== 사진 ===================== */
// 사진 주소: 비공개 저장소라 잠깐 쓰는 서명 주소를 받는다 (1시간, 10분 남으면 새로 받는다)
const signed = p => { const u = CH.urls[p]; return u && u.exp > Date.now() + 600e3 ? u.url : ""; };
function signLater(paths) {
  const need = [...new Set(paths)].filter(p => !signed(p) && !(CH.urls[p] && CH.urls[p].bad));
  if (!need.length || CH.signing) return;
  CH.signing = true;
  setTimeout(async () => {
    try {
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(need, 3600);
      if (!error) (data || []).forEach(x => { if (x && x.signedUrl) CH.urls[x.path] = { url: x.signedUrl, exp: Date.now() + 3600e3 }; else if (x && x.path) CH.urls[x.path] = { bad: true, exp: 0 }; });
      else need.forEach(p => { CH.urls[p] = { bad: true, exp: 0 }; });
    } catch (e) { need.forEach(p => { CH.urls[p] = { bad: true, exp: 0 }; }); }
    CH.signing = false; render();
  }, 0);
}
const rid = () => { const a = new Uint8Array(15); crypto.getRandomValues(a); return Array.from(a, b => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[b % 62]).join(""); };
// 큰 사진은 긴 변 1600px, JPEG로 줄여 올린다 (사진 속 위치 같은 정보도 함께 빠진다)
async function shrink(file) {
  const img = await new Promise((ok, no) => { const u = URL.createObjectURL(file); const i = new Image(); i.onload = () => { URL.revokeObjectURL(u); ok(i); }; i.onerror = () => { URL.revokeObjectURL(u); no(new Error("bad_image")); }; i.src = u; });
  const k = Math.min(1, 1600 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
  const g = c.getContext("2d"); g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise(ok => c.toBlob(ok, "image/jpeg", 0.82));
  if (!blob) throw new Error("bad_image");
  return blob.arrayBuffer();
}
document.addEventListener("change", ev => {
  const t = ev.target; if (!t || t.id !== "chatPh") return;
  const files = Array.from(t.files || []).filter(f => /^image\//.test(f.type || "") || /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(f.name || ""));
  t.value = "";
  if (!files.length) return;
  const room = CH.pick || []; const space = MAXPH - room.length;
  if (space <= 0) { toast(`사진은 한 번에 ${MAXPH}장까지 보낼 수 있어요`); return; }
  if (files.length > space) toast(`사진은 한 번에 ${MAXPH}장까지 보낼 수 있어요`);
  const ta = document.getElementById("chatIn"); if (ta && S.form) S.form.chat = ta.value;
  CH.pick = room.concat(files.slice(0, space).map(f => ({ file: f, url: URL.createObjectURL(f) })));
  render();
});
const dropPick = () => { (CH.pick || []).forEach(p => { try { URL.revokeObjectURL(p.url); } catch (e) { /* 이미 비웠다 */ } }); CH.pick = []; };

/* ===================== 대화상대 초대 (운영진, 열린 일정 방) ===================== */
const canInvite = d => d.kind === "ev" && adminView() && d.team === S.tid && isOpen(d.e) && !CH.missing;
function invCands(d) {
  const e = d.e; const a = att(e);
  const inCap = new Set([...a.yes, ...a.late].map(x => x.uid));
  const ms = msgsAll(d);
  const lastOfU = u => ms.filter(x => x.user_id === u && (x.kind === "inv" || x.kind === "left")).pop();
  return S.members.filter(m => m.role === "member" && !inCap.has(m.user_id) && !((lastOfU(m.user_id) || {}).kind === "inv")).map(m => {
    const v = (((S.rsvp[m.user_id] || {}).ev || {})[e.id]) || {}; const w = a.wait.findIndex(x => x.uid === m.user_id);
    const wasIn = ms.some(x => x.kind === "left" && x.user_id === m.user_id);
    const lc = (e.lateCancel || {})[m.user_id];
    const sub = w >= 0 ? `대기 ${w + 1}번` : v.s === "no" ? (wasIn ? "불참으로 바꿔서 나갔어요" : "불참" + (lc && lc.reason ? ", " + lc.reason : "")) : "투표 안 함";
    return { uid: m.user_id, name: m.display_name || "이름 없음", sub };
  });
}
// 방 위에 뜨는 것: 대화상대 초대, 사진 크게 보기
function sheets(d) {
  if (!d) return "";
  let out = "";
  if (CH.inv && CH.inv.key === d.key && canInvite(d)) {
    const list = invCands(d); const pk = CH.inv.pick || {}; const n = list.filter(c => pk[c.uid]).length;
    out += `<button type="button" class="chov" data-act="chatInvClose" aria-label="닫기" tabindex="-1"></button><section class="chsheet" role="dialog" aria-modal="true" aria-labelledby="chInvT"><span class="hw"><h2 id="chInvT">대화상대 초대</h2><span>이 방에 없는 팀원이에요. 초대하면 방에 들어와 대화를 볼 수 있어요. 참석 투표는 바뀌지 않아요.</span></span>
      <div class="chinl" role="group" aria-labelledby="chInvT">${list.map(c => { const on = !!pk[c.uid]; return `<button type="button" role="checkbox" aria-checked="${on}" class="chinv${on ? " on" : ""}" data-act="chatInvPick" data-u="${esc(c.uid)}"><span class="cav" aria-hidden="true">${esc(initial(c.name))}</span><span class="t"><b>${esc(c.name)}</b><span>${esc(c.sub)}</span></span><span class="bx" aria-hidden="true">${on ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#121110" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>` : ""}</span></button>`; }).join("") || `<span class="chine">초대할 팀원이 없어요. 모두 이 방에 있어요.</span>`}</div>
      <button type="button" class="chinvs" data-act="chatInvSend" aria-disabled="${!n || !!CH.inv.busy}">${CH.inv.busy ? "초대하는 중" : n ? n + "명 초대하기" : "초대할 사람을 골라 주세요"}</button></section>`;
  }
  if (CH.pv) {
    const r = CH.rows[CH.pv.id]; const list = r && !r.hidden && Array.isArray(r.photos) ? r.photos : [];
    if (!list.length) { CH.pv = null; return out; }
    const i = Math.min(Math.max(0, CH.pv.i || 0), list.length - 1); const p = list[i]; const u = signed(p); if (!u) signLater([p]);
    const mine = r.user_id === S.uid; const adm = adminView() && d.team === S.tid && d.kind !== "match";
    const canHide = canWrite(d) && (mine || adm);
    out += `<section class="chpv" role="dialog" aria-modal="true" aria-label="사진 크게 보기"><header><button type="button" class="x" data-act="chatPvClose" aria-label="사진 닫기"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FBF7EF" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg></button><span class="w"><b>${esc(r.name)}</b><span>${md(dayOf(r.created_at))} ${hm(r.created_at)}</span></span><span class="c" aria-live="polite">${i + 1} / ${list.length}</span></header>
      <div class="m">${u ? `<img src="${esc(u)}" alt="${esc(r.name)}님이 보낸 사진 ${i + 1}">` : `<div class="loading">불러오는 중이에요</div>`}${i > 0 ? `<button type="button" class="nv p" data-act="chatPvGo" data-i="${i - 1}" aria-label="앞 사진"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FBF7EF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"></path></svg></button>` : ""}${i < list.length - 1 ? `<button type="button" class="nv n" data-act="chatPvGo" data-i="${i + 1}" aria-label="다음 사진"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FBF7EF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"></path></svg></button>` : ""}</div>
      <div class="f"><button type="button" class="sv" data-act="chatPvSave" data-p="${esc(p)}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#121110" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10.5l5 5 5-5M4 20h16"></path></svg>${isPC() ? "내려받기" : "휴대폰에 저장"}</button>${canHide ? `<button type="button" class="hd2" data-act="chatHide" data-id="${r.id}">가리기</button>` : ""}</div></section>`;
  }
  return out;
}
// 열린 창은 Esc로 닫는다
document.addEventListener("keydown", ev => {
  if (ev.key !== "Escape" || !(CH.pv || CH.inv || CH.more)) return;
  CH.pv = null; CH.inv = null; CH.more = false; render();
});

function chatFail(err) {
  const m = String((err && (err.message || err.details)) || err || "");
  const M = { not_in_room: "참석한 사람만 이 방에 쓸 수 있어요", room_closed: "지금은 이 방에 쓸 수 없어요", too_fast: "너무 빨리 보내고 있어요. 5초 뒤에 보내 주세요", bad_body: "1000자까지 보낼 수 있어요", bad_photos: "사진을 다시 골라 주세요", not_allowed: "남의 글은 운영진만 가릴 수 있어요", no_room: "없는 일정이에요", not_member: "이 팀 사람만 쓸 수 있어요", no_msg: "없는 글이에요", admin_only: "운영진만 초대할 수 있어요", bad_users: "초대할 사람을 골라 주세요" };
  const k = Object.keys(M).find(x => m.includes(x));
  if (k) { toast(M[k]); return; }
  if (/chat_send|chat_hide|chat_invite|function .* does not exist|schema cache/i.test(m)) { toast("대화를 준비하고 있어요. 잠시 뒤에 다시 해 주세요"); return; }
  fail(err);
}
// 이 방의 새 글을 바로 받아 온다 (실시간이 늦을 때)
async function pull(d) {
  const last = msgsAll(d).reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
  const { data } = await sb.from("chat").select("id,team_id,room,user_id,name,body,masked,hidden,kind,photos,created_at").eq("team_id", d.team).eq("room", d.room).gt("id", last).order("id", { ascending: true }).limit(200);
  (data || []).forEach(r => { CH.rows[r.id] = r; });
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
    u.rate = { stars: d.s, why: d.why.slice() }; delete RV.draft[k]; RV.open = ""; RVN[S.tid + ":" + RV.room] = leftOf(RV.list); render();
    toast(`${u.name || "용병"}님을 평가했어요. 별점은 평가가 3번 모이면 다른 팀에 보여요`);
  },
  chatTab: t => { CH.tab = ["match", "merc"].includes(t.dataset.v) ? t.dataset.v : "up"; if (isPC()) { CH.last = ""; CH.stick = true; if (location.hash !== "#/chat") { location.hash = "#/chat"; return; } } render(); },
  chatSend: async t => {
    const d = rd(t.dataset.room || ""); if (!d) return;
    const ta = document.getElementById("chatIn"); if (ta && S.form) S.form.chat = ta.value;
    const body = String((S.form && S.form.chat) || "").trim();
    const pick = (CH.pick || []).slice();
    if (!body && !pick.length) { toast("보낼 말이나 사진을 골라 주세요"); return; }
    if (!canWrite(d)) { toast("지금은 이 방에 보낼 수 없어요"); return; }
    if (maintLocked()) { fail(new Error("maintenance")); return; }
    if (CH.sending) return; CH.sending = true; if (pick.length) render();
    const paths = [];
    try {
      for (const p of pick) {
        const buf = await shrink(p.file);
        const path = `${d.team}/${d.room}/${S.uid}/${rid()}.jpg`;
        const { error } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: "image/jpeg", upsert: false, cacheControl: "3600" });
        if (error) throw error;
        paths.push(path);
      }
    } catch (err) {
      CH.sending = false; render();
      toast(String((err && err.message) || "").includes("bad_image") ? "이 사진은 열 수 없어요. 다른 사진을 골라 주세요" : "사진을 올리지 못했어요. 잠시 뒤에 다시 보내 주세요");
      return;
    }
    const { data, error } = await sb.rpc("chat_send", paths.length ? { p_team: d.team, p_room: d.room, p_body: body, p_photos: paths } : { p_team: d.team, p_room: d.room, p_body: body });
    CH.sending = false;
    if (error || !data) { render(); chatFail(error); return; }
    CH.rows[data.id] = { ...data, team_id: d.team };
    S.form.chat = ""; dropPick(); CH.stick = true; render();
    if (data.masked) toast("욕설은 가려서 보냈어요. 운영진에게 경고 알림이 가요");
  },
  chatPhDel: t => { const i = Number(t.dataset.i); const p = (CH.pick || [])[i]; if (!p) return; try { URL.revokeObjectURL(p.url); } catch (e) { /* 이미 비웠다 */ } const ta = document.getElementById("chatIn"); if (ta && S.form) S.form.chat = ta.value; CH.pick = CH.pick.filter((x, j) => j !== i); render(); },
  chatBell: async t => {
    const k = t.dataset.k || ""; if (!k) return;
    const on = roomOn(k);
    if (maintLocked()) { fail(new Error("maintenance")); return; }
    toast(on ? "이 방 알림을 껐어요" : "이 방 알림을 켰어요. 나를 부른 글만 알려요"); // 화면은 바로 바뀌고 저장은 뒤에서 (실패하면 되돌리고 알림)
    try { await patchDoc("uvote", S.uid, { ra: { [k]: on ? "off" : "on" } }); } catch (e) { fail(e); }
  },
  chatMore: () => { CH.more = !CH.more; render(); setTimeout(() => { const b = document.querySelector(".chmenu [role=menuitem]"); if (b) b.focus(); }, 0); },
  chatInvOpen: () => { CH.more = false; CH.inv = { key: CH.room, pick: {} }; render(); setTimeout(() => { const b = document.querySelector(".chsheet .chinv, .chsheet .chinvs"); if (b) b.focus(); }, 0); },
  chatInvClose: () => { CH.inv = null; CH.more = false; render(); },
  chatInvPick: t => { if (!CH.inv) return; const u = t.dataset.u; CH.inv.pick = { ...(CH.inv.pick || {}), [u]: !(CH.inv.pick || {})[u] }; render(); },
  chatInvSend: async () => {
    const d = CH.inv && rd(CH.inv.key); if (!d || CH.inv.busy) return;
    const list = invCands(d).filter(c => (CH.inv.pick || {})[c.uid]);
    if (!list.length) { toast("초대할 사람을 골라 주세요"); return; }
    if (maintLocked()) { fail(new Error("maintenance")); return; }
    CH.inv.busy = true; render();
    const { error } = await sb.rpc("chat_invite", { p_team: d.team, p_room: d.room, p_users: list.map(c => c.uid) });
    if (CH.inv) CH.inv.busy = false;
    if (error) { render(); chatFail(error); return; }
    CH.inv = null;
    try { await pull(d); } catch (e) { /* 실시간으로 곧 들어온다 */ }
    CH.stick = true; render();
    toast(`${list.map(c => c.name).join(", ")}님을 초대했어요`);
  },
  chatPv: t => { CH.pv = { id: t.dataset.id, i: Number(t.dataset.i) || 0 }; render(); setTimeout(() => { const b = document.querySelector(".chpv .x"); if (b) b.focus(); }, 0); },
  chatPvGo: t => { if (!CH.pv) return; CH.pv.i = Number(t.dataset.i) || 0; render(); },
  chatPvClose: () => { CH.pv = null; render(); },
  chatPvSave: async t => {
    const p = t.dataset.p; if (!p) return;
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(p, 120, { download: "maniball-" + p.split("/").pop() });
    if (error || !data || !data.signedUrl) { toast("사진을 받지 못했어요. 잠시 뒤에 다시 해 주세요"); return; }
    const a = document.createElement("a"); a.href = data.signedUrl; a.rel = "noopener"; a.download = "maniball-" + p.split("/").pop(); document.body.appendChild(a); a.click(); a.remove();
  },
  chatHide: t => {
    const r = CH.rows[t.dataset.id]; if (!r || r.hidden) return;
    const mine = r.user_id === S.uid; const ph = phN(r);
    confirmBox(mine ? (ph ? "내 사진을 가릴까요?" : "내 글을 가릴까요?") : (ph ? "이 사진을 가릴까요?" : "이 글을 가릴까요?"), mine ? `가리면 ${ph ? "사진과 글이" : "글 내용이"} 지워지고, 다른 사람에게는 '보낸 사람이 가린 글이에요'로 보여요. 되돌릴 수 없어요.` : `${r.name}님 ${ph ? "사진과 글이" : "글이"} 지워지고 '운영진이 가린 글이에요'로 보여요. 되돌릴 수 없어요.`, "가리기", async () => {
      if (maintLocked()) { fail(new Error("maintenance")); return; }
      const { data, error } = await sb.rpc("chat_hide", { p_id: Number(r.id) });
      if (error) { chatFail(error); return; }
      CH.rows[r.id] = { ...r, hidden: data || (mine ? "self" : "admin"), body: "", masked: 0, photos: null }; if (CH.pv && String(CH.pv.id) === String(r.id)) CH.pv = null; render();
      toast(mine ? (ph ? "내 사진을 가렸어요" : "내 글을 가렸어요") : (ph ? "사진을 가렸어요. 보낸 사람에게는 가렸다고 알려요" : "글을 가렸어요"));
    }, true);
  },
};
// 보내기 버튼: 글을 쓰는 동안 바로 켜고 끈다 (화면 전체를 다시 그리지 않고)
document.addEventListener("input", ev => {
  const t = ev.target; if (!t || t.id !== "chatIn") return;
  const b = document.querySelector(".chs"); if (b) b.setAttribute("aria-disabled", String((!t.value.trim() && !(CH.pick || []).length) || !!CH.sending));
  t.style.height = "auto"; t.style.height = Math.min(140, t.scrollHeight + 4) + "px";
});
