"""다른 팀과(매칭, 용병 구인, 용병 구직, 용병 평가) 서버 규칙 시험: 로컬 Postgres + Supabase 흉내(stubs.sql) 위에서.
Usage: python3 xteam_test.py "host=/var/tmp/pgt port=5499 user=postgres dbname=t3"
A팀: a(Admin), b(운영진), c(팀원).  B팀: d(Admin).  e: 아무 팀에도 없는 사람
"""
import sys, json, datetime, psycopg2
DSN = sys.argv[1]
A_, B_, C_, D_, E_ = ("00000000-0000-0000-0000-00000000000" + c for c in "abcde")
conn = psycopg2.connect(DSN); conn.autocommit = True
fails = []
def ok(name, cond, extra=""):
    print(("ok:   " if cond else "FAIL: ") + name, "" if cond else extra)
    if not cond: fails.append(name)
def as_user(uid, sql, args=None):
    with conn.cursor() as c:
        c.execute("begin")
        try:
            c.execute("set local role " + ("authenticated" if uid else "anon"))
            c.execute("select set_config('request.jwt.claim.sub', %s, true), set_config('request.jwt.claims', %s, true)", (uid or "", json.dumps({"sub": uid, "role": "authenticated"} if uid else {})))
            c.execute(sql, args)
            out = c.fetchall() if c.description else c.rowcount
            c.execute("commit"); return out
        except Exception as e:
            c.execute("rollback"); return e
def su(sql, args=None):
    with conn.cursor() as c:
        c.execute(sql, args); return c.fetchall() if c.description else c.rowcount
denied = lambda r: isinstance(r, Exception)
err = lambda r, w: isinstance(r, Exception) and w in str(r)
one = lambda r: r[0][0] if not denied(r) else r

KST = datetime.timezone(datetime.timedelta(hours=9))
today = datetime.datetime.now(KST).date()
d = lambda n: (today + datetime.timedelta(days=n)).isoformat()

su("insert into auth.users (id) values (%s) on conflict do nothing", (E_,))
su("delete from public.teams where name in ('A팀', 'B팀')")
su("update public.maint set state = 'off', start_at = null, end_at = null where id = 1")
ta = one(as_user(A_, "select public.create_team('A팀')")); tb = one(as_user(D_, "select public.create_team('B팀')"))
code = one(as_user(A_, "select public.team_invite_code(%s)", (ta,)))
for u, nm in ((B_, "김성우"), (C_, "이세영")):
    as_user(u, "select public.request_join(%s, %s, '', '')", (code, nm)); as_user(A_, "select public.answer_join(%s, %s, true)", (ta, u))
as_user(A_, "select public.set_member_role(%s, %s, 'admin')", (ta, B_))
def put(uid, t, coll, id, data):
    return as_user(uid, "insert into public.docs (team_id, coll, id, data) values (%s, %s, %s, %s) on conflict (team_id, coll, id) do update set data = excluded.data", (t, coll, id, json.dumps(data)))
put(A_, ta, "team", "settings", {"sport": "soccer", "level": 3, "area": "고양", "uniformColor": "남색", "bank": {"account": "1002-비밀"}})
put(D_, tb, "team", "settings", {"sport": "soccer", "level": 4, "area": "마포"})
put(A_, ta, "events", "e1", {"date": d(5), "time": "08:00", "type": "match", "place": "고양 보조구장", "cap": 14, "memo": "비밀 메모"})
put(A_, ta, "events", "e2", {"date": d(6), "time": "08:00", "type": "scrim", "place": "고양", "cap": 4})
put(A_, ta, "events", "e3", {"date": d(5), "time": "10:00", "type": "training", "place": "고양"})
put(D_, tb, "events", "f1", {"date": d(5), "time": "07:00", "type": "match", "place": "상암 보조구장", "cap": 14})
put(D_, tb, "events", "f0", {"date": d(-3), "time": "07:00", "type": "match", "place": "상암"})
put(C_, ta, "rsvp", C_, {"profile": {"name": "이세영", "pos1": "CM", "pos2": "CDM"}, "ev": {"e1": {"s": "yes"}, "e2": {"s": "yes"}}})
put(D_, tb, "rsvp", D_, {"profile": {"name": "박건우", "pos1": "CB", "pos2": "CDM"}})

