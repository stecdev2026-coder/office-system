begin;
create extension if not exists pgcrypto;
create table if not exists public.employees (
 id uuid primary key default gen_random_uuid(), line_user_id text unique, first_name text, last_name text, nickname text, employee_code text unique,
 email text, department text, position text, role text not null default 'Staff' check(role in('Staff','Admin')), annual_leave_quota numeric not null default 0,
 is_active boolean not null default false, status text not null default 'pending', device_token text, created_at timestamptz not null default now()
);
create table if not exists public.attendance (
 id uuid primary key default gen_random_uuid(),line_user_id text not null references employees(line_user_id),work_date date not null,
 check_in_time timestamptz,check_out_time timestamptz,check_in_lat double precision,check_in_lng double precision,check_out_lat double precision,check_out_lng double precision,
 check_in_photo_url text,check_out_photo_url text,status text default 'Present',created_at timestamptz not null default now(),unique(line_user_id,work_date)
);
create table if not exists public.leave_requests (
 id uuid primary key default gen_random_uuid(),line_user_id text not null references employees(line_user_id),employee_name text,employee_picture_url text,
 leave_type text not null,leave_format text not null,start_date date not null,end_date date not null,half_day_period text,start_time time,end_time time,
 reason text,total_days numeric not null check(total_days>0),status text not null default 'pending',document_url text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(end_date>=start_date)
);
create table if not exists public.travel_trips (
 id uuid primary key default gen_random_uuid(),line_user_id text not null references employees(line_user_id),purpose text,
 status text not null default 'in_progress',total_distance_km numeric default 0,total_allowance numeric default 0,created_at timestamptz not null default now()
);
create unique index if not exists one_active_trip_per_employee on travel_trips(line_user_id) where status='in_progress';
create table if not exists public.travel_checkpoints (
 id uuid primary key default gen_random_uuid(),trip_id uuid not null references travel_trips(id) on delete cascade,point_type text,sequence integer not null,
 lat double precision,lng double precision,location_name text,note text,created_at timestamptz not null default now(),unique(trip_id,sequence)
);
create table if not exists public.calendar_events (
 id uuid primary key default gen_random_uuid(),line_user_id text references employees(line_user_id),title text not null,description text,event_date date not null,end_date date,
 start_time time,end_time time,event_type text,created_at timestamptz not null default now(),check(end_date is null or end_date>=event_date)
);
create table if not exists public.notifications (
 id uuid primary key default gen_random_uuid(),line_user_id text not null references employees(line_user_id),type text,title text,message text,reference_id uuid,
 is_read boolean not null default false,created_at timestamptz not null default now()
);
create table if not exists public.company_settings(setting_key text primary key,setting_value text);
create table if not exists public.company_holidays(id uuid primary key default gen_random_uuid(),date date not null unique,name text not null,year integer not null,created_at timestamptz not null default now());
create index if not exists leave_owner_date on leave_requests(line_user_id,start_date);
create index if not exists trip_owner_date on travel_trips(line_user_id,created_at);
create index if not exists calendar_date on calendar_events(event_date);
create index if not exists notification_owner_read on notifications(line_user_id,is_read,created_at);
alter table employees enable row level security;
alter table attendance enable row level security;
alter table leave_requests enable row level security;
alter table travel_trips enable row level security;
alter table travel_checkpoints enable row level security;
alter table calendar_events enable row level security;
alter table notifications enable row level security;
alter table company_settings enable row level security;
alter table company_holidays enable row level security;
revoke all on employees,attendance,leave_requests,travel_trips,travel_checkpoints,calendar_events,notifications,company_settings,company_holidays from anon,authenticated;
grant all on employees,attendance,leave_requests,travel_trips,travel_checkpoints,calendar_events,notifications,company_settings,company_holidays to service_role;
commit;

