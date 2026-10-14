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
