-- Laundry billing via app gateway (postFolioCharge), not raw folio_lines in RPC.
-- RPC prices + ensures folio; TypeScript posts the charge and attaches folio_line_id.

create unique index if not exists folio_lines_laundry_source_uidx
  on folio_lines (source_id)
  where source_type = 'guest_service'
    and source_id is not null
    and status = 'posted'
    and reverses_line_id is null;

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
  'Prices laundry + ensures folio. App must post via postFolioCharge then attach folio_line_id.';
