-- Phase 6: owner danger-zone wipe RPC + order_items grant hygiene

-- ---------------------------------------------------------------------------
-- order_items: desk uses service_role only; revoke direct PostgREST access
-- ---------------------------------------------------------------------------
revoke all on table public.order_items from anon, authenticated;

comment on table public.order_items is
  'POS line items — service_role only via Next.js server actions.';

-- ---------------------------------------------------------------------------
-- Owner wipe: operational data only (keeps rooms, rates, policies, staff, CMS)
-- ---------------------------------------------------------------------------
create or replace function public.wipe_property_operational_data(p_property_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_counts jsonb := '{}'::jsonb;
  v_n int;
begin
  if p_property_id is null then
    raise exception 'property_id required';
  end if;

  -- Laundry custody (before bookings: laundry_orders.booking_id is ON DELETE RESTRICT)
  -- Column is order_id (not laundry_order_id) on bags/events/items.
  delete from laundry_bag_events where property_id = p_property_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('laundry_bag_events', v_n);

  delete from laundry_bag_items lbi
  using laundry_order_bags lob
  where lbi.bag_id = lob.id and lob.property_id = p_property_id;

  delete from laundry_order_bags where property_id = p_property_id;

  delete from laundry_order_events where property_id = p_property_id;

  delete from laundry_order_items loi
  using laundry_orders lo
  where loi.order_id = lo.id and lo.property_id = p_property_id;

  delete from laundry_orders where property_id = p_property_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('laundry_orders', v_n);

  delete from laundry_guest_sessions where property_id = p_property_id;

  -- POS / orders (voids cascade via order_id)
  delete from order_tenders ot
  using orders o where ot.order_id = o.id and o.property_id = p_property_id;
  delete from order_items oi
  using orders o where oi.order_id = o.id and o.property_id = p_property_id;
  delete from pos_voids where property_id = p_property_id;
  delete from orders where property_id = p_property_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('orders', v_n);

  -- Inventory operational
  delete from inventory_audit_lines ial
  using inventory_audits ia
  where ial.audit_id = ia.id and ia.property_id = p_property_id;
  delete from inventory_audits where property_id = p_property_id;

  delete from inventory_purchase_order_lines ipol
  using inventory_purchase_orders ipo
  where ipol.purchase_order_id = ipo.id and ipo.property_id = p_property_id;
  delete from inventory_purchase_orders where property_id = p_property_id;

  delete from inventory_movements where property_id = p_property_id;
  delete from inventory_balances where property_id = p_property_id;

  -- Lost & found, tasks, blocks
  delete from lost_found_items where property_id = p_property_id;
  delete from inhouse_tasks where property_id = p_property_id;
  delete from room_blocks where property_id = p_property_id;
  delete from kitchen_events where property_id = p_property_id;

  -- Night audit & finance operational
  delete from night_audits where property_id = p_property_id;
  delete from expenses where property_id = p_property_id;

  -- Loyalty ledger (keep account shells; reset balances)
  delete from guest_loyalty_ledger where property_id = p_property_id;
  update guest_loyalty_accounts
  set points_balance = 0
  where property_id = p_property_id;

  -- Agent credit movements for this property's bookings
  delete from agent_credit_ledger where property_id = p_property_id;

  -- Channel ops queue
  delete from ari_queue where property_id = p_property_id;
  delete from channel_booking_revisions where property_id = p_property_id;

  -- Room assignments before bookings
  delete from room_assignment_moves ram
  using room_assignments ra, bookings b
  where ram.assignment_id = ra.id and ra.booking_id = b.id
    and b.property_id = p_property_id;

  delete from room_assignments ra
  using bookings b
  where ra.booking_id = b.id and b.property_id = p_property_id;

  -- Folios & payments (before bookings)
  delete from folio_lines fl
  using folios f
  where fl.folio_id = f.id and f.property_id = p_property_id;

  delete from fiscal_documents where property_id = p_property_id;

  delete from payments where property_id = p_property_id;
  delete from payment_links where property_id = p_property_id;
  delete from folios where property_id = p_property_id;

  -- Bookings cascade guests/rooms/drivers
  delete from bookings where property_id = p_property_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('bookings', v_n);

  -- Reset room HK status (keep units)
  update room_units
  set hk_status = 'clean'
  where property_id = p_property_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('room_units_reset', v_n);

  -- Reset agent credit (ledger cleared above)
  update agents set credit_used = 0 where credit_used <> 0;

  v_counts := v_counts || jsonb_build_object('wiped_at', to_jsonb(now()));
  return v_counts;
end;
$$;

revoke all on function public.wipe_property_operational_data(uuid) from public, anon, authenticated;
grant execute on function public.wipe_property_operational_data(uuid) to service_role;

comment on function public.wipe_property_operational_data(uuid) is
  'Owner danger-zone: wipe bookings, folios, payments, orders, laundry, inventory movements/audits/POs, holds/blocks, lost-found. Keeps rooms, rates, meal plans, policies, damage catalog, compliance, staff, CMS, seasons.';
