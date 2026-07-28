-- P6: Channex channel foundation — mappings, ARI outbox, inbound revisions
-- Live push/pull needs CHANNEXT_* env; queue is the source of truth until certified.

create table if not exists channel_connections (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  provider text not null default 'channex'
    check (provider = any (array['channex'::text])),
  external_property_id text,
  status text not null default 'draft'
    check (status = any (array[
      'draft'::text,
      'mapping'::text,
      'staging'::text,
      'live'::text,
      'paused'::text
    ])),
  api_base_url text not null default 'https://channex.io/api/v1',
  notes text,
  last_ari_push_at timestamptz,
  last_booking_pull_at timestamptz,
  created_at timestamptz not null default now(),
  unique (property_id, provider)
);

alter table channel_connections enable row level security;

drop policy if exists "service_role full channel_connections" on channel_connections;
create policy "service_role full channel_connections" on channel_connections
  for all to service_role using (true) with check (true);

create table if not exists channel_room_maps (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references channel_connections(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  room_type_id uuid not null references room_types(id) on delete cascade,
  external_room_type_id text not null,
  external_rate_plan_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (connection_id, room_type_id),
  unique (connection_id, external_room_type_id)
);

create index if not exists channel_room_maps_property_idx
  on channel_room_maps (property_id, is_active);

alter table channel_room_maps enable row level security;

drop policy if exists "service_role full channel_room_maps" on channel_room_maps;
create policy "service_role full channel_room_maps" on channel_room_maps
  for all to service_role using (true) with check (true);

-- Outbox: batch flush to Channex availability / restrictions endpoints
create table if not exists ari_queue (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  connection_id uuid references channel_connections(id) on delete set null,
  kind text not null
    check (kind = any (array[
      'availability'::text,
      'restrictions'::text,
      'full_sync'::text
    ])),
  payload jsonb not null,
  status text not null default 'pending'
    check (status = any (array[
      'pending'::text,
      'sending'::text,
      'sent'::text,
      'failed'::text,
      'cancelled'::text
    ])),
  attempts int not null default 0,
  last_error text,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ari_queue_pending_idx
  on ari_queue (status, scheduled_for)
  where status = 'pending';

create index if not exists ari_queue_property_idx
  on ari_queue (property_id, created_at desc);

alter table ari_queue enable row level security;

drop policy if exists "service_role full ari_queue" on ari_queue;
create policy "service_role full ari_queue" on ari_queue
  for all to service_role using (true) with check (true);

-- Inbound booking revisions from Channex feed (ack after local booking created)
create table if not exists channel_booking_revisions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  connection_id uuid references channel_connections(id) on delete set null,
  external_revision_id text not null,
  external_booking_id text,
  revision_type text not null default 'new'
    check (revision_type = any (array[
      'new'::text,
      'modify'::text,
      'cancel'::text
    ])),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'received'
    check (status = any (array[
      'received'::text,
      'imported'::text,
      'acked'::text,
      'failed'::text,
      'ignored'::text
    ])),
  booking_id uuid references bookings(id) on delete set null,
  error text,
  received_at timestamptz not null default now(),
  acked_at timestamptz,
  unique (property_id, external_revision_id)
);

create index if not exists channel_booking_revisions_status_idx
  on channel_booking_revisions (property_id, status, received_at desc);

alter table channel_booking_revisions enable row level security;

drop policy if exists "service_role full channel_booking_revisions" on channel_booking_revisions;
create policy "service_role full channel_booking_revisions" on channel_booking_revisions
  for all to service_role using (true) with check (true);

-- Seed draft Channex connection for Pelbu Olakha
insert into channel_connections (property_id, provider, status, notes)
select p.id, 'channex', 'draft',
  'Map room types + set CHANNEX_API_KEY before staging certification.'
from properties p
where p.slug = 'pelbu-suites-olakha'
on conflict (property_id, provider) do nothing;

-- Cancellation reason on bookings (P6 go-live gap)
alter table bookings
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text,
  add column if not exists channel_source text;
