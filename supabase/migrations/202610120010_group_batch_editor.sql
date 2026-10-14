-- A closed group may retain members and its primary-group display without granting location access.
create or replace function public.office_employee_primary_group() returns trigger language plpgsql set search_path=public as $$
declare target_group uuid; existing_days integer; existing_effective date;
begin
 if tg_op='UPDATE' and new.work_group is not distinct from old.work_group then return new;end if;
 if nullif(new.work_group,'') is null then update work_group_members set is_primary=false where employee_id=new.id;return new;end if;
 select w.id into target_group from work_groups w where w.name=new.work_group and (w.active or exists(select 1 from work_group_members m where m.group_id=w.id and m.employee_id=new.id and m.is_primary));
 if target_group is null then raise exception 'GROUP_NOT_FOUND';end if;
 select required_weekly_days,effective_from into existing_days,existing_effective from work_group_members where group_id=target_group and employee_id=new.id;
 perform office_set_group_member(target_group,new.id,true,existing_days,true,coalesce(existing_effective,new.employment_start_date));return new;
end $$;
revoke all on function public.office_employee_primary_group() from public,anon,authenticated;

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
  if jsonb_typeof(p_config)<>'object' or nullif(trim(p_config->>'name'),'') is null or length(p_config->>'name')>150 or jsonb_typeof(p_config->'allowed_weekdays')<>'array' or jsonb_typeof(p_config->'active')<>'boolean' or length(coalesce(p_config->>'branch',''))>100 then raise exception 'INVALID_INPUT';end if;
  select array_agg(weekday_value order by weekday_value) into weekdays from (select distinct value::integer weekday_value from jsonb_array_elements_text(p_config->'allowed_weekdays')) days;
  if cardinality(weekdays) is null or not(weekdays <@ array[0,1,2,3,4,5,6]) or (p_config->>'weekly_days')::integer not between 0 and cardinality(weekdays) then raise exception 'INVALID_WEEKLY_DAYS';end if;
  if p_members is null and exists(select 1 from work_group_members where group_id=p_id and required_weekly_days>cardinality(weekdays)) then raise exception 'INVALID_WEEKLY_DAYS';end if;
  if p_members is not null then
   if jsonb_typeof(p_members)<>'array' then raise exception 'INVALID_MEMBERS';end if;
   for employee_target in select employee_id from work_group_members where group_id=p_id union select (value->>'employee_id')::uuid from jsonb_array_elements(p_members) order by 1 loop
    perform pg_advisory_xact_lock(hashtext(employee_target::text));
   end loop;
   -- Adjust existing overrides/removals before a rename synchronizes employee data.
   for employee_target in select employee_id from work_group_members where group_id=p_id and not exists(select 1 from jsonb_array_elements(p_members) m where (m->>'employee_id')::uuid=employee_id) order by employee_id loop
    perform office_set_group_member(p_id,employee_target,false,null,false,null);
   end loop;
   update work_group_members m set required_weekly_days=(j->>'days')::integer
   from jsonb_array_elements(p_members) j
   where m.group_id=p_id and m.employee_id=(j->>'employee_id')::uuid
   and ((j->>'days') is null or (j->>'days')::integer between 0 and cardinality(weekdays));
  end if;
  insert into work_groups(id,name,branch,allowed_weekdays,weekly_days,active) values(p_id,trim(p_config->>'name'),coalesce(p_config->>'branch',''),weekdays,(p_config->>'weekly_days')::integer,(p_config->>'active')::boolean)
  on conflict(id) do update set name=excluded.name,branch=excluded.branch,allowed_weekdays=excluded.allowed_weekdays,weekly_days=excluded.weekly_days,active=excluded.active;
 end if;
 select * into g from work_groups where id=p_id;
 if p_members is not null then
  if jsonb_typeof(p_members)<>'array' then raise exception 'INVALID_MEMBERS';end if;
  if (select count(*)<>count(distinct value->>'employee_id') from jsonb_array_elements(p_members)) then raise exception 'DUPLICATE_MEMBER';end if;
  -- Lock all affected employees in stable order before replacing the member set.
  for employee_target in select employee_id from work_group_members where group_id=p_id union select (value->>'employee_id')::uuid from jsonb_array_elements(p_members) order by 1 loop
   perform pg_advisory_xact_lock(hashtext(employee_target::text));
  end loop;
  for employee_target in select employee_id from work_group_members where group_id=p_id and not exists(select 1 from jsonb_array_elements(p_members) m where (m->>'employee_id')::uuid=employee_id) order by employee_id loop
   perform office_set_group_member(p_id,employee_target,false,null,false,null);
  end loop;
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
