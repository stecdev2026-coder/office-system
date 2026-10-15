alter table public.calendar_events
 add column if not exists end_date date;

update public.calendar_events
set end_date=event_date
where end_date is null;

alter table public.calendar_events
 drop constraint if exists calendar_events_date_range;

alter table public.calendar_events
 add constraint calendar_events_date_range
 check (end_date is null or end_date>=event_date);
