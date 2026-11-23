-- 2026-11-23 대화: 일정마다 방 하나 (방 이름 = 일정 id)
-- 글은 서버 함수로만 쓰고 가린다. 표를 직접 쓰거나 고칠 수 없다.
--   chat_send(팀, 방, 글): 같은 팀 사람만, 열린 방(취소되지 않았고 일정 날짜가 오늘이거나 앞)만.
--     욕설은 서버에서 그 단어만 *** 로 가리고, 가린 글이 있으면 운영진에게 휴대폰 알림을 보낸다.
--     10초에 5개를 넘게 보내면 막는다 (도배 막기).
--   chat_hide(글 id): 내 글은 내가, 남의 글은 운영진이 가린다. 가린 글은 내용을 지워 다른 사람이 읽을 수 없다.
-- 여러 번 실행해도 안전하다.

create table if not exists public.chat (
  id bigint generated always as identity primary key,
  team_id uuid not null references public.teams(id) on delete cascade,
  room text not null check (room ~ '^[A-Za-z0-9_:.@+-]{1,80}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '' check (char_length(name) <= 30),
  body text not null default '' check (char_length(body) <= 1000),
  masked smallint not null default 0,
  hidden text check (hidden in ('self', 'admin')),
  created_at timestamptz not null default now()
);
create index if not exists chat_room_idx on public.chat(team_id, room, id);
create index if not exists chat_user_idx on public.chat(user_id, created_at);
alter table public.chat replica identity full;
alter table public.chat enable row level security;

-- 읽기: 그 팀 사람만. 쓰기와 고치기는 아래 함수로만 (표 권한을 주지 않는다)
drop policy if exists chat_read on public.chat;
create policy chat_read on public.chat for select to authenticated using (public.is_member(team_id));
revoke all on public.chat from public, anon, authenticated;
grant select on public.chat to authenticated;

-- 실시간: 새 글과 가린 글이 바로 보이게
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat') then
    execute 'alter publication supabase_realtime add table public.chat';
  end if;
end $$;

-- 점검 중에는 쓰기를 막는다 (다른 표와 같은 문지기)
do $$ begin
  if to_regprocedure('public.maintenance_guard()') is not null then
    execute 'drop trigger if exists maintenance_guard on public.chat';
    execute 'create trigger maintenance_guard before insert or update or delete on public.chat for each row execute function public.maintenance_guard()';
  end if;
end $$;

-- 욕설 가리기: 그 단어만 *** 로. 띄어쓰기, 숫자, 특수문자를 끼워 넣어도 잡는다.
-- 띄어 쓴 욕설은 단어 첫머리에서 시작할 때만 잡는다 ('다시 발로'처럼 멀쩡한 말이 걸리지 않게).
-- '시발점'처럼 멀쩡한 말은 먼저 빼 둔다.
create or replace function public.chat_mask(p text, out body text, out n int)
language plpgsql immutable set search_path = '' as $$
declare
  bad text[] := array['씨발', '시발', '씨빨', '개새끼', '병신', '지랄', '존나', '좆', 'ㅅㅂ', 'ㅆㅂ', 'ㅄ', 'ㅂㅅ', 'ㅈㄴ'];
  okw text[] := array['시발점', '시발역'];
  gap text := '[[:digit:]_.,!?~*^-]*';
  gapw text := '[[:space:][:digit:]_.,!?~*^-]*';
  re text := '';
  w text; parts text[]; i int;
begin
  body := coalesce(p, ''); n := 0;
  foreach w in array bad loop
    parts := regexp_split_to_array(w, '');
    re := re || case when re = '' then '' else '|' end
      || '(?<![가-힣ㄱ-ㅎ])' || array_to_string(parts, gapw) || '|' || array_to_string(parts, gap);
  end loop;
  for i in 1 .. array_length(okw, 1) loop body := replace(body, okw[i], chr(1) || i || chr(1)); end loop;
  select count(*) into n from regexp_matches(body, re, 'g');
  if n > 0 then body := regexp_replace(body, re, '***', 'g'); end if;
  for i in 1 .. array_length(okw, 1) loop body := replace(body, chr(1) || i || chr(1), okw[i]); end loop;
end $$;

-- 방이 열려 있는지: 그 팀 일정이 있고, 취소되지 않았고, 일정 날짜가 오늘(한국 시간)이거나 앞
create or replace function public.chat_room_open(t uuid, r text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.docs d
    where d.team_id = t and d.coll = 'events' and d.id = r
      and coalesce(d.data -> 'cancel' ->> 'at', '') = ''
      and coalesce(d.data ->> 'date', '') ~ '^\d{4}-\d{2}-\d{2}$'
      and (d.data ->> 'date')::date >= (now() at time zone 'Asia/Seoul')::date
  )
$$;

create or replace function public.chat_send(p_team uuid, p_room text, p_body text) returns json
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  b text := btrim(coalesce(p_body, ''));
  m record; nm text; ev jsonb; row public.chat;
begin
  if me is null or not public.is_member(p_team) then raise exception 'not_member' using errcode = '42501'; end if;
  if char_length(b) = 0 or char_length(b) > 1000 then raise exception 'bad_body' using errcode = '22023'; end if;
  if p_room is null or p_room !~ '^[A-Za-z0-9_:.@+-]{1,80}$' then raise exception 'no_room' using errcode = '22023'; end if;
  select data into ev from public.docs where team_id = p_team and coll = 'events' and id = p_room;
  if ev is null then raise exception 'no_room' using errcode = '22023'; end if;
  if not public.chat_room_open(p_team, p_room) then raise exception 'room_closed' using errcode = '42501'; end if;
  if (select count(*) from public.chat where user_id = me and created_at > now() - interval '10 seconds') >= 5 then
    raise exception 'too_fast' using errcode = '42501';
  end if;
  select * into m from public.chat_mask(b);
  select left(coalesce(nullif(display_name, ''), '이름 없음'), 30) into nm from public.members where team_id = p_team and user_id = me;
  insert into public.chat (team_id, room, user_id, name, body, masked)
  values (p_team, p_room, me, coalesce(nm, '이름 없음'), m.body, m.n)
  returning * into row;
  -- 욕설을 가렸으면 운영진에게 경고 알림 (휴대폰 알림을 켠 운영진만, 같은 알림은 10분에 한 번)
  if m.n > 0 and to_regprocedure('public.push_add(uuid, uuid[], text, text, text, text, text)') is not null then
    perform public.push_add(p_team, public.push_admins(p_team), 'chat_curse', '대화에서 욕설을 가렸어요',
      row.name || '님 글, ' || public.push_ev_label(ev) || ' 방', '#/chat/' || p_room, 'chat_curse:' || row.id);
  end if;
  return json_build_object('id', row.id, 'room', row.room, 'user_id', row.user_id, 'name', row.name, 'body', row.body,
    'masked', row.masked, 'hidden', row.hidden, 'created_at', row.created_at);
end $$;

create or replace function public.chat_hide(p_id bigint) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c public.chat; how text;
begin
  select * into c from public.chat where id = p_id;
  if c.id is null or me is null or not public.is_member(c.team_id) then raise exception 'no_msg' using errcode = '42501'; end if;
  if c.hidden is not null then return c.hidden; end if;
  if not public.chat_room_open(c.team_id, c.room) then raise exception 'room_closed' using errcode = '42501'; end if;
  if c.user_id = me then how := 'self';
  elsif public.is_admin(c.team_id) then how := 'admin';
  else raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.chat set hidden = how, body = '', masked = 0 where id = p_id;
  return how;
end $$;

revoke all on function public.chat_mask(text), public.chat_room_open(uuid, text), public.chat_send(uuid, text, text), public.chat_hide(bigint) from public, anon, authenticated;
grant execute on function public.chat_send(uuid, text, text), public.chat_hide(bigint) to authenticated;
