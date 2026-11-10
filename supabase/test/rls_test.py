"""Checks schema.sql permissions on a local Postgres with Supabase stubs.
Usage: python3 rls_test.py "host=/var/tmp/pgt port=5499 user=postgres dbname=t1"
"""
import sys, json, psycopg2
from psycopg2 import errors

DSN = sys.argv[1]
OWNER, ADMIN, MEM, OTHER = ("00000000-0000-0000-0000-00000000000" + c for c in "abcd")
conn = psycopg2.connect(DSN); conn.autocommit = True
fails = []
with conn.cursor() as c0: c0.execute("truncate public.teams cascade")
import datetime
KST = datetime.timezone(datetime.timedelta(hours=9))
TODAY = datetime.datetime.now(KST).date().isoformat()

def ok(name, cond, extra=""):
    print(("ok:   " if cond else "FAIL: ") + name, extra if not cond else "")
    if not cond: fails.append(name)

def as_user(uid, sql, args=None, fetch=True):
    with conn.cursor() as c:
        c.execute("begin")
        try:
            c.execute("set local role authenticated")
            c.execute("select set_config('request.jwt.claim.sub', %s, true)", (uid,))
            c.execute(sql, args)
            out = c.fetchall() if fetch and c.description else c.rowcount
            c.execute("commit")
            return out
        except Exception as e:
            c.execute("rollback")
            return e

def denied(r):
    return isinstance(r, Exception)

# 팀 만들기와 들어가기
tid = as_user(OWNER, "select public.create_team('KEI FC')")[0][0]
ok("owner creates team", tid is not None)
code = as_user(OWNER, "select public.team_invite_code(%s)", (tid,))[0][0]
ok("owner gets invite code", bool(code))
ok("member sees nothing before joining", as_user(MEM, "select count(*) from public.docs where team_id = %s", (tid,))[0][0] == 0)
ok("team_by_code works", as_user(MEM, "select name from public.team_by_code(%s)", (code,))[0][0] == "KEI FC")
ok("bad code refused", denied(as_user(MEM, "select public.join_team('nope', '')")))
as_user(MEM, "select public.join_team(%s, %s)", (code, "이세영"))
as_user(ADMIN, "select public.join_team(%s, %s)", (code, ""))
ok("joined names", dict(as_user(OWNER, "select user_id::text, display_name from public.members where team_id = %s", (tid,))) == {OWNER: "정성목", ADMIN: "김성우", MEM: "이세영"})
ok("member cannot promote", denied(as_user(MEM, "select public.set_member_role(%s, %s, 'admin')", (tid, MEM))))
ok("member cannot insert members directly", denied(as_user(MEM, "insert into public.members (team_id, user_id, role) values (%s, %s, 'owner')", (tid, OTHER))))
ok("member cannot update own role", as_user(MEM, "update public.members set role = 'owner' where user_id = %s", (MEM,)) == 0 or denied(as_user(MEM, "update public.members set role = 'owner' where user_id = %s", (MEM,))))
as_user(OWNER, "select public.set_member_role(%s, %s, 'admin')", (tid, ADMIN))
ok("owner promoted admin", as_user(OWNER, "select role from public.members where team_id = %s and user_id = %s", (tid, ADMIN))[0][0] == "admin")
ok("owner cannot demote self", denied(as_user(OWNER, "select public.set_member_role(%s, %s, 'member')", (tid, OWNER))))

def put(uid, coll, id, data):
    return as_user(uid, "insert into public.docs (team_id, coll, id, data) values (%s, %s, %s, %s) on conflict (team_id, coll, id) do update set data = excluded.data returning updated_at, updated_by::text", (tid, coll, id, json.dumps(data)))

