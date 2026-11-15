-- 2026-11-15 가입 승인제: 초대 링크로 들어온 사람은 바로 팀원이 되지 않고 가입 신청을 남긴다
-- Admin이나 운영진이 승인하면 그때 팀원이 된다. 승인 전에는 팀 정보를 하나도 볼 수 없다 (members에 없으니까)
-- 같은 사람이 다른 카카오 계정으로 또 들어오는 일을 운영진이 걸러 낼 수 있게, 신청에 이름, 카카오 닉네임, 한마디, 기기를 남긴다

create table if not exists public.join_requests (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team_name text not null default '',
  display_name text not null default '' check (char_length(display_name) <= 20),
  kakao_name text not null default '' check (char_length(kakao_name) <= 40),
  message text not null default '' check (char_length(message) <= 100),
  device text not null default '' check (device in ('', 'phone', 'pc')),
  status text not null default 'pending' check (status in ('pending', 'rejected')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index if not exists join_requests_user_idx on public.join_requests(user_id);
alter table public.join_requests enable row level security;
revoke all on public.join_requests from anon, authenticated;
grant select on public.join_requests to authenticated;
drop policy if exists join_requests_read on public.join_requests;
-- 내 신청은 내가, 팀의 신청은 그 팀 Admin과 운영진이 본다. 쓰기는 아래 서버 함수로만
create policy join_requests_read on public.join_requests for select to authenticated
  using (user_id = auth.uid() or coalesce(public.team_role(team_id), '') in ('owner', 'admin'));

-- 가입 신청 (초대 코드로). 이미 팀원이면 'member', 신청을 남기면 'pending'
create or replace function public.request_join(p_code text, p_name text, p_message text, p_device text) returns text
language plpgsql security definer set search_path = public as $$
declare tid uuid; tname text; kn text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select id, name into tid, tname from public.teams where invite_code = p_code;
  if tid is null then raise exception 'bad_code'; end if;
  if exists (select 1 from public.members where team_id = tid and user_id = auth.uid()) then return 'member'; end if;
  if length(trim(coalesce(p_name, ''))) < 1 or length(trim(p_name)) > 20 or length(coalesce(p_message, '')) > 100 then raise exception 'bad_request'; end if;
  if (select count(*) from public.join_requests where user_id = auth.uid() and status = 'pending' and team_id <> tid) >= 5 then raise exception 'request_limit'; end if;
  select left(coalesce(raw_user_meta_data ->> 'nickname', raw_user_meta_data ->> 'name', ''), 40) into kn from auth.users where id = auth.uid();
  insert into public.join_requests (team_id, user_id, team_name, display_name, kakao_name, message, device, status, created_at)
  values (tid, auth.uid(), left(tname, 40), trim(p_name), coalesce(kn, ''), trim(coalesce(p_message, '')), case when p_device in ('phone', 'pc') then p_device else '' end, 'pending', now())
  on conflict (team_id, user_id) do update set display_name = excluded.display_name, message = excluded.message, device = excluded.device,
    team_name = excluded.team_name, kakao_name = excluded.kakao_name, status = 'pending', created_at = now();
  return 'pending';
end $$;

-- 승인 또는 거절 (Admin, 운영진). 승인하면 팀원으로 넣고 신청은 지운다. 거절하면 신청자에게 거절됐다고 보인다
create or replace function public.answer_join(p_team uuid, p_user uuid, p_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r public.join_requests;
begin
  if coalesce(public.team_role(p_team), '') not in ('owner', 'admin') then raise exception 'admin_only'; end if;
  select * into r from public.join_requests where team_id = p_team and user_id = p_user and status = 'pending';
  if r.user_id is null then raise exception 'no_request'; end if;
  if p_ok then
    insert into public.members (team_id, user_id, role, display_name) values (p_team, p_user, 'member', left(r.display_name, 30))
    on conflict (team_id, user_id) do nothing;
    delete from public.join_requests where team_id = p_team and user_id = p_user;
  else
    update public.join_requests set status = 'rejected' where team_id = p_team and user_id = p_user;
  end if;
end $$;

-- 내 신청 취소 (거절된 신청을 지울 때도)
create or replace function public.cancel_join(p_team uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.join_requests where team_id = p_team and user_id = auth.uid()
$$;

revoke all on function public.request_join(text, text, text, text), public.answer_join(uuid, uuid, boolean), public.cancel_join(uuid) from public, anon;
grant execute on function public.request_join(text, text, text, text), public.answer_join(uuid, uuid, boolean), public.cancel_join(uuid) to authenticated;

-- 초대 코드로 바로 팀원이 되던 길은 막는다
revoke execute on function public.join_team(text, text) from public, anon, authenticated;

-- 운영진 화면에 새 신청이 바로 뜨게 실시간에 넣는다 (볼 수 있는 행은 위 정책대로)
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'join_requests') then
    alter publication supabase_realtime add table public.join_requests;
  end if;
end $$;
