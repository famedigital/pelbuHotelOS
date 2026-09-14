-- Physical room attributes for calendar rack density
alter table public.room_units
  add column if not exists view_label text,
  add column if not exists has_balcony boolean not null default false;

comment on column public.room_units.view_label is
  'Short view descriptor for desk rack (Valley, Courtyard, Street).';

comment on column public.room_units.has_balcony is
  'Whether the physical room has a balcony; shown on calendar rack.';
