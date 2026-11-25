-- 테스트 사이트 전용: 로그인 없이 체험하기 (운영에는 넣지 않는다)
-- 카카오 로그인 없이 들어온 사람(Supabase 익명 로그인)마다 TEST FC를 복사한 자기만의 체험 팀을 만들어 준다.
-- 체험하는 사람은 그 팀의 Admin이라 팀원, 운영진, Admin 기능을 모두 써 볼 수 있다. 다른 사람의 체험 팀이나 원본 TEST FC는 건드리지 못한다.
-- 원본의 Admin(실제 계정)은 복사본에서 체험하는 사람으로 바뀌고 이름도 "체험 운영진"이 된다. 가짜 팀원 26명은 그대로 복사한다.
-- 체험 팀은 만든 지 하루가 지나면 지운다.

create table if not exists public.demo_teams (
  team_id uuid primary key references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists demo_teams_user_idx on public.demo_teams(user_id);
alter table public.demo_teams enable row level security;
revoke all on public.demo_teams from public, anon, authenticated;

create or replace function public.demo_start() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  tpl constant uuid := '7e57fc00-0000-4000-8000-000000000001'; -- TEST FC (seed_testfc.py)
  owner uuid; nid uuid; nm text;
  c1 text := current_setting('request.jwt.claims', true); c2 text := current_setting('request.jwt.claim.sub', true);
begin
  if me is null then raise exception 'login_required' using errcode = '42501'; end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) is not true then raise exception 'demo_only' using errcode = '42501'; end if;
  -- 이미 만든 체험 팀이 있으면 그 팀으로
  select team_id into nid from public.demo_teams where user_id = me order by created_at desc limit 1;
  if nid is not null and exists (select 1 from public.members where team_id = nid and user_id = me) then return nid; end if;
  select user_id into owner from public.members where team_id = tpl and role = 'owner' limit 1;
  if owner is null then raise exception 'no_template'; end if;
  nid := gen_random_uuid(); nm := '체험 운영진';
  -- 복사는 사용자 행동이 아니라서 사용자 규칙 검사(트리거)를 건너뛰게 이 요청의 로그인 정보를 비운다 (이 함수 안에서만)
  perform set_config('request.jwt.claims', '', true); perform set_config('request.jwt.claim.sub', '', true);
  insert into public.teams select (jsonb_populate_record(null::public.teams, to_jsonb(t) || jsonb_build_object(
    'id', nid, 'created_by', me, 'created_at', now(), 'invite_code', substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)))).*
  from public.teams t where t.id = tpl;
  insert into public.members select (jsonb_populate_record(null::public.members, to_jsonb(m) || jsonb_build_object(
    'team_id', nid, 'user_id', case when m.user_id = owner then me else m.user_id end,
    'display_name', case when m.user_id = owner then nm else m.display_name end, 'joined_at', now()))).*
  from public.members m where m.team_id = tpl;
  insert into public.demo_teams (team_id, user_id) values (nid, me);
  -- 문서: 원본 Admin의 계정 번호와 이름을 체험하는 사람으로 바꿔서 복사
  insert into public.docs select (jsonb_populate_record(null::public.docs, to_jsonb(d) || jsonb_build_object(
    'team_id', nid, 'id', replace(d.id, owner::text, me::text),
    'data', replace(replace(d.data::text, owner::text, me::text), '정성목', nm)::jsonb))).*
  from public.docs d where d.team_id = tpl;
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
