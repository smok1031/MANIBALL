-- 2026-11-24 요청 횟수 제한 (AI나 스크립트로 같은 요청을 빠르게 반복하는 것 막기)
--   rl_hit(종류, 횟수, 초): 같은 사람이 그 종류를 정한 초 안에 정한 횟수 넘게 하면 too_fast 로 막는다.
--   표마다 쓰기 전에 검사한다 (서버 함수 안에서 써도 걸린다). 서버 작업(로그인 없는 예약 작업)은 세지 않는다.
--   팀원 문서 쓰기: 10초에 20번 / 매칭, 구인 글: 1분에 20번 / 신청과 수락: 1분에 30번 / 평가: 1분에 30번
--   가입 신청: 1분에 5번 / 문의: 1분에 3번 / 대화: 5초에 5개
--   운영진의 팀 문서 쓰기(라인업 저장, 엑셀로 선수 넣기 등)는 한 번에 여러 개를 쓰므로 세지 않는다.
-- 여러 번 실행해도 안전하다. 데이터는 지우거나 바꾸지 않는다.

create table if not exists public.rl (
  user_id uuid not null,
  k text not null,
  at timestamptz not null default clock_timestamp()
);
create index if not exists rl_user_k_at on public.rl (user_id, k, at);
alter table public.rl enable row level security;
revoke all on public.rl from public, anon, authenticated;

create or replace function public.rl_hit(p_k text, p_n int, p_secs int) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then return; end if;
  delete from public.rl where user_id = me and k = p_k and at < clock_timestamp() - make_interval(secs => greatest(p_secs, 60));
  if (select count(*) from public.rl where user_id = me and k = p_k and at > clock_timestamp() - make_interval(secs => p_secs)) >= p_n then
    raise exception 'too_fast' using errcode = '42501';
  end if;
  insert into public.rl (user_id, k) values (me, p_k);
end $$;
revoke all on function public.rl_hit(text, int, int) from public, anon, authenticated;

create or replace function public.rl_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare rk text;
begin
  if auth.uid() is null then return new; end if;
  -- 같은 줄을 "넣고 있으면 고치기"(upsert)로 쓰면 넣기와 고치기가 연달아 불린다. 한 번으로 센다.
  rk := tg_table_name || ':' || coalesce(to_jsonb(new) ->> 'team_id', '') || ':' || coalesce(to_jsonb(new) ->> 'coll', '') || ':' || coalesce(to_jsonb(new) ->> 'id', '');
  if tg_op = 'UPDATE' and current_setting('mb.rl_last', true) = rk then
    perform set_config('mb.rl_last', '', true);
    return new;
  end if;
  perform set_config('mb.rl_last', case when tg_op = 'INSERT' then rk else '' end, true);
  if tg_table_name = 'docs' then
    if public.is_admin(new.team_id) then return new; end if;
    perform public.rl_hit('docs', 20, 10);
  elsif tg_table_name = 'xposts' then perform public.rl_hit('xposts', 20, 60);
  elsif tg_table_name = 'xapps' then perform public.rl_hit('xapps', 30, 60);
  elsif tg_table_name = 'xrates' then perform public.rl_hit('xrates', 30, 60);
  elsif tg_table_name = 'join_requests' then perform public.rl_hit('join', 5, 60);
  elsif tg_table_name = 'inquiries' then perform public.rl_hit('inquiry', 3, 60);
  end if;
  return new;
end $$;
revoke all on function public.rl_guard() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['docs', 'xposts', 'xapps', 'xrates', 'join_requests', 'inquiries'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists rl_guard on public.%I', t);
      execute format('create trigger rl_guard before insert or update on public.%I for each row execute function public.rl_guard()', t);
    end if;
  end loop;
end $$;

-- 대화: 5초에 5개까지 (전에는 10초에 5개)
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
  if (select count(*) from public.chat where user_id = me and created_at > now() - interval '5 seconds') >= 5 then
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

grant execute on function public.chat_send(uuid, text, text) to authenticated;
