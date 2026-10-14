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
