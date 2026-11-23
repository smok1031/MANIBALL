// 라인업 자동 배치 계산 (화면과 떨어진 순수 함수라 따로 시험할 수 있다)
// 규칙: 선수는 자기 1선호, 2선호 포지션에만 들어간다. 맞는 선수가 없으면 그 자리는 비워 둔다.
// 고정(pins): 운영진이 정한 선수, 자리, 쿼터는 먼저 넣고 그대로 둔다 (1선호, 2선호가 아니어도). 자동은 남은 자리와 남은 선수만 채운다.
// GK는 한 명이 계속 뛴다(쉬지 않음). 그 사람이 아직 안 온 쿼터만 다른 GK 가능 선수가 맡는다.
//
// 필드는 4쿼터(풋살 8쿼터)를 한꺼번에 푼다 (최소 비용 흐름). 지키는 순서:
//   1. 자리를 최대한 채운다
//   2. 휴식을 이 명단으로 만들 수 있는 가장 고른 수준으로 맞춘다 (가장 많이 뛴 사람과 가장 적게 뛴 사람의 차이가 그보다 커지지 않게)
//   3. 그 안에서 1선호 자리를 최대한 많이 맞춘다
//   4. 남는 차이는 휴식을 더 고르게, 그래도 똑같이 좋은 배치가 여럿이면 무작위로 고른다 (다시 누르면 조금씩 달라진다)

// 풋살은 포지션 없이 "필드" 자리만 있다: 누구나 들어갈 수 있다 (GK 자리는 GK가 1선호, 2선호인 선수만)
export const FIELD = "필드";
// 골키퍼 자리: 축구는 GK, 풋살은 골레이로
export const isKeeper = s => s === "GK" || s === "골레이로";
export const canPlay = (p, slot) => !!p && !!slot && (slot === FIELD || p.pos[0] === slot || p.pos[1] === slot);

// 지정을 쿼터별 자리 번호로 바꾼다. 포메이션에 없는 자리, 아직 안 온 쿼터, 같은 자리 수보다 많은 지정은 빠진다
export function pinRows(players, slots, qn, pins = []) {
  const rows = {}; const skipped = [];
  for (let k = 1; k <= qn; k++) rows[k] = {};
  pins.forEach(pin => {
    const p = players.find(x => x.uid === pin.u);
    (pin.qs || []).forEach(k => {
      if (!rows[k]) return;
      if (!p || (p.from || 1) > k) { skipped.push({ ...pin, k, why: p ? "late" : "gone" }); return; }
      if (Object.values(rows[k]).includes(pin.u)) { skipped.push({ ...pin, k, why: "twice" }); return; }
      const i = slots.findIndex((s, j) => s === pin.pos && rows[k][j] == null);
      if (i < 0) { skipped.push({ ...pin, k, why: slots.includes(pin.pos) ? "full" : "noslot" }); return; }
      rows[k][i] = pin.u;
    });
  });
  return { rows, skipped };
}

// 최소 비용 흐름 (비용이 음수인 길이 남아 있는 동안 한 칸씩 흘린다)
function flow(N, src, snk) {
  const g = Array.from({ length: N }, () => []);
  const add = (u, v, w) => { g[u].push({ v, c: 1, w, r: g[v].length }); g[v].push({ v: u, c: 0, w: -w, r: g[u].length - 1 }); return g[u][g[u].length - 1]; };
  const run = () => {
    for (;;) {
      const d = new Float64Array(N).fill(Infinity), inq = new Uint8Array(N), pu = new Int32Array(N).fill(-1), pk = new Int32Array(N); d[src] = 0;
      const q = [src]; let h = 0;
      while (h < q.length) { const u = q[h++]; inq[u] = 0; const gu = g[u]; for (let k = 0; k < gu.length; k++) { const e = gu[k]; if (e.c > 0 && d[u] + e.w < d[e.v] - 1e-9) { d[e.v] = d[u] + e.w; pu[e.v] = u; pk[e.v] = k; if (!inq[e.v]) { inq[e.v] = 1; q.push(e.v); } } } }
      if (d[snk] === Infinity || d[snk] >= 0) return;
      let v = snk; while (v !== src) { const u = pu[v], e = g[u][pk[v]]; e.c--; g[v][e.r].c++; v = u; }
    }
  };
  return { add, run };
}

