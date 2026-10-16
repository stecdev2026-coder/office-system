alter table public.office_devices add column if not exists device_type text;
alter table public.office_devices add column if not exists device_name text;
alter table public.office_devices add column if not exists platform text;
alter table public.office_devices add column if not exists browser text;
alter table public.office_devices add column if not exists user_agent text;
