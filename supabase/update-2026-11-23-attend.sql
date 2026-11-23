-- 2026-11-23 출석 기준 변경: MOM 투표 자격은 현장 출석에서 왔음 또는 지각으로 체크된 사람만
-- 예전에는 체크가 없으면 참석 투표(yes, late)로 대신 판단했다. 이제 투표만으로는 온 것으로 치지 않는다
-- 데이터는 바꾸지 않는다 (함수 하나만 바꾼다)
create or replace function public.came_to(t uuid, ev jsonb, eid text, u text) returns boolean
language sql stable set search_path = '' as $$
  select coalesce(ev -> 'check' ->> u, '') in ('in', 'late')
$$;
revoke all on function public.came_to(uuid, jsonb, text, text) from public, anon, authenticated;
