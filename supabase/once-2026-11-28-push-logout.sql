-- 한 번만 (2026-11-28, 알림 관문이 올라간 뒤): 어느 기기에서도 알림을 안 켠 계정의 로그인을 끊는다
-- 로그인 세션만 지운다. 팀, 투표, 회비, 기록 같은 자료는 그대로다. 다시 카카오로 로그인하면 알림 켜기 화면이 나온다.
-- 먼저 대상 수를 확인하고(아래 select), 맞으면 delete를 돌린다.
select count(distinct s.user_id) as targets from auth.sessions s
where not exists (select 1 from public.push_subs p where p.user_id = s.user_id)
  and coalesce((select u.is_anonymous from auth.users u where u.id = s.user_id), false) = false;

delete from auth.sessions s
where not exists (select 1 from public.push_subs p where p.user_id = s.user_id)
  and coalesce((select u.is_anonymous from auth.users u where u.id = s.user_id), false) = false;