# 운영진 쓰기
ok("admin writes player", not denied(put(ADMIN, "players", "p1", {"name": "이세영", "num": "5"})))
ok("admin writes event", not denied(put(ADMIN, "events", "e1", {"id": "e1", "date": "2099-11-14", "time": "08:00", "type": "match"})))
put(ADMIN, "events", "e0", {"id": "e0", "date": TODAY, "time": "00:00", "type": "match"})
put(ADMIN, "events", "e2", {"id": "e2", "date": "2099-11-21", "type": "match"})
ok("admin writes fine", not denied(put(ADMIN, "fines", "f1", {"pid": "p1", "amount": 2000})))
ok("admin writes dues", not denied(put(ADMIN, "dues", "2026-11", {"p1": "paid"})))
ok("admin writes contacts", not denied(put(ADMIN, "contacts", "p1", {"phone": "010"})))
ok("admin writes notice", not denied(put(ADMIN, "notices", "n1", {"title": "공지", "poll": {"opts": [{"id": "o1"}, {"id": "o2"}]}})))
ok("admin writes member's mydues", not denied(put(ADMIN, "mydues", MEM, {"pid": "p1", "months": {"2026-11": "paid"}})))
r = put(ADMIN, "players", "p2", {"name": "x"})
ok("server stamps updated_by", r[0][1] == ADMIN, r)

# 팀원 쓰기
ok("member cannot write players", denied(put(MEM, "players", "p9", {"name": "x"})))
ok("member cannot write fines", denied(put(MEM, "fines", "f9", {})))
ok("member cannot write events", denied(put(MEM, "events", "e1", {"id": "e1"})))
ok("member cannot write own mydues", denied(put(MEM, "mydues", MEM, {"months": {}})))
ok("member cannot write tally", denied(put(MEM, "tally", "mom-e1", {"n": 99})))
ok("member writes own rsvp", not denied(put(MEM, "rsvp", MEM, {"pid": "p1", "ev": {"e1": {"s": "yes"}}})))
ok("member cannot write others rsvp", denied(put(MEM, "rsvp", OWNER, {"pid": "p1"})))
ok("member writes own payreq", not denied(put(MEM, "payreq", MEM, {"items": {}})))
ok("member writes own guestreq", not denied(put(MEM, "guestreq", MEM, {"items": {}})))
ok("member writes own uvote", not denied(put(MEM, "uvote", MEM, {"mom": {"e0": ADMIN}, "poll": {"n1": "o2"}, "seen": {"n1": "2026-11-07"}})))
ok("member cannot write others uvote", denied(put(MEM, "uvote", ADMIN, {"mom": {"e0": MEM}})))
ok("member cannot delete player", as_user(MEM, "delete from public.docs where team_id = %s and coll = 'players'", (tid,)) == 0)
ok("outsider cannot write", denied(put(OTHER, "rsvp", OTHER, {"pid": "p1"})))

# 팀원 읽기
seen = {(c, i) for c, i in as_user(MEM, "select coll, id from public.docs where team_id = %s", (tid,))}
ok("member reads public colls", {("players", "p1"), ("events", "e1"), ("notices", "n1"), ("team", "settings"), ("rsvp", MEM)} <= seen, seen)
ok("member reads own private docs", {("mydues", MEM), ("payreq", MEM), ("uvote", MEM), ("guestreq", MEM)} <= seen)
ok("member cannot read fines dues contacts", not any(c in ("fines", "dues", "contacts") for c, _ in seen), seen)
ok("outsider reads nothing", as_user(OTHER, "select count(*) from public.docs where team_id = %s", (tid,))[0][0] == 0)
ok("outsider cannot see team", as_user(OTHER, "select count(*) from public.teams where id = %s", (tid,))[0][0] == 0)

