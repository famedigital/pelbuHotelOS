-- Sales & Marketing: campaigns, promo codes, NC (non-chargeable) for POS + rooms.
-- Atomic redemption RPC for capped coupons (e.g. first 100 × 50%).

-- ---------------------------------------------------------------------------
-- Campaigns
-- ---------------------------------------------------------------------------
create table if not exists marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  name text not null,
  objective text not null default 'other'
    check (objective = any (array[
      'influencer'::text,
      'ota_match'::text,
      'season_fill'::text,
      'staff_welfare'::text,
      'service_recovery'::text,
      'other'::text
    ])),
  status text not null default 'active'
    check (status = any (array['draft'::text, 'active'::text, 'paused'::text, 'ended'::text])),
  starts_at timestamptz,
  ends_at timestamptz,
  budget_btn numeric(12, 2) check (budget_btn is null or budget_btn >= 0),
  owner_staff_id uuid references staff_members (id) on delete set null,
  influencer_label text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_campaigns_property_status_idx
  on marketing_campaigns (property_id, status);

alter table marketing_campaigns enable row level security;

drop policy if exists marketing_campaigns_service_role on marketing_campaigns;
create policy marketing_campaigns_service_role
  on marketing_campaigns
  for all
  to service_role
  using (true)
  with check (true);

comment on table marketing_campaigns is
  'Sales & marketing parent for promo codes and commercial offers.';

-- ---------------------------------------------------------------------------
-- Promo codes
-- ---------------------------------------------------------------------------
create table if not exists promo_codes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  campaign_id uuid references marketing_campaigns (id) on delete set null,
  code text not null,
  name text not null,
  benefit_type text not null
    check (benefit_type = any (array['pct'::text, 'fixed_btn'::text])),
  benefit_value numeric(12, 2) not null check (benefit_value >= 0),
  max_discount_btn numeric(12, 2) check (max_discount_btn is null or max_discount_btn >= 0),
  max_redemptions int check (max_redemptions is null or max_redemptions > 0),
  redeemed_count int not null default 0 check (redeemed_count >= 0),
  max_per_guest int check (max_per_guest is null or max_per_guest > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  min_spend_btn numeric(12, 2) not null default 0 check (min_spend_btn >= 0),
  min_nights int not null default 0 check (min_nights >= 0),
  applies_to text[] not null default array['rooms', 'pos']::text[],
  channels text[] not null default array['public_book', 'desk_pos']::text[],
  stackable_with_partner boolean not null default false,
  priority int not null default 100,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promo_codes_property_code_uidx unique (property_id, code)
);

create index if not exists promo_codes_property_active_idx
  on promo_codes (property_id, active)
  where active = true;

alter table promo_codes enable row level security;

drop policy if exists promo_codes_service_role on promo_codes;
create policy promo_codes_service_role
  on promo_codes
  for all
  to service_role
  using (true)
  with check (true);

comment on table promo_codes is
  'Rule-based discount coupons (pct or fixed Nu) with redemption caps.';

-- ---------------------------------------------------------------------------
-- Promo redemptions (immutable ledger)
-- ---------------------------------------------------------------------------
create table if not exists promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  promo_code_id uuid not null references promo_codes (id) on delete cascade,
  booking_id uuid references bookings (id) on delete set null,
  order_id uuid references orders (id) on delete set null,
  folio_id uuid references folios (id) on delete set null,
  folio_line_id uuid references folio_lines (id) on delete set null,
  guest_key text,
  channel text not null,
  applies_domain text not null,
  pre_discount_btn numeric(12, 2) not null check (pre_discount_btn >= 0),
  discount_btn numeric(12, 2) not null check (discount_btn >= 0),
  post_discount_btn numeric(12, 2) not null check (post_discount_btn >= 0),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text not null default 'desk'
);

create index if not exists promo_redemptions_promo_idx
  on promo_redemptions (promo_code_id, created_at desc);

create index if not exists promo_redemptions_property_day_idx
  on promo_redemptions (property_id, created_at desc);

