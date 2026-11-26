-- 2026-11-26 b: 대화 시안 승인분 (방마다 알림, 사진, 대화상대 초대, 경기 끝나고 2시간 뒤 방이 사라짐)
-- 지금 있는 글과 자료는 지우거나 바꾸지 않는다. 열과 함수만 더하고 바꾼다. 여러 번 실행해도 안전하다.
--   1) 경기 방은 경기가 끝나고 2시간 뒤 닫힌다 (끝나는 시각이 없으면 시작 2시간 뒤를 끝으로 본다)
--   2) 운영진이 방에 없는 팀원을 대화방에 초대한다 (참석 투표는 바뀌지 않는다)
--   3) 사진: 한 번에 4장까지. 비공개 저장소(mb-chat)에 두고, 그 글을 읽을 수 있는 사람만 본다. 가리면 아무도 못 본다
--   4) 알림은 방마다 켜고 끈다. 켜면 나를 부른 글(@내 이름)만 온다. 전체 대화방만 기본이 끔이다

-- ===== 1) 끝나는 시각, 방이 사라지는 시각
create or replace function public.event_end(ev jsonb) returns timestamptz
language sql immutable set search_path = '' as $$
  select case when coalesce(ev ->> 'end', '') ~ '^\d{2}:\d{2}$' then
      ((ev ->> 'date') || ' ' || (ev ->> 'end'))::timestamp at time zone 'Asia/Seoul'
        + case when coalesce(ev ->> 'time', '') ~ '^\d{2}:\d{2}$' and (ev ->> 'end') <= (ev ->> 'time') then interval '1 day' else interval '0' end
    else public.event_start(ev) + interval '2 hours' end
$$;
create or replace function public.chat_gone_at(ev jsonb) returns timestamptz
language sql immutable set search_path = '' as $$ select public.event_end(ev) + interval '2 hours' $$;
revoke all on function public.event_end(jsonb), public.chat_gone_at(jsonb) from public, anon, authenticated;

-- 방에 글을 쓸 수 있는지. 경기 방과 매칭 방은 경기 끝나고 2시간이 지나면 닫힌다 (글은 지우지 않는다)
create or replace function public.chat_room_open(t uuid, r text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when r in ('all', 'ops') then exists (select 1 from public.teams where id = t)
    when r like 'm-%' then exists (select 1 from public.docs d where d.team_id = t and d.coll = 'events' and d.id = substr(r, 3)
      and jsonb_typeof(d.data -> 'xmatch') = 'object' and coalesce(d.data -> 'cancel' ->> 'at', '') = ''
      and coalesce(d.data ->> 'date', '') ~ '^\d{4}-\d{2}-\d{2}$' and now() < public.chat_gone_at(d.data))
    else exists (select 1 from public.docs d where d.team_id = t and d.coll = 'events' and d.id = r
      and coalesce(d.data -> 'cancel' ->> 'at', '') = ''
      and coalesce(d.data ->> 'date', '') ~ '^\d{4}-\d{2}-\d{2}$'
      and now() >= public.chat_open_at(d.data) and now() < public.chat_gone_at(d.data))
  end
$$;

-- 용병으로 간 방 목록: 방이 사라지기 전까지만
create or replace function public.chat_merc_rooms() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('team', p.team_id, 'tname', t.name, 'room', p.event_id, 'since', coalesce(a.paid_at, a.decided_at, a.created_at), 'pos', split_part(a.pos, '/', 1),
      'ev', jsonb_build_object('date', e.data ->> 'date', 'time', e.data ->> 'time', 'end', e.data ->> 'end', 'type', e.data ->> 'type', 'place', e.data ->> 'place', 'opponent', e.data ->> 'opponent',
        'cancel', e.data -> 'cancel', 'voteClose', e.data ->> 'voteClose', 'voteDays', e.data ->> 'voteDays', 'voteTime', e.data ->> 'voteTime'))
    order by e.data ->> 'date'), '[]'::jsonb)
  from public.xapps a join public.xposts p on p.id = a.post_id join public.teams t on t.id = p.team_id
    join public.docs e on e.team_id = p.team_id and e.coll = 'events' and e.id = p.event_id
  where a.user_id = auth.uid() and a.kind = 'hire' and a.status = 'yes'
    and coalesce(e.data ->> 'date', '') ~ '^\d{4}-\d{2}-\d{2}$' and now() < public.chat_gone_at(e.data)
