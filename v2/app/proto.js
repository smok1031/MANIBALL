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

  function selectAll(el) {
    try { var r = document.createRange(); r.selectNodeContents(el); var s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {}
  }
  function won(n) { return n.toLocaleString("ko-KR") + "원"; }
  function secHead(el) {
    var sec = el.closest("section");
    return sec ? ((sec.querySelector("span") || {}).textContent || "") : "";
  }

  // 입력칸처럼 생긴 곳은 눌러서 직접 쓸 수 있게
  function setupFields() {
    document.querySelectorAll("span").forEach(function (s) {
      var st0 = st(s);
      if (!/border: (1px solid #D1D5DB|2px solid)/.test(st0)) return;
      if (s.closest("a") || s.closest('[aria-hidden="true"]')) return;
      if (s.style.width === "46px" || s.style.width === "22px") return;
      s.setAttribute("contenteditable", "true");
      s.style.outline = "none";
      s.style.cursor = "text";
      s.querySelectorAll("span").forEach(function (x) { x.setAttribute("contenteditable", "false"); });
      var ph = /#9CA3AF/i.test(st0) || /^예:/.test(s.textContent.trim()) || /적어 주세요$/.test(s.textContent.trim());
      s.addEventListener("focus", function () {
        s.style.borderColor = "#15803D";
        if (ph) {
          ph = false;
          Array.prototype.slice.call(s.childNodes).forEach(function (x) { if (x.nodeType === 3) x.remove(); });
          s.insertBefore(document.createTextNode(""), s.firstChild);
          s.style.color = "#111827";
          s.style.fontWeight = "700";
        }
      });
      s.addEventListener("blur", function () { s.style.borderColor = ""; });
      s.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !/min-height/.test(st0)) { e.preventDefault(); s.blur(); }
      });
      s.addEventListener("input", function () { onField(s); refresh(); });
    });
    // 이름으로 찾기
    document.querySelectorAll("div").forEach(function (d) {
      if (d.children.length !== 1 || d.textContent.trim() !== "이름으로 찾기" || d.closest('[aria-hidden="true"]')) return;
      var tn = Array.prototype.find.call(d.childNodes, function (x) { return x.nodeType === 3 && x.nodeValue.trim(); });
      var inp = document.createElement("input");
      inp.placeholder = "이름으로 찾기";
      inp.style.cssText = "flex:1;border:0;outline:none;background:transparent;font:inherit;color:#111827;min-width:0";
      if (tn) tn.replaceWith(inp);
      inp.addEventListener("input", function () {
        var q = inp.value.trim();
        document.querySelectorAll('span[style*="width: 22px"]').forEach(function (cb) {
          var row = cb.parentElement, nm = row.querySelector("b");
          if (nm) row.style.display = !q || nm.textContent.indexOf(q) >= 0 ? "" : "none";
        });
      });
    });
  }

  function onField(s) {
    var head = secHead(s), txt = s.firstChild && s.firstChild.nodeType === 3 ? s.firstChild.nodeValue.trim() : s.textContent.trim();
    if (head.indexOf("이름") === 0) document.querySelectorAll("[data-name]").forEach(function (x) { x.textContent = txt || " "; });
    if (head.indexOf("등번호") === 0) {
      var d = txt.replace(/\D/g, "");
      document.querySelectorAll("[data-num], [data-numtext]").forEach(function (x) { x.textContent = d; });
    }
  }

  // 화면 안의 숫자와 미리보기를 지금 상태에 맞춘다
  function refresh() {
    // 현장 출석: 출석, 지각, 결석 수와 벌금
    var trios = Array.prototype.filter.call(document.querySelectorAll("span"), function (s) {
      return s.children.length === 3 && Array.prototype.every.call(s.children, function (x) { return x.tagName === "A"; }) && s.children[0].textContent.trim() === "출석" && !s.closest('[aria-hidden="true"]');
    });
    if (trios.length) {
      var c = { "출석": 0, "지각": 0, "결석": 0 };
      trios.forEach(function (tr) { Array.prototype.forEach.call(tr.children, function (x) { if (/box-shadow: inset/.test(st(x))) c[x.textContent.trim()]++; }); });
      document.querySelectorAll("span > b").forEach(function (b) {
        var lab = b.parentElement.textContent.replace(b.textContent, "").trim();
        if (c[lab] !== undefined && b.style.display === "block") b.textContent = c[lab];
      });
      document.querySelectorAll("span").forEach(function (s) {
        if (/^벌금 /.test(s.textContent) && s.querySelector("b") && s.nextElementSibling && /원$/.test(s.nextElementSibling.textContent)) {
          s.querySelector("b").textContent = "지각 " + c["지각"] + "명, 결석 " + c["결석"] + "명";
          s.nextElementSibling.textContent = won(c["지각"] * 2000 + c["결석"] * 10000);
        }
      });
    }
    // 스쿼드: 선택, A 조끼, B 일반 수
    var boxes = Array.prototype.filter.call(document.querySelectorAll('span[style*="width: 22px"][style*="border-radius: 6px"]'), function (x) { return !x.closest('[aria-hidden="true"]'); });
    if (boxes.length) {
      var on = boxes.filter(function (x) { return x.textContent.trim() === "✓"; });
      var aN = 0, bN = 0;
      on.forEach(function (x) {
        x.parentElement.querySelectorAll("a").forEach(function (y) {
          if (y.textContent.trim() === "A 조끼" && selScore(y) > 0) aN++;
          if (y.textContent.trim() === "B 일반" && selScore(y) > 0) bN++;
        });
      });
      document.querySelectorAll("span > b").forEach(function (b) {
        if (b.style.display !== "block") return;
        var lab = b.parentElement.textContent.replace(b.textContent, "").trim();
        if (lab === "선택") b.textContent = on.length;
        if (lab === "A 조끼") b.textContent = aN;
        if (lab === "B 일반") b.textContent = bN;
      });
      document.querySelectorAll("b").forEach(function (b) {
        if (/^체크한 \d+명에게/.test(b.textContent)) b.textContent = b.textContent.replace(/\d+명/, on.length + "명");
      });
    }
    // 팀 만들기: 팀원에게 보이는 미리보기
    var pv = Array.prototype.find.call(document.querySelectorAll("section"), function (s) { return s.textContent.indexOf("팀원에게 이렇게 보여요") >= 0; });
    if (pv) {
      var pick = function (labels) { var a = Array.prototype.find.call(document.querySelectorAll('a[href="#"]'), function (x) { return labels.indexOf(x.textContent.trim()) >= 0 && selScore(x) > 0; }); return a ? a.textContent.trim() : ""; };
      var name = "", amt = "";
      document.querySelectorAll('span[contenteditable="true"]').forEach(function (s) {
        var lab = (s.parentElement.querySelector("span") || {}).textContent || "";
        var v = s.firstChild && s.firstChild.nodeType === 3 ? s.firstChild.nodeValue.trim() : s.textContent.trim();
        if (lab === "팀 이름") name = v;
        if (lab === "금액") amt = v;
      });
      var sport = pick(["축구팀", "풋살팀"]), mode = pick(["월회비", "경기마다", "안 받음"]), day = pick(["1일", "5일", "10일", "25일", "말일", "직접"]);
      var sm = pv.querySelector('div[style*="font-size: 11px"]'); if (sm && sport) sm.textContent = sport;
      var nb = pv.querySelector('b[style*="font-size: 19px"]'); if (nb && name) nb.textContent = name;
      var big = pv.querySelector('span[style*="font-size: 22px"]');
      var note = big && big.nextElementSibling;
      if (big) {
        var unit = big.querySelector("span");
        if (mode === "안 받음") { big.firstChild.nodeValue = "회비 없음"; if (unit) unit.textContent = ""; if (note) note.textContent = "회비를 받지 않아요"; }
        else {
          big.firstChild.nodeValue = (amt || "0") + "원";
          if (unit) unit.textContent = mode === "경기마다" ? " / 경기" : " / 월";
          if (note) note.textContent = mode === "경기마다" ? "경기 날 현장에서 내요" : (day === "말일" ? "매월 말일까지 내요" : day === "직접" ? "정한 날까지 내요" : "매월 " + day + "까지 내요");
        }
      }
    }
  }

  document.addEventListener("click", function (e) {
    var a0 = e.target.closest("a");
    if (!a0 && !e.target.closest('[aria-hidden="true"]')) {
      // span으로 된 켜고 끄기와 체크
      var sw = e.target.closest('span[style*="width: 46px"][style*="height: 26px"]');
      if (sw) { toggleSwitch(sw); refresh(); return; }
      var cb = e.target.closest('span[style*="width: 22px"][style*="height: 22px"][style*="border-radius: 6px"]');
      if (!cb) {
        var row = e.target.closest("div");
        var inRow = row ? row.querySelectorAll(':scope > span[style*="width: 22px"][style*="border-radius: 6px"]') : [];
        if (inRow.length === 1 && !e.target.closest('[contenteditable="true"]')) cb = inRow[0];
      }
      if (cb && !/background: #D1D5DB/i.test(st(cb))) { checkbox(cb); refresh(); return; }
    }
  });

  document.addEventListener("click", function () { setTimeout(refresh, 0); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", setupFields); else setupFields();

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
      // 팀 만들기 흐름에서는 보낸 뒤 들어온 팀원 화면으로 넘어간다
      var next = document.querySelector('a[href="InviteRoster.html"]');
      if (next) setTimeout(function () { location.href = "InviteRoster.html"; }, 1200);
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
        var lab = n.querySelector("span");
        if (lab) {
          var lb = lab.querySelector("b");
          if (lb) { lb.textContent = "새 수칙"; lab.querySelectorAll("span, br").forEach(function (x) { x.remove(); }); }
          else lab.textContent = "새 수칙";
          lab.setAttribute("contenteditable", "true");
          lab.style.outline = "none";
        }
        a.parentElement.insertBefore(n, a);
        if (lab) { lab.focus(); selectAll(lab); }
        toast("새 수칙을 적어 주세요");
      }
      return;
    }
    if (t === "수정") {
      var box = a.parentElement;
      box.setAttribute("contenteditable", "true");
      a.setAttribute("contenteditable", "false");
      box.style.outline = "2px solid #86EFAC";
      box.focus();
      return toast("문구를 바로 고칠 수 있어요");
    }
    if (t === "‹" || aria === "이전 달") { if (monthStep(a, -1)) return; }
    if (t === "›" || aria === "다음 달") { if (monthStep(a, 1)) return; }
    if (selectIn(a)) return;
    toast("예시 화면이라 여기까지만 움직여요");
  });
})();