alter table promo_redemptions enable row level security;

drop policy if exists promo_redemptions_service_role on promo_redemptions;
create policy promo_redemptions_service_role
  on promo_redemptions
  for all
  to service_role
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- NC reason codes (policies)
-- ---------------------------------------------------------------------------
create table if not exists nc_reason_codes (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  code text not null,
  label text not null,
  domains text[] not null default array['pos', 'room']::text[],
  requires_role text not null default 'manager'
    check (requires_role = any (array[
      'supervisor'::text,
      'manager'::text,
      'owner'::text
    ])),
  active boolean not null default true,
  sort_order int not null default 100,
  notes text,
  created_at timestamptz not null default now(),
  constraint nc_reason_codes_property_code_uidx unique (property_id, code)
);

create index if not exists nc_reason_codes_property_active_idx
  on nc_reason_codes (property_id, active);

alter table nc_reason_codes enable row level security;

drop policy if exists nc_reason_codes_service_role on nc_reason_codes;
create policy nc_reason_codes_service_role
  on nc_reason_codes
  for all
  to service_role
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- NC events (report ledger — ops also snapshot on order_items / assignments)
-- ---------------------------------------------------------------------------
create table if not exists nc_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  domain text not null
    check (domain = any (array[
      'pos'::text,
      'room'::text,
      'spa'::text,
      'laundry'::text,
      'guest_service'::text,
      'meal_plan'::text,
      'other'::text
    ])),
  reason_code text not null,
  list_value_btn numeric(12, 2) not null default 0 check (list_value_btn >= 0),
  order_id uuid references orders (id) on delete set null,
  order_item_id uuid references order_items (id) on delete set null,
  booking_id uuid references bookings (id) on delete set null,
  room_assignment_id uuid references room_assignments (id) on delete set null,
  folio_id uuid references folios (id) on delete set null,
  business_date date,
  description text,
  approved_by text,
  created_at timestamptz not null default now(),
  created_by text not null default 'desk'
);

create index if not exists nc_events_property_day_idx
  on nc_events (property_id, created_at desc);

create index if not exists nc_events_domain_idx
  on nc_events (property_id, domain, created_at desc);

alter table nc_events enable row level security;

drop policy if exists nc_events_service_role on nc_events;
create policy nc_events_service_role
  on nc_events
  for all
  to service_role
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- POS order_items / orders NC + promo columns
-- ---------------------------------------------------------------------------
alter table order_items
  add column if not exists is_nc boolean not null default false,
  add column if not exists nc_reason_code text,
  add column if not exists list_unit_price_btn numeric(12, 2),
  add column if not exists nc_value_btn numeric(12, 2) not null default 0
    check (nc_value_btn >= 0),
  add column if not exists nc_approved_by text;

comment on column order_items.is_nc is
  'Non-chargeable line: still served/KOT/stock, Nu 0 on settle; list price in nc_value_btn.';

alter table orders
  add column if not exists promo_code_id uuid references promo_codes (id) on delete set null,
  add column if not exists promo_discount_btn numeric(12, 2) not null default 0
    check (promo_discount_btn >= 0),
  add column if not exists nc_value_btn numeric(12, 2) not null default 0
    check (nc_value_btn >= 0),
  add column if not exists list_subtotal_btn numeric(12, 2);

-- Allow NC tender (amount may be 0 for fully NC tickets)
alter table order_tenders drop constraint if exists order_tenders_method_check;
alter table order_tenders
  add constraint order_tenders_method_check
  check (method = any (array[
    'cash'::text,
    'bank'::text,
    'card'::text,
    'agent_credit'::text,
    'bank_qr'::text,
    'pay_bt'::text,
    'deposit'::text,
    'room_charge'::text,
    'nc'::text
  ]));

alter table order_tenders drop constraint if exists order_tenders_amount_btn_check;
alter table order_tenders
  add constraint order_tenders_amount_btn_check
  check (amount_btn >= 0);

