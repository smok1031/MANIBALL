// 사이트 첫 주소: 카카오 로그인에서 돌아오거나 초대 링크로 오면 앱으로, 아니면 홈페이지로 보낸다.
// 점검 중이면 도착한 페이지의 점검 문지기(maint-gate.js)가 점검 안내로 보낸다.
// 테스트 사이트의 점검 화면 미리 보기(?maint=preview)는 안내 화면으로 바로 보낸다
const q = location.search;
if (/\/test\//.test(location.pathname) && /[?&]maint=preview/.test(q)) location.replace("v2/maint.html" + q);
else location.replace((/[?&](code|error|state|join)=/.test(q) ? "v2/team/" : "v2/") + q + location.hash);
