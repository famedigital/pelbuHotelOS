-- Public gallery: nearby facet + seed Olakha building layout and existing photos.
-- Does not overwrite room_units positions/facades already set from the eZee chart.

-- ---------------------------------------------------------------------------
-- Allow nearby (Olakha street / surroundings) on property_media
-- ---------------------------------------------------------------------------
alter table public.property_media
  drop constraint if exists property_media_facet_check;

alter table public.property_media
  add constraint property_media_facet_check check (
    facet = any (array[
      'overview', 'beds', 'linen', 'amenities', 'tv', 'toilet', 'wardrobe',
      'bathroom', 'view', 'other',
      'lobby', 'reception', 'restaurant', 'cafe', 'bar', 'building',
      'facilities', 'exterior', 'parking', 'nearby',
      'plated', 'counter', 'kitchen',
      'portrait', 'at_work'
    ])
  );

-- ---------------------------------------------------------------------------
-- Building massing so public 3D is no longer hidden (setup_completed_at)
-- ---------------------------------------------------------------------------
insert into public.property_building_layouts (
  property_id,
  template,
  floors,
  params,
  corridor_axis,
  setup_completed_at,
  updated_at
)
select
  p.id,
  'dual_corridor',
  '[
    {"key":"G","label":"Ground","kind":"public"},
    {"key":"2","label":"Floor 2","kind":"guest"},
    {"key":"3","label":"Floor 3","kind":"guest"},
    {"key":"4","label":"Floor 4","kind":"guest"},
    {"key":"5","label":"Floor 5","kind":"guest"}
  ]'::jsonb,
  '{
    "corridorWidthPct": 14,
    "wingDepthPct": 28,
    "marginPct": 6,
    "maxRoomsPerWingSide": 12,
    "slabW": 340,
    "slabD": 210,
    "floorHeight": 56
  }'::jsonb,
  'ns',
  now(),
  now()
from public.properties p
where p.slug = 'pelbu-suites-olakha'
on conflict (property_id) do update
set
  floors = excluded.floors,
  params = excluded.params,
  corridor_axis = excluded.corridor_axis,
  setup_completed_at = coalesce(
    public.property_building_layouts.setup_completed_at,
    excluded.setup_completed_at
  ),
  updated_at = now();

-- Ground-floor amenities + cores on guest floors (skip if spaces already exist)
insert into public.building_spaces (
  property_id, floor_key, kind, label,
  pos_x, pos_y, width_pct, depth_pct, facade_side, sort_order
)
select p.id, v.floor_key, v.kind, v.label,
  v.pos_x, v.pos_y, v.width_pct, v.depth_pct, v.facade_side, v.sort_order
from public.properties p
cross join (
  values
    -- Ground (ns corridor: west = front, east = back)
    ('G', 'stair', 'Stairs', 50.00, 12.00, 8.00, 14.00, 'internal', 0),
    ('G', 'lift', 'Lift', 50.00, 88.00, 8.00, 14.00, 'internal', 1),
    ('G', 'lobby', 'Lobby', 29.00, 18.00, 36.00, 27.00, 'west', 2),
    ('G', 'reception', 'Reception', 71.00, 34.00, 22.00, 16.00, 'east', 3),
    ('G', 'restaurant', 'Restaurant', 29.00, 50.00, 36.00, 27.00, 'west', 4),
    ('G', 'cafe', 'Cafe', 71.00, 66.00, 22.00, 16.00, 'east', 5),
    ('G', 'bar', 'Bar', 29.00, 82.00, 22.00, 16.00, 'west', 6),
    ('2', 'stair', 'Stairs', 50.00, 12.00, 8.00, 14.00, 'internal', 10),
    ('2', 'lift', 'Lift', 50.00, 88.00, 8.00, 14.00, 'internal', 11),
    ('3', 'stair', 'Stairs', 50.00, 12.00, 8.00, 14.00, 'internal', 20),
    ('3', 'lift', 'Lift', 50.00, 88.00, 8.00, 14.00, 'internal', 21),
    ('4', 'stair', 'Stairs', 50.00, 12.00, 8.00, 14.00, 'internal', 30),
    ('4', 'lift', 'Lift', 50.00, 88.00, 8.00, 14.00, 'internal', 31),
    ('5', 'stair', 'Stairs', 50.00, 12.00, 8.00, 14.00, 'internal', 40),
    ('5', 'lift', 'Lift', 50.00, 88.00, 8.00, 14.00, 'internal', 41)
) as v(floor_key, kind, label, pos_x, pos_y, width_pct, depth_pct, facade_side, sort_order)
where p.slug = 'pelbu-suites-olakha'
  and not exists (
    select 1 from public.building_spaces bs where bs.property_id = p.id
  );

-- ---------------------------------------------------------------------------
-- Seed published trust photos from photography already on Cloudinary
-- ---------------------------------------------------------------------------
insert into public.property_media (
  property_id, scope, scope_id, facet, public_id, resource_type,
  alt, caption, sort_order, is_primary, is_published
)
select
  p.id,
  v.scope,
  case
    when v.scope = 'room_type' then rt.id
    else null
  end,
  v.facet,
  v.public_id,
  'image',
  v.alt,
  v.caption,
  v.sort_order,
  v.is_primary,
  true
