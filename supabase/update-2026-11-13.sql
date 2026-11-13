-- 2026-11-13 권한 정리: [Admin] 1명, [운영진], [팀원]
-- Admin(팀을 만든 사람)은 넘길 수 없다. 팀을 나갈 때만 운영진 중에서 다음 Admin을 정하고 나간다
-- 운영진 신청 기능은 없앤다. 운영진 지정과 해제는 Admin만 한다
-- 내보내기: Admin은 운영진과 팀원을, 운영진은 팀원만 내보낸다

-- 운영진 신청 없애기
drop function if exists public.request_admin(uuid);
drop function if exists public.cancel_admin_request(uuid);
drop function if exists public.answer_admin_request(uuid, uuid, boolean);
update public.members set admin_req = null where admin_req is not null;

-- Admin 넘기기 없애기
drop function if exists public.transfer_owner(uuid, uuid);

-- 내보내기와 스스로 나가기
create or replace function public.remove_member(p_team uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me text := coalesce(public.team_role(p_team), ''); them text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_user = auth.uid() then
    if me = 'owner' then raise exception 'owner_cannot_leave'; end if;
  else
    select role into them from public.members where team_id = p_team and user_id = p_user;
    if them is null then raise exception 'no_member'; end if;
    if them = 'owner' then raise exception 'owner_only'; end if;
    if not (me = 'owner' or (me = 'admin' and them = 'member')) then raise exception 'kick_denied'; end if;
  end if;
  delete from public.members where team_id = p_team and user_id = p_user;
end $$;

-- Admin이 팀을 나갈 때: 운영진 한 명을 다음 Admin으로 정하고 나간다
create or replace function public.leave_team_as_owner(p_team uuid, p_next uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.team_role(p_team), '') <> 'owner' then raise exception 'owner_only'; end if;
  if p_next = auth.uid() then raise exception 'not_self'; end if;
  if not exists (select 1 from public.members where team_id = p_team and user_id = p_next and role = 'admin') then raise exception 'next_not_admin'; end if;
  update public.members set role = 'owner', admin_req = null where team_id = p_team and user_id = p_next;
  delete from public.members where team_id = p_team and user_id = auth.uid();
end $$;

revoke all on function public.leave_team_as_owner(uuid, uuid) from public, anon;
grant execute on function public.remove_member(uuid, uuid), public.leave_team_as_owner(uuid, uuid) to authenticated;

-- 팀 지우기는 Admin이 바로 하지 않는다. 매니볼에 문의를 남기면 만든 사람이 확인하고 지운다
revoke execute on function public.delete_team(uuid) from public, anon, authenticated;

-- 매니볼 문의: 앱에서는 남기기만 하고, 읽기는 Supabase 관리 화면에서만 한다 (정책이 없어 API로는 못 읽는다)
create table if not exists public.inquiries (
  id bigint generated always as identity primary key,
  team_id uuid references public.teams(id) on delete set null,
  user_id uuid,
  kind text not null default 'etc',
  body text not null,
  contact text not null default '',
  status text not null default 'new',
  created_at timestamptz not null default now()
);
alter table public.inquiries enable row level security;
revoke all on public.inquiries from anon, authenticated;

create or replace function public.submit_inquiry(p_team uuid, p_kind text, p_body text, p_contact text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_kind not in ('delete_team', 'etc') then raise exception 'bad_kind'; end if;
  if p_kind = 'delete_team' and coalesce(public.team_role(p_team), '') <> 'owner' then raise exception 'owner_only'; end if;
  if length(trim(coalesce(p_body, ''))) < 2 or length(p_body) > 1000 or length(coalesce(p_contact, '')) > 100 then raise exception 'bad_inquiry'; end if;
  if (select count(*) from public.inquiries where user_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then raise exception 'inquiry_limit'; end if;
  insert into public.inquiries (team_id, user_id, kind, body, contact) values (p_team, auth.uid(), p_kind, trim(p_body), trim(coalesce(p_contact, '')));
end $$;
revoke all on function public.submit_inquiry(uuid, text, text, text) from public, anon;
grant execute on function public.submit_inquiry(uuid, text, text, text) to authenticated;
