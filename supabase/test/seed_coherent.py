# 테스트 서버와 체험(데모)용 예시 자료: 자료끼리 앞뒤가 맞게 만든다 (2026-11-26)
#   참석 투표한 사람만 정원, 대기, 라인업, 현장 출석에 들어가고, 현장 출석에서 온 사람만 이날 온 사람, 골, MOM 투표에 나온다.
#   점수와 골 기록 수가 같고, 지각과 말없이 불참과 마감 뒤 불참은 팀 수칙 금액으로 벌금이 붙고, 회비와 내가 낼 돈이 같다.
#   대화방 글은 그 일정 이야기이고, 방이 열린 뒤 그 방에 있는 사람만 쓴다. 날짜와 시각 순서도 맞다.
# 시각은 {{...}} 표로 적고, 쓰는 때(TEST FC는 지금, 체험은 체험을 시작할 때)에 실제 날짜로 바꾼다.
#   {{d:N}} 오늘+N일 날짜, {{T:N:HH:MM}} 오늘+N일 그 시각(ISO), {{t:N}} 지금+N분(ISO),
#   {{D:N}} 지금+N시간의 날짜, {{h:N}} 지금+N시간의 'HH:00', {{m:N}} 이번 달+N달 'YYYY-MM', {{me}} 체험하는 사람
# 쓰는 법:
#   python3 seed_coherent.py testfc <스키마> <TEST FC 운영진 user_id>  > testfc.sql   (실제 팀원과 그 자료는 그대로 둔다)
#   python3 seed_coherent.py demo <스키마>                               > demo.sql     (체험 원본 묶음과 체험 시작 함수)
import sys, json, re, datetime

MODE = sys.argv[1] if len(sys.argv) > 1 else "testfc"
SCH = sys.argv[2] if len(sys.argv) > 2 else "public"
OWNER = sys.argv[3] if len(sys.argv) > 3 else "00000000-0000-0000-0000-00000000000a"
TID = "7e57fc00-0000-4000-8000-000000000001"

R = """김도현 CAM ST 10 admin
최성호 ST LW 9 admin
이준호 LW RW 7 member
박민수 CB CDM 4 member
정우진 GK CB 1 member
한지훈 RB CB 2 member
오세진 RW LW 11 member
김태윤 CB LB 5 member
서현우 LB CB 3 member
윤재민 CM CDM 8 member
강태호 CDM CM 6 member
임하준 CM CAM 14 member
조민혁 ST CAM 19 member
신동욱 CB RB 15 member
배성준 RW ST 17 member
황준영 GK CB 21 member
송민재 LW RW 22 member
유지환 CDM CB 16 member
문태경 RB CB 12 member
양승현 CAM CM 23 member
홍재석 LB CB 13 member
구본찬 CM CAM 18 member
백승민 ST LW 20 member
안도윤 RW LW 27 member
나현수 CB CDM 24 member"""
ROWS = [l.split() for l in R.splitlines()]
FAKE_NS = "8001" if MODE == "testfc" else "8002"
UID = {r[0]: f"7e57fc00-0000-4000-{FAKE_NS}-{i:012d}" for i, r in enumerate(ROWS)}
PROF = {UID[r[0]]: {"name": r[0], "num": r[3], "pos1": r[1], "pos2": r[2]} for r in ROWS}
ROLE = {UID[r[0]]: r[4] for r in ROWS}
NAME = {UID[r[0]]: r[0] for r in ROWS}
FAKES = [UID[r[0]] for r in ROWS]
ME = "{{me}}"
MERC_UID = "7e57fc00-0000-4000-8003-000000009001"   # 체험 내전에 다른 팀에서 용병으로 온 사람 (소속 팀은 어디에도 안 보인다)
if MODE == "demo":
    PROF[ME] = {"name": "체험운영진", "num": "99", "pos1": "CM", "pos2": "CDM"}; NAME[ME] = "체험운영진"; ROLE[ME] = "owner"  # @이름으로 부를 수 있게 띄어쓰기 없이
    P = [ME] + FAKES          # 체험하는 사람도 팀원처럼 투표하고 뛴다 (홈과 기록에 내 기록이 보이게)
else:
    P = FAKES                 # 실제 계정(운영진, 실제 팀원)은 예시 일정에 넣지 않는다 (미응답으로 보인다)
ADMINS = [u for u in P if ROLE[u] in ("owner", "admin")]

