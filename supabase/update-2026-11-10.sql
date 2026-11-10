-- 매니볼 2단계 SQL (2026-11-10): MOM 투표를 멤버 기준으로, 팀 지우기, 예전 1차 앱 팀 정리
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
        if clock_timestamp() >= public.event_start(ev) then raise exception 'vote_closed' using errcode = '42501'; end if;
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

-- 팀 지우기: 팀장만. 일정, 참석, 회비, 멤버가 모두 함께 지워진다
create or replace function public.delete_team(p_team uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.team_role(p_team), '') <> 'owner' then raise exception 'owner_only'; end if;
  delete from public.teams where id = p_team;
end $$;

revoke execute on function public.delete_team(uuid) from public, anon;
grant execute on function public.delete_team(uuid) to authenticated;

-- 1차 앱에서 만든 빈 팀 지우기
delete from public.teams where name = '예시 FC';
