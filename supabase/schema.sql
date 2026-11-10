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
  coll text not null check (coll in ('team','players','contacts','events','dues','fines','rsvp','mydues','payreq','notices','tally','uvote','guestreq','gone')),
  id text not null check (id ~ '^[A-Za-z0-9_:.@+-]{1,80}$'),
  data jsonb not null default '{}'::jsonb check (octet_length(data::text) <= 262144),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (team_id, coll, id)
);
alter table public.docs replica identity full;
-- 지운 문서 알림(gone)을 받을 수 있게 종류 목록을 넓힌다 (이미 만든 표에도 적용)
alter table public.docs drop constraint if exists docs_coll_check;
alter table public.docs add constraint docs_coll_check check (coll in ('team','players','contacts','events','dues','fines','rsvp','mydues','payreq','notices','tally','uvote','guestreq','gone'));

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
        coll in ('team','players','events','rsvp','notices','tally','gone')
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
-- 팀원이 지울 수 있는 건 입금 요청과 용병 요청뿐이다 (참석 기록과 MOM 표는 지워서 되돌릴 수 없다)
create policy docs_delete on public.docs for delete to authenticated using (
  public.is_admin(team_id)
  or (public.is_member(team_id) and coll in ('payreq','guestreq') and id = auth.uid()::text)
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
           case when key like 'seen-%' then jsonb_agg(u order by u) else '[]'::jsonb end as voters
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
  if (select count(*) from public.teams where created_by = auth.uid()) >= 5 then raise exception 'team_limit'; end if;
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

-- 관리자 신청: 팀원이 스스로 신청하고, 팀장만 수락하거나 거절한다 ----------------------
alter table public.members add column if not exists admin_req timestamptz;

create or replace function public.request_admin(p_team uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.team_role(p_team), '') <> 'member' then raise exception 'member_only'; end if;
  update public.members set admin_req = now() where team_id = p_team and user_id = auth.uid();
end $$;

create or replace function public.cancel_admin_request(p_team uuid) returns void
language sql security definer set search_path = public as $$
  update public.members set admin_req = null where team_id = p_team and user_id = auth.uid()
$$;

create or replace function public.answer_admin_request(p_team uuid, p_user uuid, p_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.team_role(p_team), '') <> 'owner' then raise exception 'owner_only'; end if;
  update public.members set role = case when p_ok then 'admin' else role end, admin_req = null
   where team_id = p_team and user_id = p_user and role = 'member' and admin_req is not null;
  if not found then raise exception 'no_request'; end if;
end $$;

create or replace function public.set_member_role(p_team uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.team_role(p_team), '') <> 'owner' then raise exception 'owner_only'; end if;
  if p_user = auth.uid() then raise exception 'not_self'; end if;
  if p_role not in ('admin', 'member') then raise exception 'bad_role'; end if;
  update public.members set role = p_role, admin_req = null where team_id = p_team and user_id = p_user;
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

-- 보안 보강 (2026-11-10) ------------------------------------------------------
-- 일정 시작 시각 (한국 시간). 시간이 없으면 그날 23:59
create or replace function public.event_start(ev jsonb) returns timestamptz
language sql immutable as $$
  select ((ev ->> 'date') || ' ' || case when coalesce(ev ->> 'time', '') ~ '^\d{2}:\d{2}$' then ev ->> 'time' else '23:59' end)::timestamp at time zone 'Asia/Seoul'
$$;

-- 팀원이 쓰는 문서(참석, MOM, 설문)의 규칙을 서버에서 지킨다. 운영진은 그대로 쓴다
create or replace function public.docs_member_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op = 'UPDATE' then old.data else '{}'::jsonb end;
  n jsonb := new.data;
  k text; ne jsonb; oe jsonb; ev jsonb; nowiso text; keep_at text; pid text;
begin
  if auth.uid() is null or public.is_admin(new.team_id) then return new; end if;
  nowiso := to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  if new.coll = 'rsvp' then
    pid := coalesce(n ->> 'pid', '');
    -- 선수 연결: 비어 있을 때만, 다른 계정이 연결한 선수는 못 고른다
    if pid <> coalesce(o ->> 'pid', '') and pid <> '' then
      if coalesce(o ->> 'pid', '') <> '' then raise exception 'pid_locked' using errcode = '42501'; end if;
      if not exists (select 1 from public.docs where team_id = new.team_id and coll = 'players' and id = pid) then raise exception 'no_player' using errcode = '42501'; end if;
      if exists (select 1 from public.docs where team_id = new.team_id and coll = 'rsvp' and id <> new.id and data ->> 'pid' = pid) then raise exception 'pid_taken' using errcode = '42501'; end if;
    end if;
    -- 포지션 변경 요청은 본인이 승인하거나 반려할 수 없다
    if jsonb_typeof(n -> 'posReq') = 'object' and (n -> 'posReq' ->> 'status') is distinct from (o -> 'posReq' ->> 'status')
       and coalesce(n -> 'posReq' ->> 'status', 'req') <> 'req' then raise exception 'not_allowed' using errcode = '42501'; end if;
    -- 참석 응답: 경기 시작 전까지, 순서와 시각은 서버가 적는다
    if jsonb_typeof(n -> 'ev') = 'object' then
      for k, ne in select * from jsonb_each(n -> 'ev') loop
        oe := o -> 'ev' -> k;
        if ne is not distinct from oe then continue; end if;
        if jsonb_typeof(ne) <> 'object' then raise exception 'bad_vote' using errcode = '42501'; end if;
        select data into ev from public.docs where team_id = new.team_id and coll = 'events' and id = k;
        if ev is null then raise exception 'no_event' using errcode = '42501'; end if;
        if clock_timestamp() >= public.event_start(ev) then raise exception 'vote_closed' using errcode = '42501'; end if;
        if coalesce(ne ->> 's', '') not in ('yes', 'late', 'no', '') then raise exception 'bad_vote' using errcode = '42501'; end if;
        if coalesce(ne ->> 'q', '0') !~ '^[0-8]$' then raise exception 'bad_vote' using errcode = '42501'; end if;
        ne := jsonb_set(ne, '{upd}', to_jsonb(nowiso));
        if ne ->> 's' in ('yes', 'late') then
          keep_at := case when jsonb_typeof(oe) = 'object' and oe ->> 's' in ('yes', 'late') then nullif(oe ->> 'at', '') end;
          if keep_at is null and ev -> 'att' ->> pid in ('yes', 'late') then keep_at := nullif(ev -> 'attAt' ->> pid, ''); end if;
          ne := jsonb_set(ne, '{at}', to_jsonb(coalesce(keep_at, nowiso)));
        else
          ne := jsonb_set(ne, '{at}', '""'::jsonb);
          if ne ->> 's' = 'no' and ((jsonb_typeof(oe) = 'object' and oe ->> 's' in ('yes', 'late')) or (jsonb_typeof(oe) is distinct from 'object' and ev -> 'att' ->> pid in ('yes', 'late'))) then
            ne := jsonb_set(ne, '{cancelAt}', to_jsonb(nowiso));
          elsif jsonb_typeof(oe) = 'object' then
            ne := jsonb_set(jsonb_set(ne, '{cancelAt}', coalesce(oe -> 'cancelAt', '""'::jsonb)), '{cancelIn}', coalesce(oe -> 'cancelIn', 'false'::jsonb));
          end if;
        end if;
        n := jsonb_set(n, array['ev', k], ne);
      end loop;
    end if;
  elsif new.coll = 'uvote' then
    -- MOM: 경기 뒤부터 다음 날 12시까지, 한 번만
    if jsonb_typeof(n -> 'mom') = 'object' then
      for k, ne in select * from jsonb_each(n -> 'mom') loop
        oe := o -> 'mom' -> k;
        if ne is not distinct from oe then continue; end if;
        if coalesce(oe #>> '{}', '') <> '' then raise exception 'mom_locked' using errcode = '42501'; end if;
        select data into ev from public.docs where team_id = new.team_id and coll = 'events' and id = k;
        if ev is null or coalesce(ev ->> 'type', '') not in ('match', 'scrim') then raise exception 'no_event' using errcode = '42501'; end if;
        if clock_timestamp() < public.event_start(ev)
           or clock_timestamp() >= (((ev ->> 'date')::date + 1) + time '12:00') at time zone 'Asia/Seoul' then raise exception 'mom_closed' using errcode = '42501'; end if;
        if coalesce(ne #>> '{}', '') <> '' and not exists (select 1 from public.members where team_id = new.team_id and user_id::text = ne #>> '{}') then raise exception 'no_player' using errcode = '42501'; end if;
      end loop;
    end if;
    -- 낸 MOM 표는 지우거나 빼서 되돌릴 수 없다
    for k, oe in select * from jsonb_each(case when jsonb_typeof(o -> 'mom') = 'object' then o -> 'mom' else '{}'::jsonb end) loop
      if coalesce(oe #>> '{}', '') <> '' and coalesce(n -> 'mom' ->> k, '') = '' then raise exception 'mom_locked' using errcode = '42501'; end if;
    end loop;
    -- 설문: 마감 전까지, 있는 보기만
    if jsonb_typeof(n -> 'poll') = 'object' then
      for k, ne in select * from jsonb_each(n -> 'poll') loop
        oe := o -> 'poll' -> k;
        if ne is not distinct from oe then continue; end if;
        select data into ev from public.docs where team_id = new.team_id and coll = 'notices' and id = k;
        if ev is null or jsonb_typeof(ev -> 'poll') <> 'object' then raise exception 'no_poll' using errcode = '42501'; end if;
        if coalesce(ev -> 'poll' ->> 'until', '') <> '' and clock_timestamp() >= (ev -> 'poll' ->> 'until')::timestamptz then raise exception 'poll_closed' using errcode = '42501'; end if;
        if coalesce(ne #>> '{}', '') <> '' and not exists (select 1 from jsonb_array_elements(coalesce(ev -> 'poll' -> 'opts', '[]'::jsonb)) x where x ->> 'id' = ne #>> '{}') then raise exception 'no_option' using errcode = '42501'; end if;
      end loop;
    end if;
  end if;
  new.data := n;
  return new;
end $$;
drop trigger if exists docs_member_guard on public.docs;
create trigger docs_member_guard before insert or update on public.docs
  for each row when (new.coll in ('rsvp', 'uvote')) execute function public.docs_member_guard();

-- 지운 문서와 내보낸 멤버를 같은 팀 사람에게만 알린다 (실시간 삭제 알림은 다른 팀에도 키가 가므로 쓰지 않는다)
create or replace function public.docs_gone() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if tg_table_name = 'members' then
      insert into public.docs (team_id, coll, id, data) values (old.team_id, 'gone', left('member:' || old.user_id::text, 80), jsonb_build_object('at', now()))
      on conflict (team_id, coll, id) do update set data = excluded.data;
    elsif old.coll <> 'gone' then
      insert into public.docs (team_id, coll, id, data) values (old.team_id, 'gone', left(old.coll || ':' || old.id, 80), jsonb_build_object('at', now()))
      on conflict (team_id, coll, id) do update set data = excluded.data;
    end if;
    delete from public.docs where team_id = old.team_id and coll = 'gone' and updated_at < now() - interval '30 days';
  exception when foreign_key_violation then null; -- 팀째 지우는 중
  end;
  return null;
end $$;
drop trigger if exists docs_gone on public.docs;
create trigger docs_gone after delete on public.docs for each row when (old.coll <> 'gone') execute function public.docs_gone();
drop trigger if exists members_gone on public.members;
create trigger members_gone after delete on public.members for each row execute function public.docs_gone();
-- 다시 쓰인 문서는 지움 표시를 걷는다
create or replace function public.docs_ungone() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.docs where team_id = new.team_id and coll = 'gone' and id = left(new.coll || ':' || new.id, 80);
  return null;
end $$;
drop trigger if exists docs_ungone on public.docs;
create trigger docs_ungone after insert on public.docs for each row when (new.coll <> 'gone') execute function public.docs_ungone();

-- 초대 코드는 운영진만
create or replace function public.team_invite_code(p_team uuid) returns text
language sql stable security definer set search_path = public as $$
  select invite_code from public.teams where id = p_team and public.is_admin(p_team)
$$;

-- 팀장 넘기기: 팀장만, 팀 안의 멤버에게. 넘긴 사람은 운영진이 된다
create or replace function public.transfer_owner(p_team uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.team_role(p_team), '') <> 'owner' then raise exception 'owner_only'; end if;
  if p_user = auth.uid() then raise exception 'not_self'; end if;
  if not exists (select 1 from public.members where team_id = p_team and user_id = p_user) then raise exception 'no_member'; end if;
  update public.members set role = 'admin' where team_id = p_team and user_id = auth.uid();
  update public.members set role = 'owner', admin_req = null where team_id = p_team and user_id = p_user;
end $$;

-- 회원 탈퇴: 내 계정과 내가 쓴 개인 문서를 지운다. 팀원이 남은 팀의 팀장은 먼저 팀장을 넘겨야 한다
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if exists (select 1 from public.members m where m.user_id = me and m.role = 'owner'
             and exists (select 1 from public.members x where x.team_id = m.team_id and x.user_id <> me)) then
    raise exception 'owner_has_members';
  end if;
  delete from public.teams where id in (select team_id from public.members where user_id = me and role = 'owner');
  delete from public.docs where coll in ('rsvp', 'mydues', 'payreq', 'uvote', 'guestreq') and id = me::text;
  delete from public.members where user_id = me;
  delete from auth.users where id = me;
end $$;

-- 팀 지우기: 팀장만. 일정, 참석, 회비, 멤버가 모두 함께 지워진다
create or replace function public.delete_team(p_team uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.team_role(p_team), '') <> 'owner' then raise exception 'owner_only'; end if;
  delete from public.teams where id = p_team;
end $$;

-- 함수와 표 권한: 로그인한 사람만, 필요한 만큼만 (Supabase 기본 권한을 먼저 거둔다)
revoke execute on all functions in schema public from public, anon, authenticated;
revoke all on public.teams, public.members, public.docs from anon, authenticated;
revoke all on function public.recount_tally(uuid) from public, anon, authenticated;
revoke all on function public.on_uvote_change() from public, anon, authenticated;
revoke all on function public.docs_member_guard(), public.docs_gone(), public.docs_ungone(), public.event_start(jsonb) from public, anon, authenticated;
grant execute on function public.create_team(text), public.join_team(text, text), public.team_by_code(text), public.set_my_name(uuid, text),
  public.set_member_role(uuid, uuid, text), public.remove_member(uuid, uuid), public.new_invite_code(uuid), public.doc_patch(uuid, text, text, jsonb),
  public.team_role(uuid), public.is_member(uuid), public.is_admin(uuid), public.jsonb_deep_merge(jsonb, jsonb),
  public.request_admin(uuid), public.cancel_admin_request(uuid), public.answer_admin_request(uuid, uuid, boolean),
  public.team_invite_code(uuid), public.transfer_owner(uuid, uuid), public.delete_my_account(), public.delete_team(uuid) to authenticated;
-- 로그인 전 화면에서도 초대받은 팀 이름을 보여 준다 (코드를 아는 사람만)
grant execute on function public.team_by_code(text) to anon;
-- 초대 코드는 운영진만 (team_invite_code 함수로) 본다
revoke select on public.teams from authenticated;
grant select (id, name, created_by, created_at), update (name) on public.teams to authenticated;
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

-- 예전 집계에 남아 있던 투표자 목록을 지우도록 모든 팀의 집계를 한 번 다시 센다
do $$ declare t uuid; begin
  for t in select id from public.teams loop perform public.recount_tally(t); end loop;
end $$;
