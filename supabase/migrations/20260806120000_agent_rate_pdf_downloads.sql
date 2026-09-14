-- Agent rate card PDF/HTML downloads: leads + download counts (public site gate).
-- Access only via service_role (Next admin client).

create table if not exists public.agent_rate_pdf_leads (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  email text not null,
  phone text not null,
  full_name text,
  download_count integer not null default 0
    check (download_count >= 0),
  first_download_at timestamptz not null default now(),
  last_download_at timestamptz not null default now(),
  last_user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_rate_pdf_leads_email_phone_uq
    unique (property_id, email, phone)
);

create index if not exists agent_rate_pdf_leads_property_last_idx
  on public.agent_rate_pdf_leads (property_id, last_download_at desc);

create index if not exists agent_rate_pdf_leads_email_idx
  on public.agent_rate_pdf_leads (property_id, lower(email));

comment on table public.agent_rate_pdf_leads is
  'Travel-agent rate card download registry: email + phone required; download_count is per lead.';

create table if not exists public.agent_rate_pdf_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  lead_id uuid references public.agent_rate_pdf_leads (id) on delete set null,
  email text not null,
  phone text not null,
  full_name text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists agent_rate_pdf_events_property_created_idx
  on public.agent_rate_pdf_events (property_id, created_at desc);

create index if not exists agent_rate_pdf_events_lead_idx
  on public.agent_rate_pdf_events (lead_id, created_at desc);

comment on table public.agent_rate_pdf_events is
  'One row per agent rate-card download (audit trail).';

alter table public.agent_rate_pdf_leads enable row level security;
alter table public.agent_rate_pdf_events enable row level security;

drop policy if exists "service_role full agent_rate_pdf_leads"
  on public.agent_rate_pdf_leads;
create policy "service_role full agent_rate_pdf_leads"
  on public.agent_rate_pdf_leads
  for all to service_role using (true) with check (true);

drop policy if exists "service_role full agent_rate_pdf_events"
  on public.agent_rate_pdf_events;
create policy "service_role full agent_rate_pdf_events"
  on public.agent_rate_pdf_events
  for all to service_role using (true) with check (true);