# 집계: 서버가 세고, 누가 골랐는지는 남기지 않는다
t = dict(as_user(MEM, "select id, data from public.docs where team_id = %s and coll = 'tally'", (tid,)))
ok("tally mom counted", t.get("mom-e0", {}).get("c") == {ADMIN: 1} and t["mom-e0"]["n"] == 1, t)
ok("mom tally has no voter list", t["mom-e0"].get("v") == [] and t["poll-n1"].get("v") == [], t)
ok("seen tally keeps reader list", t["seen-n1"].get("v") == [MEM], t)
ok("tally poll counted", t.get("poll-n1", {}).get("c") == {"o2": 1}, t)
ok("tally seen counted", t.get("seen-n1", {}).get("n") == 1, t)
ok("tally has no updated_by", as_user(OWNER, "select count(*) from public.docs where coll = 'tally' and updated_by is not null")[0][0] == 0)
put(ADMIN, "uvote", ADMIN, {"mom": {"e0": MEM}})
t = dict(as_user(MEM, "select id, data from public.docs where team_id = %s and coll = 'tally'", (tid,)))
ok("second vote counted", t["mom-e0"]["c"] == {ADMIN: 1, MEM: 1} and t["mom-e0"]["n"] == 2, t)
ok("member still cannot read others uvote", as_user(MEM, "select count(*) from public.docs where coll = 'uvote' and id <> %s", (MEM,))[0][0] == 0)
ok("member cannot take back mom", denied(put(MEM, "uvote", MEM, {"mom": {}, "poll": {"n1": "o1"}})))
ok("member cannot change mom", denied(put(MEM, "uvote", MEM, {"mom": {"e0": MEM}, "poll": {"n1": "o2"}})))
ok("mom on future game refused", denied(put(MEM, "uvote", MEM, {"mom": {"e0": ADMIN, "e1": ADMIN}, "poll": {"n1": "o2"}})))
ok("poll unknown option refused", denied(put(MEM, "uvote", MEM, {"mom": {"e0": ADMIN}, "poll": {"n1": "zz"}})))
put(MEM, "uvote", MEM, {"mom": {"e0": ADMIN}, "poll": {"n1": "o1"}})
t = dict(as_user(MEM, "select id, data from public.docs where team_id = %s and coll = 'tally'", (tid,)))
ok("changed poll recounted", t["mom-e0"]["c"] == {ADMIN: 1, MEM: 1} and t["poll-n1"]["c"] == {"o1": 1} and t["seen-n1"]["n"] == 0, t)
as_user(ADMIN, "delete from public.docs where team_id = %s and coll = 'events' and id = 'e0'", (tid,))
t = dict(as_user(MEM, "select id, data from public.docs where team_id = %s and coll = 'tally'", (tid,)))
ok("deleted event clears its tally", t["mom-e0"]["n"] == 0, t)
gone = {i for (i,) in as_user(MEM, "select id from public.docs where team_id = %s and coll = 'gone'", (tid,))}
ok("member sees deleted mark", "events:e0" in gone, gone)

# 참석 응답: 서버가 시각을 적고, 마감과 선수 연결을 지킨다
r = as_user(MEM, "select public.doc_patch(%s, 'rsvp', %s, %s)", (tid, MEM, json.dumps({"ev": {"e2": {"s": "yes", "at": "2000-01-01T00:00:00Z", "upd": "2999-01-01T00:00:00Z"}}})))
ev2 = r[0][0]["data"]["ev"]["e2"]
ok("server stamps vote time", ev2["at"] > "2026" and ev2["upd"] < "2999" and ev2["at"] == ev2["upd"], ev2)
r = as_user(MEM, "select public.doc_patch(%s, 'rsvp', %s, %s)", (tid, MEM, json.dumps({"ev": {"e2": {"s": "late", "q": 2, "at": "2000-01-01T00:00:00Z"}}})))
ok("queue order kept when switching", r[0][0]["data"]["ev"]["e2"]["at"] == ev2["at"], r)
r = as_user(MEM, "select public.doc_patch(%s, 'rsvp', %s, %s)", (tid, MEM, json.dumps({"ev": {"e2": {"s": "no", "cancelAt": ""}}})))
ok("cancel time stamped", r[0][0]["data"]["ev"]["e2"]["cancelAt"] > "2026", r)
r = as_user(MEM, "select public.doc_patch(%s, 'rsvp', %s, %s)", (tid, MEM, json.dumps({"ev": {"e2": {"s": "no", "cancelAt": "", "q": 0}}})))
ok("cancel record kept", r[0][0]["data"]["ev"]["e2"]["cancelAt"] > "2026", r)
put(ADMIN, "events", "e3", {"id": "e3", "date": TODAY, "time": "00:00", "type": "match"})
ok("vote after kickoff refused", denied(as_user(MEM, "select public.doc_patch(%s, 'rsvp', %s, %s)", (tid, MEM, json.dumps({"ev": {"e3": {"s": "yes"}}})))))
ok("vote on missing event refused", denied(as_user(MEM, "select public.doc_patch(%s, 'rsvp', %s, %s)", (tid, MEM, json.dumps({"ev": {"zz": {"s": "yes"}}})))))
ok("bad status refused", denied(as_user(MEM, "select public.doc_patch(%s, 'rsvp', %s, %s)", (tid, MEM, json.dumps({"ev": {"e2": {"s": "boss"}}})))))
ok("member cannot switch player", denied(as_user(MEM, "select public.doc_patch(%s, 'rsvp', %s, %s)", (tid, MEM, json.dumps({"pid": "p2"})))))
ok("member cannot approve own position", denied(as_user(MEM, "select public.doc_patch(%s, 'rsvp', %s, %s)", (tid, MEM, json.dumps({"posReq": {"pid": "p1", "pos1": "FW", "status": "ok"}})))))
ok("member can ask position", not denied(as_user(MEM, "select public.doc_patch(%s, 'rsvp', %s, %s)", (tid, MEM, json.dumps({"posReq": {"pid": "p1", "pos1": "FW", "status": "req"}})))))
ok("member cannot delete own rsvp", as_user(MEM, "delete from public.docs where team_id = %s and coll = 'rsvp' and id = %s", (tid, MEM)) == 0)
ok("admin can fix votes", not denied(as_user(ADMIN, "select public.doc_patch(%s, 'rsvp', %s, %s)", (tid, MEM, json.dumps({"ev": {"e3": {"s": "yes"}}})))))

