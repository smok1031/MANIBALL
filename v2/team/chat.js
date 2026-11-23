// 대화: 일정마다 방 하나 (방 이름 = 일정 id). 매니볼 모바일 시안 4-6 대화와 같은 모양.
// 글 쓰기와 가리기는 서버 함수(chat_send, chat_hide)로만 한다. 욕설은 서버가 그 단어만 *** 로 가려 저장하고,
// 가린 글이 있으면 운영진에게 휴대폰 알림이 간다. 끝난 방(일정 날짜가 지났거나 취소)은 읽기만 한다.
import { S, sb, esc, render, toast, fail, ls, isAdmin, viewMode, isCanceled, md, wd, evName, evStart, isPlay, maintLocked, todayStr, att, confirmBox } from "./main.js";
import { hd, hdTab, empty, initial, navBar } from "./ui.js";
import { isPC } from "./pc.js";

export const CH = { rows: {}, tid: "", loading: false, loaded: false, missing: false, tab: "up", sending: false, stick: false, last: "" };
const LIMIT = 2000;
const VS = { yes: "참석", late: "늦참", no: "불참" };

// 불러오기: 팀을 열 때 한 번, 그 뒤는 실시간으로 받는다
export async function chatLoad(force) {
  if (!S.tid) return;
  if (CH.tid !== S.tid) { CH.rows = {}; CH.loaded = false; CH.missing = false; CH.tid = S.tid; }
  if (CH.loading || (CH.loaded && !force)) return;
  CH.loading = true;
  const { data, error } = await sb.from("chat").select("id,team_id,room,user_id,name,body,masked,hidden,created_at").eq("team_id", S.tid).order("id", { ascending: false }).limit(LIMIT);
  CH.loading = false;
  if (error) { CH.missing = true; return; } // 서버에 대화 표가 아직 없을 때 (SQL 실행 전)
  (data || []).forEach(r => { CH.rows[r.id] = r; });
  CH.loaded = true; CH.missing = false;
}
// 실시간: 새 글, 가린 글
export function chatOnChange(p) {
  const n = p && p.new; if (!n || !n.id || n.team_id !== S.tid) return;
  const lg = document.querySelector(".pcr .chlog");
  const nearBottom = lg ? lg.scrollTop + lg.clientHeight >= lg.scrollHeight - 160 : innerHeight + scrollY >= document.documentElement.scrollHeight - 160;
  CH.rows[n.id] = n;
  if (/^#\/chat/.test(location.hash) && nearBottom) CH.stick = true;
  render();
}

// 방 규칙 (서버의 chat_room_open과 같다)
const isOpen = e => !!e && !isCanceled(e) && /^\d{4}-\d{2}-\d{2}$/.test(e.date || "") && e.date >= todayStr();
const roomsUp = () => Object.values(S.events).filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.date || "") && e.date >= todayStr()).sort((a, b) => evStart(a) - evStart(b));
const roomsPast = () => Object.values(S.events).filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.date || "") && e.date < todayStr()).sort((a, b) => evStart(b) - evStart(a)).slice(0, 30);
const titleOf = e => `${md(e.date)} ${wd(e.date)} ${evName(e)}`;
const msgsOf = room => Object.values(CH.rows).filter(r => r.room === room).sort((a, b) => a.id - b.id);
const adminView = () => isAdmin() && viewMode() === "admin";
const myName = () => { const m = S.members.find(x => x.user_id === S.uid); return (m && m.display_name) || ""; };

// 읽은 자리: 이 기기에 방마다 마지막으로 본 글 번호를 둔다
let READ = null, READ_K = "";
const readKey = () => "mb-chat-read:" + S.tid + ":" + S.uid;
function reads() { const k = readKey(); if (READ_K !== k) { READ_K = k; try { READ = JSON.parse(ls.get(k) || "{}") || {}; } catch (e) { READ = {}; } } return READ; }
function markRead(room, id) { const r = reads(); if ((r[room] || 0) >= id) return; r[room] = id; ls.set(readKey(), JSON.stringify(r)); }
function unreadOf(room) {
  const last = reads()[room] || 0; const me = myName();
  let n = 0, at = false;
  msgsOf(room).forEach(r => { if (r.id > last && r.user_id !== S.uid && !r.hidden) { n++; if (me && r.body.indexOf("@" + me) >= 0) at = true; } });
  return { n, at };
}
// 하단 메뉴 '대화' 칸의 숫자
export function chatUnread() {
  if (!CH.loaded || CH.tid !== S.tid) return 0;
  return roomsUp().concat(roomsPast()).reduce((t, e) => t + unreadOf(e.id).n, 0);
}

