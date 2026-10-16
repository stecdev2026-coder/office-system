alter table public.office_pin_credentials
  add column if not exists reauth_expires_at timestamptz;

update public.office_pin_credentials p
set reauth_expires_at=coalesce((
  select max(s.expires_at) from public.office_sessions s
  where s.employee_id=p.employee_id and s.device_hash=p.device_hash
),now())
where p.reauth_expires_at is null;

alter table public.office_sessions drop constraint if exists office_sessions_auth_method_check;
alter table public.office_sessions add constraint office_sessions_auth_method_check
  check (auth_method in ('password','line','email','pin'));
