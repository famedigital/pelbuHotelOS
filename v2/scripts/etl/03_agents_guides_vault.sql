-- public vault → v2.agents + v2.tour_guides (central brain for desk hydrate).
-- Scope: full vault onto pelbu-olakha (reuse public ids) + pelbu-suites-olakha
-- (deterministic synthetic ids — PK is global, cannot reuse public uuid twice).
-- Re-runnable. Upsert only — never DELETE (bookings FK to v2.agents).
-- SOURCE-MAP: MIGRATE cutover data; desk commercial/extras hydrate from these tables.

BEGIN;

INSERT INTO v2.etl_runs (phase, mode, notes)
VALUES (
  'partners_vault',
  coalesce(nullif(current_setting('hos.etl_mode', true), ''), 'apply'),
  jsonb_build_object('entities', ARRAY['agents','tour_guides'], 'targets', ARRAY['pelbu-olakha','pelbu-suites-olakha'])
);

CREATE TABLE IF NOT EXISTS v2.etl_id_map (
  entity text NOT NULL,
  public_id uuid NOT NULL,
  property_id uuid NOT NULL,
  v2_id uuid NOT NULL,
  PRIMARY KEY (entity, public_id, property_id)
);

-- Stable synthetic uuid when the same public row is mirrored onto a second property.
CREATE OR REPLACE FUNCTION v2.etl_mirror_uuid(seed text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (
    substr(md5(seed), 1, 8) || '-' ||
    substr(md5(seed), 9, 4) || '-4' ||
    substr(md5(seed), 13, 3) || '-a' ||
    substr(md5(seed), 16, 3) || '-' ||
    substr(md5(seed), 19, 12)
  )::uuid;
$$;

-- ── Agents: full approved/demo vault onto both FO properties ─────────
INSERT INTO v2.agents (id, property_id, name, code, credit_limit, credit_hold, version)
SELECT
  CASE
    WHEN p.slug = 'pelbu-olakha' THEN a.id
    ELSE v2.etl_mirror_uuid(a.id::text || p.id::text)
  END,
  p.id,
  COALESCE(NULLIF(trim(a.company_name), ''), COALESCE(NULLIF(trim(a.login_code), ''), 'AGENT')),
  COALESCE(NULLIF(trim(a.login_code), ''), 'A-' || left(a.id::text, 8)),
  COALESCE(a.credit_limit, 0),
  false,
  1
FROM public.agents a
CROSS JOIN public.properties p
WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha')
  AND EXISTS (SELECT 1 FROM v2.properties vp WHERE vp.id = p.id)
  AND a.status IN ('approved', 'demo')
ON CONFLICT (property_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  credit_limit = GREATEST(v2.agents.credit_limit, EXCLUDED.credit_limit),
  version = v2.agents.version + 1;

INSERT INTO v2.etl_id_map (entity, public_id, property_id, v2_id)
SELECT
  'agent',
  a.id,
  p.id,
  CASE
    WHEN p.slug = 'pelbu-olakha' THEN a.id
    ELSE v2.etl_mirror_uuid(a.id::text || p.id::text)
  END
FROM public.agents a
CROSS JOIN public.properties p
WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha')
  AND EXISTS (SELECT 1 FROM v2.properties vp WHERE vp.id = p.id)
  AND a.status IN ('approved', 'demo')
ON CONFLICT (entity, public_id, property_id) DO UPDATE SET v2_id = EXCLUDED.v2_id;

-- Prefer linked credit limits when an approved agent_property_link exists
UPDATE v2.agents va
SET
  credit_limit = GREATEST(va.credit_limit, COALESCE(apl.credit_limit, va.credit_limit)),
  version = va.version + 1
FROM public.agent_property_links apl
JOIN public.properties p ON p.id = apl.property_id
JOIN public.agents a ON a.id = apl.agent_id
WHERE apl.status = 'approved'
  AND p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha')
  AND va.property_id = p.id
  AND va.code = COALESCE(NULLIF(trim(a.login_code), ''), 'A-' || left(a.id::text, 8));

-- ── Guides: national vault → both FO properties ──────────────────────
INSERT INTO v2.tour_guides (
  id, property_id, full_name, tcr_license_no, phone, languages, agent_id, status, active
)
SELECT
  CASE
    WHEN p.slug = 'pelbu-olakha' THEN ng.id
    ELSE v2.etl_mirror_uuid(ng.id::text || p.id::text)
  END,
  p.id,
  COALESCE(NULLIF(trim(ng.full_name), ''), 'Guide'),
  COALESCE(NULLIF(trim(ng.license_no), ''), 'TCR-' || left(ng.id::text, 8)),
  NULLIF(trim(ng.phone), ''),
  COALESCE(ng.languages, '{}'::text[]),
  NULL,
  CASE
    WHEN ng.status = 'verified' THEN 'active'
    WHEN ng.status = 'suspended' THEN 'suspended'
    WHEN ng.status = 'rejected' THEN 'rejected'
    ELSE 'pending'
  END,
  ng.status IN ('verified', 'pending_verification')
FROM public.national_guides ng
CROSS JOIN public.properties p
WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha')
  AND EXISTS (SELECT 1 FROM v2.properties vp WHERE vp.id = p.id)
  AND NULLIF(trim(ng.license_no), '') IS NOT NULL
ON CONFLICT (property_id, tcr_license_no) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  phone = COALESCE(EXCLUDED.phone, v2.tour_guides.phone),
  languages = EXCLUDED.languages,
  status = EXCLUDED.status,
  active = EXCLUDED.active;

INSERT INTO v2.etl_id_map (entity, public_id, property_id, v2_id)
SELECT
  'tour_guide',
  ng.id,
  p.id,
  CASE
    WHEN p.slug = 'pelbu-olakha' THEN ng.id
    ELSE v2.etl_mirror_uuid(ng.id::text || p.id::text)
  END
FROM public.national_guides ng
CROSS JOIN public.properties p
WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha')
  AND EXISTS (SELECT 1 FROM v2.properties vp WHERE vp.id = p.id)
  AND NULLIF(trim(ng.license_no), '') IS NOT NULL
ON CONFLICT (entity, public_id, property_id) DO UPDATE SET v2_id = EXCLUDED.v2_id;

-- Overlay property guides (phone / name) when license matches national row
UPDATE v2.tour_guides tg
SET
  phone = COALESCE(NULLIF(trim(g.phone), ''), tg.phone),
  full_name = COALESCE(NULLIF(trim(g.full_name), ''), tg.full_name)
FROM public.guides g
JOIN public.properties p ON p.id = g.property_id
  AND p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha')
WHERE tg.property_id = p.id
  AND (
    (
      g.national_guide_id IS NOT NULL
      AND (
        tg.id = g.national_guide_id
        OR tg.id = v2.etl_mirror_uuid(g.national_guide_id::text || p.id::text)
      )
    )
    OR (
      NULLIF(trim(g.guide_number), '') IS NOT NULL
      AND lower(trim(tg.tcr_license_no)) = lower(trim(g.guide_number))
    )
  );

-- Property-only guides (no national match) → insert with stable id
INSERT INTO v2.tour_guides (
  id, property_id, full_name, tcr_license_no, phone, languages, agent_id, status, active
)
SELECT
  COALESCE(
    CASE
      WHEN g.national_guide_id IS NOT NULL AND p.slug = 'pelbu-olakha' THEN g.national_guide_id
      WHEN g.national_guide_id IS NOT NULL THEN v2.etl_mirror_uuid(g.national_guide_id::text || p.id::text)
      ELSE NULL
    END,
    v2.etl_mirror_uuid(g.property_id::text || coalesce(g.guide_number, g.id::text))
  ),
  g.property_id,
  COALESCE(NULLIF(trim(g.full_name), ''), COALESCE(NULLIF(trim(g.guide_number), ''), 'Guide')),
  COALESCE(NULLIF(trim(g.guide_number), ''), 'PG-' || left(g.id::text, 8)),
  NULLIF(trim(g.phone), ''),
  '{}'::text[],
  NULL,
  'active',
  true
FROM public.guides g
JOIN public.properties p ON p.id = g.property_id
  AND p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha')
WHERE NULLIF(trim(g.guide_number), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM v2.tour_guides tg
    WHERE tg.property_id = g.property_id
      AND lower(trim(tg.tcr_license_no)) = lower(trim(g.guide_number))
  )
ON CONFLICT (property_id, tcr_license_no) DO UPDATE SET
  full_name = COALESCE(NULLIF(trim(EXCLUDED.full_name), ''), v2.tour_guides.full_name),
  phone = COALESCE(EXCLUDED.phone, v2.tour_guides.phone),
  active = true;

-- Counts for verify
DO $$
DECLARE
  r record;
  n_public_agents int;
  n_national int;
BEGIN
  SELECT count(*) INTO n_public_agents FROM public.agents WHERE status IN ('approved', 'demo');
  SELECT count(*) INTO n_national FROM public.national_guides WHERE nullif(trim(license_no), '') IS NOT NULL;
  FOR r IN
    SELECT p.slug,
      (SELECT count(*) FROM v2.agents a WHERE a.property_id = p.id) AS agents,
      (SELECT count(*) FROM v2.tour_guides g WHERE g.property_id = p.id) AS guides
    FROM public.properties p
    WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha')
    ORDER BY p.slug
  LOOP
    RAISE NOTICE 'partners_vault % agents=% guides=% (public agents=% national=%)',
      r.slug, r.agents, r.guides, n_public_agents, n_national;
  END LOOP;
END $$;

COMMIT;
