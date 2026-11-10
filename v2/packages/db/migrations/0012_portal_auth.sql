-- Exclusive hotel desk gate + agent/guide/driver portal accounts (property-scoped).
-- Ledger: apply via droplet-apply-v2-migrations.sh

ALTER TABLE v2.properties
  ADD COLUMN IF NOT EXISTS desk_access_code_hash text,
  ADD COLUMN IF NOT EXISTS desk_access_code_hint text;

CREATE TABLE IF NOT EXISTS v2.portal_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  role text NOT NULL CHECK (role IN ('agent', 'guide', 'driver')),
  subject_id uuid NOT NULL,
  login_code text NOT NULL,
  display_name text NOT NULL,
  pin_hash text,
  pin_reset_required boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  home_route text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, role, login_code)
);

CREATE INDEX IF NOT EXISTS portal_accounts_property_role_idx
  ON v2.portal_accounts (property_id, role)
  WHERE active = true;

COMMENT ON TABLE v2.portal_accounts IS
  'Exclusive portal logins: agent/guide/driver. subject_id → agents | tour_guides | fleet_vehicles.';
COMMENT ON COLUMN v2.properties.desk_access_code_hash IS
  'Hotel desk gate before staff PIN list (scrypt$). Never expose raw code.';

GRANT SELECT, INSERT, UPDATE, DELETE ON v2.portal_accounts TO v2_app;
