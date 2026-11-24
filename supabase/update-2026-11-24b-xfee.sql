-- 2026-11-24 다른 팀과 2: 용병비, 먼저 입금, 용병 레벨, 용병이 팀 평가 (PC 시안 결정 기록 6, 8, 3~5)
-- 있던 표와 신청은 그대로 두고 칸만 더한다. 여러 번 실행해도 안전하다.
--   용병비: 구인 글마다 구장비 나눠 받기(split), 무료(free), 교통비 드리기(pay) 중 하나.
--     나눠 받기: 내전은 구장비 / 참여 인원, 매칭은 구장비 / 2 / 우리 참여 인원 (참여 인원 = 참석, 늦참 팀원 + 용병). 500원 단위로 내림.
--     신청을 받는 순간 금액이 정해지고, 3시간 안에(경기 전날 21시부터는 1시간 안에) 보내야 한다. 그 팀 운영진이 입금을 확인하면 참석 명단과 대화방에 들어간다.
--     구장 목록이 아직 없어서 구장비는 운영진이 직접 적고, 글에 '직접 적은 금액'이 붙는다.
--   용병 레벨: 용병 본인에게는 별점도 레벨도 안 보이고, 구인 팀 운영진만 레벨을 본다.
--   팀 평가: 현장 출석으로 온 것이 확인된 용병만, 경기 뒤 7일 안에 매너와 준비를 남긴다. 3명 이상 모여야 보인다. 누가 남겼는지는 그 팀에 안 보인다.

