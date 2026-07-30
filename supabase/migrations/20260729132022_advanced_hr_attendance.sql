-- Advanced HR attendance: append-only punches, kiosk and biometric devices.
-- Attendance facts are immutable. Corrections are represented by void metadata
-- and replacement events so payroll retains a complete audit trail.

create table if not exists attendance_devices (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  name text not null,
  device_type text not null
    check (device_type = any (array['kiosk'::text, 'biometric'::text, 'integration'::text])),
  external_ref text,
  secret_hash text,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, external_ref)
);

create index if not exists attendance_devices_property_idx
  on attendance_devices (property_id, is_active, device_type);

create table if not exists staff_attendance_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  staff_id uuid not null references staff_members(id) on delete cascade,
  shift_id uuid references staff_shifts(id) on delete set null,
  device_id uuid references attendance_devices(id) on delete set null,
  event_kind text not null
    check (event_kind = any (array[
      'clock_in'::text,
      'clock_out'::text,
      'break_start'::text,
      'break_end'::text
    ])),
  source text not null
    check (source = any (array[
      'staff_mobile'::text,
      'offline_sync'::text,
      'kiosk'::text,
      'biometric'::text,
      'manual'::text,
      'integration'::text
    ])),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  client_event_id text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  accuracy_meters numeric(8, 2),
  notes text,
  recorded_by text not null default 'staff',
  voided_at timestamptz,
  voided_by text,
  void_reason text,
  created_at timestamptz not null default now(),
  constraint attendance_latitude_check
    check (latitude is null or latitude between -90 and 90),
  constraint attendance_longitude_check
    check (longitude is null or longitude between -180 and 180),
  constraint attendance_accuracy_check
    check (accuracy_meters is null or accuracy_meters >= 0),
  constraint attendance_void_complete_check
    check (
      (voided_at is null and voided_by is null and void_reason is null)
      or
      (voided_at is not null and voided_by is not null and void_reason is not null)
    )
);

create unique index if not exists staff_attendance_events_client_id_idx
  on staff_attendance_events (property_id, staff_id, client_event_id)
  where client_event_id is not null;

create index if not exists staff_attendance_events_property_time_idx
  on staff_attendance_events (property_id, occurred_at desc)
  where voided_at is null;

create index if not exists staff_attendance_events_staff_time_idx
  on staff_attendance_events (staff_id, occurred_at desc)
  where voided_at is null;

create index if not exists staff_attendance_events_shift_fk_idx
  on staff_attendance_events (shift_id)
  where shift_id is not null;

create index if not exists staff_attendance_events_device_fk_idx
  on staff_attendance_events (device_id)
  where device_id is not null;

alter table attendance_devices enable row level security;
alter table staff_attendance_events enable row level security;

drop policy if exists "service_role full attendance_devices" on attendance_devices;
create policy "service_role full attendance_devices" on attendance_devices
  for all to service_role using (true) with check (true);

drop policy if exists "service_role full staff_attendance_events" on staff_attendance_events;
create policy "service_role full staff_attendance_events" on staff_attendance_events
  for all to service_role using (true) with check (true);

drop policy if exists "employee read own attendance" on staff_attendance_events;
create policy "employee read own attendance" on staff_attendance_events
  for select to authenticated
  using (
    staff_id = private.current_staff_id()
    and property_id = private.current_staff_property_id()
  );

-- All writes pass through validated server actions or signed device endpoints.
revoke insert, update, delete on staff_attendance_events from authenticated;
grant select on staff_attendance_events to authenticated;
revoke all on attendance_devices from authenticated;

do $$
begin
  alter publication supabase_realtime add table staff_attendance_events;
exception
  when duplicate_object then null;
end
$$;