const hm = iso => { const d = new Date(Date.parse(iso) + 9 * 3600e3); return d.toISOString().slice(11, 16); };
const dayOf = iso => new Date(Date.parse(iso) + 9 * 3600e3).toISOString().slice(0, 10);
const dayLabel = ds => `${md(ds)} ${wd(ds)}`;
// 글 모양: @이름은 굵게 밑줄, *** 는 가린 말
function bodyHtml(t) {
  return String(t).split(/(@[^\s@]+|\*\*\*)/).filter(Boolean).map(s => s === "***" ? `<span class="mk" aria-label="가린 말">***</span>` : s[0] === "@" ? `<span class="at">${esc(s)}</span>` : esc(s)).join("");
}

/* ===================== 대화 목록 ===================== */
export function vChat() {
  if (isPC()) return pcChat("");
  return `${hdTab("대화")}<div class="body" style="gap:12px">${listInner("")}</div>${navBarChat()}`;
}
// 방 목록 (휴대폰 목록 화면과 PC 왼쪽 칸이 같이 쓴다). cur: PC에서 지금 연 방
function listInner(cur) {
  if (!CH.loaded && !CH.loading && !CH.missing) chatLoad().then(render).catch(() => {});
  const tab = CH.tab === "past" ? "past" : "up";
  const list = tab === "past" ? roomsPast() : roomsUp();
  const tabs = [["up", "다가오는 일정"], ["past", "지난 일정"]].map(([k, l]) => `<button type="button" class="chtab" data-act="chatTab" data-v="${k}" aria-pressed="${tab === k}">${l}</button>`).join("");
  const rows = list.map(e => {
    const ms = msgsOf(e.id); const last = ms[ms.length - 1];
    const u = unreadOf(e.id); const open = isOpen(e);
    const lastText = last ? `${esc(last.name)}: ${last.hidden ? "가린 글이에요" : esc(last.body)}` : open ? "아직 글이 없어요. 먼저 말을 걸어 보세요." : "글이 없어요";
    const right = `<span>${last ? (dayOf(last.created_at) === todayStr() ? hm(last.created_at) : md(dayOf(last.created_at))) : ""}</span><span class="row">${u.at ? `<span class="cha" aria-hidden="true">@</span>` : ""}${u.n ? `<span class="chn" aria-hidden="true">${u.n > 99 ? "99+" : u.n}</span>` : ""}${!open ? `<span class="chx">${isCanceled(e) ? "취소" : "끝남"}</span>` : ""}</span>`;
    const aria = `${titleOf(e)}${u.n ? ", 안 읽은 글 " + u.n + "개" : ""}${!open ? ", 읽기만 가능" : ""}`;
    return `<a class="chr${e.id === cur ? " on" : ""}" href="#/chat/${encodeURIComponent(e.id)}" aria-label="${esc(aria)}"${e.id === cur ? ' aria-current="true"' : ""}><span class="chd${open ? "" : " off"}" aria-hidden="true"><b>${md(e.date)}</b><span>${wd(e.date)}</span></span><span class="cht"><b>${esc(titleOf(e))}</b><span>${lastText}</span></span><span class="chm">${right}</span></a>`;
  }).join("");
  const note = tab === "past" ? "끝난 일정 방은 읽기만 할 수 있어요." : "일정을 올리면 방이 함께 생겨요. 일정 날짜가 지나면 읽기만 할 수 있어요.";
  const body = CH.missing ? empty("대화를 준비하고 있어요", "서버 준비가 끝나면 바로 쓸 수 있어요.")
    : !CH.loaded ? `<div class="loading">불러오는 중이에요</div>`
    : list.length ? rows : empty(tab === "past" ? "지난 일정이 없어요" : "다가오는 일정이 없어요", "일정이 올라오면 방이 함께 생겨요.");
  return `<div class="chtabs" role="group" aria-label="방 고르기">${tabs}</div><span style="font-size:12px;color:var(--sub)">${note}</span>${body}`;
}
// PC: 왼쪽 방 목록, 오른쪽 방. 방을 안 골랐으면 마지막에 본 방이나 목록의 첫 방을 연다
function pcChat(id) {
  let room = id;
  if (id && S.events[id] && /^\d{4}-\d{2}-\d{2}$/.test(S.events[id].date || "")) CH.tab = S.events[id].date < todayStr() ? "past" : "up";
  if (!room) { const list = (CH.tab === "past" ? roomsPast() : roomsUp()); room = (CH.last && list.some(e => e.id === CH.last)) ? CH.last : (list[0] || {}).id || ""; }
  const right = room && S.events[room] ? roomInner(room, true) : `<div class="pce">${empty("방을 골라 주세요", "왼쪽에서 일정 방을 누르면 여기에 대화가 보여요.")}</div>`;
  return `${hdTab("대화")}<div class="pcsplit"><div class="pcl">${listInner(room)}</div><section class="pcr" aria-label="대화방">${right}</section></div>`;
}
// 하단 메뉴 (ui.js가 대화 칸에 안 읽은 글 수를 함께 그린다)
const navBarChat = () => navBar("대화");