alter table public.xposts add column if not exists fee_mode text not null default 'split';
alter table public.xposts add column if not exists fee_total int;
alter table public.xposts add column if not exists fee_self boolean not null default true;
alter table public.xposts add column if not exists pay_amt int;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'xposts_fee_mode_ok') then
    alter table public.xposts add constraint xposts_fee_mode_ok check (fee_mode in ('split', 'free', 'pay'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'xposts_fee_total_ok') then
    alter table public.xposts add constraint xposts_fee_total_ok check (fee_total is null or fee_total between 0 and 2000000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'xposts_pay_amt_ok') then
    alter table public.xposts add constraint xposts_pay_amt_ok check (pay_amt is null or pay_amt between 0 and 200000);
  end if;
end $$;

alter table public.xapps add column if not exists fee int;
alter table public.xapps add column if not exists pay_due timestamptz;
alter table public.xapps add column if not exists paid_at timestamptz;
alter table public.xapps add column if not exists acct text not null default '';
do $$ declare c text; begin
  -- 상태: pending(기다림) pay(받음, 입금 기다림) sent(보냈어요) yes(확정) no(거절) cancel(취소)
  for c in select conname from pg_constraint where conrelid = 'public.xapps'::regclass and contype = 'c' and pg_get_constraintdef(oid) ~ 'status' loop
    execute format('alter table public.xapps drop constraint %I', c);
  end loop;
  alter table public.xapps add constraint xapps_status_ok check (status in ('pending', 'pay', 'sent', 'yes', 'no', 'cancel'));
  if not exists (select 1 from pg_constraint where conname = 'xapps_acct_len') then
    alter table public.xapps add constraint xapps_acct_len check (char_length(acct) <= 60);
  end if;
end $$;
drop index if exists public.xapps_one_user;
create unique index if not exists xapps_one_user2 on public.xapps(post_id, user_id) where status in ('pending', 'pay', 'sent', 'yes');

-- 용병이 남긴 팀 평가
create table if not exists public.xtrates (
  team_id uuid not null references public.teams(id) on delete cascade,
  event_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  manner smallint not null check (manner between 1 and 5),
  prep smallint not null check (prep between 1 and 5),
  same text not null default '' check (same in ('', 'same', 'bit', 'diff')),
  good text[] not null default '{}',
  bad text[] not null default '{}',
  memo text not null default '' check (char_length(memo) <= 200),
  updated_at timestamptz not null default now(),
  primary key (team_id, event_id, user_id)
);
alter table public.xtrates enable row level security;
revoke all on public.xtrates from public, anon, authenticated;
do $$ begin
  if to_regprocedure('public.maintenance_guard()') is not null then
    drop trigger if exists maintenance_guard on public.xtrates;
    create trigger maintenance_guard before insert or update or delete on public.xtrates for each row execute function public.maintenance_guard();
  end if;
end $$;

-- 도우미 ---------------------------------------------------------------------
-- 용병비 (500원 단위 내림)
create or replace function public.x_fee(p_type text, p_total int, p_people int) returns int language sql immutable as $$
  select case when coalesce(p_total, 0) <= 0 or coalesce(p_people, 0) <= 0 then 0
    else (floor((case when p_type = 'match' then p_total / 2.0 else p_total end) / p_people / 500) * 500)::int end
$$;
-- 일정에 들어간 용병 수
create or replace function public.x_guests(ev jsonb) returns int language sql immutable as $$
  select count(*)::int from jsonb_object_keys(case when jsonb_typeof(ev -> 'guests') = 'object' then ev -> 'guests' else '{}'::jsonb end)
$$;
-- 기한이 지난 입금 기다림은 취소로 (쓰기 함수 앞에서 부른다)
--   (남의 신청을 정리하는 것이라 요청 횟수에 세지 않게 잠깐 로그인 정보를 비운다)
create or replace function public.x_expire() returns void language plpgsql security definer set search_path = public as $$
declare oc text := coalesce(current_setting('request.jwt.claims', true), ''); ids uuid[]; os text := coalesce(current_setting('request.jwt.claim.sub', true), '');
begin
  if not exists (select 1 from public.xapps where status = 'pay' and pay_due is not null and pay_due < now()) then return; end if;
  perform set_config('request.jwt.claims', '', true); perform set_config('request.jwt.claim.sub', '', true);
  with gone as (update public.xapps set status = 'cancel', decided_at = now() where status = 'pay' and pay_due is not null and pay_due < now() returning post_id)
  select array_agg(distinct post_id) into ids from gone;
  -- 자리가 다 차서 닫혔던 글은 다시 연다 (다음 신청자에게 기회)
  update public.xposts p set state = 'open' where p.id = any(ids) and p.state = 'closed'
    and (select count(*) from public.xapps a where a.post_id = p.id and a.status in ('pay', 'sent', 'yes')) < jsonb_array_length(p.slots);
  perform set_config('request.jwt.claims', oc, true); perform set_config('request.jwt.claim.sub', os, true);
end $$;
-- 화면에 보이는 상태 (기한 지난 입금 기다림은 취소로 보인다)
create or replace function public.x_st(a public.xapps) returns text language sql stable as $$
  select case when a.status = 'pay' and a.pay_due is not null and a.pay_due < now() then 'cancel' else a.status end
$$;
-- 입금 기한: 받은 뒤 3시간, 경기 전날 21시부터는 1시간 (경기 시작보다 늦지 않게)
create or replace function public.x_due(ev jsonb) returns timestamptz language sql stable as $$
  with t as (select ((ev ->> 'date')::date - 1 + time '21:00') at time zone 'Asia/Seoul' as night,
                    ((ev ->> 'date')::date + coalesce(nullif(ev ->> 'time', ''), '23:59')::time) at time zone 'Asia/Seoul' as kick)
  select least(case when now() >= t.night then now() + interval '1 hour' else now() + interval '3 hours' end, greatest(t.kick, now() + interval '10 minutes')) from t
$$;
-- 용병 레벨 (구인 팀 운영진만 본다): 현장 출석으로 온 경기 +1, 그 경기 별 5개 +2, 4개 +1, 3개 0, 2개 -1, 1개 -2, 안 옴 -3. 0 아래로는 안 내려간다
create or replace function public.x_level(u uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r record; pts int := 0; games int := 0; miss int := 0; st smallint;
begin
  for r in select d.team_id, d.id eid, g.k, coalesce(d.data -> 'check' ->> g.k, '') ck
    from public.docs d, jsonb_each(case when jsonb_typeof(d.data -> 'guests') = 'object' then d.data -> 'guests' else '{}'::jsonb end) g(k, v)
    where d.coll = 'events' and v -> 'ext' ->> 'uid' = u::text and coalesce(d.data ->> 'date', '') ~ '^\d{4}-\d{2}-\d{2}$' and (d.data ->> 'date')::date < public.x_today()
      and jsonb_typeof(d.data -> 'check') = 'object' and d.data -> 'check' <> '{}'::jsonb
    order by d.data ->> 'date'
  loop
    if r.ck in ('in', 'late') then
      games := games + 1;
      select stars into st from public.xrates x where x.team_id = r.team_id and x.event_id = r.eid and x.guest_key = r.k;
      pts := pts + 1 + case st when 5 then 2 when 4 then 1 when 2 then -1 when 1 then -2 else 0 end;
    else miss := miss + 1; pts := pts - 3; end if;
    pts := greatest(pts, 0);
  end loop;
  return jsonb_build_object('level', case when pts >= 25 then 5 when pts >= 15 then 4 when pts >= 8 then 3 when pts >= 3 then 2 else 1 end, 'games', games, 'noshow', miss);
end $$;
-- 용병이 남긴 팀 평가 요약 (3명부터 숫자를 보여 준다)
create or replace function public.x_trv(t uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when count(*) < 3 then jsonb_build_object('n', count(*)) else jsonb_build_object('n', count(*),
    'manner', round(avg(manner)::numeric, 1), 'prep', round(avg(prep)::numeric, 1),
    'tags', coalesce((select jsonb_agg(w) from (select w from public.xtrates r2, unnest(r2.good) w where r2.team_id = t group by w order by count(*) desc, w limit 2) z), '[]'::jsonb)) end
  from public.xtrates r where r.team_id = t
$$;
-- 팀 공개 정보에 용병들의 평가를 더한다
create or replace function public.x_card(t uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', tm.id, 'name', tm.name,
    'sport', coalesce(s.data ->> 'sport', 'futsal'),
    'level', case when coalesce(s.data ->> 'level', '') ~ '^[1-5]$' then (s.data ->> 'level')::int end,
    'area', left(coalesce(s.data ->> 'area', ''), 20),
    'kit', left(coalesce(s.data -> 'kit' ->> 'home', s.data ->> 'uniformColor', ''), 20),
    'members', (select count(*) from public.members m where m.team_id = tm.id),
    'since', tm.created_at,
    'checked', (select count(*) from public.docs d where d.team_id = tm.id and d.coll = 'events' and jsonb_typeof(d.data -> 'check') = 'object' and d.data -> 'check' <> '{}'::jsonb),
    'matched', (select count(*) from public.xapps a join public.xposts p on p.id = a.post_id where a.kind = 'match' and a.status = 'yes' and (p.team_id = tm.id or a.from_team = tm.id)),
    'trv', public.x_trv(tm.id))
  from public.teams tm left join public.docs s on s.team_id = tm.id and s.coll = 'team' and s.id = 'settings'
  where tm.id = t
$$;
-- 글의 용병비 정보 (est: 지금 신청하면 받을 금액. 신청을 받을 때 정해진다)
create or replace function public.x_feeinfo(p public.xposts, ev jsonb) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('mode', p.fee_mode, 'total', p.fee_total, 'self', p.fee_self, 'pay', p.pay_amt,
    'people', public.x_votes(p.team_id, p.event_id) + public.x_guests(ev),
    'est', case when p.fee_mode = 'split' then public.x_fee(ev ->> 'type', p.fee_total, public.x_votes(p.team_id, p.event_id) + public.x_guests(ev) + 1) else 0 end)
$$;

-- 목록 -------------------------------------------------------------------------
create or replace function public.x_list(p_kind text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.x_need_user();
  if p_kind not in ('match', 'hire') then raise exception 'bad_kind' using errcode = '22023'; end if;
  return coalesce((select jsonb_agg(x.j order by x.d, x.tm) from (
    select jsonb_build_object('id', p.id, 'kind', p.kind, 'team', public.x_card(p.team_id), 'event', public.x_ev(e.data),
      'field', p.field, 'kit', p.kit, 'memo', p.memo, 'slots', p.slots, 'fee', public.x_feeinfo(p, e.data),
      'vs', case when coalesce(e.data -> 'xmatch' ->> 'team', '') ~ '^[0-9a-f-]{36}$' then public.x_card((e.data -> 'xmatch' ->> 'team')::uuid) end,
      'mem', public.x_votes(p.team_id, p.event_id),
      'merc', public.x_guests(e.data),
      'taken', (select count(*) from public.xapps a where a.post_id = p.id and public.x_st(a) in ('pay', 'sent', 'yes')),
      'mine', exists (select 1 from public.members m where m.team_id = p.team_id and m.user_id = auth.uid()),
      'applied', (select public.x_st(a) from public.xapps a where a.post_id = p.id and public.x_st(a) in ('pending', 'pay', 'sent', 'yes')
                  and (a.user_id = auth.uid() or a.from_team in (select team_id from public.members where user_id = auth.uid() and role in ('owner', 'admin'))) limit 1)) j,
      e.data ->> 'date' d, coalesce(e.data ->> 'time', '') tm
    from public.xposts p join public.docs e on e.team_id = p.team_id and e.coll = 'events' and e.id = p.event_id
    where p.kind = p_kind and p.state = 'open' and public.x_ev_open(e.data)) x), '[]'::jsonb);
end $$;

-- 우리 팀이 올린 글과 받은 신청 (운영진만). 용병은 별점 대신 레벨
create or replace function public.x_inbox(p_team uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin(p_team) then raise exception 'not_admin' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x.j order by x.d desc) from (
    select jsonb_build_object('id', p.id, 'kind', p.kind, 'event_id', p.event_id, 'event', public.x_ev(e.data), 'state', p.state, 'field', p.field, 'kit', p.kit, 'memo', p.memo, 'slots', p.slots,
      'fee', public.x_feeinfo(p, e.data), 'trv', public.x_trv(p.team_id),
      'mem', public.x_votes(p.team_id, p.event_id),
      'apps', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'sub', a.sub, 'pos', a.pos, 'memo', a.memo, 'status', public.x_st(a), 'at', a.created_at,
                 'fee', a.fee, 'due', a.pay_due, 'paid', a.paid_at, 'acct', case when p.fee_mode = 'pay' then a.acct else '' end,
                 'team', case when a.from_team is not null then public.x_card(a.from_team) end,
                 'mem', case when a.from_team is not null then public.x_votes(a.from_team, a.from_event) end,
                 'lv', case when a.kind = 'hire' then public.x_level(a.user_id) end) order by a.created_at)
               from public.xapps a where a.post_id = p.id and public.x_st(a) <> 'cancel'), '[]'::jsonb)) j, e.data ->> 'date' d
    from public.xposts p join public.docs e on e.team_id = p.team_id and e.coll = 'events' and e.id = p.event_id
    where p.team_id = p_team and (e.data ->> 'date')::date >= public.x_today() - 30) x), '[]'::jsonb);