begin;
create table if not exists public.office_auth_settings (
  id integer primary key check (id = 1),
  line_login_enabled boolean not null default true
);
insert into public.office_auth_settings(id) values (1) on conflict do nothing;
create table if not exists public.office_auth_admins (employee_id text primary key);
-- Snapshot trusted administrators at installation. Browser-editable role fields
-- must not be the authority for changing credentials or resetting devices.
insert into public.office_auth_admins(employee_id) select id::text from public.employees where role='Admin' and is_active=true on conflict do nothing;
create table if not exists public.office_auth_identities (
  employee_id text primary key,
  line_user_id text unique,
  email text unique
);
insert into public.office_auth_identities(employee_id,line_user_id,email)
  select id::text,nullif(line_user_id,''),nullif(lower(email),'') from public.employees
  on conflict(employee_id) do nothing;
create table if not exists public.office_credentials (
  employee_id text primary key,
  username text unique not null check (username ~ '^[a-z0-9._-]{3,64}$'),
  password_hash text not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.office_devices (
  employee_id text primary key,
  device_hash text not null,
  bound_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create table if not exists public.office_sessions (
  token_hash text primary key,
  employee_id text not null,
  device_hash text not null,
  auth_method text not null check (auth_method in ('password','line','email')),
  expires_at timestamptz not null default now() + interval '30 days'
);
create index if not exists office_sessions_employee on public.office_sessions(employee_id);
create table if not exists public.office_login_attempts (
  key text primary key,
  attempts integer not null default 1,
  window_start timestamptz not null default now()
);
-- These tables must never be readable or writable from browser/anonymous clients.
alter table public.office_auth_settings enable row level security;
alter table public.office_credentials enable row level security;
alter table public.office_devices enable row level security;
alter table public.office_sessions enable row level security;
alter table public.office_login_attempts enable row level security;
alter table public.office_auth_admins enable row level security;
alter table public.office_auth_identities enable row level security;
revoke all on public.office_auth_identities from anon, authenticated;
grant all on public.office_auth_identities to service_role;
revoke all on public.office_auth_admins from anon, authenticated;
grant all on public.office_auth_admins to service_role;
revoke all on public.office_auth_settings, public.office_credentials, public.office_devices, public.office_sessions, public.office_login_attempts from anon, authenticated;
grant all on public.office_auth_settings, public.office_credentials, public.office_devices, public.office_sessions, public.office_login_attempts to service_role;

create or replace function public.office_issue_session(p_employee_id text, p_device_hash text, p_token_hash text, p_method text)
returns void language plpgsql set search_path = public as $$
declare existing_device text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_employee_id, 0));
  if not exists(select 1 from employees where id::text = p_employee_id and is_active = true) then raise exception 'INACTIVE_EMPLOYEE'; end if;
  if p_method = 'line' and not (select line_login_enabled from office_auth_settings where id=1) then raise exception 'LINE_DISABLED'; end if;
  select device_hash into existing_device from office_devices where employee_id = p_employee_id;
  if existing_device is not null and existing_device <> p_device_hash then raise exception 'DEVICE_MISMATCH'; end if;
  insert into office_devices(employee_id,device_hash) values(p_employee_id,p_device_hash)
    on conflict(employee_id) do update set last_seen_at = now();
  delete from office_sessions where employee_id=p_employee_id;
  insert into office_sessions(token_hash,employee_id,device_hash,auth_method) values(p_token_hash,p_employee_id,p_device_hash,p_method);
end $$;
create or replace function public.office_login_attempt(p_key text)
returns boolean language plpgsql set search_path = public as $$
declare amount integer;
begin
  delete from office_login_attempts where window_start < now() - interval '1 day';
  insert into office_login_attempts(key) values(p_key) on conflict(key) do update set
    attempts = case when office_login_attempts.window_start < now() - interval '15 minutes' then 1 else office_login_attempts.attempts+1 end,
    window_start = case when office_login_attempts.window_start < now() - interval '15 minutes' then now() else office_login_attempts.window_start end
  returning attempts into amount;
  return amount <= 5;
