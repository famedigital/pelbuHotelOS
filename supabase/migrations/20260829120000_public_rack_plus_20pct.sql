-- Public rack +20% on Peak/Off EPAI from marketing/rate-public.html.
-- Homepage "from" prices read public room_rates.amount_btn (double EP, all-in).
-- Lean = midpoint of the new peak/off rack.

with prop as (
  select id
  from public.properties
  where slug = 'pelbu-suites-olakha'
  limit 1
),
targets (room_code, season_kind, double_btn, single_btn) as (
  values
    -- Peak (3450/3200 · 8500/8000) × 1.20
    ('dq', 'peak', 4140::numeric, 3840::numeric),
    ('dt', 'peak', 4140::numeric, 3840::numeric),
    ('sr', 'peak', 10200::numeric, 9600::numeric),
    -- Off (3000/2800 · 7400/6900) × 1.20
    ('dq', 'off', 3600::numeric, 3360::numeric),
    ('dt', 'off', 3600::numeric, 3360::numeric),
    ('sr', 'off', 8880::numeric, 8280::numeric),
    -- Lean midpoint
    ('dq', 'lean', 3870::numeric, 3600::numeric),
    ('dt', 'lean', 3870::numeric, 3600::numeric),
    ('sr', 'lean', 9540::numeric, 8940::numeric)
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
    ('dq', 'peak', 4140::numeric, 3840::numeric),
    ('dt', 'peak', 4140::numeric, 3840::numeric),
    ('sr', 'peak', 10200::numeric, 9600::numeric),
    ('dq', 'off', 3600::numeric, 3360::numeric),
    ('dt', 'off', 3600::numeric, 3360::numeric),
    ('sr', 'off', 8880::numeric, 8280::numeric),
    ('dq', 'lean', 3870::numeric, 3600::numeric),
    ('dt', 'lean', 3870::numeric, 3600::numeric),
    ('sr', 'lean', 9540::numeric, 8940::numeric)
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
