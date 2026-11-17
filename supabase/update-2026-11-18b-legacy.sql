-- 2026-11-18b 뉴버전으로 옮길 때 예전 데이터가 그대로 보이게 하는 정리 (한 번만 실행해도, 여러 번 실행해도 같다)
-- 1) 옮기기 전 데이터를 따로 복사해 둔다 (mb_backup 스키마: Data API에 열지 않으므로 앱이나 남이 읽을 수 없다)
-- 2) 예전 버전에서는 라인업을 저장하면 팀원에게 바로 보였다. 뉴버전은 "라인업 알리기"를 눌러야 보이므로,
--    예전에 저장된 라인업은 이미 알린 것으로 표시한다(lineupOld). 알림함에 새 알림은 만들지 않는다.
-- 예전에 받은 용병은 앱이 inCap 표시가 없으면 정원 밖으로 세므로 데이터는 바꾸지 않는다.
create schema if not exists mb_backup;
revoke all on schema mb_backup from public, anon, authenticated;
do $$
begin
  if to_regclass('mb_backup.docs_20261118') is null then
    execute 'create table mb_backup.docs_20261118 as select * from public.docs';
    execute 'create table mb_backup.members_20261118 as select * from public.members';
    execute 'create table mb_backup.teams_20261118 as select * from public.teams';
  end if;
end $$;
revoke all on all tables in schema mb_backup from public, anon, authenticated;

update public.docs
   set data = data || jsonb_build_object('lineupOld', true)
 where coll = 'events'
   and jsonb_typeof(data -> 'lineup') = 'object' and data -> 'lineup' <> '{}'::jsonb
   and coalesce(data ->> 'lineupAt', '') = ''
   and not (data ? 'lineupOld');