end $$;
create or replace function public.office_set_credentials(p_employee_id text,p_username text,p_password_hash text)
returns void language plpgsql set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_employee_id,0));
  if not exists(select 1 from employees where id::text=p_employee_id) then raise exception 'EMPLOYEE_NOT_FOUND'; end if;
  if exists(select 1 from office_credentials where employee_id=p_employee_id) then
    update office_credentials set username=p_username,password_hash=coalesce(p_password_hash,password_hash),updated_at=now() where employee_id=p_employee_id;
  else
    insert into office_credentials(employee_id,username,password_hash) values(p_employee_id,p_username,p_password_hash);
  end if;
  -- Existing features use this key even for employees without a LINE account.
  update employees set line_user_id='employee_' || p_employee_id where id::text=p_employee_id and line_user_id is null;
  if p_password_hash is not null then delete from office_sessions where employee_id=p_employee_id; end if;
end $$;
create or replace function public.office_reset_device(p_employee_id text)
returns void language plpgsql set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_employee_id,0));
  delete from office_sessions where employee_id=p_employee_id;
  delete from office_devices where employee_id=p_employee_id;
end $$;
create or replace function public.office_set_line_login(p_enabled boolean)
returns jsonb language plpgsql set search_path = public as $$
begin
  if not p_enabled and not exists(select 1 from office_credentials c join office_auth_admins a on a.employee_id=c.employee_id join employees e on e.id::text=c.employee_id where e.is_active=true and e.role='Admin') then raise exception 'NO_PASSWORD_ADMIN'; end if;
  update office_auth_settings set line_login_enabled=p_enabled where id=1;
  if not p_enabled then delete from office_sessions where auth_method='line'; end if;
  return jsonb_build_object('line_login_enabled',p_enabled);
end $$;
revoke all on function public.office_issue_session(text,text,text,text), public.office_login_attempt(text), public.office_set_credentials(text,text,text), public.office_reset_device(text), public.office_set_line_login(boolean) from public, anon, authenticated;
grant execute on function public.office_issue_session(text,text,text,text), public.office_login_attempt(text), public.office_set_credentials(text,text,text), public.office_reset_device(text), public.office_set_line_login(boolean) to service_role;
commit;

alter table public.employees add column if not exists division text;
alter table public.employees add column if not exists branch text;
alter table public.employees add column if not exists work_group text;
create table if not exists public.attendance_locations (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 150),
 latitude double precision not null check(latitude between -90 and 90), longitude double precision not null check(longitude between -180 and 180),
 radius_km double precision not null default 0.1 check(radius_km between 0 and 1000), active boolean not null default true
);
create table if not exists public.attendance_location_members (
 location_id uuid references public.attendance_locations on delete cascade, employee_id uuid references public.employees on delete cascade,
 primary key(location_id,employee_id)
);
create table if not exists public.attendance_policy (id integer primary key check(id=1), photo_required boolean not null default false);
insert into public.attendance_policy(id) values(1) on conflict do nothing;
create table if not exists public.work_schedules (
 id uuid primary key default gen_random_uuid(), name text not null, branch text not null default '', work_group text not null default '',
 weekdays integer[] not null default array[1,2,3,4,5], check(weekdays <@ array[0,1,2,3,4,5,6]), unique(branch,work_group)
);
create table if not exists public.attendance_events (
 id uuid primary key default gen_random_uuid(), attendance_id uuid not null references public.attendance on delete cascade,
 employee_id uuid not null references public.employees, location_id uuid not null references public.attendance_locations,
 kind text not null check(kind in ('in','checkpoint','out')), recorded_at timestamptz not null default now(),
 latitude double precision not null, longitude double precision not null, distance_km double precision not null, photo_url text
);
create index if not exists attendance_events_owner_time on public.attendance_events(employee_id,recorded_at);
create table if not exists public.office_presence(employee_id uuid primary key references public.employees on delete cascade, last_seen_at timestamptz not null default now());
alter table public.attendance_locations enable row level security;
alter table public.attendance_location_members enable row level security;
alter table public.attendance_policy enable row level security;
alter table public.work_schedules enable row level security;
alter table public.attendance_events enable row level security;
alter table public.office_presence enable row level security;
revoke all on public.attendance_locations,public.attendance_location_members,public.attendance_policy,public.work_schedules,public.attendance_events,public.office_presence from anon,authenticated;
grant all on public.attendance_locations,public.attendance_location_members,public.attendance_policy,public.work_schedules,public.attendance_events,public.office_presence to service_role;
create or replace function public.office_record_attendance(p_employee_id uuid,p_location_id uuid,p_kind text,p_lat double precision,p_lng double precision,p_photo text default null)
returns uuid language plpgsql set search_path=public as $$
declare e employees; l attendance_locations; a attendance; d double precision; event_id uuid; day date := (now() at time zone 'Asia/Bangkok')::date;
begin
 perform pg_advisory_xact_lock(hashtext(p_employee_id::text));
 select * into e from employees where id=p_employee_id and is_active=true;
 if not found then raise exception 'INACTIVE'; end if;
 if p_kind not in ('in','checkpoint','out') or p_lat is null or p_lng is null or not(p_lat between -90 and 90) or not(p_lng between -180 and 180) then raise exception 'INVALID_INPUT'; end if;
 select * into l from attendance_locations where id=p_location_id and active=true;
 if not found or not exists(select 1 from attendance_location_members where location_id=p_location_id and employee_id=p_employee_id) then raise exception 'LOCATION_DENIED'; end if;
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

