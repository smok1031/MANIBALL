-- 휴대폰 알림(웹 푸시) 2026-11-19
-- 기기 구독(push_subs), 보낼 알림 목록(push_outbox), 설정(push_conf: 발송 키는 발송 함수가 Supabase 안에서 만들어 여기에만 둔다).
-- 데이터가 바뀌면 트리거가 보낼 알림을 쌓고, 발송 함수(Edge Function "push")를 깨운다. 시간에 따른 알림(투표 마감 전, 내전 인원)은 5분마다 찾는다.
-- 팀원: 라인업 공개, 투표 마감 3시간 전(아직 응답 안 했을 때), 벌금
-- 운영진: 가입 신청, 요청(포지션 변경, 용병 신청), 마감 뒤 불참 변경, 내전 인원
-- 바꾼 사람 본인에게는 보내지 않는다. 구독한 기기가 있는 사람에게만 쌓는다.

-- Supabase에서는 pg_net(발송 함수 깨우기)과 pg_cron(5분마다 찾기)을 켠다. 없는 곳(로컬 시험)에서는 건너뛴다
do $$ begin create extension if not exists pg_net with schema extensions; exception when others then raise notice 'pg_net 없음: %', sqlerrm; end $$;
do $$ begin create extension if not exists pg_cron with schema pg_catalog; exception when others then raise notice 'pg_cron 없음: %', sqlerrm; end $$;

create table if not exists public.push_subs (
  endpoint text primary key check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  ua text not null default '' check (char_length(ua) <= 40),
  created_at timestamptz not null default now(),
  last_ok timestamptz
);
create index if not exists push_subs_user_idx on public.push_subs(user_id);

create table if not exists public.push_outbox (
  id bigserial primary key,
  team_id uuid references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  url text not null default '#/',
  dedupe text unique,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  tries int not null default 0
);
create index if not exists push_outbox_wait_idx on public.push_outbox(created_at) where sent_at is null;

create table if not exists public.push_conf (
  id int primary key default 1 check (id = 1),
  vapid_public text,
  vapid_private jsonb,
  fn_url text,
  cron_key text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  updated_at timestamptz not null default now()
);
insert into public.push_conf (id) values (1) on conflict (id) do nothing;

-- 앱(로그인한 사람)과 비로그인은 세 표를 직접 못 본다. 아래 함수로만 쓴다
alter table public.push_subs enable row level security;
alter table public.push_outbox enable row level security;
alter table public.push_conf enable row level security;
revoke all on public.push_subs, public.push_outbox, public.push_conf from public, anon, authenticated;
revoke all on sequence public.push_outbox_id_seq from public, anon, authenticated;
grant select, insert, update, delete on public.push_subs, public.push_outbox, public.push_conf to service_role;
grant usage on sequence public.push_outbox_id_seq to service_role;

-- 앱이 쓰는 함수 ---------------------------------------------------------------
create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_ua text default '') returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'login_required' using errcode = '42501'; end if;
  insert into public.push_subs (endpoint, user_id, p256dh, auth, ua) values (p_endpoint, auth.uid(), p_p256dh, p_auth, left(coalesce(p_ua, ''), 40))
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, ua = excluded.ua, created_at = now();
  -- 한 사람 기기는 10대까지 (오래된 것부터 지움)
  delete from public.push_subs where user_id = auth.uid() and endpoint in (
    select endpoint from public.push_subs where user_id = auth.uid() order by created_at desc offset 10);
  return true;
end $$;

create or replace function public.push_unsubscribe(p_endpoint text) returns boolean
language sql security definer set search_path = public as $$
  with d as (delete from public.push_subs where endpoint = p_endpoint and user_id = auth.uid() returning 1) select exists (select 1 from d)
$$;

create or replace function public.push_mine(p_endpoint text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.push_subs where endpoint = p_endpoint and user_id = auth.uid())
$$;

