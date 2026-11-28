// 휴대폰 알림 받기 (웹 푸시). 기기마다 켜고 끈다.
// 안드로이드: 크롬에서 바로 켠다. 아이폰: 홈 화면에 추가한 매니볼에서만 켤 수 있다(iOS 16.4 이상).
// 서비스 워커(sw.js)는 알림만 띄우고 화면 파일은 저장하지 않는다(새 버전 확인과 부딪히지 않게).
import { S, render, sheet, toast, esc, MBRAND } from "./main.js";
import { isPC } from "./pc.js";

let sb = null, reg = null, busy = false;
const KEY_LS = "mb-push-key";
const ua = navigator.userAgent || "";
const isKakao = /KAKAOTALK/i.test(ua); // 카카오톡 안 브라우저: 웹 푸시가 안 된다
const isIOS = /iP(hone|ad|od)/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const label = () => (isIOS ? "iPhone" : /Android/.test(ua) ? "Android" : "PC") + (standalone() ? " app" : "");
const b64u = s => { const t = s.replace(/-/g, "+").replace(/_/g, "/"); return Uint8Array.from(atob(t + "=".repeat((4 - t.length % 4) % 4)), c => c.charCodeAt(0)); };
const same = (a, b) => { if (!a || !b) return false; const x = new Uint8Array(a), y = new Uint8Array(b); return x.length === y.length && x.every((v, i) => v === y[i]); };

// 상태: on, off, denied(브라우저에서 막음), install(아이폰, 홈 화면 추가 필요), unsupported
export async function pushInit(client) {
  sb = client; S.push = S.push || "off";
  pushAnyLoad();
  if (isKakao) { S.push = "unsupported"; return; } // 카카오톡 안 브라우저는 아이폰이든 안드로이드든 바깥 브라우저로 보낸다
  if (isIOS && !standalone()) { S.push = "install"; return; }
  if (!supported()) { S.push = "unsupported"; return; }
  try { reg = await navigator.serviceWorker.register("sw.js", { scope: "./" }); } catch (e) { S.push = "unsupported"; return; }
  await pushRefresh();
  // 켜기 전에 공개 키를 새로 받아 둔다 (서버 키가 바뀌었으면 여기서 갈아 끼운다)
  if (S.push !== "on") call("key").then(d => { if (d && d.key) { try { localStorage.setItem(KEY_LS, d.key); } catch (e) { /* 그대로 */ } } }).catch(() => {});
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") pushRefresh(); });
}

export async function pushRefresh() {
  if (!reg || !S.uid) return;
  let st = "off";
  try {
    if (Notification.permission === "denied") st = "denied";
    else {
      const sub = await reg.pushManager.getSubscription();
      if (sub) { const { data } = await sb.rpc("push_mine", { p_endpoint: sub.endpoint }); st = data ? "on" : "off"; }
    }
  } catch (e) { st = S.push || "off"; }
  if (st !== S.push) { S.push = st; render(); }
}

async function call(action) {
  const { data, error } = await sb.functions.invoke("push", { body: { action } });
  if (error) throw error;
  return data || {};
}

// 서버 공개 키(VAPID)는 미리 받아 이 기기에 둔다: 켜기를 누를 때 서버 함수를 기다리지 않게
let keyP = null;
function pushKey() {
  let k = ""; try { k = localStorage.getItem(KEY_LS) || ""; } catch (e) { /* 저장소를 못 쓰면 매번 받는다 */ }
  if (k) return Promise.resolve(k);
  if (!keyP) keyP = call("key").then(d => { const v = (d && d.key) || ""; if (v) { try { localStorage.setItem(KEY_LS, v); } catch (e) { /* 그대로 */ } } keyP = null; return v; }).catch(e => { keyP = null; throw e; });
  return keyP;
}
async function turnOn() {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") { S.push = perm === "denied" ? "denied" : "off"; if (perm === "denied") deniedSheet(); return; }
  // 허락을 받으면 화면은 바로 켜진 모양으로 바꾸고, 등록은 뒤에서 마친다 (실패하면 되돌린다)
  S.push = "on"; busy = false; render();
  const key = await pushKey();
  if (!key) throw new Error("no_key");
  const appKey = b64u(key);
  let sub = await reg.pushManager.getSubscription();
  if (sub && !same(sub.options && sub.options.applicationServerKey, appKey)) { await sub.unsubscribe().catch(() => {}); sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
  const j = sub.toJSON();
  const { error } = await sb.rpc("push_subscribe", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_ua: label() });
  if (error) throw error;
  S.pushAny = true; render(); // 이제 이 계정은 알림이 켜져 있어서 관문을 지난다
  call("test").catch(() => {}); // "알림을 켰어요" 한 번 보내 확인
  toast("알림을 켰어요. 소리 없이 화면에만 떠요");
}


