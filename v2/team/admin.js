// 운영진 화면 (뉴버전 시안 [운영진]). 팀원 화면은 member.js가 그리고, 운영진에게만 보이는 화면과 도구를 여기에 둔다.
import { S, D, $, att, esc, md, wd, evName, started, evStart, isPlay, momClosed, momDeadline, momWinners, nameOf, people, guestReqs, guestsOf, scrimReady, won, pol, POS, QN, ROLE, UI,
  isAdmin, viewMode, route, backHref, render, toast, fail, sheet, closeSheet, confirmBox, setDoc, delDoc, patchDoc, sb, uid36, todayStr, ym, mLabel, monthsList, feeMode, paidOf, cameTo,
  syncMyDues, refreshMembers, remindInfo, inviteUrl, canKick, profileOf, posFix, sport, voteState, closeAt, past, rulesFormInit, rulesFromForm, rulesTextOf, fineRulesOf, ruleKind,
  curLineup, lineupPlayers, draftOf, formOf, autoLineup, FORMS, FORM_DESC, applyFix, spotXY, FUTSAL_N, loadReqs, ls, APP, isCanceled } from "./main.js";
import { C, IC, navBar, hd, hdTab, lrow, dlg, empty, sw, teamLogo } from "./ui.js";
import { bigTicket, strip, whenText, kindOf, vsText, myStats, teamRecord, memberGroups, seasonEvents, cancelCard } from "./member.js";
import { canPlay, isKeeper } from "./lineup-core.js";

