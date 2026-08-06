-- Editable marketing rate sheets (public / agent / freeform print cards) for ERP staff.
-- document jsonb = block canvas (heading, text, banner, table, note, cards, free_html).

create table if not exists public.marketing_rate_sheets (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  slug text not null,
  title text not null,
  audience text not null default 'public'
    check (audience in ('public', 'agents', 'partners', 'custom')),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  season_label text,
  document jsonb not null default '{"version":1,"blocks":[]}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint marketing_rate_sheets_property_slug_uidx unique (property_id, slug)
);

create index if not exists marketing_rate_sheets_property_status_idx
  on public.marketing_rate_sheets (property_id, status, updated_at desc);

comment on table public.marketing_rate_sheets is
  'Staff-editable rate cards / freeform design sheets under ERP Marketing.';

comment on column public.marketing_rate_sheets.document is
  'Block document: { version, meta?, blocks: RateSheetBlock[] }.';

alter table public.marketing_rate_sheets enable row level security;

drop policy if exists "service_role full marketing_rate_sheets"
  on public.marketing_rate_sheets;
create policy "service_role full marketing_rate_sheets"
  on public.marketing_rate_sheets
  for all to service_role using (true) with check (true);
