// 정기 점검 시간(매주 수요일 04:00~05:00, 한국 시간)에는 점검 안내 화면으로 보낸다.
// 운영 사이트에만 적용한다. 테스트 사이트는 주소에 ?maint=preview 를 붙이면 실제 점검처럼 재현한다:
// 그 탭에서 정한 시간(기본 5분, &left=분 으로 바꿈) 동안 홈페이지와 앱 어디로 가도 점검 안내가 뜨고,
// 시간이 다 되면 실제처럼 앱이 다시 열린다. ?maint=off 를 붙이면 재현을 바로 끝낸다.
(function () {
  var W = { day: 3, start: 4 * 60, end: 5 * 60 }, KEY = "mb-maint-sim";
  function kstNow() { var d = new Date(Date.now() + 9 * 3600e3); return { day: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes() }; }
  function inMaint() { var k = kstNow(); return k.day === W.day && k.min >= W.start && k.min < W.end; }
  var isTest = /\/test\//.test(location.pathname), q = location.search;
  function ss(fn) { try { return fn(window.sessionStorage); } catch (e) { return null; } }
  // 재현 끝나는 시각 (테스트 사이트에서만)
  function simEnd() { var v = Number(ss(function (s) { return s.getItem(KEY); })); return v > Date.now() ? v : 0; }
  if (isTest) {
    if (/[?&]maint=off/.test(q)) ss(function (s) { s.removeItem(KEY); });
    else if (/[?&]maint=preview/.test(q) && !simEnd()) {
      var m = Number((q.match(/[?&]left=(\d+)/) || [])[1]) || 5; m = Math.max(1, Math.min(60, m));
      ss(function (s) { s.setItem(KEY, String(Date.now() + m * 60e3)); });
    }
  }
  function sim() { return isTest && simEnd() > 0; }
  // 남은 분: 실제 점검은 05:00까지, 재현은 정한 시각까지 (올림)
  function minutesLeft() {
    if (sim()) return Math.max(0, Math.ceil((simEnd() - Date.now()) / 60e3));
    var k = kstNow(); return inMaint() ? W.end - k.min : 0;
  }
  window.MB_MAINT = { inMaint: inMaint, sim: sim, minutesLeft: minutesLeft, active: function () { return sim() || (!isTest && inMaint()); }, stop: function () { ss(function (s) { s.removeItem(KEY); }); } };
  if (window.MB_MAINT.active() && !/maint\.html$/.test(location.pathname)) {
    var base = location.pathname.replace(/\/v2\/.*$/, "/v2/").replace(/\/[^/]*$/, "/");
    if (!/\/v2\/$/.test(base)) base = base + "v2/";
    location.replace(base + "maint.html");
  }
})();