/* ===================== 대화방 ===================== */
export function vChatRoom(id) {
  const e = S.events[id];
  if (!e) return `${hd("대화", "#/chat")}<div class="body">${empty("없는 일정이에요", "지워진 일정일 수 있어요.")}</div>`;
  if (isPC()) return pcChat(id);
  return roomInner(id, false);
}
// 방 내용 (휴대폰은 화면 전체, PC는 오른쪽 칸)
function roomInner(id, pc) {
  const e = S.events[id]; CH.last = id;
  if (!CH.loaded && !CH.loading && !CH.missing) chatLoad().then(render).catch(() => {});
  const open = isOpen(e); const cx = isCanceled(e); const adm = adminView();
  const ms = msgsOf(id);
  if (ms.length) markRead(id, ms[ms.length - 1].id);
  const roleOf = u => { const m = S.members.find(x => x.user_id === u); return m ? m.role : ""; };
  const voteOf = u => { const v = (((S.rsvp[u] || {}).ev || {})[id]) || {}; return v.s ? VS[v.s] + (v.s === "late" && v.q ? " " + v.q + "Q" : "") : ""; };
  const me = myName();
  // 표 (방 위에 붙는 일정 티켓)
  const a = open && !cx ? att(e) : null;
  const line1 = `${esc(e.time || "")}${e.end ? " ~ " + esc(e.end) : ""}  ${esc(e.place || "장소 미정")}`;
  const line2 = cx ? "취소된 일정이에요" : a ? `참석 ${a.in}${a.cap ? " / " + a.cap : "명"}${a.wait && a.wait.length ? ", 대기 " + a.wait.length : ""}` : "지난 일정이에요";
  const lk = isPlay(e) && !open && !cx ? `#/game/${encodeURIComponent(id)}` : `#/event/${encodeURIComponent(id)}`;
  const tk = `<div class="chtk${open ? "" : " off"}"><span class="l"><b>${line1}</b><span>${line2}</span></span><span class="pf" aria-hidden="true"></span><span class="st"><b>${md(e.date)}</b><span>${cx ? "취소" : wd(e.date)}</span></span></div>
    <div class="chlkw"><span>${open ? "참석 투표는 일정에서 바꿔요." : cx ? "취소된 일정이라 읽기만 할 수 있어요." : "결과와 MOM은 기록에서 봐요."}</span><a class="chlk" href="${lk}">${isPlay(e) && !open && !cx ? "기록에서 보기" : "일정에서 보기"}</a></div>`;
  // 글
  let prevDay = "", prev = null;
  const log = ms.map(r => {
    const d = dayOf(r.created_at); let out = "";
    if (d !== prevDay) { out += `<span class="chday">${dayLabel(d)}</span>`; prevDay = d; prev = null; }
    const mine = r.user_id === S.uid; const cont = prev && prev.user_id === r.user_id;
    const role = roleOf(r.user_id); const isOp = role === "owner" || role === "admin";
    const gone = !!r.hidden; const callsMe = !gone && me && r.body.indexOf("@" + me) >= 0 && !mine;
    const nameRow = !mine && !cont ? `<span class="cnm"><b>${esc(r.name)}</b>${isOp ? `<span class="tag ink">운영진</span>` : ""}${open && voteOf(r.user_id) ? `<span class="v">${voteOf(r.user_id)}</span>` : ""}</span>` : "";
    const text = gone ? (r.hidden === "self" ? "보낸 사람이 가린 글이에요." : "운영진이 가린 글이에요.") : bodyHtml(r.body);
    const canHide = open && !gone && (mine || adm);
    out += `<div class="cm${mine ? " me" : ""}${cont ? " cont" : ""}">${!mine && !cont ? `<span class="cav" aria-hidden="true">${esc(initial(r.name))}</span>` : ""}<div class="ccol">${nameRow}${callsMe ? `<span class="tag ink">나를 불렀어요</span>` : ""}<div class="cbr"><span class="cb${gone ? " gone" : ""}${callsMe ? " callme" : ""}">${text}</span><span class="ctm">${hm(r.created_at)}</span></div>${adm && !gone && r.masked ? `<span class="cmk"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#121110" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 20h20z"></path><path d="M12 10v4M12 17v.5"></path></svg>욕설 ${r.masked}개를 가렸어요. 운영진에게 경고 알림이 갔어요</span>` : ""}${canHide ? `<button type="button" class="chide" data-act="chatHide" data-id="${r.id}" aria-label="${mine ? "내가 " + hm(r.created_at) + "에 보낸 글 가리기" : esc(r.name) + "님 " + hm(r.created_at) + " 글 가리기"}">가리기</button>` : ""}</div></div>`;
    prev = r; return out;
  }).join("");
  const intro = `<span class="chsys">${esc(titleOf(e))} 방이에요. 이 일정의 팀원 모두가 함께 봐요.</span>`;
  const bodyEmpty = CH.missing ? `<span class="chsys">대화를 준비하고 있어요. 서버 준비가 끝나면 바로 쓸 수 있어요.</span>` : !CH.loaded ? `<div class="loading">불러오는 중이에요</div>` : "";
  const draft = S.form && typeof S.form.chat === "string" ? S.form.chat : "";
  const foot = open && !CH.missing
    ? `<div class="chc"><div class="row"><label for="chatIn" class="sr">메시지</label><textarea id="chatIn" data-bind="chat" rows="1" maxlength="1000" placeholder="메시지 보내기  @이름으로 부르기">${esc(draft)}</textarea><button type="button" class="chs" data-act="chatSend" data-room="${esc(id)}" aria-disabled="${!draft.trim()}">보내기</button></div><span class="hint">@이름으로 부르면 그 사람이 알아보기 쉬워요. 내가 보낸 글은 아래 '가리기'로 가릴 수 있어요.</span></div>`
    : `<div class="chclosed"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#121110" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg><span>${cx ? "취소된 일정이라 읽기만 할 수 있어요." : "일정 날짜가 지나 읽기만 할 수 있어요. 이 방은 기록과 함께 남아요."}</span></div>`;
  if (CH.stick) { CH.stick = false; setTimeout(toBottom, 0); }
  const head = pc ? `<header class="pch"><span class="tag">일정 방</span><b>${esc(titleOf(e))}</b><span>팀원 ${S.members.length}명</span></header>` : hd(titleOf(e), "#/chat", { sub: `팀원 ${S.members.length}명` });
  const rate = pc && adm && !open && !cx ? rateBox(id, e) : "";
  return `${head}${tk}<div class="chlog" aria-label="${esc(titleOf(e))} 대화" aria-live="polite">${intro}${bodyEmpty}${log}</div>${rate}${foot}`;
}
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
  const M = { room_closed: "끝난 방이라 바꿀 수 없어요", too_fast: "너무 빨리 보내고 있어요. 잠시 뒤에 보내 주세요", bad_body: "1000자까지 보낼 수 있어요", not_allowed: "남의 글은 운영진만 가릴 수 있어요", no_room: "없는 일정이에요", not_member: "이 팀 사람만 쓸 수 있어요", no_msg: "없는 글이에요" };
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
  chatTab: t => { CH.tab = t.dataset.v === "past" ? "past" : "up"; if (isPC()) { CH.last = ""; CH.stick = true; if (location.hash !== "#/chat") { location.hash = "#/chat"; return; } } render(); },
  chatSend: async t => {
    const id = t.dataset.room; const e = S.events[id];
    const body = String((S.form && S.form.chat) || "").trim();
    if (!body) { toast("보낼 말을 적어 주세요"); return; }
    if (!isOpen(e)) { toast("끝난 방이라 보낼 수 없어요"); return; }
    if (maintLocked()) { fail(new Error("maintenance")); return; }
    if (CH.sending) return; CH.sending = true;
    const { data, error } = await sb.rpc("chat_send", { p_team: S.tid, p_room: id, p_body: body });
    CH.sending = false;
    if (error || !data) { chatFail(error); return; }
    CH.rows[data.id] = { ...data, team_id: S.tid };
    S.form.chat = ""; CH.stick = true; render();
    if (data.masked) toast("욕설은 가려서 보냈어요. 운영진에게 경고 알림이 가요");
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