RULES = [{"kind": "late", "label": "지각", "amount": 3000}, {"kind": "cancel", "label": "마감 뒤 불참", "amount": 5000}, {"kind": "absent", "label": "말없이 불참", "amount": 10000}]
AMT = {r["kind"]: r["amount"] for r in RULES}; LAB = {r["kind"]: r["label"] for r in RULES}
SETTINGS = {"app": "maniball", "teamName": "체험 FC", "sport": "soccer", "since": "{{m:-3}}", "feeMode": "monthly", "fee": 20000, "dueDay": "10",
            "cap": 14, "waitCap": 0, "voteClose": "eve", "voteTime": "21:00", "checkBefore": 10, "scrimMin": 20, "scrimDays": 5,
            "fineFrom": "custom", "fineDays": "2", "fineAp": "pm", "fineHour": "6", "joinApproval": False, "level": 3, "area": "서울 마포구",
            "rulesText": "1. 경기 10분 전까지 와서 몸을 풀어요\n2. 못 오면 투표 마감 전에 불참으로 바꿔요\n3. 회비는 매달 10일까지 내요\n4. 상대 팀과 심판을 존중해요",
            "rules": RULES, "rulesAt": "{{T:-30:20:00}}", "kit": {"home": "파랑", "away": "흰색"},
            "bank": {"bank": "카카오뱅크", "account": "3333-00-0000000", "holder": "체험운영진"}}

docs, chat = [], []
def doc(c, i, x): docs.append((c, i, x))
def say(room, u, body, at, kind=None): chat.append({"room": room, "u": u, "name": NAME.get(u, "용병"), "body": body, "kind": kind, "at": at})
rsvp = {u: {} for u in P}
fines = []          # (id, uid, date, eid, kind, paid, at)
check_of = {}

FORM = ["GK", "LB", "CB", "CB", "RB", "CDM", "CDM", "LW", "CAM", "RW", "ST"]
GROUP = {"GK": "GK", "LB": "D", "CB": "D", "RB": "D", "CDM": "M", "CM": "M", "CAM": "M", "LW": "A", "RW": "A", "ST": "A"}
def lineup(came, late_from):
    """쿼터마다 11명: 골키퍼는 골키퍼가, 나머지는 1선호, 2선호, 같은 줄 순서로. 늦참은 고른 쿼터부터. 쉬는 사람이 고르게 돌아간다"""
    q = {}; rest = {u: 0 for u in came}
    for qq in range(1, 5):
        avail = [u for u in came if late_from.get(u, 1) <= qq]
        avail.sort(key=lambda u: (-rest[u], came.index(u)))
        pick, used = {}, set()
        for stage in (lambda u, pos: PROF[u]["pos1"] == pos, lambda u, pos: PROF[u]["pos2"] == pos, lambda u, pos: GROUP[PROF[u]["pos1"]] == GROUP[pos] and pos != "GK", lambda u, pos: pos != "GK" and PROF[u]["pos1"] != "GK"):
            for i, pos in enumerate(FORM):
                if i in pick: continue
                for u in avail:
                    if u not in used and stage(u, pos): pick[i] = u; used.add(u); break
        for u in avail:
            if u not in used: rest[u] += 1
        q[str(qq)] = {str(i): pick[i] for i in sorted(pick)}
    return {"main": {"fkey": "4-2-3-1", "formation": FORM, "pins": [], "auto": True, "q": q}}

