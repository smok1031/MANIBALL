-- 테스트 사이트 전용: 로그인 없이 체험하기 (운영에는 넣지 않는다)
-- 카카오 로그인 없이 들어온 사람(Supabase 익명 로그인)마다 자기만의 체험 팀(체험 FC)을 만들어 준다.
-- 체험 팀은 실제 팀(TEST FC)을 복사하지 않는다: 가짜 팀원만 있는 체험 원본 묶음(demo_pack 'team')으로 만든다 (2026-11-26).
--   그래서 실제 계정은 체험 팀에 들어가지 않는다. 묶음의 날짜는 {{...}} 표라서 체험을 시작하는 날 기준으로 앞뒤가 맞게 바뀐다.
-- 체험하는 사람은 그 팀의 운영진이라 팀원과 운영진 기능을 모두 써 볼 수 있다. 다른 사람의 체험 팀은 건드리지 못한다.
-- 다른 팀(강북 FC, 노을 FC, 번개 FC)의 매칭 글과 용병 구인 글은 모두가 함께 보는 예시라서, 글의 일정이 다 지나가면 새 날짜로 다시 만든다.
-- 체험 팀은 만든 지 하루가 지나면 지운다. 묶음은 seed_coherent.py demo 로 만든 demo_pack.sql 로 넣는다.