end $$;

-- 내 신청 목록: 내가 낸 용병 신청과 우리 팀이 낸 매칭 신청. 용병 본인에게 별점과 레벨은 안 보낸다
create or replace function public.x_my() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.x_need_user();
  return jsonb_build_object('apps', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'kind', a.kind, 'status', public.x_st(a), 'pos', a.pos, 'at', a.created_at,
      'team', public.x_card(p.team_id), 'event', public.x_ev(e.data), 'mine', a.user_id = auth.uid(),
      'vs', case when coalesce(e.data -> 'xmatch' ->> 'team', '') ~ '^[0-9a-f-]{36}$' then public.x_card((e.data -> 'xmatch' ->> 'team')::uuid) end,
      'mode', p.fee_mode, 'fee', a.fee, 'pay', p.pay_amt, 'due', a.pay_due, 'paid', a.paid_at, 'self', p.fee_self, 'total', p.fee_total,
      'people', case when a.fee is not null and a.fee > 0 then null end,
      'bank', case when a.user_id = auth.uid() and public.x_st(a) in ('pay', 'sent') and p.fee_mode = 'split' then
        jsonb_build_object('bank', left(coalesce(s.data -> 'bank' ->> 'bank', ''), 30), 'account', left(coalesce(s.data -> 'bank' ->> 'account', ''), 40), 'holder', left(coalesce(s.data -> 'bank' ->> 'holder', ''), 30)) end,
      'came', a.kind = 'hire' and coalesce(e.data -> 'check' ->> ('x' || replace(a.id::text, '-', '')), '') in ('in', 'late'),
      'checked', jsonb_typeof(e.data -> 'check') = 'object' and e.data -> 'check' <> '{}'::jsonb,
      'past', coalesce(e.data ->> 'date', '') ~ '^\d{4}-\d{2}-\d{2}$' and (e.data ->> 'date')::date < public.x_today(),
      'rateBy', case when coalesce(e.data ->> 'date', '') ~ '^\d{4}-\d{2}-\d{2}$' then to_char((e.data ->> 'date')::date + 7, 'YYYY-MM-DD') end,
      'rated', exists (select 1 from public.xtrates r where r.team_id = p.team_id and r.event_id = p.event_id and r.user_id = a.user_id)) order by e.data ->> 'date' desc, a.created_at desc)
    from public.xapps a join public.xposts p on p.id = a.post_id join public.docs e on e.team_id = p.team_id and e.coll = 'events' and e.id = p.event_id
      left join public.docs s on s.team_id = p.team_id and s.coll = 'team' and s.id = 'settings'
    where public.x_st(a) <> 'cancel' and (a.user_id = auth.uid() or a.from_team in (select team_id from public.members where user_id = auth.uid() and role in ('owner', 'admin')))), '[]'::jsonb));
