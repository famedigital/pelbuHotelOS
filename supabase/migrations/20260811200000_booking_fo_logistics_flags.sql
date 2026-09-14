-- FO logistics + house-use / DNR flags (eZee Edit Transaction lite).

alter table public.bookings
  add column if not exists house_use boolean not null default false;

alter table public.bookings
  add column if not exists dnr boolean not null default false;

alter table public.bookings
  add column if not exists dnr_reason text;

alter table public.bookings
  add column if not exists pickup_needed boolean not null default false;

alter table public.bookings
  add column if not exists dropoff_needed boolean not null default false;

alter table public.bookings
  add column if not exists pickup_at timestamptz;

alter table public.bookings
  add column if not exists dropoff_at timestamptz;

alter table public.bookings
  add column if not exists transport_arrival_mode text;

alter table public.bookings
  add column if not exists transport_departure_mode text;

alter table public.bookings
  add column if not exists transport_notes text;

alter table public.bookings
  add column if not exists visa_no text;

alter table public.bookings
  add column if not exists visa_expiry date;

alter table public.bookings
  add column if not exists arrived_from text;

alter table public.bookings
  add column if not exists purpose_of_visit text;

comment on column public.bookings.house_use is
  'House-use / complimentary stay flag (FO; NC room charge often via assignment.chargeable).';
comment on column public.bookings.dnr is
  'Do-not-rent / guest DNR flag for this booking context.';
comment on column public.bookings.dnr_reason is
  'Optional reason when dnr is true.';
comment on column public.bookings.pickup_needed is
  'FO transport: arrival pick-up requested.';
comment on column public.bookings.dropoff_needed is
  'FO transport: departure drop-off requested.';
