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