# 아무나 못 봄
ok("로그인 안 하면 목록 못 봄", denied(as_user(None, "select public.x_list('match')")))
ok("팀 없는 사람은 목록 못 봄", err(as_user(E_, "select public.x_list('match')"), "not_member"))
ok("표 직접 읽기 막음", denied(as_user(C_, "select * from public.xposts")) and denied(as_user(C_, "select * from public.xapps")) and denied(as_user(C_, "select * from public.xrates")))
ok("표 직접 쓰기 막음", denied(as_user(A_, "insert into public.xposts (kind, team_id, event_id) values ('match', %s, 'e1')", (ta,))))
ok("도우미 함수는 못 부름", denied(as_user(A_, "select public.x_as(%s)", (D_,))) and denied(as_user(A_, "select public.x_card(%s)", (tb,))) and denied(as_user(A_, "select public.x_rating(%s)", (D_,))))

# 매칭 글
ok("팀원은 매칭 글 못 올림", err(as_user(C_, "select public.x_post_match(%s, 'e1', 'yes', '', '')", (ta,)), "not_admin"))
ok("다른 팀 일정으로는 못 올림", err(as_user(A_, "select public.x_post_match(%s, 'f1', 'yes', '', '')", (tb,)), "not_admin"))
ok("내전에는 매칭 글 못 올림", err(as_user(A_, "select public.x_post_match(%s, 'e2', 'yes', '', '')", (ta,)), "not_open_match"))
ok("지난 경기에는 못 올림", err(as_user(D_, "select public.x_post_match(%s, 'f0', 'yes', '', '')", (tb,)), "event_closed"))
pm = one(as_user(D_, "select public.x_post_match(%s, 'f1', 'yes', '빨강', '편하게 와요')", (tb,)))
ok("B팀 Admin이 매칭 글 올림", not denied(pm), pm)
lst = one(as_user(C_, "select public.x_list('match')"))
item = next((x for x in lst if x["id"] == str(pm)), None) if not denied(lst) else None
ok("다른 팀 팀원도 매칭 글을 봄", item is not None, lst)
txt = json.dumps(lst, ensure_ascii=False)
ok("공개 정보만 (팀 이름, 실력, 지역)", item and item["team"]["name"] == "B팀" and item["team"]["level"] == 4 and item["team"]["area"] == "마포")
ok("비밀은 안 보임 (계좌, 메모, 이름)", "1002" not in txt and "비밀" not in txt and "박건우" not in txt)
ok("내 팀 글이 아님 표시", item and item["mine"] is False)

