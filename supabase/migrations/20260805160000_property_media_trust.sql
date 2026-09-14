-- Trust media: faceted property photography for guest confidence.
-- ERP uploads → Cloudinary public_id → published on public site.

-- ---------------------------------------------------------------------------
-- property_media
-- ---------------------------------------------------------------------------
create table if not exists public.property_media (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  scope text not null
    check (scope = any (array[
      'room_type'::text,
      'room_unit'::text,
      'property_area'::text,
      'menu_item'::text,
      'staff'::text
    ])),
  -- room_type / room_unit / menu_item / staff id; null only for property_area (facet is key)
  scope_id uuid,
  facet text not null,
  public_id text not null,
  resource_type text not null default 'image'
    check (resource_type in ('image', 'video')),
  poster_public_id text,
  duration_sec numeric,
  bytes bigint,
  width integer,
  height integer,
  format text,
  alt text not null default '',
  caption text,
  sort_order int not null default 0,
  is_primary boolean not null default false,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_media_scope_id_check check (
    (scope = 'property_area' and scope_id is null)
    or (scope <> 'property_area' and scope_id is not null)
  ),
  constraint property_media_facet_check check (
    facet = any (array[
      -- room / unit
      'overview', 'beds', 'linen', 'amenities', 'tv', 'toilet', 'wardrobe',
      'bathroom', 'view', 'other',
      -- property areas (facet doubles as area key)
      'lobby', 'reception', 'restaurant', 'cafe', 'bar', 'building',
      'facilities', 'exterior', 'parking',
      -- food
      'plated', 'counter', 'kitchen',
      -- staff
      'portrait', 'at_work'
    ])
  )
);

create index if not exists property_media_lookup_idx
  on public.property_media (property_id, scope, scope_id, facet, sort_order);

create index if not exists property_media_published_idx
  on public.property_media (property_id, is_published, scope)
  where is_published = true;

comment on table public.property_media is
  'Trust photography/video: room types, physical rooms, property areas, food, team. Public read only when published.';

alter table public.property_media enable row level security;

drop policy if exists "public read property_media" on public.property_media;
create policy "public read property_media" on public.property_media
  for select
  using (is_published = true);

drop policy if exists "service_role full property_media" on public.property_media;
create policy "service_role full property_media" on public.property_media
  for all to service_role
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- Meet the team (opt-in public staff presence)
-- ---------------------------------------------------------------------------
alter table public.staff_members
  add column if not exists show_on_team boolean not null default false,
  add column if not exists team_role_label text,
  add column if not exists team_sort_order int not null default 0;

comment on column public.staff_members.show_on_team is
  'When true, staff may appear on public Meet the team with work phone WhatsApp CTA.';
comment on column public.staff_members.team_role_label is
  'Guest-facing role label (e.g. Front desk). Falls back to role_label.';
comment on column public.staff_members.team_sort_order is
  'Order on public Meet the team section (lower first).';