revoke all on function public.push_subscribe(text, text, text, text), public.push_unsubscribe(text), public.push_mine(text) from public, anon;
grant execute on function public.push_subscribe(text, text, text, text), public.push_unsubscribe(text), public.push_mine(text) to authenticated;

-- 발송 함수(service_role)가 쓰는 함수 ---------------------------------------------
create or replace function public.push_conf_get() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('public', vapid_public, 'private', vapid_private, 'fn_url', fn_url, 'cron_key', cron_key) from public.push_conf where id = 1
$$;

-- 키가 없을 때만 넣는다(동시에 두 번 불려도 처음 것이 남음). 주소는 늘 갱신
create or replace function public.push_conf_init(p_public text, p_private jsonb, p_url text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  update public.push_conf set vapid_public = coalesce(vapid_public, p_public), vapid_private = coalesce(vapid_private, p_private),
    fn_url = coalesce(nullif(p_url, ''), fn_url), updated_at = now() where id = 1;
  return public.push_conf_get();
end $$;

-- 보낼 것 가져가기: 아직 안 보낸 것(하루 안, 5번 미만 시도)을 잠그고 시도 횟수를 올린다
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
    'subs', coalesce((select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)) from public.push_subs s where s.user_id = u.user_id), '[]'::jsonb))), '[]'::jsonb)
  into r from u;
  return r;
end $$;

-- 보낸 결과: 끝난 알림은 보냄으로, 없어진 구독(404, 410)은 지운다, 받은 기기는 받은 시각
create or replace function public.push_done(p_ids bigint[], p_gone text[], p_ok text[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.push_outbox set sent_at = now() where id = any(coalesce(p_ids, '{}'));
  delete from public.push_subs where endpoint = any(coalesce(p_gone, '{}'));
  update public.push_subs set last_ok = now() where endpoint = any(coalesce(p_ok, '{}'));
end $$;

-- 한 사람의 기기 (알림 켰어요 시험 발송용)
create or replace function public.push_subs_of(p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth)), '[]'::jsonb) from public.push_subs where user_id = p_user
$$;

revoke all on function public.push_conf_get(), public.push_conf_init(text, jsonb, text), public.push_take(int), public.push_done(bigint[], text[], text[]), public.push_subs_of(uuid) from public, anon, authenticated;
grant execute on function public.push_conf_get(), public.push_conf_init(text, jsonb, text), public.push_take(int), public.push_done(bigint[], text[], text[]), public.push_subs_of(uuid) to service_role;

-- 쌓기와 깨우기 -------------------------------------------------------------------
-- 발송 함수를 깨운다 (pg_net이 있고 함수 주소를 알 때만). 요청은 저장이 끝난 뒤 나간다
create or replace function public.push_kick() returns void
language plpgsql security definer set search_path = public as $$
declare c public.push_conf;
begin
  select * into c from public.push_conf where id = 1;
  if c.fn_url is null or to_regproc('net.http_post') is null then return; end if;
  execute 'select net.http_post(url := $1, body := ''{}''::jsonb, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''x-cron-key'', $2), timeout_milliseconds := 20000)'
    using c.fn_url, c.cron_key;
exception when others then null; -- 깨우기에 실패해도 저장은 그대로 (1분마다 다시 깨움)
end $$;

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

create or replace function public.push_admins(t uuid) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(user_id), '{}') from public.members where team_id = t and role in ('owner', 'admin')
$$;

create or replace function public.push_ev_label(ev jsonb) returns text
language sql immutable as $$
  select ltrim(substr(ev ->> 'date', 6, 2), '0') || '.' || substr(ev ->> 'date', 9, 2) || ' ' ||
    case ev ->> 'type' when 'scrim' then '내전' when 'match' then case when coalesce(ev ->> 'opponent', '') <> '' then 'vs ' || (ev ->> 'opponent') else '경기' end else '훈련' end
$$;

create or replace function public.push_won(v text) returns text
language sql immutable as $$
  select case when coalesce(v, '') ~ '^\d+$' then to_char(v::bigint, 'FM999,999,999,999') || '원' else '' end
$$;

