-- Check-in room allocation: occupants, multi-guest rooming, atomic desk RPCs.
-- Physical rooms (guest + guide/driver comps) can be confirmed at check-in with
-- HK readiness gates. Checkout marks vacated units dirty without deleting history.

-- ---------------------------------------------------------------------------
-- Rooming: link guests to physical assignments
-- ---------------------------------------------------------------------------
alter table booking_guests
  add column if not exists room_assignment_id uuid
    references room_assignments(id) on delete set null;

alter table booking_guests
  add column if not exists sort_order integer not null default 0;

create index if not exists booking_guests_assignment_idx
  on booking_guests (room_assignment_id)
  where room_assignment_id is not null;

create index if not exists booking_guests_booking_sort_idx
  on booking_guests (booking_id, sort_order);

-- Guide/driver occupant labels on an assignment (when not a booking_guest row)
create table if not exists room_assignment_occupants (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  assignment_id uuid not null references room_assignments(id) on delete cascade,
  booking_id uuid not null references bookings(id) on delete cascade,
  occupant_kind text not null
    check (occupant_kind = any (array[
      'guest'::text,
      'guide'::text,
      'driver'::text
    ])),
  booking_guest_id uuid references booking_guests(id) on delete set null,
  display_name text not null,
  created_at timestamptz not null default now(),
  unique (assignment_id, occupant_kind, display_name)
);

create index if not exists room_assignment_occupants_booking_idx
  on room_assignment_occupants (booking_id);

create index if not exists room_assignment_occupants_property_idx
  on room_assignment_occupants (property_id);

alter table room_assignment_occupants enable row level security;

drop policy if exists "service_role full room_assignment_occupants" on room_assignment_occupants;
create policy "service_role full room_assignment_occupants" on room_assignment_occupants
  for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Apply physical rooms at check-in (validates readiness + demand)
