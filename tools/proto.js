// 화면 둘러보기(눌러 보기용 정적 화면)에서 같은 화면 안에서 바뀌는 버튼을 움직이게 한다.
// 선택 칩, 단계 버튼(+ -), 켜고 끄기, 체크, 출석/지각/결석, 받음/수락/거절/삭제, 복사, 달 넘기기 등.
(function () {
  "use strict";
  var ACC = /#15803D|rgb\(21, 128, 61\)/i;

  function toast(msg) {
    var old = document.getElementById("mb-toast");
    if (old) old.remove();
    var t = document.createElement("div");
    t.id = "mb-toast";
    t.textContent = msg;
    t.setAttribute("role", "status");
    t.style.cssText = "position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:99;max-width:min(420px,calc(100% - 32px));box-sizing:border-box;background:#111827;color:#fff;font:700 14px/1.5 'Noto Sans KR',sans-serif;padding:12px 16px;border-radius:14px;box-shadow:0 10px 24px rgba(17,24,39,.25);text-align:center;word-break:keep-all";
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2000);
  }

  var TOASTS = {
    "포지션 맞춰 휴식 자동 배치": "포지션에 맞춰 휴식을 다시 배치했어요",
    "팀 실력 비슷하게 자동으로 나누기": "실력이 비슷하게 A팀과 B팀을 나눴어요",
    "한 장 PDF 저장": "라인업을 PDF 한 장으로 저장했어요",
    "라인업 준비 중": "운영진이 라인업을 올리면 알림으로 알려 드려요",
    "모두 선택": "전체 선수를 모두 골랐어요"
  };

  function st(el) { return el.getAttribute("style") || ""; }
  function selScore(el) {
    var s = st(el);
    if (/background: (#15803D|rgb\(21, 128, 61\))/i.test(s)) return 4;
    if (/background: (#111827|rgb\(17, 24, 39\))/i.test(s)) return 3;
    if (/box-shadow: 0 1px 3px/.test(s)) return 2;
    if (/box-shadow: inset/.test(s)) return 1;
    return 0;
  }
  // 같은 이름 버튼이 화면 어딘가에서 '골라진' 모양이면 그 모양을 쓴다 (출석/지각/결석 색이 서로 달라서)
  function selectedStyleFor(label) {
    var all = document.querySelectorAll('a[href="#"]');
    for (var i = 0; i < all.length; i++) {
      if (all[i].textContent.trim() === label && selScore(all[i]) > 0) return st(all[i]);
    }
    return null;
  }

  function stepper(a, dir) {
    var p = a.parentElement;
    var b = Array.prototype.find.call(p.children, function (x) { return x.tagName === "B"; });
    if (!b) return false;
    var m = b.textContent.match(/^(-?\d+)(.*)$/);
    if (!m) return false;
    var n = Math.max(0, parseInt(m[1], 10) + dir);
    b.textContent = n + m[2];
    b.style.color = n ? "#111827" : "#D1D5DB";
    return true;
  }

  function toggleSwitch(a) {
    var knob = a.querySelector("span");
    var on = ACC.test(a.style.background) || ACC.test(st(a));
    a.style.background = on ? "#D1D5DB" : "#15803D";
    if (knob) { knob.style.left = on ? "3px" : ""; knob.style.right = on ? "" : "3px"; }
  }

  function checkbox(a) {
    var on = a.textContent.trim() === "✓";
    if (on) {
      a.textContent = "";
      a.style.background = "transparent";
      a.style.border = "2px solid #D1D5DB";
      a.style.boxSizing = "border-box";
    } else {
      a.textContent = "✓";
      a.style.background = "#15803D";
      a.style.color = "#FFFFFF";
      a.style.border = "none";
    }
  }

  function rowOf(a) {
    var el = a.parentElement;
    while (el && el !== document.body) {
      if (/border-bottom: 1px solid/.test(st(el)) || /padding: 12px 0/.test(st(el))) return el;
      el = el.parentElement;
    }
    return a.parentElement;
  }

  function fadeOut(el) {
    el.style.transition = "opacity .25s";
    el.style.opacity = "0";
    setTimeout(function () { el.remove(); }, 260);
  }

  function selectIn(a) {
    var sibs = Array.prototype.filter.call(a.parentElement.children, function (x) { return x.tagName === "A"; });
    if (sibs.length < 2) return false;
    var multi = (a.closest("section") || a.parentElement.parentElement).textContent.indexOf("여러 개") >= 0;
    var cur = null, best = 0;
    sibs.forEach(function (x) { var s = selScore(x); if (s > best && x !== a) { best = s; cur = x; } });
    var plain = sibs.find(function (x) { return selScore(x) === 0 && x !== a; });
    var label = a.textContent.trim();
    if (multi) {
      var on = selScore(a) > 0;
      var selS = cur ? st(cur) : selectedStyleFor(label);
      if (on && plain) a.setAttribute("style", st(plain));
      else if (!on && selS) a.setAttribute("style", selS);
      return true;
    }
    if (selScore(a) > 0 && selScore(a) >= best) return true; // 이미 골라짐
    var mine = selectedStyleFor(label);
    var curStyle = cur ? st(cur) : null;
    var plainStyle = plain ? st(plain) : null;
    if (cur && plainStyle) cur.setAttribute("style", plainStyle);
    else if (cur) cur.setAttribute("style", st(a));
    if (mine) a.setAttribute("style", mine);
    else if (curStyle) a.setAttribute("style", curStyle);
    else { a.style.background = "#15803D"; a.style.color = "#FFFFFF"; a.style.border = "1px solid #15803D"; }
    afterSelect(a, label);
    return true;
  }

  // 선수 등록과 유니폼 화면: 고른 값이 선수 카드 미리보기에 바로 보이게
  function afterSelect(a, label) {
    var sec = a.closest("section");
    if (!sec) return;
    var head = (sec.querySelector("span") || {}).textContent || "";
    var all = function (sel, fn) { document.querySelectorAll(sel).forEach(fn); };
    if (head.indexOf("1선호") === 0) all("[data-pos1]", function (x) { x.textContent = label; });
    if (head.indexOf("2선호") === 0) all("[data-pos2]", function (x) {
      x.textContent = label;
      x.parentElement.style.display = label === "없음" ? "none" : "";
    });
    if (head.indexOf("등번호") === 0 && /^\d+$/.test(label)) {
      all("[data-num]", function (x) { x.textContent = label; });
      all("[data-numtext]", function (x) { x.textContent = label; });
      var v = sec.querySelector("label span + span");
      if (v && v.firstChild) v.firstChild.nodeValue = label;
    }
    if (head.indexOf("번호 색") === 0) {
      var col = { "흰색": "#FFFFFF", "검정": "#111827", "노랑": "#F5B841" }[label];
      if (col) all("[data-num]", function (x) { x.style.color = col; });
    }
  }

  function monthStep(a, dir) {
    var p = a.parentElement;
    var b = Array.prototype.find.call(p.querySelectorAll("b"), function (x) { return /\d+년 \d+월/.test(x.textContent); });
    if (!b) return false;
    var m = b.textContent.match(/(\d+)년 (\d+)월/);
    var y = +m[1], mo = +m[2] + dir;
    if (mo < 1) { mo = 12; y--; } if (mo > 12) { mo = 1; y++; }
    b.textContent = b.textContent.replace(/\d+년 \d+월/, y + "년 " + mo + "월");
    return true;
  }

  var fileInput = null;
  function pickPhoto(a, camera) {
    if (!fileInput) {
      fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/*";
      fileInput.style.display = "none";
      document.body.appendChild(fileInput);
    }
    fileInput.onchange = function () {
      var f = fileInput.files && fileInput.files[0];
      if (!f) return;
      var url = URL.createObjectURL(f);
      var photo = document.querySelector("[data-photo]");
      if (photo) {
        // 유니폼 사진: 그림 대신 사진을 깔고 등번호는 그대로 위에 둔다
        var svg = photo.querySelector("svg");
        if (svg) svg.style.display = "none";
        photo.style.background = "center/cover no-repeat url(" + url + ")";
        toast("유니폼 사진을 바꿨어요. 저장하면 팀원 카드에 보여요");
      } else {
        var av = a.parentElement.querySelector("span");
        if (av) { av.textContent = ""; av.style.background = "center/cover no-repeat url(" + url + ")"; }
        toast("사진을 바꿨어요");
      }
    };
    fileInput.setAttribute("capture", "environment");
    if (!camera) fileInput.removeAttribute("capture");
    fileInput.click();
  }

  function copyNear(a) {
    var box = a.closest("div");
    var txt = "";
    if (box) {
      var cands = box.querySelectorAll("span,b");
      for (var i = 0; i < cands.length; i++) {
        var t = cands[i].innerText.trim();
        if (t && t !== "복사" && t.length > txt.length && !cands[i].contains(a)) txt = t;
      }
    }
    if (!txt) {
      var sib = a.parentElement.parentElement.querySelector("span[style*='line-height']");
      if (sib) txt = sib.innerText;
    }
    var ok = function () { toast("복사했어요"); };
    var fallback = function () {
      var ta = document.createElement("textarea");
      ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      ta.remove(); ok();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, fallback);
    else fallback();
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href="#"]');
    if (!a) return;
    e.preventDefault();
    if (a.closest('[aria-hidden="true"]')) return; // 시트 뒤에 가려진 화면
    var t = a.textContent.trim();
    var aria = a.getAttribute("aria-label") || "";

    if (/padding: 6px 0/.test(st(a)) && a.closest("nav")) return; // 지금 보고 있는 탭
    if (t === "복사") return copyNear(a);
    if (t === "카카오톡 단톡방에 보내기") {
      var url = "https://maniball.app/j/TEST7Q";
      if (navigator.share) navigator.share({ title: "TEST FS", text: "TEST FS 팀 관리 앱이에요. 링크 누르고 들어와요!", url: url }).catch(function () {});
      else toast("카카오톡 공유 창이 열려요");
      return;
    }
    if (t === "링크 새로 만들기") {
      var code = Math.random().toString(36).slice(2, 8).toUpperCase();
      var span = Array.prototype.find.call(document.querySelectorAll("span"), function (x) { return /maniball\.app\/j\//.test(x.textContent) && x.children.length === 0; });
      if (span) span.textContent = "maniball.app/j/" + code;
      return toast("새 링크를 만들었어요. 예전 링크는 막혔어요");
    }
    if (t === "사진 바꾸기") return pickPhoto(a);
    if (t === "사진 고르기" || t === "사진 찍기") return pickPhoto(a, t === "사진 찍기");
    if (t === "모두 읽음") {
      var list = a.parentElement.nextElementSibling;
      if (list) list.querySelectorAll("a").forEach(function (r) {
        r.style.background = "#FFFFFF";
        var dot = r.querySelector("span");
        if (dot) dot.style.background = "transparent";
      });
      var cnt = a.parentElement.querySelector("b span");
      if (cnt) cnt.textContent = "0개";
      return toast("모두 읽음으로 바꿨어요");
    }
    if (TOASTS[t]) return toast(TOASTS[t]);
    if (t === "−" || t === "-" || aria === "줄이기") { if (stepper(a, -1)) return; }
    if (t === "+" || aria === "늘리기") { if (stepper(a, 1)) return; }
    if (a.style.width === "46px") return toggleSwitch(a);
    if (a.style.width === "22px") return checkbox(a);
    if (t === "받음") {
      var done = document.createElement("span");
      done.textContent = "받음 완료";
      done.style.cssText = "color:#166534;font-weight:700;font-size:12px;flex:none;padding:7px 0";
      a.replaceWith(done);
      return toast("현금으로 받은 걸로 처리했어요");
    }
    if (t === "수락" || t === "거절") {
      var r = a.closest('div[style*="padding: 12px 0"]') || rowOf(a);
      fadeOut(r);
      return toast(t === "수락" ? "수락했어요. 요청한 팀원에게 알렸어요" : "거절했어요");
    }
    if (t === "삭제") { fadeOut(rowOf(a)); return toast("수칙을 지웠어요. 저장하면 반영돼요"); }
    if (t === "+ 수칙 추가") {
      var prev = a.previousElementSibling;
      if (prev) {
        var n = prev.cloneNode(true);
        var b = n.querySelector("b");
        if (b) b.textContent = "새 수칙";
        var sub = n.querySelector("span span");
        if (sub) sub.remove();
        a.parentElement.insertBefore(n, a);
      }
      return;
    }
    if (t === "‹" || aria === "이전 달") { if (monthStep(a, -1)) return; }
    if (t === "›" || aria === "다음 달") { if (monthStep(a, 1)) return; }
    if (selectIn(a)) return;
    toast("예시 화면이라 여기까지만 움직여요");
  });
})();