create or replace function public.office_issue_session(p_employee_id text, p_device_hash text, p_token_hash text, p_method text)
returns void language plpgsql set search_path = public as $$
declare existing_device text; trusted_admin boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_employee_id, 0));
  if not exists(select 1 from employees where id::text = p_employee_id and is_active = true) then raise exception 'INACTIVE_EMPLOYEE'; end if;
  if p_method = 'line' and not (select line_login_enabled from office_auth_settings where id=1) then raise exception 'LINE_DISABLED'; end if;
  select exists(select 1 from employees e join office_auth_admins a on a.employee_id=e.id::text where e.id::text=p_employee_id and e.role='Admin' and e.is_active=true) into trusted_admin;
  if not trusted_admin then
  select device_hash into existing_device from office_devices where employee_id = p_employee_id;
  if existing_device is not null and existing_device <> p_device_hash then raise exception 'DEVICE_MISMATCH'; end if;
  insert into office_devices(employee_id,device_hash) values(p_employee_id,p_device_hash)
    on conflict(employee_id) do update set last_seen_at = now();
  delete from office_sessions where employee_id=p_employee_id;
  end if;
  insert into office_sessions(token_hash,employee_id,device_hash,auth_method) values(p_token_hash,p_employee_id,p_device_hash,p_method);
end $$;

revoke all on function public.office_issue_session(text,text,text,text) from public,anon,authenticated;
grant execute on function public.office_issue_session(text,text,text,text) to service_role;

create or replace function public.office_resource_usage()
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'databaseBytes',pg_catalog.pg_database_size(pg_catalog.current_database()),
  'storageBytes',(select coalesce(sum(case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::numeric else 0 end),0) from storage.objects),
  'storageObjects',(select count(*) from storage.objects),
  'storageUnknownObjects',(select count(*) from storage.objects where coalesce(metadata->>'size','') !~ '^[0-9]+$'),
  'employees',(select count(*) from public.employees),
  'accounts',(select count(*) from public.office_credentials),
  'attendance',(select count(*) from public.attendance),
  'checkpoints',(select count(*) from public.attendance_events),
  'leaves',(select count(*) from public.leave_requests),
  'measuredAt',pg_catalog.now()
 );
$$;
revoke all on function public.office_resource_usage() from public,anon,authenticated;
grant execute on function public.office_resource_usage() to service_role;

alter table public.employees add column if not exists profile_photo_url text;
alter table public.employees add column if not exists phone text;

