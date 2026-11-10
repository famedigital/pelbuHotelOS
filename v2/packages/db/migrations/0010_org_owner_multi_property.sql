-- One org owner can operate multiple hotels; staff stay property-scoped (PIN Gateway).

CREATE TABLE IF NOT EXISTS v2.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES v2.organizations (id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'owner'
    CHECK (role IN ('owner', 'gm', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, auth_user_id),
  UNIQUE (organization_id, email)
);

CREATE INDEX IF NOT EXISTS org_members_email_idx ON v2.org_members (lower(email));

COMMENT ON TABLE v2.org_members IS
  'Org-level login (e.g. pelbusuites@gmail.com) spanning all properties under the org. Desk staff still use per-property PIN.';

-- Optional last-selected property for owner desk switcher.
ALTER TABLE v2.org_members
  ADD COLUMN IF NOT EXISTS last_property_id uuid REFERENCES v2.properties (id);

-- Staff: flag PIN must be re-set after cutover (v1 hashes not portable).
ALTER TABLE v2.staff
  ADD COLUMN IF NOT EXISTS pin_reset_required boolean NOT NULL DEFAULT true;
