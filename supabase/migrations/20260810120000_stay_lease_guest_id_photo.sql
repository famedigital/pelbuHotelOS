-- Wave C: multi-machine StayHub soft lease + guest passport/CID photo on CI

-- Concurrent edit lease (eZee Net Locks lite). Short-lived; forceable by manager.
create table if not exists booking_stay_leases (
  booking_id uuid primary key references bookings(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  staff_id uuid references staff_members(id) on delete set null,
  client_token text not null,
  holder_label text not null default 'Desk',
  claimed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  force_note text
);

create index if not exists booking_stay_leases_expires_idx
  on booking_stay_leases (expires_at);

create index if not exists booking_stay_leases_property_idx
  on booking_stay_leases (property_id);

alter table booking_stay_leases enable row level security;

drop policy if exists "service_role full booking_stay_leases" on booking_stay_leases;
create policy "service_role full booking_stay_leases" on booking_stay_leases
  for all
  using (true)
  with check (true);

comment on table booking_stay_leases is
  'Soft StayHub edit lease per booking; expires so desks do not silently double-edit.';

-- First-class CID / passport capture photograph (alongside text id + SDF doc).
alter table booking_guests
  add column if not exists id_photo_url text;

comment on column booking_guests.id_photo_url is
  'Cloudinary (or URL) photo of passport / CID for immigration-style CI capture.';
