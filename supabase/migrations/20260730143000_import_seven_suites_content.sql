-- Add long-form section storage for public CMS pages. Content import follows
-- in 20260730143100_seed_seven_suites_content.sql.
alter table public.cms_pages
  add column if not exists sections_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(sections_json) = 'array');
