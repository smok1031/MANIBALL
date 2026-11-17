-- 2026-11-17b 뉴버전 점검 뒤 보강 (테스트 서버 점검에서 찾은 것)
-- 1) MOM: 이날 온 사람끼리만 투표, 자기 자신은 못 고름, 한 번만 (운영진도 같게. 화면에서만 막던 것을 서버에서도)
-- 2) 용병 신청: 팀원은 신청과 취소만, 수락은 운영진만. 새 신청은 용병 받는 중이고 투표가 열려 있을 때만
-- 3) 참석 응답에 불참 변경 표시(lateCancel)와 사유는 서버만 적는다
-- 4) 팀 이름은 Admin만 바꾼다 (팀 설정 화면과 같게)
-- 5) 트리거 함수는 API로 부를 수 없게 실행 권한을 뺀다
-- 운영 서버에는 update-2026-11-17-newver.sql 다음에 실행한다

-- 이날 온 사람: 현장 출석이 있으면 그것(왔음, 지각), 없으면 참석이나 늦참으로 투표한 사람
create or replace function public.came_to(t uuid, ev jsonb, eid text, u text) returns boolean
language sql stable set search_path = '' as $$
  select case when coalesce(ev -> 'check' ->> u, '') <> '' then ev -> 'check' ->> u in ('in', 'late')
    else coalesce((select d.data -> 'ev' -> eid ->> 's' from public.docs d where d.team_id = t and d.coll = 'rsvp' and d.id = u), '') in ('yes', 'late') end
$$;
revoke all on function public.came_to(uuid, jsonb, text, text) from public, anon, authenticated;

create or replace function public.docs_member_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op = 'UPDATE' then old.data else '{}'::jsonb end;
  n jsonb := new.data;
  k text; ne jsonb; oe jsonb; ev jsonb; nowiso text; keep_at text; pid text; cap int; ahead int;
begin
  -- 운영진은 참석과 용병 규칙을 건너뛴다. MOM 투표(uvote)는 운영진도 같은 규칙
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
              where coalesce(nullif(gg.value ->> 'at', ''), '~') < coalesce(nullif(oe ->> 'at', ''), '~'));
          end if;
          if cap = 0 or ahead < cap then raise exception 'need_late_cancel' using errcode = '42501'; end if;
        end if;
        if coalesce(ne ->> 's', '') not in ('yes', 'late', 'no', '') then raise exception 'bad_vote' using errcode = '42501'; end if;
        if coalesce(ne ->> 'q', '0') !~ '^[0-8]$' then raise exception 'bad_vote' using errcode = '42501'; end if;
        -- 불참 변경 표시와 사유는 서버(late_cancel)만 적는다
        if coalesce(current_setting('maniball.late_cancel', true), '') <> '1' then ne := ne - 'lateCancel' - 'reason'; end if;
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
        if coalesce(ne #>> '{}', '') <> '' and not exists (select 1 from jsonb_array_elements(coalesce(ev -> 'poll' -> 'opts', '[]'::jsonb)) x where x ->> 'id' = ne #>> '{}') then raise exception 'no_option' using errcode = '42501'; end if;
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
  foreach k in array array['voteClose', 'voteTime', 'cap', 'waitCap', 'checkBefore', 'scrimMin', 'scrimDays', 'fineFrom', 'fineDays', 'fineAp', 'fineHour', 'joinApproval', 'teamName'] loop
    if (new.data -> k) is distinct from (o -> k) then raise exception 'owner_only' using errcode = '42501'; end if;
  end loop;
  return new;
end $$;

drop policy if exists teams_update on public.teams;
create policy teams_update on public.teams for update to authenticated using (public.team_role(id) = 'owner') with check (public.team_role(id) = 'owner');
revoke execute on function public.team_policy_guard() from public, anon, authenticated;
revoke execute on function public.maintenance_guard() from public, anon, authenticated;
-- 용병 신청(guestreq)도 팀원 규칙 검사에 넣는다
drop trigger if exists docs_member_guard on public.docs;
create trigger docs_member_guard before insert or update on public.docs for each row when (new.coll = any (array['rsvp', 'uvote', 'guestreq'])) execute function public.docs_member_guard();
