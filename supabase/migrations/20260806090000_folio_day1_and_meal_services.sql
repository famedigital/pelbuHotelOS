-- FO money cycle: day-1 room rent at check-in (default on) + kitchen meal service publish

alter table properties
  add column if not exists post_day1_room_at_checkin boolean not null default true;

comment on column properties.post_day1_room_at_checkin is
  'When true, check-in posts room rent for the arrival business date (idempotent with night audit). Later nights still post via night audit.';

create table if not exists kitchen_meal_services (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  service_date date not null,
  meal_period text not null
    check (meal_period = any (array[
      'breakfast'::text, 'lunch'::text, 'dinner'::text
    ])),
  heads int not null default 0 check (heads >= 0),
  guest_feed jsonb not null default '[]'::jsonb,
  menu_note text,
  menu_highlights text,
  published_at timestamptz not null default now(),
  published_by text,
  unique (property_id, service_date, meal_period)
);

create index if not exists kitchen_meal_services_property_date_idx
  on kitchen_meal_services (property_id, service_date desc);

comment on table kitchen_meal_services is
  'Kitchen → FO/F&B publish of meal period covers + menu notes for a service day.';

alter table kitchen_meal_services enable row level security;

drop policy if exists "service_role full kitchen_meal_services" on kitchen_meal_services;
create policy "service_role full kitchen_meal_services" on kitchen_meal_services
  for all to service_role using (true) with check (true);

-- Include meal services in operational wipe if function exists
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'desk_wipe_operational_data'
  ) then
    -- best-effort: meal services cascade via property delete already;
    -- no function body rewrite required for FK cascade.
    null;
  end if;
end $$;
