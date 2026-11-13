// 라인업 자동 배치 계산 (화면과 떨어진 순수 함수라 따로 시험할 수 있다)
// 규칙: 선수는 자기 1선호, 2선호 포지션에만 들어간다. 맞는 선수가 없으면 그 자리는 비워 둔다.
// GK는 한 명이 계속 뛰고(쉬지 않음), 필드는 쿼터 수가 적은 선수부터 먼저 넣어 휴식을 고르게 맞춘다.

export const canPlay = (p, slot) => !!p && !!slot && (p.pos[0] === slot || p.pos[1] === slot);

// 한 쿼터: 우선순위 순서대로 증가 경로를 찾는 최대 매칭 (먼저 들어간 선수는 빠지지 않고 자리만 바뀐다)
function matchQuarter(order, slotIdx, slots) {
  const owner = {}; // 자리 번호 -> 선수
  const tryPlace = (p, seen) => {
    const mine = slotIdx.filter(i => canPlay(p, slots[i])).sort((a, b) => (slots[a] === p.pos[0] ? 0 : 1) - (slots[b] === p.pos[0] ? 0 : 1));
    for (const i of mine) {
      if (seen.has(i)) continue; seen.add(i);
      if (!owner[i] || tryPlace(owner[i], seen)) { owner[i] = p; return true; }
    }
    return false;
  };
  for (const p of order) { if (Object.keys(owner).length >= slotIdx.length) break; tryPlace(p, new Set()); }
  // 1선호 자리로 맞바꿀 수 있으면 바꾼다
  let changed = true; let guard = 0;
  while (changed && guard++ < 50) {
    changed = false;
    for (const a of slotIdx) for (const b of slotIdx) {
      const A = owner[a], B = owner[b]; if (!A || !B || a === b) continue;
      const now = (A.pos[0] === slots[a]) + (B.pos[0] === slots[b]);
      const sw = (A.pos[0] === slots[b]) + (B.pos[0] === slots[a]);
      if (sw > now && canPlay(A, slots[b]) && canPlay(B, slots[a])) { owner[a] = B; owner[b] = A; changed = true; }
    }
  }
  return owner;
}

export function planLineup(players, slots, qn, rand = Math.random) {
  const cnt = {}; players.forEach(p => { cnt[p.uid] = 0; });
  const tie = {}; players.forEach(p => { tie[p.uid] = rand(); });
  const gkIdx = slots.map((s, i) => s === "GK" ? i : -1).filter(i => i >= 0);
  const fieldIdx = slots.map((s, i) => s !== "GK" ? i : -1).filter(i => i >= 0);
  const q = {}, empty = {}; let lastGk = null;
  for (let k = 1; k <= qn; k++) {
    const avail = players.filter(p => (p.from || 1) <= k); const used = new Set(); const row = {};
    // GK: 지난 쿼터 GK가 있으면 그대로, 없으면 1선호 GK, 그다음 2선호 GK. 단, 필드를 덜 채우게 되는 GK는 고르지 않는다
    const byCnt = (a, b) => cnt[a.uid] - cnt[b.uid] || tie[a.uid] - tie[b.uid];
    const fieldFor = gkUid => matchQuarter(avail.filter(p => p.uid !== gkUid).sort(byCnt), fieldIdx, slots);
    if (gkIdx.length) {
      const cand = avail.filter(p => canPlay(p, "GK")).sort((a, b) => (lastGk && a.uid === lastGk ? -1 : 0) - (lastGk && b.uid === lastGk ? -1 : 0) || (a.pos[0] === "GK" ? 0 : 1) - (b.pos[0] === "GK" ? 0 : 1) || tie[a.uid] - tie[b.uid]);
      let best = null, bestN = -1, bestOwner = null;
      for (const c of cand) { const o = fieldFor(c.uid); const n = Object.keys(o).length; if (n > bestN) { best = c; bestN = n; bestOwner = o; } }
      if (!best) bestOwner = fieldFor(null);
      if (best) { row[gkIdx[0]] = best.uid; used.add(best.uid); lastGk = best.uid; }
      Object.entries(bestOwner).forEach(([i, p]) => { row[i] = p.uid; cnt[p.uid]++; });
    } else {
      Object.entries(fieldFor(null)).forEach(([i, p]) => { row[i] = p.uid; cnt[p.uid]++; });
    }
    q[k] = row; empty[k] = slots.map((s, i) => row[i] ? -1 : i).filter(i => i >= 0);
  }
  return { q, empty, filled: Object.values(q).reduce((n, r) => n + Object.keys(r).length, 0) };
}
