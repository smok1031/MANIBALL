-- 2026-11-25 시안 반영 (테스트 서버 먼저)
-- 1) 역할은 운영진과 팀원 둘: Admin(owner)이 하던 일은 운영진 누구나. 운영진이 다른 운영진을 내리거나 내보내면 운영진 모두에게 알림
--    팀 지우기는 매니볼에 요청해서만. 마지막 운영진이 나갈 때 규칙은 나중에 정하고, 지금은 마지막 운영진은 나갈 수 없다
-- 2) 대화: 경기 방은 투표 마감 때(마감이 경기 24시간 전보다 늦으면 24시간 전) 열리고, 참석한 사람(정원 안)과 운영진, 받은 용병이 들어온다
--    팀원만 있는 전체 대화방(all), 양 팀 운영진만 있는 매칭 방(m-일정), 불참으로 바꾸면 나감 안내, 용병 들어옴 안내
--    대화 알림: 기본은 나를 부른 글(@이름)과 운영진 글. 모든 글, 끔. 전체 대화방은 기본 꺼짐
-- 3) 대기에서 자리가 나면 먼저 묻는다: 답 기한 안에 '갈게요'면 참석, '못 가요'나 기한 지남은 벌금 없이 대기에서 빠진다
--    경기 1시간 전부터는 대기자 모두에게 동시에 묻고 먼저 누른 사람이 들어간다
-- 4) 공지 투표: 여러 개 고르기, 이름 공개는 켰을 때만(운영진은 늘), 안 고른 사람(운영진만), 다시 알리기, 마감 하루 전 자동 알림
-- 5) 투표 마감: 경기 N일 전(당일 ~ 14일) 오전/오후 몇 시 (voteClose = 'days')
-- 여러 번 실행해도 안전하다.

-- ===== 5) 투표 마감 N일 전
create or replace function public.vote_deadline(ev jsonb) returns timestamptz
language sql stable set search_path = '' as $$
  select least(public.event_start(ev), case
    when ev ->> 'voteClose' = 'days' then
      (((ev ->> 'date')::date - least(14, greatest(0, case when coalesce(ev ->> 'voteDays', '') ~ '^\d{1,2}$' then (ev ->> 'voteDays')::int else 1 end)))
        + (case when coalesce(ev ->> 'voteTime', '') ~ '^\d\d:\d\d$' then (ev ->> 'voteTime')::time else time '21:00' end)) at time zone 'Asia/Seoul'
    when ev ->> 'voteClose' in ('eve', 'eve21') then
      (((ev ->> 'date')::date - 1) + (case when ev ->> 'voteClose' = 'eve' and coalesce(ev ->> 'voteTime', '') ~ '^\d\d:\d\d$' then (ev ->> 'voteTime')::time else time '21:00' end)) at time zone 'Asia/Seoul'
    when ev ->> 'voteClose' = 'day06' then (((ev ->> 'date')::date) + time '06:00') at time zone 'Asia/Seoul'
    else public.event_start(ev) end)
$$;
revoke all on function public.vote_deadline(jsonb) from public, anon, authenticated;

-- ===== 1) 역할
create or replace function public.team_policy_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op = 'UPDATE' then old.data else '{}'::jsonb end;
  k text;
begin
  if new.coll <> 'team' or new.id <> 'settings' or auth.uid() is null then return new; end if;
  if coalesce(o ->> 'sport', '') <> '' and (new.data ->> 'sport') is distinct from (o ->> 'sport') then raise exception 'sport_locked' using errcode = '42501'; end if;
  if public.is_admin(new.team_id) then return new; end if;
  foreach k in array array['voteClose', 'voteTime', 'voteDays', 'cap', 'waitCap', 'checkBefore', 'scrimMin', 'scrimDays', 'fineFrom', 'fineDays', 'fineAp', 'fineHour', 'joinApproval', 'teamName'] loop
    if (new.data -> k) is distinct from (o -> k) then raise exception 'admin_only' using errcode = '42501'; end if;
  end loop;
  return new;
end $$;
revoke all on function public.team_policy_guard() from public, anon, authenticated;

create or replace function public.role_notice(p_team uuid, p_text text, p_key text) returns void
language plpgsql security definer set search_path = public as $$
declare tn text;
begin
  if to_regprocedure('public.push_add(uuid, uuid[], text, text, text, text, text)') is null then return; end if;
  select name into tn from public.teams where id = p_team;
  perform public.push_add(p_team, public.push_admins(p_team), 'role', coalesce(tn, '매니볼'), p_text, '#/members', p_key);
exception when others then raise warning 'role_notice: %', sqlerrm;
end $$;
revoke all on function public.role_notice(uuid, text, text) from public, anon, authenticated;

