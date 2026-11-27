-- 카카오톡 알림을 아예 없앤다 (2026-11-27)
-- 2026-11-25에 보내기는 멈췄고(push_take가 kakao를 비워 보냄) 앱 화면에서도 뺐다. 남아 있던 것을 모두 걷어 낸다.
--  1. 알림 함수 3개(push_docs_trg, push_join_trg, push_scan)의 "카카오 연결이 있으면" 조건을 뺀다. 지금 돌아가는 정의에서 그 조각만 지운다
--  2. push_take가 보내던 빈 kakao 칸을 뺀다
--  3. 카카오 토큰을 다루던 함수 5개와 토큰 표(push_kakao)를 지운다. 보관하던 카카오 토큰도 함께 사라진다 (팀, 일정, 투표 같은 자료는 그대로)
-- 웹 푸시(push_subs)와 로그인용 카카오 계정 연결은 건드리지 않는다.

do $$
declare f text; d text; n int; k text := ' and not exists (select 1 from public.push_kakao)';
begin
  foreach f in array array['public.push_docs_trg()', 'public.push_join_trg()', 'public.push_scan()'] loop
    d := pg_get_functiondef(f::regprocedure);
    n := (length(d) - length(replace(d, k, ''))) / length(k);
    if n <> 1 then raise exception '% 안의 카카오 조건이 % 곳이에요 (1곳이어야 함)', f, n; end if;
    execute replace(d, k, '');
  end loop;
  d := pg_get_functiondef('public.push_take(int)'::regprocedure);
  if position(' ''kakao'', null,' in d) = 0 then raise exception 'push_take 안에 kakao 칸이 없어요'; end if;
  execute replace(d, ' ''kakao'', null,', '');
  -- 다 고친 뒤에는 어떤 함수에도 push_kakao가 남지 않아야 한다 (토큰 함수 5개 빼고)
  if exists (select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
             where s.oid = (select relnamespace from pg_class where oid = 'public.push_subs'::regclass) and p.prosrc ilike '%push_kakao%' and p.proname not like 'push\_kakao\_%') then
    raise exception 'push_kakao를 쓰는 함수가 아직 남아 있어요';
  end if;
end $$;

drop function if exists public.push_kakao_put(uuid, text, text, text, timestamptz, timestamptz);
drop function if exists public.push_kakao_get(uuid);
drop function if exists public.push_kakao_ok(uuid);
drop function if exists public.push_kakao_del(uuid);
drop function if exists public.push_kakao_mine();
drop table if exists public.push_kakao;
