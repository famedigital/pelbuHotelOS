-- P2b: payments + guest service charge kinds on folio_lines

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  folio_id uuid references folios(id) on delete set null,
  booking_id uuid references bookings(id) on delete set null,
  method text not null
    check (method = any (array[
      'cash'::text,
      'bank'::text,
      'card'::text,
      'agent_credit'::text
    ])),
  amount_btn numeric(12,2) not null check (amount_btn > 0),
  reference text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists payments_folio_idx on payments (folio_id, created_at desc);
create index if not exists payments_property_idx on payments (property_id, created_at desc);

alter table payments enable row level security;

-- Expand folio_lines source_type for guest services (taxi/shop)
alter table folio_lines drop constraint if exists folio_lines_source_type_check;
alter table folio_lines
  add constraint folio_lines_source_type_check
  check (source_type = any (array[
    'room'::text,
    'order'::text,
    'service'::text,
    'guest_service'::text,
    'payment'::text,
    'adjustment'::text
  ]));
