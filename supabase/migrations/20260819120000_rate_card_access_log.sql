-- Audit log for soft-gated travel-partner rate card views + tighten room_rates RLS.
-- Public site only ever serves public tier without a validated gate cookie.
-- Agent/MoU tiers must not be readable via anon key.

-- ---------------------------------------------------------------------------
-- rate_card_access_log — who requested trade rates
-- ---------------------------------------------------------------------------
create table if not exists public.rate_card_access_log (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  full_name text,
  email text not null,
  whatsapp text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists rate_card_access_log_property_created_idx
  on public.rate_card_access_log (property_id, created_at desc);

create index if not exists rate_card_access_log_email_idx
  on public.rate_card_access_log (property_id, lower(email));

comment on table public.rate_card_access_log is
  'Soft-gate audits: email + WhatsApp required before public site shows agent/MOU room rates.';

alter table public.rate_card_access_log enable row level security;

drop policy if exists "service_role full rate_card_access_log" on public.rate_card_access_log;
create policy "service_role full rate_card_access_log" on public.rate_card_access_log
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- room_rates: anon/authenticated only see public (rack) tier
-- service_role bypasses RLS (admin client used by desk + authenticated ops)
-- ---------------------------------------------------------------------------
drop policy if exists "public read room_rates" on public.room_rates;

drop policy if exists "anon_auth_read_public_room_rates" on public.room_rates;
create policy "anon_auth_read_public_room_rates" on public.room_rates
  for select to anon, authenticated
  using (rate_tier = 'public');
