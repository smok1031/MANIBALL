"""대화 시안 7가지 서버 규칙 시험 (방이 사라지는 시각, 초대, 사진, 방마다 알림).
로컬 Postgres + Supabase 흉내(stubs.sql, storage_stub.sql) 위에서. 이 시험은 로컬 팀 자료를 지운다.
Usage: python3 chat7_test.py "host=/var/tmp/pgt port=5499 user=postgres dbname=t3"
"""
import sys, json, datetime, psycopg2

DSN = sys.argv[1]
OWNER, ADMIN, MEM, OTHER = ("00000000-0000-0000-0000-00000000000" + c for c in "abcd")
MEM2 = "00000000-0000-0000-0000-00000000000f"
conn = psycopg2.connect(DSN); conn.autocommit = True
fails = []

def ok(name, cond, extra=""):
    print(("ok:   " if cond else "FAIL: ") + name, "" if cond else extra)
    if not cond: fails.append(name)

def as_user(uid, sql, args=None):
    with conn.cursor() as c:
        c.execute("begin")
        try:
            c.execute("set local role authenticated")
            c.execute("select set_config('request.jwt.claim.sub', %s, true)", (uid or "",))
            c.execute(sql, args)
            out = c.fetchall() if c.description else c.rowcount
            c.execute("commit"); return out
        except Exception as e:
            c.execute("rollback"); return e

def su(sql, args=None):
    with conn.cursor() as c:
        c.execute(sql, args); return c.fetchall() if c.description else c.rowcount

denied = lambda r: isinstance(r, Exception)
err = lambda r, word: isinstance(r, Exception) and word in str(r)

su("insert into auth.users (id, email) values (%s, 'mem2@x.kr') on conflict do nothing", (MEM2,))
su("truncate public.teams cascade"); su("delete from public.join_requests"); su("delete from public.push_outbox"); su("delete from public.push_subs"); su("delete from storage.objects")
su("update public.maint set state = 'off', start_at = null, end_at = null where id = 1")
tid = as_user(OWNER, "select public.create_team('시안 시험 FC')")[0][0]
code = as_user(OWNER, "select public.team_invite_code(%s)", (tid,))[0][0]
for uid, nm in ((MEM, "이세영"), (ADMIN, "김성우"), (MEM2, "박지민")):
    as_user(uid, "select public.request_join(%s, %s, %s, %s)", (code, nm, "", ""))
    as_user(OWNER, "select public.answer_join(%s, %s, true)", (tid, uid))
as_user(OWNER, "select public.set_member_role(%s, %s, 'admin')", (tid, ADMIN))
for u in (ADMIN, OWNER, MEM, MEM2):
    su("insert into public.push_subs (endpoint, user_id, p256dh, auth) values (%s, %s, repeat('p', 40), repeat('a', 16))", ("https://push.example/" + u[-1], u))

KST = datetime.timezone(datetime.timedelta(hours=9))
now = datetime.datetime.now(KST)
def at(minutes):
    t = now + datetime.timedelta(minutes=minutes); return t.strftime("%Y-%m-%d"), t.strftime("%H:%M")
def ev(id, data):
    r = as_user(ADMIN, "insert into public.docs (team_id, coll, id, data) values (%s, 'events', %s, %s)", (tid, id, json.dumps({"id": id, **data})))
    if denied(r): print("일정 실패", id, r)
def vote(uid, eid, s, extra=None):
    cur = su("select data from public.docs where team_id = %s and coll = 'rsvp' and id = %s", (tid, uid))
    data = cur[0][0] if cur else {"ev": {}}
    data.setdefault("ev", {})[eid] = {"s": s, "at": now.isoformat(), **(extra or {})}
    return su("insert into public.docs (team_id, coll, id, data) values (%s, 'rsvp', %s, %s) on conflict (team_id, coll, id) do update set data = excluded.data", (tid, uid, json.dumps(data)))

# 1) 방이 사라지는 시각: 끝나고 2시간
d0, t0 = at(-150); _, e0 = at(-30)        # 2시간 반 전 시작, 30분 전 끝: 1시간 30분 남음
ev("live", {"date": d0, "time": t0, "end": e0, "type": "match", "voteClose": "manual"})
d1, t1 = at(-300); _, e1 = at(-150)       # 끝난 지 2시간 반: 사라짐
ev("gone", {"date": d1, "time": t1, "end": e1, "type": "match"})
d2, t2 = at(-170)                          # 끝나는 시각 없음: 시작 2시간 뒤가 끝, 그 2시간 뒤 사라짐 (70분 남음)
ev("noend", {"date": d2, "time": t2, "type": "scrim"})
def send(uid, room, body, ph=None):
    su("update public.chat set created_at = created_at - interval '6 seconds' where user_id = %s", (uid,))  # 도배 막기(5초에 5개)를 피해서
    return as_user(uid, "select public.chat_send(%s, %s, %s, %s)", (tid, room, body, ph))
