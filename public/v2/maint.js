// 점검 안내 화면: 점검 시간, 다시 열리기까지 남은 분, 이번 점검에서 바뀌는 것(수정 전, 수정 후)을 보여 준다.
// 처음에는 휴대폰 3개, PC 4개만 보이고 "더 보기"로 전부 펼친다. 점검이 끝나면 앱으로 돌려보낸다.
(function () {
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var box = document.getElementById("notes"), total = document.getElementById("total"), left = document.getElementById("left"), leftBox = document.getElementById("leftBox");
  var notes = [], open = false, pc = window.matchMedia("(min-width: 900px)");
  var ARROW = { down: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14182B" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"></path></svg>', up: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14182B" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"></path></svg>' };
  function draw() {
    if (!notes.length) { box.innerHTML = '<div class="ch"><div class="ch-a" style="border-top:0"><span class="tx">이번 주는 바뀌는 것 없이 점검만 해요.</span></div></div>'; total.textContent = ""; return; }
    var first = pc.matches ? 4 : 3, rest = notes.length - first, shown = open || rest <= 0 ? notes : notes.slice(0, first);
    total.textContent = notes.length + "개";
    box.innerHTML = shown.map(function (x, i) {
      return '<article class="ch"><div class="ch-h"><span class="no">' + (i < 9 ? "0" : "") + (i + 1) + '</span><b>' + esc(x.title) + '</b></div><div class="ch-b"><span class="tag">수정 전</span><span class="tx">' + esc(x.before) + '</span></div><div class="ch-a"><span class="tag a">수정 후</span><span class="tx">' + esc(x.after) + '</span></div></article>';
    }).join("") + (rest > 0 ? '<button type="button" class="more" id="more" aria-expanded="' + open + '">' + (open ? "접기" + ARROW.up : "나머지 " + rest + "개 더 보기" + ARROW.down) + "</button>" : "");
  }
  box.addEventListener("click", function (ev) {
    if (!ev.target.closest || !ev.target.closest("#more")) return;
    open = !open; draw();
    var b = document.getElementById("more"); if (b) b.focus({ preventScroll: true });
  });
  if (pc.addEventListener) pc.addEventListener("change", draw);
  fetch("../maint.json?" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
    if (j.window) document.getElementById("win").textContent = j.window;
    notes = j.notes || []; draw();
  }).catch(function () { box.innerHTML = '<div class="ch"><div class="ch-a" style="border-top:0"><span class="tx">바뀌는 내용을 불러오지 못했어요.</span></div></div>'; });

  // 마우스로 화면을 잡고 끌어서 내리기 (스크롤바 없음). 휴대폰은 손가락으로 원래대로 내린다
  function dragScroll(get) {
    var d = null, moved = false;
    document.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse" || e.button !== 0) return; var el = get(); if (!el) return; d = { y: e.clientY, top: el === document.scrollingElement ? window.scrollY : el.scrollTop, el: el }; moved = false; document.body.classList.add("drag"); });
    document.addEventListener("pointermove", function (e) { if (!d) return; var dy = e.clientY - d.y; if (Math.abs(dy) > 6) moved = true; if (!moved) return; if (d.el === document.scrollingElement) window.scrollTo(0, d.top - dy); else d.el.scrollTop = d.top - dy; });
    var up = function () { d = null; document.body.classList.remove("drag"); };
    document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
    document.addEventListener("click", function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    document.addEventListener("dragstart", function (e) { e.preventDefault(); });
  }
  dragScroll(function () { return pc.matches ? box : document.scrollingElement; });

  // 남은 분, 점검이 끝나면 앱으로
  function tick() {
    var M = window.MB_MAINT;
    if (!M || !M.active()) { if (M && M.stop) M.stop(); location.replace("team/"); return; }
    var n = M.minutesLeft();
    if (n > 0) { left.textContent = n; leftBox.style.visibility = ""; } else leftBox.style.visibility = "hidden";
  }
  tick(); setInterval(tick, 5000);
})();
