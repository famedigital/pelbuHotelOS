-- Checkout dirties the assigned room even when check-in left it clean
-- (room moves set the door without flipping hk_status to occupied).

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
     and ru.hk_status is distinct from 'ooo';

  get diagnostics v_count = row_count;

  return jsonb_build_object('dirty_units', v_count, 'booking_id', p_booking_id);
end;
$$;
