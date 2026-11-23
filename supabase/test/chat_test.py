"""대화(chat) 서버 규칙 시험: 로컬 Postgres + Supabase 흉내(stubs.sql) 위에서.
Usage: python3 chat_test.py "host=/var/tmp/pgt port=5499 user=postgres dbname=t3"
"""
import sys, json, time, psycopg2

DSN = sys.argv[1]
OWNER, ADMIN, MEM, OTHER = ("00000000-0000-0000-0000-00000000000" + c for c in "abcd")
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
            c.execute("select set_config('request.jwt.claim.sub', %s, true)", (uid,))
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

su("truncate public.teams cascade"); su("delete from public.push_outbox"); su("delete from public.push_subs")
su("update public.maint set state = 'off', start_at = null, end_at = null where id = 1")
tid = as_user(OWNER, "select public.create_team('대화 시험 FC')")[0][0]
code = as_user(OWNER, "select public.team_invite_code(%s)", (tid,))[0][0]
# 가입 승인제: 신청하고 Admin이 받는다
for uid, nm in ((MEM, "이세영"), (ADMIN, "김성우")):
    rj = as_user(uid, "select public.request_join(%s, %s, %s, %s)", (code, nm, "", ""))
    aj = as_user(OWNER, "select public.answer_join(%s, %s, true)", (tid, uid))
    if denied(rj) or denied(aj): print("가입 실패", rj, aj)
as_user(OWNER, "select public.set_member_role(%s, %s, 'admin')", (tid, ADMIN))

def ev(id, data):
    return as_user(ADMIN, "insert into public.docs (team_id, coll, id, data) values (%s, 'events', %s, %s)", (tid, id, json.dumps(data)))
ev("e1", {"id": "e1", "date": "2099-11-29", "time": "08:00", "type": "scrim"})
ev("e0", {"id": "e0", "date": "2020-01-04", "time": "08:00", "type": "match"})
ev("e2", {"id": "e2", "date": "2099-12-06", "time": "08:00", "type": "match", "cancel": {"at": "2026-11-20T10:00:00Z", "why": "날씨"}})
su("insert into public.push_subs (endpoint, user_id, p256dh, auth) values ('https://push.example/a', %s, repeat('p', 40), repeat('a', 16)), ('https://push.example/o', %s, repeat('p', 40), repeat('a', 16)), ('https://push.example/m', %s, repeat('p', 40), repeat('a', 16))", (ADMIN, OWNER, MEM))

send = lambda uid, room, body: as_user(uid, "select public.chat_send(%s, %s, %s)", (tid, room, body))

r = send(MEM, "e1", "안녕하세요, 토요일에 봬요")
ok("팀원이 열린 방에 글 보냄", not denied(r), r)
m1 = r[0][0]["id"] if not denied(r) else None
ok("보낸 사람 이름은 팀 이름표에서", not denied(r) and r[0][0]["name"] == "이세영", r)
ok("이름을 꾸며 보낼 수 없음 (함수에 이름 칸 없음)", denied(as_user(MEM, "select public.chat_send(%s, %s, %s, %s)", (tid, "e1", "x", "운영진"))))
ok("팀 밖 사람은 못 보냄", err(send(OTHER, "e1", "몰래"), "not_member"))
ok("팀 밖 사람은 못 읽음", as_user(OTHER, "select count(*) from public.chat")[0][0] == 0)
ok("로그인 안 한 사람은 못 읽음", denied(as_user(None, "select count(*) from public.chat")) or as_user(None, "select count(*) from public.chat")[0][0] == 0)
ok("팀원은 자기 팀 글을 읽음", as_user(MEM, "select count(*) from public.chat where team_id = %s", (tid,))[0][0] == 1)
ok("끝난 일정 방은 못 씀", err(send(MEM, "e0", "늦은 글"), "room_closed"))
ok("취소된 일정 방은 못 씀", err(send(MEM, "e2", "취소 방"), "room_closed"))
ok("없는 방은 못 씀", err(send(MEM, "nope", "x"), "no_room"))
ok("방 이름 형식이 틀리면 막음", err(send(MEM, "a b'; drop", "x"), "no_room"))
ok("빈 글은 막음", err(send(MEM, "e1", "   "), "bad_body"))
ok("1000자 넘는 글은 막음", err(send(MEM, "e1", "가" * 1001), "bad_body"))
ok("표에 직접 쓰기 막음", denied(as_user(MEM, "insert into public.chat (team_id, room, user_id, name, body) values (%s, 'e1', %s, '운영진', '가짜')", (tid, MEM))))
ok("표 직접 고치기 막음", denied(as_user(MEM, "update public.chat set body = '바꿈' where id = %s", (m1,))) or as_user(MEM, "update public.chat set body = '바꿈' where id = %s", (m1,)) == 0)
ok("표 직접 지우기 막음", denied(as_user(MEM, "delete from public.chat where id = %s", (m1,))) or as_user(MEM, "delete from public.chat where id = %s", (m1,)) == 0)
ok("내부 함수는 직접 못 부름", denied(as_user(MEM, "select public.chat_mask('x')")) and denied(as_user(MEM, "select public.chat_room_open(%s, 'e1')", (tid,))))