/* ---------- 작은 도구 ---------- */
const AU = { fa: null, out: "leave", next: "", rf: "", ref: "", mset: null };
const owner = () => S.role === "owner";
const evLabel = e => `${md(e.date)} ${wd(e.date)} ${kindOf(e)}`;
const gname = (e, u) => u && u.startsWith("g:") ? ((((e && e.guests) || {})[u.slice(2)] || {}).name || "용병") : nameOf(u);
const numOf = u => ((profileOf(u) || {}).num || "");
const posTxt = p => [p.pos1, p.pos2].filter(Boolean).join(" / ");
const kstDate = iso => new Date(Date.parse(iso) + 9 * 3600e3).toISOString().slice(0, 10);
const back = fb => backHref(fb);
const cbOf = e => { const v = e.checkBefore; return v === undefined || v === "" || v === null ? pol("checkBefore") : Number(v) || 0; };
const checkTime = e => { if (!/^\d\d:\d\d$/.test(e.time || "")) return ""; const [h, m] = e.time.split(":").map(Number); const t = (h * 60 + m - cbOf(e) + 1440) % 1440; return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0"); };
const sel = (id, opts, val, attrs = "") => `<select class="inp" id="${id}" ${attrs}>${opts.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(val) ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
const numInp = (bind, val, dis, w = 64) => `<input class="inp n" inputmode="numeric" data-bind="${bind}" value="${esc(String(val ?? ""))}" maxlength="3" style="width:${w}px;flex:none"${dis ? " disabled" : ""} aria-label="${bind}">`;
const head2 = (t, right = "") => `<span class="spread" style="align-items:baseline;border-bottom:2px solid ${C.ink};padding-bottom:8px"><b style="font-size:16px">${t}</b>${right}</span>`;
const nav = on => navBar(on);
const stampT = iso => { const d = new Date(Date.parse(iso) + 9 * 3600e3); return `${d.getUTCMonth() + 1}.${String(d.getUTCDate()).padStart(2, "0")}`; };

/* ---------- 운영진 알림 ---------- */
export function afeed() {
  const out = []; const now = Date.now();
  const add = (at, where, text, href) => { const t = Date.parse(at || ""); if (t && now - t < 30 * 864e5) out.push({ t, where, text, href }); };
  Object.values(S.events).forEach(e => {
    const nm = `${md(e.date)} ${evName(e)}`;
    if (scrimReady(e)) add(new Date(Math.min(now, new Date(e.date + "T09:00:00+09:00").getTime() - pol("scrimDays") * 864e5)).toISOString(), "운영", `${md(e.date)} 경기 신청 ${att(e).in + att(e).wait.length}명, 내전으로 바꿀 수 있어요`, "#/scrim/" + e.id);
    if (isCanceled(e)) add(e.cancel.at, "일정", `${nm} 일정을 취소했어요. 사유: ${e.cancel.reason || "운영진 결정"}`, "#/manage/" + e.id);
    if (started(e) && isPlay(e) && !e.score && !isCanceled(e)) add(new Date(evStart(e)).toISOString(), "기록", `${nm} 결과를 아직 안 넣었어요`, "#/result/" + e.id);
    if (!started(e) && e.createdAt) add(e.createdAt, "일정", `${nm} 참석 ${att(e).in}${att(e).cap ? " / " + att(e).cap : ""}, 미응답 ${att(e).none.length}명`, "#/manage/" + e.id);
    if (e.score && momClosed(e) && momWinners(e).length) add(momDeadline(e).toISOString(), "기록", `${nm} MOM ${momWinners(e).map(nameOf).join(", ")}`, "#/game/" + e.id);
    Object.entries(e.lateCancel || {}).forEach(([u, c]) => add(c.t, "일정", `${nm} ${nameOf(u)} 불참 변경${Number(c.amount) ? ", 벌금 " + won(c.amount) : ""}${c.reason ? ", " + c.reason : ""}`, "#/manage/" + e.id));
    guestReqs(e).filter(g => g.status === "req").forEach(g => add(g.at, "용병", `${nameOf(g.u)} 님이 ${nm}에 ${g.name} 님 용병 신청`, "#/merc/" + e.id));
  });
  people().forEach(x => { const r = (S.rsvp[x.uid] || {}).posReq; if (r && r.status === "req") add(r.at, "포지션", `${x.name} 님 포지션 변경 요청 ${[r.pos1, r.pos2].filter(Boolean).join(", ")}`, "#/posreqs"); });
  (S.reqs || []).forEach(r => add(r.created_at, "가입", `${r.display_name} 님 가입 신청`, "#/requests"));
  return out.sort((a, b) => b.t - a.t);
}
export const adminHomeRows = () => "";

/* ===================== 운영 탭 ===================== */
function duesNow() {
  const fee = Number(S.settings.fee) || 0; const mode = feeMode();
  if (mode === "monthly") { const key = "m-" + ym(); const n = S.members.filter(m => paidOf(key, m.user_id)).length; return { text: `${mLabel(ym())} ${n}/${S.members.length}`, fee }; }
  if (mode === "per_game") { const e = past().filter(isPlay)[0]; if (!e) return { text: "", fee }; const ps = people().filter(x => cameTo(e, x.uid)); const n = ps.filter(x => paidOf("e-" + e.id, x.uid)).length; return { text: `${md(e.date)} ${n}/${ps.length}`, fee }; }
  return { text: "안 받음", fee };
}
function aOps() {
  const reqN = (S.reqs || []).length; const posN = people().filter(x => ((S.rsvp[x.uid] || {}).posReq || {}).status === "req").length;
  const fineN = Object.values(D("fines")).filter(f => !f.paid).length; const dn = duesNow();
  const me = `<span class="tag ${owner() ? "blue" : "gray"}" style="margin-right:12px;font-size:12px;padding:4px 8px">${owner() ? "Admin" : "운영진"} ${esc(nameOf(S.uid))}</span>`;
  const big = s => `<b class="bc" style="font-size:20px;color:${C.ink}">${esc(s)}</b>`;
  return `${hdTab("운영", me)}<div class="body">
    <span style="font-size:14px;border-bottom:2px solid ${C.ink};padding-bottom:16px">운영진만 보는 탭이에요. 팀원 화면에는 없어요.</span>
    <nav class="lst" aria-label="운영 메뉴" style="border-top:0;margin-top:-18px">
      ${lrow({ href: "#/requests", icon: IC.join, tone: "green", title: "가입 승인", sub: "초대 링크로 들어온 사람", right: reqN ? `<span class="tag orange">${reqN}명 기다림</span>` : "", big: true })}
      ${lrow({ href: "#/posreqs", icon: IC.target, tone: "pink", title: "포지션 변경 요청", sub: "팀원이 보낸 요청", right: posN ? `<span class="tag pink">${posN}건</span>` : "", big: true })}
      ${lrow({ href: "#/dues", icon: IC.card, tone: "clay", title: "회비 관리", sub: feeMode() === "none" ? "회비를 안 받아요" : "달마다 낸 사람 체크", right: dn.text && feeMode() !== "none" ? big(dn.text) : "", big: true })}
      ${lrow({ href: "#/fines", icon: IC.receipt, tone: "orange", title: "벌금 관리", sub: "매기고, 낸 것 체크", right: fineN ? `<b style="color:${C.ink}">안 낸 ${fineN}건</b>` : "", big: true })}
      ${lrow({ href: "#/policy", icon: IC.shield, tone: "blue", title: "기본 운영 규칙", sub: "정원, 마감, 출석, 내전 기준", right: `<span class="tag blue">Admin</span>`, big: true })}
      ${lrow({ href: "#/settings", icon: IC.gear, title: "팀 설정", sub: "초대 링크, 가입 승인제, 팀 지우기", right: `<span class="tag blue">Admin</span>`, big: true })}
    </nav>
  </div>${nav("운영")}`;
}

/* ---------- 가입 승인 ---------- */
function aRequests() {
  const rs = S.reqs || []; const norm = s => String(s || "").replace(/\s/g, "");
  const card = r => {
    const same = people().find(x => norm(x.name) === norm(r.display_name));
    return `<div class="box" style="border-radius:16px;gap:8px">
      <div class="spread" style="align-items:flex-start"><span style="display:flex;flex-direction:column;gap:4px;min-width:0"><b style="font-size:18px">${esc(r.display_name)}</b><span style="font-size:12px">카카오 이름 ${esc(r.kakao_name || "없음")}</span></span><span class="tag">기다림</span></div>
      ${same ? `<div style="border:2px dashed ${C.ink};background:${C.bg};border-radius:8px;padding:8px 12px;font-size:12px;font-weight:700;line-height:1.6">팀에 같은 이름이 있어요 (${esc((same.p.num ? same.p.num + " " : "") + same.name)}). 같은 사람이 다른 카카오 계정으로 들어온 건 아닌지 확인해 주세요.</div>` : ""}
      ${r.message ? `<div style="background:${C.bg};border:2px dashed ${C.ink};border-radius:8px;padding:8px 12px;font-size:14px;line-height:1.6">${esc(r.message)}</div>` : ""}
      <span class="note">${esc(stampT(r.created_at))} 신청</span>
      <div class="grid2"><button class="btn" data-act="reqNo" data-id="${esc(r.user_id)}">거절</button><button class="btn g" data-act="reqOk" data-id="${esc(r.user_id)}">받기</button></div></div>`;
  };
  return `${hd("가입 승인", back("#/ops"), { sub: "초대 링크로 들어온 사람을 받아요" })}<div class="body" style="gap:16px">
    ${rs.length ? rs.map(card).join("") : empty("새 가입 신청이 없어요", "초대 링크로 신청이 들어오면 여기에 보여요.")}
    <span class="note">받으면 팀원이 되고 선수 등록을 마친 뒤 팀원 홈으로 들어가요. 가입 승인제는 팀 설정에서 끌 수 있어요.</span>
  </div>${nav("운영")}`;
}

/* ---------- 포지션 변경 요청 ---------- */
function aPosReqs() {
  const ps = people(); const pend = ps.filter(x => ((S.rsvp[x.uid] || {}).posReq || {}).status === "req");
  const done = ps.map(x => ({ x, r: (S.rsvp[x.uid] || {}).posReq })).filter(o => o.r && (o.r.status === "ok" || o.r.status === "no") && o.r.doneAt).sort((a, b) => String(b.r.doneAt).localeCompare(String(a.r.doneAt)));
  const card = x => {
    const r = S.rsvp[x.uid].posReq; const cur = posTxt(x.p) || "미정"; const want = [r.pos1, r.pos2].filter(Boolean).join(" / ");
    return `<div class="box" style="border-radius:16px;gap:12px">
      <div class="spread" style="align-items:flex-start"><span class="row" style="gap:8px"><b class="bc" style="font-size:24px">${esc(x.p.num || "")}</b><span style="display:flex;flex-direction:column"><b style="font-size:16px">${esc(x.name)}</b><span class="note">${r.at ? esc(stampT(r.at)) + " 요청" : ""}</span></span></span><span class="tag">기다림</span></div>
      <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px"><span style="background:${C.bg};border:2px dashed ${C.ink};border-radius:8px;padding:8px 8px;display:flex;flex-direction:column;align-items:center;gap:4px"><span style="font-size:12px">지금</span><b class="bc" style="font-size:20px">${esc(cur)}</b></span>${IC.arrow}<span style="background:${C.white};border:2px solid ${C.ink};border-radius:8px;box-shadow:4px 4px 0 ${C.ink};padding:8px;display:flex;flex-direction:column;align-items:center;gap:4px"><span style="font-size:12px">바꿔 달라는 것</span><b class="bc" style="font-size:20px">${esc(want)}</b></span></div>
      ${r.note ? `<span class="note">${esc(r.note)}</span>` : ""}
      <div class="grid2"><button class="btn" data-act="aPosNo" data-u="${esc(x.uid)}">거절</button><button class="btn g" data-act="aPosOk" data-u="${esc(x.uid)}">받기</button></div></div>`;
  };
  return `${hd("포지션 변경 요청", back("#/ops"), { sub: "받으면 팀원 카드가 바로 바뀌어요" })}<div class="body" style="gap:16px">
    ${pend.length ? pend.map(card).join("") : empty("기다리는 요청이 없어요")}
    ${done.length ? `<section style="display:flex;flex-direction:column;margin-top:8px">${head2("지난 요청")}${done.slice(0, 20).map(({ x, r }) => `<div class="spread" style="min-height:56px;border-bottom:2px solid ${C.line};font-size:14px"><span>${esc(stampT(r.doneAt))} ${esc(x.name)} ${esc([r.from1, r.from2].filter(Boolean).join(" / ") || "")}${r.from1 ? " → " : ""}${esc([r.pos1, r.pos2].filter(Boolean).join(" / "))}</span><span class="tag ${r.status === "ok" ? "green" : "clay"}">${r.status === "ok" ? "받음" : "거절"}</span></div>`).join("")}</section>` : ""}
  </div>${nav("운영")}`;
}

/* ---------- 회비 관리 ---------- */
function duesRefs() {
  if (feeMode() === "monthly") return monthsList().slice(0, 3).reverse().map(m => ({ key: "m-" + m, label: mLabel(m) }));
  if (feeMode() === "per_game") return past().filter(isPlay).slice(0, 4).reverse().map(e => ({ key: "e-" + e.id, label: md(e.date), e }));
  return [];
}
function aDues() {
  const refs = duesRefs(); const fee = Number(S.settings.fee) || 0; const mode = feeMode();
  const sub = mode === "monthly" ? `한 달 ${won(fee)}` : mode === "per_game" ? `경기마다 ${won(fee)}` : "회비를 안 받아요";
  const right = `<button class="btn xs" data-act="aDuesSet" style="margin-right:4px">회비 설정</button>`;
  if (!refs.length) return `${hd("회비 관리", back("#/ops"), { sub, right })}<div class="body">${empty(mode === "none" ? "회비를 안 받는 팀이에요" : "아직 회비를 낼 경기가 없어요", "회비 설정에서 바꿀 수 있어요.")}</div>${nav("운영")}`;
  const ref = refs.find(r => r.key === AU.ref) || refs[refs.length - 1];
  const ps = (ref.e ? people().filter(x => cameTo(ref.e, x.uid)) : people()).sort((a, b) => (paidOf(ref.key, a.uid) ? 1 : 0) - (paidOf(ref.key, b.uid) ? 1 : 0) || (Number(a.p.num) || 999) - (Number(b.p.num) || 999));
  const paidN = ps.filter(x => paidOf(ref.key, x.uid)).length; const unpaid = ps.filter(x => !paidOf(ref.key, x.uid));
  return `${hd("회비 관리", back("#/ops"), { sub, right })}<div class="body" style="gap:16px">
    <div class="row" style="gap:8px;flex-wrap:wrap">${refs.map(r => `<button class="chip${r.key === ref.key ? " ob on" : ""}" data-act="aDuesRef" data-k="${esc(r.key)}" style="border-radius:999px;min-width:56px">${esc(r.label)}</button>`).join("")}</div>
    <div class="box" style="flex-direction:row;align-items:flex-end;justify-content:space-between;border-radius:12px"><span style="display:flex;flex-direction:column;gap:4px"><span style="font-size:12px;font-weight:700">모인 돈</span><b class="bc" style="font-size:40px;line-height:1">${won(paidN * fee)}</b></span><span style="display:flex;flex-direction:column;align-items:flex-end;font-size:12px">낸 사람 <span><b class="bc" style="font-size:20px">${paidN}</b> / ${ps.length}</span><span>안 낸 사람 ${unpaid.length}명</span></span></div>
    <div style="display:flex;flex-direction:column">${ps.map(x => { const p = paidOf(ref.key, x.uid); return `<div class="row" style="min-height:54px;border-bottom:2px solid ${C.line};gap:12px"><b class="bc" style="width:30px;font-size:18px">${esc(x.p.num || "-")}</b><span style="flex:1;font-size:16px">${esc(x.name)}${x.uid === S.uid ? " (나)" : ""}</span><button class="btn xs${p ? " g" : ""}" data-act="duesToggle" data-key="${esc(ref.key)}" data-u="${esc(x.uid)}" aria-pressed="${p}" style="min-width:64px">${p ? "냄" : "안 냄"}</button></div>`; }).join("") || `<span class="note">대상이 없어요</span>`}</div>
  </div>${unpaid.length ? `<div class="cta"><button class="btn o block" data-act="aDuesRemind" data-k="${esc(ref.key)}">안 낸 ${unpaid.length}명에게 알리기</button></div>` : ""}`;
}
function duesSetSheet() {
  const f = AU.mset; const ch = (k, v, l) => `<button type="button" class="chip${String(f[k]) === String(v) ? " on" : ""}" data-ms="${k}" data-v="${esc(v)}">${l}</button>`;
  sheet(`<h3>회비 설정</h3>
    <div class="fld"><span class="lb">회비</span><div class="chips">${ch("feeMode", "monthly", "월회비")}${ch("feeMode", "per_game", "경기마다")}${ch("feeMode", "none", "안 받음")}</div></div>
    ${f.feeMode !== "none" ? `<label class="fld"><span class="lb">금액</span><input class="inp" id="msFee" inputmode="numeric" value="${esc(f.fee)}" placeholder="예: 30000"></label>` : ""}
    ${f.feeMode === "monthly" ? `<div class="fld"><span class="lb">매달 언제까지</span><div class="chips">${["1", "5", "10", "25", "말일"].map(d => ch("dueDay", d, d === "말일" ? "말일" : d + "일")).join("")}</div></div>` : ""}
    <div class="fld"><span class="lb">받는 계좌</span><input class="inp" id="msBank" value="${esc(f.bank)}" placeholder="은행" maxlength="20"><input class="inp" id="msAcc" inputmode="numeric" data-bind="account" value="${esc(f.account)}" placeholder="계좌번호" maxlength="30"><input class="inp" id="msHolder" value="${esc(f.holder)}" placeholder="예금주" maxlength="20"></div>
    <button class="btn o block" id="msSave">저장하기</button><button class="btn block" data-act="closeSheet">닫기</button>`);
  const keep = () => { const g = id => ($(id) || {}).value; if ($("#msFee")) f.fee = g("#msFee"); f.bank = g("#msBank"); f.account = g("#msAcc"); f.holder = g("#msHolder"); };
  document.querySelectorAll("[data-ms]").forEach(b => b.onclick = () => { keep(); f[b.dataset.ms] = b.dataset.v; duesSetSheet(); });
  $("#msSave").onclick = async ev => {
    keep(); ev.target.disabled = true;
    try { await setDoc("team", "settings", { ...S.settings, feeMode: f.feeMode, fee: f.feeMode === "none" ? 0 : Number(String(f.fee || "").replace(/\D/g, "")) || 0, dueDay: f.feeMode === "monthly" ? f.dueDay || "5" : "", bank: { bank: String(f.bank || "").trim(), account: String(f.account || "").trim(), holder: String(f.holder || "").trim() } }); closeSheet(); await syncMyDues(); render(); toast("저장했어요"); } catch (err) { ev.target.disabled = false; fail(err); }
  };
}

/* ---------- 벌금 관리 ---------- */
function aFines() {
  const list = Object.entries(D("fines")).map(([id, f]) => ({ id, ...f })).sort((a, b) => (a.paid ? 1 : 0) - (b.paid ? 1 : 0) || String(b.date).localeCompare(String(a.date)));
  return `${hd("벌금 관리", back("#/ops"), { sub: "팀원이 내면 냄으로 체크해요", right: `<button class="btn o sm" data-act="aFineAdd" style="margin-right:4px">벌금 매기기</button>` })}<div class="body" style="gap:0">
    ${list.length ? list.map(f => { const e = S.events[f.eventId]; return `<div class="row" style="min-height:64px;border-bottom:2px solid ${C.line};gap:8px"><span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px"><span><b style="font-size:16px">${esc(nameOf(f.uid))}</b> <span style="font-size:14px">${esc(f.reason || "벌금")}</span></span><span class="note">${f.date ? esc(md(f.date)) : ""}${e ? " " + kindOf(e) : ""}</span></span><b class="bc" style="font-size:20px">${won(f.amount)}</b><button class="btn xs${f.paid ? " g" : ""}" data-act="fineToggle" data-id="${esc(f.id)}" aria-pressed="${!!f.paid}" style="min-width:60px">${f.paid ? "냄" : "안 냄"}</button></div>`; }).join("") : empty("매긴 벌금이 없어요")}
  </div>${nav("운영")}`;
}
function fineAddSheet() {
  const f = AU.fa; const rules = fineRulesOf(S.settings); const ps = people().sort((a, b) => (Number(a.p.num) || 999) - (Number(b.p.num) || 999));
  const evs = past().slice(0, 12); const r = rules[f.ri];
  sheet(`<h3>벌금 매기기</h3>
    <label class="fld"><span class="lb">누구</span>${sel("faU", [["", "골라 주세요"], ...ps.map(x => [x.uid, (x.p.num ? x.p.num + " " : "") + x.name])], f.u)}</label>
    <label class="fld"><span class="lb">언제</span>${sel("faE", [["", "경기 없이 (오늘)"], ...evs.map(e => [e.id, `${md(e.date)} ${kindOf(e)}`])], f.eid)}</label>
    <div class="fld"><span class="lb">무엇</span>${rules.length ? `<div class="grid3">${rules.map((x, i) => `<button type="button" class="box${i === f.ri ? "" : ""}" data-fr="${i}" aria-pressed="${i === f.ri}" style="align-items:center;gap:4px;padding:8px 8px;border-radius:12px;text-align:center;${i === f.ri ? `background:${C.orange};box-shadow:4px 4px 0 ${C.ink}` : ""}"><b style="font-size:14px">${esc(x.label)}</b><span class="bc" style="font-size:16px">${won(x.amount)}</span></button>`).join("")}</div>` : `<span class="note">수칙에 벌금이 없어요. 팀 탭의 수칙과 벌금에서 먼저 더해 주세요.</span>`}</div>
    <span class="note">매기면 그 팀원의 내가 낼 돈에 바로 올라가고 알림이 가요.</span>
    <button class="btn o block" id="faGo" ${f.u && r ? "" : "disabled"}>${f.u && r ? `${esc(nameOf(f.u))}에게 ${won(r.amount)} 매기기` : "누구와 무엇을 골라 주세요"}</button>`);
  $("#faU").onchange = ev => { f.u = ev.target.value; fineAddSheet(); };
  $("#faE").onchange = ev => { f.eid = ev.target.value; fineAddSheet(); };
  document.querySelectorAll("[data-fr]").forEach(b => b.onclick = () => { f.ri = Number(b.dataset.fr); fineAddSheet(); });
  $("#faGo").onclick = async ev => {
    if (!f.u || !r) return; ev.target.disabled = true; const e = S.events[f.eid];
    try { await setDoc("fines", uid36("f"), { uid: f.u, date: e ? e.date : todayStr(), eventId: e ? e.id : "", reason: r.label, amount: Number(r.amount) || 0, paid: false, paidAt: "", at: new Date().toISOString(), by: S.uid }); await syncMyDues([f.u]); closeSheet(); render(); toast(`${nameOf(f.u)}에게 벌금 ${won(r.amount)}을 매겼어요`); } catch (err) { ev.target.disabled = false; fail(err); }
  };
}

/* ---------- 기본 운영 규칙 (Admin만 바꿈) ---------- */
const h12 = t => { const [h] = String(t || "21:00").split(":").map(Number); return { ap: h < 12 ? "am" : "pm", h: h % 12 || 12 }; };
const to24 = (ap, h) => { const n = Math.min(12, Math.max(1, Number(h) || 12)); return ap === "am" ? (n === 12 ? 0 : n) : (n === 12 ? 12 : n + 12); };
function policyInit() { const st = S.settings || {}; const v = h12(pol("voteTime")); return { pCap: String(pol("cap")), pScrimMin: String(pol("scrimMin")), pScrimDays: String(pol("scrimDays")), pVoteAp: v.ap, pVoteH: String(v.h), pCheck: String(pol("checkBefore")), fineFrom: ["day", "custom"].includes(st.fineFrom) ? st.fineFrom : "close", fineDays: String(Number(st.fineDays) || 1), fineAp: st.fineAp === "am" ? "am" : "pm", fineHour: String(Number(st.fineHour) || 6) }; }
function aPolicy() {
  const f = S.form; const dis = !owner(); const apBtn = (k, v) => `<button type="button" class="chip${f[k] === v ? " on" : ""}" data-act="aPick" data-k="${k}" data-v="${v}" ${dis ? "disabled" : ""} style="min-height:44px;padding:0 8px">${v === "am" ? "오전" : "오후"}</button>`;
  const vt = `${f.pVoteAp === "am" ? "오전" : "오후"} ${Number(f.pVoteH) || 9}시`;
  const fineNote = f.fineFrom === "day" ? "경기 당일 0시부터" : f.fineFrom === "custom" ? `경기 ${Number(f.fineDays) || 1}일 전 ${f.fineAp === "am" ? "오전" : "오후"} ${Number(f.fineHour) || 6}시부터` : `투표 마감(경기 전날 ${vt})부터`;
  const fb = (v, l) => `<button type="button" class="btn sm${f.fineFrom === v ? "" : ""}" data-act="aPick" data-k="fineFrom" data-v="${v}" aria-pressed="${f.fineFrom === v}" ${dis ? "disabled" : ""} style="padding:0 8px;font-size:12px${f.fineFrom === v ? `;background:${C.blue}` : ""}">${l}</button>`;
  const rowF = (label, inner) => `<div style="display:flex;flex-direction:column;gap:8px;border-bottom:2px solid ${C.line};padding:12px 0"><b style="font-size:14px">${label}</b><div class="row" style="gap:8px;font-size:16px;flex-wrap:wrap">${inner}</div></div>`;
  return `${hd("기본 운영 규칙", back("#/ops"), { sub: "Admin만 바꿀 수 있어요" })}<div class="body" style="gap:0">
    <div style="background:${C.bg};border:2px dashed ${C.ink};border-radius:8px;padding:12px 16px;font-size:12px;line-height:1.6;margin-bottom:8px">팀을 만들 때 정한 값이에요. 바꾸면 그 뒤에 올리는 일정부터 적용돼요.${dis ? " 운영진은 볼 수만 있어요." : ""}</div>
    <div style="border-top:2px solid ${C.ink}"></div>
    ${rowF("정원", `${numInp("pCap", f.pCap, dis)}<span>명, 넘으면 대기</span>`)}
    ${rowF("내전 기준 인원", `<span>참석과 대기 합쳐</span>${numInp("pScrimMin", f.pScrimMin, dis)}<span>명</span>`)}
    ${rowF("내전 정하는 날", `<span>경기</span>${numInp("pScrimDays", f.pScrimDays, dis)}<span>일 전까지 유지되면</span>`)}
    ${rowF("투표 마감", `<span>경기 전날</span>${apBtn("pVoteAp", "am")}${apBtn("pVoteAp", "pm")}${numInp("pVoteH", f.pVoteH, dis)}<span>시</span>`)}
    ${rowF("출석 부르는 시간", `<span>시작</span>${numInp("pCheck", f.pCheck, dis)}<span>분 전</span>`)}
    <div style="display:flex;flex-direction:column;gap:8px;padding:12px 0"><b style="font-size:14px">불참 변경 벌금은 언제부터</b>
      <div class="grid3">${fb("close", "투표 마감 뒤")}${fb("day", "경기 당일")}${fb("custom", "직접 정하기")}</div>
      ${f.fineFrom === "custom" ? `<div class="row" style="gap:8px;flex-wrap:wrap;font-size:16px"><span>경기</span>${numInp("fineDays", f.fineDays, dis, 56)}<span>일 전</span>${apBtn("fineAp", "am")}${apBtn("fineAp", "pm")}${numInp("fineHour", f.fineHour, dis, 56)}<span>시</span></div>` : ""}
      <span class="note">${fineNote} 참석이나 늦참에서 불참으로 바꾸면 수칙의 불참 벌금이 붙어요. 투표 마감보다 늦을 수는 없어요.</span></div>
  </div>${dis ? nav("운영") : `<div class="cta"><button class="btn o block" data-act="aPolicySave">저장하기</button></div>`}`;
}

/* ---------- 팀 설정 ---------- */
function aSettings() {
  const f = S.form; const own = owner(); const ap = f.joinApproval !== false;
  const admins = S.members.filter(m => m.role === "owner" || m.role === "admin").sort((a, b) => (a.role === "owner" ? 0 : 1) - (b.role === "owner" ? 0 : 1));
  const link = inviteUrl();
  return `${hd("팀 설정", back("#/ops"), { sub: "Admin만 바꿀 수 있어요" })}<div class="body">
    <div class="box blue" style="flex-direction:row;align-items:center;gap:16px;border-radius:18px">${teamLogo(52)}<label style="flex:1;display:flex;flex-direction:column;gap:4px;min-width:0"><span style="font-size:12px;font-weight:700">팀 이름</span>${own ? `<input class="inp" data-bind="tname" value="${esc(f.tname || "")}" maxlength="40" style="height:46px;font-weight:700;font-size:18px">` : `<b class="bh" style="font-size:24px">${esc(S.team.name)}</b>`}</label></div>
    <div class="spread" style="border-bottom:2px solid ${C.line};padding-bottom:16px"><b style="font-size:16px">종목</b><span style="font-size:16px">${sport() === "soccer" ? "축구팀" : "풋살팀"} <span class="note">만든 뒤에는 바꿀 수 없어요</span></span></div>
    <div class="fld"><b style="font-size:16px">초대 링크</b><div class="box" style="flex-direction:row;align-items:center;gap:8px;padding:8px 8px 8px 16px;border-radius:12px"><span class="bc" style="flex:1;min-width:0;font-size:16px;word-break:break-all">${esc(link.replace(/^https?:\/\//, "") || "링크를 만드는 중이에요")}</span><button class="btn sm" data-act="copyLink">복사</button></div><span class="note">${ap ? "링크로 들어온 사람은 가입 신청을 남기고, 운영진이 받으면 팀원이 돼요." : "링크로 들어온 사람은 바로 팀원으로 시작해요."}</span></div>
    <button type="button" class="row" data-act="aJoinAp" aria-pressed="${ap}" ${own ? "" : "disabled"} style="width:100%;border:0;border-top:2px solid ${C.ink};background:transparent;padding:16px 0 0;text-align:left;gap:12px"><span style="flex:1;display:flex;flex-direction:column;gap:4px"><b style="font-size:16px">가입 승인제</b><span class="note">${ap ? "켜짐: 링크로 들어와도 운영진이 받아야 팀원이 돼요" : "꺼짐: 링크로 들어오면 바로 팀원이 돼요"}</span></span>${sw(ap)}</button>
    <section style="display:flex;flex-direction:column">${head2("운영진", `<a href="#/members" style="font-size:12px">팀원에서 정하기</a>`)}${admins.map(m => { const p = profileOf(m.user_id) || {}; return `<div class="row" style="min-height:50px;border-bottom:2px solid ${C.line};gap:12px"><b class="bc" style="width:28px;font-size:18px">${esc(p.num || "-")}</b><span style="flex:1">${esc(nameOf(m.user_id))}${m.user_id === S.uid ? " (나)" : ""}</span><span class="tag ${m.role === "owner" ? "blue" : "gray"}">${ROLE[m.role]}</span></div>`; }).join("")}
      <span class="note" style="padding-top:8px">Admin은 넘길 수 없어요. 팀을 나갈 때만 운영진 중에서 다음 Admin을 정해요.</span></section>
    ${own ? `<button type="button" class="box" data-act="aTeamOut" style="flex-direction:row;align-items:center;gap:12px;border-radius:14px;text-align:left"><span class="ic clay" aria-hidden="true">${IC.bin}</span><b style="flex:1;color:#8C3B28">팀 지우기, 나가기</b>${IC.chev}</button>` : ""}
  </div>${own ? `<div class="cta"><button class="btn o block" data-act="aSettingsSave">저장하기</button></div>` : nav("운영")}`;
}
function teamOutSheet() {
  const ads = S.members.filter(m => m.role === "admin"); if (!ads.some(m => m.user_id === AU.next)) AU.next = ads[0] ? ads[0].user_id : "";
  const tab = (k, l) => `<button type="button" class="btn sm" data-to="${k}" aria-pressed="${AU.out === k}" style="font-size:12px;padding:0 8px${AU.out === k ? `;background:${C.ink};color:${C.bg}` : ""}">${l}</button>`;
  const body = AU.out === "leave"
    ? `<span style="font-size:14px;line-height:1.6">팀은 그대로 남고 나만 나가요. 다음 Admin은 운영진 중에서만 정할 수 있어요.</span>${ads.length ? `<label class="fld"><span class="lb">다음 Admin</span>${sel("toNext", ads.map(m => [m.user_id, `${numOf(m.user_id) ? numOf(m.user_id) + " " : ""}${nameOf(m.user_id)} (운영진)`]), AU.next)}</label><button class="btn block" id="toGo" style="background:${C.blue}">${esc(nameOf(AU.next))}에게 맡기고 나가기</button>` : `<div class="err">운영진이 없어요. 팀원 관리에서 먼저 운영진을 정해 주세요.</div>`}`
    : `<span style="font-size:14px;line-height:1.6">매니볼에 평가를 남기면 팀을 지울 수 있어요. 일정, 참석, 회비, 기록, 팀원이 모두 지워지고 되돌릴 수 없어요.</span><label class="fld"><span class="lb">평가</span><textarea class="inp" id="toBody" maxlength="1000" placeholder="예: 팀이 해체돼서 지워요. 회비 화면은 편했어요"></textarea></label><button class="btn c block" id="toDel">평가 남기고 팀 지우기</button>`;
  sheet(`<h3>${esc(S.team.name)}를 어떻게 할까요?</h3><div class="grid2">${tab("leave", "다음 Admin 정하고 나가기")}${tab("delete", "평가 남기고 팀 지우기")}</div>${body}<button class="btn block" data-act="closeSheet">닫기</button>`);
  document.querySelectorAll("[data-to]").forEach(b => b.onclick = () => { AU.out = b.dataset.to; teamOutSheet(); });
  if ($("#toNext")) $("#toNext").onchange = ev => { AU.next = ev.target.value; teamOutSheet(); };
  if ($("#toGo")) $("#toGo").onclick = () => { const u = AU.next; if (!u) return; confirmBox(`${nameOf(u)}에게 맡기고 나갈까요?`, `${nameOf(u)} 님이 다음 Admin이 되고, 나는 ${S.team.name}에서 나가요. 다시 들어오려면 초대 링크가 필요해요. 되돌릴 수 없어요.`, "맡기고 나가기", async () => {
    const { error } = await sb.rpc("leave_team_as_owner", { p_team: S.tid, p_next: u }); if (error) { fail(error); return; }
    ls.set("mb-team", null); toast("팀에서 나왔어요"); setTimeout(() => location.replace(APP), 600);
  }, true); };
  if ($("#toDel")) $("#toDel").onclick = () => { const body = String(($("#toBody") || {}).value || "").trim(); if (body.length < 2) { toast("평가 내용을 적어 주세요"); return; }
    confirmBox("팀을 지울까요?", `${S.team.name}의 일정, 참석, 회비, 기록, 팀원이 모두 사라져요. 되돌릴 수 없어요.`, "지우기", async () => {
      const { error } = await sb.rpc("delete_team_with_review", { p_team: S.tid, p_body: body }); if (error) { fail(error); return; }
      ls.set("mb-team", null); toast("팀을 지웠어요. 평가해 주셔서 고마워요"); setTimeout(() => location.replace(APP), 900);
    }, true); };
}

/* ===================== 팀 탭 (운영진) ===================== */
const GCODE = { 골키퍼: "GK", 수비: "DF", 미드필더: "MF", 공격: "FW" };
function aMembers() {
  const n = S.members.length;
  return `${hd("팀원 관리", back("#/team"), { sub: `${n}명, 눌러서 관리해요` })}<div class="body" style="gap:16px">
    ${memberGroups().map(gr => `<section style="display:flex;flex-direction:column" aria-label="${esc(gr.g)}"><span class="spread" style="align-items:baseline;border-bottom:2px solid ${C.ink};padding-bottom:8px"><b class="bh" style="font-size:20px">${GCODE[gr.g] ? GCODE[gr.g] + " " : ""}${esc(gr.g)}</b><span style="font-size:12px">${gr.xs.length}명</span></span>
      ${gr.xs.map(x => `<button type="button" class="row" data-act="aMember" data-u="${esc(x.uid)}" style="min-height:56px;border:0;border-bottom:2px solid ${C.line};background:transparent;gap:12px;text-align:left;padding:0"><b class="bc" style="flex:none;width:34px;font-size:24px;text-align:center">${esc(x.p.num || "-")}</b><span style="flex:1;font-size:16px;font-weight:700">${esc(x.name)}${x.uid === S.uid ? ` <span style="font-weight:500;color:${C.sub};font-size:12px">나</span>` : ""} ${x.role !== "member" ? `<span class="tag ${x.role === "owner" ? "blue" : "gray"}" style="font-size:12px">${ROLE[x.role]}</span>` : ""}</span><span class="bc" style="font-size:16px">${esc(posTxt(x.p))}</span></button>`).join("")}</section>`).join("") || empty("아직 팀원이 없어요")}
  </div>${nav("팀")}`;
}
function memberSheet(u) {
  const x = people().find(p => p.uid === u); if (!x) return;
  const me = u === S.uid; const roleBtn = owner() && !me && x.role !== "owner";
  sheet(`<div class="row" style="gap:12px"><b class="bc" style="font-size:44px;line-height:1">${esc(x.p.num || "")}</b><span style="display:flex;flex-direction:column;gap:4px"><b class="bh" style="font-size:24px">${esc(x.name)}</b><span style="font-size:12px">${esc(posTxt(x.p) || "포지션 미정")} ${ROLE[x.role]}</span></span></div>
    ${me ? `<span class="note">나예요. 내 포지션은 홈에서 바꿔요.</span>` : ""}
    ${roleBtn ? (x.role === "admin" ? `<button class="box" data-act="setRole" data-u="${esc(u)}" data-v="member" style="flex-direction:row;align-items:center;justify-content:space-between;border-radius:12px"><b>운영진에서 빼기</b><span class="tag blue">Admin</span></button>` : `<button class="box" data-act="setRole" data-u="${esc(u)}" data-v="admin" style="flex-direction:row;align-items:center;justify-content:space-between;border-radius:12px"><b>운영진으로 정하기</b><span class="tag blue">Admin</span></button>`) : ""}
    ${canKick({ uid: u, role: x.role }) ? `<button class="box clay" data-act="aKick" data-u="${esc(u)}" style="border-radius:12px;text-align:left"><b>팀에서 내보내기</b></button>` : ""}
    <span class="note">운영진은 팀원만 내보낼 수 있어요. 운영진을 정하고 빼는 일과 운영진을 내보내는 일은 Admin만 해요.</span>
    <button class="btn block" data-act="closeSheet">닫기</button>`);
}

/* ---------- 공지 쓰기, 고치기 ---------- */
function aNoticeForm(id) {
  const f = S.form; const edit = !!id;
  const tg = (k, t, s) => `<button type="button" class="row" data-act="aTog" data-k="${k}" aria-pressed="${!!f[k]}" style="width:100%;border:0;border-bottom:2px solid ${C.line};background:transparent;padding:12px 0;gap:12px;text-align:left"><span style="flex:1;display:flex;flex-direction:column;gap:4px"><span style="font-size:16px">${t}</span><span class="note">${s}</span></span>${sw(!!f[k])}</button>`;
  return `${hd(edit ? "공지 고치기" : "공지 쓰기", back("#/notices"), { sub: edit ? "고친 내용은 바로 보여요" : "올리면 팀원에게 보여요" })}<div class="body" style="gap:16px">
    <label class="fld"><span class="lb">제목</span><input class="inp" data-bind="title" value="${esc(f.title || "")}" maxlength="60" placeholder="한 줄로 적어요"></label>
    <label class="fld"><span class="lb">내용</span><textarea class="inp" data-bind="body" maxlength="3000" style="min-height:240px" placeholder="팀원에게 알릴 내용">${esc(f.body || "")}</textarea></label>
    <div style="border-top:2px solid ${C.ink}">${tg("pinned", "맨 위에 고정", "고정 공지는 하나만 둘 수 있어요")}${edit ? "" : tg("notify", "팀원에게 알림 보내기", "끄면 공지 목록에만 올라가요")}</div>
  </div><div class="cta"><button class="btn o block" id="nSave" data-act="aNoticeSave" data-id="${esc(id || "")}" ${String(f.title || "").trim() ? "" : "disabled"}>${edit ? "고친 내용 저장" : "올리기"}</button></div>`;
}

/* ---------- 수칙과 벌금 고치기 ---------- */
function aRulesEdit() {
  const f = S.form;
  return `${hd("수칙과 벌금 고치기", back("#/team"), { sub: "고치면 팀원에게 알림이 가요" })}<div class="body" style="gap:16px">
    <label class="fld"><span class="lb">팀 수칙</span><span class="note" style="margin-top:-4px">"1. 2."처럼 번호를 직접 적어요</span><textarea class="inp" data-bind="rulesText" style="min-height:220px" maxlength="2000" placeholder="1. 경기 10분 전까지 와요">${esc(f.rulesText || "")}</textarea></label>
    <section style="display:flex;flex-direction:column;gap:8px">${head2("벌금")}
      ${(f.rules || []).map((r, i) => `<div style="display:grid;grid-template-columns:1fr 104px 46px;gap:8px"><input class="inp" data-rule="${i}" data-f="label" value="${esc(r.label)}" placeholder="예: 지각" maxlength="40" aria-label="벌금 ${i + 1} 이름"><input class="inp" data-rule="${i}" data-f="amount" value="${esc(r.amount || "")}" inputmode="numeric" placeholder="금액" aria-label="벌금 ${i + 1} 금액" style="text-align:right;font-weight:700"><button type="button" class="btn c" data-act="ruleDel" data-i="${i}" aria-label="벌금 ${i + 1} 지우기" style="padding:0;height:52px">✕</button></div>`).join("")}
      <button type="button" data-act="ruleAdd" style="height:52px;border:2px dashed ${C.ink};border-radius:12px;background:transparent;font-weight:700;font-size:16px">벌금 항목 더하기</button>
      <span class="note">지각, 말없이 불참은 현장 출석에서, 불참 변경 벌금은 팀원이 기준 시각 뒤에 불참으로 바꿀 때 이 금액으로 붙어요. 불참 벌금이 언제부터 붙는지 같은 기본 규칙은 운영 탭에서 Admin이 바꿔요.</span></section>
  </div><div class="cta"><button class="btn o block" data-act="aRulesSave">저장하기</button></div>`;
}

/* ===================== 기록 (운영진) ===================== */
function aSeason() {
  const y = todayStr().slice(0, 4); const evs = seasonEvents(y).filter(isPlay); const r = teamRecord(evs); const st = myStats(S.uid, y);
  const mine = evs.slice().reverse();
  const lateVote = (e, u) => ((((S.rsvp[u] || {}).ev || {})[e.id]) || {}).s === "late";
  const cnt = u => { let a = 0, l = 0, t = 0, n = 0; evs.forEach(e => { if (!cameTo(e, u)) { n++; return; } if ((e.check || {})[u] === "late") t++; else if (lateVote(e, u)) l++; else a++; }); return { a, l, t, n }; };
  const my = cnt(S.uid);
  const cn = (v, l, c, ex = "") => `<span style="display:flex;flex-direction:column;gap:4px"><b class="bc" style="font-size:24px;line-height:1">${v}</b><span style="display:inline-flex;align-items:center;gap:4px;font-size:12px"><span style="width:9px;height:9px;background:${c};${ex}"></span>${l}</span></span>`;
  const ps = people().sort((a, b) => (Number(a.p.num) || 999) - (Number(b.p.num) || 999));
  return `${hd(y + " 시즌", back("#/records"), { sub: "내전은 팀 성적에서 빼고 셌어요" })}<div class="body" style="gap:16px">
    <div class="spread" style="border-top:2px solid ${C.ink};border-bottom:2px solid ${C.line};padding:12px 0"><span style="font-size:12px;font-weight:700">팀 성적</span><span class="bc" style="display:flex;align-items:baseline;gap:8px"><span style="font-size:32px">${r.w}<small style="font-size:16px">승</small> ${r.d}<small style="font-size:16px">무</small> ${r.l}<small style="font-size:16px">패</small></span><span style="font-size:16px;color:${C.sub}">득 ${r.gf}  실 ${r.ga}</span></span></div>
    <div class="box gray" style="border-radius:18px;gap:12px"><span class="spread" style="align-items:baseline"><b style="font-size:16px">내 출석</b><span style="font-size:12px">${st.n}번 중 <b class="bc" style="font-size:20px">${st.mine}</b>번 왔어요</span></span>
      ${mine.length ? `<div style="display:grid;grid-template-columns:repeat(${Math.min(8, mine.length)},minmax(0,1fr));gap:4px;border-top:2px dashed rgba(18,17,16,.35);padding-top:12px">${mine.slice(-8).map(e => { const c = cameTo(e, S.uid); const late = (e.check || {})[S.uid] === "late" || (c && lateVote(e, S.uid)); return `<span style="display:flex;flex-direction:column;align-items:center;gap:4px"><span style="width:22px;height:22px;border-radius:50%;border:2px solid ${C.ink};background:${c ? (late ? C.orange : C.green) : C.bg}"></span><span class="bc" style="font-size:12px;font-weight:600">${md(e.date)}</span></span>`; }).join("")}</div>` : ""}
      <div class="grid4" style="border-top:1px solid rgba(18,17,16,.2);padding-top:8px;gap:0">${cn(my.a, "참석", C.green)}${cn(my.l, "늦참", C.orange)}${cn(my.t, "지각", C.bg, `border:2px solid ${C.ink};box-sizing:border-box`)}${cn(my.n, "불참", C.clay)}</div></div>
    <section style="display:flex;flex-direction:column">${head2("팀원 출석", `<span class="note">등번호 순, 운영진만 보여요</span>`)}
      <div style="display:grid;grid-template-columns:28px 1fr repeat(4,38px);gap:4px;font-size:12px;color:${C.sub};padding:8px 0;border-bottom:2px solid ${C.line}"><span></span><span>이름</span><span style="text-align:center">참석</span><span style="text-align:center">늦참</span><span style="text-align:center">지각</span><span style="text-align:center">불참</span></div>
      ${ps.map(x => { const c = cnt(x.uid); return `<div style="display:grid;grid-template-columns:28px 1fr repeat(4,38px);gap:4px;align-items:center;min-height:44px;border-bottom:2px solid ${C.line};font-size:16px"><b class="bc">${esc(x.p.num || "-")}</b><span>${esc(x.name)}</span>${[c.a, c.l, c.t, c.n].map(v => `<b class="bc" style="text-align:center;font-size:16px">${v}</b>`).join("")}</div>`; }).join("")}
    </section>
  </div>${nav("기록")}`;
}
function aResult(id) {
  const e = S.events[id]; if (!e) return null; const f = S.form; const scrim = e.type === "scrim";
  const home = scrim ? "A팀" : S.team.name; const away = scrim ? "B팀" : e.opponent || "상대";
  const came = people().filter(x => cameTo(e, x.uid)); const pool = came.length ? came : people();
  const opts = [["", "모름"], ...pool.map(x => [x.uid, x.name]), ...guestsOf(e).map(g => ["g:" + g.id, g.name + " (용병)"])];
  const aopts = [["", "도움 없음"], ...opts.slice(1)];
  const goals = f.goals || []; const need = scrim ? (Number(f.us) || 0) + (Number(f.them) || 0) : Number(f.us) || 0;
  const sideOk = !scrim || (goals.filter(g => g.side === "A").length === (Number(f.us) || 0) && goals.filter(g => g.side === "B").length === (Number(f.them) || 0));
  const ok = goals.length === need && sideOk;
  const step = (k, plus) => `<button type="button" class="btn sm" data-act="aScore" data-k="${k}" data-d="${plus ? 1 : -1}" aria-label="${plus ? "더하기" : "빼기"}" style="width:40px;padding:0;font-size:20px${plus ? `;background:${k === "us" ? C.blue : C.gray}` : ""}">${plus ? "+" : "−"}</button>`;
  return `${hd("결과 입력", back("#/game/" + id), { sub: `${md(e.date)} ${wd(e.date)} ${vsText(e)}` })}<div class="body" style="gap:16px">
    <div class="box gray" style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;border-radius:18px;padding:16px 12px"><b style="font-size:16px;text-align:center">${esc(home)}</b><b class="bc" style="font-size:56px;line-height:1">${Number(f.us) || 0} : ${Number(f.them) || 0}</b><b style="font-size:16px;text-align:center">${esc(away)}</b></div>
    <section style="display:flex;flex-direction:column;gap:8px">${head2("최종 점수")}
      <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px"><span style="display:flex;flex-direction:column;align-items:center;gap:8px"><span style="font-size:12px;font-weight:700">${esc(home)}</span><span class="row">${step("us", false)}<b class="bc" style="width:34px;text-align:center;font-size:32px">${Number(f.us) || 0}</b>${step("us", true)}</span></span><b>:</b><span style="display:flex;flex-direction:column;align-items:center;gap:8px"><span style="font-size:12px;font-weight:700">${esc(away)}</span><span class="row">${step("them", false)}<b class="bc" style="width:34px;text-align:center;font-size:32px">${Number(f.them) || 0}</b>${step("them", true)}</span></span></div></section>
    <section style="display:flex;flex-direction:column;gap:8px">${head2(scrim ? "골" : "우리 골", ok ? `<span class="tag green">점수와 골 기록이 맞아요</span>` : `<span class="tag orange">골 기록 ${goals.length}개, 점수 ${need}골</span>`)}
      ${goals.map((g, i) => `<div class="box" style="border-radius:14px;gap:8px"><span class="spread"><b style="font-size:14px">${i + 1}번째 골</b><button type="button" class="lnk" data-act="aGoalDel" data-i="${i}" style="min-height:32px;padding:0;color:#8C3B28;font-size:12px">빼기</button></span>
        <div class="grid2"><label class="fld"><span style="font-size:12px;font-weight:700">골</span>${sel("g" + i, opts, g.uid || "", `data-goal="${i}" data-gf="uid"`)}</label><label class="fld"><span style="font-size:12px;font-weight:700">도움</span>${sel("a" + i, aopts, g.assist || "", `data-goal="${i}" data-gf="assist"`)}</label></div>
        ${scrim ? `<div class="grid2">${["A", "B"].map(s => `<button type="button" class="chip${g.side === s ? " on" : ""}" data-act="aGoalSide" data-i="${i}" data-v="${s}">${s}팀 골</button>`).join("")}</div>` : ""}</div>`).join("")}
      <button type="button" data-act="aGoalAdd" style="height:48px;border:2px dashed ${C.ink};border-radius:12px;background:transparent;font-weight:700">골 더하기</button>
      <span class="note">저장하면 이날 온 사람에게 MOM 투표가 열려요. 투표는 다음 날 12시에 마감돼요.</span></section>
  </div><div class="cta"><button class="btn o block" data-act="aSaveResult" data-eid="${esc(e.id)}">저장하기</button></div>`;
}

/* ===================== 일정 (운영진) ===================== */
function schedSheet() {
  const ready = Object.values(S.events).filter(scrimReady);
  const row = (h, icon, tone, t, s, tag, dis) => `<button type="button" class="box" ${dis ? "disabled" : `data-act="goTo" data-h="${esc(h)}"`} style="flex-direction:row;align-items:center;gap:12px;border-radius:14px;text-align:left;${dis ? `opacity:.55;border-style:dashed` : ""}"><span class="ic ${tone}" aria-hidden="true">${icon}</span><span style="flex:1;display:flex;flex-direction:column;gap:4px"><b style="font-size:16px">${t}</b><span style="font-size:12px">${s}</span></span>${tag || IC.chev}</button>`;
  sheet(`<div class="spread"><h3>일정 관리</h3><span class="note">운영진만 보여요</span></div>
    ${row("#/new", IC.plus, "orange", "일정 올리기", "올리면 팀원에게 알림이 가요")}
    ${ready.length ? ready.map(e => { const a = att(e); return row("#/scrim/" + e.id, IC.split, "green", "내전 정하기", `${md(e.date)} ${wd(e.date)} 상대 미정, ${a.in + a.wait.length}명 모였어요`, `<span class="tag orange">결정 필요</span>`); }).join("") : row("", IC.split, "green", "내전 정하기", `상대 미정 일정에 ${pol("scrimMin")}명이 모이면 열려요`, "", true)}
    <span class="note">한 경기의 명단, 라인업, 출석, 용병은 그 경기를 열고 관리를 눌러요.</span>
    <button class="btn block" data-act="closeSheet">닫기</button>`);
}
function toolCard(href, act, icon, tone, t, s, extra = "") {
  const inner = `<span class="ic ${tone}" aria-hidden="true" style="width:34px;height:34px;border-radius:10px">${icon}</span><span style="display:flex;flex-direction:column;gap:4px;min-width:0"><b style="font-size:16px">${t}</b><span style="font-size:12px;color:${C.sub};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s}</span></span>`;
  const st = `flex-direction:row;align-items:center;gap:8px;padding:8px 12px;border-radius:12px;text-decoration:none;text-align:left;min-height:60px`;
  return href ? `<a class="box" href="${esc(href)}" style="${st}">${inner}</a>` : `<button type="button" class="box" data-act="${act}" ${extra} style="${st}">${inner}</button>`;
}
const CX = { eid: "", r: "", t: "" };
const CX_REASONS = ["인원 부족", "날씨", "구장 사정", "상대 팀 사정", "그 밖의 사유"];
function cancelSheet() {
  const e = S.events[CX.eid]; if (!e) return; const a = att(e);
  sheet(`<h3>${kindOf(e)} 취소하기</h3><span style="font-size:14px">${md(e.date)} ${wd(e.date)} ${esc(e.time || "")} ${esc(evName(e))}, ${esc(e.place || "장소 미정")}</span>
    <div class="spread" style="border:2px solid ${C.ink};border-radius:12px;background:${C.white};padding:12px 16px"><span style="font-size:14px">지금 참석</span><b class="bc" style="font-size:24px">${a.in}${a.cap ? ` <span style="font-size:16px;color:${C.sub}">/ 정원 ${a.cap}</span>` : "명"}</b></div>
    <b style="font-size:14px">취소 사유</b>
    <div class="chips">${CX_REASONS.map(r => `<button type="button" class="chip${CX.r === r ? " on" : ""}" data-act="aCancelPick" data-r="${esc(r)}" aria-pressed="${CX.r === r}" style="font-size:14px">${esc(r)}</button>`).join("")}</div>
    <textarea id="cxText" class="inp" maxlength="300" placeholder="팀원에게 보일 말을 적어요" aria-label="팀원에게 보일 말" style="min-height:88px">${esc(CX.t)}</textarea>
    <span class="note">팀원 ${people().length}명 모두에게 알림이 가요. 이 일정의 불참 벌금은 붙지 않고, 투표는 닫혀요.</span>
    <button class="btn block" data-act="aCancelNext" style="background:${CX.r ? C.danger : "#B9AFA4"};color:${C.bg}">${kindOf(e)} 취소하고 알리기</button>
    <button class="lnk" data-act="closeSheet" style="align-self:center">그만두기</button>`);
}
function aManage(id) {
  const e = S.events[id]; if (!e) return null; const a = att(e); const play = isPlay(e);
  const pend = guestReqs(e).filter(g => g.status === "req").length; const ck = Object.values(e.check || {}).filter(Boolean).length;
  const lu = (e.lineupAt || e.lineupOld) ? "알렸어요" : e.lineup && Object.keys(e.lineup).length ? "아직 안 알림" : "아직 안 짰어요";
  const cx = isCanceled(e);
  const cxIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${C.ink}" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M5.6 5.6l12.8 12.8"></path></svg>`;
  return `${hd("일정 관리", back("#/event/" + id), { sub: evLabel(e) })}<div class="body tight">
    ${bigTicket(e, a)}
    ${cx ? cancelCard(e, a) : ""}
    ${strip(a)}
    ${scrimReady(e) ? `<a class="box orange" href="#/scrim/${esc(id)}" style="flex-direction:row;align-items:center;gap:8px;border-radius:12px;background:${C.orange};text-decoration:none"><b style="flex:1">내전으로 할지 정해 주세요</b>${IC.chev}</a>` : ""}
    <section style="display:flex;flex-direction:column;gap:8px;margin-top:4px"><span class="row" style="border-bottom:2px solid ${C.ink};padding-bottom:8px;gap:8px"><b style="font-size:16px">운영진</b><span class="note">팀원 화면에는 보이지 않아요</span></span>
      <div class="grid2">
        ${toolCard("#/roster/" + id, "", IC.list, "blue", "참석 명단", `미응답 ${a.none.length}명`)}
        ${play && !cx ? toolCard("#/lineup/" + id, "", IC.field, "green", "라인업 짜기", lu) : ""}
        ${cx ? "" : toolCard("#/check/" + id, "", IC.check, "orange", "현장 출석", ck ? `${ck}명 체크함` : `경기 날 ${checkTime(e) || "-"}`)}
        ${e.type !== "training" && !cx ? toolCard("#/merc/" + id, "", IC.merc, "pink", "용병 받기", e.guestOpen ? `받는 중${pend ? ", 신청 " + pend : ""}` : pend ? `신청 ${pend}` : "안 받음") : ""}
        ${play && started(e) && !cx ? toolCard("#/result/" + id, "", IC.ball, "pink", "결과 넣기", e.score ? `${e.score.us}:${e.score.them}` : "아직 안 넣었어요") : ""}
        ${toolCard("#/edit/" + id, "", IC.pen, "", "일정 고치기", "시간, 장소, 정원")}
        ${started(e) && !cx ? "" : toolCard("", cx ? "aUncancel" : "aCancelEv", cxIcon, "", cx ? "취소 되돌리기" : "경기 취소", cx ? "시작 전까지 다시 열 수 있어요" : "사유를 남기고 알려요", `data-eid="${esc(id)}"`)}
        ${toolCard("", "aDelEvent", IC.trash, "clay", "일정 지우기", "되돌릴 수 없어요", `data-eid="${esc(id)}"`)}
      </div></section>
  </div>${nav("일정")}`;
}
const RF = [["yes", "참석"], ["late", "늦참"], ["wait", "대기"], ["no", "불참"], ["none", "미응답"]];
const REMIND_GAP = 3600e3;
export const remindLeft = () => { const r = remindInfo(); return r && r.at ? Math.max(0, Date.parse(r.at) + REMIND_GAP - Date.now()) : 0; };
function aRoster(id) {
  const e = S.events[id]; if (!e) return null; const a = att(e);
  const rf = RF.some(([k]) => k === AU.rf) ? AU.rf : a.none.length ? "none" : "yes";
  const list = a[rf] || []; const left = remindLeft(); const vs = voteState(e);
  const sub = x => { const v = (((S.rsvp[x.uid] || {}).ev || {})[e.id]) || {}; if (x.guest) return "용병"; if (rf === "late" || (rf === "wait" && x.s === "late")) return `${posTxt(x.p)}${v.q ? ", " + v.q + "Q부터" : ""}`; if (rf === "no" && v.lateCancel) return `마감 뒤 불참${v.reason ? ", " + v.reason : ""}`; return posTxt(x.p); };
  return `${hd("참석 명단", back("#/manage/" + id), { sub: `${md(e.date)} ${wd(e.date)} ${kindOf(e)}, 팀원 ${S.members.length}명` })}<div class="body" style="gap:8px">
    <div class="row" style="gap:8px;flex-wrap:wrap">${RF.filter(([k]) => !(k === "late" && sport() === "futsal")).map(([k, l]) => `<button type="button" class="chip" data-act="aRf" data-v="${k}" aria-pressed="${k === rf}" style="border-radius:999px;padding:0 8px;font-size:14px${k === rf ? `;background:${C.gray};box-shadow:2px 2px 0 ${C.ink}` : ""}">${l} ${(a[k] || []).length}</button>`).join("")}</div>
    <div style="display:flex;flex-direction:column">${list.map((x, i) => `<div class="row" style="min-height:56px;border-bottom:2px solid ${C.line};gap:12px"><b class="bc" style="width:30px;font-size:19px;text-align:center">${rf === "wait" ? i + 1 : esc(x.p && x.p.num || "")}</b><span style="flex:1;display:flex;flex-direction:column;gap:1px"><b style="font-size:16px">${esc(x.name)}</b><span style="font-size:12px;color:${C.sub}">${esc(sub(x))}</span></span>${x.guest ? `<span class="tag pink">용병</span>` : ""}</div>`).join("") || `<span class="note" style="padding:16px 0">없어요</span>`}</div>
  </div>${rf === "none" && a.none.length && vs !== "done" ? `<div class="cta"><button class="btn o block" data-act="aRemind" data-eid="${esc(id)}" ${left ? "disabled" : ""}>${left ? `${Math.ceil(left / 60000)}분 뒤에 다시 보낼 수 있어요` : `미응답 ${a.none.length}명에게 알리기`}</button><span class="note" style="text-align:center">운영진 모두 합쳐 1시간에 한 번만 보낼 수 있어요.</span></div>` : nav("일정")}`;
}
export function remindSheet(eid) { const e = S.events[eid]; if (!e) return; const a = att(e);
  confirmBox(`미응답 ${a.none.length}명에게 알릴까요?`, `${md(e.date)} ${wd(e.date)} ${kindOf(e)} 참석 응답을 기다린다고 알림이 가요. 운영진 모두 합쳐 1시간에 한 번만 보낼 수 있어요.`, "알리기", async () => {
    if (remindLeft()) { toast("조금 전에 다른 운영진이 보냈어요"); render(); return; }
    try { await setDoc("team", "remind", { at: new Date().toISOString(), by: S.uid, eid: e.id, to: a.none.map(x => x.uid) }); render(); toast(`미응답 ${a.none.length}명에게 알렸어요`); } catch (err) { fail(err); }
  });
}
function aCheck(id) {
  const e = S.events[id]; if (!e) return null; const a = att(e); const ck = e.check || {};
  const rows = [...a.yes, ...a.late].concat([...a.no, ...a.none, ...a.wait].filter(x => ck[x.uid]));
  const going = new Set([...a.yes, ...a.late].map(x => x.uid));
  const fl = Object.keys(ck).filter(u => !u.startsWith("g:") && (ck[u] === "late" || (ck[u] === "absent" && going.has(u)))).length;
  // 고른 버튼: 왔음은 탭 색(청록), 지각은 노랑에 먹색 글자, 안 옴은 먹색에 흰 글자. 글자 대비를 지키고 그림자로 눌린 것을 보여 준다
  const b = (u, v, l, c, tc) => `<button type="button" class="btn xs" data-act="checkSet" data-eid="${esc(id)}" data-u="${esc(u)}" data-v="${v}" aria-pressed="${ck[u] === v}" style="min-width:44px;padding:0 8px${ck[u] === v ? `;background:${c};color:${tc};box-shadow:2px 2px 0 ${C.ink}` : ""}">${l}</button>`;
  return `${hd("현장 출석", back("#/manage/" + id), { sub: checkTime(e) ? `${checkTime(e)}에 출석 불러요 (시작 ${cbOf(e)}분 전)` : evLabel(e) })}<div class="body" style="gap:8px">
    <span class="note">출석 부를 때 없으면 지각이에요. 늦참은 고른 쿼터에 맞춰 오면 지각이 아니에요.</span>
    <div style="display:flex;flex-direction:column">${rows.map(x => `<div class="row" style="min-height:58px;border-bottom:2px solid ${C.line};gap:8px"><b class="bc" style="width:28px;font-size:18px;text-align:center">${esc(x.p && x.p.num || "")}</b><span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px"><b style="font-size:16px">${esc(x.name)}</b><span style="font-size:12px;color:${C.sub}">${x.guest ? "용병" : x.s === "late" ? `늦참, ${x.q || 2}Q부터` : going.has(x.uid) ? esc(posTxt(x.p)) : "신청 안 함"}</span></span>${b(x.uid, "in", "왔음", C.sec, C.ink)}${b(x.uid, "late", "지각", C.orange, C.ink)}${b(x.uid, "absent", "안 옴", C.ink, C.bg)}</div>`).join("") || `<span class="note" style="padding:16px 0">참석한 사람이 없어요</span>`}</div>
    ${fl ? "" : `<span class="note">벌금 매길 사람: 지각하거나 안 온 사람이 없어요.</span>`}
  </div><div class="cta"><button class="btn o block" data-act="finesApply" data-eid="${esc(id)}">${fl ? `벌금 ${fl}건 매기고 출석 마치기` : "출석 마치기"}</button></div>`;
}
function aMerc(id) {
  const e = S.events[id]; if (!e) return null; const on = !!e.guestOpen; const a = att(e);
  const reqs = guestReqs(e).filter(g => g.status === "req"); const got = guestsOf(e);
  const waitN = (a.cap && a.in >= a.cap) ? a.wait.length + 1 : 0;
  return `${hd("용병 받기", back("#/manage/" + id), { sub: evLabel(e) })}<div class="body" style="gap:16px">
    <button type="button" class="box${on ? " pink" : ""}" data-act="aMercToggle" data-eid="${esc(id)}" aria-pressed="${on}" style="flex-direction:row;align-items:center;gap:12px;border-radius:14px;text-align:left"><span style="flex:1;display:flex;flex-direction:column;gap:4px"><b style="font-size:16px">이 경기 용병 받기</b><span style="font-size:12px">${on ? "받는 중이에요. 팀원이 신청할 수 있어요." : "꺼져 있어요. 팀원은 신청할 수 없어요."}</span></span>${sw(on)}</button>
    <span class="note">켜면 팀원 일정 화면에 '용병 신청하기' 버튼이 열려요. 받은 용병은 정원${a.cap ? " " + a.cap + "명" : ""} 안에 들어가고, 정원이 다 찼으면 대기 뒤에 서요. 투표가 마감되면 신청도 같이 닫혀요.</span>
    ${reqs.map(g => `<div class="box" style="border-radius:16px;gap:8px"><div class="spread" style="align-items:flex-start"><span style="display:flex;flex-direction:column;gap:4px"><b style="font-size:16px">${esc(g.name)}</b><span style="font-size:12px">${esc(nameOf(g.u))}가 신청했어요 ${esc([g.pos, g.pos2].filter(Boolean).join(" / "))}</span></span><span class="tag pink">기다림</span></div>
      ${g.rel ? `<div style="background:${C.bg};border:2px dashed ${C.ink};border-radius:8px;padding:8px 12px;font-size:14px">${esc(g.rel)}</div>` : ""}
      ${waitN ? `<span class="note">정원 ${a.cap}명이 다 차서, 받으면 대기 ${waitN}번으로 들어가요.</span>` : ""}
      <div class="grid2"><button class="btn" data-act="guestNo" data-u="${esc(g.u)}" data-k="${esc(g.k)}">거절</button><button class="btn g" data-act="aGuestOk" data-eid="${esc(id)}" data-u="${esc(g.u)}" data-k="${esc(g.k)}">받기</button></div></div>`).join("")}
    ${!reqs.length ? `<div class="box dash" style="text-align:center;font-size:14px;padding:16px">${on ? "아직 들어온 신청이 없어요." : "지금은 받지 않아요. 팀원 화면의 신청 버튼도 닫혀 있어요."}</div>` : ""}
    ${got.length ? `<section style="display:flex;flex-direction:column">${head2("받은 용병", `<span class="bc" style="font-size:16px">${got.length}명</span>`)}${got.map(g => `<div class="row" style="min-height:52px;border-bottom:2px solid ${C.line};gap:8px"><span style="flex:1"><b>${esc(g.name)}</b> <span class="note">${esc([g.pos, g.pos2].filter(Boolean).join(" / "))}${g.by ? ", " + esc(nameOf(g.by)) + " 신청" : ""}</span></span><button class="lnk" data-act="guestDel" data-eid="${esc(id)}" data-g="${esc(g.id)}" style="color:#8C3B28">빼기</button></div>`).join("")}</section>` : ""}
  </div>${nav("일정")}`;
}
const nextDate = () => { const last = Object.values(S.events).sort((a, b) => b.date.localeCompare(a.date))[0]; const dow = last ? new Date(last.date + "T00:00:00Z").getUTCDay() : 6; let d = new Date(todayStr() + "T00:00:00Z"); for (let i = 0; i < 8; i++) { d = new Date(d.getTime() + 864e5); if (d.getUTCDay() === dow) break; } return d.toISOString().slice(0, 10); };
export function eventFormInit(id) {
  const e = id ? S.events[id] : null;
  const v = h12(e ? (e.voteClose === "eve" && /^\d\d:\d\d$/.test(e.voteTime || "") ? e.voteTime : e.voteClose === "eve21" ? "21:00" : pol("voteTime")) : pol("voteTime"));
  S.form = e ? { type: e.type, date: e.date, time: e.time || "", end: e.end || "", place: e.place || "", opponent: e.opponent || "", oppTbd: e.type === "match" && !e.opponent, cap: String(Number(e.cap) || ""), openDate: e.openAt ? kstDate(e.openAt) : "", voteAp: v.ap, voteH: String(v.h), cb: String(cbOf(e)) }
    : { type: "match", date: nextDate(), time: "", end: "", place: "", opponent: "", oppTbd: false, cap: String(pol("cap")), openDate: "", voteAp: v.ap, voteH: String(v.h), cb: String(pol("checkBefore")) };
}
function aEventForm(id) {
  const e = id ? S.events[id] : null; if (id && !e) return null; const f = S.form; const scrim = f.type === "scrim";
  const tb = (v, l) => `<button type="button" class="box${f.type === v ? " blue" : ""}" data-act="aPick" data-k="type" data-v="${v}" aria-pressed="${f.type === v}" style="align-items:center;padding:12px;border-radius:12px;font-weight:700;${f.type === v ? `box-shadow:4px 4px 0 ${C.ink};transform:rotate(-1.5deg)` : ""}">${l}</button>`;
  const apb = v => `<button type="button" class="chip${f.voteAp === v ? " on" : ""}" data-act="aPick" data-k="voteAp" data-v="${v}" style="min-height:44px;padding:0 8px">${v === "am" ? "오전" : "오후"}</button>`;
  return `${hd(id ? "일정 고치기" : "일정 올리기", back(id ? "#/manage/" + id : "#/schedule"), { sub: id ? evLabel(e) : "올리면 팀원에게 알림이 가요" })}<div class="body" style="gap:16px">
    <div class="fld"><span class="lb">종류</span>${scrim ? `<b style="font-size:16px">내전</b>` : `<div class="grid2" style="padding:4px">${tb("match", "경기")}${tb("training", "훈련")}</div><span class="note">내전은 직접 만들지 않아요. 상대가 미정인 일정에 사람이 모이면 정해요.</span>`}</div>
    <label class="fld"><span class="lb">날짜</span><input class="inp" type="date" data-bind="date" value="${esc(f.date || "")}"></label>
    <div class="grid2"><label class="fld"><span class="lb">시작</span><input class="inp" type="time" data-bind="time" value="${esc(f.time || "")}"></label><label class="fld"><span class="lb">끝</span><input class="inp" type="time" data-bind="end" value="${esc(f.end || "")}"></label></div>
    <label class="fld"><span class="lb">장소</span><input class="inp" data-bind="place" value="${esc(f.place || "")}" maxlength="40" placeholder="구장 이름"></label>
    ${f.type === "match" ? `<div class="fld"><span class="lb">상대팀</span><div class="row"><input class="inp" data-bind="opponent" value="${esc(f.oppTbd ? "" : f.opponent || "")}" maxlength="30" placeholder="${f.oppTbd ? "상대 미정" : "팀 이름"}" ${f.oppTbd ? "disabled" : ""} style="flex:1"><button type="button" class="btn${f.oppTbd ? " ink" : ""}" data-act="aOppTbd" aria-pressed="${!!f.oppTbd}" style="flex:none;padding:0 16px">미정</button></div><span class="note">상대팀이 정해진 일정은 내전으로 바꿀 수 없어요.</span></div>` : ""}
    <div style="border-top:2px solid ${C.ink};display:flex;flex-direction:column;gap:12px;padding-top:16px;font-size:16px">
      ${scrim ? "" : `<div class="row" style="gap:8px"><span style="width:52px">정원</span>${numInp("cap", f.cap)}<span>명, 넘으면 대기로</span></div>`}
      <div class="row" style="gap:8px"><span style="width:52px">투표는</span><input class="inp bc" type="date" data-bind="openDate" value="${esc(f.openDate || "")}" style="width:170px;flex:none;font-size:16px"><span>부터 받아요</span></div>
      <div class="row" style="gap:8px;flex-wrap:wrap"><span>경기 전날</span>${apb("am")}${apb("pm")}${numInp("voteH", f.voteH)}<span>시에 마감</span></div>
      <div class="row" style="gap:8px"><span style="width:52px">시작</span>${numInp("cb", f.cb)}<span>분 전에 출석 불러요</span></div>
      <span class="note">투표 날짜를 비워 두면 올리자마자 받아요. 마감 시각과 출석 시간은 기본 운영 규칙에서 가져왔어요. 이 일정만 바꿀 수 있어요.</span>
    </div>
  </div><div class="cta"><button class="btn o block" data-act="aSaveEvent" data-eid="${esc(id || "")}">${id ? "고친 내용 저장" : "올리기"}</button></div>`;
}
function aScrim(id) {
  const e = S.events[id]; if (!e) return null; const a = att(e); const total = a.in + a.wait.length;
  const days = Math.max(0, Math.round((new Date(e.date + "T00:00:00+09:00") - new Date(todayStr() + "T00:00:00+09:00")) / 864e5));
  return `${hd("내전 정하기", back("#/schedule"), { sub: `${md(todayStr())} ${wd(todayStr())}, 경기 ${days}일 전` })}<div class="body" style="gap:16px">
    <div class="box gray" style="border-radius:20px;gap:8px;padding:16px 16px"><span class="cn"><b class="bc" style="font-size:24px">${md(e.date)} ${wd(e.date)}</b><span style="font-size:12px;font-weight:700">${e.opponent ? "vs " + esc(e.opponent) : "상대 미정"}</span></span><b class="bc" style="font-size:36px;line-height:1">${esc(e.time || "")}${e.end ? " ~ " + esc(e.end) : ""}</b><span style="font-size:14px">${esc(e.place || "장소 미정")}</span>
      <span style="border-top:2px dashed rgba(18,17,16,.35);margin-top:8px;padding-top:8px" class="cn"><b class="bc" style="font-size:44px;line-height:1">${total}</b><span style="font-size:14px">명 (참석 ${a.in}, 대기 ${a.wait.length})</span></span></div>
    <span style="font-size:16px;line-height:1.7">${e.scrimKeep ? "이번에는 경기로 정했어요." : e.type === "scrim" ? "이미 내전으로 바꿨어요." : `경기 ${pol("scrimDays")}일 전까지 ${pol("scrimMin")}명이 넘게 모였어요. 상대팀이 미정이라 내전을 할 수 있어요. 운영진끼리 상의해서 정하면 팀원에게 알림이 가요.`}</span>
  </div>${e.type === "match" && !e.scrimKeep ? `<div class="cta"><button class="btn o block" data-act="aScrimGo" data-eid="${esc(id)}">내전 하기</button><button class="btn block" data-act="aScrimKeep" data-eid="${esc(id)}">이번에는 안 하기</button></div>` : nav("일정")}`;
}

/* ---------- 라인업 짜기 ---------- */
const sideOf = e => e.type === "scrim" ? UI.side || "A" : "main";
async function saveL(e, side, L) {
  const cur = S.events[e.id] || e;
  try { await setDoc("events", e.id, { ...cur, lineup: { ...(cur.lineup || {}), [side]: L } }); S.form.lineup = null; S.form.lineupFor = ""; render(); } catch (err) { fail(err); }
}
const PITCH = `<span class="l" style="left:10px;right:10px;top:10px;bottom:10px;border-radius:4px"></span><span class="l" style="left:10px;right:10px;top:50%;height:0;border-width:2px 0 0"></span><span class="l" style="left:50%;top:50%;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%"></span><span class="l" style="left:50%;top:10px;width:150px;height:48px;margin-left:-75px;border-top:0"></span><span class="l" style="left:50%;bottom:10px;width:150px;height:48px;margin-left:-75px;border-bottom:0"></span>`;
function aLineup(id) {
  const e = S.events[id]; if (!e) return null; const side = sideOf(e); const L = curLineup(e, side); const d = draftOf(e, side);
  const qn = QN[sport()]; const k = Math.min(UI.q || 1, qn); const fs = sport() === "futsal";
  const ps = lineupPlayers(e, side); const fl = L ? L.formation : formOf(d.fkey) || [];
  const fkey = (L && L.fkey) || d.fkey; const xy = spotXY(fl, fkey); const q = (L && L.q && L.q[k]) || {};
  const pOf = u => ps.find(p => p.uid === u);
  const pinned = (u, i) => !!u && (d.pins || []).some(x => x.u === u && x.pos === fl[i] && x.qs.includes(k));
  const fbtn = `<button type="button" class="btn sm" data-act="aForm" data-eid="${esc(id)}" style="margin-right:4px;font-family:'Barlow Condensed','IBM Plex Sans KR';font-size:16px">${fl.length ? esc(fs ? fl.length + "대" + fl.length : fkey) : "인원"} ▾</button>`;
  const sideTabs = e.type === "scrim" ? `<div class="grid2">${["A", "B"].map(s => `<button type="button" class="chip${side === s ? " on" : ""}" data-act="lineSide" data-v="${s}">${s}팀</button>`).join("")}</div>` : "";
  if (!fl.length) return `${hd("라인업 짜기", back("#/manage/" + id), { sub: evLabel(e), right: fbtn })}<div class="body">${sideTabs}<div class="box gray" style="gap:8px"><b>몇 명이 뛰나요?</b><span class="note" style="color:${C.ink}">골레이로를 포함한 한 팀 인원이에요. 참석 ${ps.length}명</span><div class="chips">${FUTSAL_N.map(n => `<button type="button" class="chip" data-act="aFormPick" data-eid="${esc(id)}" data-k="${n}대${n}">${n}대${n}</button>`).join("")}</div></div></div>${nav("일정")}`;
  const cnt = {}; if (L) Object.values(L.q || {}).forEach(r => Object.values(r).forEach(u => { cnt[u] = (cnt[u] || 0) + 1; }));
  const bench = ps.filter(p => !Object.values(q).includes(p.uid));
  const spot = i => { const p = xy[i] || { x: 50, y: 50 }; const u = q[i]; const pin = pinned(u, i); const off = u && !pin && !canPlay(pOf(u), fl[i]);
    const bg = !u ? "rgba(251,247,239,.55)" : pin ? C.pink : off ? C.gray : C.bg;
    return `<button type="button" class="spot" data-act="aSpot" data-eid="${esc(id)}" data-i="${i}" aria-label="${esc(fl[i])} ${u ? esc(pOf(u) ? pOf(u).name : gname(e, u)) : "빈자리"}" style="left:${p.x}%;top:${p.y}%;border:0;background:transparent;padding:0;gap:1px"><span style="border:2px ${u ? "solid" : "dashed"} ${C.ink};border-radius:999px;background:${bg};padding:4px 8px;font-size:12px;font-weight:700;white-space:nowrap;max-width:76px;overflow:hidden;text-overflow:ellipsis">${u ? esc((pOf(u) ? pOf(u).name : gname(e, u)).replace(" (용병)", "")) : "빈자리"}</span><span class="p" style="color:${C.bg};text-shadow:0 1px 2px rgba(0,0,0,.5)">${esc(fl[i])}</span></button>`; };
  const qcards = `<div style="display:grid;grid-template-columns:repeat(${Math.min(qn, 4)},minmax(0,1fr));gap:8px;padding:4px">${Array.from({ length: qn }, (_, i) => i + 1).map(n => `<button type="button" class="box${n === k ? " blue" : ""}" data-act="lineQ" data-v="${n}" aria-pressed="${n === k}" style="align-items:center;padding:8px 0;border-radius:10px;${n === k ? `box-shadow:4px 4px 0 ${C.ink}` : ""}"><b class="bc" style="font-size:20px">${n}Q</b></button>`).join("")}</div>`;
  const qrow = p => `<div class="row" style="gap:8px;min-height:34px;font-size:12px"><span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name.replace(" (용병)", ""))}${p.from > 1 ? ` <span class="note">${p.from}Q~</span>` : ""}</span><span style="display:flex;gap:4px">${Array.from({ length: qn }, (_, i) => { const on = Object.values((L && L.q && L.q[i + 1]) || {}).includes(p.uid); return `<i style="width:10px;height:10px;border:2px solid ${C.ink};background:${on ? (i + 1 === k ? C.blue : C.ink) : "transparent"}"></i>`; }).join("")}</span><b class="bc" style="width:16px;text-align:right">${cnt[p.uid] || 0}</b></div>`;
  const shown = (e.lineupAt || e.lineupOld) && L && !(S.form.lineup && S.form.lineupFor === e.id + side);
  return `${hd("라인업 짜기", back("#/manage/" + id), { sub: evLabel(e), right: fbtn })}<div class="body" style="gap:16px">
    ${sideTabs}${qcards}
    <div class="pitch" style="height:${fs ? 330 : 400}px">${PITCH}${fl.map((_, i) => spot(i)).join("")}${!L ? `<span class="stamp" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-4deg);font-size:16px;white-space:nowrap">자동 배치를 눌러요</span>` : ""}</div>
    ${L && fl.some((_, i) => !q[i]) ? `<div class="err">${k}Q 빈자리 ${esc(fl.filter((_, i) => !q[i]).join(", "))}: 이 포지션을 1선호나 2선호로 둔 선수가 없거나 모두 뛰고 있어요. 자리를 눌러 직접 넣어 주세요.</div>` : ""}
    ${L ? `<button type="button" class="btn sm" data-act="aLinePdf" data-eid="${esc(id)}" style="align-self:flex-end;gap:6px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/></svg>PDF로 저장</button>` : ""}
    <span class="note">자리를 눌러 선수를 넣고 고정해요. 핑크는 고정한 자리, 회색은 1선호와 2선호가 아닌 자리예요. 자동 배치는 고정한 자리는 두고 나머지를 쿼터 수가 고르게 채워요.</span>
    ${L ? `<section style="display:flex;flex-direction:column;gap:8px">${head2("출전 쿼터", `<span class="note">${k}Q 쉬는 사람 ${bench.length}명</span>`)}<div style="display:grid;grid-template-columns:1fr 1fr;column-gap:14px">${ps.slice().sort((a, b) => (cnt[b.uid] || 0) - (cnt[a.uid] || 0) || a.name.localeCompare(b.name)).map(qrow).join("")}</div></section>` : ""}
  </div><div class="cta"><div class="grid2"><button class="btn" data-act="aAuto" data-eid="${esc(id)}">자동 배치</button><button class="btn o" data-act="lineShare" data-eid="${esc(id)}" ${L ? "" : "disabled"}>${shown ? "다시 알리기" : "라인업 알리기"}</button></div></div>`;
}
// 라인업을 PDF로: 인쇄용 화면(#print)을 만들어 브라우저 인쇄 창을 연다. 인쇄 창에서 "PDF로 저장"을 고르면 파일로 남는다
// 쿼터마다 경기장 배치(한 장에 4쿼터), 끝에 선수별 출전과 휴식 표. 저장하지 않은 지금 화면의 라인업 그대로 뽑는다
function linePdf(e) {
  const side = sideOf(e); const L = curLineup(e, side); if (!L) return;
  const qn = QN[sport()]; const fl = L.formation || []; const fkey = L.fkey || draftOf(e, side).fkey; const xy = spotXY(fl, fkey); const fs = sport() === "futsal";
  const ps = lineupPlayers(e, side); const nm = u => { const p = ps.find(x => x.uid === u); return (p ? p.name : gname(e, u)).replace(" (용병)", ""); };
  const guest = u => String(u).startsWith("g:");
  const qs = Array.from({ length: qn }, (_, i) => i + 1);
  const title = `${esc((S.team && S.team.name) || "")} 라인업${e.type === "scrim" ? ` <span style="font-size:14pt">${side}팀</span>` : ""}`;
  const sub = [`${md(e.date)} ${wd(e.date)}${e.time ? " " + e.time : ""}`, e.type === "match" ? (e.opponent ? "vs " + e.opponent : "상대 미정") : kindOf(e), e.place || "", fs ? `${fl.length}대${fl.length}` : fkey].filter(Boolean).map(esc).join("  |  ");
  const pitch = k => { const q = (L.q || {})[k] || {};
    return `<div class="pp-q"><b class="pp-qn">${k}Q</b><div class="pp-pitch"><i class="pp-l" style="inset:4%"></i><i class="pp-l" style="left:4%;right:4%;top:50%;height:0;border-width:1.5px 0 0"></i><i class="pp-l" style="left:50%;top:50%;width:18%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%"></i><i class="pp-l" style="left:30%;right:30%;top:4%;height:11%;border-top:0"></i><i class="pp-l" style="left:30%;right:30%;bottom:4%;height:11%;border-bottom:0"></i>
      ${fl.map((pos, i) => { const p = xy[i] || { x: 50, y: 50 }; const u = q[i]; return `<span class="pp-s" style="left:${p.x}%;top:${p.y}%"><b class="${u ? "" : "pp-e"}">${u ? esc(nm(u)) : "빈자리"}</b><small>${esc(pos)}</small></span>`; }).join("")}</div></div>`; };
  const pages = []; for (let i = 0; i < qn; i += 4) pages.push(qs.slice(i, i + 4));
  const rows = ps.slice().sort((a, b) => (guest(a.uid) - guest(b.uid)) || a.name.localeCompare(b.name)).map(p => { let n = 0;
    const cells = qs.map(k => { const q = (L.q || {})[k] || {}; const i = Object.keys(q).find(x => q[x] === p.uid); if (i != null) n++; return i != null ? `<td class="pp-on">${esc(fl[i] || "")}</td>` : `<td class="pp-off">${p.from > k ? "늦참" : "휴식"}</td>`; }).join("");
    return `<tr><th>${esc(p.name.replace(" (용병)", ""))}${guest(p.uid) ? ' <span class="pp-g">용병</span>' : ""}</th>${cells}<td class="pp-n">${n}</td></tr>`; }).join("");
  const head = `<header class="pp-h"><h1>${title}</h1><p>${sub}</p></header>`;
  const html = pages.map((pg, i) => `<section class="pp-page">${i === 0 ? head : ""}<div class="pp-grid">${pg.map(pitch).join("")}</div></section>`).join("")
    + `<section class="pp-page pp-tbl">${pages.length > 1 || qn > 4 ? head : `<h2>출전과 휴식</h2>`}<table><thead><tr><th>선수</th>${qs.map(k => `<td>${k}Q</td>`).join("")}<td>출전</td></tr></thead><tbody>${rows}</tbody></table><p class="pp-f">매니볼에서 만든 라인업이에요. ${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 16).replace("T", " ")} 기준</p></section>`;
  let box = document.getElementById("print"); if (!box) { box = document.createElement("div"); box.id = "print"; document.body.appendChild(box); }
  box.innerHTML = html;
  const old = document.title; document.title = `${(S.team && S.team.name) || "매니볼"} 라인업 ${e.date}${e.type === "scrim" ? " " + side + "팀" : ""}`;
  const done = () => { document.title = old; box.innerHTML = ""; window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  setTimeout(() => { try { window.print(); } catch (err) { done(); toast("이 브라우저에서는 인쇄 창을 열 수 없어요"); } }, 50);
}
function spotSheet(eid, i) {
  const e = S.events[eid]; if (!e) return; const side = sideOf(e); const L = curLineup(e, side); const d = draftOf(e, side); const fl = L ? L.formation : formOf(d.fkey) || [];
  const qn = QN[sport()]; const k = Math.min(UI.q || 1, qn); const q = (L && L.q && L.q[k]) || {}; const u = q[i]; const pos = fl[i];
  const ps = lineupPlayers(e, side); const cnt = {}; if (L) Object.values(L.q || {}).forEach(r => Object.values(r).forEach(x => { cnt[x] = (cnt[x] || 0) + 1; }));
  const where = p => { const j = Object.keys(q).find(x => q[x] === p.uid); return j != null ? `${k}Q ${fl[j]}에 있어요` : `${k}Q 쉬어요`; };
  const pin = !!u && (d.pins || []).some(x => x.u === u && x.pos === pos && x.qs.includes(k));
  const list = ps.filter(p => p.uid !== u).sort((a, b) => (canPlay(b, pos) ? 1 : 0) - (canPlay(a, pos) ? 1 : 0) || (cnt[a.uid] || 0) - (cnt[b.uid] || 0));
  sheet(`<div class="spread"><h3>${k}Q ${esc(pos)} 자리</h3><span class="note">${u ? "지금 " + esc(gname(e, u).replace(" (용병)", "")) : "비어 있어요"}</span></div>
    ${u ? `<button type="button" class="box" data-act="aPin" data-eid="${esc(eid)}" data-i="${i}" style="flex-direction:row;align-items:center;gap:8px;border-radius:12px;padding:12px 16px${pin ? `;background:${C.pink}` : ""}"><b style="flex:1;text-align:left">이 자리에 고정</b><span style="font-size:12px;font-weight:700">${pin ? "켜짐" : "꺼짐"}</span></button>` : ""}
    <div style="display:flex;flex-direction:column;max-height:46dvh;overflow-y:auto">${list.map((p, n) => { const late = p.from > k; const ok = canPlay(p, pos); const num = p.uid.startsWith("g:") ? "" : numOf(p.uid);
      const head = !ok && (n === 0 || canPlay(list[n - 1], pos)) ? `<span style="display:flex;flex-direction:column;gap:4px;padding:16px 4px 8px"><b style="font-size:12px">${esc(pos)}가 선호 포지션이 아닌 선수</b><span class="note">넣으면 이 쿼터 이 자리에 고정돼요</span></span>` : "";
      return `${head}<button type="button" data-act="aPut" data-eid="${esc(eid)}" data-i="${i}" data-u="${esc(p.uid)}" ${late ? "disabled" : ""} class="row" style="border:0;border-bottom:2px solid ${C.line};background:transparent;min-height:56px;gap:12px;text-align:left;padding:0 4px;${late ? "opacity:.45" : ""}"><b class="bc" style="width:26px;font-size:18px">${esc(num)}</b><span style="flex:1;display:flex;flex-direction:column;gap:1px"><b style="font-size:16px">${esc(p.name)}</b><span style="font-size:12px;color:${C.sub}">${late ? p.from + "Q부터 와요" : where(p)}, 지금까지 ${cnt[p.uid] || 0}쿼터${ok ? "" : ", " + esc([p.pos[0], p.pos[1]].filter(Boolean).join("/") || "포지션 미정")}</span></span></button>`; }).join("")}</div>
    ${u ? `<button class="lnk" data-act="aEmpty" data-eid="${esc(eid)}" data-i="${i}" style="align-self:center">이 자리 비우기</button>` : ""}
    <button class="btn block" data-act="closeSheet">닫기</button>`);
}
function formSheet(eid) {
  const e = S.events[eid]; if (!e) return; const n = att(e).in;
  if (sport() === "futsal") { sheet(`<h3>몇 명이 뛰나요?</h3><span class="note">골레이로를 포함한 한 팀 인원이에요. 참석 ${n}명</span><div class="chips">${FUTSAL_N.map(x => `<button type="button" class="chip" data-act="aFormPick" data-eid="${esc(eid)}" data-k="${x}대${x}">${x}대${x}</button>`).join("")}</div><button class="btn block" data-act="closeSheet">닫기</button>`); return; }
  const cur = draftOf(e, sideOf(e)).fkey;
  sheet(`<h3>포메이션</h3><span class="note">바꾸면 고정한 자리는 풀리고 다시 자동으로 채워요.</span><div style="display:flex;flex-direction:column">${Object.keys(FORMS.soccer).map(x => `<button type="button" class="row" data-act="aFormPick" data-eid="${esc(eid)}" data-k="${esc(x)}" style="border:0;border-bottom:2px solid ${C.line};background:transparent;min-height:54px;gap:12px;text-align:left"><b class="bc" style="width:84px;font-size:20px">${esc(x)}</b><span style="flex:1;font-size:12px">${esc(FORM_DESC[x] || "")}</span>${x === cur ? IC.check : ""}</button>`).join("")}</div><button class="btn block" data-act="closeSheet">닫기</button>`);
}

/* ---------- 길찾기 ---------- */
export function adminRoute(r) {
  let m; const id = x => decodeURIComponent(x);
  if (r === "/ops") return aOps();
  if (r === "/requests") return aRequests();
  if (r === "/posreqs") return aPosReqs();
  if (r === "/dues") return aDues();
  if (r === "/fines") return aFines();
  if (r === "/policy") return aPolicy();
  if (r === "/settings") return aSettings();
  if (r === "/members") return aMembers();
  if (r === "/season") return aSeason();
  if (r === "/new") return aEventForm("");
  if (r === "/notice-new") return aNoticeForm("");
  if (r === "/rules-edit") return aRulesEdit();
  if ((m = r.match(/^\/notice-edit\/(.+)$/))) return D("notices")[id(m[1])] ? aNoticeForm(id(m[1])) : null;
  if ((m = r.match(/^\/edit\/(.+)$/))) return aEventForm(id(m[1]));
  if ((m = r.match(/^\/manage\/(.+)$/))) return aManage(id(m[1]));
  if ((m = r.match(/^\/roster\/(.+)$/))) return aRoster(id(m[1]));
  if ((m = r.match(/^\/lineup\/(.+)$/))) return aLineup(id(m[1]));
  if ((m = r.match(/^\/check\/(.+)$/))) return aCheck(id(m[1]));
  if ((m = r.match(/^\/merc\/(.+)$/))) return aMerc(id(m[1]));
  if ((m = r.match(/^\/scrim\/(.+)$/))) return aScrim(id(m[1]));
  if ((m = r.match(/^\/result\/(.+)$/))) return aResult(id(m[1]));
  return null;
}
export function adminForm(r) {
  let m;
  if (r === "/new") { eventFormInit(""); return true; }
  if ((m = r.match(/^\/edit\/(.+)$/)) && S.events[decodeURIComponent(m[1])]) { eventFormInit(decodeURIComponent(m[1])); return true; }
  if (r === "/notice-new") { S.form = { title: "", body: "", pinned: false, notify: true }; return true; }
  if ((m = r.match(/^\/notice-edit\/(.+)$/))) { const n = D("notices")[decodeURIComponent(m[1])] || {}; S.form = { title: n.title || "", body: n.body || "", pinned: !!n.pinned }; return true; }
  if (r === "/rules-edit") { S.form = rulesFormInit(S.settings); return true; }
  if (r === "/policy") { S.form = policyInit(); return true; }
  if (r === "/settings") { S.form = { tname: (S.team && S.team.name) || "", joinApproval: S.settings.joinApproval !== false }; return true; }
  if ((m = r.match(/^\/result\/(.+)$/)) && S.events[decodeURIComponent(m[1])]) { const e = S.events[decodeURIComponent(m[1])]; S.form = { us: (e.score || {}).us || 0, them: (e.score || {}).them || 0, goals: (e.goals || []).map(g => ({ uid: g.uid || "", assist: g.assist || "", side: g.side || "" })) }; return true; }
  if (/^\/lineup\//.test(r)) { S.form = {}; UI.q = 1; UI.side = "A"; return true; }
  if (/^\/roster\//.test(r)) { AU.rf = ""; return true; }
  if (r === "/dues") { AU.ref = ""; return true; }
  if (r === "/requests") { loadReqs().then(render).catch(() => {}); return false; }
  return false;
}
export function playerSheet(u) { memberSheet(u); }
export function rosterSheet() {}

/* ---------- 누르면 ---------- */
const clamp = (v, a, b, d) => { const n = Number(String(v ?? "").replace(/\D/g, "")); return String(v ?? "") !== "" && Number.isFinite(n) ? Math.max(a, Math.min(b, Math.round(n))) : d; };
function putAt(e, side, i, u) {
  const d = draftOf(e, side); const cur = curLineup(e, side); const fl = cur ? cur.formation : formOf(d.fkey); const k = Math.min(UI.q || 1, QN[sport()]);
  const L = JSON.parse(JSON.stringify(cur || { fkey: d.fkey, formation: fl, q: {} })); const row = L.q[k] = L.q[k] || {};
  const old = row[i]; const j = u ? Object.keys(row).find(x => row[x] === u) : null;
  const drop = (who, pos) => { d.pins = (d.pins || []).map(x => x.u === who && x.pos === pos ? { ...x, qs: x.qs.filter(z => z !== k) } : x).filter(x => x.qs.length); };
  if (old) drop(old, fl[i]); if (j != null) drop(u, fl[j]);
  if (j != null) { if (old) row[j] = old; else delete row[j]; }
  if (u) row[i] = u; else delete row[i];
  // 선호 포지션이 아닌 자리에 직접 넣으면 그 쿼터 그 자리에 고정한다 (자동 배치는 선호 포지션에만 넣으므로, 고정해야 다시 짜도 남는다)
  const pl = u ? lineupPlayers(e, side).find(p => p.uid === u) : null;
  L.offPin = !!pl && !canPlay(pl, fl[i]);
  if (L.offPin) { d.pins = d.pins || []; const same = d.pins.find(x => x.u === u && x.pos === fl[i]); if (same) { if (!same.qs.includes(k)) same.qs = [...same.qs, k].sort((a, b) => a - b); } else d.pins.push({ u, pos: fl[i], qs: [k] }); }
  L.pins = JSON.parse(JSON.stringify(d.pins || [])); return L;
}
export const AACT = {
  aSchedSheet: () => schedSheet(),
  aPick: t => { S.form[t.dataset.k] = t.dataset.v; render(); },
  aTog: t => { S.form[t.dataset.k] = !S.form[t.dataset.k]; render(); },
  aRf: t => { AU.rf = t.dataset.v; render(); },
  aDuesRef: t => { AU.ref = t.dataset.k; render(); },
  aDuesSet: () => { const st = S.settings; const b = st.bank || {}; AU.mset = { feeMode: st.feeMode || "none", fee: st.fee ? String(st.fee) : "", dueDay: st.dueDay || "5", bank: b.bank || "", account: b.account || "", holder: b.holder || "" }; duesSetSheet(); },
  aDuesRemind: t => { const key = t.dataset.k; const ref = duesRefs().find(r => r.key === key); if (!ref) return; const ps = (ref.e ? people().filter(x => cameTo(ref.e, x.uid)) : people()).filter(x => !paidOf(key, x.uid));
    confirmBox(`안 낸 ${ps.length}명에게 알릴까요?`, `${ref.label} 회비를 아직 안 냈다고 팀원 알림함에 알림이 가요.`, "알리기", async () => { try { await setDoc("team", "duesRemind", { at: new Date().toISOString(), by: S.uid, key, to: ps.map(x => x.uid) }); toast(`${ps.length}명에게 알렸어요`); } catch (err) { fail(err); } }); },
  aFineAdd: () => { AU.fa = { u: "", eid: "", ri: 0 }; fineAddSheet(); },
  aPosOk: async t => { const u = t.dataset.u; const r = S.rsvp[u] || {}; const req = r.posReq || {}; const p = r.profile || {};
    try { await patchDoc("rsvp", u, { profile: { ...p, pos1: req.pos1, pos2: req.pos2 || "" }, posReq: { ...req, status: "ok", from1: p.pos1 || "", from2: p.pos2 || "", doneAt: new Date().toISOString() } }); render(); toast(`${nameOf(u)} 포지션을 바꿨어요`); } catch (err) { fail(err); } },
  aPosNo: t => { const u = t.dataset.u; confirmBox("요청을 거절할까요?", `${nameOf(u)} 님에게 포지션 변경 요청이 반려됐다고 알림이 가요.`, "거절", async () => { const r = S.rsvp[u] || {}; const p = r.profile || {};
    try { await patchDoc("rsvp", u, { posReq: { ...(r.posReq || {}), status: "no", from1: p.pos1 || "", from2: p.pos2 || "", doneAt: new Date().toISOString() } }); render(); toast("거절했어요"); } catch (err) { fail(err); } }, true); },
  aPolicySave: async t => {
    if (!owner()) return; const f = S.form; t.disabled = true;
    const data = { ...S.settings, voteClose: "eve", voteTime: String(to24(f.pVoteAp, f.pVoteH)).padStart(2, "0") + ":00", cap: clamp(f.pCap, 2, 40, pol("cap")), checkBefore: clamp(f.pCheck, 0, 60, pol("checkBefore")), scrimMin: clamp(f.pScrimMin, 4, 40, pol("scrimMin")), scrimDays: clamp(f.pScrimDays, 1, 7, pol("scrimDays")),
      fineFrom: ["day", "custom"].includes(f.fineFrom) ? f.fineFrom : "close", fineDays: clamp(f.fineDays, 1, 14, 1), fineAp: f.fineAp === "am" ? "am" : "pm", fineHour: clamp(f.fineHour, 1, 12, 6) };
    try { await setDoc("team", "settings", data); toast("저장했어요. 다음에 올리는 일정부터 적용돼요"); location.hash = "#/ops"; } catch (err) { t.disabled = false; fail(err); }
  },
  aJoinAp: () => { if (!owner()) return; S.form.joinApproval = S.form.joinApproval === false; render(); },
  aSettingsSave: async t => {
    if (!owner()) return; const name = String(S.form.tname || "").trim(); if (!name) { toast("팀 이름을 적어 주세요"); return; } t.disabled = true;
    try {
      await setDoc("team", "settings", { ...S.settings, teamName: name.slice(0, 40), joinApproval: S.form.joinApproval !== false });
      if (S.team && name !== S.team.name) { const { error } = await sb.from("teams").update({ name: name.slice(0, 40) }).eq("id", S.tid); if (error) throw error; S.team.name = name.slice(0, 40); }
      toast("저장했어요"); location.hash = "#/ops";
    } catch (err) { t.disabled = false; fail(err); }
  },
  aTeamOut: () => { AU.out = "leave"; teamOutSheet(); },
  aMember: t => memberSheet(t.dataset.u),
  aKick: t => { const u = t.dataset.u; closeSheet();
    dlg(`<h3 style="text-align:center">${esc(nameOf(u))}를 내보낼까요?</h3><span style="font-size:14px;line-height:1.6;text-align:center">내보내면 이 팀의 일정과 기록을 볼 수 없어요.<br>다시 들어오려면 초대 링크를 받아야 해요.</span><div class="grid2"><button class="btn" data-act="closeSheet" style="background:${C.blue}">남기기</button><button class="btn c" id="kOk">내보내기</button></div>`);
    $("#kOk").onclick = async ev => { ev.target.disabled = true; const { error } = await sb.rpc("remove_member", { p_team: S.tid, p_user: u }); closeSheet(); if (error) fail(error); else { toast("내보냈어요"); refreshMembers(); } }; },
  aNoticeSave: async t => {
    const f = S.form; const title = String(f.title || "").trim(); if (!title) { toast("제목을 적어 주세요"); return; } t.disabled = true; const id = t.dataset.id;
    try {
      if (f.pinned) for (const [nid, n] of Object.entries(D("notices"))) if (n.pinned && nid !== id) await setDoc("notices", nid, { ...n, pinned: false });
      if (id) { const n = D("notices")[id] || {}; await setDoc("notices", id, { ...n, title: title.slice(0, 60), body: String(f.body || "").trim(), pinned: !!f.pinned, editedAt: new Date().toISOString() }); toast("고쳤어요"); location.hash = "#/notice/" + id; }
      else { await setDoc("notices", uid36("n"), { title: title.slice(0, 60), body: String(f.body || "").trim(), pinned: !!f.pinned, by: S.uid, at: new Date().toISOString(), quiet: !f.notify }); toast("공지를 올렸어요"); location.hash = "#/notices"; }
    } catch (err) { t.disabled = false; fail(err); }
  },
  aRulesSave: async t => {
    const R = rulesFromForm(S.form); t.disabled = true;
    const changed = R.rulesText !== rulesTextOf(S.settings).trim() || JSON.stringify(R.rules.map(r => [r.label, r.amount])) !== JSON.stringify(fineRulesOf(S.settings).map(r => [r.label, Number(r.amount)]));
    try { await setDoc("team", "settings", { ...S.settings, ...R, rulesAt: changed ? new Date().toISOString() : S.settings.rulesAt || "" }); toast("저장했어요"); location.hash = "#/team"; } catch (err) { t.disabled = false; fail(err); }
  },
  aScore: t => { const f = S.form; const k = t.dataset.k; const d = Number(t.dataset.d); const v = Math.max(0, Math.min(30, (Number(f[k]) || 0) + d)); if (v === (Number(f[k]) || 0)) return; f[k] = v; f.goals = f.goals || [];
    const rid = (route().match(/^\/result\/(.+)$/) || [])[1]; const e = rid ? S.events[decodeURIComponent(rid)] : null; const scrim = !!e && e.type === "scrim";
    if (scrim || k === "us") { const side = scrim ? (k === "us" ? "A" : "B") : ""; if (d > 0) f.goals.push({ uid: "", assist: "", side }); else { let i = -1; f.goals.forEach((g, j) => { if (!g.uid && !g.assist && (!scrim || g.side === side)) i = j; }); if (i >= 0) f.goals.splice(i, 1); } }
    render(); },
  aGoalAdd: () => { (S.form.goals = S.form.goals || []).push({ uid: "", assist: "", side: "" }); render(); },
  aGoalDel: t => { S.form.goals.splice(Number(t.dataset.i), 1); render(); },
  aGoalSide: t => { const g = S.form.goals[Number(t.dataset.i)]; if (g) g.side = t.dataset.v; render(); },
  aSaveResult: async t => {
    const e = S.events[t.dataset.eid]; if (!e) return; const f = S.form; t.disabled = true;
    const goals = (f.goals || []).map(g => ({ uid: g.uid || "", assist: g.assist && g.assist !== g.uid ? g.assist : "", ...(e.type === "scrim" ? { side: g.side || "" } : {}) }));
    try { await setDoc("events", e.id, { ...e, score: { us: Number(f.us) || 0, them: Number(f.them) || 0 }, scoredAt: e.scoredAt || new Date().toISOString(), goals }); await syncMyDues(); toast(e.scoredAt ? "고쳤어요" : "저장했어요. MOM 투표가 열렸어요"); location.hash = "#/game/" + e.id; } catch (err) { t.disabled = false; fail(err); }
  },
  aOppTbd: () => { S.form.oppTbd = !S.form.oppTbd; if (S.form.oppTbd) S.form.opponent = ""; render(); },
  aSaveEvent: async t => {
    const f = S.form; const eid = t.dataset.eid; const old = (eid && S.events[eid]) || {};
    if (!f.date) { toast("날짜를 골라 주세요"); return; } if (!/^\d\d:\d\d$/.test(f.time || "")) { toast("시작 시간을 골라 주세요"); return; }
    if (f.end && f.end <= f.time) { toast("끝 시간이 시작보다 늦어야 해요"); return; }
    if (f.type === "match" && !f.oppTbd && !String(f.opponent || "").trim() && !(eid && old.type === "scrim")) { toast("상대팀 이름을 적거나 미정을 눌러 주세요"); return; }
    const voteTime = String(to24(f.voteAp, f.voteH)).padStart(2, "0") + ":00";
    const probe = { date: f.date, time: f.time, voteClose: "eve", voteTime };
    if (closeAt(probe) <= Date.now() && !(eid && closeAt(old) <= Date.now())) { toast("투표 마감 시각이 이미 지났어요. 날짜나 마감 시각을 바꿔 주세요"); return; }
    const openAt = f.openDate && f.openDate > todayStr() && f.openDate <= f.date ? new Date(f.openDate + "T00:00:00+09:00").toISOString() : (eid && old.openAt && f.openDate === kstDate(old.openAt) ? old.openAt : "");
    t.disabled = true; const id = eid || uid36("e"); const type = old.type === "scrim" ? "scrim" : f.type;
    const data = { ...old, id, type, date: f.date, time: f.time, end: f.end || "", place: String(f.place || "").trim().slice(0, 40), opponent: type === "match" && !f.oppTbd ? String(f.opponent || "").trim().slice(0, 30) : "", cap: type === "scrim" ? 0 : clamp(f.cap, 0, 60, pol("cap")), voteClose: "eve", voteTime, checkBefore: clamp(f.cb, 0, 60, pol("checkBefore")), openAt, createdAt: old.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
    try { await setDoc("events", id, data); toast(eid ? "저장했어요" : openAt ? "일정을 올렸어요. 고른 날부터 투표를 받아요" : "일정을 올렸어요. 팀원이 바로 투표할 수 있어요"); location.hash = eid ? "#/manage/" + id : "#/event/" + id; } catch (err) { t.disabled = false; fail(err); }
  },
  aDelEvent: t => { const e = S.events[t.dataset.eid]; if (!e) return; const voters = people().filter(x => ((((S.rsvp[x.uid] || {}).ev || {})[e.id]) || {}).s).map(x => x.uid);
    dlg(`<h3 style="text-align:center">${md(e.date)} ${kindOf(e)}를 지울까요?</h3><span style="font-size:14px;line-height:1.6;text-align:center">${voters.length ? `투표한 ${voters.length}명에게 일정이 없어졌다고 알림이 가요.<br>` : ""}지우면 투표와 라인업도 함께 사라지고 되돌릴 수 없어요.</span><div class="grid2"><button class="btn" data-act="closeSheet" style="background:${C.blue}">남기기</button><button class="btn c" id="dOk">지우기</button></div>`);
    $("#dOk").onclick = async ev => { ev.target.disabled = true;
      try { const items = (((D("team").evlog || {}).items) || []).filter(x => Date.now() - Date.parse(x.at || 0) < 30 * 864e5).concat([{ at: new Date().toISOString(), text: `${md(e.date)} ${wd(e.date)} ${evName(e)} 일정이 없어졌어요`, to: voters }]).slice(-20);
        if (voters.length) await setDoc("team", "evlog", { items }); await delDoc("events", e.id); closeSheet(); toast("지웠어요"); location.hash = "#/schedule"; } catch (err) { ev.target.disabled = false; fail(err); } }; },
  // 경기 취소 (59번): 사유를 고르고 적고, 한 번 더 확인하면 취소하고 팀원 모두에게 알린다. 시작 전까지 되돌릴 수 있다
  aCancelEv: t => { CX.eid = t.dataset.eid; CX.r = ""; CX.t = ""; cancelSheet(); },
  aCancelPick: t => { const ta = $("#cxText"); if (ta) CX.t = ta.value; CX.r = t.dataset.r; cancelSheet(); },
  aCancelNext: () => {
    const e = S.events[CX.eid]; if (!e) return; const ta = $("#cxText"); if (ta) CX.t = ta.value.trim().slice(0, 300);
    if (!CX.r) { toast("취소 사유를 골라 주세요"); return; }
    const obj = kindOf(e) === "경기" ? "경기를" : kindOf(e) === "내전" ? "내전을" : "훈련을";
    dlg(`<h3>${md(e.date)} ${obj} 취소할까요?</h3><div style="border-left:4px solid ${C.ink};padding:4px 12px;font-size:14px;line-height:1.6"><b>사유: ${esc(CX.r)}</b>${CX.t ? `<br><span style="white-space:pre-wrap">${esc(CX.t)}</span>` : ""}</div><span style="font-size:14px;line-height:1.6">팀원 ${people().length}명에게 바로 알림이 가요. 시작 전까지는 운영진이 취소를 되돌릴 수 있어요.</span><div class="grid2"><button class="btn" data-act="aCancelBack">돌아가기</button><button class="btn" id="cxOk" style="background:${C.danger};color:${C.bg}">취소하고 알리기</button></div>`);
    $("#cxOk").onclick = async ev => { ev.target.disabled = true;
      try { const cur = S.events[CX.eid]; await setDoc("events", cur.id, { ...cur, cancel: { at: new Date().toISOString(), by: S.uid, reason: CX.r, text: CX.t }, updatedAt: new Date().toISOString() }); closeSheet(); render(); toast(`${obj} 취소했어요. 팀원에게 알렸어요`); } catch (err) { ev.target.disabled = false; fail(err); } };
  },
  aCancelBack: () => cancelSheet(),
  aUncancel: t => { const e = S.events[t.dataset.eid]; if (!e) return;
    confirmBox("취소를 되돌릴까요?", "일정이 다시 열리고 팀원에게 알림이 가요. 취소 전에 받은 투표는 그대로 남아 있어요.", "다시 열기", async () => {
      try { const { cancel, ...rest } = S.events[e.id]; await setDoc("events", e.id, { ...rest, reopenAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); render(); toast("다시 열었어요. 팀원에게 알렸어요"); } catch (err) { fail(err); } }); },
  aMercToggle: async t => { const e = S.events[t.dataset.eid]; if (!e) return; try { await setDoc("events", e.id, { ...e, guestOpen: !e.guestOpen }); render(); toast(e.guestOpen ? "용병 신청을 닫았어요" : "용병 신청을 열었어요"); } catch (err) { fail(err); } },
  aGuestOk: async t => {
    const e = S.events[t.dataset.eid]; const g = (((D("guestreq")[t.dataset.u] || {}).items) || {})[t.dataset.k]; if (!e || !g) return; t.disabled = true;
    try { await setDoc("events", e.id, { ...e, guests: { ...(e.guests || {}), [t.dataset.k]: { name: g.name, pos: g.pos || "", pos2: g.pos2 || "", by: t.dataset.u, at: new Date().toISOString(), inCap: true } } }); await patchDoc("guestreq", t.dataset.u, { items: { [t.dataset.k]: { status: "ok", doneAt: new Date().toISOString() } } }); render(); toast(`${g.name} 님을 받았어요`); } catch (err) { t.disabled = false; fail(err); }
  },
  aRemind: t => remindSheet(t.dataset.eid),
  aScrimGo: async t => {
    const e = S.events[t.dataset.eid]; if (!e) return; const a = att(e); t.disabled = true;
    const ids = [...a.yes, ...a.late, ...a.wait].map(x => x.uid); const order = POS[sport()]; const pos = u => u.startsWith("g:") ? posFix((((e.guests || {})[u.slice(2)] || {}).pos) || "") : ((profileOf(u) || {}).pos1 || "");
    ids.sort((x, y) => ((order.indexOf(pos(x)) + 99) % 99) - ((order.indexOf(pos(y)) + 99) % 99)); const T = {}; ids.forEach((u, i) => { T[u] = (i % 4 === 0 || i % 4 === 3) ? "A" : "B"; });
    try { await setDoc("events", e.id, { ...e, type: "scrim", cap: 0, teams: T, scrimAt: new Date().toISOString() }); toast("내전으로 바꿨어요. 팀원에게 알림이 가요"); location.hash = "#/manage/" + e.id; } catch (err) { t.disabled = false; fail(err); }
  },
  aScrimKeep: async t => { const e = S.events[t.dataset.eid]; if (!e) return; t.disabled = true; try { await setDoc("events", e.id, { ...e, scrimKeep: new Date().toISOString() }); toast("이번에는 경기로 해요"); location.hash = "#/manage/" + e.id; } catch (err) { t.disabled = false; fail(err); } },
  aForm: t => formSheet(t.dataset.eid),
  aFormPick: t => { closeSheet(); const e = S.events[t.dataset.eid]; if (!e) return; const side = sideOf(e); const d = draftOf(e, side); d.fkey = t.dataset.k; d.pins = [];
    if (!curLineup(e, side)) { render(); return; } UI.q = 1; saveL(e, side, autoLineup(e, side)); toast("다시 짰어요"); },
  aLinePdf: t => { const e = S.events[t.dataset.eid]; if (e) linePdf(e); },
  aAuto: t => { const e = S.events[t.dataset.eid]; if (!e) return; const side = sideOf(e); if (!formOf(draftOf(e, side).fkey, curLineup(e, side))) { toast("몇 명이 뛸지 먼저 골라 주세요"); return; } const L = autoLineup(e, side); L.pins = JSON.parse(JSON.stringify(draftOf(e, side).pins || [])); saveL(e, side, L); toast(draftOf(e, side).pins.length ? "고정한 자리는 두고 다시 짰어요" : "쿼터 수를 고르게 짰어요"); },
  aSpot: t => spotSheet(t.dataset.eid, Number(t.dataset.i)),
  aPut: t => { const e = S.events[t.dataset.eid]; if (!e) return; const side = sideOf(e); closeSheet(); const L = putAt(e, side, Number(t.dataset.i), t.dataset.u); const off = L.offPin; delete L.offPin; saveL(e, side, L); if (off) toast("선호 포지션이 아니라 이 자리에 고정했어요"); },
  aEmpty: t => { const e = S.events[t.dataset.eid]; if (!e) return; const side = sideOf(e); closeSheet(); saveL(e, side, putAt(e, side, Number(t.dataset.i), "")); },
  aPin: t => { const e = S.events[t.dataset.eid]; if (!e) return; const side = sideOf(e); const i = Number(t.dataset.i); const k = Math.min(UI.q || 1, QN[sport()]); const d = draftOf(e, side); const L = curLineup(e, side); if (!L) return; const u = (L.q[k] || {})[i]; if (!u) return;
    const on = (d.pins || []).some(x => x.u === u && x.pos === L.formation[i] && x.qs.includes(k));
    if (on) { d.pins = d.pins.map(x => x.u === u && x.pos === L.formation[i] ? { ...x, qs: x.qs.filter(z => z !== k) } : x).filter(x => x.qs.length); const N = JSON.parse(JSON.stringify(L)); N.pins = JSON.parse(JSON.stringify(d.pins)); closeSheet(); saveL(e, side, N); }
    else { applyFix(e, side, u, i, [k]); closeSheet(); saveL(e, side, S.form.lineup); } },
};
// 결과 입력: 골과 도움 고르기
document.addEventListener("change", ev => { const t = ev.target; if (t.dataset && t.dataset.goal != null && S.form.goals) { const g = S.form.goals[Number(t.dataset.goal)]; if (g) { g[t.dataset.gf] = t.value; render(); } } });
// 공지 제목을 적으면 올리기 버튼이 켜진다
document.addEventListener("input", ev => { const t = ev.target; if (t.dataset && t.dataset.bind === "title" && $("#nSave")) $("#nSave").disabled = !t.value.trim(); });
void [rulesTextOf, isKeeper, whenText, vsText, momDeadline, D];
