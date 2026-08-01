-- Public walk-in laundry (name + phone, pay via deposit link; no in-house booking required).

alter table laundry_orders
  alter column booking_id drop not null,
  alter column room_unit_id drop not null;

alter table laundry_orders
  add column if not exists guest_phone text,
  add column if not exists payment_link_id uuid references payment_links(id) on delete set null;

alter table laundry_orders drop constraint if exists laundry_orders_source_check;
alter table laundry_orders add constraint laundry_orders_source_check
  check (source = any (array[
    'guest'::text,
    'front_desk'::text,
    'staff'::text,
    'walk_in'::text
  ]));

alter table laundry_orders drop constraint if exists laundry_orders_walk_in_contact_chk;
alter table laundry_orders add constraint laundry_orders_walk_in_contact_chk
  check (
    source <> 'walk_in'
    or (
      guest_name is not null
      and length(trim(guest_name)) > 0
      and guest_phone is not null
      and length(trim(guest_phone)) >= 8
    )
  );

alter table laundry_orders drop constraint if exists laundry_orders_guest_stay_chk;
alter table laundry_orders add constraint laundry_orders_guest_stay_chk
  check (
    source = 'walk_in'
    or (booking_id is not null and room_unit_id is not null)
  );

create index if not exists laundry_orders_payment_link_idx
  on laundry_orders (payment_link_id)
  where payment_link_id is not null;

create index if not exists laundry_orders_walk_in_idx
  on laundry_orders (property_id, source, requested_at desc)
  where source = 'walk_in';

