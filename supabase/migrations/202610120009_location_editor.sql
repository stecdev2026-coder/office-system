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
