begin;
create table if not exists public.office_super_admins(employee_id uuid primary key references public.employees(id),created_at timestamptz not null default now());
create table if not exists public.permission_roles(id uuid primary key default gen_random_uuid(),name text not null unique check(length(name) between 1 and 100),description text not null default '',permissions text[] not null default '{}',is_system boolean not null default false);
create table if not exists public.employee_permission_roles(employee_id uuid references public.employees(id) on delete cascade,role_id uuid references public.permission_roles(id) on delete cascade,primary key(employee_id,role_id));
create table if not exists public.work_groups(id uuid primary key default gen_random_uuid(),name text not null unique check(length(name) between 1 and 150),branch text not null default '',allowed_weekdays integer[] not null default array[0,1,2,3,4,5,6],weekly_days integer not null default 6,active boolean not null default true,created_at timestamptz not null default now(),check(allowed_weekdays <@ array[0,1,2,3,4,5,6]),check(cardinality(allowed_weekdays)>0),check(weekly_days between 0 and 7 and weekly_days<=cardinality(allowed_weekdays)));
create table if not exists public.work_group_members(group_id uuid references public.work_groups(id) on delete cascade,employee_id uuid references public.employees(id) on delete cascade,required_weekly_days integer check(required_weekly_days between 0 and 7),is_primary boolean not null default false,effective_from date not null default (now() at time zone 'Asia/Bangkok')::date,primary key(group_id,employee_id));
create unique index if not exists work_group_one_primary on public.work_group_members(employee_id) where is_primary;
create index if not exists work_group_member_employee on public.work_group_members(employee_id);
create table if not exists public.attendance_location_groups(location_id uuid references public.attendance_locations(id) on delete cascade,group_id uuid references public.work_groups(id) on delete cascade,primary key(location_id,group_id));
alter table public.employees add column if not exists employment_start_date date;
update public.employees set employment_start_date=(created_at at time zone 'Asia/Bangkok')::date where employment_start_date is null;
alter table public.office_super_admins enable row level security;
alter table public.permission_roles enable row level security;
alter table public.employee_permission_roles enable row level security;
alter table public.work_groups enable row level security;
alter table public.work_group_members enable row level security;
alter table public.attendance_location_groups enable row level security;
revoke all on public.office_super_admins,public.permission_roles,public.employee_permission_roles,public.work_groups,public.work_group_members,public.attendance_location_groups from public,anon,authenticated;
grant all on public.office_super_admins,public.permission_roles,public.employee_permission_roles,public.work_groups,public.work_group_members,public.attendance_location_groups to service_role;
insert into public.permission_roles(name,description,permissions,is_system) values
('ผู้ดูแลระบบ','สิทธิ์ผู้ดูแลระบบเริ่มต้น',array['attendance.view','attendance.export','absence.view','users.view','users.create','users.edit','users.delete','users.accounts','users.import','groups.view','groups.edit','groups.members','locations.view','locations.edit','locations.assign','requests.view','requests.approve','settings.view','settings.edit','usage.view','permissions.view','permissions.manage','calendar.manage','travel.manage'],true),
('พนักงาน','ใช้งานส่วนพนักงาน ไม่มีสิทธิ์หลังบ้าน','{}',true)
on conflict(name) do nothing;
insert into public.employee_permission_roles(employee_id,role_id) select e.id,r.id from public.employees e join public.office_auth_admins a on a.employee_id=e.id::text cross join public.permission_roles r where e.role='Admin' and r.name='ผู้ดูแลระบบ' on conflict do nothing;
-- Carry forward existing schedules and memberships without deleting legacy data.
insert into public.work_groups(name,branch,allowed_weekdays,weekly_days) select coalesce(nullif(work_group,''),'ตาราง: '||name),branch,weekdays,least(6,cardinality(weekdays)) from public.work_schedules where cardinality(weekdays)>0 on conflict(name) do nothing;
insert into public.work_groups(name) select distinct work_group from public.employees where nullif(work_group,'') is not null on conflict(name) do nothing;
insert into public.work_group_members(group_id,employee_id,effective_from) select g.id,e.id,coalesce(e.employment_start_date,current_date) from public.employees e join public.work_groups g on g.name=e.work_group on conflict do nothing;
insert into public.work_groups(name) select 'สถานที่เดิม: '||l.name||' ['||left(l.id::text,8)||']' from public.attendance_locations l where exists(select 1 from public.attendance_location_members m where m.location_id=l.id) on conflict do nothing;
insert into public.work_group_members(group_id,employee_id,effective_from) select g.id,m.employee_id,coalesce(e.employment_start_date,current_date) from public.attendance_location_members m join public.attendance_locations l on l.id=m.location_id join public.work_groups g on g.name='สถานที่เดิม: '||l.name||' ['||left(l.id::text,8)||']' join public.employees e on e.id=m.employee_id on conflict do nothing;
insert into public.attendance_location_groups(location_id,group_id) select l.id,g.id from public.attendance_locations l join public.work_groups g on g.name='สถานที่เดิม: '||l.name||' ['||left(l.id::text,8)||']' on conflict do nothing;
update public.work_group_members m set is_primary=true from (select employee_id,min(group_id::text)::uuid group_id from public.work_group_members group by employee_id) x where m.employee_id=x.employee_id and m.group_id=x.group_id and not exists(select 1 from public.work_group_members p where p.employee_id=m.employee_id and p.is_primary);
create or replace function public.office_guard_super_employee() returns trigger language plpgsql set search_path=public as $$
begin
 if exists(select 1 from office_super_admins where employee_id=old.id) then
  if tg_op='DELETE' then raise exception 'SUPER_ADMIN_PROTECTED';end if;
  if (to_jsonb(new)-array['first_name','last_name','nickname','email','phone','profile_photo_url']) is distinct from (to_jsonb(old)-array['first_name','last_name','nickname','email','phone','profile_photo_url']) then raise exception 'SUPER_ADMIN_PROTECTED';end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
