-- Final public rack 2026 (pelbu-public-rates-2026).
-- Room sheet is EPAI all-in of room + 10% service charge. GST is not in the guest total.
-- Breakfast Nu 400 / person / night. Dinner Nu 600. Full board adds lunch Nu 600.
-- GST switch stays off. Saved rate is 5% of (charge + service charge) for when it is turned on.

update public.properties
set
  gst_enabled = false,
  gst_rate = 0.05,
  service_charge_rate = 0.10
where slug in ('pelbu-olakha', 'pelbu-suites-olakha');

with targets (kind, season_kind, double_btn, single_btn) as (
  values
    ('deluxe', 'peak', 3450::numeric, 3200::numeric),
    ('deluxe', 'off',  3000::numeric, 2800::numeric),
    ('deluxe', 'lean', 3225::numeric, 3000::numeric),
    ('suite',  'peak', 8500::numeric, 8000::numeric),
    ('suite',  'off',  7400::numeric, 6900::numeric),
    ('suite',  'lean', 7950::numeric, 7450::numeric)
)
update public.room_rates rr
set
  amount_btn = t.double_btn,
  amount_single_btn = t.single_btn
from public.properties p
join public.room_types rt on rt.property_id = p.id
join targets t on (
  (t.kind = 'deluxe' and rt.code in ('dq', 'dt', 'deluxe_king', 'deluxe_twin', 'deluxe_queen'))
  or (t.kind = 'suite' and rt.code in ('sr', 'suite'))
)
where rr.property_id = p.id
  and rr.room_type_id = rt.id
  and p.slug in ('pelbu-olakha', 'pelbu-suites-olakha')
  and rr.rate_tier = 'public'
  and lower(btrim(rr.label)) = 'standard'
  and rr.agent_id is null
  and rr.guest_label is null
  and rr.season_kind = t.season_kind;

update public.meal_plans mp
set
  amount_btn_per_adult_night = v.adult,
  amount_btn_per_child_night = v.child,
  is_active = true,
  blurb = v.blurb,
  updated_at = now()
from public.properties p,
  (values
    (
      'EP',
      0::numeric,
      null::numeric,
      'Room only. Sheet rate includes 10% service charge. GST is off until the hotel switch is on.'
    ),
    (
      'BB',
      400::numeric,
      200::numeric,
      'Breakfast Nu 400 per person per night, on top of the room rate.'
    ),
    (
      'MAP',
      1000::numeric,
      500::numeric,
      'Breakfast Nu 400 and dinner Nu 600 per person per night.'
    ),
    (
      'AP',
      1600::numeric,
      800::numeric,
      'Breakfast Nu 400, lunch Nu 600, and dinner Nu 600 per person per night.'
    )
  ) as v(code, adult, child, blurb)
where p.slug in ('pelbu-olakha', 'pelbu-suites-olakha')
  and mp.property_id = p.id
  and mp.code = v.code;

update public.property_policies pp
set
  extra_bed_rate_btn = 1150,
  extra_bed_active = true,
  rates_inclusive_of_gst_sc = true
from public.properties p
where p.slug in ('pelbu-olakha', 'pelbu-suites-olakha')
  and pp.property_id = p.id;
