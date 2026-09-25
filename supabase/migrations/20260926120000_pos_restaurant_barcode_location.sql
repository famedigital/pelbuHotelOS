-- Restaurant POS production: barcode + default F&B stock location for POS issues.

alter table inventory_items
  add column if not exists barcode text;

comment on column inventory_items.barcode is
  'Optional UPC/EAN/PLU for bar and packaged sell; unique per property when set.';

create unique index if not exists inventory_items_property_barcode_uidx
  on inventory_items (property_id, barcode)
  where barcode is not null and length(trim(barcode)) > 0;

alter table menu_items
  add column if not exists sell_barcode text;

comment on column menu_items.sell_barcode is
  'Optional sell-facing PLU/barcode for register scan (bar bottles, soft drinks).';

create unique index if not exists menu_items_property_sell_barcode_uidx
  on menu_items (property_id, sell_barcode)
  where sell_barcode is not null and length(trim(sell_barcode)) > 0;

alter table properties
  add column if not exists default_pos_stock_location_id uuid
    references inventory_locations (id) on delete set null;

comment on column properties.default_pos_stock_location_id is
  'F&B store location debited by pos_apply_order_stock when balances are used.';

alter table properties
  add column if not exists pos_require_stock_profile boolean not null default false;

comment on column properties.pos_require_stock_profile is
  'When true, refuse selling menu items still in untracked stock mode.';

-- Debit default F&B location balance alongside qty_on_hand when a location exists.
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
  v_location_id uuid;
  v_line record;
  v_req record;
  v_item inventory_items%rowtype;
  v_source_key text;
  v_delta numeric(12,3);
  v_issue_key text;
  v_next_bal numeric(12,3);
begin
  select property_id into v_property_id
  from orders
  where id = p_order_id;

  if v_property_id is null then
    raise exception 'Order not found';
  end if;

  select p.default_pos_stock_location_id into v_location_id
  from properties p
  where p.id = v_property_id;

  if v_location_id is null then
    select id into v_location_id
    from inventory_locations
    where property_id = v_property_id and code = 'STORE'
    limit 1;
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

      if v_location_id is not null then
        select qty_on_hand into v_next_bal
        from inventory_balances
        where item_id = v_item.id and location_id = v_location_id
        for update;

        if found then
          if v_next_bal + v_delta < 0 then
            raise exception
              'Insufficient stock at F&B location for % (available %, required %)',
              v_item.name, v_next_bal, v_req.required_qty;
          end if;
          update inventory_balances
          set qty_on_hand = qty_on_hand + v_delta,
              updated_at = now()
          where item_id = v_item.id and location_id = v_location_id;
        elsif v_delta > 0 then
          -- Restore path with no prior balance row — seed from restore qty.
          insert into inventory_balances (
            property_id, item_id, location_id, qty_on_hand, updated_at
          ) values (
            v_property_id, v_item.id, v_location_id, v_delta, now()
          );
        end if;
        -- Issue with no balance row: qty_on_hand remains source of truth (legacy).
      end if;

      insert into inventory_movements (
        property_id, item_id, movement_kind, qty_delta, unit_cost_btn,
        reference, notes, created_by, order_id, order_item_id, source_key,
        location_id
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
        v_source_key,
        v_location_id
      );
    end loop;
  end loop;
end;
$$;

revoke all on function pos_apply_order_stock(uuid, boolean) from public, anon, authenticated;
grant execute on function pos_apply_order_stock(uuid, boolean) to service_role;
