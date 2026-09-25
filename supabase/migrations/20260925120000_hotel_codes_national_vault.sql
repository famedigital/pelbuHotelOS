-- Hotel login codes (dzongkhag + area + sequence), national guide vault,
-- platform verification queue, MoU flag on agent↔property links.

-- ─── Location registry ───────────────────────────────────────────────────────

create table if not exists public.bhutan_dzongkhags (
  code text primary key check (code ~ '^[A-Z]{3}$'),
  name text not null unique,
  sort_order int not null default 0
);

create table if not exists public.bhutan_hotel_areas (
  id uuid primary key default gen_random_uuid(),
  dzongkhag_code text not null references public.bhutan_dzongkhags(code) on delete cascade,
  code text not null check (code ~ '^[0-9]{2}$'),
  name text not null,
  sort_order int not null default 0,
  unique (dzongkhag_code, code)
);

create index if not exists bhutan_hotel_areas_dzongkhag_idx
  on public.bhutan_hotel_areas (dzongkhag_code, sort_order);

insert into public.bhutan_dzongkhags (code, name, sort_order) values
  ('BUM', 'Bumthang', 1),
  ('CHU', 'Chhukha', 2),
  ('DAG', 'Dagana', 3),
  ('GAS', 'Gasa', 4),
  ('HAA', 'Haa', 5),
  ('LHU', 'Lhuntse', 6),
  ('MON', 'Mongar', 7),
  ('PAR', 'Paro', 8),
  ('PEM', 'Pemagatshel', 9),
  ('PUN', 'Punakha', 10),
  ('SAM', 'Samdrup Jongkhar', 11),
  ('SMT', 'Samtse', 12),
  ('SAR', 'Sarpang', 13),
  ('THI', 'Thimphu', 14),
  ('TRG', 'Trashigang', 15),
  ('TRY', 'Trashiyangtse', 16),
  ('TRO', 'Trongsa', 17),
  ('TSI', 'Tsirang', 18),
  ('WAN', 'Wangdue Phodrang', 19),
  ('ZHE', 'Zhemgang', 20)
on conflict (code) do nothing;

-- Area seeds: 01 = main town; Thimphu/Paro/Chhukha get named suburbs.
insert into public.bhutan_hotel_areas (dzongkhag_code, code, name, sort_order) values
  ('THI', '01', 'Main town', 1),
  ('THI', '02', 'Olakha', 2),
  ('THI', '03', 'Motithang', 3),
  ('THI', '04', 'Babesa', 4),
  ('THI', '05', 'Changzamtog', 5),
  ('THI', '06', 'Debsi', 6),
  ('THI', '07', 'Kabesa', 7),
  ('THI', '08', 'Hongtsho', 8),
  ('THI', '09', 'Serbithang', 9),
  ('THI', '10', 'Jungshina', 10),
  ('PAR', '01', 'Paro town', 1),
  ('PAR', '02', 'Airport / Shaba', 2),
  ('PAR', '03', 'Drugyel / Tsento', 3),
  ('PAR', '04', 'Hungrel', 4),
  ('PUN', '01', 'Punakha town', 1),
  ('PUN', '02', 'Khuruthang', 2),
  ('PUN', '03', 'Lobesa', 3),
  ('WAN', '01', 'Bajo / Wangdue', 1),
  ('WAN', '02', 'Phobjikha', 2),
  ('CHU', '01', 'Phuentsholing', 1),
  ('CHU', '02', 'Gedu', 2),
  ('CHU', '03', 'Chhukha town', 3),
  ('BUM', '01', 'Jakar / Chamkhar', 1),
  ('BUM', '02', 'Chumey', 2),
  ('HAA', '01', 'Haa town', 1),
  ('MON', '01', 'Mongar town', 1),
  ('TRO', '01', 'Trongsa town', 1),
  ('TRG', '01', 'Trashigang town', 1),
  ('SAR', '01', 'Gelephu', 1),
  ('SAR', '02', 'Sarpang town', 2),
  ('SMT', '01', 'Samtse town', 1),
  ('SAM', '01', 'Samdrup Jongkhar town', 1),
  ('PEM', '01', 'Pemagatshel town', 1),
  ('DAG', '01', 'Dagana town', 1),
  ('GAS', '01', 'Gasa town', 1),
  ('LHU', '01', 'Lhuntse town', 1),
  ('TRY', '01', 'Trashiyangtse town', 1),
  ('TSI', '01', 'Tsirang / Damphu', 1),
  ('ZHE', '01', 'Zhemgang town', 1)
on conflict (dzongkhag_code, code) do nothing;

-- ─── Property hotel codes ────────────────────────────────────────────────────

alter table public.properties
  add column if not exists hotel_code text,
  add column if not exists dzongkhag_code text references public.bhutan_dzongkhags(code),
  add column if not exists area_code text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'properties_hotel_code_format'
  ) then
    alter table public.properties
      add constraint properties_hotel_code_format
      check (hotel_code is null or hotel_code ~ '^[A-Z0-9]{6,8}$');
  end if;
end $$;

create unique index if not exists properties_hotel_code_uidx
  on public.properties (hotel_code)
  where hotel_code is not null;

comment on column public.properties.hotel_code is
  'Desk login code: AAA + LL + NNN (e.g. THI02001 = Thimphu Olakha signup 001). Distinct from slug.';

-- Backfill onboarded properties with location + sequential codes.
-- Match on slug/name only (properties.address is not present on all installs).
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
    if seq > 999 then
      raise exception 'hotel_code sequence overflow for %/%', dcode, acode;
    end if;

    candidate := dcode || acode || lpad(seq::text, 3, '0');

    update public.properties
    set hotel_code = candidate,
        dzongkhag_code = dcode,
        area_code = acode
    where id = r.id;
  end loop;
end $$;

-- ─── Catalog hotels (reference only — not tenants) ───────────────────────────

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

-- ─── National guides vault ───────────────────────────────────────────────────

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

-- Property overlay only when partners.guides exists on this install.
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

-- ─── Platform verification queue (Innora superadmin) ─────────────────────────

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

-- ─── MoU on agent ↔ hotel links (portal rates/inventory gate) ────────────────

do $$
begin
  if to_regclass('public.agent_property_links') is null then
    raise notice 'agent_property_links missing — skip MoU columns';
    return;
  end if;

  alter table public.agent_property_links
    add column if not exists mou_signed_at timestamptz;

  if to_regclass('public.agent_documents') is not null then
    begin
      alter table public.agent_property_links
        add column if not exists mou_document_id uuid references public.agent_documents(id) on delete set null;
    exception when others then
      alter table public.agent_property_links
        add column if not exists mou_document_id uuid;
    end;
  else
    alter table public.agent_property_links
      add column if not exists mou_document_id uuid;
  end if;

  create index if not exists agent_property_links_mou_idx
    on public.agent_property_links (property_id, status)
    where mou_signed_at is not null;

  comment on column public.agent_property_links.mou_signed_at is
    'When set, agent may view that hotel rates and inventory in the partner portal. Desk pickers still use agents status.';
end $$;