# 매칭 신청
ok("팀원은 매칭 신청 못 함", err(as_user(C_, "select public.x_apply_match(%s, %s, 'e1', '')", (pm, ta)), "not_admin"))
ok("다른 날 일정으로는 신청 못 함", err(as_user(A_, "select public.x_apply_match(%s, %s, 'e2', '')", (pm, ta)), "not_open_match") or err(as_user(A_, "select public.x_apply_match(%s, %s, 'e2', '')", (pm, ta)), "other_day"))
ok("자기 팀 글에는 신청 못 함", err(as_user(D_, "select public.x_apply_match(%s, %s, 'f1', '')", (pm, tb)), "own_post"))
am = one(as_user(B_, "select public.x_apply_match(%s, %s, 'e1', '잘 부탁해요')", (pm, ta)))
ok("A팀 운영진이 같은 날 경기로 매칭 신청", not denied(am), am)
ok("같은 글에 두 번 신청 못 함", denied(as_user(A_, "select public.x_apply_match(%s, %s, 'e1', '')", (pm, ta))))
inbox = one(as_user(D_, "select public.x_inbox(%s)", (tb,)))
app = inbox[0]["apps"][0] if not denied(inbox) and inbox and inbox[0]["apps"] else {}
ok("B팀 받은 신청에 A팀 공개 정보와 참석 투표 수", app.get("team", {}).get("name") == "A팀" and app.get("mem") == 1, inbox)
ok("A팀 팀원은 B팀 받은 신청 못 봄", err(as_user(C_, "select public.x_inbox(%s)", (tb,)), "not_admin"))
ok("신청한 팀은 받기를 못 함", err(as_user(A_, "select public.x_answer(%s, true)", (am,)), "not_admin"))
r = one(as_user(D_, "select public.x_answer(%s, true)", (am,)))
ok("B팀 Admin이 매칭을 받음", r == "yes", r)
e_a = su("select data->>'opponent', data->'xmatch'->>'team', updated_by::text from public.docs where team_id=%s and coll='events' and id='e1'", (ta,))[0]
e_b = su("select data->>'opponent', data->'xmatch'->>'event' from public.docs where team_id=%s and coll='events' and id='f1'", (tb,))[0]
ok("A팀 일정에 상대 B팀 (신청한 운영진 이름으로 적힘)", e_a[0] == "B팀" and e_a[1] == str(tb) and e_a[2] == B_, e_a)
ok("B팀 일정에 상대 A팀", e_b == ("A팀", "e1"), e_b)
ok("매칭이 잡히면 글이 목록에서 빠짐", all(x["id"] != str(pm) for x in one(as_user(C_, "select public.x_list('match')"))))
ok("이름 빌리기는 끝나면 원래대로", one(as_user(D_, "select auth.uid()::text")) == D_)

# 용병 구인
ok("자리 이름이 틀리면 못 올림", err(as_user(A_, "select public.x_post_hire(%s, 'e2', %s, '')", (ta, json.dumps([["XX"]]))), "bad_slots"))
ok("빈 자리보다 많이 못 올림 (정원 4, 참석 1이면 3명까지)", err(as_user(A_, "select public.x_post_hire(%s, 'e2', %s, '')", (ta, json.dumps([["LB"], ["GK"], ["ST"], ["CB"]]))), "too_many"))
ph = one(as_user(A_, "select public.x_post_hire(%s, 'e2', %s, '내전이라 편하게')", (ta, json.dumps([["LB", "LW"], ["GK"]]))))
ok("A팀 Admin이 구인 글 올림 (LB/LW 한 명, GK 한 명)", not denied(ph), ph)
ok("우리 팀 사람은 우리 글에 용병 신청 못 함", err(as_user(C_, "select public.x_apply_hire(%s, 'GK', '')", (ph,)), "own_team"))
ok("팀 없는 사람은 용병 신청 못 함", err(as_user(E_, "select public.x_apply_hire(%s, 'GK', '')", (ph,)), "not_member"))
ok("글에 없는 자리는 못 고름", err(as_user(D_, "select public.x_apply_hire(%s, 'ST', '')", (ph,)), "bad_pos"))
ah = one(as_user(D_, "select public.x_apply_hire(%s, 'LB/LW', '왼쪽 다 돼요')", (ph,)))
ok("B팀 사람이 LB/LW 자리에 용병 신청", not denied(ah), ah)
ok("같은 글에 두 번 신청 못 함", denied(as_user(D_, "select public.x_apply_hire(%s, 'GK', '')", (ph,))))
my = one(as_user(D_, "select public.x_my()"))
ok("내 신청에 기다림으로 보임", not denied(my) and my["apps"][0]["status"] == "pending", my)
inbox = one(as_user(B_, "select public.x_inbox(%s)", (ta,)))
happ = next((a for p in inbox for a in p["apps"] if a["id"] == str(ah)), {}) if not denied(inbox) else {}
ok("받은 용병 신청에 이름, 소개, 자리, 별점", happ.get("name") == "박건우" and "B팀 팀원" in happ.get("sub", "") and happ.get("pos") == "LB/LW" and happ.get("rating", {}).get("n") == 0, happ)
r = one(as_user(B_, "select public.x_answer(%s, true)", (ah,)))
ok("운영진이 용병을 받음", r == "yes", r)
g = su("select v from public.docs, jsonb_each(data->'guests') x(k, v) where team_id=%s and coll='events' and id='e2'", (ta,))
ok("받은 용병이 일정 명단에 용병으로", len(g) == 1 and g[0][0]["name"] == "박건우" and g[0][0]["pos"] == "LB" and g[0][0]["ext"]["uid"] == D_, g)
ok("받은 사람은 취소 못 함 (기다림만)", err(as_user(D_, "select public.x_cancel(%s)", (ah,)), "not_pending"))
ok("A팀 다른 사람은 남의 신청을 취소 못 함", err(as_user(C_, "select public.x_cancel(%s)", (ah,)), "not_allowed"))