-- ---------------------------------------------------------------------------
-- Room assignments: chargeable / NC
-- ---------------------------------------------------------------------------
alter table room_assignments
  add column if not exists chargeable boolean not null default true,
  add column if not exists nc_reason_code text,
  add column if not exists nc_authorized_by text;

comment on column room_assignments.chargeable is
  'When false, sellable rooms skip room-night folio post (NC / house use / media).';

-- ---------------------------------------------------------------------------
-- Bookings: promo snapshot
-- ---------------------------------------------------------------------------
alter table bookings
  add column if not exists promo_code_id uuid references promo_codes (id) on delete set null,
  add column if not exists promo_discount_pct numeric(5, 2),
  add column if not exists promo_discount_btn numeric(12, 2) not null default 0
    check (promo_discount_btn >= 0),
  add column if not exists promo_code_snapshot text;

-- ---------------------------------------------------------------------------
-- Folio lines: optional NC / discount metadata (money still 0 for pure NC)
-- ---------------------------------------------------------------------------
alter table folio_lines
  add column if not exists is_nc boolean not null default false,
  add column if not exists nc_reason_code text,
  add column if not exists promo_code_id uuid references promo_codes (id) on delete set null,
  add column if not exists list_amount_btn numeric(12, 2);

-- Allow source_type 'nc' for zero-value memo lines
alter table folio_lines drop constraint if exists folio_lines_source_type_check;
alter table folio_lines
  add constraint folio_lines_source_type_check
  check (source_type = any (array[
    'room'::text,
    'order'::text,
    'service'::text,
    'guest_service'::text,
    'payment'::text,
    'adjustment'::text,
    'comp'::text,
    'deposit'::text,
    'meal_plan'::text,
    'extra_bed'::text,
    'cancel_fee'::text,
    'no_show_fee'::text,
    'damage'::text,
    'laundry'::text,
    'minibar'::text,
    'amenity'::text,
    'nc'::text
  ]));

-- ---------------------------------------------------------------------------
-- Atomic promo redeem (race-safe cap)
-- ---------------------------------------------------------------------------
create or replace function redeem_promo_code(
  p_property_id uuid,
  p_code text,
  p_channel text,
  p_domain text,
  p_pre_discount_btn numeric,
  p_guest_key text default null,
  p_booking_id uuid default null,
  p_order_id uuid default null,
  p_folio_id uuid default null,
  p_min_nights int default 0,
  p_created_by text default 'desk',
  p_stack_partner boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(p_code));
  v_row promo_codes%rowtype;
  v_now timestamptz := now();
  v_discount numeric(12, 2);
  v_post numeric(12, 2);
  v_redemption_id uuid;
  v_guest_count int;