create or replace function public.set_member_role(p_team uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare them text; who text; nm text;
begin
  if not public.is_admin(p_team) then raise exception 'admin_only'; end if;
  if p_user = auth.uid() then raise exception 'not_self'; end if;
  if p_role not in ('admin', 'member') then raise exception 'bad_role'; end if;
  select role, display_name into them, who from public.members where team_id = p_team and user_id = p_user;
  if them is null then raise exception 'no_member'; end if;
  if (them in ('owner', 'admin')) = (p_role = 'admin') then return; end if;
  update public.members set role = p_role, admin_req = null where team_id = p_team and user_id = p_user;
  select display_name into nm from public.members where team_id = p_team and user_id = auth.uid();
  perform public.role_notice(p_team, coalesce(nullif(nm, ''), '운영진') || ' 님이 ' || coalesce(nullif(who, ''), '팀원') || ' 님을 '
    || case when p_role = 'admin' then '운영진으로 정했어요' else '팀원으로 내렸어요' end, 'role:' || p_team || ':' || p_user || ':' || p_role || ':' || floor(extract(epoch from now()) / 60));
end $$;

create or replace function public.remove_member(p_team uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me text := coalesce(public.team_role(p_team), ''); them text; who text; nm text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_user = auth.uid() then
    -- 마지막 운영진은 나갈 수 없다 (규칙은 나중에 정함)
    if me in ('owner', 'admin') and not exists (select 1 from public.members where team_id = p_team and user_id <> p_user and role in ('owner', 'admin')) then
      raise exception 'last_admin';
    end if;
  else
    select role, display_name into them, who from public.members where team_id = p_team and user_id = p_user;
    if them is null then raise exception 'no_member'; end if;
    if me not in ('owner', 'admin') then raise exception 'kick_denied'; end if;
  end if;
  delete from public.members where team_id = p_team and user_id = p_user;
  if p_user <> auth.uid() then
    select display_name into nm from public.members where team_id = p_team and user_id = auth.uid();
    perform public.role_notice(p_team, coalesce(nullif(nm, ''), '운영진') || ' 님이 ' || coalesce(nullif(who, ''), '팀원') || ' 님을 팀에서 내보냈어요',
      'kick:' || p_team || ':' || p_user || ':' || floor(extract(epoch from now()) / 60));
  end if;
end $$;

create or replace function public.leave_team_as_owner(p_team uuid, p_next uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(p_team) then raise exception 'admin_only'; end if;
  if p_next = auth.uid() then raise exception 'not_self'; end if;
  if not exists (select 1 from public.members where team_id = p_team and user_id = p_next) then raise exception 'no_member'; end if;
  update public.members set role = 'admin', admin_req = null where team_id = p_team and user_id = p_next and role = 'member';
  delete from public.members where team_id = p_team and user_id = auth.uid();
end $$;

-- 팀 지우기는 매니볼 개발자에게 요청해서만 (요청은 submit_inquiry의 delete_team)
create or replace function public.delete_team(p_team uuid) returns void
language plpgsql security definer set search_path = public as $$
begin raise exception 'ask_maniball'; end $$;
create or replace function public.delete_team_with_review(p_team uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
begin raise exception 'ask_maniball'; end $$;

create or replace function public.submit_inquiry(p_team uuid, p_kind text, p_body text, p_contact text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_kind not in ('delete_team', 'etc') then raise exception 'bad_kind'; end if;
  if p_kind = 'delete_team' and not public.is_admin(p_team) then raise exception 'admin_only'; end if;
  if length(trim(coalesce(p_body, ''))) < 2 or length(p_body) > 1000 or length(coalesce(p_contact, '')) > 100 then raise exception 'bad_inquiry'; end if;
  if (select count(*) from public.inquiries where user_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then raise exception 'inquiry_limit'; end if;
  insert into public.inquiries (team_id, user_id, kind, body, contact) values (p_team, auth.uid(), p_kind, trim(p_body), trim(coalesce(p_contact, '')));
end $$;

-- ===== 운영진만 보는 집계 문서(atally): 공지 투표에서 누가 무엇을 골랐는지, 안 고른 사람
do $$ begin
  alter table public.docs drop constraint if exists docs_coll_check;
  alter table public.docs add constraint docs_coll_check check (coll = any (array['team', 'players', 'contacts', 'events', 'dues', 'fines', 'rsvp', 'mydues', 'payreq', 'notices', 'tally', 'uvote', 'guestreq', 'gone', 'atally']));
end $$;

-- ===== 2) 대화
alter table public.chat add column if not exists kind text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'chat_kind_ok') then
    alter table public.chat add constraint chat_kind_ok check (kind is null or kind in ('left', 'join', 'merc'));
  end if;
end $$;

-- 경기 방이 열리는 시각: 투표 마감, 마감이 경기 24시간 전보다 늦으면 24시간 전
create or replace function public.chat_open_at(ev jsonb) returns timestamptz
language sql stable set search_path = '' as $$
  select least(public.vote_deadline(ev), public.event_start(ev) - interval '24 hours')
$$;
revoke all on function public.chat_open_at(jsonb) from public, anon, authenticated;

-- 방에 글을 쓸 수 있는지(열려 있는지). 끝난 방(일정 날짜가 지남)과 취소된 방은 읽기만
create or replace function public.chat_room_open(t uuid, r text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when r = 'all' then exists (select 1 from public.teams where id = t)
    when r like 'm-%' then exists (select 1 from public.docs d where d.team_id = t and d.coll = 'events' and d.id = substr(r, 3)
      and jsonb_typeof(d.data -> 'xmatch') = 'object' and coalesce(d.data -> 'cancel' ->> 'at', '') = ''
      and coalesce(d.data ->> 'date', '') ~ '^\d{4}-\d{2}-\d{2}$' and (d.data ->> 'date')::date >= (now() at time zone 'Asia/Seoul')::date)
    else exists (select 1 from public.docs d where d.team_id = t and d.coll = 'events' and d.id = r
      and coalesce(d.data -> 'cancel' ->> 'at', '') = ''
      and coalesce(d.data ->> 'date', '') ~ '^\d{4}-\d{2}-\d{2}$'
      and (d.data ->> 'date')::date >= (now() at time zone 'Asia/Seoul')::date
      and now() >= public.chat_open_at(d.data))
  end
$$;

-- 정원 안인지: 참석, 늦참을 먼저 낸 순서(at)로 세고 받은 용병(inCap)도 센다. 앱의 계산과 같다
create or replace function public.in_cap_at(t uuid, eid text, u text, my_at text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare ev jsonb; cap int; ahead int;
begin
  select data into ev from public.docs where team_id = t and coll = 'events' and id = eid;
  if ev is null then return false; end if;
  cap := coalesce(nullif(regexp_replace(coalesce(ev ->> 'cap', ''), '\D', '', 'g'), '')::int, 0);
  if cap = 0 then return true; end if;
  select count(*) into ahead from public.docs x
    where x.team_id = t and x.coll = 'rsvp' and x.id <> u and x.data -> 'ev' -> eid ->> 's' in ('yes', 'late')
      and coalesce(nullif(x.data -> 'ev' -> eid ->> 'at', ''), '~') < coalesce(nullif(my_at, ''), '~')
      and exists (select 1 from public.members m where m.team_id = t and m.user_id::text = x.id);
  ahead := ahead + (select count(*) from jsonb_each(case when jsonb_typeof(ev -> 'guests') = 'object' then ev -> 'guests' else '{}'::jsonb end) gg
    where gg.value ->> 'inCap' = 'true' and coalesce(nullif(gg.value ->> 'at', ''), '~') < coalesce(nullif(my_at, ''), '~'));
  return ahead < cap;
end $$;
revoke all on function public.in_cap_at(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.in_room(t uuid, eid text, u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select d.data -> 'ev' -> eid ->> 's' in ('yes', 'late')
      and public.in_cap_at(t, eid, u::text, d.data -> 'ev' -> eid ->> 'at')
    from public.docs d where d.team_id = t and d.coll = 'rsvp' and d.id = u::text), false)
$$;
revoke all on function public.in_room(uuid, text, uuid) from public, anon, authenticated;

-- 다른 팀에서 온 용병: 받은(확정) 때부터의 글만
create or replace function public.chat_merc_since(t uuid, r text) returns timestamptz
language sql stable security definer set search_path = public as $$
  select min(coalesce(a.paid_at, a.decided_at, a.created_at)) from public.xapps a join public.xposts p on p.id = a.post_id
  where p.team_id = t and p.event_id = r and p.kind = 'hire' and a.kind = 'hire' and a.user_id = auth.uid() and a.status = 'yes'
$$;

-- 매칭 방: 방이 있는 팀(t)의 운영진, 또는 그 경기와 이어진(xmatch) 상대 팀의 운영진
create or replace function public.chat_match_ok(t uuid, r text) returns boolean
language sql stable security definer set search_path = public as $$
  select r like 'm-%' and exists (
    select 1 from public.docs d where d.team_id = t and d.coll = 'events' and d.id = substr(r, 3) and jsonb_typeof(d.data -> 'xmatch') = 'object'
      and (public.is_admin(t) or (coalesce(d.data -> 'xmatch' ->> 'team', '') ~ '^[0-9a-f-]{36}$'
        and public.is_admin((d.data -> 'xmatch' ->> 'team')::uuid)
        and exists (select 1 from public.docs e where e.team_id = (d.data -> 'xmatch' ->> 'team')::uuid and e.coll = 'events'
          and e.id = d.data -> 'xmatch' ->> 'event' and e.data -> 'xmatch' ->> 'team' = t::text))))
$$;

create or replace function public.chat_can_read(t uuid, r text, at timestamptz) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when r like 'm-%' then public.chat_match_ok(t, r)
    when public.is_member(t) then true
    when r = 'all' then false
    else at >= coalesce(public.chat_merc_since(t, r), 'infinity'::timestamptz) end
$$;

drop policy if exists chat_read on public.chat;
create policy chat_read on public.chat for select to authenticated using (public.chat_can_read(team_id, room, created_at));

-- 방에 있는 사람 (알림 받을 사람)
create or replace function public.chat_people(t uuid, r text) returns uuid[]
language plpgsql stable security definer set search_path = public as $$
declare out uuid[]; ev jsonb; o text;
begin
  if r = 'all' then
    select array_agg(user_id) into out from public.members where team_id = t;
  elsif r like 'm-%' then
    select data into ev from public.docs where team_id = t and coll = 'events' and id = substr(r, 3);
    o := ev -> 'xmatch' ->> 'team';
    select array_agg(user_id) into out from public.members where role in ('owner', 'admin')
      and (team_id = t or (coalesce(o, '') ~ '^[0-9a-f-]{36}$' and team_id = o::uuid));
  else
    select array_agg(m.user_id) into out from public.members m where m.team_id = t
      and (m.role in ('owner', 'admin') or public.in_room(t, r, m.user_id));
    out := coalesce(out, '{}') || coalesce((select array_agg(a.user_id) from public.xapps a join public.xposts p on p.id = a.post_id
      where p.team_id = t and p.event_id = r and p.kind = 'hire' and a.status = 'yes'), '{}');
  end if;
  return coalesce(out, '{}');
end $$;
revoke all on function public.chat_people(uuid, text) from public, anon, authenticated;

-- 대화 알림: uvote.chat = mention(기본, 나를 부른 글과 운영진 글) | all | off. 전체 대화방은 uvote.chatAll = 'on'일 때만
create or replace function public.chat_notify(c public.chat) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid; mode text; pref jsonb; nm text; to_u uuid[] := '{}'; tm uuid; ev jsonb; title text; adm boolean;
begin
  if to_regprocedure('public.push_add(uuid, uuid[], text, text, text, text, text)') is null or c.kind is not null then return; end if;
  adm := exists (select 1 from public.members where team_id = c.team_id and user_id = c.user_id and role in ('owner', 'admin'));
  foreach u in array public.chat_people(c.team_id, c.room) loop
    if u = c.user_id then continue; end if;
    select m.team_id, m.display_name into tm, nm from public.members m where m.user_id = u and (m.team_id = c.team_id or c.room like 'm-%') order by (m.team_id = c.team_id) desc limit 1;
    select data into pref from public.docs where team_id = coalesce(tm, c.team_id) and coll = 'uvote' and id = u::text;
    mode := coalesce(pref ->> 'chat', 'mention');
    if c.room = 'all' and coalesce(pref ->> 'chatAll', 'off') <> 'on' then continue; end if;
    if mode = 'off' then continue; end if;
    if mode = 'mention' and not adm and not (coalesce(nm, '') <> '' and position('@' || nm in c.body) > 0) then continue; end if;
    to_u := to_u || u;
  end loop;
  if cardinality(to_u) = 0 then return; end if;
  if c.room = 'all' then title := '전체 대화방';
  elsif c.room like 'm-%' then title := '매칭 방';
  else select public.push_ev_label(data) into title from public.docs where team_id = c.team_id and coll = 'events' and id = c.room; end if;
  perform public.push_add(c.team_id, to_u, 'chat', coalesce(title, '대화'), left(c.name || ': ' || c.body, 120), '#/chat/' || c.room, 'chat:' || c.id);
exception when others then raise warning 'chat_notify: %', sqlerrm;
end $$;
revoke all on function public.chat_notify(public.chat) from public, anon, authenticated;

create or replace function public.chat_send(p_team uuid, p_room text, p_body text) returns json
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  b text := btrim(coalesce(p_body, ''));
  m record; nm text; ev jsonb; row public.chat; lbl text;
begin
  if me is null then raise exception 'not_member' using errcode = '42501'; end if;
  if char_length(b) = 0 or char_length(b) > 1000 then raise exception 'bad_body' using errcode = '22023'; end if;
  if p_room is null or p_room !~ '^[A-Za-z0-9_:.@+-]{1,80}$' then raise exception 'no_room' using errcode = '22023'; end if;
  if p_room = 'all' then
    if not public.is_member(p_team) then raise exception 'not_member' using errcode = '42501'; end if;
    lbl := '전체 대화방';
  elsif p_room like 'm-%' then
    if not public.chat_match_ok(p_team, p_room) then raise exception 'not_allowed' using errcode = '42501'; end if;
    lbl := '매칭 방';
  else
    select data into ev from public.docs where team_id = p_team and coll = 'events' and id = p_room;
    if ev is null then raise exception 'no_room' using errcode = '22023'; end if;
    if public.is_admin(p_team) then null;
    elsif public.is_member(p_team) then
      if not public.in_room(p_team, p_room, me) then raise exception 'not_in_room' using errcode = '42501'; end if;
    elsif public.chat_merc_since(p_team, p_room) is null then raise exception 'not_member' using errcode = '42501';
    end if;
    lbl := public.push_ev_label(ev) || ' 방';
  end if;
  if not public.chat_room_open(p_team, p_room) then raise exception 'room_closed' using errcode = '42501'; end if;
  if (select count(*) from public.chat where user_id = me and created_at > now() - interval '5 seconds') >= 5 then
    raise exception 'too_fast' using errcode = '42501';
  end if;
  select * into m from public.chat_mask(b);
  select left(coalesce(nullif(display_name, ''), '이름 없음'), 30) into nm from public.members where team_id = p_team and user_id = me;
  if nm is null and p_room like 'm-%' then
    select left(coalesce(nullif(x.display_name, ''), '운영진'), 30) into nm from public.members x where x.user_id = me and x.role in ('owner', 'admin')
      and x.team_id = (select (d.data -> 'xmatch' ->> 'team')::uuid from public.docs d where d.team_id = p_team and d.coll = 'events' and d.id = substr(p_room, 3)) limit 1;
  end if;
  if nm is null then
    select left(coalesce(nullif(a.name, ''), '용병'), 30) into nm from public.xapps a join public.xposts p on p.id = a.post_id
      where p.team_id = p_team and p.event_id = p_room and a.user_id = me and a.status = 'yes' limit 1;
  end if;
  insert into public.chat (team_id, room, user_id, name, body, masked)
  values (p_team, p_room, me, coalesce(nm, '이름 없음'), m.body, m.n)
  returning * into row;
  if m.n > 0 and to_regprocedure('public.push_add(uuid, uuid[], text, text, text, text, text)') is not null then
    perform public.push_add(p_team, public.push_admins(p_team), 'chat_curse', '대화에서 욕설을 가렸어요',
      row.name || '님 글, ' || lbl, '#/chat/' || p_room, 'chat_curse:' || row.id);
  end if;
  perform public.chat_notify(row);
  return json_build_object('id', row.id, 'room', row.room, 'user_id', row.user_id, 'name', row.name, 'body', row.body,
    'masked', row.masked, 'hidden', row.hidden, 'kind', row.kind, 'created_at', row.created_at);
end $$;

create or replace function public.chat_hide(p_id bigint) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.chat; how text;
begin
  select * into c from public.chat where id = p_id;
  if c.id is null or me is null or not public.chat_can_read(c.team_id, c.room, c.created_at) or c.kind is not null then raise exception 'no_msg' using errcode = '42501'; end if;
  if c.hidden is not null then return c.hidden; end if;
  if not public.chat_room_open(c.team_id, c.room) then raise exception 'room_closed' using errcode = '42501'; end if;
  if c.user_id = me then how := 'self';
  elsif c.room not like 'm-%' and public.is_admin(c.team_id) then how := 'admin';
  else raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.chat set hidden = how, body = '', masked = 0 where id = p_id;
  return how;
end $$;

revoke all on function public.chat_room_open(uuid, text), public.chat_merc_since(uuid, text), public.chat_match_ok(uuid, text), public.chat_can_read(uuid, text, timestamptz) from public, anon;
grant execute on function public.chat_can_read(uuid, text, timestamptz), public.chat_merc_since(uuid, text), public.chat_match_ok(uuid, text), public.chat_room_open(uuid, text) to authenticated;
revoke all on function public.chat_send(uuid, text, text), public.chat_hide(bigint) from public, anon;
grant execute on function public.chat_send(uuid, text, text), public.chat_hide(bigint) to authenticated;

-- 용병을 받으면(확정) 그 경기 방에 '들어왔어요' 줄을 남긴다
create or replace function public.x_seat(a public.xapps, p public.xposts, me uuid) returns void
language plpgsql security definer set search_path = public as $$
declare k text := 'x' || replace(a.id::text, '-', '');
begin
  update public.docs set data = jsonb_set(data, '{guests}', coalesce(case when jsonb_typeof(data -> 'guests') = 'object' then data -> 'guests' end, '{}'::jsonb)
    || jsonb_build_object(k, jsonb_build_object('name', a.name, 'pos', split_part(a.pos, '/', 1), 'by', me::text, 'at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'inCap', true,
       'ext', jsonb_build_object('uid', a.user_id::text, 'sub', a.sub, 'app', a.id::text, 'fee', coalesce(a.fee, 0), 'mode', p.fee_mode)))), updated_at = now(), updated_by = me
    where team_id = p.team_id and coll = 'events' and id = p.event_id;
  if not exists (select 1 from public.chat where team_id = p.team_id and room = p.event_id and user_id = a.user_id and kind = 'merc') then
    insert into public.chat (team_id, room, user_id, name, body, kind) values (p.team_id, p.event_id, a.user_id, left(coalesce(nullif(a.name, ''), '용병'), 30), left(split_part(a.pos, '/', 1), 20), 'merc');
  end if;
end $$;
revoke all on function public.x_seat(public.xapps, public.xposts, uuid) from public, anon, authenticated;

-- ===== 3) 대기 먼저 묻기
-- 답 기한 (경기 시작 기준): 하루보다 전 12시간, 하루 ~ 4시간 전 4시간(경기 2시간 전까지), 4시간 ~ 1시간 전 1시간, 1시간 전부터는 null(모두에게 동시에)
create or replace function public.wait_until(ev jsonb) returns timestamptz
language plpgsql stable set search_path = '' as $$
declare st timestamptz := public.event_start(ev); lft interval := public.event_start(ev) - now();
begin
  if lft > interval '24 hours' then return now() + interval '12 hours';
  elsif lft > interval '4 hours' then return least(now() + interval '4 hours', st - interval '2 hours');
  elsif lft > interval '1 hour' then return least(now() + interval '1 hour', st);
  else return null; end if;
end $$;
revoke all on function public.wait_until(jsonb) from public, anon, authenticated;

-- 한 사람의 그 일정 응답을 서버가 고친다 (팀원 문지기를 건너뛰는 시스템 쓰기)
create or replace function public.rsvp_sys_set(t uuid, u text, eid text, ne jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('maniball.sys', '1', true);
  update public.docs set data = jsonb_set(data, array['ev', eid], ne), updated_at = now() where team_id = t and coll = 'rsvp' and id = u;
  perform set_config('maniball.sys', '', true);
end $$;
revoke all on function public.rsvp_sys_set(uuid, text, text, jsonb) from public, anon, authenticated;

create or replace function public.wait_scan(t uuid, eid text) returns void
language plpgsql security definer set search_path = public as $$
declare ev jsonb; cap int; r record; i int := 0; un timestamptz; race boolean; nowiso text; tn text; asked uuid[] := '{}';
  free_race boolean := false;
begin
  if coalesce(current_setting('maniball.scan', true), '') = '1' then return; end if;
  select data into ev from public.docs where team_id = t and coll = 'events' and id = eid;
  if ev is null or jsonb_typeof(ev -> 'cancel') = 'object' or now() >= public.event_start(ev) then return; end if;
  cap := coalesce(nullif(regexp_replace(coalesce(ev ->> 'cap', ''), '\D', '', 'g'), '')::int, 0);
  if cap = 0 then return; end if;
  perform set_config('maniball.scan', '1', true);
  nowiso := to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  un := public.wait_until(ev); race := un is null;
  -- 정원 안에 아직 답하지 않은(물어보는 중) 동시 물음 자리가 있는지
  for r in
    select x.id as u, x.data -> 'ev' -> eid as v, coalesce(nullif(x.data -> 'ev' -> eid ->> 'at', ''), '~') as at, false as guest
      from public.docs x where x.team_id = t and x.coll = 'rsvp' and x.data -> 'ev' -> eid ->> 's' in ('yes', 'late')
       and exists (select 1 from public.members m where m.team_id = t and m.user_id::text = x.id)
    union all
    select gg.key, null::jsonb, coalesce(nullif(gg.value ->> 'at', ''), '~'), true
      from jsonb_each(case when jsonb_typeof(ev -> 'guests') = 'object' then ev -> 'guests' else '{}'::jsonb end) gg where gg.value ->> 'inCap' = 'true'
    order by 3, 1
  loop
    if r.guest then i := i + 1; continue; end if;
    if i >= cap then
      -- 대기: 표시만 해 둔다. 동시에 묻는 중이면 모두에게 묻기를 남긴다
      if not coalesce((r.v ->> 'w')::boolean, false) then perform public.rsvp_sys_set(t, r.u, eid, (r.v - 'ask') || '{"w": true}'::jsonb); end if;
    elsif coalesce((r.v ->> 'w')::boolean, false) and r.v -> 'ask' is null then
      -- 대기였다가 자리가 남: 먼저 묻는다
      if race then free_race := true;
      else
        perform public.rsvp_sys_set(t, r.u, eid, r.v || jsonb_build_object('ask', jsonb_build_object('at', nowiso, 'until', to_char(un at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))));
        asked := asked || r.u::uuid;
      end if;
    elsif coalesce((r.v -> 'ask' ->> 'race')::boolean, false) then free_race := true;
    end if;
    i := i + 1;
  end loop;
  -- 1시간 전부터: 대기자 모두에게 동시에 묻는다. 빈 자리가 없으면 동시 물음을 거둔다
  for r in select x.id as u, x.data -> 'ev' -> eid as v from public.docs x where x.team_id = t and x.coll = 'rsvp'
      and x.data -> 'ev' -> eid ->> 's' in ('yes', 'late') and coalesce((x.data -> 'ev' -> eid ->> 'w')::boolean, false) loop
    if free_race and r.v -> 'ask' is null then
      perform public.rsvp_sys_set(t, r.u, eid, r.v || jsonb_build_object('ask', jsonb_build_object('at', nowiso, 'until', to_char(public.event_start(ev) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'race', true)));
      asked := asked || r.u::uuid;
    elsif not free_race and coalesce((r.v -> 'ask' ->> 'race')::boolean, false) then
      perform public.rsvp_sys_set(t, r.u, eid, r.v - 'ask');
    end if;
  end loop;
  perform set_config('maniball.scan', '', true);
  if cardinality(asked) > 0 and to_regprocedure('public.push_add(uuid, uuid[], text, text, text, text, text)') is not null then
    select name into tn from public.teams where id = t;
    perform public.push_add(t, asked, 'wait_ask', coalesce(tn, '매니볼'),
      public.push_ev_label(ev) || ' 자리가 났어요. ' || case when race then '먼저 누른 사람이 들어가요' else to_char(un at time zone 'Asia/Seoul', 'MM.DD HH24:MI') || '까지 갈 수 있는지 알려 주세요' end,
      '#/event/' || eid, 'ask:' || t || ':' || eid || ':' || nowiso);
  end if;
exception when others then
  perform set_config('maniball.scan', '', true);
  raise warning 'wait_scan: %', sqlerrm;
end $$;
revoke all on function public.wait_scan(uuid, text) from public, anon, authenticated;

-- 대기에서 빠진다 (못 가요, 기한 지남): 벌금 없이 불참으로, 불참 변경 표시 없이
create or replace function public.wait_drop(t uuid, u text, eid text) returns void
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  select data -> 'ev' -> eid into v from public.docs where team_id = t and coll = 'rsvp' and id = u;
  if v is null then return; end if;
  perform public.rsvp_sys_set(t, u, eid, ((v - 'ask' - 'w') || jsonb_build_object('s', 'no', 'at', '', 'waitOut', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))));
end $$;
revoke all on function public.wait_drop(uuid, text, text) from public, anon, authenticated;

create or replace function public.wait_expire() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select d.team_id, d.id as u, x.key as eid, x.value as v from public.docs d cross join lateral jsonb_each(case when jsonb_typeof(d.data -> 'ev') = 'object' then d.data -> 'ev' else '{}'::jsonb end) x
      where d.coll = 'rsvp' and jsonb_typeof(x.value -> 'ask') = 'object' and coalesce(x.value -> 'ask' ->> 'until', '') <> '' and (x.value -> 'ask' ->> 'until')::timestamptz <= now() loop
    if coalesce((r.v -> 'ask' ->> 'race')::boolean, false) then perform public.rsvp_sys_set(r.team_id, r.u, r.eid, r.v - 'ask');
    else perform public.wait_drop(r.team_id, r.u, r.eid); end if;
    perform public.wait_scan(r.team_id, r.eid);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.wait_expire() from public, anon, authenticated;

-- 자리가 났을 때 답: '갈게요'(true)면 참석, '못 가요'(false)면 벌금 없이 대기에서 빠진다
create or replace function public.wait_answer(p_team uuid, p_eid text, p_yes boolean) returns text
language plpgsql security definer set search_path = public as $$
declare me text := auth.uid()::text; v jsonb; ev jsonb; x record; tgt text;
begin
  if auth.uid() is null or not public.is_member(p_team) then raise exception 'not_member' using errcode = '42501'; end if;
  perform public.wait_expire();
  select data -> 'ev' -> p_eid into v from public.docs where team_id = p_team and coll = 'rsvp' and id = me;
  if v is null or jsonb_typeof(v -> 'ask') <> 'object' then raise exception 'no_ask' using errcode = '42501'; end if;
  select data into ev from public.docs where team_id = p_team and coll = 'events' and id = p_eid;
  if not p_yes then
    perform public.wait_drop(p_team, me, p_eid);
    perform public.wait_scan(p_team, p_eid);
    return 'out';
  end if;
  if coalesce((v -> 'ask' ->> 'race')::boolean, false) and not public.in_cap_at(p_team, p_eid, me, v ->> 'at') then
    -- 동시 물음: 정원 안에서 아직 답하지 않은 자리를 차지한다 (그 사람보다 앞으로)
    select x2.id as u, x2.data -> 'ev' -> p_eid ->> 'at' as at into x from public.docs x2
      where x2.team_id = p_team and x2.coll = 'rsvp' and x2.id <> me and x2.data -> 'ev' -> p_eid ->> 's' in ('yes', 'late')
        and coalesce((x2.data -> 'ev' -> p_eid -> 'ask' ->> 'race')::boolean, false)
        and public.in_cap_at(p_team, p_eid, x2.id, x2.data -> 'ev' -> p_eid ->> 'at')
      order by coalesce(nullif(x2.data -> 'ev' -> p_eid ->> 'at', ''), '~') limit 1;
    if not found then raise exception 'slot_taken' using errcode = '42501'; end if;
    v := jsonb_set(v, '{at}', to_jsonb(to_char(((x.at)::timestamptz - interval '1 millisecond') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
  end if;
  perform public.rsvp_sys_set(p_team, me, p_eid, (v - 'ask' - 'w') || jsonb_build_object('upAt', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
  perform public.wait_scan(p_team, p_eid);
  if public.chat_room_open(p_team, p_eid) then
    insert into public.chat (team_id, room, user_id, name, kind)
      select p_team, p_eid, auth.uid(), left(coalesce(nullif(display_name, ''), '이름 없음'), 30), 'join' from public.members where team_id = p_team and user_id = auth.uid();
  end if;
  return 'in';
end $$;
revoke all on function public.wait_answer(uuid, text, boolean) from public, anon;
grant execute on function public.wait_answer(uuid, text, boolean) to authenticated;

-- 참석 응답이 바뀌면: 대기 묻기를 다시 보고, 열린 방에는 나감과 다시 들어옴 줄을 남긴다
create or replace function public.rsvp_after_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op = 'UPDATE' then old.data else '{}'::jsonb end;
  k text; ne jsonb; oe jsonb; nm text; was_in boolean; last text;
begin
  if coalesce(current_setting('maniball.scan', true), '') = '1' then return null; end if;
  if new.coll = 'events' then
    if (new.data -> 'cap') is distinct from (o -> 'cap') or (new.data -> 'guests') is distinct from (o -> 'guests') then perform public.wait_scan(new.team_id, new.id); end if;
    return null;
  end if;
  if jsonb_typeof(new.data -> 'ev') <> 'object' then return null; end if;
  for k, ne in select * from jsonb_each(new.data -> 'ev') loop
    oe := o -> 'ev' -> k;
    if (ne ->> 's') is not distinct from (oe ->> 's') and (ne ->> 'at') is not distinct from (oe ->> 'at') then continue; end if;
    perform public.wait_scan(new.team_id, k);
    if not public.chat_room_open(new.team_id, k) then continue; end if;
    select left(coalesce(nullif(display_name, ''), '이름 없음'), 30) into nm from public.members where team_id = new.team_id and user_id::text = new.id;
    if nm is null then continue; end if;
    if coalesce(oe ->> 's', '') in ('yes', 'late') and coalesce(ne ->> 's', '') not in ('yes', 'late') then
      -- 정원 안에 있던 사람만 (대기였던 사람은 방에 없었다)
      was_in := not coalesce((oe ->> 'w')::boolean, false) and public.in_cap_at(new.team_id, k, new.id, oe ->> 'at');
      if was_in then insert into public.chat (team_id, room, user_id, name, kind) values (new.team_id, k, new.id::uuid, nm, 'left'); end if;
    elsif coalesce(ne ->> 's', '') in ('yes', 'late') and coalesce(oe ->> 's', '') not in ('yes', 'late') then
      select kind into last from public.chat where team_id = new.team_id and room = k and user_id::text = new.id and kind in ('left', 'join') order by id desc limit 1;
      if last = 'left' and public.in_room(new.team_id, k, new.id::uuid) then insert into public.chat (team_id, room, user_id, name, kind) values (new.team_id, k, new.id::uuid, nm, 'join'); end if;
    end if;
  end loop;
  return null;
exception when others then
  raise warning 'rsvp_after_trg: %', sqlerrm;
  return null;
end $$;
revoke all on function public.rsvp_after_trg() from public, anon, authenticated;
drop trigger if exists rsvp_after on public.docs;
create trigger rsvp_after after insert or update on public.docs for each row when (new.coll in ('rsvp', 'events')) execute function public.rsvp_after_trg();

-- ===== 4) 공지 투표
-- 안 고른 팀원
create or replace function public.poll_left(t uuid, nid text) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(m.user_id), '{}') from public.members m
  where m.team_id = t and not exists (select 1 from public.docs d where d.team_id = t and d.coll = 'uvote' and d.id = m.user_id::text and coalesce(d.data -> 'poll' ->> nid, '') <> '')
$$;
revoke all on function public.poll_left(uuid, text) from public, anon, authenticated;

-- 공지 투표 집계: tally(팀원도 봄)에는 보기별 수, 이름 공개를 켰을 때만 보기별 사람. atally(운영진만)에는 늘 사람과 안 고른 사람
create or replace function public.recount_poll(t uuid) returns void
language plpgsql security definer set search_path = public as $$
declare nt record; c jsonb; byo jsonb; voters jsonb; n int;
begin
  for nt in select id, data from public.docs where team_id = t and coll = 'notices' and jsonb_typeof(data -> 'poll') = 'object' loop
    select coalesce(jsonb_object_agg(o, cnt), '{}'::jsonb), coalesce(jsonb_object_agg(o, us), '{}'::jsonb) into c, byo from (
      select w.x as o, count(*)::int as cnt, jsonb_agg(d.id order by d.id) as us
      from public.docs d cross join lateral unnest(string_to_array(d.data -> 'poll' ->> nt.id, ',')) w(x)
      where d.team_id = t and d.coll = 'uvote' and coalesce(d.data -> 'poll' ->> nt.id, '') <> ''
        and exists (select 1 from public.members m where m.team_id = t and m.user_id::text = d.id)
      group by w.x) q;
    select count(*)::int, coalesce(jsonb_agg(d.id order by d.id), '[]'::jsonb) into n, voters from public.docs d
      where d.team_id = t and d.coll = 'uvote' and coalesce(d.data -> 'poll' ->> nt.id, '') <> ''
        and exists (select 1 from public.members m where m.team_id = t and m.user_id::text = d.id);
    insert into public.docs (team_id, coll, id, data) values (t, 'tally', 'poll-' || nt.id,
      jsonb_build_object('n', n, 'c', c, 'by', case when coalesce((nt.data -> 'poll' ->> 'names')::boolean, false) then byo else '{}'::jsonb end, 'v', '[]'::jsonb))
      on conflict (team_id, coll, id) do update set data = excluded.data, updated_at = now() where public.docs.data is distinct from excluded.data;
    insert into public.docs (team_id, coll, id, data) values (t, 'atally', 'poll-' || nt.id,
      jsonb_build_object('n', n, 'by', byo, 'voters', voters, 'left', to_jsonb(public.poll_left(t, nt.id))))
      on conflict (team_id, coll, id) do update set data = excluded.data, updated_at = now() where public.docs.data is distinct from excluded.data;
  end loop;
end $$;
revoke all on function public.recount_poll(uuid) from public, anon, authenticated;

create or replace function public.on_uvote_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.recount_tally(coalesce(new.team_id, old.team_id));
  perform public.recount_poll(coalesce(new.team_id, old.team_id));
  return null;
end $$;
revoke all on function public.on_uvote_change() from public, anon, authenticated;
-- 공지(투표)를 새로 쓰거나 고쳐도 집계를 다시 한다
drop trigger if exists notice_poll_recount on public.docs;
create trigger notice_poll_recount after insert or update on public.docs for each row when (new.coll = 'notices') execute function public.on_uvote_change();

-- 운영진: 안 고른 사람에게 다시 알리기 (같은 공지는 10분에 한 번)
create or replace function public.poll_remind(p_team uuid, p_nid text) returns int
language plpgsql security definer set search_path = public as $$
declare nt jsonb; tn text;
begin
  if not public.is_admin(p_team) then raise exception 'admin_only' using errcode = '42501'; end if;
  select data into nt from public.docs where team_id = p_team and coll = 'notices' and id = p_nid;
  if nt is null or jsonb_typeof(nt -> 'poll') <> 'object' then raise exception 'no_poll' using errcode = '42501'; end if;
  if to_regprocedure('public.push_add(uuid, uuid[], text, text, text, text, text)') is null then return 0; end if;
  select name into tn from public.teams where id = p_team;
  return public.push_add(p_team, public.poll_left(p_team, p_nid), 'poll', coalesce(tn, '매니볼'),
    '공지 투표를 아직 안 골랐어요: ' || left(coalesce(nt ->> 'title', ''), 40), '#/notice/' || p_nid, 'pollnow:' || p_team || ':' || p_nid || ':' || floor(extract(epoch from now()) / 600));
end $$;
revoke all on function public.poll_remind(uuid, text) from public, anon;
grant execute on function public.poll_remind(uuid, text) to authenticated;
create or replace function public.docs_member_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  o jsonb := case when tg_op = 'UPDATE' then old.data else '{}'::jsonb end;
  n jsonb := new.data;
  k text; ne jsonb; oe jsonb; ev jsonb; nowiso text; keep_at text; pid text; cap int; ahead int;
begin
  -- 운영진은 참석과 용병 규칙을 건너뛴다. MOM 투표(uvote)는 운영진도 같은 규칙
  -- 서버가 쓰는 시스템 쓰기(대기 묻기, 만료)는 건너뛴다
  if coalesce(current_setting('maniball.sys', true), '') = '1' then return new; end if;
  if auth.uid() is null or (public.is_admin(new.team_id) and new.coll <> 'uvote') then return new; end if;
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
        -- 투표 마감(경기 전날 몇 시, 또는 경기 시작) 뒤에는 바꿀 수 없다. 마감 후 불참 변경(late_cancel)만 예외
        if clock_timestamp() >= public.vote_deadline(ev) and coalesce(current_setting('maniball.late_cancel', true), '') <> '1' then raise exception 'vote_closed' using errcode = '42501'; end if;
        -- 불참 벌금 기준 시각(기본 운영 규칙)이 지난 뒤 참석, 늦참에서 불참으로: 정원 안에 있던 사람은 불참 변경(late_cancel)으로만 바꾼다. 대기였던 사람은 그냥 바꾼다
        if coalesce(ne ->> 's', '') = 'no' and jsonb_typeof(oe) = 'object' and oe ->> 's' in ('yes', 'late')
           and coalesce(current_setting('maniball.late_cancel', true), '') <> '1'
           and clock_timestamp() >= public.fine_start(ev, coalesce((select x.data from public.docs x where x.team_id = new.team_id and x.coll = 'team' and x.id = 'settings'), '{}'::jsonb)) then
          cap := coalesce(nullif(regexp_replace(coalesce(ev ->> 'cap', ''), '\D', '', 'g'), '')::int, 0);
          ahead := 0;
          if cap > 0 then
            select count(*) into ahead from public.docs x
              where x.team_id = new.team_id and x.coll = 'rsvp' and x.id <> new.id and x.data -> 'ev' -> k ->> 's' in ('yes', 'late')
                and coalesce(nullif(x.data -> 'ev' -> k ->> 'at', ''), '~') < coalesce(nullif(oe ->> 'at', ''), '~')
                and exists (select 1 from public.members m where m.team_id = new.team_id and m.user_id::text = x.id);
            ahead := ahead + (select count(*) from jsonb_each(case when jsonb_typeof(ev -> 'guests') = 'object' then ev -> 'guests' else '{}'::jsonb end) gg
              where gg.value ->> 'inCap' = 'true' and coalesce(nullif(gg.value ->> 'at', ''), '~') < coalesce(nullif(oe ->> 'at', ''), '~'));
          end if;
          if cap = 0 or ahead < cap then raise exception 'need_late_cancel' using errcode = '42501'; end if;
        end if;
        if coalesce(ne ->> 's', '') not in ('yes', 'late', 'no', '') then raise exception 'bad_vote' using errcode = '42501'; end if;
        if coalesce(ne ->> 'q', '0') !~ '^[0-8]$' then raise exception 'bad_vote' using errcode = '42501'; end if;
        -- 불참 변경 표시와 사유는 서버(late_cancel)만 적는다
        if coalesce(current_setting('maniball.late_cancel', true), '') <> '1' then ne := ne - 'lateCancel' - 'reason'; end if;
        -- 대기 표시(w)와 자리 물어봄(ask)은 서버만 적는다. 참석, 늦참을 그대로 두면 이어 간다
        ne := ne - 'ask' - 'w';
        if ne ->> 's' in ('yes', 'late') and jsonb_typeof(oe) = 'object' and oe ->> 's' in ('yes', 'late') then
          if oe ? 'w' then ne := jsonb_set(ne, '{w}', oe -> 'w'); end if;
          if oe ? 'ask' then ne := jsonb_set(ne, '{ask}', oe -> 'ask'); end if;
        end if;
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
        -- 이날 온 사람끼리만, 자기 자신은 못 고른다
        if coalesce(ne #>> '{}', '') <> '' then
          if ne #>> '{}' = auth.uid()::text then raise exception 'mom_self' using errcode = '42501'; end if;
          if not public.came_to(new.team_id, ev, k, auth.uid()::text) or not public.came_to(new.team_id, ev, k, ne #>> '{}') then raise exception 'mom_not_came' using errcode = '42501'; end if;
        end if;
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
        -- 여러 개 고르기는 쉼표로 이어 적는다. 보기에 있는 것만, 한 개만 고르는 투표는 한 개만
        if coalesce(ne #>> '{}', '') <> '' then
          if not coalesce((ev -> 'poll' ->> 'multi')::boolean, false) and position(',' in ne #>> '{}') > 0 then raise exception 'no_option' using errcode = '42501'; end if;
          if array_length(string_to_array(ne #>> '{}', ','), 1) > 20 then raise exception 'no_option' using errcode = '42501'; end if;
          if exists (select 1 from unnest(string_to_array(ne #>> '{}', ',')) w(x)
                     where not exists (select 1 from jsonb_array_elements(coalesce(ev -> 'poll' -> 'opts', '[]'::jsonb)) op where op ->> 'id' = w.x)) then raise exception 'no_option' using errcode = '42501'; end if;
        end if;
      end loop;
    end if;
  elsif new.coll = 'guestreq' then
    -- 용병 신청: 팀원은 신청(req)과 취소(cancel)만. 새 신청은 운영진이 그 경기 용병을 받는 중이고 투표가 열려 있을 때만
    if jsonb_typeof(n -> 'items') = 'object' then
      for k, ne in select * from jsonb_each(n -> 'items') loop
        oe := o -> 'items' -> k;
        if ne is not distinct from oe then continue; end if;
        if jsonb_typeof(ne) <> 'object' then raise exception 'bad_request' using errcode = '42501'; end if;
        if coalesce(ne ->> 'status', '') not in ('req', 'cancel') then raise exception 'not_allowed' using errcode = '42501'; end if;
        if jsonb_typeof(oe) = 'object' and (ne ->> 'eid') is distinct from (oe ->> 'eid') then raise exception 'bad_request' using errcode = '42501'; end if;
        if length(coalesce(ne ->> 'name', '')) > 20 or length(coalesce(ne ->> 'rel', '')) > 60 then raise exception 'bad_request' using errcode = '42501'; end if;
        if ne ->> 'status' = 'req' and (jsonb_typeof(oe) is distinct from 'object' or (oe ->> 'status') is distinct from 'req') then
          select data into ev from public.docs where team_id = new.team_id and coll = 'events' and id = ne ->> 'eid';
          if ev is null then raise exception 'no_event' using errcode = '42501'; end if;
          if coalesce(ev ->> 'guestOpen', 'false') <> 'true' or clock_timestamp() >= public.vote_deadline(ev) then raise exception 'guest_closed' using errcode = '42501'; end if;
        end if;
      end loop;
    end if;
  end if;
  new.data := n;
  return new;
end $function$;
create or replace function public.push_scan()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare r record; dl timestamptz; uids uuid[]; st jsonb; sdays int; smin int; cnt int; tn text; total int := 0;
begin
  delete from public.push_outbox where created_at < now() - interval '7 days';
  -- 대기 자리 물어봄: 답 기한이 지나면 벌금 없이 대기에서 뺀다 (알림을 켠 사람이 없어도 돈다)
  perform public.wait_expire();
  if not exists (select 1 from public.push_subs) and not exists (select 1 from public.push_kakao) then return 0; end if;
  for r in select d.team_id, d.id, d.data from public.docs d where d.coll = 'events'
      and coalesce(d.data ->> 'date', '') ~ '^\d{4}-\d{2}-\d{2}$' and (d.data ->> 'date')::date between current_date - 1 and current_date + 8
      and jsonb_typeof(d.data -> 'cancel') is distinct from 'object' loop
    select name into tn from public.teams where id = r.team_id;
    tn := coalesce(tn, '매니볼');
    -- 투표 마감 3시간 전: 아직 응답하지 않은 팀원
    dl := public.vote_deadline(r.data);
    if dl > now() and dl <= now() + interval '3 hours' then
      select array_agg(m.user_id) into uids from public.members m
      where m.team_id = r.team_id and not exists (select 1 from public.docs x where x.team_id = r.team_id and x.coll = 'rsvp' and x.id = m.user_id::text
        and coalesce(x.data -> 'ev' -> r.id ->> 's', '') <> '');
      total := total + public.push_add(r.team_id, uids, 'vote', tn,
        public.push_ev_label(r.data) || ' 투표가 ' || to_char(dl at time zone 'Asia/Seoul', 'HH24:MI') || '에 마감돼요. 아직 응답하지 않았어요',
        '#/event/' || r.id, 'vote:' || r.team_id || ':' || r.id || ':' || dl);
    end if;
    -- 내전 인원: 상대 미정 경기에 기준 인원이 모이면 운영진에게
    if r.data ->> 'type' = 'match' and coalesce(r.data ->> 'opponent', '') = '' and coalesce(r.data ->> 'scrimKeep', '') in ('', 'false') and public.event_start(r.data) > now() then
      select data into st from public.docs where team_id = r.team_id and coll = 'team' and id = 'settings';
      sdays := case when coalesce(st ->> 'scrimDays', '') ~ '^\d+$' then (st ->> 'scrimDays')::int else 3 end;
      smin := case when coalesce(st ->> 'scrimMin', '') ~ '^\d+$' then (st ->> 'scrimMin')::int else 20 end;
      if now() >= (((r.data ->> 'date')::date - sdays) + time '00:00') at time zone 'Asia/Seoul' then
        select count(*) into cnt from public.docs x where x.team_id = r.team_id and x.coll = 'rsvp' and x.data -> 'ev' -> r.id ->> 's' in ('yes', 'late');
        cnt := cnt + coalesce((select count(*) from jsonb_each(case when jsonb_typeof(r.data -> 'guests') = 'object' then r.data -> 'guests' else '{}'::jsonb end) g where g.value ->> 'inCap' = 'true'), 0);
        if cnt >= smin then
          total := total + public.push_add(r.team_id, public.push_admins(r.team_id), 'scrim', tn,
            public.push_ev_label(r.data) || ' 신청 ' || cnt || '명, 내전으로 바꿀 수 있어요', '#/scrim/' || r.id, 'scrim:' || r.team_id || ':' || r.id);
        end if;
      end if;
    end if;
  end loop;
  -- 공지 투표 마감 하루 전: 안 고른 팀원에게 한 번
  for r in select d.team_id, d.id, d.data from public.docs d where d.coll = 'notices' and jsonb_typeof(d.data -> 'poll') = 'object'
      and coalesce(d.data -> 'poll' ->> 'until', '') <> '' loop
    dl := (r.data -> 'poll' ->> 'until')::timestamptz;
    if dl > now() and dl <= now() + interval '24 hours' then
      select name into tn from public.teams where id = r.team_id;
      total := total + public.push_add(r.team_id, public.poll_left(r.team_id, r.id), 'poll', coalesce(tn, '매니볼'),
        '공지 투표가 ' || to_char(dl at time zone 'Asia/Seoul', 'MM.DD HH24:MI') || '에 마감돼요. 아직 안 골랐어요', '#/notice/' || r.id, 'pollrem:' || r.team_id || ':' || r.id);
    end if;
  end loop;
  return total;
end $function$;

revoke all on function public.docs_member_guard(), public.push_scan() from public, anon, authenticated;

-- 다른 팀에 용병으로 간 경기 방 목록 (받은 경기만, 경기 날짜가 지나지 않은 것)
create or replace function public.chat_merc_rooms() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('team', p.team_id, 'tname', t.name, 'room', p.event_id, 'since', coalesce(a.paid_at, a.decided_at, a.created_at), 'pos', split_part(a.pos, '/', 1),
      'ev', jsonb_build_object('date', e.data ->> 'date', 'time', e.data ->> 'time', 'end', e.data ->> 'end', 'type', e.data ->> 'type', 'place', e.data ->> 'place', 'opponent', e.data ->> 'opponent',
        'cancel', e.data -> 'cancel', 'voteClose', e.data ->> 'voteClose', 'voteDays', e.data ->> 'voteDays', 'voteTime', e.data ->> 'voteTime'))
    order by e.data ->> 'date'), '[]'::jsonb)
  from public.xapps a join public.xposts p on p.id = a.post_id join public.teams t on t.id = p.team_id
    join public.docs e on e.team_id = p.team_id and e.coll = 'events' and e.id = p.event_id
  where a.user_id = auth.uid() and a.kind = 'hire' and a.status = 'yes'
    and coalesce(e.data ->> 'date', '') ~ '^\d{4}-\d{2}-\d{2}$' and (e.data ->> 'date')::date >= (now() at time zone 'Asia/Seoul')::date
$$;
revoke all on function public.chat_merc_rooms() from public, anon;
grant execute on function public.chat_merc_rooms() to authenticated;