revoke all on function public.push_kick(), public.push_add(uuid, uuid[], text, text, text, text, text), public.push_admins(uuid) from public, anon, authenticated;

-- 문서가 바뀌면 (라인업 공개, 마감 뒤 불참 변경, 포지션 변경 요청, 용병 신청, 벌금)
create or replace function public.push_docs_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op = 'UPDATE' then old.data else '{}'::jsonb end;
  n jsonb := new.data; tn text; nm text; k text; v jsonb; who text; uids uuid[]; ev jsonb;
begin
  if not exists (select 1 from public.push_subs) then return null; end if;
  select name into tn from public.teams where id = new.team_id;
  tn := coalesce(tn, '매니볼');
  if new.coll = 'events' then
    nm := public.push_ev_label(n);
    if coalesce(n ->> 'lineupAt', '') <> '' and (n ->> 'lineupAt') is distinct from (o ->> 'lineupAt') then
      select array_agg(m.user_id) into uids from public.docs d join public.members m on m.team_id = d.team_id and m.user_id::text = d.id
      where d.team_id = new.team_id and d.coll = 'rsvp' and d.data -> 'ev' -> new.id ->> 's' in ('yes', 'late');
      perform public.push_add(new.team_id, uids, 'lineup', tn, nm || ' 라인업이 나왔어요', '#/event/' || new.id, 'lineup:' || new.team_id || ':' || new.id || ':' || (n ->> 'lineupAt'));
    end if;
    for k, v in select * from jsonb_each(case when jsonb_typeof(n -> 'lateCancel') = 'object' then n -> 'lateCancel' else '{}'::jsonb end) loop
      if not (case when jsonb_typeof(o -> 'lateCancel') = 'object' then o -> 'lateCancel' else '{}'::jsonb end) ? k then
        select display_name into who from public.members where team_id = new.team_id and user_id::text = k;
        perform public.push_add(new.team_id, public.push_admins(new.team_id), 'cancel', tn,
          nm || ' ' || coalesce(nullif(who, ''), '팀원') || ' 불참 변경' || case when public.push_won(v ->> 'amount') <> '' and (v ->> 'amount') <> '0' then ', 벌금 ' || public.push_won(v ->> 'amount') else '' end,
          '#/manage/' || new.id, 'cancel:' || new.team_id || ':' || new.id || ':' || k || ':' || coalesce(v ->> 't', ''));
      end if;
    end loop;
  elsif new.coll = 'rsvp' then
    if jsonb_typeof(n -> 'posReq') = 'object' and n -> 'posReq' ->> 'status' = 'req'
       and ((o -> 'posReq' ->> 'status') is distinct from 'req' or (o -> 'posReq' ->> 'at') is distinct from (n -> 'posReq' ->> 'at')) then
      select display_name into who from public.members where team_id = new.team_id and user_id::text = new.id;
      perform public.push_add(new.team_id, public.push_admins(new.team_id), 'req', tn,
        coalesce(nullif(who, ''), '팀원') || ' 님 포지션 변경 요청 ' || concat_ws(', ', nullif(n -> 'posReq' ->> 'pos1', ''), nullif(n -> 'posReq' ->> 'pos2', '')),
        '#/posreqs', 'pos:' || new.team_id || ':' || new.id || ':' || coalesce(n -> 'posReq' ->> 'at', ''));
    end if;
  elsif new.coll = 'guestreq' then
    for k, v in select * from jsonb_each(case when jsonb_typeof(n -> 'items') = 'object' then n -> 'items' else '{}'::jsonb end) loop
      if v ->> 'status' = 'req' and (o -> 'items' -> k ->> 'status') is distinct from 'req' then
        select display_name into who from public.members where team_id = new.team_id and user_id::text = new.id;
        select data into ev from public.docs where team_id = new.team_id and coll = 'events' and id = v ->> 'eid';
        perform public.push_add(new.team_id, public.push_admins(new.team_id), 'req', tn,
          coalesce(nullif(who, ''), '팀원') || ' 님이 ' || coalesce(public.push_ev_label(ev), '일정') || '에 ' || coalesce(nullif(v ->> 'name', ''), '용병') || ' 님 용병 신청',
          '#/merc/' || coalesce(v ->> 'eid', ''), 'merc:' || new.team_id || ':' || new.id || ':' || k);
      end if;
    end loop;
  elsif new.coll = 'mydues' and new.id ~ '^[0-9a-f-]{36}$' then
    for v in select * from jsonb_array_elements(case when jsonb_typeof(n -> 'fines') = 'array' then n -> 'fines' else '[]'::jsonb end) loop
      if coalesce(v ->> 'paid', 'false') <> 'true' and coalesce(v ->> 'at', '') <> ''
         and not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(o -> 'fines') = 'array' then o -> 'fines' else '[]'::jsonb end) x where x ->> 'at' = v ->> 'at') then
        perform public.push_add(new.team_id, array[new.id::uuid], 'fine', tn,
          coalesce(nullif(v ->> 'reason', ''), '벌금') || ' ' || public.push_won(v ->> 'amount') || '이 매겨졌어요', '#/money',
          'fine:' || new.team_id || ':' || new.id || ':' || (v ->> 'at'));
      end if;
    end loop;
  end if;
  return null;