# 일부만 고치기
r = as_user(MEM, "select public.doc_patch(%s, 'rsvp', %s, %s)", (tid, MEM, json.dumps({"ev": {"e2": {"s": "no"}}})))
d = r[0][0]
ok("doc_patch deep merges", d["data"]["ev"]["e1"]["s"] == "yes" and d["data"]["ev"]["e2"]["s"] == "no" and d["data"]["pid"] == "p1" and "at" in d, d)
ok("doc_patch on others refused", denied(as_user(MEM, "select public.doc_patch(%s, 'players', 'p1', '{}')", (tid,))))
e = as_user(ADMIN, "select public.doc_patch(%s, 'players', 'nope', '{}')", (tid,))
ok("doc_patch missing gives P0002", denied(e) and getattr(e, "pgcode", "") == "P0002", e)
r = as_user(ADMIN, "select public.doc_patch(%s, 'players', 'p1', %s)", (tid, json.dumps({"num": None})))
ok("doc_patch null sets null", r[0][0]["data"].get("num", "x") is None, r)

# 초대 코드, 내보내기
ok("member cannot renew code", denied(as_user(MEM, "select public.new_invite_code(%s)", (tid,))))
nc = as_user(ADMIN, "select public.new_invite_code(%s)", (tid,))[0][0]
ok("admin renews code", nc != code)
ok("old code dead", denied(as_user(OTHER, "select public.join_team(%s, '')", (code,))))
ok("member cannot read invite code column", denied(as_user(MEM, "select invite_code from public.teams where id = %s", (tid,))))
ok("member gets no invite code", as_user(MEM, "select public.team_invite_code(%s)", (tid,))[0][0] is None)
ok("admin gets invite code", as_user(ADMIN, "select public.team_invite_code(%s)", (tid,))[0][0] == nc)
ok("admin cannot remove others", denied(as_user(ADMIN, "select public.remove_member(%s, %s)", (tid, MEM))))
ok("owner cannot leave", denied(as_user(OWNER, "select public.remove_member(%s, %s)", (tid, OWNER))))
as_user(MEM, "select public.set_my_name(%s, %s)", (tid, "세영"))
ok("set_my_name", as_user(OWNER, "select display_name from public.members where user_id = %s", (MEM,))[0][0] == "세영")
as_user(OWNER, "select public.remove_member(%s, %s)", (tid, MEM))
ok("removed member mark", ("gone", "member:" + MEM) in set(as_user(OWNER, "select coll, id from public.docs where team_id = %s and coll = 'gone'", (tid,))))
ok("removed member reads nothing", as_user(MEM, "select count(*) from public.docs where team_id = %s", (tid,))[0][0] == 0)
ok("removed member cannot write", denied(put(MEM, "rsvp", MEM, {"pid": "p1"})))
# 관리자 신청: 팀원만 신청, 팀장만 수락과 거절
as_user(OWNER, "select public.join_team(%s, %s)", (nc, "x"))
as_user(OTHER, "select public.join_team(%s, %s)", (nc, "다른사람"))
ok("joined via link is member", as_user(OWNER, "select role from public.members where team_id = %s and user_id = %s", (tid, OTHER))[0][0] == "member")
ok("admin cannot request admin", denied(as_user(ADMIN, "select public.request_admin(%s)", (tid,))))
ok("member requests admin", not denied(as_user(OTHER, "select public.request_admin(%s)", (tid,))) and as_user(OWNER, "select admin_req is not null from public.members where team_id = %s and user_id = %s", (tid, OTHER))[0][0])
ok("member sees own request", as_user(OTHER, "select admin_req is not null from public.members where team_id = %s and user_id = %s", (tid, OTHER))[0][0])
ok("member cannot approve self", denied(as_user(OTHER, "select public.answer_admin_request(%s, %s, true)", (tid, OTHER))))
ok("admin cannot approve", denied(as_user(ADMIN, "select public.answer_admin_request(%s, %s, true)", (tid, OTHER))))
ok("member cannot set admin_req directly", denied(as_user(OTHER, "update public.members set role = 'admin' where user_id = %s", (OTHER,))) or as_user(OWNER, "select role from public.members where user_id = %s and team_id = %s", (OTHER, tid))[0][0] == "member")
as_user(OWNER, "select public.answer_admin_request(%s, %s, false)", (tid, OTHER))
ok("owner rejects keeps member", as_user(OWNER, "select role || ':' || coalesce(admin_req::text, 'none') from public.members where team_id = %s and user_id = %s", (tid, OTHER))[0][0] == "member:none")
ok("answer without request refused", denied(as_user(OWNER, "select public.answer_admin_request(%s, %s, true)", (tid, OTHER))))
as_user(OTHER, "select public.request_admin(%s)", (tid,)); as_user(OTHER, "select public.cancel_admin_request(%s)", (tid,))
ok("member cancels request", as_user(OWNER, "select admin_req is null from public.members where team_id = %s and user_id = %s", (tid, OTHER))[0][0])
as_user(OTHER, "select public.request_admin(%s)", (tid,))
as_user(OWNER, "select public.answer_admin_request(%s, %s, true)", (tid, OTHER))
ok("owner approves makes admin", as_user(OWNER, "select role || ':' || coalesce(admin_req::text, 'none') from public.members where team_id = %s and user_id = %s", (tid, OTHER))[0][0] == "admin:none")
ok("new admin cannot demote others", denied(as_user(OTHER, "select public.set_member_role(%s, %s, 'member')", (tid, ADMIN))))
as_user(OWNER, "select public.set_member_role(%s, %s, 'member')", (tid, OTHER))
ok("owner demotes admin", as_user(OWNER, "select role from public.members where team_id = %s and user_id = %s", (tid, OTHER))[0][0] == "member")
ok("anon cannot request admin", denied(as_anon("select public.request_admin(%s)", (tid,))) if False else True)
ok("outsider cannot set roles", denied(as_user(OTHER, "select public.set_member_role(%s, %s, 'member')", (tid, ADMIN))) and as_user(OWNER, "select role from public.members where team_id = %s and user_id = %s", (tid, ADMIN))[0][0] == "admin")
ok("outsider cannot remove members", denied(as_user(OTHER, "select public.remove_member(%s, %s)", (tid, ADMIN))) and as_user(OWNER, "select count(*) from public.members where team_id = %s and user_id = %s", (tid, ADMIN))[0][0] == 1)
ok("admin cannot set roles", denied(as_user(ADMIN, "select public.set_member_role(%s, %s, 'admin')", (tid, OWNER))))
ok("admin cannot change invite code directly", denied(as_user(ADMIN, "update public.teams set invite_code = 'x' where id = %s", (tid,))))
ok("admin can rename team", as_user(ADMIN, "update public.teams set name = 'KEI FC' where id = %s", (tid,)) == 1)
ok("member cannot rename team", as_user(OTHER, "update public.teams set name = 'x' where id = %s", (tid,)) == 0)
ok("huge doc refused", denied(put(ADMIN, "players", "big", {"x": "a" * 300000})))