def event(eid, e, yes, late=None, no=(), wait_ok=True, vote_day=-3):
    """투표: yes와 late 순서가 먼저 낸 순서. 정원 넘으면 대기. 시각은 경기 vote_day일 전 저녁"""
    late = late or {}
    base_day = e["_day"] + vote_day
    order = list(yes)
    for k, u in enumerate(order):
        rsvp[u][eid] = {"s": "late" if u in late else "yes", "q": late.get(u, 0), "at": "{{T:%d:%02d:%02d}}" % (base_day, 19 + k // 30, (k * 2) % 60)}
    for k, u in enumerate(no):
        rsvp[u][eid] = {"s": "no", "q": 0, "at": "{{T:%d:21:%02d}}" % (base_day, k)}
    cap = e.get("cap", 14)
    return order[:cap], order[cap:]

def kst_day(tok): return tok

E = {}
def ev(eid, **kw):
    kw["id"] = eid; E[eid] = kw; return kw

# ===== 지난 경기 4번과 내전 1번: 투표, 현장 출석, 결과, 골, MOM, 벌금이 서로 맞는다
PAST = [  # id, 며칠 전, 종류, 상대, 우리, 상대점수
    ("sp1", -28, "match", "하늘 FC", 3, 1),
    ("sp2", -21, "match", "번개 FC", 2, 2),
    ("sp3", -14, "match", "새벽 FC", 1, 2),
    ("sp4", -9, "scrim", "", 4, 3),
    ("sp5", -7, "match", "한강 FC", 4, 1),
]
mom_votes = {}   # 투표한 사람 -> {경기: 고른 사람}
def rot(lst, k): return lst[k % len(lst):] + lst[:k % len(lst)]
for j, (eid, dd, typ, opp, us, them) in enumerate(PAST):
    pool = rot(P, j * 4)
    yes = pool[:16 if typ == "match" else 20]
    no = pool[16:19] if typ == "match" else pool[20:22]
    cap = 14 if typ == "match" else 20
    e = ev(eid, type=typ, date="{{d:%d}}" % dd, time="07:00" if typ == "match" else "20:00", end="09:00" if typ == "match" else "22:00",
           place="상암 월드컵 보조구장" if typ == "match" else "난지 인조잔디 구장", opponent=opp, cap=cap, voteClose="eve", voteTime="21:00",
           createdAt="{{T:%d:10:00}}" % (dd - 6), _day=dd)
    going, waiting = event(eid, e, yes, no=no)
    # 현장 출석: 정원 안 사람만. 한 명 지각, sp3는 한 명 말없이 불참
    ck, cat = {}, {}
    for i, u in enumerate(going):
        st = "late" if i == 3 else "absent" if (eid == "sp3" and i == 9) else "in"
        ck[u] = st
        if st != "absent": cat[u] = "06:5%d" % (i % 10) if typ == "match" else "19:5%d" % (i % 10)
        if st == "late": cat[u] = "07:12" if typ == "match" else "20:14"
    e.update(check=ck, checkAt=cat, checkDone="{{T:%d:%s}}" % (dd, "09:20" if typ == "match" else "22:20"))
    came = [u for u in going if ck[u] in ("in", "late")]
    # 골: 넣은 사람과 도운 사람은 이날 온 사람 중에서 (내전은 A팀 골만 우리 쪽 기록)
    scorers = [u for u in came if PROF[u]["pos1"] in ("ST", "LW", "RW", "CAM")] or came
    helpers = [u for u in came if PROF[u]["pos1"] in ("CM", "CAM", "LW", "RW", "LB", "RB")] or came
    goals = []
    for g in range(us):
        s = scorers[(g * 2 + j) % len(scorers)]
        a = next((h for h in rot(helpers, g + j) if h != s), "") if g % 3 != 2 else ""
        goals.append({"uid": s, "assist": a})
    e.update(score={"us": us, "them": them}, scoredAt="{{T:%d:%s}}" % (dd, "09:30" if typ == "match" else "22:30"), goals=goals)
    # MOM: 이날 온 사람끼리, 자기 자신은 못 고른다. 골을 가장 많이 넣은 사람이 가장 많이 받는다
    top = max(came, key=lambda u: sum(1 for g in goals if g["uid"] == u))
    second = next(u for u in came if u != top)
    for k, v in enumerate(came[:10]):
        w = top if v != top and k % 4 != 3 else second
        if w == v: w = came[-1] if came[-1] != v else came[-2]
        mom_votes.setdefault(v, {})[eid] = w
    # 벌금: 지각, 말없이 불참 (팀 수칙 금액). 오래된 것은 냈음
    for u, st in ck.items():
        if st in ("late", "absent"):
            kind = "late" if st == "late" else "absent"
            fines.append(("f-%s-%s" % (eid, u), u, "{{d:%d}}" % dd, eid, kind, dd <= -14, "{{T:%d:%s}}" % (dd, "09:25" if typ == "match" else "22:25")))
    check_of[eid] = ck

# ===== 오늘 경기: 1시간 전에 끝남. 결과와 MOM 투표 중, 라인업 있음, 대화방은 1~2시간 뒤 사라짐
pool = rot(P, 3)
e = ev("sp6", type="match", date="{{D:-3}}", time="{{h:-3}}", end="{{h:-1}}", place="상암 월드컵 보조구장", opponent="노을 FC", cap=14, voteClose="eve", voteTime="21:00",
       createdAt="{{T:-6:10:00}}", _day=0)
going, waiting = event("sp6", e, pool[:15], late={pool[6]: 2}, no=pool[15:18], vote_day=-3)
ck = {u: "in" for u in going}; ck[going[9]] = "late"   # 늦참(2쿼터부터)은 고른 쿼터에 맞춰 와서 지각이 아니다. 지각은 다른 사람
e.update(check=ck, checkAt={u: "{{h:-3}}" for u in going}, checkDone="{{t:-50}}")
came = going[:]
late_from = {pool[6]: 2}
e["lineup"] = lineup(came, late_from); e["lineupAt"] = "{{T:-1:20:30}}"
sc = [u for u in came if PROF[u]["pos1"] in ("ST", "LW", "RW", "CAM")]
e.update(score={"us": 2, "them": 1}, scoredAt="{{t:-40}}", goals=[{"uid": sc[0], "assist": next(u for u in came if PROF[u]["pos1"] in ("CM", "CDM"))}, {"uid": sc[1], "assist": ""}])
for k, v in enumerate(came[:6]):   # MOM 투표 중: 6명이 냈다
    w = sc[0] if v != sc[0] else sc[1]
    mom_votes.setdefault(v, {})["sp6"] = w
fines.append(("f-sp6-%s" % going[9], going[9], "{{D:-3}}", "sp6", "late", False, "{{t:-45}}"))
check_of["sp6"] = ck
SP6_CAME = came

# ===== 어제 내전: 현장 출석은 받았고 결과는 아직. 팀 안 용병 1명(지인), 체험에서는 다른 팀 용병 1명도
pool = rot(P, 7)
e = ev("sp7", type="scrim", date="{{d:-1}}", time="20:00", end="22:00", place="난지 인조잔디 구장", opponent="", cap=20, voteClose="eve", voteTime="21:00",
       createdAt="{{T:-8:10:00}}", _day=-1, guestOpen=True)
going, waiting = event("sp7", e, pool[:18], no=pool[18:21])
host = pool[2]
guests = {"gfr1": {"name": "최민혁", "pos": "LB", "pos2": "CB", "by": ADMINS[0], "at": "{{T:-3:12:00}}", "inCap": True, "via": host}}
ck = {u: "in" for u in going}; ck["g:gfr1"] = "in"
if MODE == "demo":
    guests["xdemo1"] = {"name": "박건우", "pos": "CB", "by": ADMINS[0], "at": "{{T:-3:13:00}}", "inCap": True,
                        "ext": {"uid": MERC_UID, "sub": "", "app": "demo-app-1", "fee": 0, "mode": "free"}}
    ck["xdemo1"] = "in"
e.update(guests=guests, check=ck, checkAt={u: "19:5%d" % (i % 10) for i, u in enumerate(ck)}, checkDone="{{T:-1:22:10}}")
check_of["sp7"] = ck
doc("guestreq", host, {"items": {"gfr1": {"eid": "sp7", "name": "최민혁", "pos": "LB", "pos2": "CB", "rel": "회사 동료예요. 수비 쪽이면 어디든 괜찮대요.", "at": "{{T:-4:12:00}}", "status": "ok"}}})

# ===== 20시간 뒤 경기: 대화방이 열려 있음(경기 24시간 전). 벌금 기준 시각이 지나 한 명이 사유를 남기고 불참, 대기 1번이 올라옴
pool = rot(P, 1)
e = ev("su1", type="match", date="{{D:20}}", time="{{h:20}}", end="{{h:22}}", place="목동 인조잔디 구장", opponent="강북 FC", cap=12, voteClose="start", voteTime="",
       createdAt="{{T:-5:11:00}}", _day=0)
yes = pool[:14]
going, waiting = event("su1", e, yes, no=pool[14:16], vote_day=-2)
lc = going[4]
rsvp[lc]["su1"].update({"s": "no", "lateCancel": "{{t:-130}}", "reason": "야근이 잡혔어요"})
e["lateCancel"] = {lc: {"t": "{{t:-130}}", "at": rsvp[lc]["su1"]["at"], "amount": AMT["cancel"], "reason": "야근이 잡혔어요"}}
fines.append(("fc-su1-%s" % lc, lc, "{{D:20}}", "su1", "cancel", False, "{{t:-130}}"))
in_room = [u for u in yes if u != lc][:12]
SU1_ROOM = in_room; SU1_LEFT = lc

# ===== 다가오는 일정
pool = rot(P, 5)
e = ev("su2", type="match", date="{{d:3}}", time="07:00", end="09:00", place="상암 월드컵 보조구장", opponent="노을 FC", cap=14, voteClose="eve", voteTime="21:00",
       createdAt="{{T:-2:10:00}}", _day=3, guestOpen=True)
event("su2", e, pool[:16], late={pool[5]: 3, pool[11]: 2}, no=pool[16:19], vote_day=-5)
doc("guestreq", pool[8], {"items": {"gsu2": {"eid": "su2", "name": "이현우", "pos": "CM", "pos2": "CDM", "rel": "대학 후배예요. 중원에서 잘 뛰어요.", "at": "{{T:-1:13:20}}", "status": "req"}}})
pool = rot(P, 9)
e = ev("su3", type="match", date="{{d:5}}", time="07:00", end="09:00", place="상암 월드컵 보조구장", opponent="", cap=14, voteClose="eve", voteTime="21:00", createdAt="{{T:-1:09:30}}", _day=5)
event("su3", e, pool[:9], no=pool[9:11], vote_day=-6)
pool = rot(P, 12)
e = ev("su4", type="training", date="{{d:7}}", time="20:00", end="22:00", place="난지 인조잔디 구장", opponent="", cap=16, voteClose="eve", voteTime="21:00", createdAt="{{T:-1:11:00}}", _day=7)
event("su4", e, pool[:10], vote_day=-8)
ev("su5", type="match", date="{{d:17}}", time="08:00", end="10:00", place="고양 종합운동장 보조구장", opponent="번개 FC", cap=22, voteClose="eve", voteTime="21:00",
   openAt="{{T:11:09:00}}", createdAt="{{T:0:08:00}}", _day=17)

for k, x in E.items():
    x.pop("_day", None); doc("events", k, x)

# ===== 팀원 문서: 프로필과 투표. 한 명은 포지션 변경 요청
for i, u in enumerate(P):
    data = {"profile": PROF[u], "agreedAt": "{{T:-60:12:00}}", "ev": rsvp[u]}
    if NAME[u] == "임하준": data["posReq"] = {"pos1": "CAM", "pos2": "ST", "more": [], "note": "요즘 공격 쪽이 더 편해요", "at": "{{T:-1:18:00}}", "status": "req"}
    doc("rsvp", u, data)

# ===== 공지와 회식 날짜 설문 (설문은 팀원 투표와 집계가 맞게)
author = ADMINS[0]
doc("notices", "sn1", {"title": "다음 달 경기는 고양 종합운동장에서 해요", "body": "다음 달 첫 경기부터 고양 종합운동장 보조구장에서 해요.\n주차는 정문 쪽 공영주차장을 쓰면 돼요.", "pinned": True, "at": "{{T:-1:21:00}}", "by": author})
doc("notices", "sn2", {"title": "이번 달 회비는 10일까지 내 주세요", "body": "이번 달 회비 20,000원은 10일까지 팀 계좌로 보내 주세요.\n보낸 뒤 운영진이 확인하면 '냄'으로 바뀌어요.", "pinned": False, "at": "{{T:-12:20:00}}", "by": author})
doc("notices", "sn3", {"title": "연말 회식 날짜를 골라 주세요", "body": "연말 회식 날짜를 정해요. 되는 날을 모두 골라 주세요.", "pinned": False, "at": "{{T:-2:19:00}}", "by": author,
                       "poll": {"q": "회식 날짜", "multi": True, "until": "{{T:4:23:59}}", "opts": [{"id": "o1", "label": "금요일 저녁"}, {"id": "o2", "label": "토요일 저녁"}, {"id": "o3", "label": "일요일 점심"}]}})
poll = {}
for k, u in enumerate(P[:17]):
    poll[u] = ["o1", "o2", "o1,o2", "o3", "o2"][k % 5]

# ===== MOM 투표와 설문 투표 (uvote)
for u in set(list(mom_votes) + list(poll)):
    d = {"mom": mom_votes.get(u, {})}
    if u in poll: d["poll"] = {"sn3": poll[u]}
    doc("uvote", u, d)

# ===== 회비 (달마다): 지난 달까지는 거의 다 냈고 이번 달은 절반쯤. 내가 낼 돈은 회비와 벌금에서 계산
months = ["{{m:%d}}" % k for k in ((-3, -2, -1, 0) if MODE == "demo" else (-2, -1, 0))]
dues = {}
for mi, m in enumerate(months):
    last = mi == len(months) - 1
    paid = [u for k, u in enumerate(P) if (not last and not (mi == len(months) - 2 and k % 9 == 4)) or (last and k % 2 == 0)]
    dues[m] = {u: "paid" for u in paid}
    dues[m]["_at"] = {u: "{{T:%d:21:%02d}}" % ([-80, -50, -20, -10][mi + 4 - len(months)], k % 60) for k, u in enumerate(paid)}
    doc("dues", "m-" + m, dues[m])
fine_docs = {}
for (fid, u, date, eid, kind, paid, at) in fines:
    f = {"uid": u, "date": date, "eventId": eid, "reason": LAB[kind], "amount": AMT[kind], "paid": paid, "paidAt": at if paid else "", "at": at}
    doc("fines", fid, f); fine_docs.setdefault(u, []).append(dict(f, id=fid))
for u in P:
    my = {"dues": {"m-" + m: ("paid" if u in dues[m] else "") for m in months}, "paidAt": {"m-" + m: dues[m]["_at"][u] for m in months if u in dues[m]},
          "fines": [{"id": f["id"], "date": f["date"], "eventId": f["eventId"], "reason": f["reason"], "amount": f["amount"], "paid": f["paid"], "paidAt": f["paidAt"], "at": f["at"]} for f in fine_docs.get(u, [])],
          "fee": 20000, "mode": "monthly"}
    doc("mydues", u, my)

# ===== 대화: 방이 열린 뒤, 그 방에 있는 사람만, 그 일정 이야기
FA = [u for u in ADMINS if u != ME]          # 가짜 운영진 (김도현, 최성호)
A0, A1 = FA[0], FA[1]
BOSS = ME if MODE == "demo" else A0         # 체험에서는 체험하는 사람이 부름을 받는다
say("all", A0, "다음 달부터 고양 종합운동장에서 해요. 공지 꼭 봐 주세요", "{{T:-1:21:05}}")
say("all", P[5], "주차는 정문 쪽이 편하더라고요", "{{T:-1:21:20}}")
say("all", P[9], "회식 날짜 설문 아직 안 고르신 분들 골라 주세요", "{{T:-1:22:00}}")
say("all", P[12], "토요일 저녁 좋아요", "{{T:0:08:10}}")
say("ops", A0, "어제 내전 결과는 제가 오늘 저녁에 넣을게요", "{{T:0:09:00}}")
say("ops", A1, "네, 다음 주 매칭 상대는 노을 FC로 잡혔어요", "{{T:0:09:12}}")
say("ops", BOSS, "이번 달 회비 아직 안 낸 분들은 주말에 한 번 더 알려요", "{{T:0:09:20}}")
# 오늘 경기 방: 경기 24시간 전에 열렸고, 정원 안 사람만
r = SP6_CAME
say("sp6", A0, "내일 상암 경기예요. 10분 전까지 와 주세요", "{{t:-1500}}")
say("sp6", r[2], "공 두 개 챙겨 갈게요", "{{t:-1450}}")
say("sp6", r[6], "저는 2쿼터부터 들어가요", "{{t:-1400}}")
say("sp6", r[9], "@" + NAME[BOSS] + " 주차 자리 넉넉한가요?", "{{t:-1380}}")
say("sp6", BOSS, "네, 보조구장 앞에 자리 많아요", "{{t:-1370}}")
say("sp6", r[1], "다들 수고하셨어요. 2 : 1 승리!", "{{t:-55}}")
say("sp6", r[4], "MOM 투표 잊지 마세요", "{{t:-50}}")
# 20시간 뒤 경기 방: 4시간 전에 열림. 한 명은 사유를 남기고 불참으로 나감
r = SU1_ROOM
say("su1", A0, "내일 목동 인조잔디 구장이에요. 주차는 지하 주차장이 편해요", "{{t:-230}}")
say("su1", r[3], "@" + NAME[A1] + " 끝나고 같이 밥 먹어요", "{{t:-200}}")
say("su1", SU1_LEFT, "", "{{t:-130}}", kind="left")
say("su1", r[11], "", "{{t:-125}}", kind="join")   # 대기 1번이던 사람이 자리가 나서 들어옴
say("su1", r[11], "대기에서 올라왔어요. 잘 부탁드려요", "{{t:-110}}")
say("su1", r[5], "우비 챙기세요, 비 소식 있어요", "{{t:-40}}")

# ===== 체험 세상: 다른 팀(매칭, 용병 구인 글). 체험하는 사람과 TEST FC 둘 다 PC에서 본다
OT = [  # 팀 id 꼬리, 이름, 실력, 지역, 팀원 수
    ("101", "강북 FC", 3, "서울 강북구", 12),
    ("102", "노을 FC", 2, "서울 마포구", 11),
    ("103", "번개 FC", 4, "경기 고양시", 13),
]
OTN = ["김건우", "이도윤", "박서준", "최하준", "정지호", "강민준", "조우진", "윤도현", "장시우", "임준서", "한예준", "오지환", "서유찬"]
OPOS = ["GK", "CB", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST", "ST", "CM"]
world = []
for ti, (tail, tname, lv, region, n) in enumerate(OT):
    tid = f"7e57fc00-0000-4000-8000-000000000{tail}"
    names = rot(OTN, ti * 4)
    mem = [(f"7e57fc00-0000-4000-8003-0000{int(tail):04d}{k:04d}", "owner" if k == 0 else "member", names[k]) for k in range(n)]
    tdocs = []
    tdocs.append(("team", "settings", {"app": "maniball", "teamName": tname, "sport": "soccer", "since": "{{m:-6}}", "feeMode": "monthly", "fee": 20000, "cap": 14, "voteClose": "eve", "voteTime": "21:00",
                                       "level": lv, "area": region, "kit": {"home": ["빨강", "주황", "검정"][ti], "away": "흰색"}, "rules": RULES, "bank": {"bank": "토스뱅크", "account": "1000-00-0000000", "holder": names[0]}}))
    evs = {"m": {"id": "om", "type": "match", "date": "{{d:%d}}" % (4 + ti * 2), "time": ["07:00", "08:00", "19:00"][ti], "end": ["09:00", "10:00", "21:00"][ti],
                 "place": ["월드컵 보조구장", "망원 한강공원 축구장", "고양 종합운동장 보조구장"][ti], "opponent": "", "cap": 14, "voteClose": "eve", "voteTime": "21:00", "createdAt": "{{T:-2:10:00}}"},
           "h": {"id": "oh", "type": "scrim" if ti == 1 else "match", "date": "{{d:%d}}" % (2 + ti * 3), "time": ["20:00", "19:30", "07:00"][ti], "end": ["22:00", "21:30", "09:00"][ti],
                 "place": ["강북 구민운동장", "난지 인조잔디 구장", "일산 호수공원 구장"][ti], "opponent": "" if ti == 1 else ["하늘 FC", "", "새벽 FC"][ti], "cap": 14, "voteClose": "eve", "voteTime": "21:00", "createdAt": "{{T:-2:11:00}}"}}
    votes = {}
    for k, (u, role, nm) in enumerate(mem):
        votes[u] = {"om": {"s": "yes" if k < n - 2 else "no", "q": 0, "at": "{{T:-1:20:%02d}}" % k}, "oh": {"s": "yes" if k < n - 4 else "no", "q": 0, "at": "{{T:-1:21:%02d}}" % k}}
        tdocs.append(("rsvp", u, {"profile": {"name": nm, "num": str(k + 1), "pos1": OPOS[k], "pos2": OPOS[(k + 3) % len(OPOS)] if OPOS[(k + 3) % len(OPOS)] != OPOS[k] else ""}, "ev": votes[u]}))
    for key in ("m", "h"): tdocs.append(("events", evs[key]["id"], evs[key]))
    need = n - 4
    slots = [["LB", "CB"], ["ST"], ["CM", "CDM"]][ti]
    posts = [{"kind": "match", "event": "om", "field": "yes", "kit": ["빨강", "주황", "검정"][ti], "memo": ["구장은 우리가 잡았어요. 매너 경기해요", "초보 환영해요. 천천히 즐겁게 차요", "실력 비슷한 팀이면 좋겠어요"][ti], "fee_mode": "split", "fee_total": [120000, 100000, 140000][ti]},
             {"kind": "hire", "event": "oh", "field": "yes", "kit": "", "memo": ["수비 한 명 구해요. 경기 끝나고 같이 식사해요", "공격수 한 명 와 주세요", "중원에서 뛰실 분 구해요"][ti],
              "slots": [slots], "fee_mode": ["split", "free", "pay"][ti], "fee_total": [110000, None, None][ti], "pay_amt": [None, None, 10000][ti]}]
    world.append({"team": tid, "name": tname, "members": [{"u": u, "role": role, "name": nm} for u, role, nm in mem], "docs": [{"c": c, "i": i, "x": x} for c, i, x in tdocs], "posts": posts})

# ===================== 출력
TOK = re.compile(r"\{\{(d|D|h|t|m|T):(-?\d+)(?::(\d\d:\d\d))?\}\}")
KST = datetime.timezone(datetime.timedelta(hours=9))
def resolve(s, now):
    def f(m):
        k, n, hm = m.group(1), int(m.group(2)), m.group(3)
        kn = now.astimezone(KST)
        if k == "d": return (kn + datetime.timedelta(days=n)).strftime("%Y-%m-%d")
        if k == "D": return (kn + datetime.timedelta(hours=n)).strftime("%Y-%m-%d")
        if k == "h": return (kn + datetime.timedelta(hours=n)).strftime("%H:00")
        if k == "t": return (now + datetime.timedelta(minutes=n)).astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        if k == "m":
            y, mo = kn.year, kn.month + n
            while mo < 1: y -= 1; mo += 12
            while mo > 12: y += 1; mo -= 12
            return "%04d-%02d" % (y, mo)
        if k == "T":
            d = (kn + datetime.timedelta(days=n)).date(); hh, mm = map(int, hm.split(":"))
            return datetime.datetime(d.year, d.month, d.day, hh, mm, tzinfo=KST).astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    return TOK.sub(f, s)
J = lambda x: json.dumps(x, ensure_ascii=False)
Q = lambda s: "'" + s.replace("'", "''") + "'"

if MODE == "testfc":
    now = datetime.datetime.now(datetime.timezone.utc)
    R_ = lambda s: resolve(s, now)
    o = ["begin;", "select set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true);",
         "create temp table _seed_t0 on commit drop as select now() t0;"]
    o.append("-- 예전 예시 자료 (가짜 팀원만 있던 일정, 공지, 벌금, 집계). 실제 팀원이 만든 일정(emwoieu2rk1ag 등)과 대화 글은 그대로 둔다")
    old_ev = ["e1", "e2", "e3", "e4", "e5", "p1", "p2", "p3", "p4", "p5", "p6"]
    o.append(f"delete from {SCH}.docs where team_id = '{TID}' and ((coll = 'events' and id = any(array{old_ev})) or (coll = 'notices' and id in ('n1', 'n2', 'n3')) or (coll = 'tally' and id in ('mom-p1', 'mom-p2', 'mom-p3', 'mom-p4', 'seen-n1', 'seen-n2', 'seen-n3')) or (coll = 'fines' and (data ->> 'eventId') = any(array{old_ev})) or coll = 'guestreq');")
    o.append(f"-- 운영진 본인의 내가 낼 돈에서 지운 예시 일정의 벌금만 뺀다 (다른 기록은 그대로)")
    o.append(f"update {SCH}.docs set data = jsonb_set(data, '{{fines}}', coalesce((select jsonb_agg(f) from jsonb_array_elements(case when jsonb_typeof(data -> 'fines') = 'array' then data -> 'fines' else '[]'::jsonb end) f where not (f ->> 'eventId') = any(array{old_ev})), '[]'::jsonb)) where team_id = '{TID}' and coll = 'mydues';")
    o.append(f"insert into auth.users (id) values " + ",".join(f"('{u}')" for u in FAKES) + " on conflict (id) do nothing;")
    o.append(f"insert into {SCH}.members (team_id, user_id, role, display_name) values " + ",".join(f"('{TID}', '{u}', '{ROLE[u]}', {Q(NAME[u])})" for u in FAKES) + " on conflict (team_id, user_id) do update set role = excluded.role, display_name = excluded.display_name;")
    vals = []
    for c, i, x in docs:
        if c == "dues": continue
        vals.append(f"('{TID}', '{c}', {Q(R_(i))}, {Q(R_(J(x)))}::jsonb)")
    o.append(f"insert into {SCH}.docs (team_id, coll, id, data) values " + ",\n".join(vals) + " on conflict (team_id, coll, id) do update set data = excluded.data;")
    o.append("-- 회비: 실제 팀원의 납부 기록은 그대로 두고 가짜 팀원 칸만 더한다")
    for c, i, x in docs:
        if c != "dues": continue
        at = x.pop("_at"); body = R_(J({u: x.get(u, "") for u in FAKES})); atj = R_(J(at))   # 안 낸 가짜 팀원도 칸을 비워 예전 값이 남지 않게
        o.append(f"insert into {SCH}.docs (team_id, coll, id, data) values ('{TID}', 'dues', {Q(R_(i))}, ({Q(body)}::jsonb || jsonb_build_object('_at', {Q(atj)}::jsonb))) on conflict (team_id, coll, id) do update set data = {SCH}.docs.data || {Q(body)}::jsonb || jsonb_build_object('_at', coalesce({SCH}.docs.data -> '_at', '{{}}'::jsonb) || {Q(atj)}::jsonb);")
    o.append(f"delete from {SCH}.chat where team_id = '{TID}' and room in ('sp6', 'su1', 'sp7');")
    cv = [f"('{TID}', {Q(c['room'])}, '{c['u']}', {Q(c['name'])}, {Q(c['body'])}, {Q(c['kind']) if c['kind'] else 'null'}, {Q(R_(c['at']))}::timestamptz)" for c in chat if c["room"] not in ("all", "ops")]
    o.append(f"insert into {SCH}.chat (team_id, room, user_id, name, body, kind, created_at) values " + ",\n".join(cv) + ";")
    o.append("-- 예시를 넣는 동안 생긴 알림은 보내지 않는다 (실제 팀원 휴대폰이 울리지 않게)")
    o.append(f"delete from {SCH}.push_outbox where created_at >= (select t0 from _seed_t0);")
    o.append("commit;")
    o.append(f"select (select count(*) from {SCH}.members where team_id = '{TID}') members, (select count(*) from {SCH}.docs where team_id = '{TID}') docs, (select count(*) from {SCH}.chat where team_id = '{TID}') chat;")
    print("\n".join(o))
else:
    pack = {"settings": SETTINGS, "members": [{"u": u, "role": ROLE[u], "name": NAME[u]} for u in P],
            "docs": [{"c": c, "i": i, "x": x} for c, i, x in docs], "chat": chat}
    o = ["-- 체험 원본 묶음 (seed_coherent.py demo 로 만듦). demo.sql 뒤에 실행한다", "begin;",
         f"insert into {SCH}.demo_pack (k, pack, refreshed_on) values ('team', {Q(J(pack))}::jsonb, null), ('world', {Q(J(world))}::jsonb, null)",
         "  on conflict (k) do update set pack = excluded.pack, refreshed_on = null;", "commit;"]
    print("\n".join(o))
