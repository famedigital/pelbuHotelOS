-- M01 Travel Agent OS — agency tenant (schema v2)
-- Apply via droplet-apply-v2-migrations / pnpm migrate:v2:additive

CREATE TABLE IF NOT EXISTS v2.agency_orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  brand_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS agency_orgs_slug_uidx
  ON v2.agency_orgs (slug);

CREATE TABLE IF NOT EXISTS v2.agency_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_org_id uuid NOT NULL REFERENCES v2.agency_orgs(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL,
  role text NOT NULL
    CHECK (role IN ('owner', 'ops', 'finance', 'viewer')),
  display_name text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invited', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS agency_members_org_user_uidx
  ON v2.agency_members (agency_org_id, auth_user_id);

CREATE INDEX IF NOT EXISTS agency_members_org_idx
  ON v2.agency_members (agency_org_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS agency_members_auth_user_idx
  ON v2.agency_members (auth_user_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS v2.agency_org_hotel_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_org_id uuid NOT NULL REFERENCES v2.agency_orgs(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES v2.properties(id),
  agent_id uuid NOT NULL REFERENCES v2.agents(id),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'ended')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agency_org_hotel_links_org_idx
  ON v2.agency_org_hotel_links (agency_org_id)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS agency_org_hotel_links_org_property_active_uidx
  ON v2.agency_org_hotel_links (agency_org_id, property_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS agency_org_hotel_links_property_idx
  ON v2.agency_org_hotel_links (property_id)
  WHERE status = 'active';

COMMENT ON TABLE v2.agency_orgs IS
  'Travel Agent OS tenant (e.g. Soultrips). Not hotel property_id.';
COMMENT ON TABLE v2.agency_members IS
  'GoTrue users belonging to an agency_org.';
COMMENT ON TABLE v2.agency_org_hotel_links IS
  'MoU bridge: agency_org → v2.properties + v2.agents for holds.';

GRANT SELECT, INSERT, UPDATE, DELETE ON v2.agency_orgs TO v2_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON v2.agency_members TO v2_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON v2.agency_org_hotel_links TO v2_app;

-- Seed org shell only (member/hotel link requires live auth_user_id + agent_id — ops seed).
INSERT INTO v2.agency_orgs (slug, name, status)
SELECT 'soultrips', 'Soultrips', 'active'
WHERE NOT EXISTS (SELECT 1 FROM v2.agency_orgs WHERE slug = 'soultrips');