-- Price walk-in orders without folio; in-house stays still return folio quote for postFolioCharge.
create or replace function laundry_confirm_receipt(
  p_order_id uuid,
  p_staff_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order laundry_orders%rowtype;
  v_property properties%rowtype;
  v_folio_id uuid;
  v_subtotal numeric(12,2);
  v_gst_base numeric(12,2);
  v_service numeric(12,2);
  v_gst numeric(12,2);
  v_total numeric(12,2);
  v_sc_rate numeric(8,6);
  v_sc_on boolean;
  v_link_status text;
begin
  select * into v_order from laundry_orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'Laundry order not found'; end if;
  if v_order.folio_line_id is not null then
    return jsonb_build_object(
      'folio_line_id', v_order.folio_line_id,
      'folio_id', v_order.folio_id,
      'total_btn', v_order.total_btn,
      'already_billed', true
    );
  end if;
  if v_order.status not in ('requested', 'received') then
    raise exception 'Laundry order cannot be confirmed in status %', v_order.status;
  end if;
  if not exists (
    select 1 from staff_members
    where id = p_staff_id and property_id = v_order.property_id
      and status in ('active', 'on_leave')
  ) then raise exception 'Staff member is not valid for this property'; end if;

  if not exists (
    select 1 from laundry_order_items
    where order_id = p_order_id and coalesce(confirmed_qty, requested_qty) > 0
  ) then raise exception 'Add at least one garment'; end if;

  update laundry_order_items li
  set name_snapshot = c.name,
      unit_label_snapshot = c.unit_label,
      confirmed_qty = coalesce(li.confirmed_qty, li.requested_qty),
      unit_price_btn = c.price_btn,
      gst_applicable = c.gst_applicable,
      line_total_btn = round(coalesce(li.confirmed_qty, li.requested_qty) * c.price_btn, 2)
  from laundry_catalog_items c
  where li.order_id = p_order_id
    and c.id = li.catalog_item_id
    and c.property_id = v_order.property_id
    and c.is_active;

  if exists (
    select 1 from laundry_order_items
    where order_id = p_order_id and unit_price_btn is null
  ) then raise exception 'One or more laundry prices are unavailable'; end if;

  select * into v_property from properties where id = v_order.property_id;
  select round(sum(line_total_btn), 2),
         round(sum(case when gst_applicable then line_total_btn else 0 end), 2)
    into v_subtotal, v_gst_base
  from laundry_order_items
  where order_id = p_order_id and confirmed_qty > 0;

  v_sc_on := coalesce(v_property.service_charge_default_on, false);
  v_sc_rate := case when v_sc_on then coalesce(v_property.service_charge_rate, 0) else 0 end;
  v_service := round(v_subtotal * v_sc_rate, 2);
  v_gst := round((v_gst_base +
    case when v_subtotal > 0 then v_service * (v_gst_base / v_subtotal) else 0 end
  ) * coalesce(v_property.gst_rate, 0.07), 2);
  v_total := round(v_subtotal + v_service + v_gst, 2);

  if v_order.source = 'walk_in' or v_order.booking_id is null then
    if v_order.payment_link_id is not null then
      select status into v_link_status
      from payment_links
      where id = v_order.payment_link_id;
      if v_link_status is distinct from 'paid' then
        raise exception 'Walk-in laundry payment is not confirmed yet. Mark the deposit link paid or collect cash at desk.';
      end if;
    end if;

    update laundry_orders
    set subtotal_btn = v_subtotal,
        service_charge_rate = v_sc_rate,
        service_charge_btn = v_service,
        gst_rate = coalesce(v_property.gst_rate, 0.07),
        gst_btn = v_gst,
        total_btn = v_total,
        status = 'received',
        received_at = coalesce(received_at, now()),
        billed_at = now(),
        billed_by = p_staff_id,
        assigned_staff_id = coalesce(assigned_staff_id, p_staff_id),
        updated_at = now()
    where id = p_order_id;

    insert into laundry_order_events (
      property_id, order_id, event_type, from_status, to_status,
      notes, actor_kind, actor_staff_id
    ) values (
      v_order.property_id, p_order_id, 'receipt_confirmed',
      v_order.status, 'received',
      'Walk-in counts confirmed (folio-less)',
      'staff', p_staff_id
    );

    return jsonb_build_object(
      'already_billed', true,
      'walk_in', true,
      'total_btn', v_total
    );
  end if;

  select id into v_folio_id from folios
  where booking_id = v_order.booking_id and property_id = v_order.property_id
    and status = 'open'
  order by created_at desc limit 1;
  if v_folio_id is null then
    insert into folios (property_id, booking_id, folio_type, label, status)
    values (v_order.property_id, v_order.booking_id, 'guest',
      'Guest ' || left(v_order.booking_id::text, 8), 'open')
    returning id into v_folio_id;
  end if;

  update laundry_orders
  set folio_id = v_folio_id,
      subtotal_btn = v_subtotal,
      service_charge_rate = v_sc_rate,
      service_charge_btn = v_service,
      gst_rate = coalesce(v_property.gst_rate, 0.07),
      gst_btn = v_gst,
      total_btn = v_total,
      assigned_staff_id = coalesce(assigned_staff_id, p_staff_id),
      updated_at = now()
  where id = p_order_id;

  return jsonb_build_object(
    'already_billed', false,
    'folio_id', v_folio_id,
    'booking_id', v_order.booking_id,
    'property_id', v_order.property_id,
    'amount_btn', v_subtotal,
    'unit_price_btn', v_subtotal,
    'service_charge_rate', v_sc_rate,
    'service_charge_btn', v_service,
    'service_charge_applied', v_sc_on,
    'gst_btn', v_gst,
    'total_btn', v_total,
    'description', 'Laundry · Room ' || v_order.room_label_snapshot
  );
end;
$$;

revoke all on function laundry_confirm_receipt(uuid, uuid) from public, anon, authenticated;
grant execute on function laundry_confirm_receipt(uuid, uuid) to service_role;

comment on function laundry_confirm_receipt(uuid, uuid) is
  'Prices laundry. In-house → folio quote for postFolioCharge. Walk-in → folio-less when payment link paid or desk cash.';
