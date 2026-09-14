-- Map live Pelbu room type codes (dd/ds/dt/d&g) onto room interior photography
-- (`pelbu/rooms/*`). Avoid seven-suites official-img gallery IDs — those are
-- bar/F&B/people shots, not room categories.

update public.room_types rt
set
  image_public_id = v.image_public_id,
  blurb = coalesce(nullif(trim(rt.blurb), ''), v.blurb)
from (
  values
    (
      'dd',
      'pelbu/rooms/superior',
      'Quiet double room with lounge seating and soft mountain-day light.'
    ),
    (
      'ds',
      'pelbu/rooms/suite-alt',
      'Spacious suite with living seating, balcony light, and Bhutanese accents.'
    ),
    (
      'dt',
      'pelbu/rooms/twin',
      'Twin-ready guest room for friends or colleagues traveling together.'
    ),
    (
      'd&g',
      'pelbu/rooms/superior-living',
      'Complimentary driver and guide beds for agent groups.'
    )
) as v(code, image_public_id, blurb)
where rt.property_id = (
  select id from public.properties where slug = 'pelbu-suites-olakha'
)
  and rt.code = v.code
  and (rt.image_public_id is null or rt.image_public_id = ''
    or rt.image_public_id like 'pelbu/seven-suites/official-%');
