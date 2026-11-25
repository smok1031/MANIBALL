-- 2026-11-25 b: 운영진 대화방(room 'ops'), 카카오톡 알림 끄기(웹 푸시만). 시안 승인분

-- 운영진 대화방: 운영진(owner, admin)만 읽고 쓴다. 팀원으로 바뀌면 바로 못 본다(읽기 권한을 그때그때 확인)



create or replace function public.chat_room_open(t uuid, r text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when r in ('all', 'ops') then exists (select 1 from public.teams where id = t)
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

create or replace function public.chat_can_read(t uuid, r text, at timestamptz) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when r like 'm-%' then public.chat_match_ok(t, r)
    when r = 'ops' then public.is_admin(t)
    when public.is_member(t) then true
    when r = 'all' then false
    else at >= coalesce(public.chat_merc_since(t, r), 'infinity'::timestamptz) end
$$;

create or replace function public.chat_people(t uuid, r text) returns uuid[]
language plpgsql stable security definer set search_path = public as $$
declare out uuid[]; ev jsonb; o text;
begin
  if r = 'ops' then
    select array_agg(user_id) into out from public.members where team_id = t and role in ('owner', 'admin');
  elsif r = 'all' then
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
  if c.room = 'ops' then title := '운영진 대화방';
  elsif c.room = 'all' then title := '전체 대화방';
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

revoke all on function public.chat_room_open(uuid, text), public.chat_can_read(uuid, text, timestamptz) from public, anon;
grant execute on function public.chat_can_read(uuid, text, timestamptz), public.chat_room_open(uuid, text) to authenticated;
revoke all on function public.chat_send(uuid, text, text) from public, anon;
grant execute on function public.chat_send(uuid, text, text) to authenticated;


-- 카카오톡 알림은 없앴다 (2026-11-25): 알림은 앱(웹 푸시)으로만, 늘 무음. 카카오 연결 자료(push_kakao)는 지우지 않고 쓰지 않는다

create or replace function public.push_add(p_team uuid, p_uids uuid[], p_kind text, p_title text, p_body text, p_url text, p_key text) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.push_outbox (team_id, user_id, kind, title, body, url, dedupe)
  select p_team, u, p_kind, left(p_title, 60), left(p_body, 180), p_url, left(p_key, 300) || ':' || u
  from (select distinct unnest(coalesce(p_uids, '{}')) u) x
  where u is not null and u is distinct from auth.uid() and exists (select 1 from public.push_subs s where s.user_id = x.u)
    -- 같은 사람에게 같은 알림은 10분에 한 번 (요청을 되풀이해 운영진 휴대폰을 울리지 못하게)
    and not exists (select 1 from public.push_outbox b where b.user_id = x.u and b.kind = p_kind and b.body = left(p_body, 180) and b.created_at > now() - interval '10 minutes')
  on conflict (dedupe) do nothing;
  get diagnostics n = row_count;
  if n > 0 then perform public.push_kick(); end if;
  return n;
end $$;

create or replace function public.push_take(p_limit int default 100) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  with c as (
    select o.id from public.push_outbox o
    where o.sent_at is null and o.tries < 5 and o.created_at > now() - interval '1 day'
    order by o.id limit greatest(1, least(p_limit, 500)) for update skip locked
  ), u as (
    update public.push_outbox o set tries = o.tries + 1 from c where o.id = c.id returning o.*
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'team', u.team_id, 'title', u.title, 'body', u.body, 'url', u.url, 'tag', u.kind || ':' || u.id,
    'user', u.user_id,
    'kakao', null,
    'subs', coalesce((select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)) from public.push_subs s where s.user_id = u.user_id), '[]'::jsonb))), '[]'::jsonb)
  into r from u;
  return r;
end $$;

revoke all on function public.push_take(int) from public, anon, authenticated;
grant execute on function public.push_take(int) to service_role;
revoke all on function public.push_add(uuid, uuid[], text, text, text, text, text) from public, anon, authenticated;
