-- 2026-11-17 뉴버전
-- 1) 불참 벌금 기준 시각 (기본 운영 규칙, Admin이 정함): 투표 마감 뒤(close), 경기 당일 0시(day), 직접 정하기(custom: 경기 N일 전 오전/오후 H시). 투표 마감보다 늦을 수 없다
--    그 시각이 지나면 정원 안의 참석, 늦참은 불참 변경(late_cancel, 사유와 벌금)으로만 불참이 된다. 투표가 열려 있어도 같다
-- 2) 가입 승인제: Admin이 끄면 초대 링크로 들어온 사람이 신청 없이 바로 팀원이 된다
-- 3) 위 두 설정과 벌금 기준 칸은 Admin만 바꾼다
-- 운영 서버에는 아직 넣지 않는다 (테스트 서버에서 확인한 뒤)

create or replace function public.fine_start(ev jsonb, s jsonb) returns timestamptz
language plpgsql stable set search_path = '' as $$
declare dl timestamptz := public.vote_deadline(ev); d0 timestamptz; t timestamptz; n int; h int;
begin
  d0 := ((ev ->> 'date')::date + time '00:00') at time zone 'Asia/Seoul';
  if coalesce(s ->> 'fineFrom', '') = 'day' then t := d0;
  elsif coalesce(s ->> 'fineFrom', '') = 'custom' then
    n := greatest(1, least(14, coalesce(nullif(regexp_replace(coalesce(s ->> 'fineDays', ''), '\D', '', 'g'), '')::int, 1)));
    h := greatest(1, least(12, coalesce(nullif(regexp_replace(coalesce(s ->> 'fineHour', ''), '\D', '', 'g'), '')::int, 12)));
    h := case when coalesce(s ->> 'fineAp', 'pm') = 'am' then (case when h = 12 then 0 else h end) else (case when h = 12 then 12 else h + 12 end) end;
    t := d0 - make_interval(days => n) + make_interval(hours => h);
  else t := dl; end if;
  return least(t, dl);
end $$;

create or replace function public.docs_member_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op = 'UPDATE' then old.data else '{}'::jsonb end;
  n jsonb := new.data;
  k text; ne jsonb; oe jsonb; ev jsonb; nowiso text; keep_at text; pid text; cap int; ahead int;
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
              where coalesce(nullif(gg.value ->> 'at', ''), '~') < coalesce(nullif(oe ->> 'at', ''), '~'));
          end if;
          if cap = 0 or ahead < cap then raise exception 'need_late_cancel' using errcode = '42501'; end if;
        end if;
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

