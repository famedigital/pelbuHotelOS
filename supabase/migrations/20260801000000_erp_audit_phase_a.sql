-- ERP audit Phase A: room-night idempotency, folio reversal columns, laundry seed, RLS gaps.

-- ---------------------------------------------------------------------------
-- Folio lines: room-night keys + reversal linkage
-- ---------------------------------------------------------------------------
alter table folio_lines
  add column if not exists business_date date,
  add column if not exists room_unit_id uuid references room_units(id) on delete set null,
  add column if not exists reverses_line_id uuid references folio_lines(id) on delete set null;

comment on column folio_lines.business_date is
  'Hotel business date for room-night posts (night audit).';
comment on column folio_lines.room_unit_id is
  'Physical room for room-night idempotency (one post per folio/date/room).';
comment on column folio_lines.reverses_line_id is
  'When set, this line reverses the referenced posted charge (void/credit pattern).';

create unique index if not exists folio_lines_room_night_uniq
  on folio_lines (folio_id, business_date, room_unit_id)
  where source_type = 'room'
    and business_date is not null
    and room_unit_id is not null
    and status = 'posted';

create index if not exists folio_lines_reverses_idx
  on folio_lines (reverses_line_id)
  where reverses_line_id is not null;

-- ---------------------------------------------------------------------------
-- Pelbu flagship laundry catalog (seed only when thin)
-- ---------------------------------------------------------------------------
insert into laundry_catalog_items (
  property_id, name, category, unit_label, price_btn, gst_applicable,
  turnaround_hours, is_active, sort_order
)
select
  p.id,
  v.name,
  v.category,
  v.unit_label,
  v.price_btn,
  v.gst_applicable,
  v.turnaround_hours,
  true,
  v.sort_order
from properties p
cross join (
  values
    ('Shirt / blouse', 'clothing', 'piece', 80.00, true, 24, 10),
    ('T-shirt / polo', 'clothing', 'piece', 60.00, true, 24, 20),
    ('Trousers / pants', 'clothing', 'piece', 100.00, true, 24, 30),
    ('Jeans', 'clothing', 'piece', 120.00, true, 24, 40),
    ('Suit / blazer', 'clothing', 'piece', 200.00, true, 48, 50),
    ('Dress / skirt', 'clothing', 'piece', 120.00, true, 24, 60),
    ('Inner wear', 'clothing', 'piece', 40.00, true, 24, 70),
    ('Socks / stockings', 'clothing', 'pair', 30.00, true, 24, 80),
    ('Sweater / jacket', 'clothing', 'piece', 150.00, true, 48, 90),
    ('Traditional gho / kira', 'clothing', 'piece', 250.00, true, 48, 100),
    ('Bedsheet', 'linen', 'piece', 150.00, true, 48, 110),
    ('Duvet cover', 'linen', 'piece', 200.00, true, 48, 120),
    ('Towel', 'linen', 'piece', 50.00, true, 24, 130)
) as v(name, category, unit_label, price_btn, gst_applicable, turnaround_hours, sort_order)
where p.slug = 'pelbu-suites-olakha'
  and (
    select count(*) from laundry_catalog_items l where l.property_id = p.id
  ) < 3
on conflict (property_id, name) do nothing;

-- ---------------------------------------------------------------------------
-- SEC-02: service_role policies on tables with RLS enabled but zero policies
-- ---------------------------------------------------------------------------
drop policy if exists "service_role full booking_guests" on booking_guests;
create policy "service_role full booking_guests" on booking_guests
  for all to service_role using (true) with check (true);

drop policy if exists "service_role full booking_rooms" on booking_rooms;
create policy "service_role full booking_rooms" on booking_rooms
  for all to service_role using (true) with check (true);

drop policy if exists "service_role full booking_drivers" on booking_drivers;
create policy "service_role full booking_drivers" on booking_drivers
  for all to service_role using (true) with check (true);

drop policy if exists "service_role full guides" on guides;
create policy "service_role full guides" on guides
  for all to service_role using (true) with check (true);

drop policy if exists "service_role full drivers" on drivers;
create policy "service_role full drivers" on drivers
  for all to service_role using (true) with check (true);

drop policy if exists "service_role full order_items" on order_items;
create policy "service_role full order_items" on order_items
  for all to service_role using (true) with check (true);