-- Included migration: 202610120005_groups_permissions.sql
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

-- Included migration: 202610120006_role_assignment.sql
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

-- Included migration: 202610120007_employee_import.sql
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

-- Keep employee display data aligned with primary groups after a rename.
create or replace function public.office_group_name_changed()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.name is distinct from old.name then
  update public.employees e set work_group=new.name
  from public.work_group_members m
  where m.group_id=new.id and m.employee_id=e.id and m.is_primary
  and not exists(select 1 from public.office_super_admins s where s.employee_id=e.id);
 end if;
 return new;
end $$;
revoke all on function public.office_group_name_changed() from public,anon,authenticated;
drop trigger if exists office_group_name_changed on public.work_groups;
create trigger office_group_name_changed after update of name on public.work_groups
for each row execute function public.office_group_name_changed();
alter table public.attendance_locations add column if not exists deleted_at timestamptz;

create or replace function public.office_save_location(p_actor_id uuid,p_id uuid,p_name text,p_lat double precision,p_lng double precision,p_radius_m double precision,p_active boolean,p_groups uuid[] default null,p_photo_required boolean default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor_permissions text[]; root boolean; existing boolean;
begin
 perform pg_advisory_xact_lock(hashtext('location:'||p_id::text));
 if not exists(select 1 from employees where id=p_actor_id and is_active) then raise exception 'PERMISSION_DENIED'; end if;
 root:=exists(select 1 from office_super_admins where employee_id=p_actor_id);
 select coalesce(array_agg(distinct key),'{}') into actor_permissions from employee_permission_roles a join permission_roles r on r.id=a.role_id cross join unnest(r.permissions) key where a.employee_id=p_actor_id;
 if not root and not ('locations.edit'=any(actor_permissions)) then raise exception 'PERMISSION_DENIED'; end if;
 if p_groups is not null and not root and not ('locations.assign'=any(actor_permissions)) then raise exception 'PERMISSION_DENIED'; end if;
 if p_id is null or nullif(trim(p_name),'') is null or length(p_name)>150 or p_lat is null or p_lng is null or p_radius_m is null or not(p_lat between -90 and 90) or not(p_lng between -180 and 180) or not(p_radius_m between 0 and 1000000) or p_active is null then raise exception 'INVALID_INPUT'; end if;
 perform 1 from attendance_locations where id=p_id for update;
 select exists(select 1 from attendance_locations where id=p_id) into existing;
 if existing and exists(select 1 from attendance_locations where id=p_id and deleted_at is not null) then raise exception 'LOCATION_DELETED'; end if;
 if p_groups is not null and exists(select 1 from unnest(p_groups) g where not exists(select 1 from work_groups w where w.id=g and (w.active or exists(select 1 from attendance_location_groups a where a.location_id=p_id and a.group_id=g)))) then raise exception 'INVALID_GROUP'; end if;
 insert into attendance_locations(id,name,latitude,longitude,radius_km,active) values(p_id,trim(p_name),p_lat,p_lng,p_radius_m/1000.0,p_active)
 on conflict(id) do update set name=excluded.name,latitude=excluded.latitude,longitude=excluded.longitude,radius_km=excluded.radius_km,active=excluded.active;
 if p_groups is not null then
  delete from attendance_location_groups where location_id=p_id and not(group_id=any(p_groups));
  insert into attendance_location_groups(location_id,group_id) select p_id,g from (select distinct unnest(p_groups) g) selected on conflict do nothing;
 end if;
 if p_photo_required is not null then update attendance_policy set photo_required=p_photo_required where id=1; end if;
 return p_id;
end $$;
revoke all on function public.office_save_location(uuid,uuid,text,double precision,double precision,double precision,boolean,uuid[],boolean) from public,anon,authenticated;
grant execute on function public.office_save_location(uuid,uuid,text,double precision,double precision,double precision,boolean,uuid[],boolean) to service_role;
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

-- Included migration: 202610160001_location_optional_groups.sql
begin;
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
commit;
