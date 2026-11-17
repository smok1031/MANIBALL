// 점검 문지기: 모든 페이지(홈페이지, 앱, 점검 안내)가 먼저 읽는다.
// 점검은 업로드할 때만 켠다. DB의 maint 한 줄(state, start_at, end_at)을 보고
//   start_at 전(예고): 화면 위에 "곧 점검" 띠를 띄우고, 시작 10초 전부터는 새 저장을 받지 않는다
//   start_at 뒤(점검 중): 보내던 저장을 끝까지 기다린 뒤 점검 안내로 간다
// 점검이 아닐 때 새 버전이 올라와 있으면, 보내던 저장을 끝낸 뒤 한 번 새로 고친다.
// 테스트 사이트는 ?maint=preview(&left=분) 로 DB 없이 그 탭에서만 안내 화면을 미리 볼 수 있다. ?maint=off 로 끝냄.
(function () {
  var CFG = window.MB_CFG || {}, KEY = "mb-maint-sim";
  var path = location.pathname, isTest = /\/test\//.test(path), onMaint = /maint\.html$/.test(path);
  var v2 = path.replace(/\/v2\/.*$/, "/v2/"); if (!/\/v2\/$/.test(v2)) v2 = path.replace(/\/[^/]*$/, "/") + "v2/";
  var root = v2.replace(/v2\/$/, "");
  var q = location.search;
  function ss(fn) { try { return fn(window.sessionStorage); } catch (e) { return null; } }
  // 미리 보기 (테스트 사이트만)
  function simEnd() { var v = Number(ss(function (s) { return s.getItem(KEY); })); return v > Date.now() ? v : 0; }
  if (isTest) {
    if (/[?&]maint=off/.test(q)) ss(function (s) { s.removeItem(KEY); });
    else if (/[?&]maint=preview/.test(q) && !simEnd()) {
      var m = Number((q.match(/[?&]left=(\d+)/) || [])[1]) || 5; m = Math.max(1, Math.min(60, m));
      ss(function (s) { s.setItem(KEY, String(Date.now() + m * 60e3)); });
    }
  }
  var st = null; // { state, start, end } (ms). DB에서 읽기 전에는 모름(점검 아님으로 둔다)
  // 서버 시각과 이 기기 시계의 차이 (휴대폰 시계가 틀려도 시작 시각을 서버 기준으로 맞춘다)
  var skew = 0, nowS = function () { return Date.now() + skew; };
  function sim() { return isTest && simEnd() > 0; }
  function on() { return !!st && st.state === "on" && st.start != null; }
  function active() { return sim() || (on() && nowS() >= st.start); }
  function announced() { return !sim() && on() && nowS() < st.start; }
  // 시작 10초 전부터는 새 저장을 받지 않는다 (보내던 것은 끝까지 보낸다)
  function locked() { return sim() || (on() && nowS() >= st.start - 10e3); }
  function endAt() { return sim() ? simEnd() : on() ? st.end : 0; }
  function minutesLeft() { var e = endAt(); return e ? Math.max(0, Math.ceil((e - (sim() ? Date.now() : nowS())) / 60e3)) : 0; }

  // 보내던 저장 끝내기: 앱이 window.MB_FLUSH 를 걸어 둔다 (최대 8초)
  function flush() {
    var f = window.MB_FLUSH; if (typeof f !== "function") return Promise.resolve();
    return Promise.race([Promise.resolve().then(f).catch(function () {}), new Promise(function (r) { setTimeout(r, 8000); })]);
  }
  var leaving = false;
  function goMaint() { if (leaving || onMaint) return; leaving = true; flush().then(function () { location.replace(v2 + "maint.html?t=" + Date.now()); }); }

  // 예고 띠
  var bar = null;
  function drawBar() {
    var show = announced() && !onMaint;
    if (!show) { if (bar) { bar.remove(); bar = null; } return; }
    if (!bar) {
      bar = document.createElement("div"); bar.id = "mbMaintBar"; bar.setAttribute("role", "status"); bar.setAttribute("aria-live", "polite");
      bar.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:2147483000;background:#14182B;color:#F0EEE9;font:700 14px/1.45 'IBM Plex Sans KR',system-ui,sans-serif;padding:10px 16px calc(10px);padding-top:calc(10px + env(safe-area-inset-top));text-align:center;word-break:keep-all;border-bottom:2px solid #5B8DEF";
      (document.body || document.documentElement).appendChild(bar);
    }
    var sec = Math.max(0, Math.ceil((st.start - nowS()) / 1000)), dur = Math.max(1, Math.round((st.end - st.start) / 60e3));
    bar.textContent = (sec > 10 ? sec + "초 뒤 점검을 시작해요. " : "곧 점검을 시작해요. 지금은 저장할 수 없어요. ") + "약 " + dur + "분 뒤 다시 열려요";
  }

  function apply() {
    drawBar();
    if (active() && !onMaint) goMaint();
    if (window.MB_MAINT && typeof window.MB_MAINT.onchange === "function") { try { window.MB_MAINT.onchange(); } catch (e) { /* 무시 */ } }
  }
  function fetchStatus() {
    if (!CFG.url || !CFG.key) return Promise.resolve();
    var t0 = Date.now();
    return fetch(CFG.url + "/rest/v1/rpc/maint_status", { method: "POST", cache: "no-store", headers: { apikey: CFG.key, "Content-Type": "application/json", "Content-Profile": CFG.schema || "public", "Accept-Profile": CFG.schema || "public" }, body: "{}" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (r) {
        if (r && r.now) { var srv = Date.parse(r.now); if (!isNaN(srv)) skew = srv - (t0 + Date.now()) / 2; }
        st = r && r.state ? { state: r.state, start: r.start_at ? Date.parse(r.start_at) : null, end: r.end_at ? Date.parse(r.end_at) : null } : null;
        apply();
      }).catch(function () { /* 상태를 못 읽으면 그대로 둔다 */ });
  }
  // 새 버전이 올라왔으면 한 번 새로 고침 (점검 중이 아닐 때, 보내던 저장을 끝낸 뒤)
  function checkVersion() {
    if (!CFG.ver || onMaint || active()) return;
    fetch(root + "version.txt?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.ok ? r.text() : ""; }).then(function (t) {
      var v = (t || "").trim().slice(0, 7); if (!/^[0-9a-f]{7}$/.test(v) || v === String(CFG.ver).slice(0, 7)) return;
      if (ss(function (s) { return s.getItem("mb-reloaded"); }) === v) return; // 같은 버전으로는 한 번만
      ss(function (s) { s.setItem("mb-reloaded", v); });
      flush().then(function () { var u = new URL(location.href); u.searchParams.set("v", v); location.replace(u.href); });
    }).catch(function () { /* 무시 */ });
  }

  window.MB_MAINT = { active: active, announced: announced, locked: locked, sim: sim, minutesLeft: minutesLeft, endAt: endAt, status: function () { return st; }, now: function () { return nowS(); }, refresh: fetchStatus, stop: function () { ss(function (s) { s.removeItem(KEY); }); }, onchange: null };
  if (sim() && !onMaint) goMaint();
  fetchStatus();
  var n = 0;
  setInterval(function () {
    n++;
    if (active() && !onMaint) goMaint();
    drawBar();
    var soon = on() && st.start - nowS() < 180e3; // 예고 중이거나 점검 중이면 10초마다, 평소 30초마다
    if (n % (soon ? 5 : 15) === 0) fetchStatus();
    if (n % 60 === 0) checkVersion(); // 2분마다
  }, 2000);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") { fetchStatus(); checkVersion(); } });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", drawBar);
  setTimeout(checkVersion, 4000);
})();