begin
  if v_code is null or v_code = '' then
    return jsonb_build_object('ok', false, 'error', 'Promo code is required.');
  end if;
  if p_pre_discount_btn is null or p_pre_discount_btn < 0 then
    return jsonb_build_object('ok', false, 'error', 'Invalid amount.');
  end if;

  select * into v_row
  from promo_codes
  where property_id = p_property_id
    and code = v_code
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Promo code not found.');
  end if;
  if not v_row.active then
    return jsonb_build_object('ok', false, 'error', 'Promo code is inactive.');
  end if;
  if v_row.starts_at is not null and v_now < v_row.starts_at then
    return jsonb_build_object('ok', false, 'error', 'Promo code is not active yet.');
  end if;
  if v_row.ends_at is not null and v_now > v_row.ends_at then
    return jsonb_build_object('ok', false, 'error', 'Promo code has expired.');
  end if;
  if v_row.max_redemptions is not null
     and v_row.redeemed_count >= v_row.max_redemptions then
    return jsonb_build_object('ok', false, 'error', 'Promo code redemption limit reached.');
  end if;
  if not (p_channel = any (v_row.channels)) then
    return jsonb_build_object('ok', false, 'error', 'Promo code not valid on this channel.');
  end if;
  if not (p_domain = any (v_row.applies_to)) then
    return jsonb_build_object('ok', false, 'error', 'Promo code not valid for this product.');
  end if;
  if p_pre_discount_btn < coalesce(v_row.min_spend_btn, 0) then
    return jsonb_build_object('ok', false, 'error', 'Minimum spend not met.');
  end if;
  if coalesce(p_min_nights, 0) < coalesce(v_row.min_nights, 0) then
    return jsonb_build_object('ok', false, 'error', 'Minimum nights not met.');
  end if;
  if p_stack_partner and not v_row.stackable_with_partner then
    return jsonb_build_object('ok', false, 'error', 'Promo cannot stack with partner discount.');
  end if;

  if p_guest_key is not null and v_row.max_per_guest is not null then
    select count(*)::int into v_guest_count
    from promo_redemptions
    where promo_code_id = v_row.id
      and guest_key = p_guest_key;
    if v_guest_count >= v_row.max_per_guest then
      return jsonb_build_object('ok', false, 'error', 'Guest already used this promo.');
    end if;
  end if;

  if v_row.benefit_type = 'pct' then
    v_discount := round(p_pre_discount_btn * (least(100, v_row.benefit_value) / 100.0), 2);
  else
    v_discount := least(p_pre_discount_btn, v_row.benefit_value);
  end if;
  if v_row.max_discount_btn is not null then
    v_discount := least(v_discount, v_row.max_discount_btn);
  end if;
  v_discount := greatest(0, v_discount);
  v_post := greatest(0, round(p_pre_discount_btn - v_discount, 2));

  update promo_codes
  set redeemed_count = redeemed_count + 1,
      updated_at = v_now
  where id = v_row.id;

  insert into promo_redemptions (
    property_id,
    promo_code_id,
    booking_id,
    order_id,
    folio_id,
    guest_key,
    channel,
    applies_domain,
    pre_discount_btn,
    discount_btn,
    post_discount_btn,
    created_by
  ) values (
    p_property_id,
    v_row.id,
    p_booking_id,
    p_order_id,
    p_folio_id,
    p_guest_key,
    p_channel,
    p_domain,
    p_pre_discount_btn,
    v_discount,
    v_post,
    coalesce(nullif(trim(p_created_by), ''), 'desk')
  )
  returning id into v_redemption_id;

  return jsonb_build_object(
    'ok', true,
    'promo_code_id', v_row.id,
    'code', v_row.code,
    'redemption_id', v_redemption_id,
    'discount_btn', v_discount,
    'post_discount_btn', v_post,
    'benefit_type', v_row.benefit_type,
    'benefit_value', v_row.benefit_value,
    'redeemed_count', v_row.redeemed_count + 1,
    'max_redemptions', v_row.max_redemptions,
    'stackable_with_partner', v_row.stackable_with_partner
  );
end;
$$;

revoke all on function redeem_promo_code(
  uuid, text, text, text, numeric, text, uuid, uuid, uuid, int, text, boolean
) from public;
grant execute on function redeem_promo_code(
  uuid, text, text, text, numeric, text, uuid, uuid, uuid, int, text, boolean
) to service_role;

-- Preview (no mutation) for desk quote / cart
create or replace function preview_promo_code(
  p_property_id uuid,
  p_code text,
  p_channel text,
  p_domain text,
  p_pre_discount_btn numeric,
  p_guest_key text default null,
  p_min_nights int default 0,
  p_stack_partner boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(p_code));
  v_row promo_codes%rowtype;
  v_now timestamptz := now();
  v_discount numeric(12, 2);
  v_post numeric(12, 2);
  v_guest_count int;
