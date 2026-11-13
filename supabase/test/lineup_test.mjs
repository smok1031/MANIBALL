// 자동 배치 시험: KEI 실제 포지션 30명으로 여러 경우를 돌린다
import { planLineup, canPlay } from "../../v2/team/lineup-core.js";
const R = `ST CAM|RWB LWB|CB RWB|LW RWB|CAM CB|CDM CB|CB ST|CAM CDM|RW LW|CAM CDM|CB CDM|CDM CB|CDM ST|RW RWB|ST LW|LW ST|CDM CB|RW LW|RWB CDM|RWB CB|LW ST|CB CAM|CAM CB|CDM CB|RW CDM|CAM CDM|CB GK|CB CDM|ST RW|GK RW`.split("|").map((x, i) => ({ uid: "u" + i, pos: x.split(" ") }));
const FORMS = { "4-2-3-1": ["GK", "LB", "CB", "CB", "RB", "CDM", "CDM", "LW", "CAM", "RW", "ST"], "4-2-3-1 윙백": ["GK", "LWB", "CB", "CB", "RWB", "CDM", "CDM", "LW", "CAM", "RW", "ST"], "3-4-3": ["GK", "CB", "CB", "CB", "LWB", "CDM", "CDM", "RWB", "LW", "ST", "RW"], "4-4-2": ["GK", "LB", "CB", "CB", "RB", "LM", "CM", "CM", "RM", "ST", "ST"], "4-3-3": ["GK", "LB", "CB", "CB", "RB", "CDM", "CM", "CM", "LW", "ST", "RW"], "3-5-2": ["GK", "CB", "CB", "CB", "LWB", "CDM", "CM", "CDM", "RWB", "ST", "ST"] };
// 정답 비교용: 아무 순서로나 찾는 최대 매칭 (자리 전체)
function maxMatch(ps, slots) { const own = {}; const tp = (p, seen) => { for (let i = 0; i < slots.length; i++) { if (!canPlay(p, slots[i]) || seen.has(i)) continue; seen.add(i); if (own[i] === undefined || tp(own[i], seen)) { own[i] = p; return true; } } return false; }; ps.forEach(p => tp(p, new Set())); return Object.keys(own).length; }
let bad = 0, notMax = 0, runs = 0; const spread = [];
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let t = 0; t < 3000; t++) {
  const n = 9 + Math.floor(rnd() * 17); const ps = R.slice().sort(() => rnd() - 0.5).slice(0, n).map(p => ({ ...p, from: rnd() < 0.15 ? 2 + Math.floor(rnd() * 3) : 1 }));
  for (const [fk, slots] of Object.entries(FORMS)) {
    runs++; const r = planLineup(ps, slots, 4, rnd);
    for (let k = 1; k <= 4; k++) {
      const row = r.q[k]; const seen = new Set();
      for (const [i, u] of Object.entries(row)) { const p = ps.find(x => x.uid === u); if (!canPlay(p, slots[i]) || seen.has(u) || (p.from || 1) > k) { bad++; if (bad < 4) console.log("BAD", fk, k, slots[i], p); } seen.add(u); }
      const avail = ps.filter(p => (p.from || 1) <= k); if (Object.keys(row).length < maxMatch(avail, slots)) { notMax++; if (notMax < 4) console.log("NOTMAX", fk, k, Object.keys(row).length, maxMatch(avail, slots)); }
    }
    if (fk === "4-2-3-1 윙백" && n >= 14) { const c = {}; ps.forEach(p => c[p.uid] = 0); Object.values(r.q).forEach(row => Object.entries(row).forEach(([i, u]) => { if (slots[i] !== "GK") c[u]++; })); const v = ps.filter(p => !canPlay(p, "GK") || true).map(p => c[p.uid]); spread.push(Math.max(...v) - Math.min(...v)); }
  }
}
console.log({ runs, wrongPosition: bad, notMaxFill: notMax, fairSpreadAvg: (spread.reduce((a, b) => a + b, 0) / spread.length).toFixed(2), fairSpreadMax: Math.max(...spread) });
// KEI 실제 예: 18명 참석, 4-2-3-1과 윙백형 비교
const att = R.slice(0, 18);
for (const fk of ["4-2-3-1", "4-2-3-1 윙백", "3-4-3"]) { const r = planLineup(att, FORMS[fk], 4, rnd); console.log(fk, "채운 자리", r.filled, "/ 44", "빈자리 쿼터별", Object.values(r.empty).map(e => e.map(i => FORMS[fk][i]).join(",") || "-").join(" | ")); }
