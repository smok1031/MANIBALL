// 사이트 첫 주소: 카카오 로그인에서 돌아오거나 초대 링크로 오면 앱으로, 아니면 홈페이지로 보낸다
const q = location.search;
location.replace((/[?&](code|error|state|join)=/.test(q) ? "v2/team/" : "v2/") + q + location.hash);
