-- Hotel OS v2 spine — schema v2 only. Apply with a migration role, then grant to v2_app.
-- REINVENT: folio per payer, net rates, outbox, append-only audit.

CREATE SCHEMA IF NOT EXISTS v2;

CREATE TABLE IF NOT EXISTS v2.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS v2.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES v2.organizations(id),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Thimphu',
  current_business_date date NOT NULL,
  sc_rate numeric(8,4) NOT NULL DEFAULT 0.10,
  gst_rate numeric(8,4) NOT NULL DEFAULT 0.05,
  gst_enabled boolean NOT NULL DEFAULT true,
  base_currency text NOT NULL DEFAULT 'BTN',
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS v2.room_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  code text NOT NULL,
  name text NOT NULL,
  base_occupancy int NOT NULL DEFAULT 2,
  version int NOT NULL DEFAULT 1,
  UNIQUE (property_id, code)
);

CREATE TABLE IF NOT EXISTS v2.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  room_type_id uuid NOT NULL REFERENCES v2.room_types(id),
  number text NOT NULL,
  floor text,
  hk_status text NOT NULL DEFAULT 'clean',
  version int NOT NULL DEFAULT 1,
  UNIQUE (property_id, number)
);

CREATE TABLE IF NOT EXISTS v2.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  display_name text NOT NULL,
  role text NOT NULL,
  pin_hash text,
  active boolean NOT NULL DEFAULT true,
  version int NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS v2.rate_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  code text NOT NULL,
  name text NOT NULL,
  currency text NOT NULL DEFAULT 'BTN',
  meal_plan text NOT NULL DEFAULT 'EP',
  version int NOT NULL DEFAULT 1,
  UNIQUE (property_id, code)
);

CREATE TABLE IF NOT EXISTS v2.rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  rate_plan_id uuid NOT NULL REFERENCES v2.rate_plans(id),
  room_type_id uuid NOT NULL REFERENCES v2.room_types(id),
  stay_date date NOT NULL,
  net_amount numeric(12,2) NOT NULL,
  version int NOT NULL DEFAULT 1,
  UNIQUE (rate_plan_id, room_type_id, stay_date)
);

CREATE TABLE IF NOT EXISTS v2.guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  full_name text NOT NULL,
  email text,
  phone text,
  nationality text,
  vip boolean NOT NULL DEFAULT false,
  version int NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS v2.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  name text NOT NULL,
  code text NOT NULL,
  credit_limit numeric(14,2) NOT NULL DEFAULT 0,
  credit_hold boolean NOT NULL DEFAULT false,
  version int NOT NULL DEFAULT 1,
  UNIQUE (property_id, code)
);

CREATE TABLE IF NOT EXISTS v2.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  name text NOT NULL,
  agent_id uuid REFERENCES v2.agents(id),
  version int NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS v2.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  confirmation_no text NOT NULL,
  status text NOT NULL DEFAULT 'held',
  guest_id uuid REFERENCES v2.guests(id),
  agent_id uuid REFERENCES v2.agents(id),
  group_id uuid REFERENCES v2.groups(id),
  check_in date NOT NULL,
  check_out date NOT NULL,
  source text NOT NULL DEFAULT 'desk',
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, confirmation_no)
);

CREATE TABLE IF NOT EXISTS v2.booking_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  booking_id uuid NOT NULL REFERENCES v2.bookings(id),
  room_type_id uuid NOT NULL REFERENCES v2.room_types(id),
  rate_plan_id uuid REFERENCES v2.rate_plans(id),
  net_amount numeric(12,2),
  meal_plan text NOT NULL DEFAULT 'EP',
  version int NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS v2.room_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  booking_line_id uuid NOT NULL REFERENCES v2.booking_lines(id),
  room_id uuid NOT NULL REFERENCES v2.rooms(id),
  stay_date date NOT NULL,
  active boolean NOT NULL DEFAULT true,
  version int NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS room_assignments_room_date
  ON v2.room_assignments (room_id, stay_date) WHERE active;

CREATE TABLE IF NOT EXISTS v2.folios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  booking_id uuid NOT NULL REFERENCES v2.bookings(id),
  payer_type text NOT NULL,
  guest_id uuid REFERENCES v2.guests(id),
  agent_id uuid REFERENCES v2.agents(id),
  currency text NOT NULL DEFAULT 'BTN',
  status text NOT NULL DEFAULT 'open',
  version int NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS v2.folio_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  folio_id uuid NOT NULL REFERENCES v2.folios(id),
  kind text NOT NULL,
  description text NOT NULL,
  net_amount numeric(14,2) NOT NULL,
  sc_amount numeric(14,2) NOT NULL DEFAULT 0,
  gst_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL,
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS v2.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  folio_id uuid NOT NULL REFERENCES v2.folios(id),
  method text NOT NULL,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'BTN',
  fx_rate numeric(14,6),
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS v2.fiscal_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  folio_id uuid REFERENCES v2.folios(id),
  kind text NOT NULL,
  doc_no text NOT NULL,
  status text NOT NULL DEFAULT 'issued',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, doc_no)
);

CREATE TABLE IF NOT EXISTS v2.property_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  kind text NOT NULL,
  year int NOT NULL,
  last_value int NOT NULL DEFAULT 0,
  UNIQUE (property_id, kind, year)
);

CREATE TABLE IF NOT EXISTS v2.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE TABLE IF NOT EXISTS v2.event_handler_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES v2.events(id),
  handler_key text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, handler_key)
);

CREATE TABLE IF NOT EXISTS v2.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  actor_staff_id uuid,
  actor_role text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  prev_hash text,
  row_hash text
);

CREATE TABLE IF NOT EXISTS v2.partner_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  stay_date date NOT NULL,
  room_id uuid,
  state text NOT NULL,
  owner_agent_id uuid,
  guest_name text,
  booking_ref text
);

CREATE TABLE IF NOT EXISTS v2.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  outlet_id uuid,
  name text NOT NULL,
  category text,
  net_price numeric(12,2) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  version int NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS v2.pos_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'open',
  table_id uuid,
  booking_id uuid,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS v2.hk_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  room_id uuid NOT NULL,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attendant_staff_id uuid,
  version int NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS v2.cms_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  version int NOT NULL DEFAULT 1,
  UNIQUE (property_id, slug)
);

CREATE TABLE IF NOT EXISTS v2.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  net_price numeric(12,2) NOT NULL,
  duration_minutes int,
  version int NOT NULL DEFAULT 1,
  UNIQUE (property_id, code)
);

CREATE TABLE IF NOT EXISTS v2.banquet_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'enquiry',
  event_date date,
  headcount int,
  version int NOT NULL DEFAULT 1
);

-- Role guard (run as superuser after create role v2_app)
-- REVOKE ALL ON SCHEMA public FROM v2_app;
-- GRANT USAGE ON SCHEMA v2 TO v2_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA v2 TO v2_app;
-- No UPDATE/DELETE on audit_log:
-- REVOKE UPDATE, DELETE ON v2.audit_log FROM v2_app;
