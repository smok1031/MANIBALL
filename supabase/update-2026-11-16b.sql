-- 2026-11-16b 종목(풋살팀, 축구팀)은 팀을 만들 때만 정하고, 정한 뒤에는 누구도 바꿀 수 없다 (Admin 포함)
create or replace function public.team_policy_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  o jsonb := case when tg_op = 'UPDATE' then old.data else '{}'::jsonb end;
  k text;
begin
  if new.coll <> 'team' or new.id <> 'settings' or auth.uid() is null then return new; end if;
  if coalesce(o ->> 'sport', '') <> '' and (new.data ->> 'sport') is distinct from (o ->> 'sport') then raise exception 'sport_locked' using errcode = '42501'; end if;
  if exists (select 1 from public.members m where m.team_id = new.team_id and m.user_id = auth.uid() and m.role = 'owner') then return new; end if;
  foreach k in array array['voteClose', 'voteTime', 'cap', 'waitCap', 'checkBefore', 'scrimMin', 'scrimDays'] loop
    if (new.data -> k) is distinct from (o -> k) then raise exception 'owner_only' using errcode = '42501'; end if;
  end loop;
  return new;
end $$;