end $$;

-- 구인 글: 용병비 방식과 구장비 (구장 목록이 생기기 전까지 운영진이 직접 적는다)
drop function if exists public.x_post_hire(uuid, text, jsonb, text);
create or replace function public.x_post_hire(p_team uuid, p_event text, p_slots jsonb, p_memo text, p_mode text, p_total int, p_pay int) returns uuid
language plpgsql security definer set search_path = public as $$
declare ev jsonb; pid uuid; s jsonb; p jsonb; cap int; voted int; guests int;
  ok text[] := array['GK', 'LB', 'CB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST', '골레이로', '픽소', '아라', '피보'];
begin
  if not public.is_admin(p_team) then raise exception 'not_admin' using errcode = '42501'; end if;
  if coalesce(p_mode, '') not in ('split', 'free', 'pay') then raise exception 'bad_fee' using errcode = '22023'; end if;
  if p_mode = 'split' and (p_total is null or p_total < 10000 or p_total > 2000000) then raise exception 'bad_fee' using errcode = '22023'; end if;
  if p_mode = 'pay' and (p_pay is null or p_pay < 1000 or p_pay > 200000) then raise exception 'bad_fee' using errcode = '22023'; end if;
  select data into ev from public.docs where team_id = p_team and coll = 'events' and id = p_event;
  if not public.x_ev_open(ev) then raise exception 'event_closed' using errcode = '42501'; end if;
  if jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) = 0 or jsonb_array_length(p_slots) > 22 then raise exception 'bad_slots' using errcode = '22023'; end if;
  for s in select * from jsonb_array_elements(p_slots) loop
    if jsonb_typeof(s) <> 'array' or jsonb_array_length(s) = 0 or jsonb_array_length(s) > 4 then raise exception 'bad_slots' using errcode = '22023'; end if;
    for p in select * from jsonb_array_elements(s) loop
      if jsonb_typeof(p) <> 'string' or not ((p #>> '{}') = any(ok)) then raise exception 'bad_slots' using errcode = '22023'; end if;
    end loop;
  end loop;
  cap := case when coalesce(ev ->> 'cap', '') ~ '^\d{1,3}$' then (ev ->> 'cap')::int end;
  voted := public.x_votes(p_team, p_event);
  guests := public.x_guests(ev);
  if cap is not null and jsonb_array_length(p_slots) > greatest(cap - voted - guests, 0) then raise exception 'too_many' using errcode = '22023'; end if;
  insert into public.xposts (kind, team_id, event_id, slots, memo, state, fee_mode, fee_total, fee_self, pay_amt)
  values ('hire', p_team, p_event, p_slots, left(btrim(coalesce(p_memo, '')), 300), 'open', p_mode,
    case when p_mode = 'split' then p_total end, true, case when p_mode = 'pay' then p_pay end)
  on conflict (kind, team_id, event_id) do update set slots = excluded.slots, memo = excluded.memo, state = 'open',
    fee_mode = excluded.fee_mode, fee_total = excluded.fee_total, fee_self = excluded.fee_self, pay_amt = excluded.pay_amt
  returning id into pid;
  return pid;
end $$;

-- 용병 신청: 교통비 드리기 글이면 받을 계좌를 함께 (그 팀 운영진만 본다)
drop function if exists public.x_apply_hire(uuid, text, text);
create or replace function public.x_apply_hire(p_post uuid, p_pos text, p_memo text, p_acct text default '') returns uuid
language plpgsql security definer set search_path = public as $$
declare p public.xposts; pe jsonb; aid uuid; me jsonb;
begin
  perform public.x_need_user();
  perform public.x_expire();
  select * into p from public.xposts where id = p_post;
  if p.id is null or p.kind <> 'hire' or p.state <> 'open' then raise exception 'post_closed' using errcode = '42501'; end if;
  if exists (select 1 from public.members where team_id = p.team_id and user_id = auth.uid()) then raise exception 'own_team' using errcode = '42501'; end if;
  select data into pe from public.docs where team_id = p.team_id and coll = 'events' and id = p.event_id;
  if not public.x_ev_open(pe) then raise exception 'post_closed' using errcode = '42501'; end if;
  if not exists (select 1 from jsonb_array_elements(p.slots) s where (select string_agg(v, '/') from jsonb_array_elements_text(s) v) = p_pos) then raise exception 'bad_pos' using errcode = '22023'; end if;
  if p.fee_mode = 'pay' and char_length(btrim(coalesce(p_acct, ''))) < 6 then raise exception 'need_acct' using errcode = '22023'; end if;
  me := public.x_me(null);
  insert into public.xapps (post_id, kind, user_id, name, sub, pos, memo, acct)
  values (p_post, 'hire', auth.uid(), left(me ->> 'name', 30), left(concat_ws(', ', nullif(me ->> 'team', '') || ' 팀원', nullif(me ->> 'pos', '')), 80), p_pos, left(btrim(coalesce(p_memo, '')), 200),
    case when p.fee_mode = 'pay' then left(btrim(coalesce(p_acct, '')), 60) else '' end)
  returning id into aid;
  if to_regprocedure('public.push_add(uuid, uuid[], text, text, text, text, text)') is not null then
    perform public.push_add(p.team_id, public.push_admins(p.team_id), 'x_hire', '용병 신청이 왔어요', (me ->> 'name') || ', ' || p_pos || ', ' || public.push_ev_label(pe), '#/hire', 'x_hire:' || aid);
  end if;
  return aid;
end $$;

-- 신청 취소: 기다림, 또는 받았지만 아직 안 보낸 것 (신청한 사람 또는 신청한 팀 운영진)
create or replace function public.x_cancel(p_app uuid) returns text
language plpgsql security definer set search_path = public as $$
declare a public.xapps;
begin
  perform public.x_expire();
  select * into a from public.xapps where id = p_app;
  if a.id is null or not (a.user_id = auth.uid() or (a.from_team is not null and public.is_admin(a.from_team))) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if a.status not in ('pending', 'pay') then raise exception 'not_pending' using errcode = '42501'; end if;
  update public.xapps set status = 'cancel', decided_at = now() where id = p_app;
  return 'cancel';
end $$;

-- 용병을 참석 명단에 넣는다 (받기 또는 입금 확인 때)
create or replace function public.x_seat(a public.xapps, p public.xposts, me uuid) returns void
language plpgsql security definer set search_path = public as $$
declare k text := 'x' || replace(a.id::text, '-', '');
begin
  update public.docs set data = jsonb_set(data, '{guests}', coalesce(case when jsonb_typeof(data -> 'guests') = 'object' then data -> 'guests' end, '{}'::jsonb)
    || jsonb_build_object(k, jsonb_build_object('name', a.name, 'pos', split_part(a.pos, '/', 1), 'by', me::text, 'at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'inCap', true,
       'ext', jsonb_build_object('uid', a.user_id::text, 'sub', a.sub, 'app', a.id::text, 'fee', coalesce(a.fee, 0), 'mode', p.fee_mode)))), updated_at = now(), updated_by = me
    where team_id = p.team_id and coll = 'events' and id = p.event_id;
end $$;

-- 받기와 거절 (글을 올린 팀 운영진)
--   용병: 구장비 나눠 받기면 금액을 정하고 입금을 기다린다(pay). 무료, 교통비 드리기면 바로 참석 명단에(yes)
--   매칭: 두 팀 일정에 서로를 상대로 적고, 글을 닫고, 다른 매칭 신청은 거절한다
create or replace function public.x_answer(p_app uuid, p_ok boolean) returns text
language plpgsql security definer set search_path = public as $$
declare a public.xapps; p public.xposts; pe jsonb; fe jsonb; me uuid := auth.uid(); old text; pname text; fname text; nm text; v_fee int; res text;
begin
  perform public.x_expire();
  select * into a from public.xapps where id = p_app;
  if a.id is null then raise exception 'no_app' using errcode = '42501'; end if;
  select * into p from public.xposts where id = a.post_id;
  if not public.is_admin(p.team_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  if a.status <> 'pending' then raise exception 'not_pending' using errcode = '42501'; end if;
  select data into pe from public.docs where team_id = p.team_id and coll = 'events' and id = p.event_id;
  if not public.x_ev_open(pe) then raise exception 'event_closed' using errcode = '42501'; end if;
  if not p_ok then
    update public.xapps set status = 'no', decided_at = now() where id = p_app; res := 'no';
  elsif a.kind = 'hire' then
    if (select count(*) from public.xapps where post_id = p.id and status in ('pay', 'sent', 'yes')) >= jsonb_array_length(p.slots) then raise exception 'full' using errcode = '42501'; end if;
    if p.fee_mode = 'split' then
      v_fee := public.x_fee(pe ->> 'type', p.fee_total, public.x_votes(p.team_id, p.event_id) + public.x_guests(pe) + 1);
    else v_fee := case when p.fee_mode = 'pay' then -coalesce(p.pay_amt, 0) else 0 end; end if;
    if p.fee_mode = 'split' and v_fee > 0 then
      update public.xapps set status = 'pay', fee = v_fee, pay_due = public.x_due(pe), decided_at = now() where id = p_app returning * into a; res := 'pay';
    else
      update public.xapps set status = 'yes', fee = v_fee, decided_at = now() where id = p_app returning * into a;
      perform public.x_seat(a, p, me); res := 'yes';
    end if;
    if (select count(*) from public.xapps where post_id = p.id and status in ('pay', 'sent', 'yes')) >= jsonb_array_length(p.slots) then update public.xposts set state = 'closed' where id = p.id; end if;
  else
    select data into fe from public.docs where team_id = a.from_team and coll = 'events' and id = a.from_event;
    if not public.x_ev_open(fe) or coalesce(fe ->> 'opponent', '') <> '' or coalesce(pe ->> 'opponent', '') <> '' then raise exception 'not_open_match' using errcode = '42501'; end if;
    select name into pname from public.teams where id = p.team_id;
    select name into fname from public.teams where id = a.from_team;
    update public.docs set data = data || jsonb_build_object('opponent', left(fname, 40), 'xmatch', jsonb_build_object('team', a.from_team::text, 'event', a.from_event)), updated_at = now(), updated_by = me
      where team_id = p.team_id and coll = 'events' and id = p.event_id;
    old := public.x_as(a.user_id);
    if public.is_admin(a.from_team) then
      update public.docs set data = data || jsonb_build_object('opponent', left(pname, 40), 'xmatch', jsonb_build_object('team', p.team_id::text, 'event', p.event_id)), updated_at = now(), updated_by = a.user_id
        where team_id = a.from_team and coll = 'events' and id = a.from_event;
    end if;
    perform public.x_back(old, me);
    update public.xapps set status = 'yes', decided_at = now() where id = p_app;
    update public.xapps set status = 'no', decided_at = now() where post_id = p.id and id <> p_app and status = 'pending';
    update public.xposts set state = 'closed' where id = p.id; res := 'yes';
  end if;
  if to_regprocedure('public.push_add(uuid, uuid[], text, text, text, text, text)') is not null then
    select name into nm from public.teams where id = p.team_id;
    perform public.push_add(coalesce(a.from_team, p.team_id), array[a.user_id], 'x_answer',
      case when res = 'pay' then '신청을 받았어요, 용병비를 보내 주세요' when p_ok then '신청을 받았어요' else '신청이 거절됐어요' end,
      nm || ', ' || public.push_ev_label(pe), case when a.kind = 'hire' then '#/seek' else '#/match' end, 'x_answer:' || a.id);
  end if;
  return res;
end $$;

-- 용병: 용병비를 보냈어요 (그 팀 운영진에게 알림)
create or replace function public.x_paid(p_app uuid) returns text
language plpgsql security definer set search_path = public as $$
declare a public.xapps; p public.xposts; pe jsonb;
begin
  perform public.x_expire();
  select * into a from public.xapps where id = p_app;
  if a.id is null or a.user_id <> auth.uid() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if a.status <> 'pay' then raise exception 'not_pay' using errcode = '42501'; end if;
  update public.xapps set status = 'sent', paid_at = now() where id = p_app;
  select * into p from public.xposts where id = a.post_id;
  select data into pe from public.docs where team_id = p.team_id and coll = 'events' and id = p.event_id;
  if to_regprocedure('public.push_add(uuid, uuid[], text, text, text, text, text)') is not null then
    perform public.push_add(p.team_id, public.push_admins(p.team_id), 'x_paid', '용병비를 보냈대요, 입금을 확인해 주세요', a.name || ', ' || coalesce(a.fee, 0) || '원, ' || public.push_ev_label(pe), '#/hire', 'x_paid:' || a.id);
  end if;
  return 'sent';
end $$;

-- 운영진: 입금 확인 (확인하면 참석 명단과 그 경기 대화방에 들어간다)
create or replace function public.x_pay_ok(p_app uuid) returns text
language plpgsql security definer set search_path = public as $$
declare a public.xapps; p public.xposts; pe jsonb; nm text;
begin
  perform public.x_expire();
  select * into a from public.xapps where id = p_app;
  if a.id is null then raise exception 'no_app' using errcode = '42501'; end if;
  select * into p from public.xposts where id = a.post_id;
  if not public.is_admin(p.team_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  if a.status not in ('pay', 'sent') then raise exception 'not_pay' using errcode = '42501'; end if;
  select data into pe from public.docs where team_id = p.team_id and coll = 'events' and id = p.event_id;
  if not public.x_ev_open(pe) then raise exception 'event_closed' using errcode = '42501'; end if;
  update public.xapps set status = 'yes', paid_at = coalesce(paid_at, now()) where id = p_app returning * into a;
  perform public.x_seat(a, p, auth.uid());
  if to_regprocedure('public.push_add(uuid, uuid[], text, text, text, text, text)') is not null then
    select name into nm from public.teams where id = p.team_id;
    perform public.push_add(p.team_id, array[a.user_id], 'x_pay_ok', '입금이 확인됐어요, 대화방에 들어갔어요', nm || ', ' || public.push_ev_label(pe), '#/seek', 'x_pay_ok:' || a.id);
  end if;
  return 'yes';
end $$;

-- 용병이 팀 평가: 현장 출석으로 온 것이 확인된 내 신청만, 경기 뒤 7일 안에 (고칠 수 있음)
create or replace function public.x_rate_team(p_app uuid, p_manner int, p_prep int, p_same text, p_good text[], p_bad text[], p_memo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a public.xapps; p public.xposts; ev jsonb; w text;
  okg text[] := array['ontime', 'field', 'gear', 'fair', 'kind', 'pass'];
  okb text[] := array['late', 'long', 'rude', 'pos', 'fee'];
begin
  select * into a from public.xapps where id = p_app;
  if a.id is null or a.user_id <> auth.uid() or a.kind <> 'hire' or a.status <> 'yes' then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_manner is null or p_manner < 1 or p_manner > 5 or p_prep is null or p_prep < 1 or p_prep > 5 then raise exception 'bad_stars' using errcode = '22023'; end if;
  if coalesce(p_same, '') not in ('', 'same', 'bit', 'diff') then raise exception 'bad_why' using errcode = '22023'; end if;
  foreach w in array coalesce(p_good, '{}') loop if not (w = any(okg)) then raise exception 'bad_why' using errcode = '22023'; end if; end loop;
  foreach w in array coalesce(p_bad, '{}') loop if not (w = any(okb)) then raise exception 'bad_why' using errcode = '22023'; end if; end loop;
  select * into p from public.xposts where id = a.post_id;
  select data into ev from public.docs where team_id = p.team_id and coll = 'events' and id = p.event_id;
  if ev is null or coalesce(ev ->> 'date', '') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'no_event' using errcode = '42501'; end if;
  if (ev ->> 'date')::date >= public.x_today() then raise exception 'not_yet' using errcode = '42501'; end if;
  if (ev ->> 'date')::date < public.x_today() - 7 then raise exception 'too_late' using errcode = '42501'; end if;
  if coalesce(ev -> 'check' ->> ('x' || replace(a.id::text, '-', '')), '') not in ('in', 'late') then raise exception 'not_came' using errcode = '42501'; end if;
  insert into public.xtrates (team_id, event_id, user_id, manner, prep, same, good, bad, memo)
  values (p.team_id, p.event_id, a.user_id, p_manner, p_prep, coalesce(p_same, ''), coalesce(p_good, '{}'), coalesce(p_bad, '{}'), left(btrim(coalesce(p_memo, '')), 200))
  on conflict (team_id, event_id, user_id) do update set manner = excluded.manner, prep = excluded.prep, same = excluded.same, good = excluded.good, bad = excluded.bad, memo = excluded.memo, updated_at = now();
  return jsonb_build_object('manner', p_manner, 'prep', p_prep);
end $$;

-- 요청 횟수 제한 (안전장치와 같은 방식)
do $$ begin
  if to_regprocedure('public.rl_guard()') is not null then
    drop trigger if exists rl_guard on public.xtrates;
    create trigger rl_guard before insert or update on public.xtrates for each row execute function public.rl_guard();
  end if;
end $$;

-- 권한
revoke all on function public.x_fee(text, int, int), public.x_guests(jsonb), public.x_expire(), public.x_st(public.xapps), public.x_due(jsonb), public.x_level(uuid), public.x_trv(uuid),
  public.x_feeinfo(public.xposts, jsonb), public.x_seat(public.xapps, public.xposts, uuid), public.x_card(uuid) from public, anon, authenticated;
revoke all on function public.x_post_hire(uuid, text, jsonb, text, text, int, int), public.x_apply_hire(uuid, text, text, text), public.x_paid(uuid), public.x_pay_ok(uuid),
  public.x_rate_team(uuid, int, int, text, text[], text[], text), public.x_list(text), public.x_inbox(uuid), public.x_my(), public.x_cancel(uuid), public.x_answer(uuid, boolean) from public, anon;
grant execute on function public.x_post_hire(uuid, text, jsonb, text, text, int, int), public.x_apply_hire(uuid, text, text, text), public.x_paid(uuid), public.x_pay_ok(uuid),
  public.x_rate_team(uuid, int, int, text, text[], text[], text), public.x_list(text), public.x_inbox(uuid), public.x_my(), public.x_cancel(uuid), public.x_answer(uuid, boolean) to authenticated;
