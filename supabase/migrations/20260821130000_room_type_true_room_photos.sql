-- Correct live room type photos: use named room interiors, not gallery
-- “official-img*” shots (bar / dining / people).

update public.room_types rt
set image_public_id = v.image_public_id
from (
  values
    ('dd', 'pelbu/rooms/superior'),
    ('ds', 'pelbu/rooms/suite-alt'),
    ('dt', 'pelbu/rooms/twin'),
    ('d&g', 'pelbu/rooms/superior-living')
) as v(code, image_public_id)
where rt.property_id = (
  select id from public.properties where slug = 'pelbu-suites-olakha'
)
  and rt.code = v.code;
