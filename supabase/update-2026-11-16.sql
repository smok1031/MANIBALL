-- 2026-11-16 팀 기본 운영 규칙은 Admin만 바꾼다
-- 팀 설정(team/settings)의 기본 운영 규칙 칸(투표 마감, 정원, 대기, 지각 기준, 내전 기준)은 팀을 만든 Admin(owner)만 바꿀 수 있다.
-- 운영진(admin)은 다른 설정(회비, 수칙, 유니폼)은 그대로 바꿀 수 있고, 이 칸들은 바꾸면 거절된다.
create or replace function public.team_policy_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op = 'UPDATE' then old.data else '{}'::jsonb end;
  k text;
begin
  if new.coll <> 'team' or new.id <> 'settings' or auth.uid() is null then return new; end if;
  if exists (select 1 from public.members m where m.team_id = new.team_id and m.user_id = auth.uid() and m.role = 'owner') then return new; end if;
  foreach k in array array['voteClose', 'voteTime', 'cap', 'waitCap', 'checkBefore', 'scrimMin', 'scrimDays'] loop
    if (new.data -> k) is distinct from (o -> k) then raise exception 'owner_only' using errcode = '42501'; end if;
  end loop;
  return new;
end $$;
drop trigger if exists team_policy_guard on public.docs;
create trigger team_policy_guard before insert or update on public.docs for each row execute function public.team_policy_guard();
