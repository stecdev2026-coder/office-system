-- Allow selected work groups to record attendance without choosing a workplace.
alter table public.work_groups
 add column if not exists attendance_without_location boolean not null default false;

alter table public.attendance_events
 alter column location_id drop not null;

create or replace function public.office_record_attendance(p_employee_id uuid,p_location_id uuid,p_kind text,p_lat double precision,p_lng double precision,p_photo text default null)
returns uuid language plpgsql set search_path=public as $$
declare e employees; l attendance_locations; a attendance; d double precision:=0; event_id uuid; day date := (now() at time zone 'Asia/Bangkok')::date; location_optional boolean;
begin
 perform pg_advisory_xact_lock(hashtext(p_employee_id::text));
 select * into e from employees where id=p_employee_id and is_active=true;
 if not found then raise exception 'INACTIVE'; end if;
 if p_kind not in ('in','checkpoint','out') or p_lat is null or p_lng is null or not(p_lat between -90 and 90) or not(p_lng between -180 and 180) then raise exception 'INVALID_INPUT'; end if;
 select exists(select 1 from office_super_admins where employee_id=p_employee_id) or exists(
  select 1 from work_group_members m join work_groups g on g.id=m.group_id
  where m.employee_id=p_employee_id and g.active and g.attendance_without_location
 ) into location_optional;
 if p_location_id is null then
  if not location_optional then raise exception 'LOCATION_REQUIRED'; end if;
 else
  select * into l from attendance_locations where id=p_location_id and active=true;
  if not found or not public.office_can_use_location(p_employee_id,p_location_id) then raise exception 'LOCATION_DENIED'; end if;
  d := 6371 * 2 * asin(sqrt(least(1.0,power(sin(radians(p_lat-l.latitude)/2),2)+cos(radians(l.latitude))*cos(radians(p_lat))*power(sin(radians(p_lng-l.longitude)/2),2))));
  if d > l.radius_km then raise exception 'OUTSIDE_RADIUS'; end if;
 end if;
 if (select photo_required from attendance_policy where id=1) and nullif(p_photo,'') is null then raise exception 'PHOTO_REQUIRED'; end if;
 if p_photo is not null and p_photo not like '/api/photos?path='||p_employee_id::text||'/%' then raise exception 'INVALID_PHOTO'; end if;
 select * into a from attendance where line_user_id=e.line_user_id and work_date=day for update;
 if p_kind='in' then
  if a.id is not null then raise exception 'ALREADY_STARTED'; end if;
  insert into attendance(line_user_id,work_date,check_in_time,check_in_lat,check_in_lng,check_in_photo_url,status) values(e.line_user_id,day,now(),p_lat,p_lng,p_photo,'Present') returning * into a;
 else
  if a.id is null or a.check_out_time is not null then raise exception 'NO_OPEN_ATTENDANCE'; end if;
  if p_kind='out' then update attendance set check_out_time=now(),check_out_lat=p_lat,check_out_lng=p_lng,check_out_photo_url=p_photo where id=a.id; end if;
 end if;
 insert into attendance_events(attendance_id,employee_id,location_id,kind,latitude,longitude,distance_km,photo_url) values(a.id,p_employee_id,p_location_id,p_kind,p_lat,p_lng,d,p_photo) returning id into event_id;
 return event_id;
end $$;
revoke all on function public.office_record_attendance(uuid,uuid,text,double precision,double precision,text) from public,anon,authenticated;
grant execute on function public.office_record_attendance(uuid,uuid,text,double precision,double precision,text) to service_role;

