-- Public rack above agent Nu 5,600 reference (peak deluxe MAPAI / agent floor).
-- 2026 all-in (SC+GST already in amount). /rates 2027 tab = these × 1.20 (base +20%, tax kept in all-in).
-- Agents peak deluxe EP set to 5,600 so public stays clearly higher.

with prop as (
  select id
  from public.properties
  where slug = 'pelbu-suites-olakha'
  limit 1
),
targets (room_code, season_kind, double_btn, single_btn) as (
  values
    ('dq', 'peak', 6500::numeric, 6100::numeric),
    ('dt', 'peak', 6500::numeric, 6100::numeric),
    ('sr', 'peak', 15800::numeric, 14900::numeric),
    ('dq', 'off', 5700::numeric, 5300::numeric),
    ('dt', 'off', 5700::numeric, 5300::numeric),
    ('sr', 'off', 13800::numeric, 12900::numeric),
    ('dq', 'lean', 6100::numeric, 5700::numeric),
    ('dt', 'lean', 6100::numeric, 5700::numeric),
    ('sr', 'lean', 14900::numeric, 13900::numeric)
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

-- Agent floor: peak deluxe EP all-in = 5,600 (public stays above)
with prop as (
  select id
  from public.properties
  where slug = 'pelbu-suites-olakha'
  limit 1
)
update public.room_rates rr
set
  amount_btn = 5600::numeric,
  amount_single_btn = 5200::numeric
from prop
join public.room_types rt
  on rt.property_id = prop.id
where rr.property_id = prop.id
  and rr.room_type_id = rt.id
  and rt.code in ('dq', 'dt')
  and rr.rate_tier = 'agents'
  and rr.season_kind = 'peak';
