-- Guest laundry: private intake, staff chain of custody, and folio billing.

create table if not exists laundry_catalog_items (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  category text not null default 'clothing',
  unit_label text not null default 'piece',
  price_btn numeric(12,2) not null check (price_btn >= 0),
  gst_applicable boolean not null default true,
  turnaround_hours integer not null default 24 check (turnaround_hours between 1 and 168),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, name)
);

create table if not exists laundry_guest_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  property_id uuid not null references properties(id) on delete cascade,
  booking_id uuid not null references bookings(id) on delete cascade,
  room_unit_id uuid not null references room_units(id) on delete cascade,
  guest_name text not null,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists laundry_access_attempts (
  id bigint generated always as identity primary key,
  identifier_hash text not null,
  success boolean not null default false,
  attempted_at timestamptz not null default now()
);

create table if not exists laundry_orders (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  booking_id uuid not null references bookings(id) on delete restrict,
  room_unit_id uuid not null references room_units(id) on delete restrict,
  folio_id uuid references folios(id) on delete set null,
  folio_line_id uuid unique references folio_lines(id) on delete set null,
  guest_name text not null,
  room_label_snapshot text not null,
  source text not null check (source = any (array[
    'guest'::text, 'front_desk'::text, 'staff'::text
  ])),
  status text not null default 'requested' check (status = any (array[
    'requested'::text, 'received'::text, 'washing'::text, 'drying'::text,
    'ironing'::text, 'quality_check'::text, 'ready'::text,
    'delivered'::text, 'exception'::text, 'cancelled'::text
  ])),
  assigned_staff_id uuid references staff_members(id) on delete set null,
  requested_notes text,
  condition_notes text,
  exception_notes text,
  intake_photo_public_ids text[] not null default '{}',
  completion_photo_public_ids text[] not null default '{}',
  subtotal_btn numeric(12,2),
  service_charge_rate numeric(8,6),
  service_charge_btn numeric(12,2),
  gst_rate numeric(8,6),
  gst_btn numeric(12,2),
  total_btn numeric(12,2),
  requested_at timestamptz not null default now(),
  received_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  billed_at timestamptz,
  billed_by uuid references staff_members(id) on delete set null,
  created_by_staff_id uuid references staff_members(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists laundry_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references laundry_orders(id) on delete cascade,
  catalog_item_id uuid not null references laundry_catalog_items(id) on delete restrict,
  name_snapshot text not null,
  unit_label_snapshot text not null,
  requested_qty integer not null check (requested_qty between 1 and 200),
  confirmed_qty integer check (confirmed_qty between 0 and 200),
  unit_price_btn numeric(12,2),
  gst_applicable boolean,
  line_total_btn numeric(12,2),
  created_at timestamptz not null default now(),
  unique (order_id, catalog_item_id)
);

create table if not exists laundry_order_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  order_id uuid not null references laundry_orders(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  notes text,
  photo_public_ids text[] not null default '{}',
  actor_kind text not null check (actor_kind = any (array[
    'guest'::text, 'front_desk'::text, 'staff'::text, 'system'::text
  ])),
  actor_staff_id uuid references staff_members(id) on delete set null,
  client_event_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists laundry_events_client_event_uidx
  on laundry_order_events (order_id, client_event_id)
  where client_event_id is not null;
create index if not exists laundry_catalog_property_idx
  on laundry_catalog_items (property_id, is_active, sort_order);
create index if not exists laundry_sessions_booking_idx
  on laundry_guest_sessions (booking_id, expires_at desc);
create index if not exists laundry_sessions_room_idx
  on laundry_guest_sessions (room_unit_id, expires_at desc);
create index if not exists laundry_attempts_rate_idx
  on laundry_access_attempts (identifier_hash, attempted_at desc);
create index if not exists laundry_orders_board_idx
  on laundry_orders (property_id, status, requested_at desc);
create index if not exists laundry_orders_booking_idx
  on laundry_orders (booking_id, requested_at desc);
create index if not exists laundry_orders_room_idx
  on laundry_orders (room_unit_id, requested_at desc);
create index if not exists laundry_orders_staff_idx
  on laundry_orders (assigned_staff_id, status, requested_at);
create index if not exists laundry_orders_billed_by_idx
  on laundry_orders (billed_by) where billed_by is not null;
create index if not exists laundry_orders_created_by_idx
  on laundry_orders (created_by_staff_id) where created_by_staff_id is not null;
create index if not exists laundry_items_catalog_idx
  on laundry_order_items (catalog_item_id);
create index if not exists laundry_events_order_idx
  on laundry_order_events (order_id, created_at);
create index if not exists laundry_events_staff_idx
  on laundry_order_events (actor_staff_id) where actor_staff_id is not null;

alter table laundry_catalog_items enable row level security;
alter table laundry_guest_sessions enable row level security;
alter table laundry_access_attempts enable row level security;
alter table laundry_orders enable row level security;
alter table laundry_order_items enable row level security;
alter table laundry_order_events enable row level security;

create or replace function is_laundry_staff(p_property_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from staff_members s
    where s.auth_user_id = auth.uid()
      and s.property_id = p_property_id
      and s.can_login
      and s.status in ('active', 'on_leave')
      and (
        lower(coalesce(s.department, '')) in ('laundry', 'housekeeping')
        or lower(s.role_label) in ('laundry', 'housekeeping', 'laundry maid')
        or s.access_level in ('supervisor', 'hr_admin', 'owner')
      )
  );
$$;

revoke all on function is_laundry_staff(uuid) from public;
grant execute on function is_laundry_staff(uuid) to authenticated, service_role;

create policy "service role laundry catalog" on laundry_catalog_items
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "service role laundry sessions" on laundry_guest_sessions
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "service role laundry attempts" on laundry_access_attempts
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "service role laundry orders" on laundry_orders
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "service role laundry items" on laundry_order_items
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
create policy "service role laundry events" on laundry_order_events
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "laundry staff read catalog" on laundry_catalog_items
  for select to authenticated using (is_laundry_staff(property_id));
create policy "laundry staff read orders" on laundry_orders
  for select to authenticated using (is_laundry_staff(property_id));
create policy "laundry staff read items" on laundry_order_items
  for select to authenticated using (
    exists (
      select 1 from laundry_orders o
      where o.id = order_id and is_laundry_staff(o.property_id)
    )
  );
create policy "laundry staff read events" on laundry_order_events
  for select to authenticated using (is_laundry_staff(property_id));

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
  v_line_id uuid;
  v_subtotal numeric(12,2);
  v_gst_base numeric(12,2);
  v_service numeric(12,2);
  v_gst numeric(12,2);
  v_total numeric(12,2);
begin
  select * into v_order from laundry_orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'Laundry order not found'; end if;
  if v_order.folio_line_id is not null then
    return jsonb_build_object('folio_line_id', v_order.folio_line_id, 'total_btn', v_order.total_btn);
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

  v_service := round(v_subtotal *
    case when coalesce(v_property.service_charge_default_on, false)
      then coalesce(v_property.service_charge_rate, 0) else 0 end, 2);
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

  insert into folio_lines (
    folio_id, booking_id, source_type, source_id, description, qty,
    unit_price_btn, amount_btn, service_charge_rate, service_charge_btn,
    service_charge_applied, gst_applicable, gst_btn, total_btn, status
  ) values (
    v_folio_id, v_order.booking_id, 'guest_service', v_order.id,
    'Laundry · Room ' || v_order.room_label_snapshot, 1,
    v_subtotal, v_subtotal,
    case when coalesce(v_property.service_charge_default_on, false)
      then coalesce(v_property.service_charge_rate, 0) else 0 end,
    v_service, coalesce(v_property.service_charge_default_on, false),
    v_gst > 0, v_gst, v_total, 'posted'
  ) returning id into v_line_id;

  update laundry_orders
  set folio_id = v_folio_id, folio_line_id = v_line_id,
      status = 'received', received_at = coalesce(received_at, now()),
      subtotal_btn = v_subtotal,
      service_charge_rate = case when coalesce(v_property.service_charge_default_on, false)
        then coalesce(v_property.service_charge_rate, 0) else 0 end,
      service_charge_btn = v_service,
      gst_rate = coalesce(v_property.gst_rate, 0.07),
      gst_btn = v_gst, total_btn = v_total, billed_at = now(),
      billed_by = p_staff_id, assigned_staff_id = coalesce(assigned_staff_id, p_staff_id),
      updated_at = now()
  where id = p_order_id;

  insert into laundry_order_events (
    property_id, order_id, event_type, from_status, to_status,
    notes, actor_kind, actor_staff_id
  ) values (
    v_order.property_id, p_order_id, 'receipt_confirmed',
    v_order.status, 'received', 'Counts confirmed and folio charged',
    'staff', p_staff_id
  );
  return jsonb_build_object('folio_line_id', v_line_id, 'total_btn', v_total);
end;
$$;

revoke all on function laundry_confirm_receipt(uuid, uuid) from public, anon, authenticated;
grant execute on function laundry_confirm_receipt(uuid, uuid) to service_role;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'laundry_orders'
  ) then alter publication supabase_realtime add table laundry_orders; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'laundry_order_events'
  ) then alter publication supabase_realtime add table laundry_order_events; end if;
end $$;

comment on table laundry_guest_sessions is
  'Opaque, short-lived guest capability sessions; raw tokens are never stored.';
