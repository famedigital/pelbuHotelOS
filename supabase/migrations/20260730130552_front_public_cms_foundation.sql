-- FRONT PUBLIC CMS foundation.
--
-- Published page columns stay on cms_pages so existing public readers keep
-- working. Drafts deliberately live in a separate table: cms_pages has a
-- public SELECT policy, so adding draft JSON to that table would leak
-- unpublished copy through the Data API.

alter table public.cms_pages
  add column if not exists revision integer not null default 1,
  add column if not exists published_at timestamptz;

update public.cms_pages
set published_at = coalesce(published_at, updated_at, now())
where is_published = true
  and published_at is null;

create table if not exists public.cms_page_drafts (
  page_id uuid primary key references public.cms_pages(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  content jsonb not null default '{}'::jsonb
    check (jsonb_typeof(content) = 'object'),
  base_revision integer not null default 1 check (base_revision > 0),
  updated_at timestamptz not null default now(),
  updated_by text
);

create index if not exists cms_page_drafts_property_idx
  on public.cms_page_drafts(property_id, updated_at desc);

create table if not exists public.cms_page_revisions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.cms_pages(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  revision integer not null check (revision > 0),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  created_at timestamptz not null default now(),
  created_by text,
  unique (page_id, revision)
);

create index if not exists cms_page_revisions_page_idx
  on public.cms_page_revisions(page_id, revision desc);

-- Site-wide public chrome (navigation/footer) and future theme/template
-- settings use keyed documents. Drafts are separate for the same reason as
-- page drafts.
create table if not exists public.cms_site_settings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9._-]{1,79}$'),
  content jsonb not null default '{}'::jsonb
    check (jsonb_typeof(content) = 'object'),
  revision integer not null default 1 check (revision > 0),
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, key)
);

create table if not exists public.cms_site_setting_drafts (
  setting_id uuid primary key
    references public.cms_site_settings(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  content jsonb not null default '{}'::jsonb
    check (jsonb_typeof(content) = 'object'),
  base_revision integer not null default 1 check (base_revision > 0),
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.cms_page_drafts enable row level security;
alter table public.cms_page_revisions enable row level security;
alter table public.cms_site_settings enable row level security;
alter table public.cms_site_setting_drafts enable row level security;

-- Only published settings are public. Draft/revision tables intentionally have
-- no anon/authenticated policy; ERP writes through the server-side admin
-- client after desk authentication.
drop policy if exists "public read cms site settings"
  on public.cms_site_settings;
create policy "public read cms site settings"
  on public.cms_site_settings
  for select
  using (true);

revoke all on table public.cms_page_drafts from anon, authenticated;
revoke all on table public.cms_page_revisions from anon, authenticated;
revoke all on table public.cms_site_setting_drafts from anon, authenticated;

-- Seed a private draft for every existing page from its currently published
-- fields. This makes the first ERP edit non-destructive.
insert into public.cms_page_drafts (
  page_id,
  property_id,
  content,
  base_revision,
  updated_at
)
select
  p.id,
  p.property_id,
  jsonb_strip_nulls(jsonb_build_object(
    'eyebrow', p.eyebrow,
    'title', p.title,
    'body', p.body,
    'hours_note', p.hours_note,
    'primary_cta_href', p.primary_cta_href,
    'primary_cta_label', p.primary_cta_label,
    'secondary_cta_href', p.secondary_cta_href,
    'secondary_cta_label', p.secondary_cta_label,
    'seo_title', p.seo_title,
    'meta_description', p.meta_description,
    'canonical_path', p.canonical_path,
    'og_public_id', p.og_public_id,
    'summary', p.summary,
    'faq_json', p.faq_json,
    'author_name', p.author_name,
    'source_note', p.source_note,
    'last_verified_at', p.last_verified_at,
    'is_published', p.is_published
  )),
  p.revision,
  p.updated_at
from public.cms_pages p
on conflict (page_id) do nothing;

-- Snapshot the current published state as revision 1.
insert into public.cms_page_revisions (
  page_id,
  property_id,
  revision,
  content,
  created_at,
  created_by
)
select
  p.id,
  p.property_id,
  p.revision,
  d.content,
  coalesce(p.published_at, p.updated_at, now()),
  'migration'
from public.cms_pages p
join public.cms_page_drafts d on d.page_id = p.id
on conflict (page_id, revision) do nothing;

-- Initial global documents. UI and public components will be migrated onto
-- these documents incrementally.
insert into public.cms_site_settings (property_id, key, content)
select
  p.id,
  v.key,
  v.content
from public.properties p
cross join lateral (
  values
    ('site.chrome', jsonb_build_object(
      'brand_label', p.name,
      'primary_cta', jsonb_build_object('label', 'Book', 'href', '/book')
    )),
    ('site.theme', jsonb_build_object(
      'template_id', p.template_id,
      'color_scheme', 'sky-citrus-mint'
    ))
) as v(key, content)
on conflict (property_id, key) do nothing;

insert into public.cms_site_setting_drafts (
  setting_id,
  property_id,
  content,
  base_revision
)
select s.id, s.property_id, s.content, s.revision
from public.cms_site_settings s
on conflict (setting_id) do nothing;