$$;
revoke all on function public.chat_merc_rooms() from public, anon;
grant execute on function public.chat_merc_rooms() to authenticated;

-- ===== 2) 대화상대 초대
do $$ begin
  alter table public.chat drop constraint if exists chat_kind_ok;
  alter table public.chat add constraint chat_kind_ok check (kind is null or kind in ('left', 'join', 'merc', 'inv'));
end $$;

-- 방에 있는 사람: 정원 안 참석과 늦참, 또는 운영진이 초대한 사람 (초대 뒤에 불참으로 나가면 다시 나간다)
create or replace function public.in_room(t uuid, eid text, u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select d.data -> 'ev' -> eid ->> 's' in ('yes', 'late')
      and public.in_cap_at(t, eid, u::text, d.data -> 'ev' -> eid ->> 'at')
    from public.docs d where d.team_id = t and d.coll = 'rsvp' and d.id = u::text), false)
  or coalesce((select c.kind = 'inv' from public.chat c where c.team_id = t and c.room = eid and c.user_id = u and c.kind in ('inv', 'left')
    order by c.id desc limit 1), false)
$$;
revoke all on function public.in_room(uuid, text, uuid) from public, anon, authenticated;

-- 운영진이 열린 일정 방에 팀원을 초대한다. 운영진은 늘 방에 있어서 고를 수 없다
create or replace function public.chat_invite(p_team uuid, p_room text, p_users uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); u uuid; nm text; by_nm text; n int := 0; ev jsonb; rid bigint;
begin
  if me is null or not public.is_admin(p_team) then raise exception 'admin_only' using errcode = '42501'; end if;
  if p_room is null or p_room in ('all', 'ops') or p_room like 'm-%' or p_room !~ '^[A-Za-z0-9_:.@+-]{1,80}$' then raise exception 'no_room' using errcode = '22023'; end if;
  select data into ev from public.docs where team_id = p_team and coll = 'events' and id = p_room;
  if ev is null then raise exception 'no_room' using errcode = '22023'; end if;
  if not public.chat_room_open(p_team, p_room) then raise exception 'room_closed' using errcode = '42501'; end if;
  if coalesce(cardinality(p_users), 0) = 0 or cardinality(p_users) > 60 then raise exception 'bad_users' using errcode = '22023'; end if;
  if to_regprocedure('public.rl_hit(text, integer, integer)') is not null then perform public.rl_hit('chat_inv', 20, 60); end if;
  select left(coalesce(nullif(display_name, ''), '운영진'), 30) into by_nm from public.members where team_id = p_team and user_id = me;
  foreach u in array coalesce((select array_agg(distinct x) from unnest(p_users) x where x is not null), '{}') loop
    nm := null;
    select left(coalesce(nullif(display_name, ''), '이름 없음'), 30) into nm from public.members where team_id = p_team and user_id = u and role = 'member';
    if nm is null or public.in_room(p_team, p_room, u) then continue; end if;
    insert into public.chat (team_id, room, user_id, name, body, kind) values (p_team, p_room, u, nm, coalesce(by_nm, '운영진'), 'inv') returning id into rid;
    n := n + 1;
    if to_regprocedure('public.push_add(uuid, uuid[], text, text, text, text, text)') is not null then
      perform public.push_add(p_team, array[u], 'chat', left(public.push_ev_label(ev) || ' 방', 60), coalesce(by_nm, '운영진') || '님이 대화방에 초대했어요', '#/chat/' || p_room, 'chat_inv:' || rid);
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.chat_invite(uuid, text, uuid[]) from public, anon;
grant execute on function public.chat_invite(uuid, text, uuid[]) to authenticated;