create or replace function public.late_cancel(p_team uuid, p_event text, p_reason text, p_agree boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare ev jsonb; r jsonb; s jsonb; me text := auth.uid()::text; amt int := 0; lab text := ''; nowiso text; fine jsonb; old_at text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if public.team_role(p_team) is null then raise exception 'not_member'; end if;
  select data into ev from public.docs where team_id = p_team and coll = 'events' and id = p_event;
  if ev is null then raise exception 'no_event'; end if;
  if clock_timestamp() >= public.event_start(ev) then raise exception 'event_started'; end if;
  select data into s from public.docs where team_id = p_team and coll = 'team' and id = 'settings';
  if clock_timestamp() < public.fine_start(ev, coalesce(s, '{}'::jsonb)) then raise exception 'not_closed'; end if;
  select data -> 'ev' -> p_event into r from public.docs where team_id = p_team and coll = 'rsvp' and id = me;
  if coalesce(r ->> 's', '') not in ('yes', 'late') then raise exception 'not_going'; end if;
  old_at := coalesce(r ->> 'at', '');
  -- 팀 수칙의 불참(취소) 벌금: kind 가 cancel 이거나, 이름에 취소나 불참이 들어간 수칙 (지각, 결석 수칙은 빼고)
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
    fine := jsonb_build_object('id', 'fc-' || p_event || '-' || me, 'uid', me, 'date', ev ->> 'date', 'eventId', p_event, 'reason', coalesce(nullif(lab, ''), '마감 후 불참'), 'amount', amt, 'paid', false, 'paidAt', '');
    insert into public.docs (team_id, coll, id, data) values (p_team, 'fines', 'fc-' || p_event || '-' || me, fine - 'id')
      on conflict (team_id, coll, id) do nothing;
    insert into public.docs (team_id, coll, id, data) values (p_team, 'mydues', me, jsonb_build_object('fines', jsonb_build_array(fine - 'uid')))
      on conflict (team_id, coll, id) do update set data = jsonb_set(public.docs.data, '{fines}',
        coalesce(case when jsonb_typeof(public.docs.data -> 'fines') = 'array' then public.docs.data -> 'fines' end, '[]'::jsonb)
        || case when exists (select 1 from jsonb_array_elements(case when jsonb_typeof(public.docs.data -> 'fines') = 'array' then public.docs.data -> 'fines' else '[]'::jsonb end) f where f ->> 'id' = fine ->> 'id') then '[]'::jsonb else jsonb_build_array(fine - 'uid') end);
  end if;
  return jsonb_build_object('amount', amt, 'label', lab);
end $$;

create or replace function public.request_join(p_code text, p_name text, p_message text, p_device text) returns text
language plpgsql security definer set search_path = public as $$
declare tid uuid; tname text; kn text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select id, name into tid, tname from public.teams where invite_code = p_code;
  if tid is null then raise exception 'bad_code'; end if;
  if exists (select 1 from public.members where team_id = tid and user_id = auth.uid()) then return 'member'; end if;
  if length(trim(coalesce(p_name, ''))) < 1 or length(trim(p_name)) > 20 or length(coalesce(p_message, '')) > 100 then raise exception 'bad_request'; end if;
  -- 가입 승인제를 끈 팀은 신청 없이 바로 팀원이 된다
  if coalesce((select data ->> 'joinApproval' from public.docs where team_id = tid and coll = 'team' and id = 'settings'), 'true') = 'false' then
    insert into public.members (team_id, user_id, role, display_name) values (tid, auth.uid(), 'member', left(trim(p_name), 30)) on conflict (team_id, user_id) do nothing;
    delete from public.join_requests where team_id = tid and user_id = auth.uid();
    return 'member';
  end if;
  if (select count(*) from public.join_requests where user_id = auth.uid() and status = 'pending' and team_id <> tid) >= 5 then raise exception 'request_limit'; end if;
  select left(coalesce(raw_user_meta_data ->> 'nickname', raw_user_meta_data ->> 'name', ''), 40) into kn from auth.users where id = auth.uid();
  insert into public.join_requests (team_id, user_id, team_name, display_name, kakao_name, message, device, status, created_at)
  values (tid, auth.uid(), left(tname, 40), trim(p_name), coalesce(kn, ''), trim(coalesce(p_message, '')), case when p_device in ('phone', 'pc') then p_device else '' end, 'pending', now())
  on conflict (team_id, user_id) do update set display_name = excluded.display_name, message = excluded.message, device = excluded.device,
    team_name = excluded.team_name, kakao_name = excluded.kakao_name, status = 'pending', created_at = now();
  return 'pending';
end $$;

create or replace function public.team_policy_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op = 'UPDATE' then old.data else '{}'::jsonb end;
  k text;
begin
  if new.coll <> 'team' or new.id <> 'settings' or auth.uid() is null then return new; end if;
  if coalesce(o ->> 'sport', '') <> '' and (new.data ->> 'sport') is distinct from (o ->> 'sport') then raise exception 'sport_locked' using errcode = '42501'; end if;
  if exists (select 1 from public.members m where m.team_id = new.team_id and m.user_id = auth.uid() and m.role = 'owner') then return new; end if;
  foreach k in array array['voteClose', 'voteTime', 'cap', 'waitCap', 'checkBefore', 'scrimMin', 'scrimDays', 'fineFrom', 'fineDays', 'fineAp', 'fineHour', 'joinApproval'] loop
    if (new.data -> k) is distinct from (o -> k) then raise exception 'owner_only' using errcode = '42501'; end if;
  end loop;
  return new;
end $$;

revoke all on function public.fine_start(jsonb, jsonb) from public, anon;
grant execute on function public.fine_start(jsonb, jsonb) to authenticated;
