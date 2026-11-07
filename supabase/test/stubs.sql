-- 로컬 Postgres에서 schema.sql을 시험하기 위한 Supabase 흉내 (실제 Supabase에는 실행하지 마세요)
do $$ begin if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; create role authenticated nologin; end if; end $$;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
grant usage on schema public to authenticated, anon;
create publication supabase_realtime;
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a', 'owner@x.kr', '{"name":"정성목"}'),
 ('00000000-0000-0000-0000-00000000000b', 'admin@x.kr', '{"nickname":"김성우"}'),
 ('00000000-0000-0000-0000-00000000000c', 'mem@x.kr', '{}'),
 ('00000000-0000-0000-0000-00000000000d', 'other@x.kr', '{}');
-- Supabase처럼 새 표와 함수에 기본 권한을 준다 (schema.sql이 이를 거두는지 확인)
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
