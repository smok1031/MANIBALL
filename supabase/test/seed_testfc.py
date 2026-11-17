# 점검용 TEST FC (축구) 데이터를 만드는 SQL을 쓴다. 테스트 서버(maniball 스키마)나 로컬 시험(public)에만 넣는다.
#   python3 supabase/test/seed_testfc.py maniball <Admin으로 넣을 user_id> > /tmp/seed.sql
# 가짜 팀원은 로그인할 수 없는 빈 계정 줄(auth.users id만)로 들어간다. 지울 때는 seed_testfc_drop.sql 을 쓴다.
import sys, json, uuid, datetime
SCH = sys.argv[1] if len(sys.argv) > 1 else "public"
OWNER = sys.argv[2] if len(sys.argv) > 2 else "00000000-0000-0000-0000-00000000000a"
TID = "7e57fc00-0000-4000-8000-000000000001"
now = datetime.datetime.utcnow() + datetime.timedelta(hours=9)
d = lambda n: (now + datetime.timedelta(days=n)).strftime("%Y-%m-%d")
iso = lambda dt: (dt - datetime.timedelta(hours=9)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
R = """김도현 CAM ST 10 admin
최성호 ST LW 9 admin
이준호 LW RW 7 member
박민수 CB CDM 4 member
정우진 GK CB 1 member
한지훈 RB CB 2 member
오세진 RW LW 11 member
김태윤 CB LB 5 member
서현우 LB LWB 3 member
윤재민 CM CDM 8 member
강태호 CDM CM 6 member
임하준 CM CAM 14 member
조민혁 ST CAM 19 member
신동욱 CB RB 15 member
배성준 RW ST 17 member
황준영 GK CB 21 member
송민재 LM LW 22 member
유지환 CDM CB 16 member
문태경 RB RWB 12 member
양승현 CAM CM 23 member
홍재석 LB CB 13 member
구본찬 CAM CM 18 member
백승민 ST LW 20 member
안도윤 RW LW 27 member
나현수 CB CDM 24 member"""
rows = [l.split() for l in R.splitlines()]
uid = {}
for i, r in enumerate(rows): uid[r[0]] = f"7e57fc00-0000-4000-8001-{i:012d}"
names = [r[0] for r in rows]
out = []
q = lambda s: out.append(s)
q("begin;")
q(f"delete from {SCH}.docs where team_id = '{TID}';")
q(f"insert into auth.users (id) values " + ",".join(f"('{u}')" for u in uid.values()) + " on conflict (id) do nothing;")
q(f"insert into {SCH}.teams (id, name, created_by, invite_code) values ('{TID}', 'TEST FC', '{OWNER}', 'TESTFC2026') on conflict (id) do nothing;")
mem = [f"('{TID}', '{OWNER}', 'owner', '정성목')"] + [f"('{TID}', '{uid[r[0]]}', '{r[4]}', '{r[0]}')" for r in rows]
q(f"insert into {SCH}.members (team_id, user_id, role, display_name) values " + ",".join(mem) + " on conflict do nothing;")
docs = []
doc = lambda c, i, x: docs.append((c, i, x))
settings = {"app": "maniball", "since": d(-60)[:7], "teamName": "TEST FC", "sport": "soccer", "feeMode": "monthly", "fee": 20000, "dueDay": "10",
            "cap": 14, "waitCap": 0, "voteClose": "eve", "voteTime": "21:00", "checkBefore": 10, "scrimMin": 20, "scrimDays": 3,
            "fineFrom": "custom", "fineDays": "2", "fineAp": "pm", "fineHour": "6",
            "rulesText": "1. 경기 10분 전까지 와서 몸을 풀어요\n2. 못 오면 투표 마감 전에 불참으로 바꿔요\n3. 회비는 매달 10일까지 내요\n4. 상대 팀과 심판을 존중해요",
            "rules": [{"label": "지각", "amount": 3000, "kind": "late"}, {"label": "마감 뒤 불참", "amount": 5000, "kind": "cancel"}, {"label": "말없이 불참", "amount": 10000, "kind": "absent"}],
            "rulesAt": iso(now - datetime.timedelta(days=7)),
            "bank": {"bank": "카카오뱅크", "account": "3333-01-2026111", "holder": "정성목"}}
doc("team", "settings", settings)
O = OWNER
allu = [O] + [uid[n] for n in names]
prof = {O: {"name": "정성목", "num": "99", "pos1": "GK", "pos2": "RW"}}
for r in rows: prof[uid[r[0]]] = {"name": r[0], "num": r[3], "pos1": r[1], "pos2": r[2]}
ev = {u: {} for u in allu}
at = lambda k: iso(now - datetime.timedelta(days=4, minutes=600 - k))
# 다가오는 경기: 정원 14명이 다 찼고 대기 2명, 용병 받는 중
E = {}
E["e1"] = {"type": "match", "date": d(3), "time": "07:00", "end": "09:00", "place": "상암 월드컵 보조구장", "opponent": "노을 FC", "cap": 14, "voteClose": "eve", "voteTime": "21:00", "guestOpen": True, "createdAt": iso(now - datetime.timedelta(days=4))}
for k, u in enumerate(allu[1:17]): ev[u]["e1"] = {"s": "late" if k in (5, 11) else "yes", "q": 3 if k == 5 else 2 if k == 11 else 0, "at": at(k)}
for u in allu[17:22]: ev[u]["e1"] = {"s": "no", "q": 0, "at": ""}
E["e2"] = {"type": "training", "date": d(7), "time": "20:00", "end": "22:00", "place": "난지 인조잔디 구장", "opponent": "", "cap": 16, "voteClose": "eve", "voteTime": "21:00", "createdAt": iso(now - datetime.timedelta(days=2))}
for k, u in enumerate(allu[1:11]): ev[u]["e2"] = {"s": "yes", "q": 0, "at": at(k)}
E["e3"] = {"type": "match", "date": d(2), "time": "07:00", "end": "09:00", "place": "상암 월드컵 보조구장", "opponent": "", "cap": 14, "voteClose": "eve", "voteTime": "21:00", "createdAt": iso(now - datetime.timedelta(days=1))}
for k, u in enumerate(allu[1:21]): ev[u]["e3"] = {"s": "yes", "q": 0, "at": at(k)}
# 벌금 기준 시각(경기 2일 전 오후 6시)이 이미 지났고 투표는 열려 있는 경기: 정원 안 사람이 불참으로 바꾸면 사유와 벌금을 남긴다
E["e5"] = {"type": "match", "date": d(1), "time": "22:00", "end": "23:50", "place": "목동 야간 구장", "opponent": "강북 FC", "cap": 12, "voteClose": "start", "voteTime": "", "createdAt": iso(now - datetime.timedelta(days=3))}
for k, u in enumerate(allu[0:13]): ev[u]["e5"] = {"s": "yes", "q": 0, "at": at(k)}
E["e4"] = {"type": "match", "date": d(17), "time": "08:00", "end": "10:00", "place": "고양 종합운동장 보조구장", "opponent": "번개 FC", "cap": 22, "voteClose": "eve", "voteTime": "21:00", "openAt": iso(now + datetime.timedelta(days=11)), "createdAt": iso(now - datetime.timedelta(hours=5))}
# 지난 경기
FORM = ["GK", "LB", "CB", "CB", "RB", "CDM", "CDM", "LW", "CAM", "RW", "ST"]
past = [("p1", -28, "하늘 FC", 3, 1), ("p2", -21, "번개 FC", 2, 2), ("p3", -14, "새벽 FC", 1, 2), ("p4", -7, "한강 FC", 4, 1)]
for j, (k, dd, opp, a, b) in enumerate(past):
    came = allu[1 + j: 15 + j]
    e = {"type": "match", "date": d(dd), "time": "07:00", "end": "09:00", "place": "상암 월드컵 보조구장", "opponent": opp, "cap": 14, "voteClose": "eve", "voteTime": "21:00",
         "score": {"us": a, "them": b}, "scoredAt": iso(now + datetime.timedelta(days=dd, hours=3)), "check": {u: ("late" if i == 3 else "in") for i, u in enumerate(came)}}
    e["goals"] = [{"uid": came[(i * 3 + 1) % len(came)], "assist": came[(i * 5 + 2) % len(came)] if i % 2 == 0 else ""} for i in range(a)]
    E[k] = e
    for u in came: ev[u][k] = {"s": "yes", "q": 0, "at": iso(now + datetime.timedelta(days=dd - 3))}
    for u in allu[15 + j: 19 + j]: ev[u][k] = {"s": "no", "q": 0, "at": ""}
# 오늘 새벽 경기: 결과 들어갔고 MOM 투표 중, 라인업 있음
came = allu[0:14]
E["p5"] = {"type": "match", "date": d(0), "time": (now - datetime.timedelta(hours=4)).strftime("%H:00"), "end": (now - datetime.timedelta(hours=2)).strftime("%H:00"), "place": "상암 월드컵 보조구장", "opponent": "노을 FC", "cap": 14,
           "voteClose": "eve", "voteTime": "21:00", "score": {"us": 2, "them": 1}, "scoredAt": iso(now - datetime.timedelta(hours=1)), "check": {u: "in" for u in came},
           "goals": [{"uid": came[2], "assist": came[1]}, {"uid": came[13], "assist": ""}],
           "lineupAt": iso(now - datetime.timedelta(days=1)),
           "lineup": {"main": {"fkey": "4-2-3-1", "formation": FORM, "pins": [], "q": {str(qq): {str(i): came[(i + qq * 3) % 14] for i in range(11)} for qq in range(1, 5)}}}}
for u in came: ev[u]["p5"] = {"s": "yes", "q": 0, "at": iso(now - datetime.timedelta(days=3))}
# 어제 내전: 결과 아직
came = allu[3:17]
E["p6"] = {"type": "scrim", "date": d(-1), "time": "20:00", "end": "22:00", "place": "난지 인조잔디 구장", "opponent": "", "cap": 20, "voteClose": "eve", "voteTime": "21:00", "check": {u: "in" for u in came}}
for u in came: ev[u]["p6"] = {"s": "yes", "q": 0, "at": iso(now - datetime.timedelta(days=4))}
for k, e in E.items(): e["id"] = k; doc("events", k, e)
for u in allu:
    data = {"profile": prof[u], "agreedAt": iso(now - datetime.timedelta(days=50)), "ev": ev[u]}
    if u == uid["임하준"]: data["posReq"] = {"pos1": "CAM", "pos2": "ST", "more": [], "note": "", "at": iso(now - datetime.timedelta(hours=20)), "status": "req"}
    doc("rsvp", u, data)
# MOM: 지난 경기들은 마감, 오늘 경기는 투표 중
for j, (k, dd, opp, a, b) in enumerate(past):
    win = allu[2 + j]
    for v in allu[5 + j: 12 + j]: pass
uv = {}
def momv(k, voters):
    for v, w in voters:
        uv.setdefault(v, {"mom": {}, "seen": {}})["mom"][k] = w
momv("p1", [(allu[5 + i], allu[2] if i < 5 else allu[4]) for i in range(9)])
momv("p2", [(allu[5 + i], allu[3] if i < 6 else allu[2]) for i in range(8)])
momv("p3", [(allu[5 + i], allu[2] if i < 7 else allu[1]) for i in range(10)])
momv("p4", [(allu[5 + i], allu[6] if i < 4 else allu[1]) for i in range(7)])
for v, data in uv.items(): doc("uvote", v, data)
# 회비와 벌금
mon = now.strftime("%Y-%m"); prev = (now.replace(day=1) - datetime.timedelta(days=1)).strftime("%Y-%m")
doc("dues", "m-" + prev, {u: "paid" for u in allu})
doc("dues", "m-" + mon, {u: "paid" for u in allu[:12]})
fine_u = allu[4]
doc("fines", "f-p4-" + fine_u, {"uid": fine_u, "date": d(-7), "eventId": "p4", "reason": "지각", "amount": 3000, "paid": False, "at": iso(now - datetime.timedelta(days=7))})
doc("fines", "f-p3-" + O, {"uid": O, "date": d(-14), "eventId": "p3", "reason": "지각", "amount": 3000, "paid": False, "at": iso(now - datetime.timedelta(days=14))})
for u in allu:
    my = {"dues": {"m-" + prev: "paid", "m-" + mon: "paid" if u in allu[:12] and u != O else ""}, "paidAt": {}, "fee": 20000, "mode": "monthly",
          "fines": [{"id": f"f-p4-{fine_u}", "date": d(-7), "eventId": "p4", "reason": "지각", "amount": 3000, "paid": False, "paidAt": "", "at": iso(now - datetime.timedelta(days=7))}] if u == fine_u else
                   [{"id": f"f-p3-{O}", "date": d(-14), "eventId": "p3", "reason": "지각", "amount": 3000, "paid": False, "paidAt": "", "at": iso(now - datetime.timedelta(days=14))}] if u == O else []}
    doc("mydues", u, my)
# 용병 신청, 공지
doc("guestreq", allu[7], {"items": {"g7a": {"eid": "e1", "name": "최민혁", "pos": "LB", "pos2": "CB", "rel": "회사 동료예요. 수비 쪽이면 어디든 괜찮대요.", "at": iso(now - datetime.timedelta(hours=6)), "status": "req"}}})
doc("notices", "n1", {"title": "12월 경기는 고양 종합운동장에서 해요", "body": "12월 6일 경기부터 고양 종합운동장 보조구장에서 해요.\n주차는 정문 쪽 공영주차장을 쓰면 돼요.", "pinned": True, "at": iso(now - datetime.timedelta(days=1)), "by": O})
doc("notices", "n2", {"title": "11월 회비는 10일까지 내 주세요", "body": "11월 회비 20,000원은 10일까지 팀 계좌로 보내 주세요.\n보낸 뒤 운영진이 확인하면 '냄'으로 바뀌어요.", "pinned": False, "at": iso(now - datetime.timedelta(days=9)), "by": allu[1]})
doc("notices", "n3", {"title": "겨울 유니폼 주문 받아요", "body": "겨울 긴팔 유니폼을 같이 주문해요. 사이즈는 다음 경기 때 받아요.", "pinned": False, "at": iso(now - datetime.timedelta(days=20)), "by": allu[1]})
vals = ",".join("('%s','%s','%s',%s)" % (TID, c, i, "$j$" + json.dumps(x, ensure_ascii=False) + "$j$") for c, i, x in docs)
q(f"insert into {SCH}.docs (team_id, coll, id, data) values {vals} on conflict (team_id, coll, id) do update set data = excluded.data;")
q("commit;")
q(f"select (select count(*) from {SCH}.members where team_id = '{TID}') as members, (select count(*) from {SCH}.docs where team_id = '{TID}') as docs;")
print("\n".join(out))