ok("끝나고 2시간 안이면 쓸 수 있음", not denied(send(ADMIN, "live", "수고했어요")), send(ADMIN, "live", "x"))
ok("끝나고 2시간 지나면 닫힘", err(send(ADMIN, "gone", "늦은 글"), "room_closed"))
ok("끝나는 시각이 없으면 시작 2시간 뒤를 끝으로 봄", not denied(send(ADMIN, "noend", "내전 수고")))
g = su("select to_char(public.chat_gone_at(data) at time zone 'Asia/Seoul', 'HH24:MI') from public.docs where team_id = %s and id = 'live'", (tid,))[0][0]
ok("사라지는 시각 = 끝 + 2시간", g == (now + datetime.timedelta(minutes=90)).strftime("%H:%M"), g)
ev("night", {"date": "2099-01-01", "time": "23:00", "end": "01:00", "type": "match"})
g = su("select to_char(public.chat_gone_at(data) at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') from public.docs where team_id = %s and id = 'night'", (tid,))[0][0]
ok("자정을 넘겨 끝나면 다음 날로 셈", g == "2099-01-02 03:00", g)
ok("3개 인자로 부르던 옛 앱도 그대로 보냄", not denied(as_user(ADMIN, "select public.chat_send(%s, %s, %s)", (tid, "live", "옛 앱"))))

# 2) 초대
vote(MEM, "live", "no")
ok("불참한 팀원은 방에 못 씀", err(send(MEM, "live", "들어가도 돼요?"), "not_in_room"))
ok("팀원은 초대 못 함", err(as_user(MEM2, "select public.chat_invite(%s, %s, %s::uuid[])", (tid, "live", [MEM])), "admin_only"))
ok("닫힌 방에는 초대 못 함", err(as_user(ADMIN, "select public.chat_invite(%s, %s, %s::uuid[])", (tid, "gone", [MEM])), "room_closed"))
ok("전체 대화방에는 초대 없음", err(as_user(ADMIN, "select public.chat_invite(%s, %s, %s::uuid[])", (tid, "all", [MEM])), "no_room"))
r = as_user(ADMIN, "select public.chat_invite(%s, %s, %s::uuid[])", (tid, "live", [MEM, OWNER, OTHER, MEM]))
ok("운영진과 팀 밖 사람은 빼고, 같은 사람은 한 번만 초대", r == [(1,)], r)
ok("초대 줄이 남음 (누가 초대했는지)", su("select name, body from public.chat where kind = 'inv'") == [("이세영", "김성우")])
ok("초대받은 사람에게 알림", su("select count(*) from public.push_outbox where user_id = %s and body like '%%초대%%'", (MEM,))[0][0] == 1)
ok("초대받으면 방에 씀", not denied(send(MEM, "live", "초대해 줘서 고마워요")))
ok("투표는 그대로 불참", su("select data -> 'ev' -> 'live' ->> 's' from public.docs where team_id = %s and coll = 'rsvp' and id = %s", (tid, MEM))[0][0] == "no")
ok("이미 방에 있으면 다시 초대 안 함", as_user(ADMIN, "select public.chat_invite(%s, %s, %s::uuid[])", (tid, "live", [MEM])) == [(0,)])
vote(MEM2, "live", "yes")
vote(MEM2, "live", "no")
ok("정원 안 참석에서 불참: 나갔어요 줄", su("select count(*) from public.chat where user_id = %s and kind = 'left'", (MEM2,))[0][0] == 1)
as_user(ADMIN, "select public.chat_invite(%s, %s, %s::uuid[])", (tid, "live", [MEM2]))
vote(MEM2, "live", "yes")
ok("초대받은 채로 참석하면 들어왔어요 줄을 더 안 남김", su("select count(*) from public.chat where user_id = %s and kind = 'join'", (MEM2,))[0][0] == 0)
vote(MEM2, "live", "no")
ok("초대받은 사람도 불참하면 나감", err(send(MEM2, "live", "x"), "not_in_room"))
vote(MEM, "live", "late", {"q": 2})
vote(MEM, "live", "no")
ok("초대받은 사람이 늦참에서 불참으로 바꾸면 나감", err(send(MEM, "live", "x"), "not_in_room"))
ok("초대 줄은 직접 못 씀", denied(as_user(ADMIN, "insert into public.chat (team_id, room, user_id, name, kind) values (%s, 'live', %s, 'x', 'inv')", (tid, MEM))))

# 3) 사진
P = lambda uid, room, f="abcdefgh12.jpg": f"{tid}/{room}/{uid}/{f}"
put = lambda uid, name: as_user(uid, "insert into storage.objects (bucket_id, name) values ('mb-chat', %s)", (name,))
ok("방에 있는 사람은 사진을 올림", put(ADMIN, P(ADMIN, "live")) == 1)
ok("남의 자리에는 못 올림", denied(put(ADMIN, P(OWNER, "live"))))
ok("방에 없는 사람은 못 올림", denied(put(MEM, P(MEM, "live", "zzzzzzzz01.jpg"))))
ok("닫힌 방에는 못 올림", denied(put(ADMIN, P(ADMIN, "gone"))))
ok("이상한 이름은 못 올림", denied(put(ADMIN, f"{tid}/live/{ADMIN}/../x.jpg")) and denied(put(ADMIN, f"{tid}/live/{ADMIN}/a.exe")))
ok("팀 밖 사람은 못 올림", denied(put(OTHER, P(OTHER, "all", "qqqqqqqq01.jpg"))))
ok("보내기 전 사진은 올린 사람만 봄", as_user(OWNER, "select count(*) from storage.objects where name = %s", (P(ADMIN, "live"),))[0][0] == 0
   and as_user(ADMIN, "select count(*) from storage.objects where name = %s", (P(ADMIN, "live"),))[0][0] == 1)
