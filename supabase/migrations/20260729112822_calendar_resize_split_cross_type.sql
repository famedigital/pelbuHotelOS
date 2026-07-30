-- Stay date resize, same-booking split, and cross-category room move (with
-- booking_rooms type patch). Rate confirmation is enforced in the app layer.

create or replace function public.resize_room_assignment_dates(
  p_property_id uuid,
  p_assignment_id uuid,
  p_from_date date,
  p_to_date date
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_assignment room_assignments%rowtype;
begin
  if p_to_date <= p_from_date then
    raise exception 'Check-out must be after check-in.';
  end if;

  select * into v_assignment
    from room_assignments
   where id = p_assignment_id
     and property_id = p_property_id
   for update;
  if not found then
    raise exception 'Room assignment was not found.';
  end if;
  if v_assignment.is_locked then
    raise exception 'Unlock this room assignment before resizing.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_assignment.booking_id::text, 0));

  if exists (
    select 1 from room_assignments ra
     where ra.room_unit_id = v_assignment.room_unit_id
       and ra.id <> p_assignment_id
       and daterange(ra.from_date, ra.to_date, '[)')
           && daterange(p_from_date, p_to_date, '[)')
  ) then
    raise exception 'Resized stay overlaps another booking on this room.';
  end if;

  update room_assignments
     set from_date = p_from_date,
         to_date = p_to_date
   where id = p_assignment_id;

  update bookings
     set check_in = p_from_date,
         check_out = p_to_date
   where id = v_assignment.booking_id
     and property_id = p_property_id;
end;
$$;

create or replace function public.split_room_assignment(
  p_property_id uuid,
  p_assignment_id uuid,
  p_split_date date,
  p_to_unit_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_assignment room_assignments%rowtype;
  v_from_type uuid;
  v_to_type uuid;
  v_new_id uuid;
begin
  select * into v_assignment
    from room_assignments
   where id = p_assignment_id
     and property_id = p_property_id
   for update;
  if not found then
    raise exception 'Room assignment was not found.';
  end if;
  if v_assignment.is_locked then
    raise exception 'Unlock this room assignment before splitting.';
  end if;
  if p_split_date <= v_assignment.from_date or p_split_date >= v_assignment.to_date then
    raise exception 'Split date must fall inside the stay.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_assignment.booking_id::text, 0));

  select room_type_id into v_from_type
    from room_units where id = v_assignment.room_unit_id;
  select room_type_id into v_to_type
    from room_units
   where id = p_to_unit_id
     and property_id = p_property_id;
  if v_to_type is null then
    raise exception 'Destination room was not found.';
  end if;
  if v_from_type is distinct from v_to_type then
    raise exception 'Split destination must stay in the same category. Use cross-category move for upgrades.';
  end if;

  if exists (
    select 1 from room_assignments ra
     where ra.room_unit_id = p_to_unit_id
       and daterange(ra.from_date, ra.to_date, '[)')
           && daterange(p_split_date, v_assignment.to_date, '[)')
  ) then
    raise exception 'Destination room is occupied after the split date.';
  end if;

  update room_assignments
     set to_date = p_split_date
   where id = p_assignment_id;

  insert into room_assignments (
    property_id, booking_id, room_unit_id, from_date, to_date
  )
  values (
    p_property_id,
    v_assignment.booking_id,
    p_to_unit_id,
    p_split_date,
    v_assignment.to_date
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;

create or replace function public.move_room_assignment_cross_type(
  p_property_id uuid,
  p_assignment_id uuid,
  p_to_unit_id uuid,
  p_rate_decision text,
  p_override_amount_btn numeric default null,
  p_override_reason text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_assignment room_assignments%rowtype;
  v_from_type uuid;
  v_to_type uuid;
  v_move_id uuid;
begin
  if p_rate_decision not in ('continue', 'override', 'same_type') then
    raise exception 'Rate decision must be continue, override, or same_type.';
  end if;
  if p_rate_decision = 'override'
     and (p_override_amount_btn is null or nullif(trim(coalesce(p_override_reason, '')), '') is null) then
    raise exception 'Override amount and reason are required.';
  end if;

  select * into v_assignment
    from room_assignments
   where id = p_assignment_id
     and property_id = p_property_id
   for update;
  if not found then
    raise exception 'Room assignment was not found.';
  end if;
  if v_assignment.is_locked then
    raise exception 'Unlock this room assignment before moving it.';
  end if;
  if v_assignment.from_date < (now() at time zone 'Asia/Thimphu')::date then
    raise exception 'Past or in-house nights must use split stay.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_assignment.booking_id::text, 0));

  select room_type_id into v_from_type
    from room_units where id = v_assignment.room_unit_id;
  select room_type_id into v_to_type
    from room_units
   where id = p_to_unit_id
     and property_id = p_property_id;
  if v_to_type is null then
    raise exception 'Destination room was not found.';
  end if;

  if exists (
    select 1 from room_assignments ra
     where ra.room_unit_id = p_to_unit_id
       and ra.id <> p_assignment_id
       and daterange(ra.from_date, ra.to_date, '[)')
           && daterange(v_assignment.from_date, v_assignment.to_date, '[)')
  ) then
    raise exception 'Destination room is occupied during this stay.';
  end if;

  update room_assignments
     set room_unit_id = p_to_unit_id
   where id = p_assignment_id;

  if v_from_type is distinct from v_to_type then
    update booking_rooms
       set room_type_id = v_to_type
     where booking_id = v_assignment.booking_id
       and room_type_id = v_from_type
       and inventory_kind = 'sellable_guest';
  end if;

  insert into room_assignment_moves (
    property_id, assignment_id, booking_id, from_unit_id, to_unit_id, from_date, to_date
  )
  values (
    p_property_id,
    p_assignment_id,
    v_assignment.booking_id,
    v_assignment.room_unit_id,
    p_to_unit_id,
    v_assignment.from_date,
    v_assignment.to_date
  )
  returning id into v_move_id;

  return v_move_id;
end;
$$;

revoke all on function public.resize_room_assignment_dates(uuid, uuid, date, date)
  from public, anon, authenticated;
revoke all on function public.split_room_assignment(uuid, uuid, date, uuid)
  from public, anon, authenticated;
revoke all on function public.move_room_assignment_cross_type(uuid, uuid, uuid, text, numeric, text)
  from public, anon, authenticated;

grant execute on function public.resize_room_assignment_dates(uuid, uuid, date, date)
  to service_role;
grant execute on function public.split_room_assignment(uuid, uuid, date, uuid)
  to service_role;
grant execute on function public.move_room_assignment_cross_type(uuid, uuid, uuid, text, numeric, text)
  to service_role;
