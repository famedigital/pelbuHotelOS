-- Group / banquet events: service time + set-menu note for kitchen visibility.
alter table kitchen_events
  add column if not exists service_time time,
  add column if not exists menu_note text;
