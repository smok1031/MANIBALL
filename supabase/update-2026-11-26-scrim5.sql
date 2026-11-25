-- 내전 정하는 날 기본값을 경기 3일 전에서 5일 전으로 바꿔요.
-- 팀 규칙에서 내전 정하는 날을 직접 저장한 팀은 그 값을 그대로 써요.
-- push_scan 안의 기본값만 바뀌고 나머지는 update-2026-11-25-sian.sql 그대로예요.

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
      sdays := case when coalesce(st ->> 'scrimDays', '') ~ '^\d+$' then (st ->> 'scrimDays')::int else 5 end;
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

revoke all on function public.push_scan() from public, anon, authenticated;
