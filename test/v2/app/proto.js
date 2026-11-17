// 화면 둘러보기(정적 화면)에서 디자인 캔버스와 같은 화면 로직을 돌린다.
// 빌드가 넣어 준 <template id="dc-tpl">(화면 틀)과 #dc-code(화면 로직)를 읽어
// {{ }} 자리를 채우고, sc-if와 sc-for를 풀고, onClick과 onChange를 이어 붙인다.
// 다시 그릴 때는 바뀐 곳만 고쳐서 입력 중인 글자(한글 조합 포함)가 끊기지 않게 한다.
(function () {
  "use strict";

  // 지금 보고 있는 탭처럼 갈 곳이 없는 버튼은 화면이 위로 튀지 않게
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href="#"]');
    if (a) e.preventDefault();
  });

  var tpl = document.getElementById("dc-tpl");
  var codeEl = document.getElementById("dc-code");
  var root = document.getElementById("dc-root");
  if (!tpl || !codeEl || !root) return;

  var HOLE = /\{\{\s*([\w.$]+)\s*\}\}/g;
  var ONE = /^\{\{\s*([\w.$]+)\s*\}\}$/;

  function look(scope, path) {
    if (path === "true") return true;
    if (path === "false") return false;
    var parts = path.split("."), v = scope;
    for (var i = 0; i < parts.length; i++) {
      if (v == null) return undefined;
      v = v[parts[i]];
    }
    return v;
  }
  function fill(str, scope) {
    return str.replace(HOLE, function (m, p) {
      var v = look(scope, p);
      return v == null || v === false ? "" : String(v);
    });
  }

  function bind(el, evt) {
    el.__b = el.__b || {};
    if (el.__b[evt]) return;
    el.__b[evt] = true;
    el.addEventListener(evt, function (e) {
      var h = el.__h && el.__h[evt];
      if (h) h(e);
    });
  }

  // 틀의 마디 하나를 지금 값으로 그린 새 마디들로 바꾼다
  function render(node, scope, out) {
    if (node.nodeType === 3) {
      out.push(document.createTextNode(node.nodeValue.indexOf("{{") >= 0 ? fill(node.nodeValue, scope) : node.nodeValue));
      return;
    }
    if (node.nodeType !== 1) return;
    var tag = node.nodeName.toLowerCase();
    if (tag === "sc-if") {
      var m = (node.getAttribute("value") || "").match(ONE);
      if (m && look(scope, m[1])) renderKids(node, scope, out);
      return;
    }
    if (tag === "sc-for") {
      var lm = (node.getAttribute("list") || "").match(ONE);
      var list = lm ? look(scope, lm[1]) : null;
      var as = node.getAttribute("as") || "item";
      (list || []).forEach(function (item, i) {
        var s = Object.create(scope);
        s[as] = item;
        s.index = i;
        renderKids(node, s, out);
      });
      return;
    }
    var el = node.cloneNode(false);
    el.__h = {};
    Array.prototype.slice.call(node.attributes).forEach(function (at) {
      var name = at.name, val = at.value;
      if (name.indexOf("hint-placeholder") === 0) { el.removeAttribute(name); return; }
      if (val.indexOf("{{") < 0) return;
      if (/^on/i.test(name)) {
        el.removeAttribute(name);
        var hm = val.match(ONE);
        var fn = hm ? look(scope, hm[1]) : null;
        var evt = name.slice(2).toLowerCase();
        if (evt === "change") evt = el.type === "file" ? "change" : "input";
        if (typeof fn === "function") { el.__h[evt] = fn; bind(el, evt); }
        return;
      }
      if (name === "value") {
        el.removeAttribute(name);
        el.__v = fill(val, scope);
        return;
      }
      el.setAttribute(name, fill(val, scope));
    });
    var kids = [];
    renderKids(node.content || node, scope, kids);
    kids.forEach(function (k) { el.appendChild(k); });
    if (el.__v !== undefined) el.value = el.__v;
    out.push(el);
  }
  function renderKids(node, scope, out) {
    var c = node.childNodes;
    for (var i = 0; i < c.length; i++) render(c[i], scope, out);
  }

  // 이미 그려진 화면을 새로 그린 것에 맞춘다 (바뀐 곳만)
  function same(a, b) {
    return a.nodeType === b.nodeType && (a.nodeType !== 1 || (a.nodeName === b.nodeName && (a.type || "") === (b.type || "")));
  }
  function update(o, n) {
    if (o.nodeType === 3) { if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue; return; }
    var i, at;
    for (i = o.attributes.length - 1; i >= 0; i--) {
      at = o.attributes[i];
      if (!n.hasAttribute(at.name)) o.removeAttribute(at.name);
    }
    for (i = 0; i < n.attributes.length; i++) {
      at = n.attributes[i];
      if (o.getAttribute(at.name) !== at.value) o.setAttribute(at.name, at.value);
    }
    o.__h = n.__h;
    Object.keys(n.__h || {}).forEach(function (evt) { bind(o, evt); });
    if (n.__v !== undefined && o.value !== n.__v) o.value = n.__v;
    patch(o, Array.prototype.slice.call(n.childNodes));
  }
  function patch(parent, next) {
    var old = Array.prototype.slice.call(parent.childNodes);
    for (var i = 0; i < next.length; i++) {
      var o = old[i], n = next[i];
      if (!o) parent.appendChild(n);
      else if (same(o, n)) update(o, n);
      else parent.replaceChild(n, o);
    }
    for (var j = next.length; j < old.length; j++) parent.removeChild(old[j]);
  }

  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (o) {
    var add = typeof o === "function" ? o(this.state, this.props) : o;
    this.state = Object.assign({}, this.state, add);
    draw();
  };

  var Component;
  try {
    Component = new Function("DCLogic", codeEl.textContent + "\nreturn Component;")(DCLogic);
  } catch (e) {
    console.error(e);
    return;
  }
  var comp = new Component({});
  if (!comp.state) comp.state = {};

  var drawing = false;
  function draw() {
    if (drawing) return;
    drawing = true;
    try {
      var vals = comp.renderVals();
      var next = [];
      renderKids(tpl.content, vals, next);
      patch(root, next);
    } finally {
      drawing = false;
    }
  }
  draw();
})();