-- 참석 바꾸기: 정원 안에서 빠지면 '나갔어요', 다시 들어오면 '들어왔어요'.
-- 초대받은 사람이 불참을 누르면 방에서 나간다. 초대받아 있는 동안 참석으로 바꾸면 줄을 더 남기지 않는다
create or replace function public.rsvp_after_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op = 'UPDATE' then old.data else '{}'::jsonb end;
  k text; ne jsonb; oe jsonb; nm text; was_in boolean; last text; inv boolean;
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
    last := null;
    select kind into last from public.chat where team_id = new.team_id and room = k and user_id::text = new.id and kind in ('left', 'join', 'inv') order by id desc limit 1;
    inv := last = 'inv';
    if coalesce(oe ->> 's', '') in ('yes', 'late') and coalesce(ne ->> 's', '') not in ('yes', 'late') then
      -- 정원 안에 있던 사람만 (대기였던 사람은 방에 없었다), 초대받은 사람도
      was_in := inv or (not coalesce((oe ->> 'w')::boolean, false) and public.in_cap_at(new.team_id, k, new.id, oe ->> 'at'));
      if was_in then insert into public.chat (team_id, room, user_id, name, kind) values (new.team_id, k, new.id::uuid, nm, 'left'); end if;
    elsif inv and coalesce(ne ->> 's', '') = 'no' and coalesce(oe ->> 's', '') <> 'no' then
      insert into public.chat (team_id, room, user_id, name, kind) values (new.team_id, k, new.id::uuid, nm, 'left');
    elsif coalesce(ne ->> 's', '') in ('yes', 'late') and coalesce(oe ->> 's', '') not in ('yes', 'late') then
      if last = 'left' and public.in_room(new.team_id, k, new.id::uuid) then insert into public.chat (team_id, room, user_id, name, kind) values (new.team_id, k, new.id::uuid, nm, 'join'); end if;
    end if;
  end loop;
  return null;
exception when others then
  raise warning 'rsvp_after_trg: %', sqlerrm;
  return null;
end $$;
revoke all on function public.rsvp_after_trg() from public, anon, authenticated;

-- ===== 3) 사진
alter table public.chat add column if not exists photos text[];
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'chat_photos_ok') then
    alter table public.chat add constraint chat_photos_ok check (photos is null or cardinality(photos) between 1 and 4);
  end if;
end $$;

