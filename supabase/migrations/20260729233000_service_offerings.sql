-- CMS-backed spa and meeting choices for public conversion engines.

create table if not exists service_offerings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  kind text not null check (kind = any (array[
    'spa'::text,
    'steam'::text,
    'meeting'::text
  ])),
  code text not null,
  name text not null,
  description text,
  duration_minutes int check (duration_minutes is null or duration_minutes > 0),
  capacity int check (capacity is null or capacity > 0),
  price_btn numeric(12,2) check (price_btn is null or price_btn >= 0),
  image_public_id text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  updated_at timestamptz not null default now(),
  unique (property_id, kind, code)
);

create index if not exists service_offerings_property_kind_idx
  on service_offerings (property_id, kind, is_active, sort_order);

alter table service_offerings enable row level security;

drop policy if exists "public read active service offerings" on service_offerings;
create policy "public read active service offerings" on service_offerings
  for select using (is_active = true);

drop policy if exists "service role manages service offerings" on service_offerings;
create policy "service role manages service offerings" on service_offerings
  for all to service_role using (true) with check (true);

insert into service_offerings (
  property_id,
  kind,
  code,
  name,
  description,
  duration_minutes,
  capacity,
  sort_order
)
select
  p.id,
  seed.kind,
  seed.code,
  seed.name,
  seed.description,
  seed.duration_minutes,
  seed.capacity,
  seed.sort_order
from properties p
cross join (
  values
    ('spa', 'massage-60', 'Massage · 60 minutes', 'A focused full-body treatment with therapist pressure confirmed before the session.', 60, 1, 10),
    ('spa', 'massage-90', 'Massage · 90 minutes', 'A slower full-body treatment for recovery after a long road or trek.', 90, 1, 20),
    ('steam', 'steam-session', 'Steam session', 'A private steam slot, subject to room availability.', 30, 2, 30),
    ('meeting', 'board', 'Board layout', 'One shared table for decisions, reviews, and small team sessions.', null, 25, 10),
    ('meeting', 'classroom', 'Classroom layout', 'Forward-facing tables for training, presentations, and workshops.', null, 25, 20),
    ('meeting', 'briefing', 'Briefing layout', 'A flexible open arrangement for team briefings and discussions.', null, 25, 30)
) as seed(kind, code, name, description, duration_minutes, capacity, sort_order)
where p.slug = 'pelbu-suites-olakha'
on conflict (property_id, kind, code) do update
set
  name = excluded.name,
  description = excluded.description,
  duration_minutes = excluded.duration_minutes,
  capacity = excluded.capacity,
  sort_order = excluded.sort_order,
  updated_at = now();