drop trigger if exists office_guard_super_employee on public.employees;
create trigger office_guard_super_employee before update or delete on public.employees for each row execute function public.office_guard_super_employee();
create or replace function public.office_guard_super_record() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_table_name='office_super_admins' or exists(select 1 from office_super_admins where employee_id::text=old.employee_id::text) then
  if tg_table_name='office_credentials' and tg_op='UPDATE' and current_setting('office.super_password_actor',true)=old.employee_id::text and new.username=old.username and new.employee_id=old.employee_id then return new;end if;
  raise exception 'SUPER_ADMIN_PROTECTED';
 end if;if tg_op='DELETE' then return old;end if;return new;
end $$;
drop trigger if exists office_guard_super_authority on public.office_super_admins;
create trigger office_guard_super_authority before update or delete on public.office_super_admins for each row execute function public.office_guard_super_record();
drop trigger if exists office_guard_super_credentials on public.office_credentials;
create trigger office_guard_super_credentials before update or delete on public.office_credentials for each row execute function public.office_guard_super_record();
drop trigger if exists office_guard_super_admin_trust on public.office_auth_admins;
create trigger office_guard_super_admin_trust before update or delete on public.office_auth_admins for each row execute function public.office_guard_super_record();
create or replace function public.office_change_own_password(p_employee_id text,p_expected_hash text,p_new_hash text) returns void language plpgsql set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_employee_id,0));
 if not exists(select 1 from office_credentials where employee_id=p_employee_id and password_hash=p_expected_hash) then raise exception 'STALE_PASSWORD';end if;
 if nullif(p_new_hash,'') is null then raise exception 'INVALID_PASSWORD';end if;
 perform set_config('office.super_password_actor',p_employee_id,true);
 update office_credentials set password_hash=p_new_hash,updated_at=now() where employee_id=p_employee_id;
 delete from office_sessions where employee_id=p_employee_id;
