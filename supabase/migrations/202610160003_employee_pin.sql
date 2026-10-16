create table if not exists public.office_pin_credentials (
  employee_id text primary key,
  device_hash text not null,
  pin_hash text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.office_pin_credentials enable row level security;
revoke all on public.office_pin_credentials from anon, authenticated;
grant all on public.office_pin_credentials to service_role;

create or replace function public.office_clear_pin_after_password_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.password_hash is distinct from new.password_hash then
    delete from office_pin_credentials where employee_id=new.employee_id;
  end if;
  return new;
end $$;
drop trigger if exists office_clear_pin_after_password_change on public.office_credentials;
create trigger office_clear_pin_after_password_change after update of password_hash on public.office_credentials for each row execute function public.office_clear_pin_after_password_change();
revoke all on function public.office_clear_pin_after_password_change() from public, anon, authenticated;

alter table public.office_sessions add column if not exists created_at timestamptz not null default now();

create or replace function public.office_reset_device(p_employee_id text)
returns void language plpgsql set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_employee_id,0));
  delete from office_sessions where employee_id=p_employee_id;
  delete from office_pin_credentials where employee_id=p_employee_id;
  delete from office_devices where employee_id=p_employee_id;
end $$;

revoke all on function public.office_reset_device(text) from public, anon, authenticated;
grant execute on function public.office_reset_device(text) to service_role;
