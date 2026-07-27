-- CMS pages + Cloudinary media refs + restaurant/bar menu seed (flagship template_id=1)

create table if not exists cms_pages (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  slug text not null,
  eyebrow text not null,
  title text not null,
  body text not null,
  hours_note text,
  primary_cta_href text,
  primary_cta_label text,
  secondary_cta_href text,
  secondary_cta_label text,
  meta_description text,
  is_published boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (property_id, slug)
);

create table if not exists cms_media (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  page_slug text not null,
  public_id text not null,
  alt text not null default '',
  kind text not null default 'gallery'
    check (kind = any (array['hero'::text, 'gallery'::text, 'thumb'::text])),
  sort_order int not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists cms_media_property_page_idx
  on cms_media (property_id, page_slug, sort_order);

alter table cms_pages enable row level security;
alter table cms_media enable row level security;

drop policy if exists "public read cms_pages" on cms_pages;
create policy "public read cms_pages" on cms_pages
  for select using (is_published = true);

drop policy if exists "public read cms_media" on cms_media;
create policy "public read cms_media" on cms_media
  for select using (is_published = true);

-- Flagship page copy
insert into cms_pages (
  property_id, slug, eyebrow, title, body, hours_note,
  primary_cta_href, primary_cta_label, secondary_cta_href, secondary_cta_label,
  meta_description
)
select
  p.id,
  v.slug,
  v.eyebrow,
  v.title,
  v.body,
  v.hours_note,
  v.primary_cta_href,
  v.primary_cta_label,
  v.secondary_cta_href,
  v.secondary_cta_label,
  v.meta_description
from properties p
cross join (values
  (
    'restaurant',
    'Restaurant',
    'Indian · Bhutanese · Multicuisine',
    'Breakfast, lunch, and dinner with TACT — taste, aroma, consistency, and time. Signature plates you will not find on every Thimphu corner.',
    'Lunch and dinner service; breakfast for in-house guests and walk-ins when posted.',
    '/order',
    'Order delivery',
    '/book',
    'Reserve a table',
    'Indian, Bhutanese, and multicuisine restaurant at Pelbu Suites, Olakha Thimphu.'
  ),
  (
    'bar',
    'Bar',
    'Weekend pours.',
    'A calm bar for guests and locals — weekend specials, classic pours, and space to unwind after the road to Thimphu.',
    'Weekend evenings; weekday hours posted at the desk.',
    '/dine',
    'All dining',
    '/book',
    'Reserve',
    'Weekend bar menu at Pelbu Suites, Thimphu.'
  ),
  (
    'dine',
    'Dine',
    'Cafe, restaurant, and bar.',
    'Indian, Bhutanese, and multicuisine in the restaurant — pastry and cafe from early morning — weekend bar menu for evenings.',
    'Cafe opens 6:30 summer / 7:30 winter. Restaurant and bar hours vary by season.',
    '/restaurant',
    'Restaurant',
    '/cafe',
    'Cafe & pastry',
    'Cafe, pastry, restaurant, and bar at Pelbu Suites Thimphu.'
  ),
  (
    'cafe',
    'Cafe & Pastry',
    'Morning light, warm pastry.',
    'Opens 6:30 AM in summer and 7:30 AM in winter. Breakfast through dinner — order for pickup or taxi delivery across Thimphu.',
    'Summer 06:30 · Winter 07:30',
    '/order',
    'Order now',
    '/dine',
    'All dining',
    'Cafe and pastry at Pelbu Suites — opens 6:30 summer / 7:30 winter. Order for taxi delivery in Thimphu.'
  ),
  (
    'rooms',
    'Rooms',
    'Rest in Olakha.',
    'Quiet suites for guests traveling Bhutan. Book direct for the public rate, or ask your agent to reserve with guide and driver beds included.',
    null,
    '/book',
    'Check availability',
    '/agents',
    'Agent booking',
    'Book rooms at Pelbu Suites, Olakha Thimphu — guest suites plus complimentary guide and driver beds.'
  )
) as v(
  slug, eyebrow, title, body, hours_note,
  primary_cta_href, primary_cta_label, secondary_cta_href, secondary_cta_label,
  meta_description
)
where p.slug = 'pelbu-suites-olakha'
and not exists (
  select 1 from cms_pages c where c.property_id = p.id and c.slug = v.slug
);

-- Gallery public_ids (Cloudinary folder convention under pelbu/)
insert into cms_media (property_id, page_slug, public_id, alt, kind, sort_order)
select p.id, v.page_slug, v.public_id, v.alt, v.kind, v.sort_order
from properties p
cross join (values
  ('restaurant', 'pelbu/brand/logo-primary', 'Pelbu Suites mark', 'thumb', 10),
  ('restaurant', 'pelbu/restaurant/dining-room', 'Restaurant dining room', 'gallery', 20),
  ('restaurant', 'pelbu/restaurant/signature-plate', 'Signature plate', 'gallery', 30),
  ('bar', 'pelbu/brand/logo-primary', 'Pelbu Suites mark', 'thumb', 10),
  ('bar', 'pelbu/bar/evening-pour', 'Evening pour at the bar', 'gallery', 20),
  ('dine', 'pelbu/brand/logo-primary', 'Pelbu Suites mark', 'thumb', 10),
  ('dine', 'pelbu/cafe/morning-pastry', 'Morning pastry', 'gallery', 20),
  ('dine', 'pelbu/restaurant/dining-room', 'Restaurant dining', 'gallery', 30),
  ('cafe', 'pelbu/brand/logo-primary', 'Pelbu Suites mark', 'thumb', 10),
  ('cafe', 'pelbu/cafe/morning-pastry', 'Cafe pastry counter', 'gallery', 20),
  ('rooms', 'pelbu/brand/logo-primary', 'Pelbu Suites mark', 'thumb', 10),
  ('rooms', 'pelbu/rooms/suite-view', 'Guest suite', 'gallery', 20)
) as v(page_slug, public_id, alt, kind, sort_order)
where p.slug = 'pelbu-suites-olakha'
and not exists (
  select 1 from cms_media m
  where m.property_id = p.id and m.page_slug = v.page_slug and m.public_id = v.public_id
);

-- Restaurant + bar menus
insert into menu_items (property_id, outlet, category, name, description, price_btn, gst_applicable, sort_order)
select p.id, v.outlet, v.category, v.name, v.description, v.price_btn, v.gst_applicable, v.sort_order
from properties p
cross join (values
  ('restaurant','Breakfast','Red Rice & Ema Datshi','Classic chili cheese with red rice',450,true,10),
  ('restaurant','Breakfast','Paratha Platter','Two parathas, achar, curd',380,true,20),
  ('restaurant','Lunch','Chicken Thukpa','Hand-pulled noodles, clear broth',420,true,30),
  ('restaurant','Lunch','Shakam Ema Datshi','Dried beef, chili, cheese',520,true,40),
  ('restaurant','Lunch','Butter Chicken & Naan','Mild gravy, tandoor naan',580,true,50),
  ('restaurant','Dinner','River Trout','Seasonal herbs, lemon butter',720,true,60),
  ('restaurant','Dinner','Mutton Curry Thali','Rice, dal, salad, pickle',650,true,70),
  ('restaurant','Dinner','Paneer Lababdar','Creamy tomato, soft paneer',480,true,80),
  ('bar','Weekend','Suja Highball','Butter tea twist, soda',280,true,10),
  ('bar','Weekend','Himalayan G&T','Local botanicals, tonic',350,true,20),
  ('bar','Weekend','Olakha Old Fashioned','Whisky, demerara, bitters',420,true,30),
  ('bar','Classics','House Red / White','Glass pour',250,true,40),
  ('bar','Classics','Draught Lager','Chilled pint',220,true,50),
  ('bar','Classics','Fresh Lime Soda','Sweet, salt, or mixed',120,true,60)
) as v(outlet, category, name, description, price_btn, gst_applicable, sort_order)
where p.slug = 'pelbu-suites-olakha'
and not exists (
  select 1 from menu_items m where m.property_id = p.id and m.name = v.name and m.outlet = v.outlet
);