export async function pushToggle() {
  if (busy) return;
  if (S.push === "install") return installSheet();
  if (S.push === "unsupported") return toast("이 브라우저는 알림을 받을 수 없어요. 휴대폰 크롬이나 홈 화면에 추가한 매니볼에서 켜 주세요");
  if (S.push === "denied" && Notification.permission === "denied") return deniedSheet();
  // 알림 끄기는 없앴다: 켜져 있으면 아무것도 하지 않는다
  if (S.push === "on") return;
  busy = true; render();
  try { await turnOn(); }
  catch (e) { console.error(e); S.push = "off"; toast("알림을 켜지 못했어요. 잠시 뒤 다시 해 주세요"); await pushRefresh(); }
  finally { busy = false; render(); }
}
export const pushBusy = () => busy;

// 로그아웃할 때 이 기기 알림을 끊는다 (다른 사람이 같은 기기를 쓸 때 내 알림이 가지 않게)
export async function pushDetach() {
  try { const sub = reg && await reg.pushManager.getSubscription(); if (sub) { await sb.rpc("push_unsubscribe", { p_endpoint: sub.endpoint }); await sub.unsubscribe(); } } catch (e) { /* 그래도 로그아웃 */ }
}

function installSheet() {
  sheet(`<h3 style="margin:0;font-size:20px">홈 화면에 추가해 주세요</h3>
    <span style="font-size:14px;line-height:1.6">아이폰은 홈 화면에 추가한 매니볼에서만 알림을 받을 수 있어요 (iOS 16.4 이상).</span>
    <ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.8">
      <li>사파리 아래쪽 공유 버튼을 눌러요</li>
      <li>"홈 화면에 추가"를 눌러요</li>
      <li>홈 화면의 매니볼을 열고 카카오로 한 번 더 로그인해요</li>
      <li>홈에서 "알림 받기"를 켜요</li>
    </ol>
    <button class="btn pri" data-act="closeSheet" style="height:48px">알겠어요</button>`);
}
function deniedSheet() {
  sheet(`<h3 style="margin:0;font-size:20px">알림이 막혀 있어요</h3>
    <span style="font-size:14px;line-height:1.6">${isIOS ? "아이폰 설정 &gt; 알림 &gt; 매니볼에서 알림 허용을 켠 뒤" : "크롬 주소창 왼쪽 자물쇠(사이트 설정) &gt; 알림에서 허용으로 바꾼 뒤"} 다시 켜 주세요.</span>
    <button class="btn pri" data-act="closeSheet" style="height:48px">알겠어요</button>`);
}

// 알림 관문 (2026-11-27 시안 6-7, PC 6-7): 어느 기기에서도 알림을 안 켠 계정은 알림을 켜야 팀으로 들어간다. 나중에 하기는 없다.
// 기준은 계정: 휴대폰이든 PC든 한 곳이라도 켜 두었으면 막지 않는다 (push_any). 체험 계정은 막지 않는다.
// 서버 확인이 실패하면 막지 않는다 (서버 문제로 모두가 갇히지 않게).
export async function pushAnyLoad() {
  try { const { data, error } = await sb.rpc("push_any"); if (error) throw error; S.pushAny = !!data; }
  catch (e) { S.pushAny = true; }
  render();
}
export const pushGateOn = () => !!(S.uid && S.pushAny === false && S.push !== "on" && !(S.session && S.session.user && S.session.user.is_anonymous));

