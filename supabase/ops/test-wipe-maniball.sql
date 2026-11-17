-- 테스트용 Supabase(maniball-test)에서 매니볼 테스트 스키마(maniball)를 통째로 지운다.
-- 합창단 선호도 투표(public 스키마)는 건드리지 않는다. 되돌릴 수 없다.
-- 먼저: Project Settings > Data API > Exposed schemas 에서 maniball 을 빼고 저장한 뒤 실행한다
--       (없는 스키마가 목록에 남아 있으면 API 전체가 멈출 수 있다)
-- 운영 프로젝트(public 스키마에 매니볼)에서 잘못 실행해도 maniball 스키마가 없으니 아무것도 지워지지 않는다
do $$
declare n int;
begin
  select count(*) into n from information_schema.tables where table_schema = 'maniball';
  raise notice '지울 maniball 표: %개', n;
end $$;

drop schema if exists maniball cascade;

-- 확인: 0 이면 다 지워졌고, public(합창단) 표 수는 그대로여야 한다
select (select count(*) from information_schema.schemata where schema_name = 'maniball') as maniball_남음,
       (select count(*) from information_schema.tables where table_schema = 'public') as public_표_수;
