-- Marketing catalogues: composable hotel packs for web share / IG-FB social / print PDF.

create table if not exists marketing_catalogues (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  template_code text not null
    check (template_code = any (array[
      'flagship_stay'::text,
      'fnb_taste'::text,
      'agent_trade'::text
    ])),
  title text not null,
  slug text not null,
  season_label text,
  audience text not null default 'public'
    check (audience = any (array[
      'public'::text,
      'agents'::text,
      'media_press'::text
    ])),
  status text not null default 'draft'
    check (status = any (array[
      'draft'::text,
      'published'::text,
      'archived'::text
    ])),
  cover_public_id text,
  intro_blurb text,
  caption_feed text,
  caption_story text,
  caption_agent text,
  hashtags text,
  cta_kind text not null default 'book'
    check (cta_kind = any (array[
      'book'::text,
      'order'::text,
      'contact'::text,
      'custom'::text
    ])),
  cta_href text,
  cta_label text,
  promo_code_id uuid references promo_codes (id) on delete set null,
  show_public_rates boolean not null default false,
  view_count int not null default 0 check (view_count >= 0),
  social_download_count int not null default 0 check (social_download_count >= 0),
  published_at timestamptz,
  published_by text,
  sections jsonb not null default '[]'::jsonb,
  template_options jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_catalogues_property_slug_uidx unique (property_id, slug)
);

create index if not exists marketing_catalogues_property_status_idx
  on marketing_catalogues (property_id, status, updated_at desc);

create index if not exists marketing_catalogues_public_slug_idx
  on marketing_catalogues (slug)
  where status = 'published';

alter table marketing_catalogues enable row level security;

drop policy if exists marketing_catalogues_service_role on marketing_catalogues;
create policy marketing_catalogues_service_role
  on marketing_catalogues
  for all
  to service_role
  using (true)
  with check (true);

comment on table marketing_catalogues is
  'Hotel brochure/catalogue packs for social share + print, rendered via template_code.';

comment on column marketing_catalogues.sections is
  'Ordered array of { type, enabled, sort_order, title?, caption?, item_ids?, image_public_id? }.';

create or replace function marketing_catalogue_record_view(p_catalogue_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update marketing_catalogues
  set view_count = view_count + 1
  where id = p_catalogue_id
    and status = 'published';
end;
$$;

revoke all on function marketing_catalogue_record_view(uuid) from public;
grant execute on function marketing_catalogue_record_view(uuid) to service_role;

create or replace function marketing_catalogue_record_social_dl(p_catalogue_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update marketing_catalogues
  set social_download_count = social_download_count + 1
  where id = p_catalogue_id;
end;
$$;

revoke all on function marketing_catalogue_record_social_dl(uuid) from public;
grant execute on function marketing_catalogue_record_social_dl(uuid) to service_role;
