-- Wave 3 FO: wake-up / timed in-house tasks + named rate plans foundation.
-- Does not alter room_rates matrix (season × tier stays source of truth for quotes).

create table if not exists inhouse_tasks (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  booking_id uuid references bookings (id) on delete cascade,
  due_at timestamptz not null,
  kind text not null default 'wake_up'
    check (kind = any (array['wake_up'::text, 'callback'::text, 'other'::text])),
  notes text,
  done_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists inhouse_tasks_property_due_idx
  on inhouse_tasks (property_id, due_at)
  where done_at is null;

create index if not exists inhouse_tasks_booking_idx
  on inhouse_tasks (booking_id)
  where booking_id is not null;

alter table inhouse_tasks enable row level security;

drop policy if exists inhouse_tasks_service_role on inhouse_tasks;
create policy inhouse_tasks_service_role
  on inhouse_tasks
  for all
  to service_role
  using (true)
  with check (true);

comment on table inhouse_tasks is
  'Desk wake-up calls and timed guest tasks for in-house stays.';

create table if not exists rate_plans (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  code text not null,
  name text not null,
  room_type_id uuid references room_types (id) on delete set null,
  season_kind text
    check (
      season_kind is null
      or season_kind = any (array['peak'::text, 'lean'::text, 'off'::text])
    ),
  rate_tier text
    check (
      rate_tier is null
      or rate_tier = any (array[
        'public'::text,
        'friends'::text,
        'family'::text,
        'mutual_friends'::text,
        'agents'::text,
        'mou_agents'::text
      ])
    ),
  base_amount_btn numeric(12, 2),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rate_plans_property_code_uidx unique (property_id, code)
);

create index if not exists rate_plans_property_active_idx
  on rate_plans (property_id, active);

alter table rate_plans enable row level security;

drop policy if exists rate_plans_service_role on rate_plans;
create policy rate_plans_service_role
  on rate_plans
  for all
  to service_role
  using (true)
  with check (true);

comment on table rate_plans is
  'Named rate plan labels for desk / channel mapping. room_rates remains the quote matrix.';
