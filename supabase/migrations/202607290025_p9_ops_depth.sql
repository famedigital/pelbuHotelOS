-- P9 ops depth: HK assignments, maintenance, booking groups, agent allotments
-- Desk uses service_role. No anon policies.

-- ---------------------------------------------------------------------------
-- Housekeeping assignments
-- ---------------------------------------------------------------------------
create table if not exists hk_assignments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  room_unit_id uuid not null references room_units(id) on delete cascade,
  staff_id uuid not null references staff_members(id) on delete restrict,
  business_date date not null,
  status text not null default 'open'
    check (status = any (array['open'::text, 'in_progress'::text, 'done'::text, 'skipped'::text])),
  due_at timestamptz,
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists hk_assignments_day_idx
  on hk_assignments (property_id, business_date, status);

create index if not exists hk_assignments_staff_idx
  on hk_assignments (staff_id, business_date);

alter table hk_assignments enable row level security;

drop policy if exists "service_role full hk_assignments" on hk_assignments;
create policy "service_role full hk_assignments" on hk_assignments
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Maintenance / work orders
-- ---------------------------------------------------------------------------
create table if not exists maintenance_orders (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  room_unit_id uuid references room_units(id) on delete set null,
  title text not null,
  description text,
  priority text not null default 'normal'
    check (priority = any (array['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])),
  status text not null default 'open'
    check (status = any (array['open'::text, 'in_progress'::text, 'done'::text, 'cancelled'::text])),
  assigned_staff_id uuid references staff_members(id) on delete set null,
  created_by text not null default 'desk',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists maintenance_orders_property_idx
  on maintenance_orders (property_id, status, created_at desc);

alter table maintenance_orders enable row level security;

drop policy if exists "service_role full maintenance_orders" on maintenance_orders;
create policy "service_role full maintenance_orders" on maintenance_orders
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Booking groups / blocks
-- ---------------------------------------------------------------------------
create table if not exists booking_groups (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  name text not null,
  agent_id uuid references agents(id) on delete set null,
  check_in date,
  check_out date,
  notes text,
  status text not null default 'open'
    check (status = any (array['open'::text, 'confirmed'::text, 'closed'::text, 'cancelled'::text])),
  created_at timestamptz not null default now()
);

create index if not exists booking_groups_property_idx
  on booking_groups (property_id, status, check_in);

alter table booking_groups enable row level security;

drop policy if exists "service_role full booking_groups" on booking_groups;
create policy "service_role full booking_groups" on booking_groups
  for all to service_role using (true) with check (true);

create table if not exists booking_group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references booking_groups(id) on delete cascade,
  booking_id uuid not null references bookings(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_id, booking_id)
);

create index if not exists booking_group_members_booking_idx
  on booking_group_members (booking_id);

alter table booking_group_members enable row level security;

drop policy if exists "service_role full booking_group_members" on booking_group_members;
create policy "service_role full booking_group_members" on booking_group_members
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Agent seasonal allotments
-- ---------------------------------------------------------------------------
create table if not exists agent_allotments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  room_type_id uuid not null references room_types(id) on delete cascade,
  season_kind text not null
    check (season_kind = any (array['peak'::text, 'lean'::text, 'off'::text])),
  rooms_per_week integer not null check (rooms_per_week > 0),
  valid_from date not null,
  valid_to date not null,
  notes text,
  created_at timestamptz not null default now(),
  check (valid_to >= valid_from)
);

create index if not exists agent_allotments_property_idx
  on agent_allotments (property_id, agent_id, season_kind);

alter table agent_allotments enable row level security;

drop policy if exists "service_role full agent_allotments" on agent_allotments;
create policy "service_role full agent_allotments" on agent_allotments
  for all to service_role using (true) with check (true);
