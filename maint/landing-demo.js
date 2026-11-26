// 테스트 서버 체험 링크(?demo)로 왔을 때만 쓰는 조각 (시안 6-1-1). 운영 서버 빌드에는 이 파일이 들어가지 않는다.
// 시작 버튼 4곳을 '로그인 없이 체험하기'로 바꾸고, 누르면 체험 팀(team/?demo&go)으로 들어간다.
(function () {
  if (!new URLSearchParams(location.search).has("demo")) return;
  var GO = "team/?demo&go";
  var BTN = "height:54px;box-sizing:border-box;border:2px solid #121110;border-radius:12px;background:#FCD01A;color:#121110;box-shadow:3px 3px 0 #121110;font:700 16px 'IBM Plex Sans KR',sans-serif;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;text-decoration:none;padding:0 22px";
  function demoBtn(full) {
    var a = document.createElement("a");
    a.href = GO; a.textContent = "로그인 없이 체험하기";
    a.setAttribute("style", BTN + (full ? ";width:100%" : ""));
    return a;
  }
  function run() {
    var nav = document.querySelector(".links");
    if (nav) {
      var l = nav.querySelector(".btn-l"), o = nav.querySelector(".btn-o");
      if (o) { o.textContent = "로그인 없이 체험하기"; o.href = GO; o.classList.remove("hide-m"); }
      if (l) l.remove();
    }
    var kk = document.querySelectorAll('a[href="team/"]');
    for (var i = 0; i < kk.length; i++) {
      var a = kk[i], full = !!a.closest(".cta-btns");
      a.replaceWith(demoBtn(full));
      if (full) {
        var box = document.querySelector(".cta-btns span");
        if (box) box.textContent = "카카오 로그인 없이 체험 팀에서 모든 기능을 눌러 봐요";
      }
    }
    var note = document.querySelector(".ctas ~ .note, .note");
    if (note) note.textContent = "체험 팀에 운영진으로 들어가요. 이름과 기록은 모두 예시이고, 체험 팀은 하루 뒤 지워져요.";
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
})();
