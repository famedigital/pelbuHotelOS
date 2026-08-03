-- Selective danger-zone wipe: ops always + optional master-data flags.
-- Preserves laundry fix (order_id, not laundry_order_id).
-- Flags default false; ops wipe always runs.
-- Optional: rooms, staff, menu, agents, rates, rota, attendance, leave.

drop function if exists public.wipe_property_operational_data(uuid);
drop function if exists public.wipe_property_operational_data(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean
);

create or replace function public.wipe_property_operational_data(
  p_property_id uuid,
  p_wipe_rooms boolean default false,
  p_wipe_staff boolean default false,
  p_wipe_menu boolean default false,
  p_wipe_agents boolean default false,
  p_wipe_rates boolean default false,
  p_wipe_rota boolean default false,
  p_wipe_attendance boolean default false,
  p_wipe_leave boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_counts jsonb := '{}'::jsonb;
  v_n int;
  v_staff boolean := coalesce(p_wipe_staff, false);
  v_rooms boolean := coalesce(p_wipe_rooms, false);
  v_menu boolean := coalesce(p_wipe_menu, false);
  v_agents boolean := coalesce(p_wipe_agents, false);
  v_rates boolean := coalesce(p_wipe_rates, false);
  v_rota boolean := coalesce(p_wipe_rota, false);
  v_attendance boolean := coalesce(p_wipe_attendance, false);
  v_leave boolean := coalesce(p_wipe_leave, false);
begin
  if p_property_id is null then
    raise exception 'property_id required';
  end if;

  -- Always: operational wipe. Laundry children use order_id.
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

  delete from order_tenders ot
  using orders o where ot.order_id = o.id and o.property_id = p_property_id;
  delete from order_items oi
  using orders o where oi.order_id = o.id and o.property_id = p_property_id;
  delete from pos_voids where property_id = p_property_id;
  delete from orders where property_id = p_property_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('orders', v_n);

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

  delete from lost_found_items where property_id = p_property_id;
  delete from inhouse_tasks where property_id = p_property_id;
  delete from room_blocks where property_id = p_property_id;
  delete from kitchen_events where property_id = p_property_id;

  -- HK assignments block staff/rooms (RESTRICT) — always clear on ops wipe
  delete from hk_assignments where property_id = p_property_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('hk_assignments', v_n);

  delete from night_audits where property_id = p_property_id;
  delete from expenses where property_id = p_property_id;

  delete from guest_loyalty_ledger where property_id = p_property_id;
  update guest_loyalty_accounts
  set points_balance = 0
  where property_id = p_property_id;

  delete from agent_credit_ledger where property_id = p_property_id;

  delete from ari_queue where property_id = p_property_id;
  delete from channel_booking_revisions where property_id = p_property_id;

  delete from room_assignment_moves where property_id = p_property_id;
  delete from room_assignments where property_id = p_property_id;

  delete from folio_lines fl
  using folios f
  where fl.folio_id = f.id and f.property_id = p_property_id;

  delete from fiscal_documents where property_id = p_property_id;
  delete from payments where property_id = p_property_id;
  delete from payment_links where property_id = p_property_id;
  delete from folios where property_id = p_property_id;

  delete from bookings where property_id = p_property_id;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('bookings', v_n);

  -- Attendance
  if v_attendance or v_staff then
    delete from staff_attendance_events where property_id = p_property_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('staff_attendance_events', v_n);
  end if;

  if v_attendance then
    delete from attendance_devices where property_id = p_property_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('attendance_devices', v_n);
  end if;

  -- Leave (ledger RESTRICT → clear before staff_leave / staff)
  if v_leave or v_staff then
    delete from hr_leave_ledger where property_id = p_property_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('hr_leave_ledger', v_n);

    delete from hr_leave_attachments where property_id = p_property_id;

    delete from hr_leave_balances where property_id = p_property_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('hr_leave_balances', v_n);

    delete from staff_leave where property_id = p_property_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('staff_leave', v_n);
  end if;

  if v_leave then
    delete from hr_leave_blackouts where property_id = p_property_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('hr_leave_blackouts', v_n);
  end if;

  -- Rota
  if v_rota or v_staff then
    delete from staff_shifts where property_id = p_property_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('staff_shifts', v_n);

    if v_rota then
      delete from rota_cover_templates where property_id = p_property_id;
      get diagnostics v_n = row_count;
      v_counts := v_counts || jsonb_build_object('rota_cover_templates', v_n);
    end if;
  end if;

  -- Staff (preserve owners: desk_role or access_level = owner)
  if v_staff then
    delete from staff_employment_events see
    using staff_members sm
    where see.staff_id = sm.id
      and sm.property_id = p_property_id
      and coalesce(sm.desk_role, '') is distinct from 'owner'
      and coalesce(sm.access_level, '') is distinct from 'owner';

    delete from payroll_run_items pri
    using staff_members sm
    where pri.staff_id = sm.id
      and sm.property_id = p_property_id
      and coalesce(sm.desk_role, '') is distinct from 'owner'
      and coalesce(sm.access_level, '') is distinct from 'owner';

    delete from payroll_adjustments pa
    using staff_members sm
    where pa.staff_id = sm.id
      and sm.property_id = p_property_id
      and coalesce(sm.desk_role, '') is distinct from 'owner'
      and coalesce(sm.access_level, '') is distinct from 'owner';

    delete from staff_documents sd
    using staff_members sm
    where sd.staff_id = sm.id
      and sm.property_id = p_property_id
      and coalesce(sm.desk_role, '') is distinct from 'owner'
      and coalesce(sm.access_level, '') is distinct from 'owner';

    delete from staff_pay_components spc
    using staff_members sm
    where spc.staff_id = sm.id
      and sm.property_id = p_property_id
      and coalesce(sm.desk_role, '') is distinct from 'owner'
      and coalesce(sm.access_level, '') is distinct from 'owner';

    delete from staff_conduct_records scr
    using staff_members sm
    where scr.staff_id = sm.id
      and sm.property_id = p_property_id
      and coalesce(sm.desk_role, '') is distinct from 'owner'
      and coalesce(sm.access_level, '') is distinct from 'owner';

    delete from staff_private_profiles spp
    using staff_members sm
    where spp.staff_id = sm.id
      and sm.property_id = p_property_id
      and coalesce(sm.desk_role, '') is distinct from 'owner'
      and coalesce(sm.access_level, '') is distinct from 'owner';

    update staff_members
    set manager_id = null
    where property_id = p_property_id
      and manager_id is not null;

    delete from staff_members
    where property_id = p_property_id
      and coalesce(desk_role, '') is distinct from 'owner'
      and coalesce(access_level, '') is distinct from 'owner';
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('staff_members', v_n);
  end if;

  -- Rooms (units only)
  if v_rooms then
    update room_units
    set connecting_room_unit_id = null
    where property_id = p_property_id
      and connecting_room_unit_id is not null;

    delete from room_amenity_pars where property_id = p_property_id;

    delete from room_units where property_id = p_property_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('room_units', v_n);
  else
    update room_units
    set hk_status = 'clean'
    where property_id = p_property_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('room_units_reset', v_n);
  end if;

  -- Menu catalog
  if v_menu then
    delete from menu_modifier_options mo
    using menu_modifier_groups mg
    where mo.group_id = mg.id and mg.property_id = p_property_id;

    delete from menu_modifier_groups where property_id = p_property_id;
    delete from menu_recipe_items where property_id = p_property_id;
    delete from menu_stock_profiles where property_id = p_property_id;

    delete from menu_items where property_id = p_property_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('menu_items', v_n);
  end if;

  -- Agents (property links + orphan agent rows)
  if v_agents then
    delete from agent_allotments where property_id = p_property_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('agent_allotments', v_n);

    delete from agent_documents where property_id = p_property_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('agent_documents', v_n);

    delete from agents a
    where not exists (select 1 from agent_allotments x where x.agent_id = a.id)
      and not exists (select 1 from agent_documents x where x.agent_id = a.id)
      and not exists (select 1 from agent_credit_ledger x where x.agent_id = a.id)
      and not exists (select 1 from bookings x where x.agent_id = a.id)
      and not exists (select 1 from booking_groups x where x.agent_id = a.id)
      and not exists (select 1 from payment_links x where x.agent_id = a.id);
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('agents', v_n);
  else
    update agents set credit_used = 0 where credit_used <> 0;
  end if;

  -- Rates / prices
  if v_rates then
    delete from rate_plans where property_id = p_property_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('rate_plans', v_n);

    delete from room_rates where property_id = p_property_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('room_rates', v_n);
  end if;

  if v_agents then
    update agents set credit_used = 0 where credit_used <> 0;
  end if;

  v_counts := v_counts || jsonb_build_object(
    'wiped_at', to_jsonb(now()),
    'flags', jsonb_build_object(
      'rooms', v_rooms,
      'staff', v_staff,
      'menu', v_menu,
      'agents', v_agents,
      'rates', v_rates,
      'rota', v_rota,
      'attendance', v_attendance,
      'leave', v_leave
    )
  );
  return v_counts;
end;
$$;

revoke all on function public.wipe_property_operational_data(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean
) from public, anon, authenticated;
grant execute on function public.wipe_property_operational_data(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean
) to service_role;

comment on function public.wipe_property_operational_data(
  uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean
) is
  'Owner danger-zone: always wipes ops (bookings/folios/orders/laundry/…). Optional: rooms, staff (non-owners), menu, agents, rates, rota, attendance, leave. Laundry uses order_id. Keeps owners, CMS, room_types, rate_tiers, leave policies.';
