insert into public.work_groups(name,branch,allowed_weekdays,weekly_days,active,attendance_without_location)
values ('ไม่ต้องเลือกสถานที่','',array[0,1,2,3,4,5,6],6,true,true)
on conflict(name) do update set active=true,attendance_without_location=true;