create or replace function public.office_save_work_group(p_actor_id uuid,p_id uuid,p_config jsonb,p_members jsonb default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor_permissions text[]; root boolean; existing boolean; g work_groups; weekdays integer[]; member_data jsonb; employee_target uuid; prior_effective date;
begin
 perform pg_advisory_xact_lock(hashtext('group:'||p_id::text));
 if not exists(select 1 from employees where id=p_actor_id and is_active) then raise exception 'PERMISSION_DENIED';end if;
 root:=exists(select 1 from office_super_admins where employee_id=p_actor_id);
 select coalesce(array_agg(distinct key),'{}') into actor_permissions from employee_permission_roles a join permission_roles r on r.id=a.role_id cross join unnest(r.permissions) key where a.employee_id=p_actor_id;
 if p_id is null or (p_config is null and p_members is null) then raise exception 'INVALID_INPUT';end if;
 if p_config is not null and not root and not('groups.edit'=any(actor_permissions)) then raise exception 'PERMISSION_DENIED';end if;
 if p_members is not null and not root and not('groups.members'=any(actor_permissions)) then raise exception 'PERMISSION_DENIED';end if;
 perform 1 from work_groups where id=p_id for update;
 select exists(select 1 from work_groups where id=p_id) into existing;
 if not existing and p_config is null then raise exception 'GROUP_NOT_FOUND';end if;
 if p_config is not null then
  if jsonb_typeof(p_config)<>'object' or nullif(trim(p_config->>'name'),'') is null or length(p_config->>'name')>150 or jsonb_typeof(p_config->'allowed_weekdays')<>'array' or jsonb_typeof(p_config->'active')<>'boolean' or jsonb_typeof(p_config->'attendance_without_location')<>'boolean' or length(coalesce(p_config->>'branch',''))>100 then raise exception 'INVALID_INPUT';end if;
  select array_agg(weekday_value order by weekday_value) into weekdays from (select distinct value::integer weekday_value from jsonb_array_elements_text(p_config->'allowed_weekdays')) days;
  if cardinality(weekdays) is null or not(weekdays <@ array[0,1,2,3,4,5,6]) or (p_config->>'weekly_days')::integer not between 0 and cardinality(weekdays) then raise exception 'INVALID_WEEKLY_DAYS';end if;
  if p_members is null and exists(select 1 from work_group_members where group_id=p_id and required_weekly_days>cardinality(weekdays)) then raise exception 'INVALID_WEEKLY_DAYS';end if;
  if p_members is not null then
   if jsonb_typeof(p_members)<>'array' then raise exception 'INVALID_MEMBERS';end if;
   for employee_target in select employee_id from work_group_members where group_id=p_id union select (value->>'employee_id')::uuid from jsonb_array_elements(p_members) order by 1 loop perform pg_advisory_xact_lock(hashtext(employee_target::text)); end loop;
   for employee_target in select employee_id from work_group_members where group_id=p_id and not exists(select 1 from jsonb_array_elements(p_members) m where (m->>'employee_id')::uuid=employee_id) order by employee_id loop perform office_set_group_member(p_id,employee_target,false,null,false,null); end loop;
   update work_group_members m set required_weekly_days=(j->>'days')::integer from jsonb_array_elements(p_members) j where m.group_id=p_id and m.employee_id=(j->>'employee_id')::uuid and ((j->>'days') is null or (j->>'days')::integer between 0 and cardinality(weekdays));
  end if;
  insert into work_groups(id,name,branch,allowed_weekdays,weekly_days,active,attendance_without_location) values(p_id,trim(p_config->>'name'),coalesce(p_config->>'branch',''),weekdays,(p_config->>'weekly_days')::integer,(p_config->>'active')::boolean,(p_config->>'attendance_without_location')::boolean)
  on conflict(id) do update set name=excluded.name,branch=excluded.branch,allowed_weekdays=excluded.allowed_weekdays,weekly_days=excluded.weekly_days,active=excluded.active,attendance_without_location=excluded.attendance_without_location;
 end if;
 select * into g from work_groups where id=p_id;
 if p_members is not null then
  if jsonb_typeof(p_members)<>'array' then raise exception 'INVALID_MEMBERS';end if;
  if (select count(*)<>count(distinct value->>'employee_id') from jsonb_array_elements(p_members)) then raise exception 'DUPLICATE_MEMBER';end if;
  for employee_target in select employee_id from work_group_members where group_id=p_id union select (value->>'employee_id')::uuid from jsonb_array_elements(p_members) order by 1 loop perform pg_advisory_xact_lock(hashtext(employee_target::text)); end loop;
  for employee_target in select employee_id from work_group_members where group_id=p_id and not exists(select 1 from jsonb_array_elements(p_members) m where (m->>'employee_id')::uuid=employee_id) order by employee_id loop perform office_set_group_member(p_id,employee_target,false,null,false,null); end loop;
  for member_data in select value from jsonb_array_elements(p_members) order by value->>'employee_id' loop
   employee_target:=(member_data->>'employee_id')::uuid;
   if employee_target is null or jsonb_typeof(member_data->'is_primary')<>'boolean' or ((member_data->>'days')::integer is not null and (member_data->>'days')::integer not between 0 and cardinality(g.allowed_weekdays)) then raise exception 'INVALID_MEMBERS';end if;
   select effective_from into prior_effective from work_group_members where group_id=p_id and employee_id=employee_target;
   perform office_set_group_member(p_id,employee_target,true,(member_data->>'days')::integer,(member_data->>'is_primary')::boolean,prior_effective);
  end loop;
 end if;
 return p_id;
end $$;
revoke all on function public.office_save_work_group(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.office_save_work_group(uuid,uuid,jsonb,jsonb) to service_role;
