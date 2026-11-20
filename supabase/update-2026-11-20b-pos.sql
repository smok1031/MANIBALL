-- 2026-11-20 축구 측면 포지션을 하나로 묶음: LWB는 LB, RWB는 RB, LM은 LW, RM은 RW
-- 축구 포지션은 GK, LB, CB, RB, CDM, CM, CAM, LW, RW, ST 10개가 된다. 3백, 5백 포메이션의 윙백 자리도 LB, RB로 바뀐다.
-- 축구팀의 팀원 포지션(rsvp.profile, 포지션 변경 요청), 저장된 라인업과 고정, 용병 포지션, 미리 올린 명단, 용병 신청에 있는 예전 이름을 새 이름으로 바꾼다.
-- 풋살팀은 건드리지 않는다. 여러 번 실행해도 결과는 같다.
update public.docs d set data = replace(replace(replace(replace(d.data::text,
    '"LWB"', '"LB"'), '"RWB"', '"RB"'), '"LM"', '"LW"'), '"RM"', '"RW"')::jsonb
where d.coll in ('rsvp', 'events', 'players', 'guestreq')
  and d.data::text ~ '"(LWB|RWB|LM|RM)"'
  and exists (select 1 from public.docs s where s.team_id = d.team_id and s.coll = 'team' and s.id = 'settings' and s.data ->> 'sport' = 'soccer');

-- 1선호와 2선호가 같아진 사람(예: RW, RM)은 2선호를 비운다
update public.docs d set data = jsonb_set(d.data, '{profile,pos2}', '""'::jsonb)
where d.coll = 'rsvp' and jsonb_typeof(d.data -> 'profile') = 'object'
  and coalesce(d.data -> 'profile' ->> 'pos2', '') <> '' and d.data -> 'profile' ->> 'pos2' = d.data -> 'profile' ->> 'pos1'
  and exists (select 1 from public.docs s where s.team_id = d.team_id and s.coll = 'team' and s.id = 'settings' and s.data ->> 'sport' = 'soccer');
