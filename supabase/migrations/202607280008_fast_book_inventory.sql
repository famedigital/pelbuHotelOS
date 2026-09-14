-- P1b: room inventory counts + booking room lines for ultra-fast desk booking

alter table room_types
  add column if not exists unit_count int not null default 0
    check (unit_count >= 0);

-- Seed typical Pelbu Olakha inventory (adjust later in CMS/ERP)
update room_types r
set unit_count = v.unit_count
from properties p,
(values
  ('deluxe', 4),
  ('superior', 6),
  ('twin', 4),
  ('guide', 4),
  ('driver', 4)
) as v(code, unit_count)
where r.property_id = p.id
  and p.slug = 'pelbu-suites-olakha'
  and r.code = v.code
  and r.unit_count = 0;

create table if not exists booking_rooms (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  room_type_id uuid not null references room_types(id),
  qty int not null check (qty > 0),
  -- Denormalized so ADR reports can exclude comps without joining
  inventory_kind text not null
    check (inventory_kind = any (array[
      'sellable_guest'::text,
      'guide_comp'::text,
      'driver_comp'::text,
      'staff'::text
    ])),
  created_at timestamptz not null default now()
);

create index if not exists booking_rooms_booking_idx on booking_rooms (booking_id);
create index if not exists booking_rooms_type_idx on booking_rooms (room_type_id);

alter table booking_rooms enable row level security;

-- Staff path uses service role; keep public locked down (no anon policies).

alter table bookings
  add column if not exists booked_by_role text
    check (booked_by_role is null or booked_by_role = any (array[
      'owner'::text,
      'reservation'::text,
      'agent'::text,
      'mou_agent'::text,
      'client'::text
    ]));
