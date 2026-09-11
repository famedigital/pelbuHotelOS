-- Round public +15% rack to clean hundreds (all-in SC+GST).
-- Peak deluxe 4800/4500 style; packages stay EP + meal × occupancy on /rates.

with prop as (
  select id
  from public.properties
  where slug = 'pelbu-suites-olakha'
  limit 1
),
targets (room_code, season_kind, double_btn, single_btn) as (
  values
    -- Peak · ×1.15 then round to 00
    ('dq', 'peak', 4800::numeric, 4500::numeric),
    ('dt', 'peak', 4800::numeric, 4500::numeric),
    ('sr', 'peak', 11700::numeric, 11000::numeric),
    -- Off · ×1.15 then round to 00
    ('dq', 'off', 4200::numeric, 3900::numeric),
    ('dt', 'off', 4200::numeric, 3900::numeric),
    ('sr', 'off', 10200::numeric, 9500::numeric),
    -- Lean midpoint of rounded peak/off
    ('dq', 'lean', 4500::numeric, 4200::numeric),
    ('dt', 'lean', 4500::numeric, 4200::numeric),
    ('sr', 'lean', 11000::numeric, 10300::numeric)
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

with prop as (
  select id
  from public.properties
  where slug = 'pelbu-suites-olakha'
  limit 1
)
update public.meal_plans mp
set
  amount_btn_per_adult_night = case mp.code
    when 'BB' then 500::numeric
    when 'MAP' then 1200::numeric
    when 'AP' then 1900::numeric
    else mp.amount_btn_per_adult_night
  end,
  amount_btn_per_child_night = case mp.code
    when 'BB' then 250::numeric
    when 'MAP' then 600::numeric
    when 'AP' then 950::numeric
    else mp.amount_btn_per_child_night
  end
from prop
where mp.property_id = prop.id
  and mp.code in ('BB', 'MAP', 'AP');

with prop as (
  select id
  from public.properties
  where slug = 'pelbu-suites-olakha'
  limit 1
)
update public.property_policies pp
set extra_bed_rate_btn = 1300::numeric
from prop
where pp.property_id = prop.id;
