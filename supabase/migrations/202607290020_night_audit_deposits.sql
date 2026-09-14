-- P7 go-live: night audit, void/comp metadata, deposits, group folio link

-- ---------------------------------------------------------------------------
-- Folio line void / comp metadata
-- ---------------------------------------------------------------------------
alter table folio_lines
  add column if not exists void_reason text,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by text,
  add column if not exists is_comp boolean not null default false;

alter table folio_lines drop constraint if exists folio_lines_source_type_check;
alter table folio_lines
  add constraint folio_lines_source_type_check
  check (source_type = any (array[
    'room'::text,
    'order'::text,
    'service'::text,
    'guest_service'::text,
    'payment'::text,
    'adjustment'::text,
    'comp'::text,
    'deposit'::text
  ]));

-- Group / master folio (tour groups)
alter table folios
  add column if not exists master_folio_id uuid references folios(id) on delete set null;

create index if not exists folios_master_idx
  on folios (master_folio_id)
  where master_folio_id is not null;

-- ---------------------------------------------------------------------------
-- Payments: Bhutan deposit / QR / Pay.bt methods
-- ---------------------------------------------------------------------------
alter table payments drop constraint if exists payments_method_check;
alter table payments
  add constraint payments_method_check
  check (method = any (array[
    'cash'::text,
    'bank'::text,
    'card'::text,
    'agent_credit'::text,
    'bank_qr'::text,
    'pay_bt'::text,
    'deposit'::text
  ]));

alter table payments
  add column if not exists kind text not null default 'settlement'
    check (kind = any (array[
      'settlement'::text,
      'deposit'::text,
      'refund'::text
    ]));

-- ---------------------------------------------------------------------------
-- Deposit / payment links (shareable; desk marks paid when bank confirms)
-- ---------------------------------------------------------------------------
create table if not exists payment_links (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  booking_id uuid references bookings(id) on delete set null,
  folio_id uuid references folios(id) on delete set null,
  agent_id uuid references agents(id) on delete set null,
  token text not null unique,
  amount_btn numeric(12,2) not null check (amount_btn > 0),
  purpose text not null default 'deposit'
    check (purpose = any (array[
      'deposit'::text,
      'balance'::text,
      'agent_topup'::text
    ])),
  payee_name text,
  payee_phone text,
  bank_hint text,
  status text not null default 'open'
    check (status = any (array[
      'open'::text,
      'paid'::text,
      'expired'::text,
      'cancelled'::text
    ])),
  expires_at timestamptz,
  paid_at timestamptz,
  payment_id uuid references payments(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists payment_links_token_idx on payment_links (token);
create index if not exists payment_links_property_idx
  on payment_links (property_id, status, created_at desc);

alter table payment_links enable row level security;

drop policy if exists "service_role full payment_links" on payment_links;
create policy "service_role full payment_links" on payment_links
  for all to service_role using (true) with check (true);

-- Public can read open link by token only via service role in route handlers.
-- No anon policies on money tables.

-- ---------------------------------------------------------------------------
-- Night audit runs
-- ---------------------------------------------------------------------------
create table if not exists night_audits (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  business_date date not null,
  status text not null default 'completed'
    check (status = any (array[
      'completed'::text,
      'reversed'::text
    ])),
  rooms_occupied int not null default 0,
  rooms_comp int not null default 0,
  folio_charges_btn numeric(12,2) not null default 0,
  folio_payments_btn numeric(12,2) not null default 0,
  open_folios int not null default 0,
  summary jsonb not null default '{}'::jsonb,
  run_by text not null default 'desk',
  notes text,
  created_at timestamptz not null default now(),
  unique (property_id, business_date)
);

create index if not exists night_audits_property_idx
  on night_audits (property_id, business_date desc);

alter table night_audits enable row level security;

drop policy if exists "service_role full night_audits" on night_audits;
create policy "service_role full night_audits" on night_audits
  for all to service_role using (true) with check (true);