-- 이 방에 지금 글(사진)을 올릴 수 있는지: chat_send와 같은 규칙
create or replace function public.chat_can_post(t uuid, r text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null or t is null or r is null or r !~ '^[A-Za-z0-9_:.@+-]{1,80}$' then return false; end if;
  if r = 'ops' then if not public.is_admin(t) then return false; end if;
  elsif r = 'all' then if not public.is_member(t) then return false; end if;
  elsif r like 'm-%' then if not public.chat_match_ok(t, r) then return false; end if;
  else
    if not exists (select 1 from public.docs where team_id = t and coll = 'events' and id = r) then return false; end if;
    if public.is_admin(t) then null;
    elsif public.is_member(t) then if not public.in_room(t, r, me) then return false; end if;
    elsif public.chat_merc_since(t, r) is null then return false;
    end if;
  end if;
  return public.chat_room_open(t, r);
end $$;

-- 사진 자리: 팀 id / 방 / 올린 사람 id / 이름.jpg
create or replace function public.chat_photo_put_ok(p text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare f text[] := string_to_array(coalesce(p, ''), '/');
begin
  if auth.uid() is null or cardinality(f) <> 4 or f[1] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or f[3] <> auth.uid()::text or f[4] !~ '^[A-Za-z0-9_-]{8,64}\.(jpg|png|webp)$' then return false; end if;
  return public.chat_can_post(f[1]::uuid, f[2]);
end $$;

-- 사진 보기: 그 사진이 붙은 글을 읽을 수 있고, 가린 글이 아닐 때만
create or replace function public.chat_photo_get_ok(p text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare f text[] := string_to_array(coalesce(p, ''), '/');
begin
  if auth.uid() is null or cardinality(f) <> 4 or f[1] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  return exists (select 1 from public.chat c where c.team_id = f[1]::uuid and c.room = f[2] and p = any(c.photos) and c.hidden is null
    and public.chat_can_read(c.team_id, c.room, c.created_at));
end $$;
revoke all on function public.chat_can_post(uuid, text), public.chat_photo_put_ok(text), public.chat_photo_get_ok(text) from public, anon;
grant execute on function public.chat_can_post(uuid, text), public.chat_photo_put_ok(text), public.chat_photo_get_ok(text) to authenticated;

-- 비공개 저장소: 사진만, 한 장 3MB까지 (앱이 긴 변 1600px로 줄여 올린다)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('mb-chat', 'mb-chat', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists mb_chat_put on storage.objects;
create policy mb_chat_put on storage.objects for insert to authenticated
  with check (bucket_id = 'mb-chat' and public.chat_photo_put_ok(name));
drop policy if exists mb_chat_get on storage.objects;
create policy mb_chat_get on storage.objects for select to authenticated
  using (bucket_id = 'mb-chat' and ((storage.foldername(name))[3] = (select auth.uid()::text) or public.chat_photo_get_ok(name)));

-- ===== 4) 대화 알림: 방마다 켜고 끈다 (uvote.ra = { 방: 'on' | 'off' }). 켜면 나를 부른 글만
-- 전에 고른 값도 이어 받는다: 전체 대화방은 chatAll이 'on'이면 켜짐, 다른 방은 chat이 'off'이면 꺼짐
create or replace function public.chat_notify(c public.chat) returns void
language plpgsql security definer set search_path = public as $$
declare u uuid; pref jsonb; nm text; to_u uuid[] := '{}'; tm uuid; ev jsonb; title text; rk text; st text; body text;
begin
  if to_regprocedure('public.push_add(uuid, uuid[], text, text, text, text, text)') is null or c.kind is not null then return; end if;
  if c.room like 'm-%' then select data into ev from public.docs where team_id = c.team_id and coll = 'events' and id = substr(c.room, 3); end if;
  foreach u in array public.chat_people(c.team_id, c.room) loop
    if u = c.user_id then continue; end if;
    tm := null; nm := null; pref := null; rk := c.room;
    select m.team_id, m.display_name into tm, nm from public.members m where m.user_id = u and (m.team_id = c.team_id or c.room like 'm-%') order by (m.team_id = c.team_id) desc limit 1;
    if tm is null then
      -- 다른 팀에서 온 용병: 이 방에서 쓰는 이름으로 부른다
      select a.name into nm from public.xapps a join public.xposts p on p.id = a.post_id
        where p.team_id = c.team_id and p.event_id = c.room and a.user_id = u and a.status = 'yes' limit 1;
      rk := 'x~' || c.team_id || '~' || c.room; -- 용병 앱에서 쓰는 방 이름 (자기 팀 uvote에 둔다)
      select data into pref from public.docs where coll = 'uvote' and id = u::text and jsonb_typeof(data -> 'ra') = 'object' and (data -> 'ra') ? rk limit 1;
    else
      select data into pref from public.docs where team_id = tm and coll = 'uvote' and id = u::text;
      if tm <> c.team_id then rk := 'm-' || coalesce(ev -> 'xmatch' ->> 'event', ''); end if; -- 상대 팀 운영진이 보는 매칭 방 이름
    end if;
    st := coalesce(pref -> 'ra' ->> rk, case when rk = 'all' then case when pref ->> 'chatAll' = 'on' then 'on' else 'off' end
      when pref ->> 'chat' = 'off' then 'off' else 'on' end);
    if st = 'off' then continue; end if;
    if not (coalesce(nm, '') <> '' and position('@' || nm in c.body) > 0) then continue; end if;
    to_u := to_u || u;
  end loop;
  if cardinality(to_u) = 0 then return; end if;
  if c.room = 'ops' then title := '운영진 대화방';
  elsif c.room = 'all' then title := '전체 대화방';
  elsif c.room like 'm-%' then title := '매칭 방';
  else select public.push_ev_label(data) into title from public.docs where team_id = c.team_id and coll = 'events' and id = c.room; end if;
  body := case when c.body <> '' then c.body else '사진 ' || coalesce(cardinality(c.photos), 0) || '장' end;
  perform public.push_add(c.team_id, to_u, 'chat', coalesce(title, '대화'), left(c.name || ': ' || body, 120), '#/chat/' || c.room, 'chat:' || c.id);
exception when others then raise warning 'chat_notify: %', sqlerrm;
end $$;
revoke all on function public.chat_notify(public.chat) from public, anon, authenticated;

-- 글 보내기: 사진(p_photos, 4장까지)을 붙일 수 있다. 사진이 있으면 글은 없어도 된다
drop function if exists public.chat_send(uuid, text, text);
create or replace function public.chat_send(p_team uuid, p_room text, p_body text, p_photos text[] default null) returns json
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  b text := btrim(coalesce(p_body, ''));
  ph text[] := coalesce(p_photos, '{}');
  m record; nm text; ev jsonb; row public.chat; lbl text; x text; f text[];
begin
  if me is null then raise exception 'not_member' using errcode = '42501'; end if;
  if char_length(b) > 1000 or (char_length(b) = 0 and cardinality(ph) = 0) then raise exception 'bad_body' using errcode = '22023'; end if;
  if p_room is null or p_room !~ '^[A-Za-z0-9_:.@+-]{1,80}$' then raise exception 'no_room' using errcode = '22023'; end if;
  if p_room = 'ops' then
    if not public.is_admin(p_team) then raise exception 'not_allowed' using errcode = '42501'; end if;
    lbl := '운영진 대화방';
  elsif p_room = 'all' then
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
  -- 사진: 내가 이 방 자리에 올린 것만, 한 번씩만, 한 글에 4장까지
  if cardinality(ph) > 4 or cardinality(ph) <> (select count(distinct y) from unnest(ph) y) then raise exception 'bad_photos' using errcode = '22023'; end if;
  foreach x in array ph loop
    f := string_to_array(coalesce(x, ''), '/');
    if cardinality(f) <> 4 or f[1] <> p_team::text or f[2] <> p_room or f[3] <> me::text or f[4] !~ '^[A-Za-z0-9_-]{8,64}\.(jpg|png|webp)$'
       or not exists (select 1 from storage.objects o where o.bucket_id = 'mb-chat' and o.name = x)
       or exists (select 1 from public.chat c where c.team_id = p_team and c.room = p_room and x = any(c.photos)) then
      raise exception 'bad_photos' using errcode = '22023';
    end if;
  end loop;
  select * into m from public.chat_mask(b);
  select left(coalesce(nullif(display_name, ''), '이름 없음'), 30) into nm from public.members where team_id = p_team and user_id = me;
  if nm is null and p_room like 'm-%' then
    select left(coalesce(nullif(x2.display_name, ''), '운영진'), 30) into nm from public.members x2 where x2.user_id = me and x2.role in ('owner', 'admin')
      and x2.team_id = (select (d.data -> 'xmatch' ->> 'team')::uuid from public.docs d where d.team_id = p_team and d.coll = 'events' and d.id = substr(p_room, 3)) limit 1;
  end if;
  if nm is null then
    select left(coalesce(nullif(a.name, ''), '용병'), 30) into nm from public.xapps a join public.xposts p on p.id = a.post_id
      where p.team_id = p_team and p.event_id = p_room and a.user_id = me and a.status = 'yes' limit 1;
  end if;
  insert into public.chat (team_id, room, user_id, name, body, masked, photos)
  values (p_team, p_room, me, coalesce(nm, '이름 없음'), coalesce(m.body, ''), coalesce(m.n, 0), nullif(ph, '{}'))
  returning * into row;
  if m.n > 0 and to_regprocedure('public.push_add(uuid, uuid[], text, text, text, text, text)') is not null then
    perform public.push_add(p_team, public.push_admins(p_team), 'chat_curse', '대화에서 욕설을 가렸어요',
      row.name || '님 글, ' || lbl, '#/chat/' || p_room, 'chat_curse:' || row.id);
  end if;
  perform public.chat_notify(row);
  return json_build_object('id', row.id, 'room', row.room, 'user_id', row.user_id, 'name', row.name, 'body', row.body,
    'masked', row.masked, 'hidden', row.hidden, 'kind', row.kind, 'photos', row.photos, 'created_at', row.created_at);
end $$;
revoke all on function public.chat_send(uuid, text, text, text[]) from public, anon;
grant execute on function public.chat_send(uuid, text, text, text[]) to authenticated;

-- 가리기: 글과 사진을 함께 가린다 (사진 파일은 남지만 아무도 못 본다)
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
  update public.chat set hidden = how, body = '', masked = 0, photos = null where id = p_id;
  return how;
end $$;
revoke all on function public.chat_hide(bigint) from public, anon;
grant execute on function public.chat_hide(bigint) to authenticated;
