-- 2026-11-15 투표 마감 후 불참 변경
-- 1) 투표 마감을 서버에서도 지킨다: 경기 전날 정한 시각(voteClose = eve, voteTime) 또는 예전 값(eve21, day06), 아니면 경기 시작
-- 2) 마감 뒤 경기 시작 전까지는 본인이 불참 변경을 신청할 수 있다. 바로 불참으로 바뀌고, 팀 수칙의 불참(취소) 벌금이 붙는다
--    대기 순서는 참석 응답 시각으로 정해지니, 한 명이 빠지면 대기 1번이 저절로 참석이 된다
create or replace function public.vote_deadline(ev jsonb) returns timestamptz
language sql stable set search_path = '' as $$
  select least(public.event_start(ev), case
    when ev ->> 'voteClose' in ('eve', 'eve21') then
      (((ev ->> 'date')::date - 1) + (case when ev ->> 'voteClose' = 'eve' and coalesce(ev ->> 'voteTime', '') ~ '^\d\d:\d\d$' then (ev ->> 'voteTime')::time else time '21:00' end)) at time zone 'Asia/Seoul'
    when ev ->> 'voteClose' = 'day06' then (((ev ->> 'date')::date) + time '06:00') at time zone 'Asia/Seoul'
    else public.event_start(ev) end)
$$;
revoke all on function public.vote_deadline(jsonb) from public, anon, authenticated;

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
        -- 투표 마감(경기 전날 몇 시, 또는 경기 시작) 뒤에는 바꿀 수 없다. 마감 후 불참 변경(late_cancel)만 예외
        if clock_timestamp() >= public.vote_deadline(ev) and coalesce(current_setting('maniball.late_cancel', true), '') <> '1' then raise exception 'vote_closed' using errcode = '42501'; end if;
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


-- 마감 후 불참 변경: 본인만, 마감 뒤부터 경기 시작 전까지, 참석이나 늦참이었을 때만. 벌금이 있으면 동의해야 한다
create or replace function public.late_cancel(p_team uuid, p_event text, p_reason text, p_agree boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare ev jsonb; r jsonb; s jsonb; me text := auth.uid()::text; amt int := 0; lab text := ''; nowiso text; fine jsonb; old_at text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if public.team_role(p_team) is null then raise exception 'not_member'; end if;
  select data into ev from public.docs where team_id = p_team and coll = 'events' and id = p_event;
  if ev is null then raise exception 'no_event'; end if;
  if clock_timestamp() >= public.event_start(ev) then raise exception 'event_started'; end if;
  if clock_timestamp() < public.vote_deadline(ev) then raise exception 'not_closed'; end if;
  select data -> 'ev' -> p_event into r from public.docs where team_id = p_team and coll = 'rsvp' and id = me;
  if coalesce(r ->> 's', '') not in ('yes', 'late') then raise exception 'not_going'; end if;
  old_at := coalesce(r ->> 'at', '');
  -- 팀 수칙의 불참(취소) 벌금: kind 가 cancel 이거나, 이름에 취소나 불참이 들어간 수칙 (지각, 결석 수칙은 빼고)
  select data into s from public.docs where team_id = p_team and coll = 'team' and id = 'settings';
  select coalesce((x ->> 'amount')::int, 0), coalesce(x ->> 'label', '') into amt, lab
    from jsonb_array_elements(case when jsonb_typeof(s -> 'rules') = 'array' then s -> 'rules' else '[]'::jsonb end) x
    where coalesce(x ->> 'kind', '') = 'cancel' or (coalesce(x ->> 'kind', '') = '' and x ->> 'label' !~ '지각|결석' and x ->> 'label' ~ '취소|불참')
    limit 1;
  amt := coalesce(amt, 0);
  if amt > 0 and not coalesce(p_agree, false) then raise exception 'need_agree'; end if;
  nowiso := to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  perform set_config('maniball.late_cancel', '1', true);
  update public.docs set data = jsonb_set(data, array['ev', p_event], (data -> 'ev' -> p_event) || jsonb_build_object('s', 'no', 'lateCancel', nowiso, 'reason', left(trim(coalesce(p_reason, '')), 80)))
    where team_id = p_team and coll = 'rsvp' and id = me;
  perform set_config('maniball.late_cancel', '', true);
  -- 일정에 남긴다: 운영진 알림과, 대기에서 올라온 사람 알림에 쓴다
  update public.docs set data = jsonb_set(data, '{lateCancel}', coalesce(case when jsonb_typeof(data -> 'lateCancel') = 'object' then data -> 'lateCancel' end, '{}'::jsonb)
      || jsonb_build_object(me, jsonb_build_object('t', nowiso, 'at', old_at, 'amount', amt, 'reason', left(trim(coalesce(p_reason, '')), 80))))
    where team_id = p_team and coll = 'events' and id = p_event;
  if amt > 0 then
    fine := jsonb_build_object('id', 'fc-' || p_event || '-' || me, 'uid', me, 'date', ev ->> 'date', 'eventId', p_event, 'reason', '마감 후 불참', 'amount', amt, 'paid', false, 'paidAt', '');
    insert into public.docs (team_id, coll, id, data) values (p_team, 'fines', 'fc-' || p_event || '-' || me, fine - 'id')
      on conflict (team_id, coll, id) do nothing;
    insert into public.docs (team_id, coll, id, data) values (p_team, 'mydues', me, jsonb_build_object('fines', jsonb_build_array(fine - 'uid')))
      on conflict (team_id, coll, id) do update set data = jsonb_set(public.docs.data, '{fines}',
        coalesce(case when jsonb_typeof(public.docs.data -> 'fines') = 'array' then public.docs.data -> 'fines' end, '[]'::jsonb)
        || case when exists (select 1 from jsonb_array_elements(case when jsonb_typeof(public.docs.data -> 'fines') = 'array' then public.docs.data -> 'fines' else '[]'::jsonb end) f where f ->> 'id' = fine ->> 'id') then '[]'::jsonb else jsonb_build_array(fine - 'uid') end);
  end if;
  return jsonb_build_object('amount', amt, 'label', lab);
end $$;
revoke all on function public.late_cancel(uuid, text, text, boolean) from public, anon;
grant execute on function public.late_cancel(uuid, text, text, boolean) to authenticated;
