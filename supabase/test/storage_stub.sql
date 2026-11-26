-- 로컬 시험용 Supabase 저장소 흉내 (실제 Supabase에는 실행하지 마세요)
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner_id text default auth.uid()::text, created_at timestamptz default now(), metadata jsonb, unique (bucket_id, name));
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language plpgsql immutable as $$
declare p text[]; begin p := string_to_array(name, '/'); return p[1:array_length(p, 1) - 1]; end $$;
grant usage on schema storage to authenticated, anon;
grant select, insert on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
grant execute on function storage.foldername(text) to authenticated, anon;