ok("올리지 않은 사진은 못 붙임", err(send(ADMIN, "live", "", [P(ADMIN, "live", "nothere01.jpg")]), "bad_photos"))
ok("남이 올린 사진은 못 붙임", err(send(OWNER, "live", "", [P(ADMIN, "live")]), "bad_photos"))
r = send(ADMIN, "live", "", [P(ADMIN, "live")])
ok("사진만 보내도 됨 (글 없이)", not denied(r) and r[0][0]["photos"] == [P(ADMIN, "live")], r)
pid = r[0][0]["id"] if not denied(r) else 0
_r = send(ADMIN, "live", "", [P(ADMIN, "live")]); ok("같은 사진은 두 번 못 붙임", err(_r, "bad_photos"), _r)
_r = send(ADMIN, "live", "x", [P(ADMIN, "live", "p%07d.jpg" % i) for i in range(5)]); ok("다섯 장은 막음", err(_r, "bad_photos"), _r)
ok("빈 글과 빈 사진은 막음", err(send(ADMIN, "live", " ", []), "bad_body"))
ok("방 사람은 보낸 사진을 봄", as_user(OWNER, "select count(*) from storage.objects where name = %s", (P(ADMIN, "live"),))[0][0] == 1)
ok("팀 밖 사람은 사진을 못 봄", as_user(OTHER, "select count(*) from storage.objects where name = %s", (P(ADMIN, "live"),))[0][0] == 0)
ok("가리면 사진도 가림", as_user(ADMIN, "select public.chat_hide(%s)", (pid,)) == [("self",)] and su("select photos from public.chat where id = %s", (pid,))[0][0] is None)
ok("가린 사진은 아무도 못 봄", as_user(OWNER, "select count(*) from storage.objects where name = %s", (P(ADMIN, "live"),))[0][0] == 0)
ok("사진 파일은 지우지 않음", su("select count(*) from storage.objects where name = %s", (P(ADMIN, "live"),))[0][0] == 1)

# 4) 방마다 알림: 켜면 나를 부른 글만
su("delete from public.push_outbox")
vote(MEM2, "live", "yes")
send(ADMIN, "live", "다들 수고했어요")
ok("부르지 않은 글은 알림 없음 (운영진 글이어도)", su("select count(*) from public.push_outbox where kind = 'chat'")[0][0] == 0)
send(ADMIN, "live", "@박지민 사진 올려 주세요")
ok("나를 부른 글은 알림 (기본 켜짐)", su("select count(*) from public.push_outbox where kind = 'chat' and user_id = %s", (MEM2,))[0][0] == 1)
as_user(MEM2, "insert into public.docs (team_id, coll, id, data) values (%s, 'uvote', %s, %s) on conflict (team_id, coll, id) do update set data = excluded.data", (tid, MEM2, json.dumps({"ra": {"live": "off"}})))
su("delete from public.push_outbox")
send(ADMIN, "live", "@박지민 한 번 더")
ok("이 방 알림을 끄면 안 옴", su("select count(*) from public.push_outbox where kind = 'chat'")[0][0] == 0)
send(ADMIN, "all", "@박지민 전체 방")
ok("전체 대화방은 기본이 꺼짐", su("select count(*) from public.push_outbox where kind = 'chat'")[0][0] == 0)
as_user(MEM2, "update public.docs set data = data || %s where team_id = %s and coll = 'uvote' and id = %s", (json.dumps({"ra": {"live": "off", "all": "on"}}), tid, MEM2))
send(ADMIN, "all", "@박지민 전체 방 켬")
ok("전체 대화방을 켜면 부른 글이 옴", su("select count(*) from public.push_outbox where kind = 'chat' and user_id = %s", (MEM2,))[0][0] == 1)
as_user(MEM, "insert into public.docs (team_id, coll, id, data) values (%s, 'uvote', %s, %s) on conflict (team_id, coll, id) do update set data = excluded.data", (tid, MEM, json.dumps({"chat": "off"})))
su("delete from public.push_outbox")
send(ADMIN, "all", "@이세영 예전 설정")
ok("예전에 알림을 다 끈 사람은 그대로 꺼짐", su("select count(*) from public.push_outbox where kind = 'chat'")[0][0] == 0)
ok("내부 함수는 직접 못 부름", denied(as_user(MEM, "select public.chat_gone_at('{}'::jsonb)")) and denied(as_user(MEM, "select public.event_end('{}'::jsonb)")))

print("\n실패", len(fails), "개" if fails else "개, 모두 통과")
sys.exit(1 if fails else 0)
