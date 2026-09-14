-- Room rack: physical unit sort order + night-level room assignments.
-- Desk uses service_role. No anon policies.

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- room_units.sort_order (Excel col B row order)
-- ---------------------------------------------------------------------------
alter table room_units
  add column if not exists sort_order integer not null default 0;

update room_units
set sort_order = sub.rn
from (
  select
    id,
    row_number() over (
      partition by property_id
      order by coalesce(floor_label, ''), label
    )::integer as rn
  from room_units
) as sub
where room_units.id = sub.id
  and room_units.sort_order = 0;

create index if not exists room_units_property_sort_idx
  on room_units (property_id, sort_order, label);

comment on column room_units.sort_order is
  'Display order on the room rack (Excel-style left column).';

-- ---------------------------------------------------------------------------
-- room_assignments — one physical unit per stay segment
-- from_date inclusive, to_date exclusive (hotel night convention)
-- ---------------------------------------------------------------------------
create table if not exists room_assignments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  booking_id uuid not null references bookings(id) on delete cascade,
  room_unit_id uuid not null references room_units(id) on delete restrict,
  from_date date not null,
  to_date date not null,
  created_at timestamptz not null default now(),
  check (to_date > from_date),
  exclude using gist (
    room_unit_id with =,
    daterange(from_date, to_date, '[)') with &&
  )
);

create index if not exists room_assignments_property_dates_idx
  on room_assignments (property_id, from_date, to_date);

create index if not exists room_assignments_booking_idx
  on room_assignments (booking_id);

create index if not exists room_assignments_unit_idx
  on room_assignments (room_unit_id, from_date, to_date);

alter table room_assignments enable row level security;

drop policy if exists "service_role full room_assignments" on room_assignments;
create policy "service_role full room_assignments" on room_assignments
  for all to service_role using (true) with check (true);

comment on table room_assignments is
  'Maps a booking stay segment onto a physical room_unit for the room rack.';

comment on column room_assignments.from_date is
  'First occupied night (usually booking.check_in).';

comment on column room_assignments.to_date is
  'Exclusive end (usually booking.check_out).';

alter table room_assignments replica identity full;
