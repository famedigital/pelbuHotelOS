-- Final public rack rates (EPAI) from published Peak / Off rate card.
-- room_rates amount_btn = double EP; amount_single_btn = single EP (all-in).
-- Deluxe/Standard = codes dq (King) + dt (Twin); Pelbu Suite = sr.
-- Meal plans: CP published as code BB; a la carte meals + package supplements.
-- Lean: midpoint of peak/off until a lean card is published.

-- ---------------------------------------------------------------------------
-- Public EP rack (all-in)
-- ---------------------------------------------------------------------------
with prop as (
  select id
  from public.properties
  where slug = 'pelbu-suites-olakha'
  limit 1
),
targets (room_code, season_kind, double_btn, single_btn) as (
  values
    -- Peak
    ('dq', 'peak', 3450::numeric, 3200::numeric),
    ('dt', 'peak', 3450::numeric, 3200::numeric),
    ('sr', 'peak', 8500::numeric, 8000::numeric),
    -- Off
    ('dq', 'off', 3000::numeric, 2800::numeric),
    ('dt', 'off', 3000::numeric, 2800::numeric),
    ('sr', 'off', 7400::numeric, 6900::numeric),
    -- Lean (midpoint peak/off)
    ('dq', 'lean', 3225::numeric, 3000::numeric),
    ('dt', 'lean', 3225::numeric, 3000::numeric),
    ('sr', 'lean', 7950::numeric, 7450::numeric)
)
update public.room_rates rr
set
  amount_btn = t.double_btn,
  amount_single_btn = t.single_btn
from prop
join public.room_types rt
  on rt.property_id = prop.id
join targets t
  on t.room_code = rt.code
where rr.property_id = prop.id
  and rr.room_type_id = rt.id
  and rr.rate_tier = 'public'
  and rr.season_kind = t.season_kind;

-- Insert any missing public cells (idempotent)
with prop as (
  select id
  from public.properties
  where slug = 'pelbu-suites-olakha'
  limit 1
),
targets (room_code, season_kind, double_btn, single_btn) as (
  values
    ('dq', 'peak', 3450::numeric, 3200::numeric),
    ('dt', 'peak', 3450::numeric, 3200::numeric),
    ('sr', 'peak', 8500::numeric, 8000::numeric),
    ('dq', 'off', 3000::numeric, 2800::numeric),
    ('dt', 'off', 3000::numeric, 2800::numeric),
    ('sr', 'off', 7400::numeric, 6900::numeric),
    ('dq', 'lean', 3225::numeric, 3000::numeric),
    ('dt', 'lean', 3225::numeric, 3000::numeric),
    ('sr', 'lean', 7950::numeric, 7450::numeric)
)
insert into public.room_rates (
  property_id,
  room_type_id,
  season_kind,
  rate_tier,
  amount_btn,
  amount_single_btn
)
select
  prop.id,
  rt.id,
  t.season_kind,
  'public',
  t.double_btn,
  t.single_btn
from prop
join public.room_types rt
  on rt.property_id = prop.id
join targets t
  on t.room_code = rt.code
where not exists (
  select 1
  from public.room_rates rr
  where rr.property_id = prop.id
    and rr.room_type_id = rt.id
    and rr.season_kind = t.season_kind
    and rr.rate_tier = 'public'
);

-- ---------------------------------------------------------------------------
-- Meal plan supplements (per adult / night)
-- Derived so package ≈ EP + plan (CP~400, MAP~1050, AP~1625 from rate card).
-- Child: extra-bed card meal deltas (CP 200, MAP 540, AP 830).
-- ---------------------------------------------------------------------------
update public.meal_plans mp
set
  amount_btn_per_adult_night = v.adult,
  amount_btn_per_child_night = v.child,
  is_active = true,
  name = v.name,
  blurb = v.blurb,
  updated_at = now()
from public.properties p,
  (values
    (
      'EP',
      'Room only',
      'European Plan — accommodation without meals (all-in room rate).',
      0::numeric,
      null::numeric
    ),
    (
      'BB',
      'Continental / breakfast (CP)',
      'Room + breakfast. Matches public CP package differential.',
      400::numeric,
      200::numeric
    ),
    (
      'MAP',
      'Half board (breakfast & dinner)',
      'Room + breakfast + dinner for the priced occupancy.',
      1050::numeric,
      540::numeric
    ),
    (
      'AP',
      'Full board',
      'Room + breakfast, lunch and dinner for the priced occupancy.',
      1625::numeric,
      830::numeric
    )
  ) as v(code, name, blurb, adult, child)
where p.slug = 'pelbu-suites-olakha'
  and mp.property_id = p.id
  and mp.code = v.code;

-- ---------------------------------------------------------------------------
-- Extra bed (EP base all-in) + rates stored all-in (AI)
-- ---------------------------------------------------------------------------
update public.property_policies pp
set
  extra_bed_rate_btn = 1150,
  extra_bed_active = true,
  rates_inclusive_of_gst_sc = true
from public.properties p
where p.slug = 'pelbu-suites-olakha'
  and pp.property_id = p.id;
