-- 2026-11-23 다른 팀과: 매칭, 용병 구인, 용병 구직, 용병 평가
-- 다른 팀에게는 팀 공개 정보(이름, 종목, 실력, 지역, 팀원 수, 매니볼 쓴 기간, 현장 출석 받은 경기 수)와
-- 글에 올린 일정(날짜, 시간, 장소)과 참석 투표 수만 보인다. 팀원 이름, 연락처, 회비 같은 것은 보이지 않는다.
-- 표는 직접 읽거나 쓸 수 없고, 아래 서버 함수로만 다룬다.
-- 여러 번 실행해도 안전하다.

-- 글: 매칭 글(우리 경기 상대 찾기), 구인 글(우리 경기 용병 찾기). 일정 하나에 종류마다 글 하나
create table if not exists public.xposts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('match', 'hire')),
  team_id uuid not null references public.teams(id) on delete cascade,
  event_id text not null check (event_id ~ '^[A-Za-z0-9_:.@+-]{1,80}$'),
  created_by uuid default auth.uid(),
  field text not null default 'yes' check (field in ('yes', 'no')),
  kit text not null default '' check (char_length(kit) <= 20),
  slots jsonb not null default '[]'::jsonb check (jsonb_typeof(slots) = 'array' and jsonb_array_length(slots) <= 22),
  memo text not null default '' check (char_length(memo) <= 300),
  state text not null default 'open' check (state in ('open', 'closed')),
  created_at timestamptz not null default now(),
  unique (kind, team_id, event_id)
);
-- 신청: 매칭 신청(팀이 팀에), 용병 신청(사람이 팀에)
create table if not exists public.xapps (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.xposts(id) on delete cascade,
  kind text not null check (kind in ('match', 'hire')),
  from_team uuid references public.teams(id) on delete cascade,
  from_event text check (from_event is null or from_event ~ '^[A-Za-z0-9_:.@+-]{1,80}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '' check (char_length(name) <= 30),
  sub text not null default '' check (char_length(sub) <= 80),
  pos text not null default '' check (char_length(pos) <= 40),
  memo text not null default '' check (char_length(memo) <= 200),
  status text not null default 'pending' check (status in ('pending', 'yes', 'no', 'cancel')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index if not exists xapps_one_user on public.xapps(post_id, user_id) where status in ('pending', 'yes');
create unique index if not exists xapps_one_team on public.xapps(post_id, from_team) where from_team is not null and status in ('pending', 'yes');
-- 용병 평가: 그 경기를 연 팀이 경기 뒤 한 번 (고칠 수 있음)
create table if not exists public.xrates (
  team_id uuid not null references public.teams(id) on delete cascade,
  event_id text not null,
  guest_key text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  why text[] not null default '{}',
  rater uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  primary key (team_id, event_id, guest_key)
);
create index if not exists xrates_user_idx on public.xrates(user_id);
alter table public.xposts enable row level security;
alter table public.xapps enable row level security;
alter table public.xrates enable row level security;
revoke all on public.xposts, public.xapps, public.xrates from public, anon, authenticated;

-- 점검 중에는 쓰기를 막는다
do $$ declare t text; begin
  if to_regprocedure('public.maintenance_guard()') is not null then
    foreach t in array array['xposts', 'xapps', 'xrates'] loop
      execute format('drop trigger if exists maintenance_guard on public.%I', t);
      execute format('create trigger maintenance_guard before insert or update or delete on public.%I for each row execute function public.maintenance_guard()', t);
    end loop;
  end if;
end $$;

-- 도우미 ---------------------------------------------------------------------
create or replace function public.x_today() returns date language sql stable as $$ select (now() at time zone 'Asia/Seoul')::date $$;
-- 팀 공개 정보
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
    'matched', (select count(*) from public.xapps a join public.xposts p on p.id = a.post_id where a.kind = 'match' and a.status = 'yes' and (p.team_id = tm.id or a.from_team = tm.id)))
  from public.teams tm left join public.docs s on s.team_id = tm.id and s.coll = 'team' and s.id = 'settings'
  where tm.id = t
$$;
-- 일정에서 다른 팀에게 보여도 되는 것만
create or replace function public.x_ev(d jsonb) returns jsonb language sql immutable as $$
  select jsonb_build_object('date', d ->> 'date', 'time', coalesce(d ->> 'time', ''), 'end', coalesce(d ->> 'end', ''), 'place', left(coalesce(d ->> 'place', ''), 60),
    'type', coalesce(d ->> 'type', ''), 'cap', case when coalesce(d ->> 'cap', '') ~ '^\d{1,3}$' then (d ->> 'cap')::int end, 'opponent', left(coalesce(d ->> 'opponent', ''), 40))
$$;
-- 참석 투표 수 (참석, 늦참)
create or replace function public.x_votes(t uuid, e text) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.docs r where r.team_id = t and r.coll = 'rsvp' and coalesce(r.data -> 'ev' -> e ->> 's', '') in ('yes', 'late')
$$;
-- 용병 별점: 평가 수, 평균, 안 옴 (현장 출석을 받은 경기에서 안 온 것으로 체크된 수)
create or replace function public.x_rating(u uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'n', (select count(*) from public.xrates r where r.user_id = u),
    'avg', (select round(avg(stars)::numeric, 1) from public.xrates r where r.user_id = u),
    'noshow', (select count(*) from public.docs d, jsonb_each(case when jsonb_typeof(d.data -> 'guests') = 'object' then d.data -> 'guests' else '{}'::jsonb end) g(k, v)
               where d.coll = 'events' and v -> 'ext' ->> 'uid' = u::text and coalesce(d.data ->> 'date', '') ~ '^\d{4}-\d{2}-\d{2}$' and (d.data ->> 'date')::date < public.x_today()
                 and jsonb_typeof(d.data -> 'check') = 'object' and d.data -> 'check' <> '{}'::jsonb and coalesce(d.data -> 'check' ->> k, '') not in ('in', 'late')))
$$;
-- 내가 매니볼에서 쓰는 이름과 팀 (용병 신청에 붙는 소개)
create or replace function public.x_me(t uuid default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('name', coalesce(nullif(p.data -> 'profile' ->> 'name', ''), nullif(m.display_name, ''), '이름 없음'),
    'team', tm.name, 'pos', concat_ws(' / ', nullif(p.data -> 'profile' ->> 'pos1', ''), nullif(p.data -> 'profile' ->> 'pos2', '')))
  from public.members m join public.teams tm on tm.id = m.team_id left join public.docs p on p.team_id = m.team_id and p.coll = 'rsvp' and p.id = m.user_id::text
  where m.user_id = auth.uid() and (t is null or m.team_id = t) order by m.joined_at limit 1
$$;
create or replace function public.x_need_user() returns void language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from public.members where user_id = auth.uid()) then raise exception 'not_member' using errcode = '42501'; end if;
end $$;
-- 열린 일정인지 (날짜가 오늘이거나 앞, 취소 안 됨)
create or replace function public.x_ev_open(d jsonb) returns boolean language sql stable as $$
  select d is not null and coalesce(d -> 'cancel' ->> 'at', '') = '' and coalesce(d ->> 'date', '') ~ '^\d{4}-\d{2}-\d{2}$' and (d ->> 'date')::date >= public.x_today()
$$;
-- 다른 사람의 이름으로 잠깐 쓰기 (매칭이 잡히면 상대 팀 일정에도 상대를 적는다. 그 팀 운영진인 신청자 이름으로)
create or replace function public.x_as(u uuid) returns text language plpgsql security definer set search_path = public as $$
declare old text := coalesce(current_setting('request.jwt.claims', true), '');
begin
  perform set_config('request.jwt.claims', jsonb_set(coalesce(nullif(old, '')::jsonb, '{}'::jsonb), '{sub}', to_jsonb(u::text))::text, true);
  perform set_config('request.jwt.claim.sub', u::text, true);
  return old;
end $$;
create or replace function public.x_back(old text, me uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('request.jwt.claims', old, true);
  perform set_config('request.jwt.claim.sub', coalesce(me::text, ''), true);
end $$;

-- 목록 -------------------------------------------------------------------------
-- 열린 글 (다른 팀 글과 우리 팀 글). 매칭: 같은 종목 팀만
create or replace function public.x_list(p_kind text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare my_sport text;
begin
  perform public.x_need_user();
  if p_kind not in ('match', 'hire') then raise exception 'bad_kind' using errcode = '22023'; end if;
  return coalesce((select jsonb_agg(x.j order by x.d, x.tm) from (
    select jsonb_build_object('id', p.id, 'kind', p.kind, 'team', public.x_card(p.team_id), 'event', public.x_ev(e.data),
      'field', p.field, 'kit', p.kit, 'memo', p.memo, 'slots', p.slots,
      'mem', public.x_votes(p.team_id, p.event_id),
      'merc', (select count(*) from jsonb_object_keys(case when jsonb_typeof(e.data -> 'guests') = 'object' then e.data -> 'guests' else '{}'::jsonb end)),
      'taken', (select count(*) from public.xapps a where a.post_id = p.id and a.status = 'yes'),
      'mine', exists (select 1 from public.members m where m.team_id = p.team_id and m.user_id = auth.uid()),
      'applied', (select a.status from public.xapps a where a.post_id = p.id and a.status in ('pending', 'yes')
                  and (a.user_id = auth.uid() or a.from_team in (select team_id from public.members where user_id = auth.uid() and role in ('owner', 'admin'))) limit 1)) j,
      e.data ->> 'date' d, coalesce(e.data ->> 'time', '') tm
    from public.xposts p join public.docs e on e.team_id = p.team_id and e.coll = 'events' and e.id = p.event_id
    where p.kind = p_kind and p.state = 'open' and public.x_ev_open(e.data)) x), '[]'::jsonb);
end $$;

-- 우리 팀이 올린 글과 받은 신청 (운영진만)
create or replace function public.x_inbox(p_team uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin(p_team) then raise exception 'not_admin' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(x.j order by x.d desc) from (
    select jsonb_build_object('id', p.id, 'kind', p.kind, 'event_id', p.event_id, 'event', public.x_ev(e.data), 'state', p.state, 'field', p.field, 'kit', p.kit, 'memo', p.memo, 'slots', p.slots,
      'mem', public.x_votes(p.team_id, p.event_id),
      'apps', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'sub', a.sub, 'pos', a.pos, 'memo', a.memo, 'status', a.status, 'at', a.created_at,
                 'team', case when a.from_team is not null then public.x_card(a.from_team) end,
                 'mem', case when a.from_team is not null then public.x_votes(a.from_team, a.from_event) end,
                 'rating', case when a.kind = 'hire' then public.x_rating(a.user_id) end) order by a.created_at)
               from public.xapps a where a.post_id = p.id and a.status <> 'cancel'), '[]'::jsonb)) j, e.data ->> 'date' d
    from public.xposts p join public.docs e on e.team_id = p.team_id and e.coll = 'events' and e.id = p.event_id
    where p.team_id = p_team and (e.data ->> 'date')::date >= public.x_today() - 30) x), '[]'::jsonb);
