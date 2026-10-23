-- Per-night meal plan and guest rate on a stay.
-- The booking meal_plan_code and agreed rate stay the defaults.

create table if not exists public.booking_night_meals (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  night_date date not null,
  meal_plan_code text not null,
  nightly_rate_btn numeric,
  room_rates jsonb not null default '{}'::jsonb,
  unique (booking_id, night_date)
);

alter table public.booking_night_meals
  add column if not exists nightly_rate_btn numeric;

alter table public.booking_night_meals
  add column if not exists room_rates jsonb not null default '{}'::jsonb;

create index if not exists booking_night_meals_property_idx
  on public.booking_night_meals (property_id, night_date);

comment on table public.booking_night_meals is
  'One meal plan per stay night, plus the guest rate for each room that night.';

alter table public.booking_night_meals enable row level security;

grant select, insert, update, delete on public.booking_night_meals to service_role;

notify pgrst, 'reload schema';