const BELL = "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0";
const svgI = (d, n, w) => `<svg aria-hidden="true" width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="#121110" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"></path></svg>`;
export function vPushGate() {
  const pc = isPC(); const st = S.push || "off"; const team = S.team ? S.team.name : "";
  const android = /Android/.test(ua); const app = standalone();
  const denied = st === "denied", install = st === "install", un = st === "unsupported";
  let title = "알림을 켜고 들어가요", lead = "투표 마감, 라인업, 대기 자리를 놓치지 않게 알려 드려요. 소리 없이 조용히 와요.";
  let howT = "", how = [], btn = "알림 켜기", icon = BELL, act = "pushGateGo", note = pc ? "휴대폰이나 다른 PC에서 이미 알림을 켰다면 이 화면은 나오지 않아요" : "알림은 소리와 진동 없이 화면에만 조용히 와요";
  if (un && isKakao) {
    title = "카카오톡에서는\n알림이 안 와요"; icon = "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5";
    if (isIOS) { lead = "카카오톡으로 연 화면에서는 알림이 오지 않아요. Safari로 열어서 홈 화면에 추가해 주세요."; howT = "아이폰은 Safari에서 홈 화면에 추가해야 알림이 와요"; how = ["아래 버튼으로 Safari에서 열어요", 'Safari 공유 버튼에서 "홈 화면에 추가"를 골라요', "홈 화면의 매니볼로 열고 알림을 켜요"]; btn = "Safari로 열기"; }
    else { lead = "카카오톡으로 연 화면에서는 알림이 오지 않아요. " + (pc ? "크롬이나 엣지로 열면 바로 켤 수 있어요." : "크롬으로 열면 바로 켤 수 있어요."); howT = "크롬에서는 바로 켤 수 있어요"; how = ["아래 버튼으로 크롬에서 열어요", "크롬에서 알림 켜기를 눌러요"]; btn = "크롬으로 열기"; }
    act = "pushGateOut"; note = "카카오톡 안에서는 여기서 더 들어갈 수 없어요";
  } else if (install) {
    title = "홈 화면에 추가하고 들어가요"; lead = "아이폰은 Safari에서는 알림이 오지 않아요. 매니볼을 홈 화면에 추가하고, 그 아이콘으로 열어서 알림을 켜 주세요.";
    howT = "아이폰은 홈 화면에 추가해야 알림이 와요"; how = ["Safari 아래쪽 공유 버튼을 눌러요", '"홈 화면에 추가"를 골라요', "홈 화면의 매니볼로 열고 알림을 켜요"];
    btn = "홈 화면에 추가하는 법 알겠어요"; icon = "M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"; act = "pushGateInstall"; note = "Safari에서는 여기서 더 들어갈 수 없어요";
  } else if (un) {
    title = "이 브라우저는 알림이 안 와요"; lead = "다른 앱 안에서 연 창이나 오래된 브라우저에서는 알림을 켤 수 없어요. " + (pc ? "크롬이나 엣지로 열어 주세요." : "크롬으로 열어 주세요.");
    howT = pc ? "크롬이나 엣지로 여는 법" : "크롬으로 여는 법"; how = ["아래 버튼으로 주소를 복사해요", (pc ? "크롬이나 엣지" : "크롬") + "를 열고 주소를 붙여 넣어요", "로그인한 뒤 알림 켜기를 눌러요"];
    btn = "주소 복사하기"; icon = "M9 9h11v11H9zM5 15H4V4h11v1"; act = "pushGateCopy"; note = "이 브라우저에서는 여기서 더 들어갈 수 없어요";
  } else if (denied) {
    title = "알림을 막아서 들어갈 수 없어요";
    lead = (pc ? "브라우저에서 매니볼 알림을 막아 두어서" : "휴대폰 설정에서 막혀 있어서") + " 매니볼이 다시 물어볼 수 없어요. 아래 순서대로 허용한 뒤 다시 확인을 눌러 주세요.";
    howT = pc ? "크롬, 엣지에서 허용하는 법" : "알림 허용하는 법";
    how = pc ? ["주소창 왼쪽의 사이트 정보 아이콘을 눌러요", "알림을 허용으로 바꿔요", "이 화면에서 다시 확인을 눌러요"]
      : isIOS ? ["아이폰 설정을 열어요", "알림에서 매니볼을 골라요", "알림 허용을 켜고 돌아와 다시 확인을 눌러요"]
      : app ? ["매니볼 앱 아이콘을 길게 눌러요", "앱 정보에서 알림을 골라요", "알림 허용을 켜고 돌아와 다시 확인을 눌러요"]
      : ["주소창 왼쪽 아이콘을 눌러요", "권한에서 알림을 허용으로 바꿔요", "돌아와 다시 확인을 눌러요"];
    btn = pc ? "허용했어요, 다시 확인하기" : "켰어요, 다시 확인하기"; icon = "M3 12a9 9 0 1 0 3-6.7M3 4v5h5"; act = "pushGateCheck"; note = "알림을 켜기 전에는 팀으로 들어갈 수 없어요";
  }
  const chips = [["투표 마감 전", "#FCD01A"], ["라인업이 나오면", "#14BBC2"], ["대기에서 자리가 나면", "#B8E9EB"], ["벌금과 경기 취소", "#F2A7C3"]]
    .map(([t, c]) => `<span class="pgc"><i style="background:${c}"></i>${t}</span>`).join("");
  const steps = how.length ? `<div class="pgh"><b>${esc(howT)}</b>${how.map((t, i) => `<span><b class="pgn">${i + 1}</b><span>${esc(t)}</span></span>`).join("")}</div>` : "";
  const mobileDenied = denied && !pc; // 휴대폰 6-7-4는 머리표와 종 없이 글로만
  const busy = pushBusy();
  return `<div class="pg${pc ? " pgpc" : ""}${mobileDenied ? " pgleft" : ""}">
    ${pc ? `<header class="pghd">${MBRAND(40)}<span>${esc(team)}</span></header>` : ""}
    <main class="pgm"><div class="pgcard">
      ${mobileDenied ? "" : `<span class="pgtop"><span class="pglb">로그인 마지막 단계</span>${pc ? "" : `<span class="pgtm">${esc(team)}</span>`}</span>
      <span class="pgbell${denied || (un && !isKakao) ? " off" : " ding"}" aria-hidden="true">${svgI(BELL, pc ? 50 : 46, 2.2)}</span>`}
      <h1 class="pgt">${esc(title)}</h1>
      <span class="pgl">${esc(lead)}</span>
      ${!denied && !un && !install ? `<div class="pgcs">${chips}</div>` : ""}
      ${steps}
      <div class="pgb">
        <b>알림을 켜야 팀으로 들어갈 수 있어요</b>
        <button type="button" class="pgbtn" data-act="${act}"${busy ? " disabled" : ""}>${svgI(icon, 22, 2.4)}${busy ? "켜는 중이에요" : btn}</button>
        <span class="pgnote">${note}</span>
      </div>
    </div></main>
  </div>`;
}
export async function pushGateCheck() {
  await pushRefresh();
  if (S.push === "on") return;
  if (S.push === "denied" || Notification.permission === "denied") return toast("아직 막혀 있어요. 순서대로 허용한 뒤 다시 눌러 주세요");
  return pushToggle(); // 허용으로 바뀌었으면 바로 켠다
}
export function pushGateOut() {
  // 카카오톡 안 브라우저에서 바깥 브라우저(크롬, Safari)로 연다
  location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(location.href);
}
export async function pushGateCopy() {
  try { await navigator.clipboard.writeText(location.href); toast("주소를 복사했어요. 크롬이나 엣지 주소창에 붙여 넣어 주세요"); }
  catch (e) { toast("복사하지 못했어요. 주소창의 주소를 길게 눌러 복사해 주세요"); }
}
export const pushGateInstall = () => toast("홈 화면에 추가한 뒤 그 아이콘으로 열면 알림 켜기 화면이 떠요");
