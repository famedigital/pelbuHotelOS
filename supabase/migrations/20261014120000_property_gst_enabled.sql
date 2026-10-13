-- Hotel-wide GST switch. Service charge stays on its own columns.
-- Off means rooms, menu, and services post no GST. The rate is kept for when GST is turned back on.

alter table properties
  add column if not exists gst_enabled boolean not null default true;

comment on column properties.gst_enabled is
  'When false, rooms, menu, and services post no GST. Service charge is unchanged.';

-- Properties already at 0% (Pelbu Suites Olakha) are not GST-registered yet.
update properties
set gst_enabled = false
where gst_rate = 0;

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
  v_gst_rate numeric(8,6);
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
  v_gst_rate := case
    when coalesce(v_property.gst_enabled, true) then coalesce(v_property.gst_rate, 0.07)
    else 0
  end;
  v_gst := round((v_gst_base +
    case when v_subtotal > 0 then v_service * (v_gst_base / v_subtotal) else 0 end
  ) * v_gst_rate, 2);
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
        gst_rate = v_gst_rate,
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
      gst_rate = v_gst_rate,
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
