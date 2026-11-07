
/* ---------- 팀원 화면 미리보기 (예시 데이터, 저장 안 됨) ---------- */
function demoBoot() {
  saveLocal = function () { return true; };
  Store.mode = "local"; Store.me = "demo-me"; Store.role = "member"; Store.canWrite = false; Store.canMoney = false; Store.canVote = true; Store.isOwner = false;
  Store.real = { role: "member", canWrite: false, canMoney: false, canVote: true, isOwner: false };
  const D = makeDemo(); COLLS.forEach(c => { R[c] = D[c] || {}; });
  derive();
  // 다음 내전 라인업은 앱의 자동 배치로 만든다
  const lid = D.__lineupEvent; const e = S.events[lid];
  if (e) { const out = autoRotate(e); const L = lineupOf(e); const q = {}; L.q.forEach((_, k) => { q[k + 1] = out[k + 1]; }); R.events[lid].lineupQ = { formation: L.formation, q }; R.events[lid].teams = autoTeams(e, 3); derive(); }
  applyRole(); route();
}
function makeDemo() {
  const RO = [["1","김성우","ST","CAM"],["3","김영효","RWB","LWB"],["4","조수현","CB","RWB"],["5","이세영","LW","RWB"],["6","용호연","CAM","CB"],["7","김동욱","CDM","CB"],["8","권기현","CB","ST"],["10","주지운","CAM","CDM"],["11","황종민","RW","LW"],["12","이동환","CAM","CDM"],["14","김준엽","CB","CDM"],["15","정석광","CDM","CB"],["16","박정진","CDM","ST"],["17","이진우","RW","RWB"],["18","류영준","ST","LW"],["19","이동혁","LW","ST"],["20","박정민","CDM","CB"],["22","최태영","RW","LW"],["23","임희택","RWB","CDM"],["25","안성필","RWB","CB"],["27","김종한","LW","ST"],["37","김준수","CB","CAM"],["42","김휘승","CAM","CB"],["53","김대영","CDM","CB"],["72","한시현","RW","CDM"],["77","최휘용","CAM","CDM"],["91","송정의","CB","GK"],["93","홍지호","CB","CDM"],["95","조진혁","ST","RW"],["99","정성목","GK","RW"]];
  const D = {}; COLLS.forEach(c => { D[c] = {}; });
  const id = n => "d" + n; const byName = {};
  RO.forEach(([num, name, p1, p2]) => { const pid = id(num); byName[name] = pid; D.players[pid] = { id: pid, name, num, pos1: p1, pos2: p2, pos: DGROUP[p1], active: true, joined: "2026-01-01" }; });
  const ME = byName["이세영"];
  const t0 = parseD(todayStr()); const day = k => { const d = new Date(t0); d.setDate(d.getDate() + k); return ymd(d); };
  const iso = (k, hh, mm) => { const d = new Date(t0); d.setDate(d.getDate() + k); d.setHours(hh, mm || 0, 0, 0); return d.toISOString(); };
  D.team.settings = { ...DEFAULT_SETTINGS(), teamName: "KEI FC", cap: 14, fee: 20000, checkBefore: 10, lateCancelH: 24, account: "[예시 은행 계좌번호]", guestFee: 10000,
    finePresets: [{ id: "late", label: "지각", amount: 2000 }, { id: "noshow", label: "무단 불참", amount: 10000 }, { id: "cancel", label: "직전 취소", amount: 6000 }] };
  const core = ["정성목", "김성우", "김영효", "조수현", "이세영", "용호연", "김동욱", "권기현", "황종민", "이동환", "김준엽", "이진우", "류영준", "송정의"].map(n => byName[n]);
  const ev = (k, o, yes, extra) => { const att = {}, attAt = {}; yes.forEach((pid, i) => { att[pid] = "yes"; attAt[pid] = iso(Math.min(k - 5, -1), 9, i); }); const eid = "de" + (k < 0 ? "m" + (-k) : "p" + k) + (o.tag || ""); D.events[eid] = { id: eid, format: "11", time: "20:00", place: "보라매 축구장", ...o, date: day(k), att, attAt, ...(extra || {}) }; delete D.events[eid].tag; return eid; };
  const chk = (yes, over) => Object.assign(Object.fromEntries(yes.map(p => [p, "in"])), over || {});
  const p = n => byName[n];
  // 지난 일정
  const a1 = core.filter(x => x !== p("류영준")).concat([p("주지운")]);
  ev(-28, { type: "match", opponent: "강서 유나이티드", place: "신정 체육공원" }, a1, { check: chk(a1, { [ME]: "in" }), score: { us: 1, them: 3 }, goals: [{ id: "g1", pid: p("김성우"), assist: ME, q: 2 }] });
  const a2 = core.slice();
  ev(-21, { type: "match", opponent: "한양 FC" }, a2, { check: chk(a2), score: { us: 2, them: 2 }, goals: [{ id: "g2", pid: p("김성우"), assist: p("황종민"), q: 1 }, { id: "g3", pid: p("류영준"), assist: ME, q: 3 }] });
  const a3 = core.slice();
  const e3 = ev(-14, { type: "match", opponent: "내전" }, a3, { check: chk(a3, { [ME]: "late", [p("류영준")]: "late" }), score: { us: 3, them: 2 }, goals: [{ id: "g4", pid: p("김성우"), assist: ME, q: 1 }, { id: "g5", pid: ME, assist: p("용호연"), q: 2 }, { id: "g6", pid: p("류영준"), assist: "", q: 4 }] });
  const a4 = core.filter(x => x !== p("김동욱")).concat([p("김준수")]);
  const eMom = ev(0, { type: "match", opponent: "내전", time: "06:30", tag: "a", place: "보라매 축구장 (조기)" }, a4, { check: chk(a4), score: { us: 4, them: 3 }, goals: [{ id: "g7", pid: ME, assist: p("이진우"), q: 1 }, { id: "g8", pid: p("김성우"), assist: "", q: 2 }] });
  // 다가오는 일정
  const f1 = ["정성목", "김성우", "조수현", "용호연", "황종민", "이동환", "김준엽", "이진우", "류영준", "송정의"].map(p);
  ev(1, { type: "training", format: "futsal", title: "풋살 연습", place: "보라매 풋살장", cap: "12" }, f1);
  const scr = core.filter(x => x !== ME);
  const lid = ev(6, { type: "match", opponent: "내전", fieldFee: 120000 }, scr.concat([p("김준수")]), { teamsAt: iso(-1, 21) });
  D.events[lid].att[p("류영준")] = "late"; D.events[lid].lateQ = { [p("류영준")]: 3 };
  ev(13, { type: "match", opponent: "FC 서울", cap: "18" }, ["정성목", "김성우", "김영효", "조수현", "용호연", "김동욱", "권기현", "황종민", "이동환"].map(p));
  D.__lineupEvent = lid;
  // 나 (이세영): 다음 내전에 참석, 다른 일정은 내가 고르도록 비워 둠
  D.rsvp["demo-me"] = { pid: ME, claimAt: iso(-60, 10), ev: { [lid]: { s: "yes", at: iso(1, 9, 30).replace(/T.*/, "T00:00:30.000Z"), upd: iso(-2, 9), q: 0 } } };
  D.rsvp["demo-me"].ev[lid].at = iso(-1, 9, 4);
  // 내 회비 (본인 문서)
  const m = thisMonth(), pm = shiftMonth(m, -1), pm2 = shiftMonth(m, -2);
  D.mydues["demo-me"] = { pid: ME, months: Object.fromEntries([1, 2, 3, 4, 5, 6].map(k => [shiftMonth(m, -k), "paid"])), fines: { df1: { date: day(-14), reason: "지각", amount: 2000, paid: false }, df0: { date: day(-35), reason: "지각", amount: 2000, paid: true } } };
  // 공지와 설문
  D.notices.n1 = { id: "n1", title: "출석 체크는 모임 10분 전에 부릅니다", body: "10분 전에 없으면 지각이고 벌금 2,000원이에요. 늦을 것 같으면 앱에서 미리 늦참으로 바꿔 주세요. 늦참으로 바꾼 사람은 지각으로 치지 않아요.", pinned: true, at: iso(-3, 10) };
  D.notices.n2 = { id: "n2", title: "12월 회식 언제가 좋아요?", body: "", pinned: false, at: iso(-1, 20), poll: { opts: [{ id: "o1", label: "12월 12일 (토) 저녁" }, { id: "o2", label: "12월 13일 (일) 점심" }, { id: "o3", label: "12월 19일 (토) 저녁" }], until: day(2) + "T23:59" } };
  D.notices.n3 = { id: "n3", title: "겨울 유니폼 사이즈 조사 결과", body: "M 9벌, L 14벌, XL 5벌로 주문해요.", at: iso(-10, 12) };
  D.tally["poll-n2"] = { n: 19, c: { o1: 9, o2: 4, o3: 6 }, v: [] };
  D.tally["mom-" + eMom] = { n: 9, c: { [p("김성우")]: 4, [p("정성목")]: 3, [p("류영준")]: 2 }, v: [] };
  D.tally["mom-" + e3] = { n: 12, c: { [ME]: 5, [p("김성우")]: 4, [p("정성목")]: 3 }, v: [] };
  D.uvote["demo-me"] = { inboxAt: iso(-2, 9) };
  return D;
}

/* ---------- boot ---------- */
applyBig();
setSync();
initStore();