// 필드 자리를 모든 쿼터에 한꺼번에 채운다. busy[uid][k]: 그 쿼터에 이미 고정 또는 GK라 못 들어감, pre[uid]: 고정으로 이미 뛴 필드 쿼터 수
// cost(p, t): 그 선수가 t번째 필드 쿼터를 뛸 때의 비용, firstW: 1선호 자리 한 칸의 가치
function solveField(ps, slots, qn, open, busy, pre, cost, firstW, rand) {
  const P = ps.length; const cells = []; // [쿼터, 자리]
  for (let k = 1; k <= qn; k++) open[k].forEach(i => cells.push([k, i]));
  const pq = (i, k) => P + i * qn + (k - 1), cell = j => P + P * qn + j;
  const N = P + P * qn + cells.length + 2, src = N - 2, snk = N - 1; const F = flow(N, src, snk); const use = [];
  ps.forEach((p, i) => {
    const room = Array.from({ length: qn }, (_, k) => k + 1).filter(k => (p.from || 1) <= k && !busy[p.uid][k]);
    for (let t = 1; t <= room.length; t++) F.add(src, i, cost(p, (pre[p.uid] || 0) + t));
    room.forEach(k => {
      F.add(i, pq(i, k), 0);
      cells.forEach(([ck, si], j) => { if (ck === k && canPlay(p, slots[si])) use.push([p.uid, k, si, F.add(pq(i, k), cell(j), -1e9 - (p.pos[0] === slots[si] ? firstW : 0) - rand() * 0.01)]); });
    });
  });
  cells.forEach((_, j) => F.add(cell(j), snk, 0));
  F.run();
  return use.filter(x => x[3].c === 0).map(x => x.slice(0, 3));
}

// GK를 정한 뒤 필드를 채운다
function planWith(players, slots, qn, rand, pinned, gkIdx, gkOf) {
  const rows = {}; for (let k = 1; k <= qn; k++) { rows[k] = { ...pinned[k] }; if (gkIdx >= 0 && rows[k][gkIdx] == null && gkOf[k]) rows[k][gkIdx] = gkOf[k]; }
  const busy = {}, pre = {}; players.forEach(p => { busy[p.uid] = {}; pre[p.uid] = 0; });
  for (let k = 1; k <= qn; k++) Object.entries(rows[k]).forEach(([i, u]) => { if (!busy[u]) return; busy[u][k] = true; if (!isKeeper(slots[i])) pre[u]++; });
  const open = {}; for (let k = 1; k <= qn; k++) open[k] = slots.map((s, i) => !isKeeper(s) && rows[k][i] == null ? i : -1).filter(i => i >= 0);
  const ps = players.filter(p => Array.from({ length: qn }, (_, k) => k + 1).some(k => (p.from || 1) <= k && !busy[p.uid][k]));
  const put = list => { const out = {}; for (let k = 1; k <= qn; k++) out[k] = { ...rows[k] }; list.forEach(([u, k, i]) => { out[k][i] = u; }); return out; };
  const fieldCnt = q => { const c = {}; players.forEach(p => { c[p.uid] = 0; }); Object.values(q).forEach(r => Object.entries(r).forEach(([i, u]) => { if (!isKeeper(slots[i]) && c[u] != null) c[u]++; })); return c; };
  // 1차: 휴식을 가장 고르게 (많이 뛸수록 비싸게)
  const even = put(solveField(ps, slots, qn, open, busy, pre, (p, t) => t * 1e5, 1, () => 0));
  const c0 = fieldCnt(even);
  // 같은 쿼터에 온 사람끼리: 1차에서 가장 많이 뛴 수를 넘지 않고, 뛸 수 있던 사람은 가장 적게 뛴 수까지는 꼭 뛰게
  const band = {}; players.forEach(p => { const g = players.filter(x => (x.from || 1) === (p.from || 1) && c0[x.uid] > 0).map(x => c0[x.uid]); band[p.uid] = g.length ? [Math.min(...g), Math.max(...g)] : [0, qn]; });
  // 2차: 그 안에서 1선호 최대, 남는 차이는 더 고르게
  const q = put(solveField(ps, slots, qn, open, busy, pre, (p, t) => (c0[p.uid] > 0 && t <= band[p.uid][0] ? -1e7 : 0) + (t > band[p.uid][1] ? 1e7 : 0) + t, 1e3, rand));
  return q;
}

// 한 쿼터에 채울 수 있는 필드 자리 수 (최대 매칭)
function maxFill(ps, slots, idx) {
  const own = {};
  const tryP = (p, seen) => { for (const i of idx) { if (seen.has(i) || !canPlay(p, slots[i])) continue; seen.add(i); if (own[i] == null || tryP(own[i], seen)) { own[i] = p; return true; } } return false; };
  let n = 0; ps.forEach(p => { if (tryP(p, new Set())) n++; }); return n;
}

