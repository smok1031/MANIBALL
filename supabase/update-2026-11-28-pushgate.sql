-- 알림 관문 (2026-11-28): 어느 기기에서도 알림을 안 켠 계정은 알림을 켜야 팀으로 들어간다
-- 앱이 로그인 뒤 push_any()로 "이 계정에 알림 받는 기기가 하나라도 있는지"만 묻는다 (기기 주소나 다른 사람 정보는 돌려주지 않음)
create or replace function public.push_any() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.push_subs where user_id = auth.uid())
$$;
revoke all on function public.push_any() from public, anon;
grant execute on function public.push_any() to authenticated;
