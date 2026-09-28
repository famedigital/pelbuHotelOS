-- Network clock user IDs, and punches that arrive before a staff link exists.
-- Fingerprint and face templates are never stored.

alter table staff_members
  add column if not exists biometric_user_id text;

alter table staff_members
  drop constraint if exists staff_members_biometric_user_id_check;

alter table staff_members
  add constraint staff_members_biometric_user_id_check
  check (
    biometric_user_id is null
    or biometric_user_id ~ '^[A-Z0-9]{1,24}$'
  );

create unique index if not exists staff_members_property_biometric_uidx
  on staff_members (property_id, biometric_user_id)
  where biometric_user_id is not null;

create unique index if not exists attendance_devices_active_serial_uidx
  on attendance_devices (upper(external_ref))
  where external_ref is not null and is_active;

create table if not exists attendance_unmatched_punches (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  device_id uuid references attendance_devices(id) on delete set null,
  biometric_user_id text not null,
  occurred_at timestamptz not null,
  raw_status text,
  client_event_id text not null,
  created_at timestamptz not null default now(),
  unique (property_id, client_event_id)
);

create index if not exists attendance_unmatched_punches_pin_idx
  on attendance_unmatched_punches (property_id, biometric_user_id, occurred_at);

alter table attendance_unmatched_punches enable row level security;

drop policy if exists "service_role full attendance_unmatched_punches"
  on attendance_unmatched_punches;
create policy "service_role full attendance_unmatched_punches"
  on attendance_unmatched_punches
  for all to service_role
  using (true)
  with check (true);

revoke all on attendance_unmatched_punches from anon, authenticated;
