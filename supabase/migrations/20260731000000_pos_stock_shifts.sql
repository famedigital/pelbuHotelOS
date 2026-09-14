-- POS stock, purchased finished goods, recipes, cashier shifts, and guest refs.
-- Desk mutations use service_role; public reads remain through controlled loaders.

create table if not exists menu_stock_profiles (
  menu_item_id uuid primary key references menu_items(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  stock_mode text not null default 'untracked'
    check (stock_mode = any (array[
      'untracked'::text, 'finished_good'::text, 'recipe'::text
    ])),
  inventory_item_id uuid references inventory_items(id) on delete restrict,
  qty_per_sale numeric(12,3) not null default 1 check (qty_per_sale > 0),
  auto_disable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (stock_mode = 'finished_good' and inventory_item_id is not null)
    or (stock_mode <> 'finished_good')
  )
);

create table if not exists menu_recipe_items (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete restrict,
  qty_per_sale numeric(12,3) not null check (qty_per_sale > 0),
  created_at timestamptz not null default now(),
  unique (menu_item_id, inventory_item_id)
);

alter table inventory_movements
  add column if not exists order_id uuid references orders(id) on delete set null,
  add column if not exists order_item_id uuid references order_items(id) on delete set null,
  add column if not exists source_key text,
  add column if not exists batch_ref text,
  add column if not exists expires_on date;

create unique index if not exists inventory_movements_source_key_uidx
  on inventory_movements (source_key)
  where source_key is not null;

create index if not exists menu_stock_profiles_property_idx
  on menu_stock_profiles (property_id, stock_mode);
create index if not exists menu_recipe_items_menu_idx
  on menu_recipe_items (menu_item_id);
create index if not exists inventory_movements_order_idx
  on inventory_movements (order_id, order_item_id);

create table if not exists pos_shifts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  business_date date not null,
  status text not null default 'open'
    check (status = any (array['open'::text, 'closed'::text])),
  opening_float_btn numeric(12,2) not null default 0
    check (opening_float_btn >= 0),
  expected_cash_btn numeric(12,2),
  counted_cash_btn numeric(12,2),
  variance_btn numeric(12,2),
  tender_totals jsonb not null default '{}'::jsonb,
  void_total_btn numeric(12,2) not null default 0,
  opened_by uuid references staff_members(id) on delete set null,
  opened_by_name text not null default 'desk',
  opened_at timestamptz not null default now(),
  closed_by uuid references staff_members(id) on delete set null,
  closed_by_name text,
  manager_approved_by uuid references staff_members(id) on delete set null,
  closed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  check (
    (status = 'open' and closed_at is null)
    or (status = 'closed' and closed_at is not null)
  )
);

-- Small-property safety: one active drawer at a property. Historical shifts
-- remain unlimited, giving morning/evening closes plus a consolidated daily Z.
create unique index if not exists pos_shifts_one_open_per_property_uidx
  on pos_shifts (property_id)
  where status = 'open';
create index if not exists pos_shifts_business_date_idx
  on pos_shifts (property_id, business_date, opened_at);

alter table orders
  add column if not exists pos_shift_id uuid references pos_shifts(id) on delete set null,
  add column if not exists room_unit_id uuid references room_units(id) on delete set null,
  add column if not exists booking_guest_id uuid references booking_guests(id) on delete set null;

create index if not exists orders_pos_shift_idx on orders (pos_shift_id);
create index if not exists orders_room_guest_idx
  on orders (property_id, room_unit_id, booking_guest_id);

alter table menu_stock_profiles enable row level security;
alter table menu_recipe_items enable row level security;
alter table pos_shifts enable row level security;

