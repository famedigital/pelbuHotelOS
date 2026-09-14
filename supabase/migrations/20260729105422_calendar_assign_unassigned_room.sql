-- Race-safe, non-destructive assignment of one missing sellable room slot.
-- The desk calls this through the service-role server client only.
create or replace function public.assign_unassigned_booking_room(
  p_property_id uuid,
  p_booking_id uuid,
  p_room_unit_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_booking bookings%rowtype;
  v_unit room_units%rowtype;
  v_required integer;
  v_assigned integer;
begin
  -- Serialize assignment decisions for a booking so two desk users cannot
  -- fill the same final slot at once.
  perform pg_advisory_xact_lock(hashtextextended(p_booking_id::text, 0));

  select *
    into v_booking
    from bookings
   where id = p_booking_id
     and property_id = p_property_id
     and status = any (array['held', 'pending', 'confirmed', 'checked_in'])
   for update;

  if not found then
    raise exception 'Booking is not active at this property.';
  end if;

  if v_booking.check_in is null
     or v_booking.check_out is null
     or v_booking.check_out <= v_booking.check_in then
    raise exception 'Booking has invalid stay dates.';
  end if;

  select ru.*
    into v_unit
    from room_units ru
    join room_types rt on rt.id = ru.room_type_id
   where ru.id = p_room_unit_id
     and ru.property_id = p_property_id
     and rt.inventory_kind = 'sellable_guest';

  if not found then
    raise exception 'Selected room is not a sellable room at this property.';
  end if;

  select coalesce(sum(br.qty), 0)::integer
    into v_required
    from booking_rooms br
   where br.booking_id = p_booking_id
     and br.room_type_id = v_unit.room_type_id
     and br.inventory_kind = 'sellable_guest';

  select count(*)::integer
    into v_assigned
    from room_assignments ra
    join room_units ru on ru.id = ra.room_unit_id
   where ra.booking_id = p_booking_id
     and ru.room_type_id = v_unit.room_type_id;

  if v_required <= v_assigned then
    raise exception 'This booking does not need another room of that type.';
  end if;

  if exists (
    select 1
      from room_assignments ra
     where ra.room_unit_id = p_room_unit_id
       and daterange(ra.from_date, ra.to_date, '[)')
           && daterange(v_booking.check_in, v_booking.check_out, '[)')
  ) then
    raise exception 'That room is no longer free for the full stay.';
  end if;

  insert into room_assignments (
    property_id,
    booking_id,
    room_unit_id,
    from_date,
    to_date
  )
  values (
    p_property_id,
    p_booking_id,
    p_room_unit_id,
    v_booking.check_in,
    v_booking.check_out
  );
end;
$$;

revoke all on function public.assign_unassigned_booking_room(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.assign_unassigned_booking_room(uuid, uuid, uuid)
  to service_role;
