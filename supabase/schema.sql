-- KEI FC 팀 매니저: Supabase 데이터 구조와 권한 규칙
-- Supabase 대시보드 > SQL Editor > New query 에 전체를 붙여 넣고 Run 하세요. 여러 번 실행해도 안전합니다.

create extension if not exists pgcrypto;

-- 팀과 멤버 --------------------------------------------------------------
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  display_name text not null default '' check (char_length(display_name) <= 30),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index if not exists members_user_idx on public.members(user_id);

-- 앱 데이터: 컬렉션/문서 구조 (선수, 일정, 회비, 벌금, 투표 등) -----------------
create table if not exists public.docs (
  team_id uuid not null references public.teams(id) on delete cascade,
  coll text not null check (coll in ('team','players','contacts','events','dues','fines','rsvp','mydues','payreq','notices','tally','uvote','guestreq')),
  id text not null check (id ~ '^[A-Za-z0-9_:.@+-]{1,80}$'),
  data jsonb not null default '{}'::jsonb check (octet_length(data::text) <= 262144),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (team_id, coll, id)
);
alter table public.docs replica identity full;

-- 권한 도우미 -----------------------------------------------------------------
create or replace function public.team_role(t uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from public.members where team_id = t and user_id = auth.uid()
$$;
create or replace function public.is_member(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where team_id = t and user_id = auth.uid())
$$;
create or replace function public.is_admin(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where team_id = t and user_id = auth.uid() and role in ('owner','admin'))
$$;

-- 행 단위 보안 ------------------------------------------------------------------
alter table public.teams enable row level security;
alter table public.members enable row level security;
alter table public.docs enable row level security;

drop policy if exists teams_read on public.teams;
create policy teams_read on public.teams for select to authenticated using (public.is_member(id));
drop policy if exists teams_update on public.teams;
create policy teams_update on public.teams for update to authenticated using (public.is_admin(id)) with check (public.is_admin(id));

drop policy if exists members_read on public.members;
create policy members_read on public.members for select to authenticated using (public.is_member(team_id));
-- 멤버 추가, 역할 변경, 내보내기는 아래 함수로만 한다 (직접 insert, update, delete 불가)

-- 운영진: 팀 문서 전체를 읽고 씀
-- 팀원: 공용 문서(설정, 선수, 일정, 참석, 공지, 집계)를 읽고, 자기 문서(rsvp, payreq, uvote, guestreq)만 씀
--       mydues는 자기 것만 읽음 (운영진이 맞춰 둠). 남의 벌금, 회비, 표는 못 읽음
drop policy if exists docs_read on public.docs;
create policy docs_read on public.docs for select to authenticated using (
  public.is_admin(team_id)
  or (public.is_member(team_id) and (
        coll in ('team','players','events','rsvp','notices','tally')
     or (coll in ('mydues','payreq','uvote','guestreq') and id = auth.uid()::text)))
);
drop policy if exists docs_insert on public.docs;
create policy docs_insert on public.docs for insert to authenticated with check (
  public.is_admin(team_id)
  or (public.is_member(team_id) and coll in ('rsvp','payreq','uvote','guestreq') and id = auth.uid()::text)
);
drop policy if exists docs_update on public.docs;
create policy docs_update on public.docs for update to authenticated using (
  public.is_admin(team_id)
  or (public.is_member(team_id) and coll in ('rsvp','payreq','uvote','guestreq') and id = auth.uid()::text)
) with check (
  public.is_admin(team_id)
  or (public.is_member(team_id) and coll in ('rsvp','payreq','uvote','guestreq') and id = auth.uid()::text)
);
drop policy if exists docs_delete on public.docs;
create policy docs_delete on public.docs for delete to authenticated using (
  public.is_admin(team_id)
  or (public.is_member(team_id) and coll in ('rsvp','payreq','uvote','guestreq') and id = auth.uid()::text)
);

-- 문서 일부만 고치기 (객체는 안쪽까지 합침) -----------------------------------------

create or replace function public.jsonb_deep_merge(a jsonb, b jsonb) returns jsonb
language sql immutable as $$
  select case
    when jsonb_typeof(a) = 'object' and jsonb_typeof(b) = 'object' then
      coalesce((select jsonb_object_agg(k,
                  case when jsonb_typeof(a -> k) = 'object' and jsonb_typeof(b -> k) = 'object' then public.jsonb_deep_merge(a -> k, b -> k)
                       when b ? k then b -> k
                       else a -> k end)
                from (select jsonb_object_keys(a) as k union select jsonb_object_keys(b)) s), '{}'::jsonb)
    else b end
$$;

create or replace function public.doc_patch(p_team uuid, p_coll text, p_id text, p_patch jsonb) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare out jsonb; at timestamptz;
begin
  update public.docs set data = public.jsonb_deep_merge(data, p_patch)
   where team_id = p_team and coll = p_coll and id = p_id
   returning data, updated_at into out, at;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  return jsonb_build_object('data', out, 'at', at);
end $$;

-- 고친 시각과 고친 사람은 서버가 적는다. 집계(tally)에는 누가 고쳤는지 남기지 않는다
create or replace function public.docs_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := clock_timestamp();
  new.updated_by := case when new.coll = 'tally' then null else auth.uid() end;
  return new;
end $$;
drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before insert or update on public.docs for each row execute function public.docs_touch();

-- MOM, 설문, 읽음 집계: 표가 바뀔 때마다 서버에서 다시 셈 ------------------------------
-- 집계에는 '몇 명이 누구를 골랐는지'만 들어가고, '누가 누구를 골랐는지'는 들어가지 않는다
create or replace function public.recount_tally(t uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  with v as (
    select 'mom-' || x.k as key, d.id as u, x.v as val
      from public.docs d cross join lateral jsonb_each_text(case when jsonb_typeof(d.data -> 'mom') = 'object' then d.data -> 'mom' else '{}'::jsonb end) x(k, v)
     where d.team_id = t and d.coll = 'uvote' and coalesce(x.v, '') <> ''
       and exists (select 1 from public.docs e where e.team_id = t and e.coll = 'events' and e.id = x.k)
    union all
    select 'poll-' || x.k, d.id, x.v
      from public.docs d cross join lateral jsonb_each_text(case when jsonb_typeof(d.data -> 'poll') = 'object' then d.data -> 'poll' else '{}'::jsonb end) x(k, v)
     where d.team_id = t and d.coll = 'uvote' and coalesce(x.v, '') <> ''
       and exists (select 1 from public.docs n where n.team_id = t and n.coll = 'notices' and n.id = x.k)
    union all
    select 'seen-' || x.k, d.id, ''
      from public.docs d cross join lateral jsonb_object_keys(case when jsonb_typeof(d.data -> 'seen') = 'object' then d.data -> 'seen' else '{}'::jsonb end) x(k)
     where d.team_id = t and d.coll = 'uvote'
       and exists (select 1 from public.docs n where n.team_id = t and n.coll = 'notices' and n.id = x.k)
  ),
  agg as (
    select key, count(*)::int as n,
           coalesce((select jsonb_object_agg(val, c) from (select val, count(*)::int as c from v v2 where v2.key = v1.key and val <> '' group by val) cc), '{}'::jsonb) as c,
           jsonb_agg(u order by u) as voters
      from v v1 group by key
  ),
  up as (
    insert into public.docs (team_id, coll, id, data, updated_by)
    select t, 'tally', key, jsonb_build_object('n', n, 'c', c, 'v', voters, 'at', now()), null from agg
    on conflict (team_id, coll, id) do update set data = excluded.data, updated_at = now()
      where (public.docs.data - 'at') is distinct from (excluded.data - 'at')
    returning id
  )
  update public.docs set data = jsonb_build_object('n', 0, 'c', '{}'::jsonb, 'v', '[]'::jsonb, 'at', now()), updated_at = now()
   where team_id = t and coll = 'tally' and coalesce((data ->> 'n')::int, 0) > 0
     and id not in (select key from agg);
end $$;

create or replace function public.on_uvote_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.recount_tally(coalesce(new.team_id, old.team_id));
  return null;
end $$;
drop trigger if exists uvote_recount on public.docs;
drop trigger if exists uvote_recount_iu on public.docs;
create trigger uvote_recount_iu after insert or update on public.docs
  for each row when (new.coll = 'uvote') execute function public.on_uvote_change();
-- 표를 지우거나, 일정이나 공지를 지우면 그 집계도 다시 맞춘다
drop trigger if exists uvote_recount_d on public.docs;
create trigger uvote_recount_d after delete on public.docs
  for each row when (old.coll in ('uvote', 'events', 'notices')) execute function public.on_uvote_change();

-- 팀 만들기, 초대 코드로 들어가기, 역할 바꾸기 ---------------------------------------
create or replace function public.my_name() returns text
language sql stable security definer set search_path = public as $$
  select left(coalesce(nullif(u.raw_user_meta_data ->> 'name', ''), nullif(u.raw_user_meta_data ->> 'full_name', ''), nullif(u.raw_user_meta_data ->> 'nickname', ''), split_part(u.email, '@', 1), '팀원'), 30)
    from auth.users u where u.id = auth.uid()
$$;

create or replace function public.create_team(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  insert into public.teams (name, created_by) values (left(trim(p_name), 40), auth.uid()) returning id into tid;
  insert into public.members (team_id, user_id, role, display_name) values (tid, auth.uid(), 'owner', coalesce(public.my_name(), ''));
  insert into public.docs (team_id, coll, id, data) values (tid, 'team', 'settings', jsonb_build_object('teamName', left(trim(p_name), 40), 'cap', 14, 'fee', 20000));
  return tid;
end $$;

create or replace function public.team_by_code(p_code text) returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
  select id, name from public.teams where invite_code = p_code
$$;

create or replace function public.join_team(p_code text, p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare tid uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select id into tid from public.teams where invite_code = p_code;
  if tid is null then raise exception 'bad_code'; end if;
  insert into public.members (team_id, user_id, role, display_name)
  values (tid, auth.uid(), 'member', left(coalesce(nullif(trim(p_name), ''), public.my_name(), ''), 30))
  on conflict (team_id, user_id) do nothing;
  return tid;
end $$;

create or replace function public.set_my_name(p_team uuid, p_name text) returns void
language sql security definer set search_path = public as $$
  update public.members set display_name = left(trim(p_name), 30) where team_id = p_team and user_id = auth.uid()
$$;

create or replace function public.set_member_role(p_team uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.team_role(p_team), '') <> 'owner' then raise exception 'owner_only'; end if;
  if p_user = auth.uid() then raise exception 'not_self'; end if;
  if p_role not in ('admin', 'member') then raise exception 'bad_role'; end if;
  update public.members set role = p_role where team_id = p_team and user_id = p_user;
end $$;

create or replace function public.remove_member(p_team uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_user = auth.uid() then
    if coalesce(public.team_role(p_team), '') = 'owner' then raise exception 'owner_cannot_leave'; end if;
  elsif coalesce(public.team_role(p_team), '') <> 'owner' then raise exception 'owner_only'; end if;
  delete from public.members where team_id = p_team and user_id = p_user;
end $$;

create or replace function public.new_invite_code(p_team uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
begin
  if not public.is_admin(p_team) then raise exception 'admin_only'; end if;
  update public.teams set invite_code = c where id = p_team;
  return c;
end $$;

-- 함수와 표 권한: 로그인한 사람만, 필요한 만큼만 (Supabase 기본 권한을 먼저 거둔다)
revoke execute on all functions in schema public from public, anon, authenticated;
revoke all on public.teams, public.members, public.docs from anon, authenticated;
revoke all on function public.recount_tally(uuid) from public, anon, authenticated;
revoke all on function public.on_uvote_change() from public, anon, authenticated;
grant execute on function public.create_team(text), public.join_team(text, text), public.team_by_code(text), public.set_my_name(uuid, text),
  public.set_member_role(uuid, uuid, text), public.remove_member(uuid, uuid), public.new_invite_code(uuid), public.doc_patch(uuid, text, text, jsonb),
  public.team_role(uuid), public.is_member(uuid), public.is_admin(uuid), public.jsonb_deep_merge(jsonb, jsonb) to authenticated;
-- 로그인 전 화면에서도 초대받은 팀 이름을 보여 준다 (코드를 아는 사람만)
grant execute on function public.team_by_code(text) to anon;
grant select, update (name) on public.teams to authenticated;
grant select on public.members to authenticated;
grant select, insert, update, delete on public.docs to authenticated;

-- 실시간 반영 ------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'docs') then
    alter publication supabase_realtime add table public.docs;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'members') then
    alter publication supabase_realtime add table public.members;
  end if;
end $$;
