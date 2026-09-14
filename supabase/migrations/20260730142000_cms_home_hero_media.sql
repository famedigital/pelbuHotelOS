-- Move the homepage hero reel into the CMS so the desk can reorder or swap
-- slides from Front Public > Media library. The seeded rows mirror the
-- curated 5K photography that was previously hardcoded in web/src/lib/brand.ts.
-- Alt text carries the on-slide caption before the em dash.

with prop as (
  select id from public.properties where slug = 'pelbu-suites-olakha'
)
update public.cms_media m
   set kind = 'gallery',
       sort_order = 200 + m.sort_order
  from prop
 where m.property_id = prop.id
   and m.page_slug = 'home'
   and m.kind = 'hero';

with prop as (
  select id from public.properties where slug = 'pelbu-suites-olakha'
), slides(public_id, alt, sort_order) as (
  values
    ('pelbu/seven-suites/official-img6149', 'Deluxe suite — mountain view', 10),
    ('pelbu/seven-suites/official-img6194', 'Superior room — city side', 20),
    ('pelbu/seven-suites/official-img6256', 'Twin room — twin beds', 30),
    ('pelbu/seven-suites/official-dsc08154', 'Suite — lounge and rug', 40),
    ('pelbu/cafe/morning-pastry', 'Cafe — morning pastry', 50),
    ('pelbu/restaurant/signature-plate', 'Restaurant — signature plate', 60),
    ('pelbu/spa/steam', 'Spa — steam room', 70)
)
insert into public.cms_media (property_id, page_slug, public_id, alt, kind, sort_order, is_published)
select prop.id, 'home', slides.public_id, slides.alt, 'hero', slides.sort_order, true
  from prop
 cross join slides
 where not exists (
   select 1
     from public.cms_media existing
    where existing.property_id = prop.id
      and existing.page_slug = 'home'
      and existing.public_id = slides.public_id
      and existing.kind = 'hero'
 );
