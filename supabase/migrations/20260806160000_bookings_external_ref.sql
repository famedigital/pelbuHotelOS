-- Legacy PMS import: stable external reservation ids (e.g. eZee SSRESN####)
alter table public.bookings
  add column if not exists external_ref text;

comment on column public.bookings.external_ref is
  'Stable id from legacy / channel PMS (e.g. ezee:SSRESN3961). Unique per property when set.';

create unique index if not exists bookings_property_external_ref_uidx
  on public.bookings (property_id, external_ref)
  where external_ref is not null;
