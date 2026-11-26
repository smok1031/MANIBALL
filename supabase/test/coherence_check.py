"""예시 자료가 앞뒤가 맞는지 점검한다 (seed_coherent.py로 넣은 팀).
Usage: python3 coherence_check.py "<DSN>" <스키마> <팀 id>
"""
import sys, json, datetime, psycopg2
DSN, SCH, TID = sys.argv[1], sys.argv[2], sys.argv[3]
c = psycopg2.connect(DSN).cursor()
c.execute(f"select coll, id, data from {SCH}.docs where team_id = %s", (TID,)); D = {}
for coll, i, x in c.fetchall(): D.setdefault(coll, {})[i] = x
c.execute(f"select user_id::text, role from {SCH}.members where team_id = %s", (TID,)); MEM = dict(c.fetchall())
c.execute(f"select room, user_id::text, kind, created_at from {SCH}.chat where team_id = %s order by id", (TID,)); CHAT = c.fetchall()
S = D["team"]["settings"]; RULE = {r["kind"]: r["amount"] for r in S["rules"]}
bad = []
def chk(cond, msg):
    if not cond: bad.append(msg)
KST = datetime.timezone(datetime.timedelta(hours=9))
def start(e): return datetime.datetime.fromisoformat(f"{e['date']}T{e.get('time') or '23:59'}:00+09:00")
votes = {}
for u, r in D.get("rsvp", {}).items():
    for eid, v in (r.get("ev") or {}).items(): votes.setdefault(eid, {})[u] = v
seed_ev = {k: e for k, e in D["events"].items() if k.startswith("s")}
for eid, e in seed_ev.items():
    vs = votes.get(eid, {})
    going = sorted([(v["at"], u) for u, v in vs.items() if v["s"] in ("yes", "late") and u in MEM], key=lambda x: x[0])
    gcap = sum(1 for g in (e.get("guests") or {}).values() if g.get("inCap"))
    cap = int(e.get("cap") or 99) - gcap
    incap = [u for _, u in going[:cap]]
    for u, v in vs.items():
        chk(u in MEM, f"{eid}: 팀원이 아닌 사람의 투표 {u}")
        chk(v["at"] >= e.get("createdAt", ""), f"{eid}: 일정이 생기기 전 투표 {u}")
        chk(datetime.datetime.fromisoformat(v["at"].replace("Z", "+00:00")) < start(e), f"{eid}: 경기 시작 뒤 투표 {u}")
    ck = e.get("check") or {}
    for u, st in ck.items():
        if u.startswith("g:") or u in (e.get("guests") or {}):
            chk(u.split(":")[-1] in (e.get("guests") or {}), f"{eid}: 명단에 없는 용병 출석 {u}"); continue
        chk(u in incap, f"{eid}: 정원 안 참석이 아닌 사람의 현장 출석 {u}")
        chk(not (st == "late" and vs.get(u, {}).get("s") == "late"), f"{eid}: 늦참으로 낸 사람을 지각으로 체크 {u}")
    came = {u for u, st in ck.items() if st in ("in", "late")}
    if e.get("score"):
        chk(int(e["score"]["us"]) == len(e.get("goals") or []), f"{eid}: 점수 {e['score']['us']}와 골 수 {len(e.get('goals') or [])}가 다름")
        for g in e.get("goals") or []:
            chk(g["uid"] in came, f"{eid}: 안 온 사람의 골 {g['uid']}")
            chk(not g.get("assist") or (g["assist"] in came and g["assist"] != g["uid"]), f"{eid}: 도움이 이상함 {g}")
    for u, uv in D.get("uvote", {}).items():
        w = (uv.get("mom") or {}).get(eid)
        if w: chk(u in came and w in came and w != u, f"{eid}: MOM 투표가 이상함 {u} -> {w}")
    lu = ((e.get("lineup") or {}).get("main") or {}).get("q") or {}
    for q, slots in lu.items():
        ps = list(slots.values())
        chk(len(ps) == len(set(ps)) == 11, f"{eid}: {q}쿼터 인원이 11명이 아니거나 겹침")
        for p in ps:
            chk(p in came or p in ck, f"{eid}: 안 온 사람이 라인업에 {p}")
            v = vs.get(p) or {}
            if v.get("s") == "late": chk(int(q) >= int(v.get("q") or 1), f"{eid}: 늦참이 고른 쿼터보다 먼저 뜀 {p}")
        gk = slots.get("0"); chk(D["rsvp"][gk]["profile"]["pos1"] == "GK" or D["rsvp"][gk]["profile"]["pos2"] == "GK", f"{eid}: 골키퍼 자리에 골키퍼가 아님")
    for u, lc in (e.get("lateCancel") or {}).items():
        chk(vs.get(u, {}).get("s") == "no" and vs[u].get("lateCancel"), f"{eid}: 마감 뒤 불참 기록이 투표와 다름 {u}")
# 벌금: 출석과 마감 뒤 불참에서만, 수칙 금액대로
want = {}
for eid, e in seed_ev.items():
    for u, st in (e.get("check") or {}).items():
        if st == "late": want["f-%s-%s" % (eid, u)] = RULE["late"]
        if st == "absent": want["f-%s-%s" % (eid, u)] = RULE["absent"]
    for u in (e.get("lateCancel") or {}): want["fc-%s-%s" % (eid, u)] = RULE["cancel"]
have = {k: f["amount"] for k, f in D.get("fines", {}).items() if (f.get("eventId") or "").startswith("s")}
chk(want == have, f"벌금이 출석, 마감 뒤 불참과 다름: 빠짐 {set(want) - set(have)}, 남음 {set(have) - set(want)}")
for u, my in D.get("mydues", {}).items():
    fs = {f["id"] for f in my.get("fines", []) if (f.get("eventId") or "").startswith("s")}
    real = {k for k, f in D.get("fines", {}).items() if f["uid"] == u and (f.get("eventId") or "").startswith("s")}
    chk(fs == real, f"내가 낼 돈의 벌금이 벌금 목록과 다름 {u}")
    for m, st in (my.get("dues") or {}).items():
        chk((D.get("dues", {}).get(m, {}).get(u) == "paid") == (st == "paid"), f"내가 낼 돈의 회비가 회비 장부와 다름 {u} {m}")
# 대화: 방이 열린 뒤, 방에 있는 사람만 (운영진은 늘)
H24 = datetime.timedelta(hours=24)
for room, u, kind, at in CHAT:
    e = seed_ev.get(room)
    if not e: continue
    vs = votes.get(room, {})
    if kind in ("left", "join"): continue
    ok = MEM.get(u) in ("owner", "admin") or vs.get(u, {}).get("s") in ("yes", "late")
    chk(ok, f"{room}: 방에 없는 사람의 글 {u}")
    chk(at >= start(e) - H24 - datetime.timedelta(minutes=1), f"{room}: 방이 열리기 전 글 {at}")
print("문제", len(bad), "개")
for b in bad[:40]: print(" -", b)
sys.exit(1 if bad else 0)
