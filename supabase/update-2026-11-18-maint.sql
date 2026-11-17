-- 2026-11-18 점검은 정해진 요일, 시간이 아니라 업로드할 때만 켠다.
-- maint 표 한 줄(state, start_at, end_at)이 화면(점검 안내)과 DB 쓰기 막기를 같이 정한다.
--   state 'on' 이고 지금이 start_at 이후면 점검 중: 로그인한 사용자의 쓰기를 막고, 화면은 점검 안내로 간다.
--   start_at 전이면 예고: 앱 위쪽에 "곧 점검" 안내만 뜬다. end_at은 다시 열릴 예상 시각(화면 표시용).
--   업로드가 끝나면 state 'off': 화면이 바로 다시 열리고 쓰기도 풀린다.
-- 바꾸는 것은 SQL Editor(관리자)만 한다: select public.maint_begin(예상 분, 예고 초); select public.maint_extend(분); select public.maint_end();
create table if not exists public.maint (
  id int primary key default 1 check (id = 1),
  state text not null default 'off' check (state in ('off', 'on')),
  start_at timestamptz,
  end_at timestamptz,
  note text,
  updated_at timestamptz not null default now()
);
insert into public.maint (id) values (1) on conflict (id) do nothing;
alter table public.maint enable row level security;
drop policy if exists maint_read on public.maint;
create policy maint_read on public.maint for select to anon, authenticated using (true);
revoke all on public.maint from anon, authenticated;
grant select on public.maint to anon, authenticated;

-- 점검 중인지: 예전의 "수요일 04:00~05:00" 대신 maint 표를 본다
create or replace function public.in_maintenance() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.maint where id = 1 and state = 'on' and start_at is not null and now() >= start_at)
$$;

-- 쓰기 막기: 로그인한 사용자(auth.uid() 있음)의 쓰기만 막는다. SQL Editor와 업로드 작업은 그대로 된다
create or replace function public.maintenance_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and public.in_maintenance() then raise exception 'maintenance' using errcode = '42501'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
-- 표가 아직 없는 곳(예전 운영 DB에 join_requests가 없을 때)은 건너뛴다. 나중 SQL 묶음 끝에서 이 파일을 한 번 더 실행해 다시 맞춘다
do $$
declare t text;
begin
  foreach t in array array['docs', 'members', 'join_requests', 'teams', 'inquiries'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists maintenance_guard on public.%I', t);
      execute format('create trigger maintenance_guard before insert or update or delete on public.%I for each row execute function public.maintenance_guard()', t);
    end if;
  end loop;
end $$;

-- 화면이 읽는 점검 상태: 서버 시각(now)도 같이 줘서 휴대폰 시계가 틀려도 시작, 남은 분을 맞게 계산한다
create or replace function public.maint_status() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('state', m.state, 'start_at', m.start_at, 'end_at', m.end_at, 'now', now()) from public.maint m where m.id = 1
$$;
revoke execute on function public.maint_status() from public;
grant execute on function public.maint_status() to anon, authenticated;

-- 점검 켜기: lead_sec 초 뒤에 시작(그동안 앱에 예고), 시작부터 eta_min 분 뒤에 열릴 예정
create or replace function public.maint_begin(eta_min int, lead_sec int default 60, why text default null) returns public.maint
language sql security definer set search_path = public as $$
  update public.maint set state = 'on', start_at = now() + make_interval(secs => greatest(lead_sec, 0)),
    end_at = now() + make_interval(secs => greatest(lead_sec, 0)) + make_interval(mins => greatest(eta_min, 1)), note = why, updated_at = now()
  where id = 1 returning *
$$;
-- 늦어질 때: 지금부터 more_min 분 뒤로 예상 시각을 다시 잡는다
create or replace function public.maint_extend(more_min int) returns public.maint
language sql security definer set search_path = public as $$
  update public.maint set end_at = now() + make_interval(mins => greatest(more_min, 1)), updated_at = now() where id = 1 and state = 'on' returning *
$$;
-- 끝: 바로 다시 연다
create or replace function public.maint_end() returns public.maint
language sql security definer set search_path = public as $$
  update public.maint set state = 'off', end_at = now(), updated_at = now() where id = 1 returning *
$$;
revoke execute on function public.maint_begin(int, int, text) from public, anon, authenticated;
revoke execute on function public.maint_extend(int) from public, anon, authenticated;
revoke execute on function public.maint_end() from public, anon, authenticated;
revoke execute on function public.in_maintenance() from public, anon, authenticated;
revoke execute on function public.maintenance_guard() from public, anon, authenticated;
