-- Menu item images + room_type image refs for public site

alter table menu_items
  add column if not exists image_public_id text;

alter table room_types
  add column if not exists image_public_id text,
  add column if not exists blurb text;

-- Map generated dish public_ids
update menu_items m
set image_public_id = v.image_public_id
from (values
  ('restaurant','Red Rice & Ema Datshi','pelbu/menu/restaurant-red-rice-ema-datshi'),
  ('restaurant','Paratha Platter','pelbu/menu/restaurant-paratha-platter'),
  ('restaurant','Chicken Thukpa','pelbu/menu/restaurant-chicken-thukpa'),
  ('restaurant','Shakam Ema Datshi','pelbu/menu/restaurant-shakam-ema-datshi'),
  ('restaurant','Butter Chicken & Naan','pelbu/menu/restaurant-butter-chicken-naan'),
  ('restaurant','River Trout','pelbu/menu/restaurant-river-trout'),
  ('restaurant','Mutton Curry Thali','pelbu/menu/restaurant-mutton-curry-thali'),
  ('restaurant','Paneer Lababdar','pelbu/menu/restaurant-paneer-lababdar'),
  ('cafe','Suja & Khabzay','pelbu/menu/cafe-suja-khabzay'),
  ('cafe','Himalayan Oats Bowl','pelbu/menu/cafe-himalayan-oats-bowl'),
  ('cafe','Egg & Cheese Paratha','pelbu/menu/cafe-egg-cheese-paratha'),
  ('cafe','Thukpa Cup','pelbu/menu/cafe-thukpa-cup'),
  ('cafe','Chicken Momos (6)','pelbu/menu/cafe-chicken-momos'),
  ('cafe','Olakha Club Sandwich','pelbu/menu/cafe-olakha-club-sandwich'),
  ('cafe','Ema Datshi Rice Bowl','pelbu/menu/cafe-ema-datshi-rice-bowl'),
  ('cafe','Grilled Chicken Plate','pelbu/menu/cafe-grilled-chicken-plate'),
  ('pastry','Butter Croissant','pelbu/menu/pastry-butter-croissant'),
  ('pastry','Cardamom Bun','pelbu/menu/pastry-cardamom-bun'),
  ('pastry','Dark Chocolate Brownie','pelbu/menu/pastry-dark-chocolate-brownie'),
  ('pastry','Apple Crumble Slice','pelbu/menu/pastry-apple-crumble-slice'),
  ('bar','Suja Highball','pelbu/menu/bar-suja-highball'),
  ('bar','Himalayan G&T','pelbu/menu/bar-himalayan-gt'),
  ('bar','Olakha Old Fashioned','pelbu/menu/bar-olakha-old-fashioned'),
  ('bar','House Red / White','pelbu/menu/bar-house-wine'),
  ('bar','Draught Lager','pelbu/menu/bar-draught-lager'),
  ('bar','Fresh Lime Soda','pelbu/menu/bar-fresh-lime-soda')
) as v(outlet, name, image_public_id)
join properties p on p.slug = 'pelbu-suites-olakha'
where m.property_id = p.id
  and m.outlet = v.outlet
  and m.name = v.name;

-- Room category heroes (scraped/property photos)
update room_types rt
set
  image_public_id = v.image_public_id,
  blurb = v.blurb
from (values
  ('deluxe','pelbu/rooms/deluxe','Spacious suite with living seating, balcony light, and Bhutanese accents.'),
  ('superior','pelbu/rooms/superior','Quiet superior room with lounge chairs and soft mountain-day light.'),
  ('twin','pelbu/rooms/twin','Twin-ready guest room for friends or colleagues traveling together.'),
  ('guide','pelbu/rooms/suite-view','Complimentary guide bed — first-class inventory, ADR stays clean.'),
  ('driver','pelbu/rooms/superior-living','Complimentary driver bed arranged at check-in for agent groups.')
) as v(code, image_public_id, blurb)
join properties p on p.slug = 'pelbu-suites-olakha'
where rt.property_id = p.id and rt.code = v.code;

-- Refresh CMS galleries with real uploaded public_ids
delete from cms_media m
using properties p
where m.property_id = p.id
  and p.slug = 'pelbu-suites-olakha'
  and m.page_slug in ('rooms','cafe','restaurant','bar','dine','home');

insert into cms_media (property_id, page_slug, public_id, alt, kind, sort_order)
select p.id, v.page_slug, v.public_id, v.alt, v.kind, v.sort_order
from properties p
cross join (values
  ('home','pelbu/hotel/exterior','Pelbu Suites exterior','hero',10),
  ('home','pelbu/rooms/deluxe','Deluxe suite','gallery',20),
  ('home','pelbu/restaurant/dining-room','Restaurant dining room','gallery',30),
  ('home','pelbu/bar/evening-pour','Bar evening pours','gallery',40),
  ('rooms','pelbu/rooms/deluxe','Deluxe Suite','hero',10),
  ('rooms','pelbu/rooms/superior','Superior Room','gallery',20),
  ('rooms','pelbu/rooms/twin','Twin Room','gallery',30),
  ('rooms','pelbu/rooms/suite-view','Suite seating area','gallery',40),
  ('rooms','pelbu/rooms/deluxe-suite','Suite with rug and lounge','gallery',50),
  ('cafe','pelbu/cafe/morning-pastry','Cafe morning','hero',10),
  ('cafe','pelbu/menu/pastry-butter-croissant','Butter croissant','gallery',20),
  ('cafe','pelbu/menu/cafe-chicken-momos','Chicken momos','gallery',30),
  ('cafe','pelbu/menu/pastry-cardamom-bun','Cardamom bun','gallery',40),
  ('restaurant','pelbu/restaurant/dining-room','Restaurant with mountain view','hero',10),
  ('restaurant','pelbu/menu/restaurant-butter-chicken-naan','Butter chicken','gallery',20),
  ('restaurant','pelbu/menu/restaurant-river-trout','River trout','gallery',30),
  ('restaurant','pelbu/menu/restaurant-red-rice-ema-datshi','Ema datshi','gallery',40),
  ('bar','pelbu/bar/evening-pour','Cocktail line-up','hero',10),
  ('bar','pelbu/menu/bar-olakha-old-fashioned','Olakha Old Fashioned','gallery',20),
  ('bar','pelbu/menu/bar-himalayan-gt','Himalayan G&T','gallery',30),
  ('bar','pelbu/menu/bar-suja-highball','Suja Highball','gallery',40),
  ('dine','pelbu/restaurant/dining-room','Dining room','hero',10),
  ('dine','pelbu/cafe/morning-pastry','Cafe','gallery',20),
  ('dine','pelbu/bar/evening-pour','Bar','gallery',30),
  ('dine','pelbu/restaurant/signature-plate','Restaurant plate','gallery',40)
) as v(page_slug, public_id, alt, kind, sort_order)
where p.slug = 'pelbu-suites-olakha';