end $$;
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
create or replace function public.office_set_group_member(p_group_id uuid,p_employee_id uuid,p_enabled boolean,p_days integer default null,p_primary boolean default false,p_effective date default null) returns void language plpgsql set search_path=public as $$
declare g work_groups; earliest date;
begin
 perform pg_advisory_xact_lock(hashtext(p_employee_id::text));
 if exists(select 1 from office_super_admins where employee_id=p_employee_id) then raise exception 'SUPER_ADMIN_PROTECTED';end if;
 select * into g from work_groups where id=p_group_id;if not found then raise exception 'GROUP_NOT_FOUND';end if;
 if p_days is not null and (p_days<0 or p_days>cardinality(g.allowed_weekdays)) then raise exception 'INVALID_WEEKLY_DAYS';end if;
 select employment_start_date into earliest from employees where id=p_employee_id;if not found then raise exception 'EMPLOYEE_NOT_FOUND';end if;
 if not p_enabled then delete from work_group_members where group_id=p_group_id and employee_id=p_employee_id;return;end if;
 if p_primary then update work_group_members set is_primary=false where employee_id=p_employee_id;end if;
 insert into work_group_members(group_id,employee_id,required_weekly_days,is_primary,effective_from) values(p_group_id,p_employee_id,p_days,p_primary or not exists(select 1 from work_group_members where employee_id=p_employee_id and is_primary),coalesce(p_effective,earliest,(now() at time zone 'Asia/Bangkok')::date)) on conflict(group_id,employee_id) do update set required_weekly_days=excluded.required_weekly_days,is_primary=excluded.is_primary,effective_from=excluded.effective_from;
end $$;
revoke all on function public.office_guard_super_employee(),public.office_guard_super_record() from public,anon,authenticated;
revoke all on function public.office_change_own_password(text,text,text),public.office_bootstrap_super(uuid,text),public.office_set_group_member(uuid,uuid,boolean,integer,boolean,date) from public,anon,authenticated;
grant execute on function public.office_change_own_password(text,text,text),public.office_bootstrap_super(uuid,text),public.office_set_group_member(uuid,uuid,boolean,integer,boolean,date) to service_role;
create or replace function public.office_can_use_location(p_employee uuid,p_location uuid) returns boolean language sql stable set search_path=public as $$
 select exists(select 1 from attendance_location_groups l join work_group_members m on m.group_id=l.group_id join work_groups g on g.id=m.group_id where l.location_id=p_location and m.employee_id=p_employee and g.active);
$$;
revoke all on function public.office_can_use_location(uuid,uuid) from public,anon,authenticated;
grant execute on function public.office_can_use_location(uuid,uuid) to service_role;
create or replace function public.office_record_attendance(p_employee_id uuid,p_location_id uuid,p_kind text,p_lat double precision,p_lng double precision,p_photo text default null)
returns uuid language plpgsql set search_path=public as $$
declare e employees; l attendance_locations; a attendance; d double precision; event_id uuid; day date := (now() at time zone 'Asia/Bangkok')::date;
begin
 perform pg_advisory_xact_lock(hashtext(p_employee_id::text));
 select * into e from employees where id=p_employee_id and is_active=true;
 if not found then raise exception 'INACTIVE'; end if;
 if p_kind not in ('in','checkpoint','out') or p_lat is null or p_lng is null or not(p_lat between -90 and 90) or not(p_lng between -180 and 180) then raise exception 'INVALID_INPUT'; end if;
 select * into l from attendance_locations where id=p_location_id and active=true;
 if not found or not public.office_can_use_location(p_employee_id,p_location_id) then raise exception 'LOCATION_DENIED'; end if;
 d := 6371 * 2 * asin(sqrt(least(1.0,power(sin(radians(p_lat-l.latitude)/2),2)+cos(radians(l.latitude))*cos(radians(p_lat))*power(sin(radians(p_lng-l.longitude)/2),2))));
 if d > l.radius_km then raise exception 'OUTSIDE_RADIUS'; end if;
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

commit;
