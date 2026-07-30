alter table room_assignments
  add column if not exists is_locked boolean not null default false,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists lock_reason text;

create table if not exists room_assignment_moves (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  assignment_id uuid references room_assignments(id) on delete set null,
  booking_id uuid references bookings(id) on delete set null,
  from_unit_id uuid not null references room_units(id),
  to_unit_id uuid not null references room_units(id),
  from_date date not null,
  to_date date not null,
  moved_at timestamptz not null default now(),
  undo_expires_at timestamptz not null default (now() + interval '60 seconds'),
  undone_at timestamptz,
  actor text not null default 'desk'
);

create index if not exists room_assignment_moves_assignment_idx
  on room_assignment_moves (assignment_id, moved_at desc);
create index if not exists room_assignment_moves_undo_idx
  on room_assignment_moves (undo_expires_at)
  where undone_at is null;

alter table room_assignment_moves enable row level security;
drop policy if exists "service_role full room_assignment_moves"
  on room_assignment_moves;
create policy "service_role full room_assignment_moves"
  on room_assignment_moves
  for all to service_role using (true) with check (true);

create or replace function public.set_room_assignment_lock(
  p_property_id uuid,
  p_assignment_id uuid,
  p_locked boolean,
  p_reason text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update room_assignments
     set is_locked = p_locked,
         locked_at = case when p_locked then now() else null end,
         locked_by = case when p_locked then 'desk' else null end,
         lock_reason = case when p_locked then nullif(trim(p_reason), '') else null end
   where id = p_assignment_id
     and property_id = p_property_id;

  if not found then
    raise exception 'Room assignment was not found at this property.';
  end if;
end;
$$;

create or replace function public.move_room_assignment_same_type(
  p_property_id uuid,
  p_assignment_id uuid,
  p_to_unit_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_assignment room_assignments%rowtype;
  v_booking bookings%rowtype;
  v_from_type uuid;
  v_to_type uuid;
  v_move_id uuid;
begin
  select *
    into v_assignment
    from room_assignments
   where id = p_assignment_id
     and property_id = p_property_id
   for update;

  if not found then
    raise exception 'Room assignment was not found.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_assignment.booking_id::text, 0)
  );

  select *
    into v_booking
    from bookings
   where id = v_assignment.booking_id
     and property_id = p_property_id
     and status = any (array['held', 'pending', 'confirmed', 'checked_in']);

  if not found then
    raise exception 'Booking is no longer active.';
  end if;

  if v_assignment.is_locked then
    raise exception 'Unlock this room assignment before moving it.';
  end if;

  if v_assignment.from_date < (now() at time zone 'Asia/Thimphu')::date then
    raise exception 'Past or in-house nights must be moved using split stay.';
  end if;

  select room_type_id into v_from_type
    from room_units
   where id = v_assignment.room_unit_id
     and property_id = p_property_id;
  select room_type_id into v_to_type
    from room_units
   where id = p_to_unit_id
     and property_id = p_property_id;

  if v_to_type is null then
    raise exception 'Destination room was not found.';
  end if;
  if v_from_type is distinct from v_to_type then
    raise exception 'Choose a room in the same category. Cross-category moves require rate review.';
  end if;
  if p_to_unit_id = v_assignment.room_unit_id then
    raise exception 'Choose a different room.';
  end if;

  if exists (
    select 1
      from room_assignments ra
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

  insert into room_assignment_moves (
    property_id,
    assignment_id,
    booking_id,
    from_unit_id,
    to_unit_id,
    from_date,
    to_date
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

create or replace function public.undo_room_assignment_move(
  p_property_id uuid,
  p_move_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_move room_assignment_moves%rowtype;
  v_assignment room_assignments%rowtype;
begin
  select *
    into v_move
    from room_assignment_moves
   where id = p_move_id
     and property_id = p_property_id
   for update;

  if not found then
    raise exception 'Move record was not found.';
  end if;
  if v_move.undone_at is not null then
    raise exception 'This move was already undone.';
  end if;
  if now() > v_move.undo_expires_at then
    raise exception 'The 60-second undo window has expired.';
  end if;
  if v_move.assignment_id is null then
    raise exception 'The room assignment no longer exists.';
  end if;

  select *
    into v_assignment
    from room_assignments
   where id = v_move.assignment_id
     and property_id = p_property_id
   for update;

  if not found then
    raise exception 'The room assignment no longer exists.';
  end if;
  if v_assignment.is_locked then
    raise exception 'Unlock this room assignment before undoing the move.';
  end if;
  if v_assignment.room_unit_id <> v_move.to_unit_id then
    raise exception 'The room assignment changed again and cannot be undone.';
  end if;

  if exists (
    select 1
      from room_assignments ra
     where ra.room_unit_id = v_move.from_unit_id
       and ra.id <> v_move.assignment_id
       and daterange(ra.from_date, ra.to_date, '[)')
           && daterange(v_move.from_date, v_move.to_date, '[)')
  ) then
    raise exception 'The original room is no longer free.';
  end if;

  update room_assignments
     set room_unit_id = v_move.from_unit_id
   where id = v_move.assignment_id;

  update room_assignment_moves
     set undone_at = now()
   where id = p_move_id;
end;
$$;

revoke all on function public.set_room_assignment_lock(uuid, uuid, boolean, text)
  from public, anon, authenticated;
revoke all on function public.move_room_assignment_same_type(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.undo_room_assignment_move(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.set_room_assignment_lock(uuid, uuid, boolean, text)
  to service_role;
grant execute on function public.move_room_assignment_same_type(uuid, uuid, uuid)
  to service_role;
grant execute on function public.undo_room_assignment_move(uuid, uuid)
  to service_role;
