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
