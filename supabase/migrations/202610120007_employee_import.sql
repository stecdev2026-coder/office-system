create or replace function public.office_employee_primary_group() returns trigger language plpgsql set search_path=public as $$
declare target_group uuid; existing_days integer; existing_effective date;
begin
 if tg_op='UPDATE' and new.work_group is not distinct from old.work_group then return new;end if;
 if nullif(new.work_group,'') is null then update work_group_members set is_primary=false where employee_id=new.id;return new;end if;
 select id into target_group from work_groups where name=new.work_group and active;if target_group is null then raise exception 'GROUP_NOT_FOUND';end if;
 select required_weekly_days,effective_from into existing_days,existing_effective from work_group_members where group_id=target_group and employee_id=new.id;
 perform office_set_group_member(target_group,new.id,true,existing_days,true,coalesce(existing_effective,new.employment_start_date));return new;
end $$;
create or replace function public.office_set_group_member(p_group_id uuid,p_employee_id uuid,p_enabled boolean,p_days integer default null,p_primary boolean default false,p_effective date default null) returns void language plpgsql set search_path=public as $$
declare g work_groups; earliest date;
begin
 perform pg_advisory_xact_lock(hashtext(p_employee_id::text));
 if exists(select 1 from office_super_admins where employee_id=p_employee_id) then raise exception 'SUPER_ADMIN_PROTECTED';end if;
 select * into g from work_groups where id=p_group_id;if not found then raise exception 'GROUP_NOT_FOUND';end if;
 if p_days is not null and (p_days<0 or p_days>cardinality(g.allowed_weekdays)) then raise exception 'INVALID_WEEKLY_DAYS';end if;
 select employment_start_date into earliest from employees where id=p_employee_id;if not found then raise exception 'EMPLOYEE_NOT_FOUND';end if;
 if not p_enabled then
  delete from work_group_members where group_id=p_group_id and employee_id=p_employee_id;
  if not exists(select 1 from work_group_members where employee_id=p_employee_id and is_primary) then update employees set work_group=null where id=p_employee_id and work_group is not null;end if;
  return;
 end if;
 if p_primary then update work_group_members set is_primary=false where employee_id=p_employee_id;end if;
 insert into work_group_members(group_id,employee_id,required_weekly_days,is_primary,effective_from) values(p_group_id,p_employee_id,p_days,p_primary or not exists(select 1 from work_group_members where employee_id=p_employee_id and is_primary),coalesce(p_effective,earliest,(now() at time zone 'Asia/Bangkok')::date)) on conflict(group_id,employee_id) do update set required_weekly_days=excluded.required_weekly_days,is_primary=excluded.is_primary,effective_from=excluded.effective_from;
 if exists(select 1 from work_group_members where group_id=p_group_id and employee_id=p_employee_id and is_primary) then update employees set work_group=g.name where id=p_employee_id and work_group is distinct from g.name;
 elsif not exists(select 1 from work_group_members where employee_id=p_employee_id and is_primary) then update employees set work_group=null where id=p_employee_id and work_group is not null;end if;
end $$;
create or replace function public.office_import_employees(p_actor_id uuid,p_rows jsonb) returns integer language plpgsql set search_path=public as $$
declare actor_super boolean; actor_permissions text[]; row_data jsonb; target_role permission_roles; target_group work_groups; new_id uuid; imported integer:=0;
begin
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>1000 or jsonb_array_length(p_rows)=0 then raise exception 'INVALID_IMPORT';end if;
 if not exists(select 1 from employees where id=p_actor_id and is_active) then raise exception 'PERMISSION_DENIED';end if;
 select exists(select 1 from office_super_admins where employee_id=p_actor_id) into actor_super;
 select coalesce(array_agg(distinct p),'{}') into actor_permissions from employee_permission_roles m join permission_roles r on r.id=m.role_id cross join unnest(r.permissions) p where m.employee_id=p_actor_id;
 if not actor_super and not ('users.import'=any(actor_permissions)) then raise exception 'PERMISSION_DENIED';end if;
 for row_data in select * from jsonb_array_elements(p_rows) loop
  new_id:=(row_data->>'id')::uuid;
  if upper(row_data->>'employee_code')='SUPERADMIN' or exists(select 1 from office_super_admins where employee_id=new_id) then raise exception 'SUPER_ADMIN_PROTECTED';end if;
  select * into target_role from permission_roles where id=(row_data->>'role_id')::uuid;if not found then raise exception 'ROLE_NOT_FOUND';end if;
  if target_role.name<>'พนักงาน' and not actor_super and not ('permissions.manage'=any(actor_permissions)) then raise exception 'PERMISSION_DENIED';end if;
  if not actor_super and not (target_role.permissions <@ actor_permissions) then raise exception 'PERMISSION_ESCALATION';end if;
  if nullif(row_data->>'work_group','') is not null then
   if not actor_super and not ('groups.members'=any(actor_permissions)) then raise exception 'PERMISSION_DENIED';end if;
   select * into target_group from work_groups where name=row_data->>'work_group' and active;if not found then raise exception 'GROUP_NOT_FOUND';end if;
  end if;
  insert into employees(id,employee_code,first_name,last_name,nickname,email,phone,department,division,branch,position,work_group,annual_leave_quota,is_active,status,role,line_user_id,employment_start_date)
  values(new_id,row_data->>'employee_code',row_data->>'first_name',row_data->>'last_name',nullif(row_data->>'nickname',''),nullif(row_data->>'email',''),nullif(row_data->>'phone',''),nullif(row_data->>'department',''),nullif(row_data->>'division',''),nullif(row_data->>'branch',''),nullif(row_data->>'position',''),nullif(row_data->>'work_group',''),(row_data->>'annual_leave_quota')::numeric,(row_data->>'is_active')::boolean,case when (row_data->>'is_active')::boolean then 'approved' else 'pending' end,case when target_role.name='ผู้ดูแลระบบ' and target_role.is_system then 'Admin' else 'Staff' end,'employee_'||new_id,coalesce(nullif(row_data->>'employment_start_date','')::date,(now() at time zone 'Asia/Bangkok')::date));
  if target_role.name<>'พนักงาน' or not target_role.is_system then perform office_assign_roles(p_actor_id,new_id,array[target_role.id]);end if;
  if nullif(row_data->>'work_group','') is not null then perform office_set_group_member(target_group.id,new_id,true,nullif(row_data->>'weekly_days','')::integer,true,nullif(row_data->>'employment_start_date','')::date);end if;
  imported:=imported+1;
 end loop;
 return imported;
end $$;
revoke all on function public.office_employee_primary_group(),public.office_set_group_member(uuid,uuid,boolean,integer,boolean,date),public.office_import_employees(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.office_set_group_member(uuid,uuid,boolean,integer,boolean,date),public.office_import_employees(uuid,jsonb) to service_role;
