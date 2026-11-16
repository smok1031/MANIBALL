-- 2026-11-16c 정기 점검(매주 수요일 04:00~05:00, 한국 시간)에는 앱 사용자의 쓰기를 막는다
-- 로그인한 사용자(auth.uid() 있음)의 docs, members, join_requests 쓰기만 막고, SQL Editor나 배포 작업(auth.uid() 없음)은 그대로 된다.
create or replace function public.in_maintenance() returns boolean
language sql stable set search_path = public as $$
  select extract(isodow from (now() at time zone 'Asia/Seoul')) = 3
     and (now() at time zone 'Asia/Seoul')::time >= time '04:00'
     and (now() at time zone 'Asia/Seoul')::time < time '05:00'
$$;
create or replace function public.maintenance_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and public.in_maintenance() then raise exception 'maintenance' using errcode = '42501'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists maintenance_guard on public.docs;
create trigger maintenance_guard before insert or update or delete on public.docs for each row execute function public.maintenance_guard();
drop trigger if exists maintenance_guard on public.members;
create trigger maintenance_guard before insert or update or delete on public.members for each row execute function public.maintenance_guard();
drop trigger if exists maintenance_guard on public.join_requests;
create trigger maintenance_guard before insert or update or delete on public.join_requests for each row execute function public.maintenance_guard();