-- ---------------------------------------------------------------------------
create or replace function desk_apply_check_in_rooms(
  p_property_id uuid,
  p_booking_id uuid,
  p_unit_ids uuid[],
  p_require_clean boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking record;
  v_unit record;
  v_line record;
  v_needed int;
  v_have int;
  v_assigned int := 0;
  v_unit_id uuid;
  v_demand jsonb := '{}'::jsonb;
  v_filled jsonb := '{}'::jsonb;
  v_key text;
begin
  select id, property_id, status, check_in, check_out
    into v_booking
  from bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking not found.';
  end if;
  if v_booking.property_id is distinct from p_property_id then
    raise exception 'Booking is not at this property.';
  end if;
  if v_booking.status not in ('pending', 'confirmed') then
    raise exception 'Cannot assign rooms for status %.', v_booking.status;
  end if;
  if p_unit_ids is null or cardinality(p_unit_ids) = 0 then
    raise exception 'Select at least one physical room.';
  end if;

  -- Demand by (room_type_id, inventory_kind)
  for v_line in
    select room_type_id, inventory_kind, sum(qty)::int as qty
    from booking_rooms
    where booking_id = p_booking_id
    group by room_type_id, inventory_kind
  loop
    v_key := v_line.room_type_id::text || ':' || v_line.inventory_kind;
    v_demand := v_demand || jsonb_build_object(v_key, v_line.qty);
  end loop;

  if v_demand = '{}'::jsonb then
    raise exception 'Booking has no room lines to assign.';
  end if;

  -- Replace all prior assignments for this booking at check-in confirm.
  delete from room_assignment_occupants where booking_id = p_booking_id;

  update booking_guests
     set room_assignment_id = null
   where booking_id = p_booking_id;

  delete from room_assignments
  where booking_id = p_booking_id;

  v_filled := '{}'::jsonb;
  v_assigned := 0;

  foreach v_unit_id in array p_unit_ids
  loop
    select ru.id, ru.room_type_id, ru.hk_status, ru.label, rt.inventory_kind
      into v_unit
    from room_units ru
    join room_types rt on rt.id = ru.room_type_id
    where ru.id = v_unit_id
      and ru.property_id = p_property_id
    for update of ru;

    if not found then
      raise exception 'Room unit % is not at this property.', v_unit_id;
    end if;

    if p_require_clean and v_unit.inventory_kind = 'sellable_guest'
       and v_unit.hk_status not in ('clean', 'inspect', 'occupied') then
      raise exception 'Room % is not ready (status: %).', v_unit.label, v_unit.hk_status;
    end if;

    if exists (
      select 1 from room_blocks rb
      where rb.room_unit_id = v_unit_id
        and rb.property_id = p_property_id
        and rb.released_at is null
        and rb.from_date < v_booking.check_out
        and rb.to_date > v_booking.check_in
    ) then
      raise exception 'Room % is blocked for these dates.', v_unit.label;
    end if;

    if exists (
      select 1 from room_assignments ra
      where ra.room_unit_id = v_unit_id
        and ra.property_id = p_property_id
        and ra.from_date < v_booking.check_out
        and ra.to_date > v_booking.check_in
    ) then
      raise exception 'Room % is already assigned for these dates.', v_unit.label;
    end if;

    v_key := v_unit.room_type_id::text || ':' || v_unit.inventory_kind;
    v_needed := coalesce((v_demand ->> v_key)::int, 0);
    v_have := coalesce((v_filled ->> v_key)::int, 0);
    if v_have >= v_needed then
      raise exception 'Too many rooms of type % (%).', v_unit.label, v_unit.inventory_kind;
    end if;

    insert into room_assignments (
      property_id, booking_id, room_unit_id, from_date, to_date, is_locked
    ) values (
      p_property_id, p_booking_id, v_unit_id,
      v_booking.check_in, v_booking.check_out, true
    );

    update room_units
       set hk_status = 'occupied',
           updated_at = now()
     where id = v_unit_id;

    v_filled := v_filled || jsonb_build_object(v_key, v_have + 1);
    v_assigned := v_assigned + 1;
  end loop;

  -- Ensure demand fully met
  for v_key in select jsonb_object_keys(v_demand)
  loop
    v_needed := (v_demand ->> v_key)::int;
    v_have := coalesce((v_filled ->> v_key)::int, 0);
    if v_have < v_needed then
      raise exception 'Missing % room assignment(s) for %.', v_needed - v_have, v_key;
    end if;
  end loop;

  return jsonb_build_object(
    'assigned', v_assigned,
    'booking_id', p_booking_id
  );
end;
$$;

revoke all on function desk_apply_check_in_rooms(uuid, uuid, uuid[], boolean) from public, anon, authenticated;
grant execute on function desk_apply_check_in_rooms(uuid, uuid, uuid[], boolean) to service_role;

-- ---------------------------------------------------------------------------
-- Checkout: mark assigned units dirty; keep assignment history
-- ---------------------------------------------------------------------------
create or replace function desk_release_check_out_rooms(
  p_property_id uuid,
  p_booking_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int := 0;
begin
  if not exists (
    select 1 from bookings
    where id = p_booking_id and property_id = p_property_id
  ) then
    raise exception 'Booking not found.';
  end if;

  update room_units ru
     set hk_status = 'dirty',
         updated_at = now()
   where ru.property_id = p_property_id
     and ru.id in (
       select ra.room_unit_id
       from room_assignments ra
       where ra.booking_id = p_booking_id
         and ra.property_id = p_property_id
     )
     and ru.hk_status = 'occupied';

  get diagnostics v_count = row_count;

  return jsonb_build_object('dirty_units', v_count, 'booking_id', p_booking_id);
end;
$$;

revoke all on function desk_release_check_out_rooms(uuid, uuid) from public, anon, authenticated;
grant execute on function desk_release_check_out_rooms(uuid, uuid) to service_role;
