create or replace function public.office_assign_roles(p_actor_id uuid,p_employee_id uuid,p_role_ids uuid[]) returns void language plpgsql set search_path=public as $$
declare actor_super boolean; actor_permissions text[]; requested_permissions text[];
begin
 perform pg_advisory_xact_lock(hashtext(p_employee_id::text));
 if exists(select 1 from office_super_admins where employee_id=p_employee_id) then raise exception 'SUPER_ADMIN_PROTECTED';end if;
 if p_actor_id=p_employee_id then raise exception 'SELF_PERMISSION_CHANGE';end if;
 select exists(select 1 from office_super_admins where employee_id=p_actor_id) into actor_super;
 select coalesce(array_agg(distinct p),'{}') into actor_permissions from employee_permission_roles m join permission_roles r on r.id=m.role_id cross join unnest(r.permissions) p where m.employee_id=p_actor_id;
 if not actor_super and not ('permissions.manage'=any(actor_permissions)) then raise exception 'PERMISSION_DENIED';end if;
 if exists(select 1 from unnest(p_role_ids) id where not exists(select 1 from permission_roles r where r.id=id)) then raise exception 'ROLE_NOT_FOUND';end if;
 select coalesce(array_agg(distinct p),'{}') into requested_permissions from permission_roles r cross join unnest(r.permissions) p where r.id=any(p_role_ids);
 if not actor_super and not (requested_permissions <@ actor_permissions) then raise exception 'PERMISSION_ESCALATION';end if;
 delete from employee_permission_roles where employee_id=p_employee_id;
 insert into employee_permission_roles(employee_id,role_id) select p_employee_id,id from (select distinct unnest(p_role_ids) id) x;
end $$;
create or replace function public.office_default_employee_role() returns trigger language plpgsql set search_path=public as $$
declare target_role uuid;
begin
 if tg_op='UPDATE' and new.role is not distinct from old.role then return new;end if;
 select id into target_role from permission_roles where name=case when new.role='Admin' then 'ผู้ดูแลระบบ' else 'พนักงาน' end and is_system limit 1;
 if tg_op='UPDATE' then delete from employee_permission_roles m using permission_roles r where m.role_id=r.id and m.employee_id=new.id and r.is_system;end if;
 if target_role is not null then insert into employee_permission_roles(employee_id,role_id) values(new.id,target_role) on conflict do nothing;end if;
 if new.role='Admin' then insert into office_auth_admins(employee_id) values(new.id::text) on conflict do nothing;else delete from office_auth_admins where employee_id=new.id::text;end if;
 return new;
end $$;
drop trigger if exists office_default_employee_role on public.employees;
create trigger office_default_employee_role after insert or update of role on public.employees for each row execute function public.office_default_employee_role();
create or replace function public.office_can_use_location(p_employee uuid,p_location uuid) returns boolean language sql stable set search_path=public as $$
 select exists(select 1 from office_super_admins where employee_id=p_employee) or exists(select 1 from attendance_location_groups l join work_group_members m on m.group_id=l.group_id join work_groups g on g.id=m.group_id where l.location_id=p_location and m.employee_id=p_employee and g.active);
$$;
revoke all on function public.office_assign_roles(uuid,uuid,uuid[]),public.office_default_employee_role(),public.office_can_use_location(uuid,uuid) from public,anon,authenticated;
grant execute on function public.office_assign_roles(uuid,uuid,uuid[]),public.office_can_use_location(uuid,uuid) to service_role;

create or replace function public.office_bootstrap_super(p_employee_id uuid,p_hash text) returns uuid language plpgsql set search_path=public as $$
declare existing uuid;
begin
 perform pg_advisory_xact_lock(hashtext('office-bootstrap-super'));
 select employee_id into existing from office_super_admins limit 1;if existing is not null then return existing;end if;
 if nullif(p_hash,'') is null then raise exception 'INVALID_PASSWORD';end if;
 insert into employees(id,first_name,last_name,employee_code,line_user_id,role,is_active,status,employment_start_date) values(p_employee_id,'Super','Admin','SUPERADMIN','employee_'||p_employee_id,'Admin',true,'approved',current_date);
 insert into office_credentials(employee_id,username,password_hash) values(p_employee_id::text,'superadmin',p_hash);
 insert into office_auth_admins(employee_id) values(p_employee_id::text) on conflict do nothing;
 insert into office_super_admins(employee_id) values(p_employee_id);
 return p_employee_id;
end $$;

create or replace function public.office_employee_primary_group() returns trigger language plpgsql set search_path=public as $$
 declare group_id uuid;
 begin
  if tg_op='UPDATE' and new.work_group is not distinct from old.work_group then return new;end if;
  if nullif(new.work_group,'') is null then update work_group_members set is_primary=false where employee_id=new.id;return new;end if;
  select id into group_id from work_groups where name=new.work_group and active;
  if group_id is null then raise exception 'GROUP_NOT_FOUND';end if;
  perform office_set_group_member(group_id,new.id,true,null,true,new.employment_start_date);
  return new;
 end $$;
 drop trigger if exists office_employee_primary_group on public.employees;
 create trigger office_employee_primary_group after insert or update of work_group on public.employees for each row execute function public.office_employee_primary_group();
 revoke all on function public.office_bootstrap_super(uuid,text),public.office_employee_primary_group() from public,anon,authenticated;
 grant execute on function public.office_bootstrap_super(uuid,text) to service_role;