end $$;

-- 내가 낸 용병 신청과 우리 팀이 낸 매칭 신청, 내 별점
create or replace function public.x_my() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.x_need_user();
  return jsonb_build_object('rating', public.x_rating(auth.uid()), 'apps', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'kind', a.kind, 'status', a.status, 'pos', a.pos, 'at', a.created_at,
      'team', public.x_card(p.team_id), 'event', public.x_ev(e.data), 'mine', a.user_id = auth.uid()) order by a.created_at desc)
    from public.xapps a join public.xposts p on p.id = a.post_id join public.docs e on e.team_id = p.team_id and e.coll = 'events' and e.id = p.event_id
    where a.status <> 'cancel' and (a.user_id = auth.uid() or a.from_team in (select team_id from public.members where user_id = auth.uid() and role in ('owner', 'admin')))), '[]'::jsonb));
end $$;

-- 글 올리기 -------------------------------------------------------------------
-- 매칭 글: 상대가 정해지지 않은 우리 경기에서만
create or replace function public.x_post_match(p_team uuid, p_event text, p_field text, p_kit text, p_memo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare ev jsonb; pid uuid;
begin
  if not public.is_admin(p_team) then raise exception 'not_admin' using errcode = '42501'; end if;
  select data into ev from public.docs where team_id = p_team and coll = 'events' and id = p_event;
  if not public.x_ev_open(ev) then raise exception 'event_closed' using errcode = '42501'; end if;
  if coalesce(ev ->> 'type', '') <> 'match' or coalesce(ev ->> 'opponent', '') <> '' then raise exception 'not_open_match' using errcode = '42501'; end if;
  insert into public.xposts (kind, team_id, event_id, field, kit, memo, state)
  values ('match', p_team, p_event, case when p_field = 'no' then 'no' else 'yes' end, left(coalesce(p_kit, ''), 20), left(btrim(coalesce(p_memo, '')), 300), 'open')
  on conflict (kind, team_id, event_id) do update set field = excluded.field, kit = excluded.kit, memo = excluded.memo, state = 'open'
  returning id into pid;
  return pid;
end $$;

-- 구인 글: 용병 한 명마다 들어갈 수 있는 자리 목록. 사람 수는 정원에서 참석 투표 수를 뺀 것보다 많을 수 없다 (허위 인원 막기)
create or replace function public.x_post_hire(p_team uuid, p_event text, p_slots jsonb, p_memo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare ev jsonb; pid uuid; s jsonb; p jsonb; cap int; voted int; guests int;
  ok text[] := array['GK', 'LB', 'CB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST', '골레이로', '픽소', '아라', '피보'];
begin
  if not public.is_admin(p_team) then raise exception 'not_admin' using errcode = '42501'; end if;
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
  guests := (select count(*) from jsonb_object_keys(case when jsonb_typeof(ev -> 'guests') = 'object' then ev -> 'guests' else '{}'::jsonb end));
  if cap is not null and jsonb_array_length(p_slots) > greatest(cap - voted - guests, 0) then raise exception 'too_many' using errcode = '22023'; end if;
  insert into public.xposts (kind, team_id, event_id, slots, memo, state)
  values ('hire', p_team, p_event, p_slots, left(btrim(coalesce(p_memo, '')), 300), 'open')
  on conflict (kind, team_id, event_id) do update set slots = excluded.slots, memo = excluded.memo, state = 'open'
  returning id into pid;
  return pid;
end $$;

-- 글 닫기와 다시 열기 (그 팀 운영진)
create or replace function public.x_post_state(p_post uuid, p_open boolean) returns text
language plpgsql security definer set search_path = public as $$
declare p public.xposts;
begin
  select * into p from public.xposts where id = p_post;
  if p.id is null or not public.is_admin(p.team_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  update public.xposts set state = case when p_open then 'open' else 'closed' end where id = p_post;
  return case when p_open then 'open' else 'closed' end;
end $$;

-- 신청 -----------------------------------------------------------------------
-- 매칭 신청: 우리 팀 운영진이, 같은 날 상대가 정해지지 않은 우리 경기로. 우리 팀원 수는 그 경기의 참석 투표 수
create or replace function public.x_apply_match(p_post uuid, p_team uuid, p_event text, p_memo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare p public.xposts; pe jsonb; me jsonb; aid uuid; nm text;
begin
  if not public.is_admin(p_team) then raise exception 'not_admin' using errcode = '42501'; end if;
  select * into p from public.xposts where id = p_post;
  if p.id is null or p.kind <> 'match' or p.state <> 'open' then raise exception 'post_closed' using errcode = '42501'; end if;
  if p.team_id = p_team then raise exception 'own_post' using errcode = '42501'; end if;
  select data into pe from public.docs where team_id = p.team_id and coll = 'events' and id = p.event_id;
  if not public.x_ev_open(pe) then raise exception 'post_closed' using errcode = '42501'; end if;
  select data into me from public.docs where team_id = p_team and coll = 'events' and id = p_event;
  if not public.x_ev_open(me) or coalesce(me ->> 'type', '') <> 'match' or coalesce(me ->> 'opponent', '') <> '' then raise exception 'not_open_match' using errcode = '42501'; end if;
  if me ->> 'date' <> pe ->> 'date' then raise exception 'other_day' using errcode = '42501'; end if;
  if (public.x_card(p_team) ->> 'sport') <> (public.x_card(p.team_id) ->> 'sport') then raise exception 'other_sport' using errcode = '42501'; end if;
  select name into nm from public.teams where id = p_team;
  insert into public.xapps (post_id, kind, from_team, from_event, user_id, name, memo)
  values (p_post, 'match', p_team, p_event, auth.uid(), left(nm, 30), left(btrim(coalesce(p_memo, '')), 200)) returning id into aid;
  if to_regprocedure('public.push_add(uuid, uuid[], text, text, text, text, text)') is not null then
    perform public.push_add(p.team_id, public.push_admins(p.team_id), 'x_match', '매칭 신청이 왔어요', nm || ', ' || public.push_ev_label(pe), '#/match', 'x_match:' || aid);
  end if;
  return aid;
end $$;

-- 용병 신청: 누구나 개인으로 (그 팀 사람은 못 함), 글의 자리 하나를 골라서
create or replace function public.x_apply_hire(p_post uuid, p_pos text, p_memo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare p public.xposts; pe jsonb; aid uuid; me jsonb;
begin
  perform public.x_need_user();
  select * into p from public.xposts where id = p_post;
  if p.id is null or p.kind <> 'hire' or p.state <> 'open' then raise exception 'post_closed' using errcode = '42501'; end if;
  if exists (select 1 from public.members where team_id = p.team_id and user_id = auth.uid()) then raise exception 'own_team' using errcode = '42501'; end if;
  select data into pe from public.docs where team_id = p.team_id and coll = 'events' and id = p.event_id;
  if not public.x_ev_open(pe) then raise exception 'post_closed' using errcode = '42501'; end if;
  if not exists (select 1 from jsonb_array_elements(p.slots) s where (select string_agg(v, '/') from jsonb_array_elements_text(s) v) = p_pos) then raise exception 'bad_pos' using errcode = '22023'; end if;
  me := public.x_me(null);
  insert into public.xapps (post_id, kind, user_id, name, sub, pos, memo)
  values (p_post, 'hire', auth.uid(), left(me ->> 'name', 30), left(concat_ws(', ', nullif(me ->> 'team', '') || ' 팀원', nullif(me ->> 'pos', '')), 80), p_pos, left(btrim(coalesce(p_memo, '')), 200))
  returning id into aid;
  if to_regprocedure('public.push_add(uuid, uuid[], text, text, text, text, text)') is not null then
    perform public.push_add(p.team_id, public.push_admins(p.team_id), 'x_hire', '용병 신청이 왔어요', (me ->> 'name') || ', ' || p_pos || ', ' || public.push_ev_label(pe), '#/hire', 'x_hire:' || aid);
  end if;
  return aid;
end $$;

-- 신청 취소 (기다리는 것만, 신청한 사람 또는 신청한 팀 운영진)
create or replace function public.x_cancel(p_app uuid) returns text
language plpgsql security definer set search_path = public as $$
declare a public.xapps;
begin
  select * into a from public.xapps where id = p_app;
  if a.id is null or not (a.user_id = auth.uid() or (a.from_team is not null and public.is_admin(a.from_team))) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if a.status <> 'pending' then raise exception 'not_pending' using errcode = '42501'; end if;
  update public.xapps set status = 'cancel', decided_at = now() where id = p_app;
  return 'cancel';
end $$;

-- 받기와 거절 (글을 올린 팀 운영진)
--   용병을 받으면 그 일정 참석 명단에 용병으로 들어간다 (정원 안). 자리가 다 차면 글이 닫힌다
--   매칭을 받으면 두 팀 일정에 서로를 상대로 적고, 글을 닫고, 다른 매칭 신청은 거절한다
create or replace function public.x_answer(p_app uuid, p_ok boolean) returns text
language plpgsql security definer set search_path = public as $$
declare a public.xapps; p public.xposts; pe jsonb; fe jsonb; me uuid := auth.uid(); old text; k text; pname text; fname text; nm text;
begin
  select * into a from public.xapps where id = p_app;
  if a.id is null then raise exception 'no_app' using errcode = '42501'; end if;
  select * into p from public.xposts where id = a.post_id;
  if not public.is_admin(p.team_id) then raise exception 'not_admin' using errcode = '42501'; end if;
  if a.status <> 'pending' then raise exception 'not_pending' using errcode = '42501'; end if;
  select data into pe from public.docs where team_id = p.team_id and coll = 'events' and id = p.event_id;
  if not public.x_ev_open(pe) then raise exception 'event_closed' using errcode = '42501'; end if;
  if not p_ok then
    update public.xapps set status = 'no', decided_at = now() where id = p_app;
  elsif a.kind = 'hire' then
    k := 'x' || replace(a.id::text, '-', '');
    select name into pname from public.teams where id = p.team_id;
    update public.docs set data = jsonb_set(data, '{guests}', coalesce(case when jsonb_typeof(data -> 'guests') = 'object' then data -> 'guests' end, '{}'::jsonb)
      || jsonb_build_object(k, jsonb_build_object('name', a.name, 'pos', split_part(a.pos, '/', 1), 'by', me::text, 'at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'inCap', true,
         'ext', jsonb_build_object('uid', a.user_id::text, 'sub', a.sub, 'app', a.id::text)))), updated_at = now(), updated_by = me
      where team_id = p.team_id and coll = 'events' and id = p.event_id;
    update public.xapps set status = 'yes', decided_at = now() where id = p_app;
    if (select count(*) from public.xapps where post_id = p.id and status = 'yes') >= jsonb_array_length(p.slots) then update public.xposts set state = 'closed' where id = p.id; end if;
  else
    select data into fe from public.docs where team_id = a.from_team and coll = 'events' and id = a.from_event;
    if not public.x_ev_open(fe) or coalesce(fe ->> 'opponent', '') <> '' or coalesce(pe ->> 'opponent', '') <> '' then raise exception 'not_open_match' using errcode = '42501'; end if;
    select name into pname from public.teams where id = p.team_id;
    select name into fname from public.teams where id = a.from_team;
    update public.docs set data = data || jsonb_build_object('opponent', left(fname, 40), 'xmatch', jsonb_build_object('team', a.from_team::text, 'event', a.from_event)), updated_at = now(), updated_by = me
      where team_id = p.team_id and coll = 'events' and id = p.event_id;
    -- 상대 팀 일정은 그 팀 운영진인 신청자 이름으로 적는다 (지금도 운영진일 때만)
    old := public.x_as(a.user_id);
    if public.is_admin(a.from_team) then
      update public.docs set data = data || jsonb_build_object('opponent', left(pname, 40), 'xmatch', jsonb_build_object('team', p.team_id::text, 'event', p.event_id)), updated_at = now(), updated_by = a.user_id
        where team_id = a.from_team and coll = 'events' and id = a.from_event;
    end if;
    perform public.x_back(old, me);
    update public.xapps set status = 'yes', decided_at = now() where id = p_app;
    update public.xapps set status = 'no', decided_at = now() where post_id = p.id and id <> p_app and status = 'pending';
    update public.xposts set state = 'closed' where id = p.id;
  end if;
  if to_regprocedure('public.push_add(uuid, uuid[], text, text, text, text, text)') is not null then
    select name into nm from public.teams where id = p.team_id;
    perform public.push_add(coalesce(a.from_team, p.team_id), array[a.user_id], 'x_answer', case when p_ok then '신청을 받았어요' else '신청이 거절됐어요' end,
      nm || ', ' || public.push_ev_label(pe), case when a.kind = 'hire' then '#/seek' else '#/match' end, 'x_answer:' || a.id);
  end if;
  return case when p_ok then 'yes' else 'no' end;
end $$;

-- 용병 평가 -------------------------------------------------------------------
-- 그 경기를 연 팀 운영진이, 경기 날짜가 지난 뒤 7일 안에, 현장 출석으로 온 것이 확인된 다른 팀 용병만
create or replace function public.x_rate(p_team uuid, p_event text, p_key text, p_stars int, p_why text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare ev jsonb; g jsonb; u uuid; w text;
  okw text[] := array['ontime', 'manner', 'fit', 'late', 'rude', 'curse'];
begin
  if not public.is_admin(p_team) then raise exception 'not_admin' using errcode = '42501'; end if;
  if p_stars is null or p_stars < 1 or p_stars > 5 then raise exception 'bad_stars' using errcode = '22023'; end if;
  foreach w in array coalesce(p_why, '{}') loop if not (w = any(okw)) then raise exception 'bad_why' using errcode = '22023'; end if; end loop;
  select data into ev from public.docs where team_id = p_team and coll = 'events' and id = p_event;
  if ev is null or coalesce(ev ->> 'date', '') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'no_event' using errcode = '42501'; end if;
  if (ev ->> 'date')::date >= public.x_today() then raise exception 'not_yet' using errcode = '42501'; end if;
  if (ev ->> 'date')::date < public.x_today() - 7 then raise exception 'too_late' using errcode = '42501'; end if;
  g := ev -> 'guests' -> p_key;
  if g is null or coalesce(g -> 'ext' ->> 'uid', '') = '' then raise exception 'not_ext' using errcode = '42501'; end if;
  if coalesce(ev -> 'check' ->> p_key, '') not in ('in', 'late') then raise exception 'not_came' using errcode = '42501'; end if;
  u := (g -> 'ext' ->> 'uid')::uuid;
  insert into public.xrates (team_id, event_id, guest_key, user_id, stars, why, rater)
  values (p_team, p_event, p_key, u, p_stars, coalesce(p_why, '{}'), auth.uid())
  on conflict (team_id, event_id, guest_key) do update set stars = excluded.stars, why = excluded.why, rater = excluded.rater, updated_at = now();
  return jsonb_build_object('stars', p_stars, 'why', to_jsonb(coalesce(p_why, '{}')));
end $$;
-- 그 경기에 온 다른 팀 용병과 우리 팀이 준 평가 (운영진)
create or replace function public.x_rates_of(p_team uuid, p_event text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare ev jsonb;
begin
  if not public.is_admin(p_team) then raise exception 'not_admin' using errcode = '42501'; end if;
  select data into ev from public.docs where team_id = p_team and coll = 'events' and id = p_event;
  return coalesce((select jsonb_agg(jsonb_build_object('key', g.k, 'name', g.v ->> 'name', 'pos', g.v ->> 'pos', 'sub', g.v -> 'ext' ->> 'sub',
      'check', coalesce(ev -> 'check' ->> g.k, ''), 'checked', jsonb_typeof(ev -> 'check') = 'object' and ev -> 'check' <> '{}'::jsonb,
      'rate', (select jsonb_build_object('stars', r.stars, 'why', to_jsonb(r.why)) from public.xrates r where r.team_id = p_team and r.event_id = p_event and r.guest_key = g.k)))
    from jsonb_each(case when jsonb_typeof(ev -> 'guests') = 'object' then ev -> 'guests' else '{}'::jsonb end) g(k, v)
    where coalesce(g.v -> 'ext' ->> 'uid', '') <> ''), '[]'::jsonb);
end $$;

-- 권한: 표는 막고, 함수만 로그인한 사람에게 연다 (도우미 함수는 안 연다)
revoke all on function public.x_today(), public.x_card(uuid), public.x_ev(jsonb), public.x_votes(uuid, text), public.x_rating(uuid), public.x_me(uuid), public.x_need_user(),
  public.x_ev_open(jsonb), public.x_as(uuid), public.x_back(text, uuid) from public, anon, authenticated;
revoke all on function public.x_list(text), public.x_inbox(uuid), public.x_my(), public.x_post_match(uuid, text, text, text, text), public.x_post_hire(uuid, text, jsonb, text),
  public.x_post_state(uuid, boolean), public.x_apply_match(uuid, uuid, text, text), public.x_apply_hire(uuid, text, text), public.x_cancel(uuid), public.x_answer(uuid, boolean),
  public.x_rate(uuid, text, text, int, text[]), public.x_rates_of(uuid, text) from public, anon;
grant execute on function public.x_list(text), public.x_inbox(uuid), public.x_my(), public.x_post_match(uuid, text, text, text, text), public.x_post_hire(uuid, text, jsonb, text),
  public.x_post_state(uuid, boolean), public.x_apply_match(uuid, uuid, text, text), public.x_apply_hire(uuid, text, text), public.x_cancel(uuid), public.x_answer(uuid, boolean),
  public.x_rate(uuid, text, text, int, text[]), public.x_rates_of(uuid, text) to authenticated;