from public.properties p
cross join (
  values
    -- King (dq)
    ('room_type', 'dq', 'overview', 'pelbu/rooms/deluxe-suite', 'King room at Pelbu Suites', 'Guest king room', 10, true),
    ('room_type', 'dq', 'overview', 'pelbu/rooms/deluxe', 'King room living space', null, 20, false),
    ('room_type', 'dq', 'overview', 'pelbu/seven-suites/official-img6149', 'King room interior', null, 30, false),
    ('room_type', 'dq', 'view', 'pelbu/seven-suites/zen-ead5e32521cf', 'King room with daylight', null, 40, false),
    -- Twin (dt)
    ('room_type', 'dt', 'overview', 'pelbu/rooms/twin', 'Deluxe twin room at Pelbu Suites', 'Twin beds', 10, true),
    ('room_type', 'dt', 'overview', 'pelbu/rooms/suite-alt', 'Deluxe twin room seating', null, 20, false),
    ('room_type', 'dt', 'overview', 'pelbu/seven-suites/official-img6256', 'Twin room interior', null, 30, false),
    ('room_type', 'dt', 'amenities', 'pelbu/seven-suites/official-img6254', 'Twin room details', null, 40, false),
    -- Suite (sr)
    ('room_type', 'sr', 'overview', 'pelbu/seven-suites/zen-55db5428029e', 'Pelbu Suite lounge', 'Suite Room', 10, true),
    ('room_type', 'sr', 'overview', 'pelbu/seven-suites/official-dsc08154', 'Suite lounge and rug', null, 20, false),
    ('room_type', 'sr', 'overview', 'pelbu/seven-suites/official-room', 'Suite seating area', null, 30, false),
    ('room_type', 'sr', 'amenities', 'pelbu/seven-suites/official-img6236', 'Suite guest seating', null, 40, false),
    -- Areas
    ('property_area', null, 'exterior', 'pelbu/hotel/exterior', 'Pelbu Suites hotel exterior, Olakha Thimphu', 'Building from the street', 10, true),
    ('property_area', null, 'exterior', 'pelbu/gallery/ext11', 'Pelbu Suites building exterior', null, 20, false),
    ('property_area', null, 'exterior', 'pelbu/home/cxuej0vfzf06hsqqtnqy', 'Pelbu Suites facade in Olakha', null, 30, false),
    ('property_area', null, 'exterior', 'pelbu/seven-suites/official-img19', 'Pelbu Suites hotel exterior', null, 40, false),
    ('property_area', null, 'nearby', 'pelbu/home/hmuenowpmowtkagbxxns', 'Pelbu Suites on the Olakha roadside, Thimphu', 'Olakha, Thimphu', 10, true),
    ('property_area', null, 'nearby', 'pelbu/gallery/ta2', 'Street approach to Pelbu Suites, Olakha', null, 20, false),
    ('property_area', null, 'restaurant', 'pelbu/restaurant/uuy1ycprinlbhm7lvkli', 'Pelbu Suites restaurant dining room', 'Restaurant', 10, true),
    ('property_area', null, 'restaurant', 'pelbu/restaurant/dining-room', 'Dining room at Pelbu Suites', null, 20, false),
    ('property_area', null, 'restaurant', 'pelbu/lifestyle/restaurant-dining-guests', 'Guests dining with valley views', null, 30, false),
    ('property_area', null, 'restaurant', 'pelbu/restaurant/signature-plate', 'Signature restaurant plate', null, 40, false),
    ('property_area', null, 'cafe', 'pelbu/cafe/v7d8ba1cszstrkfosyax', 'PELBU ZONE café lounge', 'Cafe', 10, true),
    ('property_area', null, 'cafe', 'pelbu/cafe/morning-pastry', 'Morning coffee and pastry', null, 20, false),
    ('property_area', null, 'bar', 'pelbu/bar/evening-pour', 'Bar evening pours at Pelbu Suites', 'Bar', 10, true),
    ('property_area', null, 'lobby', 'pelbu/seven-suites/official-img14', 'Hotel shared space at Pelbu Suites', 'Lobby and shared space', 20, false)
) as v(scope, room_code, facet, public_id, alt, caption, sort_order, is_primary)
left join public.room_types rt
  on rt.property_id = p.id
  and rt.code = v.room_code
  and v.scope = 'room_type'
where p.slug = 'pelbu-suites-olakha'
  and (v.scope <> 'room_type' or rt.id is not null)
  and not exists (
    select 1
    from public.property_media pm
    where pm.property_id = p.id
      and pm.public_id = v.public_id
      and pm.scope = v.scope
      and pm.facet = v.facet
      and (
        (v.scope = 'property_area' and pm.scope_id is null)
        or (v.scope = 'room_type' and pm.scope_id = rt.id)
      )
  );
