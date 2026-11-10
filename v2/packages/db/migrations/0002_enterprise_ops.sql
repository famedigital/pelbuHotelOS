-- Hotel OS v2 enterprise ops — procurement, HR/biometric, utilities, fleet, banking.
-- Schema v2 only. Idempotent ALTER/CREATE IF NOT EXISTS.

ALTER TABLE v2.staff ADD COLUMN IF NOT EXISTS employee_code text;
ALTER TABLE v2.staff ADD COLUMN IF NOT EXISTS tip_points numeric(8,2) NOT NULL DEFAULT 1.5;

CREATE TABLE IF NOT EXISTS v2.cash_drawer_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  opened_by_staff_id uuid REFERENCES v2.staff(id),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opening_float_btn numeric(14,2) NOT NULL DEFAULT 0,
  expected_balance_btn numeric(14,2) NOT NULL DEFAULT 0,
  counted_balance_btn numeric(14,2),
  status text NOT NULL DEFAULT 'open',
  version int NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS v2.cash_drawer_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  shift_id uuid NOT NULL REFERENCES v2.cash_drawer_shifts(id),
  kind text NOT NULL,
  amount_btn numeric(14,2) NOT NULL,
  direction text NOT NULL,
  reference_type text,
  reference_id uuid,
  note text,
  actor_staff_id uuid REFERENCES v2.staff(id),
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS cash_drawer_movements_shift_idx
  ON v2.cash_drawer_movements (shift_id, created_at);

CREATE TABLE IF NOT EXISTS v2.procurement_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  shift_id uuid REFERENCES v2.cash_drawer_shifts(id),
  issued_to_staff_id uuid REFERENCES v2.staff(id),
  issued_by_staff_id uuid REFERENCES v2.staff(id),
  amount_btn numeric(14,2) NOT NULL,
  purpose text NOT NULL DEFAULT 'cfm_market',
  status text NOT NULL DEFAULT 'open',
  change_returned_btn numeric(14,2) NOT NULL DEFAULT 0,
  spent_btn numeric(14,2) NOT NULL DEFAULT 0,
  reconciled_at timestamptz,
  drawer_movement_out_id uuid REFERENCES v2.cash_drawer_movements(id),
  drawer_movement_in_id uuid REFERENCES v2.cash_drawer_movements(id),
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  version int NOT NULL DEFAULT 1,
  UNIQUE (property_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS v2.procurement_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  advance_id uuid REFERENCES v2.procurement_advances(id),
  bill_no text NOT NULL,
  bill_date date NOT NULL,
  supplier_name text NOT NULL,
  category text NOT NULL,
  taxable_btn numeric(14,2) NOT NULL DEFAULT 0,
  gst_btn numeric(14,2) NOT NULL DEFAULT 0,
  non_taxable_btn numeric(14,2) NOT NULL DEFAULT 0,
  grand_total_btn numeric(14,2) NOT NULL,
  payment_mode text NOT NULL,
  journal_no text,
  receipt_url text,
  status text NOT NULL DEFAULT 'posted',
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  version int NOT NULL DEFAULT 1,
  UNIQUE (property_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS v2.procurement_bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  bill_id uuid NOT NULL REFERENCES v2.procurement_bills(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  category text NOT NULL,
  qty numeric(12,3) NOT NULL,
  unit text NOT NULL DEFAULT 'kg',
  unit_cost_btn numeric(14,2) NOT NULL,
  line_total_btn numeric(14,2) NOT NULL,
  stall_no text
);

CREATE TABLE IF NOT EXISTS v2.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  code text NOT NULL,
  name text NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  grace_minutes int NOT NULL DEFAULT 10,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (property_id, code)
);

CREATE TABLE IF NOT EXISTS v2.attendance_punches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  device_sn text NOT NULL,
  employee_code text NOT NULL,
  staff_id uuid REFERENCES v2.staff(id),
  punched_at timestamptz NOT NULL,
  punch_type int NOT NULL DEFAULT 0,
  verify_mode int NOT NULL DEFAULT 1,
  raw_line text NOT NULL,
  shift_id uuid REFERENCES v2.shifts(id),
  late_minutes int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, device_sn, raw_line)
);
CREATE INDEX IF NOT EXISTS attendance_punches_staff_at_idx
  ON v2.attendance_punches (property_id, employee_code, punched_at);

CREATE TABLE IF NOT EXISTS v2.sc_tip_pool_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  period_ym text NOT NULL,
  pool_btn numeric(14,2) NOT NULL,
  total_point_days numeric(14,4) NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  generated_at timestamptz NOT NULL DEFAULT now(),
  posted_at timestamptz,
  version int NOT NULL DEFAULT 1,
  UNIQUE (property_id, period_ym)
);

