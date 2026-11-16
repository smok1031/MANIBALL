// 정기 점검 시간(매주 수요일 04:00~05:00, 한국 시간)에는 점검 안내 화면으로 보낸다.
// 운영 사이트에만 적용하고, 테스트 사이트는 주소에 ?maint=preview 를 붙였을 때만 미리 보여 준다.
(function () {
  var W = { day: 3, start: 4 * 60, end: 5 * 60 };
  function kstNow() { var d = new Date(Date.now() + 9 * 3600e3); return { day: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes() }; }
  function inMaint() { var k = kstNow(); return k.day === W.day && k.min >= W.start && k.min < W.end; }
  var isTest = /\/test\//.test(location.pathname);
  var preview = /[?&]maint=preview/.test(location.search);
  window.MB_MAINT = { inMaint: inMaint, active: function () { return preview || (!isTest && inMaint()); } };
  if (window.MB_MAINT.active() && !/maint\.html$/.test(location.pathname)) {
    var base = location.pathname.replace(/\/v2\/.*$/, "/v2/").replace(/\/[^/]*$/, "/");
    if (!/\/v2\/$/.test(base)) base = base + "v2/";
    location.replace(base + "maint.html" + (preview ? "?maint=preview" : ""));
  }
})();
