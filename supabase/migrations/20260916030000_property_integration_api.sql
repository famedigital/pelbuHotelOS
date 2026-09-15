-- Property Integration API: website + channel-manager keys, audit, idempotency.

create table if not exists public.property_api_keys (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,
  purpose text not null default 'both'
    check (purpose in ('website', 'channel_manager', 'both')),
  key_prefix text not null,
  key_hash text not null,
  scopes text[] not null default array['availability', 'ari', 'bookings']::text[],
  cors_origins text[] not null default array[]::text[],
  ip_allowlist text[] not null default array[]::text[],
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_by_staff_id uuid references public.staff_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_api_keys_prefix_uidx unique (key_prefix),
  constraint property_api_keys_scopes_check check (
    scopes <@ array['availability', 'ari', 'bookings']::text[]
    and cardinality(scopes) > 0
  )
);

create index if not exists property_api_keys_property_active_idx
  on public.property_api_keys (property_id)
  where revoked_at is null;

comment on table public.property_api_keys is
  'Hashed API keys for website gadgets and channel managers (property-scoped).';

create table if not exists public.website_api_idempotency (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid not null references public.property_api_keys(id) on delete cascade,
  idempotency_key text not null,
  request_hash text not null,
  response_json jsonb not null,
  booking_id uuid references public.bookings(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint website_api_idempotency_uidx unique (api_key_id, idempotency_key)
);

create index if not exists website_api_idempotency_created_idx
  on public.website_api_idempotency (created_at);

create table if not exists public.api_request_audit (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid references public.property_api_keys(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  route text not null,
  method text not null,
  status int not null,
  ip text,
  request_id text not null,
  latency_ms int,
  created_at timestamptz not null default now()
);

create index if not exists api_request_audit_property_created_idx
  on public.api_request_audit (property_id, created_at desc);

create index if not exists api_request_audit_key_created_idx
  on public.api_request_audit (api_key_id, created_at desc);

alter table public.bookings
  add column if not exists api_lookup_token_hash text;

comment on column public.bookings.api_lookup_token_hash is
  'HMAC/sha hash of one-time Integration API lookup token; never store plaintext.';

create index if not exists bookings_api_lookup_token_hash_idx
  on public.bookings (api_lookup_token_hash)
  where api_lookup_token_hash is not null;
