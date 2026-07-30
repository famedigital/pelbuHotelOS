-- Seed merged About + Contact CMS page for the public /contact route.

insert into cms_pages (
  property_id,
  slug,
  eyebrow,
  title,
  body,
  primary_cta_href,
  primary_cta_label,
  secondary_cta_href,
  secondary_cta_label,
  meta_description,
  seo_title,
  canonical_path,
  summary,
  faq_json,
  author_name,
  source_note,
  last_verified_at,
  is_published
)
select
  p.id,
  'contact',
  'About & contact',
  'A practical hotel base in Olakha.',
  'Pelbu Suites brings rooms, cafe, restaurant, bar, spa, and meeting space under one roof in Olakha, Thimphu. We keep the theatre out of the stay — clear rates, live menus, and a desk that answers.',
  '/book',
  'Check rooms',
  '/dine',
  'See the menu',
  'About Pelbu Suites in Olakha, Thimphu — rooms, dining, spa, meeting, and how to reach the desk.',
  'About & Contact | Pelbu Suites Olakha',
  '/contact',
  'Rooms, food, recovery, and useful gathering space together in Olakha — with a desk you can reach.',
  '[]'::jsonb,
  'Pelbu Suites',
  'Merged About + Contact public page; NAP comes from properties.',
  now(),
  true
from properties p
where p.slug = 'pelbu-suites-olakha'
on conflict (property_id, slug) do update set
  eyebrow = excluded.eyebrow,
  title = excluded.title,
  body = excluded.body,
  primary_cta_href = excluded.primary_cta_href,
  primary_cta_label = excluded.primary_cta_label,
  secondary_cta_href = excluded.secondary_cta_href,
  secondary_cta_label = excluded.secondary_cta_label,
  meta_description = excluded.meta_description,
  seo_title = excluded.seo_title,
  canonical_path = excluded.canonical_path,
  summary = excluded.summary,
  source_note = excluded.source_note,
  last_verified_at = excluded.last_verified_at,
  is_published = true,
  updated_at = now();
