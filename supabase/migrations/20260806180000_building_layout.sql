-- Building layout profile + amenity map spaces (non-bookable).
-- Room inventory stays on room_units; lobby/F&B/attic are visual massing only.

create table if not exists public.property_building_layouts (
  property_id uuid primary key references public.properties (id) on delete cascade,
  template text not null default 'dual_corridor'
    check (template = any (array['dual_corridor'::text])),
  floors jsonb not null default '[]'::jsonb,
  params jsonb not null default '{}'::jsonb,
  corridor_axis text not null default 'ew'
    check (corridor_axis = any (array['ew'::text, 'ns'::text])),
  setup_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.property_building_layouts is
  'One building massing profile per property. 2D plan is canonical; 3D extrudes the same coords.';
comment on column public.property_building_layouts.floors is
  'Ordered floors: [{ key, label, kind: public|guest|attic|service }].';
comment on column public.property_building_layouts.params is
  'Corridor width %, wing depth %, room slot size, etc.';
comment on column public.property_building_layouts.corridor_axis is
  'ew = rooms north/south of long corridor; ns = rooms east/west of long corridor.';

create table if not exists public.building_spaces (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  floor_key text not null,
  kind text not null
    check (
      kind = any (
        array[
          'lobby'::text,
          'restaurant'::text,
          'cafe'::text,
          'bar'::text,
          'reception'::text,
          'spa'::text,
          'gym'::text,
          'meeting'::text,
          'stair'::text,
          'lift'::text,
          'service'::text,
          'attic'::text,
          'other'::text
        ]
      )
    ),
  label text not null,
  pos_x numeric(6, 2) not null default 50
    check (pos_x >= 0 and pos_x <= 100),
  pos_y numeric(6, 2) not null default 50
    check (pos_y >= 0 and pos_y <= 100),
  width_pct numeric(6, 2) not null default 20
    check (width_pct > 0 and width_pct <= 100),
  depth_pct numeric(6, 2) not null default 20
    check (depth_pct > 0 and depth_pct <= 100),
  facade_side text
    check (
      facade_side is null
      or facade_side = any (
        array[
          'north'::text,
          'south'::text,
          'east'::text,
          'west'::text,
          'courtyard'::text,
          'internal'::text
        ]
      )
    ),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists building_spaces_property_floor_idx
  on public.building_spaces (property_id, floor_key, sort_order);

comment on table public.building_spaces is
  'Non-bookable map nodes (lobby, F&B, stairs, attic). Not inventory.';

alter table public.property_building_layouts enable row level security;
alter table public.building_spaces enable row level security;

drop policy if exists "service_role full property_building_layouts"
  on public.property_building_layouts;
create policy "service_role full property_building_layouts"
  on public.property_building_layouts
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service_role full building_spaces"
  on public.building_spaces;
create policy "service_role full building_spaces"
  on public.building_spaces
  for all
  to service_role
  using (true)
  with check (true);
