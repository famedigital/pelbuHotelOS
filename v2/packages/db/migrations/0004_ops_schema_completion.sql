-- Hotel OS v2 — ops schema completion (additive).
-- Aligns bank lines with scripts/bank-recon debit/credit model,
-- dorm/fleet/utility/AMC fields from enterprise brief, DoT star audits.
-- Idempotent. Does not rename existing CFM / ADMS columns.

-- Bank statements: closing balance from statement footer
ALTER TABLE v2.bank_statements
  ADD COLUMN IF NOT EXISTS closing_balance_btn numeric(14,2);

-- Bank lines: native debit/credit (BoB/BNB/DrukPNB parsers) + fingerprint
ALTER TABLE v2.bank_statement_lines
  ADD COLUMN IF NOT EXISTS debit_btn numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE v2.bank_statement_lines
  ADD COLUMN IF NOT EXISTS credit_btn numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE v2.bank_statement_lines
  ADD COLUMN IF NOT EXISTS balance_btn numeric(14,2);
ALTER TABLE v2.bank_statement_lines
  ADD COLUMN IF NOT EXISTS fingerprint text;

-- Backfill debit/credit from legacy amount + direction where still zero
UPDATE v2.bank_statement_lines
SET debit_btn = amount_btn
WHERE direction = 'out' AND debit_btn = 0 AND amount_btn > 0;

UPDATE v2.bank_statement_lines
SET credit_btn = amount_btn
WHERE direction = 'in' AND credit_btn = 0 AND amount_btn > 0;

CREATE UNIQUE INDEX IF NOT EXISTS bank_statement_lines_fingerprint_uidx
  ON v2.bank_statement_lines (property_id, fingerprint)
  WHERE fingerprint IS NOT NULL;

-- Cash drawer close fields (variance = counted − expected)
ALTER TABLE v2.cash_drawer_shifts
  ADD COLUMN IF NOT EXISTS closing_cash_btn numeric(14,2);
ALTER TABLE v2.cash_drawer_shifts
  ADD COLUMN IF NOT EXISTS variance_btn numeric(14,2);
ALTER TABLE v2.cash_drawer_shifts
  ADD COLUMN IF NOT EXISTS cashier_staff_id uuid REFERENCES v2.staff(id);

-- Utility meters / bills
ALTER TABLE v2.utility_meters
  ADD COLUMN IF NOT EXISTS meter_no text;
ALTER TABLE v2.utility_bills
  ADD COLUMN IF NOT EXISTS billing_month date;
ALTER TABLE v2.utility_bills
  ADD COLUMN IF NOT EXISTS receipt_no text;
ALTER TABLE v2.utility_bills
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- AMC service follow-up
ALTER TABLE v2.amc_service_logs
  ADD COLUMN IF NOT EXISTS next_service_due date;

-- Fleet / dorm logistics
ALTER TABLE v2.fleet_vehicles
  ADD COLUMN IF NOT EXISTS driver_phone text;
ALTER TABLE v2.fleet_vehicles
  ADD COLUMN IF NOT EXISTS model text;
ALTER TABLE v2.driver_dorm_beds
  ADD COLUMN IF NOT EXISTS floor text;
ALTER TABLE v2.driver_dorm_beds
  ADD COLUMN IF NOT EXISTS nightly_rate_btn numeric(10,2);
ALTER TABLE v2.driver_dorm_beds
  ADD COLUMN IF NOT EXISTS assigned_group_id uuid;
ALTER TABLE v2.tour_guides
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- SC tip pool month/year mirrors (period_ym remains canonical)
ALTER TABLE v2.sc_tip_pool_runs
  ADD COLUMN IF NOT EXISTS month int;
ALTER TABLE v2.sc_tip_pool_runs
  ADD COLUMN IF NOT EXISTS year int;

UPDATE v2.sc_tip_pool_runs
SET
  year = split_part(period_ym, '-', 1)::int,
  month = split_part(period_ym, '-', 2)::int
WHERE period_ym ~ '^\d{4}-\d{2}$'
  AND (year IS NULL OR month IS NULL);

-- DoT star certification (brief §3.8)
CREATE TABLE IF NOT EXISTS v2.dot_star_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  audit_date date NOT NULL,
  star_target int NOT NULL DEFAULT 4,
  score numeric(6,2) NOT NULL DEFAULT 0,
  grade text NOT NULL DEFAULT 'pending',
  auditor_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  version int NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS v2.dot_star_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  audit_id uuid NOT NULL REFERENCES v2.dot_star_audits(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  weight numeric(6,2) NOT NULL DEFAULT 1,
  met boolean NOT NULL DEFAULT false,
  evidence_url text
);

CREATE INDEX IF NOT EXISTS dot_star_criteria_audit_idx
  ON v2.dot_star_criteria (audit_id);