begin
  if v_code is null or v_code = '' then
    return jsonb_build_object('ok', false, 'error', 'Promo code is required.');
  end if;

  select * into v_row
  from promo_codes
  where property_id = p_property_id
    and code = v_code;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Promo code not found.');
  end if;
  if not v_row.active then
    return jsonb_build_object('ok', false, 'error', 'Promo code is inactive.');
  end if;
  if v_row.starts_at is not null and v_now < v_row.starts_at then
    return jsonb_build_object('ok', false, 'error', 'Promo code is not active yet.');
  end if;
  if v_row.ends_at is not null and v_now > v_row.ends_at then
    return jsonb_build_object('ok', false, 'error', 'Promo code has expired.');
  end if;
  if v_row.max_redemptions is not null
     and v_row.redeemed_count >= v_row.max_redemptions then
    return jsonb_build_object('ok', false, 'error', 'Promo code redemption limit reached.');
  end if;
  if not (p_channel = any (v_row.channels)) then
    return jsonb_build_object('ok', false, 'error', 'Promo code not valid on this channel.');
  end if;
  if not (p_domain = any (v_row.applies_to)) then
    return jsonb_build_object('ok', false, 'error', 'Promo code not valid for this product.');
  end if;
  if p_pre_discount_btn < coalesce(v_row.min_spend_btn, 0) then
    return jsonb_build_object('ok', false, 'error', 'Minimum spend not met.');
  end if;
  if coalesce(p_min_nights, 0) < coalesce(v_row.min_nights, 0) then
    return jsonb_build_object('ok', false, 'error', 'Minimum nights not met.');
  end if;
  if p_stack_partner and not v_row.stackable_with_partner then
    return jsonb_build_object('ok', false, 'error', 'Promo cannot stack with partner discount.');
  end if;

  if p_guest_key is not null and v_row.max_per_guest is not null then
    select count(*)::int into v_guest_count
    from promo_redemptions
    where promo_code_id = v_row.id
      and guest_key = p_guest_key;
    if v_guest_count >= v_row.max_per_guest then
      return jsonb_build_object('ok', false, 'error', 'Guest already used this promo.');
    end if;
  end if;

  if v_row.benefit_type = 'pct' then
    v_discount := round(p_pre_discount_btn * (least(100, v_row.benefit_value) / 100.0), 2);
  else
    v_discount := least(p_pre_discount_btn, v_row.benefit_value);
  end if;
  if v_row.max_discount_btn is not null then
    v_discount := least(v_discount, v_row.max_discount_btn);
  end if;
  v_discount := greatest(0, v_discount);
  v_post := greatest(0, round(p_pre_discount_btn - v_discount, 2));

  return jsonb_build_object(
    'ok', true,
    'promo_code_id', v_row.id,
    'code', v_row.code,
    'discount_btn', v_discount,
    'post_discount_btn', v_post,
    'benefit_type', v_row.benefit_type,
    'benefit_value', v_row.benefit_value,
    'redeemed_count', v_row.redeemed_count,
    'max_redemptions', v_row.max_redemptions,
    'stackable_with_partner', v_row.stackable_with_partner,
    'campaign_id', v_row.campaign_id
  );
end;
$$;

revoke all on function preview_promo_code(
  uuid, text, text, text, numeric, text, int, boolean
) from public;
grant execute on function preview_promo_code(
  uuid, text, text, text, numeric, text, int, boolean
) to service_role;

-- ---------------------------------------------------------------------------
-- Seed default NC reasons for each property
-- ---------------------------------------------------------------------------
insert into nc_reason_codes (property_id, code, label, domains, requires_role, sort_order)
select p.id, s.code, s.label, s.domains, s.requires_role, s.sort_order
from properties p
cross join (
  values
    ('owner_house', 'Owner / house use', array['room', 'pos']::text[], 'owner', 10),
    ('media', 'Media / influencer', array['room', 'pos']::text[], 'manager', 20),
    ('staff_meal', 'Staff meal', array['pos']::text[], 'supervisor', 30),
    ('service_recovery', 'Service recovery', array['pos', 'room', 'spa', 'laundry', 'guest_service']::text[], 'manager', 40),
    ('marketing_tasting', 'Marketing tasting', array['pos']::text[], 'manager', 50),
    ('fam_trip', 'FAM / training stay', array['room', 'pos']::text[], 'manager', 60)
) as s(code, label, domains, requires_role, sort_order)
on conflict (property_id, code) do nothing;