create table if not exists public.demo_teams (
  team_id uuid primary key references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists demo_teams_user_idx on public.demo_teams(user_id);
alter table public.demo_teams enable row level security;
revoke all on public.demo_teams from public, anon, authenticated;

create table if not exists public.demo_pack (
  k text primary key check (k in ('team', 'world')),
  pack jsonb not null,
  refreshed_on date
);
alter table public.demo_pack enable row level security;
revoke all on public.demo_pack from public, anon, authenticated;

-- {{...}} 표를 오늘 날짜 기준으로 바꾼다 (seed_coherent.py의 resolve와 같다)
create or replace function public.demo_resolve(p text, me uuid) returns text
language plpgsql stable set search_path = public as $$
declare m text[]; v text; n int; kn timestamp := now() at time zone 'Asia/Seoul'; o text := replace(p, '{{me}}', coalesce(me::text, ''));
begin
  for m in select distinct x from regexp_matches(o, '\{\{(d|D|h|t|m|T):(-?\d+)(?::(\d\d:\d\d))?\}\}', 'g') as x loop
    n := m[2]::int;
    v := case m[1]
      when 'd' then to_char(kn::date + n, 'YYYY-MM-DD')
      when 'D' then to_char(kn + make_interval(hours => n), 'YYYY-MM-DD')
      when 'h' then to_char(kn + make_interval(hours => n), 'HH24":00"')
      when 't' then to_char((now() + make_interval(mins => n)) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS".000Z"')
      when 'm' then to_char(date_trunc('month', kn) + make_interval(months => n), 'YYYY-MM')
      when 'T' then to_char(((kn::date + n) + m[3]::time) at time zone 'Asia/Seoul' at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS".000Z"') end;
    o := replace(o, '{{' || m[1] || ':' || m[2] || coalesce(':' || m[3], '') || '}}', v);
  end loop;
  return o;
end $$;
revoke all on function public.demo_resolve(text, uuid) from public, anon, authenticated;

-- 다른 팀 예시 (모두가 함께 본다): 글의 일정이 내일 안으로 다 지나가면 새 날짜로 다시 만든다
create or replace function public.demo_world_refresh() returns void
language plpgsql security definer set search_path = public as $$
declare w jsonb; t jsonb; tid uuid; own uuid; ps jsonb; e jsonb;
  c1 text := current_setting('request.jwt.claims', true); c2 text := current_setting('request.jwt.claim.sub', true);
begin
  select pack into w from public.demo_pack where k = 'world';
  if w is null then return; end if;
  if exists (select 1 from public.xposts p join public.docs d on d.team_id = p.team_id and d.coll = 'events' and d.id = p.event_id
             where p.team_id in (select (x ->> 'team')::uuid from jsonb_array_elements(w) x) and p.state = 'open'
               and coalesce(d.data ->> 'date', '') ~ '^\d{4}-\d{2}-\d{2}$' and (d.data ->> 'date')::date > (now() at time zone 'Asia/Seoul')::date + 1) then return; end if;
  w := public.demo_resolve(w::text, null)::jsonb;
  perform set_config('request.jwt.claims', '', true); perform set_config('request.jwt.claim.sub', '', true);
  insert into auth.users (id) values ('7e57fc00-0000-4000-8003-000000009001') on conflict (id) do nothing;
  for t in select * from jsonb_array_elements(w) loop
    tid := (t ->> 'team')::uuid; own := (t -> 'members' -> 0 ->> 'u')::uuid;
    insert into auth.users (id) select (m ->> 'u')::uuid from jsonb_array_elements(t -> 'members') m on conflict (id) do nothing;
    insert into public.teams (id, name, created_by, invite_code) values (tid, t ->> 'name', own, substr(md5(tid::text), 1, 10))
      on conflict (id) do update set name = excluded.name;
    insert into public.members (team_id, user_id, role, display_name) select tid, (m ->> 'u')::uuid, m ->> 'role', m ->> 'name' from jsonb_array_elements(t -> 'members') m
      on conflict (team_id, user_id) do update set role = excluded.role, display_name = excluded.display_name;
    delete from public.xposts where team_id = tid;
    delete from public.docs where team_id = tid and coll in ('events', 'rsvp', 'team');
    insert into public.docs (team_id, coll, id, data) select tid, d ->> 'c', d ->> 'i', d -> 'x' from jsonb_array_elements(t -> 'docs') d;
    for ps in select * from jsonb_array_elements(t -> 'posts') loop
      insert into public.xposts (kind, team_id, event_id, created_by, field, kit, slots, memo, state, fee_mode, fee_total, fee_self, pay_amt)
      values (ps ->> 'kind', tid, ps ->> 'event', own, coalesce(ps ->> 'field', 'yes'), coalesce(ps ->> 'kit', ''), coalesce(ps -> 'slots', '[]'::jsonb), coalesce(ps ->> 'memo', ''), 'open',
        coalesce(ps ->> 'fee_mode', 'split'), (ps ->> 'fee_total')::int, true, (ps ->> 'pay_amt')::int);
    end loop;
  end loop;
  update public.demo_pack set refreshed_on = (now() at time zone 'Asia/Seoul')::date where k = 'world';
  perform set_config('request.jwt.claims', coalesce(c1, ''), true); perform set_config('request.jwt.claim.sub', coalesce(c2, ''), true);
end $$;
revoke all on function public.demo_world_refresh() from public, anon, authenticated;

create or replace function public.demo_start() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid(); nid uuid; pk jsonb; t0 timestamptz := clock_timestamp();
  c1 text := current_setting('request.jwt.claims', true); c2 text := current_setting('request.jwt.claim.sub', true);
begin
  if me is null then raise exception 'login_required' using errcode = '42501'; end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) is not true then raise exception 'demo_only' using errcode = '42501'; end if;
  -- 이미 만든 체험 팀이 있으면 그 팀으로
  select team_id into nid from public.demo_teams where user_id = me order by created_at desc limit 1;
  if nid is not null and exists (select 1 from public.members where team_id = nid and user_id = me) then return nid; end if;
  perform public.demo_world_refresh();
  select pack into pk from public.demo_pack where k = 'team';
  if pk is null then raise exception 'no_template'; end if;
  pk := public.demo_resolve(pk::text, me)::jsonb;
  nid := gen_random_uuid();
  -- 만드는 일은 사용자 행동이 아니라서 사용자 규칙 검사(트리거)를 건너뛰게 이 요청의 로그인 정보를 비운다 (이 함수 안에서만)
  perform set_config('request.jwt.claims', '', true); perform set_config('request.jwt.claim.sub', '', true);
  insert into public.teams (id, name, created_by, invite_code) values (nid, coalesce(pk -> 'settings' ->> 'teamName', '체험 FC'), me, substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into auth.users (id) select (m ->> 'u')::uuid from jsonb_array_elements(pk -> 'members') m where (m ->> 'u')::uuid <> me on conflict (id) do nothing;
  insert into public.members (team_id, user_id, role, display_name) select nid, (m ->> 'u')::uuid, m ->> 'role', m ->> 'name' from jsonb_array_elements(pk -> 'members') m;
  insert into public.demo_teams (team_id, user_id) values (nid, me);
  insert into public.docs (team_id, coll, id, data) values (nid, 'team', 'settings', pk -> 'settings');
  insert into public.docs (team_id, coll, id, data) select nid, d ->> 'c', d ->> 'i', d -> 'x' from jsonb_array_elements(pk -> 'docs') d;
  insert into public.chat (team_id, room, user_id, name, body, kind, created_at)
    select nid, c ->> 'room', (c ->> 'u')::uuid, c ->> 'name', coalesce(c ->> 'body', ''), nullif(c ->> 'kind', ''), (c ->> 'at')::timestamptz from jsonb_array_elements(pk -> 'chat') c;
  -- 만드는 동안 생긴 알림은 보내지 않는다
  delete from public.push_outbox where team_id = nid and created_at >= t0;
  perform set_config('request.jwt.claims', coalesce(c1, ''), true); perform set_config('request.jwt.claim.sub', coalesce(c2, ''), true);
  return nid;
end $$;
revoke all on function public.demo_start() from public, anon;
grant execute on function public.demo_start() to authenticated;

-- 하루 지난 체험 팀 지우기 (매시간)
create or replace function public.demo_cleanup() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with d as (delete from public.teams where id in (select team_id from public.demo_teams where created_at < now() - interval '1 day') returning 1)
  select count(*) into n from d;
  return n;
end $$;
revoke all on function public.demo_cleanup() from public, anon, authenticated;
do $$ begin
  if to_regnamespace('cron') is not null then perform cron.schedule('mb-demo-cleanup', '17 * * * *', 'select public.demo_cleanup()'); end if;
end $$;
