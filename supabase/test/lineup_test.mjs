// 자동 배치 시험: KEI 실제 포지션 30명으로 여러 경우를 돌린다
import { planLineup, canPlay } from "../../v2/team/lineup-core.js";
const R = `ST CAM|RWB LWB|CB RWB|LW RWB|CAM CB|CDM CB|CB ST|CAM CDM|RW LW|CAM CDM|CB CDM|CDM CB|CDM ST|RW RWB|ST LW|LW ST|CDM CB|RW LW|RWB CDM|RWB CB|LW ST|CB CAM|CAM CB|CDM CB|RW CDM|CAM CDM|CB GK|CB CDM|ST RW|GK RW`.split("|").map((x, i) => ({ uid: "u" + i, pos: x.split(" ") }));
const FORMS = { "4-4-2": ["GK", "LB", "CB", "CB", "RB", "LM", "CM", "CM", "RM", "ST", "ST"], "4-3-3": ["GK", "LB", "CB", "CB", "RB", "CDM", "CM", "CM", "LW", "ST", "RW"], "4-2-3-1": ["GK", "LB", "CB", "CB", "RB", "CDM", "CDM", "LW", "CAM", "RW", "ST"], "4-1-4-1": ["GK", "LB", "CB", "CB", "RB", "CDM", "LM", "CM", "CM", "RM", "ST"], "4-4-1-1": ["GK", "LB", "CB", "CB", "RB", "LM", "CM", "CM", "RM", "CAM", "ST"], "4-1-2-1-2": ["GK", "LB", "CB", "CB", "RB", "CDM", "CM", "CM", "CAM", "ST", "ST"], "3-5-2": ["GK", "CB", "CB", "CB", "LWB", "CM", "CDM", "CM", "RWB", "ST", "ST"], "3-4-3": ["GK", "CB", "CB", "CB", "LWB", "CM", "CM", "RWB", "LW", "ST", "RW"], "5-3-2": ["GK", "LWB", "CB", "CB", "CB", "RWB", "CM", "CDM", "CM", "ST", "ST"], "5-4-1": ["GK", "LWB", "CB", "CB", "CB", "RWB", "LM", "CDM", "CDM", "RM", "ST"], "풋살 4대4": ["GK", "필드", "필드", "필드"], "풋살 5대5": ["GK", "필드", "필드", "필드", "필드"], "풋살 6대6": ["GK", "필드", "필드", "필드", "필드", "필드"], "풋살 5대5 골레이로": ["골레이로", "필드", "필드", "필드", "필드"], "풋살 9대9": ["GK", "필드", "필드", "필드", "필드", "필드", "필드", "필드", "필드"] };
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
    if (fk === "3-4-3" && n >= 14) { const c = {}; ps.forEach(p => c[p.uid] = 0); Object.values(r.q).forEach(row => Object.entries(row).forEach(([i, u]) => { if (slots[i] !== "GK") c[u]++; })); const v = ps.filter(p => !canPlay(p, "GK") || true).map(p => c[p.uid]); spread.push(Math.max(...v) - Math.min(...v)); }
  }
}
console.log({ runs, wrongPosition: bad, notMaxFill: notMax, fairSpreadAvg: (spread.reduce((a, b) => a + b, 0) / spread.length).toFixed(2), fairSpreadMax: Math.max(...spread) });
// KEI 실제 예: 18명 참석, 4-2-3-1과 윙백형 비교
const att = R.slice(0, 18);
for (const fk of ["4-2-3-1", "3-5-2", "3-4-3"]) { const r = planLineup(att, FORMS[fk], 4, rnd); console.log(fk, "채운 자리", r.filled, "/ 44", "빈자리 쿼터별", Object.values(r.empty).map(e => e.map(i => FORMS[fk][i]).join(",") || "-").join(" | ")); }
// 지정 시험: 지정한 선수는 그 자리, 그 쿼터에 그대로 있고, 나머지는 여전히 1선호, 2선호에만, 남은 자리는 최대로 채운다
{
  let pinBad = 0, restBad = 0, restNotMax = 0, pinRuns = 0;
  for (let t = 0; t < 3000; t++) {
    const n = 9 + Math.floor(rnd() * 17); const ps = R.slice().sort(() => rnd() - 0.5).slice(0, n).map(p => ({ ...p, from: rnd() < 0.15 ? 2 + Math.floor(rnd() * 3) : 1 }));
    for (const [fk, slots] of Object.entries(FORMS)) {
      // 화면과 같은 규칙으로 지정 만들기: 아무 자리나 (1, 2선호가 아니어도), 온 쿼터만, 같은 쿼터에 한 번만, 자리 수만큼만
      const pins = []; const np = Math.floor(rnd() * 5);
      for (let j = 0; j < np; j++) {
        const p = ps[Math.floor(rnd() * ps.length)]; const pos = rnd() < 0.5 ? p.pos[Math.floor(rnd() * 2)] : slots[Math.floor(rnd() * slots.length)]; if (!slots.includes(pos)) continue;
        const qs = [1, 2, 3, 4].filter(k => rnd() < 0.6 && p.from <= k && !pins.some(x => x.u === p.uid && x.qs.includes(k)) && pins.filter(x => x.pos === pos && x.qs.includes(k)).length < slots.filter(s => s === pos).length);
        if (qs.length) pins.push({ u: p.uid, pos, qs });
      }
      pinRuns++; const r = planLineup(ps, slots, 4, rnd, pins);
      for (let k = 1; k <= 4; k++) {
        const row = r.q[k]; const seen = new Set(); const fixed = new Set();
        pins.filter(x => x.qs.includes(k)).forEach(x => { const i = Object.keys(row).find(i => row[i] === x.u); if (i == null || slots[i] !== x.pos) { pinBad++; if (pinBad < 4) console.log("PINBAD", fk, k, x, row); } fixed.add(x.u); });
        for (const [i, u] of Object.entries(row)) { const p = ps.find(x => x.uid === u); if (seen.has(u) || (p.from || 1) > k || (!fixed.has(u) && !canPlay(p, slots[i]))) { restBad++; if (restBad < 4) console.log("RESTBAD", fk, k, slots[i], p); } seen.add(u); }
        const freeSlots = slots.filter((s, i) => !fixed.has(row[i]));
        const avail = ps.filter(p => (p.from || 1) <= k && !fixed.has(p.uid));
        const got = Object.values(row).filter(u => !fixed.has(u)).length;
        if (got < maxMatch(avail, freeSlots)) { restNotMax++; if (restNotMax < 4) console.log("PIN NOTMAX", fk, k, got, maxMatch(avail, freeSlots)); }
      }
    }
  }
  console.log({ pinRuns, pinMoved: pinBad, restWrong: restBad, restNotMaxFill: restNotMax });
  // 예: GK 1, 2선호인 정성목(GK RW)을 1, 2쿼터 GK, 3, 4쿼터 RW로 지정
  const att2 = R.slice(0, 18).concat([R[29]]); const pins = [{ u: "u29", pos: "GK", qs: [1, 2] }, { u: "u29", pos: "RW", qs: [3, 4] }];
  const r = planLineup(att2, FORMS["3-4-3"], 4, rnd, pins);
  console.log("정성목 지정:", [1, 2, 3, 4].map(k => k + "Q " + FORMS["3-4-3"][Object.keys(r.q[k]).find(i => r.q[k][i] === "u29")]).join(", "));
}
