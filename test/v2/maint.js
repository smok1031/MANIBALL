// 점검 안내 화면: 점검 시간과 이번 점검에서 바뀌는 것(수정 전, 수정 후)을 보여 주고, 05:00이 지나면 앱으로 돌려보낸다
(function () {
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var box = document.getElementById("notes"), left = document.getElementById("left");
  fetch("../maint.json?" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
    if (j.window) document.getElementById("win").textContent = j.window + " (한국 시간)";
    var n = j.notes || [];
    box.innerHTML = n.length ? n.map(function (x) {
      return '<div class="card"><b class="t">' + esc(x.title) + '</b><div class="ba"><span class="tag b">수정 전</span><span>' + esc(x.before) + '</span></div><div class="ba"><span class="tag a">수정 후</span><span>' + esc(x.after) + '</span></div></div>';
    }).join("") : '<div class="card"><span class="muted">이번 주는 바뀌는 것 없이 점검만 해요.</span></div>';
  }).catch(function () { box.innerHTML = '<div class="card"><span class="muted">바뀌는 내용을 불러오지 못했어요.</span></div>'; });
  function tick() {
    var M = window.MB_MAINT, preview = /[?&]maint=preview/.test(location.search);
    var d = new Date(Date.now() + 9 * 3600e3), min = d.getUTCHours() * 60 + d.getUTCMinutes();
    if (!preview && M && !M.inMaint()) { location.replace("team/"); return; }
    var rest = 5 * 60 - min; left.textContent = preview ? "미리 보기 화면이에요" : rest > 0 && rest <= 60 ? "다시 열리기까지 약 " + rest + "분" : "";
  }
  tick(); setInterval(tick, 30000);
})();
