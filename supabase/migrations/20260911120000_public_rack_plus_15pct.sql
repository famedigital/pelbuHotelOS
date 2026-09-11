-- Public rack +15% on Peak/Off EPAI from marketing/rate-public.html.
-- Homepage /rates /book read public room_rates (EP all-in) + meal_plans.
-- Lean = midpoint of the new peak/off rack (rounded to whole BTN).

with prop as (
  select id
  from public.properties
  where slug = 'pelbu-suites-olakha'
  limit 1
),
targets (room_code, season_kind, double_btn, single_btn) as (
  values
    -- Peak (4140/3840 · 10200/9600) × 1.15
    ('dq', 'peak', 4761::numeric, 4416::numeric),
    ('dt', 'peak', 4761::numeric, 4416::numeric),
    ('sr', 'peak', 11730::numeric, 11040::numeric),
    -- Off (3600/3360 · 8880/8280) × 1.15
    ('dq', 'off', 4140::numeric, 3864::numeric),
    ('dt', 'off', 4140::numeric, 3864::numeric),
    ('sr', 'off', 10212::numeric, 9522::numeric),
    -- Lean midpoint
    ('dq', 'lean', 4451::numeric, 4140::numeric),
    ('dt', 'lean', 4451::numeric, 4140::numeric),
    ('sr', 'lean', 10971::numeric, 10281::numeric)
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
),
targets (room_code, season_kind, double_btn, single_btn) as (
  values
    ('dq', 'peak', 4761::numeric, 4416::numeric),
    ('dt', 'peak', 4761::numeric, 4416::numeric),
    ('sr', 'peak', 11730::numeric, 11040::numeric),
    ('dq', 'off', 4140::numeric, 3864::numeric),
    ('dt', 'off', 4140::numeric, 3864::numeric),
    ('sr', 'off', 10212::numeric, 9522::numeric),
    ('dq', 'lean', 4451::numeric, 4140::numeric),
    ('dt', 'lean', 4451::numeric, 4140::numeric),
    ('sr', 'lean', 10971::numeric, 10281::numeric)
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

-- Meal supplements × 1.15 (package columns on /rates = EP + meals × occupancy)
with prop as (
  select id
  from public.properties
  where slug = 'pelbu-suites-olakha'
  limit 1
)
update public.meal_plans mp
set
  amount_btn_per_adult_night = case mp.code
    when 'BB' then 460::numeric
    when 'MAP' then 1208::numeric
    when 'AP' then 1869::numeric
    else mp.amount_btn_per_adult_night
  end,
  amount_btn_per_child_night = case mp.code
    when 'BB' then 230::numeric
    when 'MAP' then 621::numeric
    when 'AP' then 954::numeric
    else mp.amount_btn_per_child_night
  end
from prop
where mp.property_id = prop.id
  and mp.code in ('BB', 'MAP', 'AP');

-- Extra bed EPAI × 1.15 (1150 → 1323)
with prop as (
  select id
  from public.properties
  where slug = 'pelbu-suites-olakha'
  limit 1
)
update public.property_policies pp
set extra_bed_rate_btn = 1323::numeric
from prop
where pp.property_id = prop.id;