CREATE TABLE IF NOT EXISTS v2.sc_tip_pool_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  run_id uuid NOT NULL REFERENCES v2.sc_tip_pool_runs(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES v2.staff(id),
  tip_points numeric(8,2) NOT NULL,
  days_worked numeric(8,2) NOT NULL,
  point_days numeric(14,4) NOT NULL,
  share_btn numeric(14,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS v2.salary_slips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  staff_id uuid NOT NULL REFERENCES v2.staff(id),
  period_ym text NOT NULL,
  basic_btn numeric(14,2) NOT NULL,
  allowances_btn numeric(14,2) NOT NULL DEFAULT 0,
  tip_share_btn numeric(14,2) NOT NULL DEFAULT 0,
  nppf_employee_btn numeric(14,2) NOT NULL DEFAULT 0,
  gis_btn numeric(14,2) NOT NULL DEFAULT 0,
  cit_btn numeric(14,2) NOT NULL DEFAULT 0,
  net_pay_btn numeric(14,2) NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, staff_id, period_ym)
);

CREATE TABLE IF NOT EXISTS v2.utility_meters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  kind text NOT NULL,
  consumer_no text NOT NULL,
  label text NOT NULL,
  unit text NOT NULL DEFAULT 'kWh',
  active boolean NOT NULL DEFAULT true,
  UNIQUE (property_id, kind, consumer_no)
);

CREATE TABLE IF NOT EXISTS v2.utility_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  meter_id uuid NOT NULL REFERENCES v2.utility_meters(id),
  bill_no text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  units numeric(14,3) NOT NULL,
  amount_btn numeric(14,2) NOT NULL,
  due_date date,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS v2.amc_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  asset_kind text NOT NULL,
  vendor_name text NOT NULL,
  contract_no text,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  annual_btn numeric(14,2),
  alert_days int NOT NULL DEFAULT 45,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS v2.amc_service_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  contract_id uuid NOT NULL REFERENCES v2.amc_contracts(id) ON DELETE CASCADE,
  serviced_on date NOT NULL,
  technician text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS v2.tour_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  full_name text NOT NULL,
  tcr_license_no text NOT NULL,
  phone text,
  languages text[] NOT NULL DEFAULT '{}',
  agent_id uuid REFERENCES v2.agents(id),
  active boolean NOT NULL DEFAULT true,
  UNIQUE (property_id, tcr_license_no)
);

CREATE TABLE IF NOT EXISTS v2.fleet_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  plate text NOT NULL,
  vehicle_type text NOT NULL,
  seats int NOT NULL DEFAULT 7,
  driver_name text,
  rsta_expiry date,
  insurance_expiry date,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (property_id, plate)
);

CREATE TABLE IF NOT EXISTS v2.driver_dorm_beds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  bed_label text NOT NULL,
  occupied_by_name text,
  vehicle_id uuid REFERENCES v2.fleet_vehicles(id),
  guide_id uuid REFERENCES v2.tour_guides(id),
  from_date date,
  to_date date,
  status text NOT NULL DEFAULT 'free',
  UNIQUE (property_id, bed_label)
);

CREATE TABLE IF NOT EXISTS v2.bank_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  bank_code text NOT NULL,
  account_label text NOT NULL,
  statement_date date NOT NULL,
  source_filename text,
  status text NOT NULL DEFAULT 'imported',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS v2.bank_statement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  statement_id uuid NOT NULL REFERENCES v2.bank_statements(id) ON DELETE CASCADE,
  txn_date date NOT NULL,
  description text NOT NULL,
  amount_btn numeric(14,2) NOT NULL,
  direction text NOT NULL,
  external_ref text,
  status text NOT NULL DEFAULT 'open'
);

CREATE TABLE IF NOT EXISTS v2.reconciliation_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  statement_line_id uuid NOT NULL REFERENCES v2.bank_statement_lines(id),
  match_kind text NOT NULL,
  match_entity_id uuid NOT NULL,
  amount_btn numeric(14,2) NOT NULL,
  matched_at timestamptz NOT NULL DEFAULT now(),
  matched_by_staff_id uuid REFERENCES v2.staff(id)
);

-- Dual-folio checkout gate helper (personal balance must be ≤ 0.50)
CREATE OR REPLACE FUNCTION v2.personal_folio_balance(p_folio_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = v2
AS $$
  SELECT coalesce((
    SELECT sum(fl.total_amount) FROM v2.folio_lines fl WHERE fl.folio_id = p_folio_id
  ), 0) - coalesce((
    SELECT sum(p.amount) FROM v2.payments p WHERE p.folio_id = p_folio_id
  ), 0);
$$;

CREATE OR REPLACE FUNCTION v2.assert_checkout_personal_cleared(p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = v2
AS $$
DECLARE
  bal numeric;
BEGIN
  SELECT coalesce(max(v2.personal_folio_balance(f.id)), 0)
    INTO bal
  FROM v2.folios f
  WHERE f.booking_id = p_booking_id
    AND f.payer_type = 'guest'
    AND f.status = 'open';
  IF bal > 0.50 THEN
    RAISE EXCEPTION 'CHECKOUT_PERSONAL_BALANCE: personal folio Nu % still open (gate Nu 0.50)', bal
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;
