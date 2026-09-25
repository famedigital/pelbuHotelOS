-- Residual apply after partial 20260925120000 (guides table may be absent).

-- Backfill hotel codes (slug/name only)
do $$
declare
  r record;
  dcode text;
  acode text;
  seq int;
  candidate text;
begin
  for r in
    select id, slug, name, hotel_code
    from public.properties
    where hotel_code is null
    order by created_at nulls last, slug
  loop
    dcode := 'THI';
    acode := '01';

    if r.slug ilike '%olakha%' or coalesce(r.name, '') ilike '%olakha%' then
      dcode := 'THI'; acode := '02';
    elsif r.slug ilike '%motithang%' or coalesce(r.name, '') ilike '%motithang%' then
      dcode := 'THI'; acode := '03';
    elsif r.slug ilike '%paro%' or coalesce(r.name, '') ilike '%paro%' then
      dcode := 'PAR'; acode := '01';
    elsif r.slug ilike '%punakha%' or coalesce(r.name, '') ilike '%punakha%' then
      dcode := 'PUN'; acode := '01';
    elsif r.slug ilike '%phuentsholing%' or r.slug ilike '%phuntsholing%'
       or coalesce(r.name, '') ilike '%phuentsholing%' then
      dcode := 'CHU'; acode := '01';
    elsif r.slug ilike '%bumthang%' or coalesce(r.name, '') ilike '%bumthang%' then
      dcode := 'BUM'; acode := '01';
    elsif r.slug = 'demo-hotel' then
      dcode := 'THI'; acode := '01';
    end if;

    select coalesce(max(substring(p.hotel_code from 6 for 3)::int), 0) + 1
      into seq
    from public.properties p
    where p.hotel_code is not null
      and p.hotel_code like dcode || acode || '%'
      and length(p.hotel_code) = 8;

    if seq is null or seq < 1 then seq := 1; end if;
    candidate := dcode || acode || lpad(seq::text, 3, '0');

    update public.properties
    set hotel_code = candidate,
        dzongkhag_code = dcode,
        area_code = acode
    where id = r.id;
  end loop;
end $$;

create table if not exists public.catalog_hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  star_rating int,
  category text,
  phone text,
  email text,
  image_url text,
  source text not null default 'touritinerary',
  created_at timestamptz not null default now(),
  unique (name, city)
);
alter table public.catalog_hotels enable row level security;

create table if not exists public.national_guides (
  id uuid primary key default gen_random_uuid(),
  license_no text not null,
  full_name text not null,
  phone text,
  city text,
  dzongkhag_code text references public.bhutan_dzongkhags(code),
  languages text[] not null default '{}',
  guide_type text,
  gender text,
  status text not null default 'pending_verification'
    check (status in ('pending_verification', 'verified', 'rejected', 'suspended')),
  cost_per_day_inr numeric(12,2),
  cost_per_day_usd numeric(12,2),
  source text,
  notes text,
  submitted_by_property_id uuid references public.properties(id) on delete set null,
  verified_at timestamptz,
  verified_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (license_no)
);
create index if not exists national_guides_status_name_idx
  on public.national_guides (status, full_name);
create index if not exists national_guides_license_lower_idx
  on public.national_guides (lower(trim(license_no)));
alter table public.national_guides enable row level security;

-- Only if property-scoped guides table exists
do $$
begin
  if to_regclass('public.guides') is not null then
    alter table public.guides
      add column if not exists national_guide_id uuid references public.national_guides(id) on delete set null;
    create index if not exists guides_national_guide_id_idx
      on public.guides (national_guide_id)
      where national_guide_id is not null;
  end if;
end $$;

create table if not exists public.platform_verification_queue (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('agent', 'guide')),
  entity_id uuid not null,
  property_id uuid references public.properties(id) on delete set null,
  submitted_by text,
  status text not null default 'open'
    check (status in ('open', 'verified', 'rejected', 'dismissed')),
  payload jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_email text
);
create index if not exists platform_verification_queue_open_idx
  on public.platform_verification_queue (status, created_at desc)
  where status = 'open';
alter table public.platform_verification_queue enable row level security;

do $$
begin
  if to_regclass('public.agent_property_links') is not null then
    alter table public.agent_property_links
      add column if not exists mou_signed_at timestamptz;
    if to_regclass('public.agent_documents') is not null then
      begin
        alter table public.agent_property_links
          add column if not exists mou_document_id uuid references public.agent_documents(id) on delete set null;
      exception when duplicate_object then
        null;
      end;
    else
      alter table public.agent_property_links
        add column if not exists mou_document_id uuid;
    end if;
    create index if not exists agent_property_links_mou_idx
      on public.agent_property_links (property_id, status)
      where mou_signed_at is not null;
  end if;
end $$;