drop policy if exists "service role menu stock profiles" on menu_stock_profiles;
create policy "service role menu stock profiles" on menu_stock_profiles
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role menu recipe items" on menu_recipe_items;
create policy "service role menu recipe items" on menu_recipe_items
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role pos shifts" on pos_shifts;
create policy "service role pos shifts" on pos_shifts
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Atomically deduct or restore stock for an order. Idempotency is enforced by
-- inventory_movements.source_key. Concurrent sales serialize on inventory rows.
create or replace function pos_apply_order_stock(
  p_order_id uuid,
  p_reverse boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_property_id uuid;
  v_line record;
  v_req record;
  v_item inventory_items%rowtype;
  v_source_key text;
  v_delta numeric(12,3);
  v_issue_key text;
begin
  select property_id into v_property_id
  from orders
  where id = p_order_id;

  if v_property_id is null then
    raise exception 'Order not found';
  end if;

  for v_line in
    select oi.id, oi.menu_item_id, oi.qty
    from order_items oi
    where oi.order_id = p_order_id
      and oi.voided_at is null
      and oi.menu_item_id is not null
  loop
    for v_req in
      select
        msp.inventory_item_id,
        (v_line.qty * msp.qty_per_sale)::numeric(12,3) as required_qty
      from menu_stock_profiles msp
      where msp.menu_item_id = v_line.menu_item_id
        and msp.property_id = v_property_id
        and msp.stock_mode = 'finished_good'

      union all

      select
        mri.inventory_item_id,
        (v_line.qty * mri.qty_per_sale)::numeric(12,3) as required_qty
      from menu_stock_profiles msp
      join menu_recipe_items mri on mri.menu_item_id = msp.menu_item_id
      where msp.menu_item_id = v_line.menu_item_id
        and msp.property_id = v_property_id
        and msp.stock_mode = 'recipe'
    loop
      v_issue_key := 'pos:issue:' || v_line.id::text || ':' ||
        v_req.inventory_item_id::text;
      v_source_key := case when p_reverse
        then 'pos:restore:' || v_line.id::text || ':' ||
          v_req.inventory_item_id::text
        else v_issue_key
      end;

      if exists (
        select 1 from inventory_movements where source_key = v_source_key
      ) then
        continue;
      end if;

      -- Never restore a line that was not previously issued.
      if p_reverse and not exists (
        select 1 from inventory_movements where source_key = v_issue_key
      ) then
        continue;
      end if;

      select * into v_item
      from inventory_items
      where id = v_req.inventory_item_id
        and property_id = v_property_id
        and is_active
      for update;

      if v_item.id is null then
        raise exception 'Tracked inventory item is missing or inactive';
      end if;

      v_delta := case when p_reverse
        then v_req.required_qty
        else -v_req.required_qty
      end;

      if not p_reverse and v_item.qty_on_hand + v_delta < 0 then
        raise exception 'Insufficient stock for % (available %, required %)',
          v_item.name, v_item.qty_on_hand, v_req.required_qty;
      end if;

      update inventory_items
      set qty_on_hand = qty_on_hand + v_delta
      where id = v_item.id;

      insert into inventory_movements (
        property_id, item_id, movement_kind, qty_delta, unit_cost_btn,
        reference, notes, created_by, order_id, order_item_id, source_key
      ) values (
        v_property_id,
        v_item.id,
        case when p_reverse then 'adjust' else 'issue' end,
        v_delta,
        v_item.unit_cost_btn,
        'POS ' || left(p_order_id::text, 8),
        case when p_reverse then 'POS void stock restoration'
             else 'POS sale stock issue' end,
        'pos',
        p_order_id,
        v_line.id,
        v_source_key
      );
    end loop;
  end loop;
end;
$$;

revoke all on function pos_apply_order_stock(uuid, boolean) from public, anon, authenticated;
grant execute on function pos_apply_order_stock(uuid, boolean) to service_role;

create or replace function pos_apply_order_item_stock(
  p_order_item_id uuid,
  p_reverse boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line record;
  v_req record;
  v_item inventory_items%rowtype;
  v_source_key text;
  v_issue_key text;
  v_delta numeric(12,3);
begin
  select oi.id, oi.menu_item_id, oi.qty, o.id as order_id, o.property_id
    into v_line
  from order_items oi
  join orders o on o.id = oi.order_id
  where oi.id = p_order_item_id;
  if v_line.id is null then raise exception 'Order item not found'; end if;

  for v_req in
    select msp.inventory_item_id,
      (v_line.qty * msp.qty_per_sale)::numeric(12,3) required_qty
    from menu_stock_profiles msp
    where msp.menu_item_id = v_line.menu_item_id
      and msp.property_id = v_line.property_id
      and msp.stock_mode = 'finished_good'
    union all
    select mri.inventory_item_id,
      (v_line.qty * mri.qty_per_sale)::numeric(12,3) required_qty
    from menu_stock_profiles msp
    join menu_recipe_items mri on mri.menu_item_id = msp.menu_item_id
    where msp.menu_item_id = v_line.menu_item_id
      and msp.property_id = v_line.property_id
      and msp.stock_mode = 'recipe'
  loop
    v_issue_key := 'pos:issue:' || v_line.id::text || ':' ||
      v_req.inventory_item_id::text;
    v_source_key := case when p_reverse
      then 'pos:restore:' || v_line.id::text || ':' ||
        v_req.inventory_item_id::text
      else v_issue_key end;
    if exists (select 1 from inventory_movements where source_key = v_source_key)
    then continue; end if;
    if p_reverse and not exists (
      select 1 from inventory_movements where source_key = v_issue_key
    ) then continue; end if;

    select * into v_item from inventory_items
    where id = v_req.inventory_item_id and property_id = v_line.property_id
    for update;
    if v_item.id is null then raise exception 'Tracked inventory item missing'; end if;
    v_delta := case when p_reverse then v_req.required_qty
      else -v_req.required_qty end;
    if not p_reverse and v_item.qty_on_hand + v_delta < 0 then
      raise exception 'Insufficient stock for %', v_item.name;
    end if;
    update inventory_items set qty_on_hand = qty_on_hand + v_delta
    where id = v_item.id;
    insert into inventory_movements (
      property_id, item_id, movement_kind, qty_delta, unit_cost_btn,
      reference, notes, created_by, order_id, order_item_id, source_key
    ) values (
      v_line.property_id, v_item.id,
      case when p_reverse then 'adjust' else 'issue' end,
      v_delta, v_item.unit_cost_btn, 'POS ' || left(v_line.order_id::text, 8),
      case when p_reverse then 'POS line void stock restoration'
           else 'POS sale stock issue' end,
      'pos', v_line.order_id, v_line.id, v_source_key
    );
  end loop;
end;
$$;

revoke all on function pos_apply_order_item_stock(uuid, boolean)
  from public, anon, authenticated;
grant execute on function pos_apply_order_item_stock(uuid, boolean)
  to service_role;

create or replace function pos_receive_menu_stock(
  p_menu_item_id uuid,
  p_qty numeric,
  p_unit_cost_btn numeric default null,
  p_reference text default null,
  p_batch_ref text default null,
  p_expires_on date default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile menu_stock_profiles%rowtype;
  v_item inventory_items%rowtype;
  v_next numeric(12,3);
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Received quantity must be greater than zero';
  end if;

  select * into v_profile
  from menu_stock_profiles
  where menu_item_id = p_menu_item_id
    and stock_mode = 'finished_good';

  if v_profile.inventory_item_id is null then
    raise exception 'Menu item is not linked to finished-goods inventory';
  end if;

  select * into v_item
  from inventory_items
  where id = v_profile.inventory_item_id
    and property_id = v_profile.property_id
    and is_active
  for update;

  if v_item.id is null then
    raise exception 'Inventory item is missing or inactive';
  end if;

  v_next := v_item.qty_on_hand + p_qty;
  update inventory_items
  set qty_on_hand = v_next,
      unit_cost_btn = coalesce(p_unit_cost_btn, unit_cost_btn)
  where id = v_item.id;

  insert into inventory_movements (
    property_id, item_id, movement_kind, qty_delta, unit_cost_btn,
    reference, notes, created_by, batch_ref, expires_on
  ) values (
    v_profile.property_id, v_item.id, 'receive', p_qty,
    coalesce(p_unit_cost_btn, v_item.unit_cost_btn),
    nullif(trim(p_reference), ''),
    'Purchased finished goods received for menu',
    'desk',
    nullif(trim(p_batch_ref), ''),
    p_expires_on
  );

  return v_next;
end;
$$;

revoke all on function pos_receive_menu_stock(
  uuid, numeric, numeric, text, text, date
) from public, anon, authenticated;
grant execute on function pos_receive_menu_stock(
  uuid, numeric, numeric, text, text, date
) to service_role;

comment on table menu_stock_profiles is
  'Menu stock policy: untracked, purchased finished good, or recipe.';
comment on table menu_recipe_items is
  'Ingredient quantities consumed per one sold menu item.';
comment on table pos_shifts is
  'Cashier drawer shifts; daily Z consolidates closed shifts by business_date.';