// 배치 평가: 채운 자리 > 휴식 차이(처음부터 온 사람끼리) > 1선호
function scoreOf(players, slots, q) {
  const by = {}; players.forEach(p => { by[p.uid] = p; }); const c = {}; let fill = 0, first = 0;
  Object.values(q).forEach(r => Object.entries(r).forEach(([i, u]) => { fill++; const p = by[u]; if (p && p.pos[0] === slots[i]) first++; if (!isKeeper(slots[i])) c[u] = (c[u] || 0) + 1; }));
  const v = players.filter(p => (p.from || 1) === 1 && c[p.uid]).map(p => c[p.uid]);
  const gap = v.length ? Math.max(...v) - Math.min(...v) : 0;
  return fill * 1e6 - gap * 1e3 + first;
}

export function planLineup(players, slots, qn, rand = Math.random, pins = []) {
  const pinned = pinRows(players, slots, qn, pins).rows;
  const gkIdx = slots.findIndex(isKeeper);
  let best = null, bestS = -Infinity;
  if (gkIdx < 0) best = planWith(players, slots, qn, rand, pinned, -1, {});
  else {
    const keeper = slots[gkIdx]; const tie = {}; players.forEach(p => { tie[p.uid] = rand(); });
    const pinGk = new Set(Object.values(pinned).map(r => r[gkIdx]).filter(Boolean));
    const cand = players.filter(p => canPlay(p, keeper)).sort((a, b) => (pinGk.has(b.uid) - pinGk.has(a.uid)) || ((a.pos[0] === keeper ? 0 : 1) - (b.pos[0] === keeper ? 0 : 1)) || ((a.from || 1) - (b.from || 1)) || tie[a.uid] - tie[b.uid]);
    // 주 GK 후보마다 풀어 보고 가장 좋은 쪽: 주 GK가 아직 안 온 쿼터는 다음 후보가 맡는다
    const tries = cand.length ? cand.slice(0, 4) : [null];
    tries.forEach(main => {
      const gkOf = {};
      for (let k = 1; k <= qn; k++) {
        if (pinned[k][gkIdx] != null) continue;
        const free = p => (p.from || 1) <= k && !Object.values(pinned[k]).includes(p.uid);
        // 이 쿼터에 GK를 누가 맡으면 자리를 가장 많이 채우는지 본다. 주 GK로도 그만큼 채워지면 주 GK가 계속 뛴다
        const open = slots.map((x, i) => !isKeeper(x) && pinned[k][i] == null ? i : -1).filter(i => i >= 0);
        const avail = players.filter(free);
        const fillWith = g => (g ? 1 : 0) + maxFill(avail.filter(p => !g || p.uid !== g.uid), slots, open);
        const opts = [main && free(main) ? main : null, ...cand.filter(free)].filter(Boolean);
        let g = null, gn = -1;
        opts.forEach(o => { const n = fillWith(o); if (n > gn) { g = o; gn = n; } });
        if (fillWith(null) > gn) g = null;
        if (g) gkOf[k] = g.uid;
      }
      const q = planWith(players, slots, qn, rand, pinned, gkIdx, gkOf); const s = scoreOf(players, slots, q);
      if (s > bestS) { best = q; bestS = s; }
    });
  }
  const empty = {}; for (let k = 1; k <= qn; k++) empty[k] = slots.map((s, i) => best[k][i] ? -1 : i).filter(i => i >= 0);
  return { q: best, empty, filled: Object.values(best).reduce((n, r) => n + Object.keys(r).length, 0) };
}

// 포메이션이 이 명단에 얼마나 맞는지: 자동 배치를 해 봤을 때 전체 자리(쿼터 x 자리) 중 1선호, 2선호, 빈자리 비율 (GK 포함)
export function fitOf(players, slots, qn) {
  const r = planLineup(players, slots, qn, () => 0.5);
  const by = {}; players.forEach(p => { by[p.uid] = p; });
  let first = 0, second = 0; const total = slots.length * qn;
  Object.values(r.q).forEach(row => Object.entries(row).forEach(([i, u]) => { const p = by[u]; if (!p) return; if (p.pos[0] === slots[i]) first++; else second++; }));
  const pct = n => total ? Math.round(n * 100 / total) : 0;
  return { first: pct(first), second: pct(second), empty: pct(total - first - second), firstN: first, total };
}
