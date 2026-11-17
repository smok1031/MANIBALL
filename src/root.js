// 정기 점검(매주 수요일 04:00~05:00, 한국 시간)에는 점검 안내로. 테스트 사이트는 ?maint=preview 로 재현할 때만 (maint-gate.js)
const k = new Date(Date.now() + 9 * 3600e3), km = k.getUTCHours() * 60 + k.getUTCMinutes();
const isTest = /\/test\//.test(location.pathname);
let simOn = false; try { simOn = Number(sessionStorage.getItem("mb-maint-sim")) > Date.now(); } catch (e) { simOn = false; }
const maint = (isTest && (simOn || /[?&]maint=preview/.test(location.search) && !/[?&]maint=off/.test(location.search))) || (!isTest && k.getUTCDay() === 3 && km >= 240 && km < 300);
// 사이트 첫 주소: 카카오 로그인에서 돌아오거나 초대 링크로 오면 앱으로, 아니면 홈페이지로 보낸다
const q = location.search;
if (maint) location.replace("v2/maint.html" + (/[?&]maint=preview/.test(location.search) ? location.search : ""));
else location.replace((/[?&](code|error|state|join)=/.test(q) ? "v2/team/" : "v2/") + q + location.hash);
