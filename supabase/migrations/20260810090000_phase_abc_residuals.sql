-- Phase A–C residuals: guest requests kinds, early/late fees, minibar catalog, agent commission %.

-- ---------------------------------------------------------------------------
-- In-house guest request kinds (beyond wake-up / callback / other)
-- ---------------------------------------------------------------------------
alter table inhouse_tasks drop constraint if exists inhouse_tasks_kind_check;

alter table inhouse_tasks
  add constraint inhouse_tasks_kind_check
  check (
    kind = any (
      array[
        'wake_up'::text,
        'callback'::text,
        'towels'::text,
        'extra_pillows'::text,
        'extra_bed'::text,
        'minibar'::text,
        'taxi'::text,
        'housekeeping'::text,
        'luggage'::text,
        'turb'::text,
        'other'::text
      ]
    )
  );

comment on column inhouse_tasks.kind is
  'Guest request kind: wake_up, callback, towels, extra_*, minibar, taxi, housekeeping, luggage, turb, other.';

-- ---------------------------------------------------------------------------
-- Early / late fee defaults on property policies
-- ---------------------------------------------------------------------------
alter table property_policies
  add column if not exists early_checkout_fee_btn numeric(12, 2)
    check (early_checkout_fee_btn is null or early_checkout_fee_btn >= 0);

alter table property_policies
  add column if not exists late_checkout_fee_btn numeric(12, 2)
    check (late_checkout_fee_btn is null or late_checkout_fee_btn >= 0);

comment on column property_policies.early_checkout_fee_btn is
  'Suggested early departure fee (Nu) — desk may post at checkout.';
comment on column property_policies.late_checkout_fee_btn is
  'Suggested late check-out fee (Nu) — desk may post on stay.';

update property_policies pp
set
  early_checkout_fee_btn = coalesce(pp.early_checkout_fee_btn, 1500),
  late_checkout_fee_btn = coalesce(pp.late_checkout_fee_btn, 1500)
from properties p
where pp.property_id = p.id
  and p.slug = 'pelbu-suites-olakha';

-- ---------------------------------------------------------------------------
-- Minibar / amenity quick-charge catalog (no POS ticket)
-- ---------------------------------------------------------------------------
create table if not exists property_minibar_items (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  code text not null,
  label text not null,
  amount_btn numeric(12, 2) not null check (amount_btn >= 0),
  category text not null default 'minibar'
    check (category = any (array['minibar'::text, 'amenity'::text, 'other'::text])),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, code)
);

create index if not exists property_minibar_items_property_active_idx
  on property_minibar_items (property_id, is_active, sort_order);

alter table property_minibar_items enable row level security;

drop policy if exists "service_role full property_minibar_items" on property_minibar_items;
create policy "service_role full property_minibar_items" on property_minibar_items
  for all to service_role using (true) with check (true);

comment on table property_minibar_items is
  'Quick folio charge catalog for minibar and room amenities (desk picker, not full POS).';

insert into property_minibar_items (
  property_id, code, label, amount_btn, category, sort_order, is_active
)
select
  p.id,
  v.code,
  v.label,
  v.amount_btn,
  v.category,
  v.sort_order,
  true
from properties p
cross join (
  values
    ('water_500', 'Bottled water 500 ml', 50::numeric, 'minibar', 10),
    ('soft_drink', 'Soft drink', 80::numeric, 'minibar', 20),
    ('beer_local', 'Local beer', 200::numeric, 'minibar', 30),
    ('chips', 'Chips / snack pack', 120::numeric, 'minibar', 40),
    ('chocolate', 'Chocolate bar', 100::numeric, 'minibar', 50),
    ('nuts', 'Nuts pack', 150::numeric, 'minibar', 60),
    ('toothbrush', 'Toothbrush kit', 80::numeric, 'amenity', 70),
    ('razor', 'Razor kit', 80::numeric, 'amenity', 80),
    ('sewing', 'Sewing kit', 50::numeric, 'amenity', 90),
    ('amenity_set', 'Extra amenity set', 500::numeric, 'amenity', 100)
) as v(code, label, amount_btn, category, sort_order)
where p.slug = 'pelbu-suites-olakha'
on conflict (property_id, code) do nothing;

-- ---------------------------------------------------------------------------
-- Agent commission % for production CSV
-- ---------------------------------------------------------------------------
alter table agents
  add column if not exists commission_pct numeric(5, 2)
    check (commission_pct is null or (commission_pct >= 0 and commission_pct <= 100));

comment on column agents.commission_pct is
  'Optional commission percentage on quoted agent production for reports CSV.';
