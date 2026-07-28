-- P2 foundation: desk POS/KOT + guest folio ledger

create table if not exists folios (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  booking_id uuid references bookings(id) on delete set null,
  folio_type text not null default 'guest'
    check (folio_type = any (array['guest'::text, 'master'::text, 'walk_in'::text])),
  label text not null,
  status text not null default 'open'
    check (status = any (array['open'::text, 'closed'::text, 'settled'::text])),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists folios_property_idx on folios (property_id, created_at desc);
create index if not exists folios_booking_idx on folios (booking_id);

create table if not exists folio_lines (
  id uuid primary key default gen_random_uuid(),
  folio_id uuid not null references folios(id) on delete cascade,
  booking_id uuid references bookings(id) on delete set null,
  source_type text not null
    check (source_type = any (array[
      'room'::text,
      'order'::text,
      'service'::text,
      'payment'::text,
      'adjustment'::text
    ])),
  source_id uuid,
  description text not null,
  qty numeric(12,2) not null default 1,
  unit_price_btn numeric(12,2) not null default 0,
  amount_btn numeric(12,2) not null default 0,
  gst_applicable boolean not null default false,
  gst_btn numeric(12,2) not null default 0,
  total_btn numeric(12,2) not null default 0,
  status text not null default 'posted'
    check (status = any (array['posted'::text, 'voided'::text])),
  created_at timestamptz not null default now()
);

create index if not exists folio_lines_folio_idx on folio_lines (folio_id, created_at desc);
create index if not exists folio_lines_source_idx on folio_lines (source_type, source_id);

alter table folios enable row level security;
alter table folio_lines enable row level security;

alter table orders
  add column if not exists booking_id uuid references bookings(id) on delete set null,
  add column if not exists folio_id uuid references folios(id) on delete set null,
  add column if not exists order_source text not null default 'public'
    check (order_source = any (array['public'::text, 'desk'::text, 'room_charge'::text])),
  add column if not exists kot_status text not null default 'new'
    check (kot_status = any (array[
      'new'::text,
      'preparing'::text,
      'ready'::text,
      'served'::text,
      'cancelled'::text
    ])),
  add column if not exists posted_to_folio_at timestamptz,
  add column if not exists settled_at timestamptz;

create index if not exists orders_property_status_idx
  on orders (property_id, status, kot_status, created_at desc);