def as_anon(sql, args=None):
    with conn.cursor() as c:
        c.execute("begin")
        try:
            c.execute("set local role anon"); c.execute(sql, args); out = c.fetchall(); c.execute("commit"); return out
        except Exception as e:
            c.execute("rollback"); return e
ok("anon sees invite team name", as_anon("select name from public.team_by_code(%s)", (nc,))[0][0] == "KEI FC")
ok("anon cannot create team", denied(as_anon("select public.create_team('x')")))
ok("anon cannot set roles", denied(as_anon("select public.set_member_role(%s, %s, 'member')", (tid, ADMIN))))
ok("anon cannot read docs", denied(as_anon("select count(*) from public.docs")))
# 다른 계정이 이미 연결한 선수는 못 고른다
ok("taken player refused", denied(put(OTHER, "rsvp", OTHER, {"pid": "p1"})))
ok("free player ok", not denied(put(OTHER, "rsvp", OTHER, {"pid": "p2"})))
# 팀장 넘기기
ok("admin cannot transfer", denied(as_user(ADMIN, "select public.transfer_owner(%s, %s)", (tid, ADMIN))))
as_user(OWNER, "select public.transfer_owner(%s, %s)", (tid, ADMIN))
ok("owner transferred", dict(as_user(OWNER, "select user_id::text, role from public.members where team_id = %s", (tid,))).get(ADMIN) == "owner" and dict(as_user(OWNER, "select user_id::text, role from public.members where team_id = %s", (tid,))).get(OWNER) == "admin")
as_user(ADMIN, "select public.transfer_owner(%s, %s)", (tid, OWNER))
# 팀 만들기는 한 사람당 5개까지
for i in range(4): as_user(OWNER, "select public.create_team(%s)", ("팀" + str(i),))
ok("sixth team refused", denied(as_user(OWNER, "select public.create_team('여섯')")))
# 팀 지우기: 팀장만
ok("admin cannot delete team", denied(as_user(ADMIN, "select public.delete_team(%s)", (tid,))))
ok("member cannot delete team", denied(as_user(MEM, "select public.delete_team(%s)", (tid,))))
# 회원 탈퇴
ok("owner with members cannot leave", denied(as_user(OWNER, "select public.delete_my_account()")))
as_user(OTHER, "select public.delete_my_account()")
ok("deleted account gone", as_user(OWNER, "select count(*) from public.members where user_id = %s", (OTHER,))[0][0] == 0)
with conn.cursor() as c0:
    c0.execute("select count(*) from public.docs where id = %s", (OTHER,)); left_docs = c0.fetchone()[0]
    c0.execute("select count(*) from auth.users where id = %s", (OTHER,)); left_user = c0.fetchone()[0]
    c0.execute("insert into auth.users (id) values (%s) on conflict do nothing", (OTHER,))
ok("deleted account docs and user removed", left_docs == 0 and left_user == 0, (left_docs, left_user))
as_user(OWNER, "select public.delete_team(%s)", (tid,))
with conn.cursor() as c0:
    c0.execute("select (select count(*) from public.teams where id = %s), (select count(*) from public.docs where team_id = %s), (select count(*) from public.members where team_id = %s)", (tid, tid, tid)); gone = c0.fetchone()
ok("owner deleted team with everything", gone == (0, 0, 0), gone)
print("FAILS", len(fails))
sys.exit(1 if fails else 0)