# 용병 평가
gk = "x" + str(ah).replace("-", "")
su("update public.docs set data = data || jsonb_build_object('date', %s, 'check', jsonb_build_object(%s, 'in')) where team_id=%s and coll='events' and id='e2'", (d(-1), gk, ta))
ok("팀원은 평가 못 함", err(as_user(C_, "select public.x_rate(%s, 'e2', %s, 5, '{}')", (ta, gk)), "not_admin"))
ok("별 6개는 막음", err(as_user(A_, "select public.x_rate(%s, 'e2', %s, 6, '{}')", (ta, gk)), "bad_stars"))
ok("이상한 이유는 막음", err(as_user(A_, "select public.x_rate(%s, 'e2', %s, 4, %s)", (ta, gk, ["hack"])), "bad_why"))
ok("우리 팀 사람(용병 아님)은 평가 못 함", err(as_user(A_, "select public.x_rate(%s, 'e2', %s, 4, '{}')", (ta, C_)), "not_ext"))
ok("운영진이 온 용병 평가", not denied(as_user(A_, "select public.x_rate(%s, 'e2', %s, 4, %s)", (ta, gk, ["ontime", "fit"]))))
ok("한 번 더 하면 고쳐짐 (한 경기 한 평가)", not denied(as_user(B_, "select public.x_rate(%s, 'e2', %s, 2, %s)", (ta, gk, ["late"]))) and su("select count(*), max(stars) from public.xrates where user_id=%s", (D_,))[0] == (1, 2))
rs = one(as_user(A_, "select public.x_rates_of(%s, 'e2')", (ta,)))
ok("경기의 용병과 우리 평가 보기", not denied(rs) and rs[0]["rate"]["stars"] == 2 and rs[0]["check"] == "in", rs)
su("update public.docs set data = data || jsonb_build_object('check', jsonb_build_object(%s, 'absent')) where team_id=%s and coll='events' and id='e2'", (gk, ta))
ok("안 온 용병은 평가 못 함", err(as_user(A_, "select public.x_rate(%s, 'e2', %s, 1, '{}')", (ta, gk)), "not_came"))
my = one(as_user(D_, "select public.x_my()"))
ok("내 별점: 평가 1번, 안 옴 1번", my["rating"]["n"] == 1 and my["rating"]["noshow"] == 1, my["rating"])
su("update public.docs set data = data || jsonb_build_object('date', %s) where team_id=%s and coll='events' and id='e2'", (d(-9), ta))
ok("7일 지나면 평가 못 함", err(as_user(A_, "select public.x_rate(%s, 'e2', %s, 3, '{}')", (ta, gk)), "too_late"))

# 점검 중
su("select public.maint_begin(5, 0)")
import time; time.sleep(1.2)
ok("점검 중에는 글을 못 올림", denied(as_user(A_, "select public.x_post_match(%s, 'e1', 'yes', '', '')", (ta,))))
su("select public.maint_end()")
print("\n실패", len(fails), "개" if fails else "개, 모두 통과")
sys.exit(1 if fails else 0)
