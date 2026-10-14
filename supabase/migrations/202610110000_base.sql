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
 id uuid primary key default gen_random_uuid(),line_user_id text references employees(line_user_id),title text not null,description text,event_date date not null,
 start_time time,end_time time,event_type text,created_at timestamptz not null default now()
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
