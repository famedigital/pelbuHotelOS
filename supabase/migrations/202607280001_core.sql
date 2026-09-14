-- Pelbu Suites core schema (draft) — apply via Supabase after project link
-- Multi-property ready; property 1 = Pelbu Olakha; template_id 1 = pelbu-flagship

create extension if not exists "pgcrypto";

create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  template_id int not null default 1,
  timezone text not null default 'Asia/Thimphu',
  created_at timestamptz not null default now()
);

create table if not exists seasons (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  kind text not null check (kind in ('peak','lean','off')),
  starts_on date not null,
  ends_on date not null
);

create table if not exists rate_tiers (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  code text not null check (code in ('public','friends','family','mutual_friends','agents','mou_agents')),
  unique (property_id, code)
);

create table if not exists room_types (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  code text not null,
  name text not null,
  inventory_kind text not null check (inventory_kind in ('sellable_guest','guide_comp','driver_comp','staff')),
  unique (property_id, code)
);

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  company_name text not null,
  market text not null check (market in ('bhutan','jaigaon','india')),
  license_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','demo')),
  rate_tier text not null default 'agents',
  credit_limit numeric(12,2) not null default 0,
  credit_used numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id),
  agent_id uuid references agents(id),
  source text not null check (source in ('owner','reservation','agent','client','ota')),
  check_in date not null,
  check_out date not null,
  guide_number text,
  status text not null default 'confirmed',
  payment_mode text check (payment_mode in ('prepaid','partial','on_credit','cash')),
  created_at timestamptz not null default now()
);

create table if not exists booking_guests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  full_name text not null,
  nationality text,
  passport_or_cid text,
  sdf_ref text,
  sdf_doc_url text
);

create table if not exists booking_drivers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  full_name text,
  phone text,
  vehicle_no text,
  license_no text
);

-- Seed Pelbu
insert into properties (slug, name, template_id)
values ('pelbu-suites-olakha', 'Pelbu Suites', 1)
on conflict (slug) do nothing;
