// 휴대폰 알림 받기 (웹 푸시). 기기마다 켜고 끈다.
// 안드로이드: 크롬에서 바로 켠다. 아이폰: 홈 화면에 추가한 매니볼에서만 켤 수 있다(iOS 16.4 이상).
// 서비스 워커(sw.js)는 알림만 띄우고 화면 파일은 저장하지 않는다(새 버전 확인과 부딪히지 않게).
import { S, render, sheet, toast } from "./main.js";

let sb = null, reg = null, busy = false;
const ua = navigator.userAgent || "";
const isIOS = /iP(hone|ad|od)/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const label = () => (isIOS ? "iPhone" : /Android/.test(ua) ? "Android" : "PC") + (standalone() ? " app" : "");
const b64u = s => { const t = s.replace(/-/g, "+").replace(/_/g, "/"); return Uint8Array.from(atob(t + "=".repeat((4 - t.length % 4) % 4)), c => c.charCodeAt(0)); };
const same = (a, b) => { if (!a || !b) return false; const x = new Uint8Array(a), y = new Uint8Array(b); return x.length === y.length && x.every((v, i) => v === y[i]); };

// 상태: on, off, denied(브라우저에서 막음), install(아이폰, 홈 화면 추가 필요), unsupported
export async function pushInit(client) {
  sb = client; S.push = S.push || "off";
  if (isIOS && !standalone()) { S.push = "install"; return; }
  if (!supported()) { S.push = "unsupported"; return; }
  try { reg = await navigator.serviceWorker.register("sw.js", { scope: "./" }); } catch (e) { S.push = "unsupported"; return; }
  await pushRefresh();
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

async function turnOn() {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") { S.push = perm === "denied" ? "denied" : "off"; if (perm === "denied") deniedSheet(); return; }
  const { key } = await call("key");
  if (!key) throw new Error("no_key");
  const appKey = b64u(key);
  let sub = await reg.pushManager.getSubscription();
  if (sub && !same(sub.options && sub.options.applicationServerKey, appKey)) { await sub.unsubscribe().catch(() => {}); sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
  const j = sub.toJSON();
  const { error } = await sb.rpc("push_subscribe", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_ua: label() });
  if (error) throw error;
  S.push = "on";
  call("test").catch(() => {}); // "알림을 켰어요" 한 번 보내 확인
  toast("알림을 켰어요");
}

async function turnOff() {
  const sub = await reg.pushManager.getSubscription();
  if (sub) { await sb.rpc("push_unsubscribe", { p_endpoint: sub.endpoint }); await sub.unsubscribe().catch(() => {}); }
  S.push = "off"; toast("알림을 껐어요");
}

export async function pushToggle() {
  if (busy) return;
  if (S.push === "install") return installSheet();
  if (S.push === "unsupported") return toast("이 브라우저는 알림을 받을 수 없어요. 휴대폰 크롬이나 홈 화면에 추가한 매니볼에서 켜 주세요");
  if (S.push === "denied" && Notification.permission === "denied") return deniedSheet();
  busy = true; render();
  try { if (S.push === "on") await turnOff(); else await turnOn(); }
  catch (e) { console.error(e); toast("알림 설정을 바꾸지 못했어요. 잠시 뒤 다시 해 주세요"); await pushRefresh(); }
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
