// 점검 안내 화면: 다시 열리기까지 남은 분(업로드 전에 계산한 예상 시각), 이번에 바뀌는 것(수정 전, 수정 후).
// 처음에는 휴대폰 3개, PC 4개만 보이고 "더 보기"로 전부 펼친다. 업로드가 끝나면(점검 꺼짐) 바로 앱으로 돌아간다.
(function () {
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var $ = function (id) { return document.getElementById(id); };
  var box = $("notes"), total = $("total"), left = $("left"), leftBox = $("leftBox"), lb = $("leftLb"), win = $("win"), unsaved = $("unsaved");
  var notes = [], open = false, pc = window.matchMedia("(min-width: 900px)");
  var ARROW = { down: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14182B" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>', up: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14182B" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"></path></svg>' };
  function draw() {
    if (!notes.length) { box.innerHTML = '<div class="ch"><div class="ch-a" style="border-top:0"><span class="tx">이번에는 바뀌는 것 없이 점검만 해요.</span></div></div>'; total.textContent = ""; return; }
    var first = pc.matches ? 4 : 3, rest = notes.length - first, shown = open || rest <= 0 ? notes : notes.slice(0, first);
    total.textContent = notes.length + "개";
    box.innerHTML = shown.map(function (x, i) {
      return '<article class="ch"><div class="ch-h"><span class="no">' + (i < 9 ? "0" : "") + (i + 1) + '</span><b>' + esc(x.title) + '</b></div><div class="ch-b"><span class="tag">수정 전</span><span class="tx">' + esc(x.before) + '</span></div><div class="ch-a"><span class="tag a">수정 후</span><span class="tx">' + esc(x.after) + '</span></div></article>';
    }).join("") + (rest > 0 ? '<button type="button" class="more" id="more" aria-expanded="' + open + '">' + (open ? "접기" + ARROW.up : "나머지 " + rest + "개 더 보기" + ARROW.down) + "</button>" : "");
  }
  box.addEventListener("click", function (ev) {
    if (!ev.target.closest || !ev.target.closest("#more")) return;
    open = !open; draw();
    var b = $("more"); if (b) b.focus({ preventScroll: true });
  });
  if (pc.addEventListener) pc.addEventListener("change", draw);
  fetch("../maint.json?" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) { notes = j.notes || []; draw(); })
    .catch(function () { box.innerHTML = '<div class="ch"><div class="ch-a" style="border-top:0"><span class="tx">바뀌는 내용을 불러오지 못했어요.</span></div></div>'; });

  // 점검 직전에 눌렀지만 저장되지 않은 것이 있으면 알려 준다 (앱이 기록해 둠)
  try { var u = Number(sessionStorage.getItem("mb-unsaved")) || 0; if (u > 0) { unsaved.hidden = false; $("unsavedN").textContent = u; } } catch (e) { /* 무시 */ }

  // 마우스로 화면을 잡고 끌어서 내리기 (스크롤바 없음). 휴대폰은 손가락으로 원래대로 내린다
  (function () {
    var d = null, moved = false;
    var target = function () { return pc.matches ? box : document.scrollingElement; };
    document.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse" || e.button !== 0) return; var el = target(); if (!el) return; d = { y: e.clientY, top: el === document.scrollingElement ? window.scrollY : el.scrollTop, el: el }; moved = false; document.body.classList.add("drag"); });
    document.addEventListener("pointermove", function (e) { if (!d) return; var dy = e.clientY - d.y; if (Math.abs(dy) > 6) moved = true; if (!moved) return; if (d.el === document.scrollingElement) window.scrollTo(0, d.top - dy); else d.el.scrollTop = d.top - dy; });
    var up = function () { d = null; document.body.classList.remove("drag"); };
    document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
    document.addEventListener("click", function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    document.addEventListener("dragstart", function (e) { e.preventDefault(); });
  })();

  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var hm = function (ms) { var d = new Date(ms + 9 * 3600e3); return pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()); };
  var known = false, seenOn = false, wasSim = false;
  // 점검이 끝나면 새 버전 주소로 앱을 연다 (예전 화면이 브라우저에 남아 있지 않게)
  function reopen() {
    var M = window.MB_MAINT; if (M && M.stop) M.stop();
    try { sessionStorage.removeItem("mb-unsaved"); } catch (e) { /* 무시 */ }
    fetch("../version.txt?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.text() : ""; }).catch(function () { return ""; })
      .then(function (v) { v = (v || "").trim(); location.replace("team/" + (/^[0-9a-f]{7,40}$/.test(v) ? "?v=" + v : "")); });
  }
  function tick() {
    var M = window.MB_MAINT; if (!M) return;
    var s = M.status && M.status();
    if (s) known = true;
    if (M.active()) seenOn = true;
    if (M.sim()) wasSim = true; else if (wasSim) { reopen(); return; }
    // DB 상태를 읽었는데 점검이 아니면(또는 끝났으면) 앱으로
    if (!M.sim() && known && !M.active() && !M.announced()) { reopen(); return; }
    if (M.sim() || M.active()) {
      var e = M.endAt();
      if (e && win) win.textContent = (M.sim() ? "미리 보기, " : "") + hm(M.sim() ? Date.now() : (s.start || Date.now())) + " 시작, " + hm(e) + " 열림 예정";
      var n = M.minutesLeft();
      if (n > 0) { lb.textContent = "다시 열리기까지"; left.textContent = n; leftBox.hidden = false; }
      else { lb.textContent = "거의 다 됐어요. 끝나면 바로 열려요"; leftBox.hidden = true; }
    }
  }
  if (window.MB_MAINT) window.MB_MAINT.onchange = tick;
  tick(); setInterval(tick, 2000);
  // 상태를 끝내 못 읽으면(인터넷 문제) 계속 이 화면에 두고 다시 확인한다
  setInterval(function () { if (window.MB_MAINT && (seenOn || !known)) window.MB_MAINT.refresh(); }, 5000);
})();
