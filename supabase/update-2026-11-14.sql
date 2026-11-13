-- 2026-11-14 팀 지우기: 매니볼에 평가를 남기면 Admin이 바로 팀을 지운다
-- 평가는 inquiries 표에 쌓인다 (팀이 지워져도 남는다). 팀 이름, 만든 날, 인원, 종목도 같이 남겨 이유를 모아 볼 수 있게 한다
alter table public.inquiries add column if not exists team_name text;
alter table public.inquiries add column if not exists team_created_at timestamptz;
alter table public.inquiries add column if not exists member_count int;
alter table public.inquiries add column if not exists sport text;

create or replace function public.delete_team_with_review(p_team uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare t record;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if coalesce(public.team_role(p_team), '') <> 'owner' then raise exception 'owner_only'; end if;
  if length(trim(coalesce(p_body, ''))) < 2 or length(p_body) > 1000 then raise exception 'bad_inquiry'; end if;
  select id, name, created_at into t from public.teams where id = p_team;
  insert into public.inquiries (team_id, user_id, kind, body, contact, status, team_name, team_created_at, member_count, sport)
  values (null, auth.uid(), 'delete_review', trim(p_body), '', 'deleted', t.name, t.created_at,
          (select count(*) from public.members where team_id = p_team),
          (select data ->> 'sport' from public.docs where team_id = p_team and coll = 'team' and id = 'settings'));
  delete from public.teams where id = p_team;
end $$;
revoke all on function public.delete_team_with_review(uuid, text) from public, anon;
grant execute on function public.delete_team_with_review(uuid, text) to authenticated;

-- 예전 문의 남기기는 더 쓰지 않는다
revoke execute on function public.submit_inquiry(uuid, text, text, text) from authenticated;

-- 보안 점검 (2026-11-14): 검색 경로를 고정하지 않은 함수 두 개를 고정한다 (안쪽 이름은 이미 스키마를 붙여 씀)
alter function public.jsonb_deep_merge(jsonb, jsonb) set search_path = '';
alter function public.event_start(jsonb) set search_path = '';
