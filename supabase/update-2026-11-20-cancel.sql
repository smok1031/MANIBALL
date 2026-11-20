-- 2026-11-20 경기 취소: 운영진이 사유를 남기고 일정을 취소하면 팀원 모두에게 알린다 (59번 시안)
-- 취소는 일정 문서(events)의 cancel = { at, by, reason, text } 한 칸이다. 일정 쓰기는 원래대로 운영진만 할 수 있다.
-- 취소된 일정에는 팀원이 참석 응답을 바꾸거나 마감 뒤 불참 변경(late_cancel)을 할 수 없다. 벌금도 생기지 않는다.
-- 취소를 되돌리면(cancel 칸을 지우면) 다시 열리고, 취소 전에 받은 투표는 그대로 남아 있다.

-- 1. 취소된 일정에는 팀원의 참석 응답을 막는다 (운영진과 SQL Editor는 그대로)
create or replace function public.docs_cancel_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op = 'UPDATE' then old.data else '{}'::jsonb end;
  k text; ne jsonb;
begin
  if auth.uid() is null or public.is_admin(new.team_id) then return new; end if;
  if jsonb_typeof(new.data -> 'ev') <> 'object' then return new; end if;
  for k, ne in select * from jsonb_each(new.data -> 'ev') loop
    if ne is not distinct from (o -> 'ev' -> k) then continue; end if;
    if exists (select 1 from public.docs e where e.team_id = new.team_id and e.coll = 'events' and e.id = k and jsonb_typeof(e.data -> 'cancel') = 'object') then
      raise exception 'event_canceled' using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;
revoke all on function public.docs_cancel_guard() from public, anon, authenticated;
drop trigger if exists docs_cancel_guard on public.docs;
create trigger docs_cancel_guard before insert or update on public.docs for each row when (new.coll = 'rsvp') execute function public.docs_cancel_guard();

-- 2. 휴대폰 알림: 취소하면 팀원 모두에게, 되돌리면 다시 열렸다고 (취소한 운영진 본인은 빼고)
create or replace function public.push_cancel_trg() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op = 'UPDATE' then old.data else '{}'::jsonb end;
  n jsonb := new.data; tn text; nm text; uids uuid[];
begin
  if to_regclass('public.push_subs') is null then return null; end if;
  if (n -> 'cancel' ->> 'at') is not distinct from (o -> 'cancel' ->> 'at') then return null; end if;
  select name into tn from public.teams where id = new.team_id;
  tn := coalesce(tn, '매니볼');
  nm := public.push_ev_label(n);
  select array_agg(user_id) into uids from public.members where team_id = new.team_id;
  if jsonb_typeof(n -> 'cancel') = 'object' then
    perform public.push_add(new.team_id, uids, 'evcancel', tn,
      nm || ' 일정이 취소됐어요. 사유: ' || coalesce(nullif(n -> 'cancel' ->> 'reason', ''), '운영진 결정'),
      '#/event/' || new.id, 'evcancel:' || new.team_id || ':' || new.id || ':' || (n -> 'cancel' ->> 'at'));
  elsif jsonb_typeof(o -> 'cancel') = 'object' then
    perform public.push_add(new.team_id, uids, 'evcancel', tn, nm || ' 일정이 다시 열렸어요', '#/event/' || new.id,
      'evreopen:' || new.team_id || ':' || new.id || ':' || (o -> 'cancel' ->> 'at'));
  end if;
  return null;
exception when others then
  raise warning 'push_cancel_trg: %', sqlerrm; -- 알림 때문에 저장이 실패하지 않게
  return null;
end $$;
revoke all on function public.push_cancel_trg() from public, anon, authenticated;
drop trigger if exists push_cancel on public.docs;
create trigger push_cancel after update on public.docs for each row when (new.coll = 'events') execute function public.push_cancel_trg();

-- 3. 취소된 일정에는 "투표 마감 3시간 전" 알림과 내전 인원 알림을 보내지 않는다
create or replace function public.push_scan() returns int
language plpgsql security definer set search_path = public as $$
declare r record; dl timestamptz; uids uuid[]; st jsonb; sdays int; smin int; cnt int; tn text; total int := 0;
begin
  delete from public.push_outbox where created_at < now() - interval '7 days';
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
  return total;
end $$;
revoke all on function public.push_scan() from public, anon, authenticated;
