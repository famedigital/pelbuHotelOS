create table if not exists room_blocks (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  room_unit_id uuid not null references room_units(id) on delete cascade,
  block_kind text not null
    check (block_kind = any (array['ooo', 'oos', 'hold'])),
  from_date date not null,
  to_date date not null,
  reason text not null,
  created_by text not null default 'desk',
  created_at timestamptz not null default now(),
  released_at timestamptz,
  check (to_date > from_date)
);

create index if not exists room_blocks_property_window_idx
  on room_blocks (property_id, from_date, to_date)
  where released_at is null;

alter table room_blocks
  drop constraint if exists room_blocks_no_overlap;
alter table room_blocks
  add constraint room_blocks_no_overlap
  exclude using gist (
    room_unit_id with =,
    daterange(from_date, to_date, '[)') with &&
  )
  where (released_at is null);

alter table room_blocks enable row level security;
drop policy if exists "service_role full room_blocks" on room_blocks;
create policy "service_role full room_blocks"
  on room_blocks
  for all to service_role using (true) with check (true);

create or replace function public.reject_assignment_over_room_block()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if exists (
    select 1
      from room_blocks rb
     where rb.room_unit_id = new.room_unit_id
       and rb.released_at is null
       and daterange(rb.from_date, rb.to_date, '[)')
           && daterange(new.from_date, new.to_date, '[)')
  ) then
    raise exception 'Room is blocked during this stay.';
  end if;
  return new;
end;
$$;

drop trigger if exists room_assignments_reject_blocks on room_assignments;
create trigger room_assignments_reject_blocks
  before insert or update of room_unit_id, from_date, to_date
  on room_assignments
  for each row execute function public.reject_assignment_over_room_block();

create or replace function public.create_calendar_room_block(
  p_property_id uuid,
  p_room_unit_id uuid,
  p_block_kind text,
  p_from_date date,
  p_to_date date,
  p_reason text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_block_id uuid;
begin
  if p_block_kind <> all (array['ooo', 'oos', 'hold']) then
    raise exception 'Invalid room block type.';
  end if;
  if p_to_date <= p_from_date then
    raise exception 'Block end date must be after the start date.';
  end if;
  if nullif(trim(p_reason), '') is null then
    raise exception 'A reason is required.';
  end if;
  if not exists (
    select 1
      from room_units ru
     where ru.id = p_room_unit_id
       and ru.property_id = p_property_id
  ) then
    raise exception 'Room was not found at this property.';
  end if;
  if exists (
    select 1
      from room_assignments ra
      join bookings b on b.id = ra.booking_id
     where ra.room_unit_id = p_room_unit_id
       and b.status = any (array['held', 'pending', 'confirmed', 'checked_in'])
       and daterange(ra.from_date, ra.to_date, '[)')
           && daterange(p_from_date, p_to_date, '[)')
  ) then
    raise exception 'An active booking occupies this room during the block.';
  end if;

  insert into room_blocks (
    property_id,
    room_unit_id,
    block_kind,
    from_date,
    to_date,
    reason
  )
  values (
    p_property_id,
    p_room_unit_id,
    p_block_kind,
    p_from_date,
    p_to_date,
    trim(p_reason)
  )
  returning id into v_block_id;

  if p_block_kind = 'ooo' then
    update room_units
       set hk_status = 'ooo', updated_at = now()
     where id = p_room_unit_id;
  end if;

  return v_block_id;
end;
$$;

create or replace function public.release_calendar_room_block(
  p_property_id uuid,
  p_block_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_room_unit_id uuid;
  v_kind text;
begin
  update room_blocks
     set released_at = now()
   where id = p_block_id
     and property_id = p_property_id
     and released_at is null
  returning room_unit_id, block_kind into v_room_unit_id, v_kind;

  if not found then
    raise exception 'Active room block was not found.';
  end if;

  if v_kind = 'ooo'
     and not exists (
       select 1 from room_blocks
        where room_unit_id = v_room_unit_id
          and block_kind = 'ooo'
          and released_at is null
     ) then
    update room_units
       set hk_status = 'inspect', updated_at = now()
     where id = v_room_unit_id;
  end if;
end;
$$;

revoke all on function public.reject_assignment_over_room_block()
  from public, anon, authenticated;
revoke all on function public.create_calendar_room_block(uuid, uuid, text, date, date, text)
  from public, anon, authenticated;
revoke all on function public.release_calendar_room_block(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.create_calendar_room_block(uuid, uuid, text, date, date, text)
  to service_role;
grant execute on function public.release_calendar_room_block(uuid, uuid)
  to service_role;
