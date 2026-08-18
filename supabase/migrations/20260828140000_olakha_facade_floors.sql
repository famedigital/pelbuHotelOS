-- Olakha facade 3D: G + 1st public floors, steam spaces, spa/meeting media facets.

alter table public.building_spaces
  drop constraint if exists building_spaces_kind_check;

alter table public.building_spaces
  add constraint building_spaces_kind_check check (
    kind = any (
      array[
        'lobby'::text,
        'restaurant'::text,
        'cafe'::text,
        'bar'::text,
        'reception'::text,
        'spa'::text,
        'steam'::text,
        'gym'::text,
        'meeting'::text,
        'stair'::text,
        'lift'::text,
        'service'::text,
        'attic'::text,
        'other'::text
      ]
    )
  );

alter table public.property_media
  drop constraint if exists property_media_facet_check;

alter table public.property_media
  add constraint property_media_facet_check check (
    facet = any (array[
      'overview', 'beds', 'linen', 'amenities', 'tv', 'toilet', 'wardrobe',
      'bathroom', 'view', 'other',
      'lobby', 'reception', 'restaurant', 'cafe', 'bar', 'building',
      'facilities', 'exterior', 'parking', 'nearby',
      'spa', 'steam', 'meeting',
      'plated', 'counter', 'kitchen',
      'portrait', 'at_work'
    ])
  );

update public.property_building_layouts l
set
  floors = '[
    {"key":"G","label":"Ground","kind":"public"},
    {"key":"1","label":"First","kind":"public"},
    {"key":"2","label":"Floor 2","kind":"guest"},
    {"key":"3","label":"Floor 3","kind":"guest"},
    {"key":"4","label":"Floor 4","kind":"guest"},
    {"key":"5","label":"Floor 5","kind":"guest"}
  ]'::jsonb,
  corridor_axis = 'ns',
  setup_completed_at = coalesce(l.setup_completed_at, now()),
  updated_at = now()
from public.properties p
where l.property_id = p.id
  and p.slug = 'pelbu-suites-olakha';

delete from public.building_spaces bs
using public.properties p
where bs.property_id = p.id
  and p.slug = 'pelbu-suites-olakha';

insert into public.building_spaces (
  property_id, floor_key, kind, label,
  pos_x, pos_y, width_pct, depth_pct, facade_side, sort_order
)
select p.id, v.floor_key, v.kind, v.label,
  v.pos_x, v.pos_y, v.width_pct, v.depth_pct, v.facade_side, v.sort_order
from public.properties p
cross join (
  values
    -- Ground: lobby, bistro, spa, steam + cores
    ('G', 'stair', 'Stairs', 50.00, 12.00, 8.00, 14.00, 'internal', 0),
    ('G', 'lift', 'Lift', 50.00, 88.00, 8.00, 14.00, 'internal', 1),
    ('G', 'lobby', 'Lobby', 29.00, 22.00, 36.00, 24.00, 'west', 2),
    ('G', 'cafe', 'Bistro', 71.00, 22.00, 24.00, 20.00, 'east', 3),
    ('G', 'spa', 'Spa', 29.00, 58.00, 28.00, 20.00, 'west', 4),
    ('G', 'steam', 'Steam', 71.00, 58.00, 24.00, 20.00, 'east', 5),
    -- First: meeting + restaurant
    ('1', 'stair', 'Stairs', 50.00, 12.00, 8.00, 14.00, 'internal', 10),
    ('1', 'lift', 'Lift', 50.00, 88.00, 8.00, 14.00, 'internal', 11),
    ('1', 'meeting', 'Board meeting', 29.00, 40.00, 28.00, 22.00, 'west', 12),
    ('1', 'restaurant', 'Restaurant', 71.00, 40.00, 36.00, 26.00, 'east', 13),
    -- Guest cores
    ('2', 'stair', 'Stairs', 50.00, 12.00, 8.00, 14.00, 'internal', 20),
    ('2', 'lift', 'Lift', 50.00, 88.00, 8.00, 14.00, 'internal', 21),
    ('3', 'stair', 'Stairs', 50.00, 12.00, 8.00, 14.00, 'internal', 30),
    ('3', 'lift', 'Lift', 50.00, 88.00, 8.00, 14.00, 'internal', 31),
    ('4', 'stair', 'Stairs', 50.00, 12.00, 8.00, 14.00, 'internal', 40),
    ('4', 'lift', 'Lift', 50.00, 88.00, 8.00, 14.00, 'internal', 41),
    ('5', 'stair', 'Stairs', 50.00, 12.00, 8.00, 14.00, 'internal', 50),
    ('5', 'lift', 'Lift', 50.00, 88.00, 8.00, 14.00, 'internal', 51)
) as v(floor_key, kind, label, pos_x, pos_y, width_pct, depth_pct, facade_side, sort_order)
where p.slug = 'pelbu-suites-olakha';

insert into public.property_media (
  property_id, scope, scope_id, facet, public_id, resource_type,
  alt, caption, sort_order, is_primary, is_published
)
select
  p.id, 'property_area', null, v.facet, v.public_id, 'image',
  v.alt, v.caption, v.sort_order, v.is_primary, true
from public.properties p
cross join (
  values
    ('spa', 'pelbu/spa/jacuzzi', 'Spa at Pelbu Suites', 'Spa', 10, true),
    ('steam', 'pelbu/spa/steam', 'Steam room at Pelbu Suites', 'Steam', 10, true)
) as v(facet, public_id, alt, caption, sort_order, is_primary)
where p.slug = 'pelbu-suites-olakha'
  and not exists (
    select 1 from public.property_media pm
    where pm.property_id = p.id
      and pm.scope = 'property_area'
      and pm.facet = v.facet
      and pm.public_id = v.public_id
  );