# 욕설 가리기와 운영진 알림
r = send(MEM, "e1", "아 ㅅㅂ 늦었다, 다시 발로 차요")
ok("욕설만 *** 로 가림", not denied(r) and r[0][0]["body"] == "아 *** 늦었다, 다시 발로 차요" and r[0][0]["masked"] == 1, r)
stored = su("select body from public.chat where id = %s", (r[0][0]["id"],))[0][0]
ok("서버에도 가린 글만 남음 (원문 없음)", stored == "아 *** 늦었다, 다시 발로 차요", stored)
to = sorted(x[0] for x in su("select user_id::text from public.push_outbox where kind = 'chat_curse'"))
ok("운영진(Admin, 운영진)에게만 경고 알림", to == sorted([OWNER, ADMIN]), to)
r = send(ADMIN, "e1", "시발점에서 모여요")
ok("멀쩡한 말(시발점)은 안 가림", not denied(r) and r[0][0]["masked"] == 0, r)

# 가리기
ok("남의 글은 팀원이 못 가림", err(as_user(MEM, "select public.chat_hide(%s)", (r[0][0]["id"],)), "not_allowed"))
ok("팀 밖 사람은 못 가림", denied(as_user(OTHER, "select public.chat_hide(%s)", (m1,))))
ok("내 글은 내가 가림", as_user(MEM, "select public.chat_hide(%s)", (m1,)) == [("self",)])
row = as_user(ADMIN, "select hidden, body from public.chat where id = %s", (m1,))
ok("가린 글은 내용이 지워짐", row == [("self", "")], row)
m3 = send(MEM, "e1", "운영진이 가릴 글")[0][0]["id"]
ok("운영진은 팀원 글을 가림", as_user(ADMIN, "select public.chat_hide(%s)", (m3,)) == [("admin",)])
ok("이미 가린 글은 그대로", as_user(MEM, "select public.chat_hide(%s)", (m3,)) == [("admin",)])

# 끝난 방은 가리기도 막음 (읽기만)
su("insert into public.chat (team_id, room, user_id, name, body) values (%s, 'e0', %s, '이세영', '예전 글')", (tid, MEM))
old = su("select id from public.chat where room = 'e0'")[0][0]
ok("끝난 방 글은 가릴 수 없음", err(as_user(MEM, "select public.chat_hide(%s)", (old,)), "room_closed"))

# 도배 막기 (10초에 5개)
su("delete from public.chat where user_id = %s", (ADMIN,))
res = [send(ADMIN, "e1", "도배 %d" % i) for i in range(6)]
ok("10초에 5개까지는 됨", all(not denied(x) for x in res[:5]), res[:5])
ok("6번째는 막음", err(res[5], "too_fast"), res[5])

# 점검 중에는 쓰기 막음
su("select public.maint_begin(5, 0)")
time.sleep(1.2)
ok("점검 중에는 보낼 수 없음", denied(send(MEM, "e1", "점검 중")))
ok("점검 중에는 가릴 수 없음", denied(as_user(ADMIN, "select public.chat_hide(%s)", (r[0][0]["id"],))))
su("select public.maint_end()")
ok("점검이 끝나면 다시 보냄", not denied(send(MEM, "e1", "점검 끝")))

# 팀에서 나가면 못 읽음
as_user(OWNER, "select public.remove_member(%s, %s)", (tid, MEM))
ok("내보낸 사람은 못 읽음", as_user(MEM, "select count(*) from public.chat")[0][0] == 0)
ok("내보낸 사람은 못 보냄", err(send(MEM, "e1", "나간 뒤"), "not_member"))

print("\n실패", len(fails), "개" if fails else "개, 모두 통과")
sys.exit(1 if fails else 0)