exception when others then
  raise warning 'push_docs_trg: %', sqlerrm; -- 알림 때문에 저장이 실패하지 않게
  return null;
end $$;
revoke all on function public.push_docs_trg() from public, anon, authenticated;
drop trigger if exists push_docs on public.docs;
create trigger push_docs after insert or update on public.docs for each row execute function public.push_docs_trg();

-- 가입 신청
create or replace function public.push_join_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare tn text;
begin
  if new.status <> 'pending' or (tg_op = 'UPDATE' and old.status = 'pending' and old.created_at = new.created_at) then return null; end if;
  if not exists (select 1 from public.push_subs) then return null; end if;
  select name into tn from public.teams where id = new.team_id;
  perform public.push_add(new.team_id, public.push_admins(new.team_id), 'join', coalesce(tn, '매니볼'),
    coalesce(nullif(new.display_name, ''), '새 사람') || ' 님 가입 신청', '#/requests', 'join:' || new.team_id || ':' || new.user_id || ':' || new.created_at);
  return null;
exception when others then
  raise warning 'push_join_trg: %', sqlerrm;
  return null;
end $$;
revoke all on function public.push_join_trg() from public, anon, authenticated;
drop trigger if exists push_join on public.join_requests;
create trigger push_join after insert or update on public.join_requests for each row execute function public.push_join_trg();

-- 시간에 따른 알림 (5분마다) -------------------------------------------------------
create or replace function public.push_scan() returns int
language plpgsql security definer set search_path = public as $$
declare r record; dl timestamptz; uids uuid[]; st jsonb; sdays int; smin int; cnt int; tn text; total int := 0;
begin
  delete from public.push_outbox where created_at < now() - interval '7 days';
  if not exists (select 1 from public.push_subs) then return 0; end if;
  for r in select d.team_id, d.id, d.data from public.docs d where d.coll = 'events'
      and coalesce(d.data ->> 'date', '') ~ '^\d{4}-\d{2}-\d{2}$' and (d.data ->> 'date')::date between current_date - 1 and current_date + 8 loop
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
  return total;
end $$;

-- 안 보낸 것이 남아 있으면 깨운다 (1분마다)
create or replace function public.push_kick_pending() returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.push_outbox where sent_at is null and tries < 5 and created_at > now() - interval '1 day') then perform public.push_kick(); end if;
end $$;
revoke all on function public.push_scan(), public.push_kick_pending() from public, anon, authenticated;

do $$
begin
  if to_regproc('cron.schedule') is not null then
    perform cron.schedule('mb-push-scan', '*/5 * * * *', 'select public.push_scan()');
    perform cron.schedule('mb-push-kick', '* * * * *', 'select public.push_kick_pending()');
  end if;
end $$;
