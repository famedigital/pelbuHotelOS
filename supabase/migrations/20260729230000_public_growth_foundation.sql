-- Public growth foundation:
-- meal plans, verified property facts, richer CMS metadata, editorial content,
-- outlet hours, and public-read RLS.

-- ---------------------------------------------------------------------------
-- Meal plans
-- ---------------------------------------------------------------------------

create table if not exists meal_plans (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  code text not null check (code = any (array[
    'EP'::text,
    'BB'::text,
    'MAP'::text,
    'AP'::text
  ])),
  name text not null,
  blurb text,
  amount_btn_per_adult_night numeric(12,2)
    check (
      amount_btn_per_adult_night is null
      or amount_btn_per_adult_night >= 0
    ),
  sort_order int not null default 0,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, code)
);

create index if not exists meal_plans_property_active_idx
  on meal_plans (property_id, is_active, sort_order);

alter table meal_plans enable row level security;

drop policy if exists "public read active meal_plans" on meal_plans;
create policy "public read active meal_plans" on meal_plans
  for select using (is_active = true);

drop policy if exists "service_role full meal_plans" on meal_plans;
create policy "service_role full meal_plans" on meal_plans
  for all to service_role using (true) with check (true);

-- EP is safe to enable at zero. The paid plans remain inactive until the desk
-- configures real prices; we do not invent money values in a migration.
insert into meal_plans (
  property_id,
  code,
  name,
  blurb,
  amount_btn_per_adult_night,
  sort_order,
  is_active
)
select
  p.id,
  v.code,
  v.name,
  v.blurb,
  v.amount_btn_per_adult_night,
  v.sort_order,
  v.is_active
from properties p
cross join (
  values
    (
      'EP',
      'Room only',
      'Accommodation without a meal plan.',
      0::numeric,
      10,
      true
    ),
    (
      'BB',
      'Bed & breakfast',
      'Accommodation with breakfast.',
      null::numeric,
      20,
      false
    ),
    (
      'MAP',
      'Breakfast & one main meal',
      'Accommodation with breakfast and one main meal.',
      null::numeric,
      30,
      false
    ),
    (
      'AP',
      'Full board',
      'Accommodation with breakfast, lunch and dinner.',
      null::numeric,
      40,
      false
    )
) as v(
  code,
  name,
  blurb,
  amount_btn_per_adult_night,
  sort_order,
  is_active
)
where p.slug = 'pelbu-suites-olakha'
on conflict (property_id, code) do nothing;

alter table bookings
  add column if not exists meal_plan_code text,
  add column if not exists meal_plan_amount_btn numeric(14,2) not null default 0
    check (meal_plan_amount_btn >= 0);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_meal_plan_property_fk'
  ) then
    alter table bookings
      add constraint bookings_meal_plan_property_fk
      foreign key (property_id, meal_plan_code)
      references meal_plans (property_id, code);
  end if;
end
$$;

comment on column bookings.meal_plan_amount_btn is
  'Snapshot of the total meal-plan add-on quoted for the stay.';

-- ---------------------------------------------------------------------------
-- Property identity, contact and verified facts
-- ---------------------------------------------------------------------------

alter table properties
  add column if not exists whatsapp text,
  add column if not exists maps_url text,
  add column if not exists instagram_handle text,
  add column if not exists facebook_url text,
  add column if not exists tiktok_url text;

create table if not exists property_facts (
  property_id uuid primary key references properties(id) on delete cascade,
  check_in_time time,
  check_out_time time,
  star_rating numeric(2,1)
    check (star_rating is null or (star_rating >= 0 and star_rating <= 5)),
  room_count int check (room_count is null or room_count >= 0),
  latitude numeric(10,7),
  longitude numeric(10,7),
  amenities_json jsonb not null default '[]'::jsonb,
  policies_json jsonb not null default '{}'::jsonb,
  source_note text,
  last_verified_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table property_facts enable row level security;

drop policy if exists "public read property_facts" on property_facts;
create policy "public read property_facts" on property_facts
  for select using (true);

drop policy if exists "service_role full property_facts" on property_facts;
create policy "service_role full property_facts" on property_facts
  for all to service_role using (true) with check (true);

insert into property_facts (property_id)
select id
from properties
where slug = 'pelbu-suites-olakha'
on conflict (property_id) do nothing;

-- ---------------------------------------------------------------------------
-- CMS search metadata and editorial content
-- ---------------------------------------------------------------------------

alter table cms_pages
  add column if not exists seo_title text,
  add column if not exists canonical_path text,
  add column if not exists og_public_id text,
  add column if not exists summary text,
  add column if not exists faq_json jsonb not null default '[]'::jsonb,
  add column if not exists author_name text,
  add column if not exists source_note text,
  add column if not exists last_verified_at timestamptz;

create table if not exists cms_posts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  slug text not null,
  title text not null,
  excerpt text not null,
  body_md text not null,
  cover_public_id text,
  content_type text not null default 'guide'
    check (content_type = any (array[
      'guide'::text,
      'story'::text,
      'news'::text
    ])),
  primary_query text,
  seo_title text,
  meta_description text,
  author_name text,
  source_note text,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  last_verified_at timestamptz,
  is_published boolean not null default false,
  unique (property_id, slug)
);

create index if not exists cms_posts_property_published_idx
  on cms_posts (property_id, published_at desc)
  where is_published = true;

alter table cms_posts enable row level security;

drop policy if exists "public read published cms_posts" on cms_posts;
create policy "public read published cms_posts" on cms_posts
  for select using (is_published = true);

drop policy if exists "service_role full cms_posts" on cms_posts;
create policy "service_role full cms_posts" on cms_posts
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Structured outlet hours
-- ---------------------------------------------------------------------------

create table if not exists outlet_hours (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  outlet text not null check (outlet = any (array[
    'cafe'::text,
    'pastry'::text,
    'restaurant'::text,
    'bar'::text
  ])),
  day_of_week int not null check (day_of_week between 0 and 6),
  season text not null default 'all'
    check (season = any (array[
      'summer'::text,
      'winter'::text,
      'all'::text
    ])),
  opens_at time,
  closes_at time,
  is_closed boolean not null default false,
  source_note text,
  last_verified_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (property_id, outlet, day_of_week, season),
  check (
    is_closed = true
    or (opens_at is not null and closes_at is not null)
  )
);

create index if not exists outlet_hours_property_outlet_idx
  on outlet_hours (property_id, outlet, day_of_week);

alter table outlet_hours enable row level security;

drop policy if exists "public read outlet_hours" on outlet_hours;
create policy "public read outlet_hours" on outlet_hours
  for select using (true);

drop policy if exists "service_role full outlet_hours" on outlet_hours;
create policy "service_role full outlet_hours" on outlet_hours
  for all to service_role using (true) with check (true);

