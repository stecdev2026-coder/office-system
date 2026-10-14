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
