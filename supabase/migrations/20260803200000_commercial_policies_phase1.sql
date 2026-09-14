-- Phase 1: default meal plan, property policies, damage catalog (Pelbu Olakha seeds)

-- ---------------------------------------------------------------------------
-- Default meal plan on property
-- ---------------------------------------------------------------------------
alter table properties
  add column if not exists default_meal_plan_code text;

update properties
set default_meal_plan_code = 'EP'
where default_meal_plan_code is null;

alter table properties
  alter column default_meal_plan_code set default 'EP';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'properties_default_meal_plan_fk'
  ) then
    alter table properties
      add constraint properties_default_meal_plan_fk
      foreign key (id, default_meal_plan_code)
      references meal_plans (property_id, code)
      deferrable initially deferred;
  end if;
exception
  when others then null;
end
$$;

comment on column properties.default_meal_plan_code is
  'Desk default meal plan for fast book and walk-ins. EP = room only.';

-- ---------------------------------------------------------------------------
-- Booking / cancel / house policies (one row per property)
-- ---------------------------------------------------------------------------
create table if not exists property_policies (
  property_id uuid primary key references properties(id) on delete cascade,
  free_cancel_days int not null default 3 check (free_cancel_days >= 0),
  late_cancel_forfeit_deposit boolean not null default true,
  no_show_nights int not null default 1 check (no_show_nights >= 0),
  mou_free_cancel boolean not null default true,
  mou_waive_no_show boolean not null default true,
  guest_summary text,
  house_rules text,
  dos text,
  donts text,
  wifi_name text,
  wifi_password text,
  check_in_time text,
  check_out_time text,
  quiet_hours text,
  updated_at timestamptz not null default now()
);

alter table property_policies enable row level security;

drop policy if exists "service_role full property_policies" on property_policies;
create policy "service_role full property_policies" on property_policies
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Damage catalog (folio picker + guest pack)
-- ---------------------------------------------------------------------------
create table if not exists property_damage_items (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  code text not null,
  label text not null,
  amount_btn numeric(12,2) check (amount_btn is null or amount_btn >= 0),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, code)
);

create index if not exists property_damage_items_property_active_idx
  on property_damage_items (property_id, is_active, sort_order);

alter table property_damage_items enable row level security;

drop policy if exists "service_role full property_damage_items" on property_damage_items;
create policy "service_role full property_damage_items" on property_damage_items
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Pelbu Suites Olakha seeds
-- ---------------------------------------------------------------------------
insert into property_policies (
  property_id,
  free_cancel_days,
  late_cancel_forfeit_deposit,
  no_show_nights,
  mou_free_cancel,
  mou_waive_no_show,
  guest_summary,
  house_rules,
  dos,
  donts,
  wifi_name,
  check_in_time,
  check_out_time,
  quiet_hours
)
select
  p.id,
  3,
  true,
  1,
  true,
  true,
  'Direct bookings: free cancellation up to 3 days before arrival. After that, the deposit may be forfeited. No-shows may be charged one night. Contracted travel agents on MoU may cancel anytime without penalty.',
  'Check-in from 2:00 PM · Check-out by 11:00 AM. Quiet hours 10:00 PM – 7:00 AM. No smoking indoors. Visitors must register at reception. Respect local customs and dress modestly when visiting temples. Dispose of waste responsibly.',
  E'• Register all guests at reception\n• Keep room keys safe\n• Use laundry bags provided\n• Ask desk for taxi or tours\n• Respect quiet hours and neighbours',
  E'• No smoking in rooms or corridors\n• No unregistered visitors overnight\n• Do not remove hotel linen or amenities\n• No loud music after 10 PM\n• Do not hang laundry on balconies facing road',
  'Pelbu-Guest',
  '14:00',
  '11:00',
  '22:00 – 07:00'
from properties p
where p.slug = 'pelbu-suites-olakha'
on conflict (property_id) do nothing;

insert into property_damage_items (
  property_id, code, label, amount_btn, sort_order, is_active
)
select
  p.id,
  v.code,
  v.label,
  v.amount_btn,
  v.sort_order,
  true
from properties p
cross join (
  values
    ('lipstick_linen', 'Lipstick / makeup on linen', 800::numeric, 10),
    ('bindi_linen', 'Bindi / forehead mark on linen', 400::numeric, 20),
    ('nail_polish', 'Nail polish stain', 600::numeric, 30),
    ('other_stain', 'Other stain (assessed)', null::numeric, 40),
    ('cigarette_burn', 'Cigarette / iron burn', 1500::numeric, 50),
    ('towel_bathrobe', 'Towel or bathrobe (replacement)', 1200::numeric, 60),
    ('hair_dryer', 'Hair dryer (replacement)', 2500::numeric, 70),
    ('kettle', 'Kettle (replacement)', 1800::numeric, 80),
    ('remote', 'TV remote (replacement)', 900::numeric, 90),
    ('glassware', 'Glass / mug (replacement)', 350::numeric, 100),
    ('mattress_protector', 'Mattress protector (replacement)', 2000::numeric, 110),
    ('curtain', 'Curtain damage / replacement', 3500::numeric, 120),
    ('carpet', 'Carpet stain / damage', 2500::numeric, 130),
    ('wall_mark', 'Wall mark / paint touch-up', 1500::numeric, 140),
    ('amenity_set', 'Amenity set (full replace)', 500::numeric, 150),
    ('heavy_cleaning', 'Heavy cleaning fee', 800::numeric, 160),
    ('other', 'Other (manager price)', null::numeric, 999)
) as v(code, label, amount_btn, sort_order)
where p.slug = 'pelbu-suites-olakha'
on conflict (property_id, code) do nothing;

-- Ensure EP active + default on Olakha
update meal_plans mp
set is_active = true,
    amount_btn_per_adult_night = coalesce(mp.amount_btn_per_adult_night, 0)
from properties p
where mp.property_id = p.id
  and p.slug = 'pelbu-suites-olakha'
  and mp.code = 'EP';

update properties p
set default_meal_plan_code = 'EP'
where p.slug = 'pelbu-suites-olakha'
  and (p.default_meal_plan_code is null or p.default_meal_plan_code = '');
