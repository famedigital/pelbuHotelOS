-- Re-runnable public → v2 inventory ETL (org + 2 hotels + rooms + staff).
-- Auth model: one org owner (org_members); staff join via property-scoped PIN.
-- Preserves public UUIDs for idempotent upserts.
-- PIN hashes are NOT copied (SOURCE-MAP 7.6 → PIN reset at first v2 login).

BEGIN;

CREATE TABLE IF NOT EXISTS v2.etl_runs (
  id bigserial PRIMARY KEY,
  phase text NOT NULL,
  mode text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  notes jsonb NOT NULL DEFAULT '{}'::jsonb
);

INSERT INTO v2.etl_runs (phase, mode, notes)
VALUES ('inventory', current_setting('hos.etl_mode', true), jsonb_build_object('slugs', ARRAY['pelbu-olakha','pelbu-suites-olakha']));

-- ── Organization (single) ──────────────────────────────────────────
INSERT INTO v2.organizations (id, name, created_at)
VALUES (
  'a1000000-0000-4000-8000-000000000001'::uuid,
  'Pelbu Suites',
  now()
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- ── Properties (keep public ids) ───────────────────────────────────
INSERT INTO v2.properties (
  id, organization_id, slug, name, timezone, current_business_date,
  sc_rate, gst_rate, gst_enabled, base_currency, version, created_at
)
SELECT
  p.id,
  'a1000000-0000-4000-8000-000000000001'::uuid,
  p.slug,
  p.name,
  COALESCE(NULLIF(p.timezone, ''), 'Asia/Thimphu'),
  COALESCE(p.current_business_date, (now() AT TIME ZONE 'Asia/Thimphu')::date),
  COALESCE(p.service_charge_rate, 0.10),
  COALESCE(p.gst_rate, 0.05),
  COALESCE(p.gst_enabled, true),
  'BTN',
  1,
  COALESCE(p.created_at, now())
FROM public.properties p
WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha')
ON CONFLICT (id) DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  timezone = EXCLUDED.timezone,
  current_business_date = EXCLUDED.current_business_date,
  sc_rate = EXCLUDED.sc_rate,
  gst_rate = EXCLUDED.gst_rate,
  gst_enabled = EXCLUDED.gst_enabled,
  base_currency = EXCLUDED.base_currency,
  version = v2.properties.version + 1;

-- ── Room types ─────────────────────────────────────────────────────
INSERT INTO v2.room_types (id, property_id, code, name, base_occupancy, version)
SELECT
  rt.id,
  rt.property_id,
  COALESCE(NULLIF(rt.code, ''), 'RT-' || left(rt.id::text, 8)),
  COALESCE(NULLIF(rt.name, ''), COALESCE(NULLIF(rt.code, ''), 'Room')),
  2,
  1
FROM public.room_types rt
JOIN public.properties p ON p.id = rt.property_id
WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha')
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  version = v2.room_types.version + 1;

-- ── Rooms (room_units → rooms) ─────────────────────────────────────
INSERT INTO v2.rooms (id, property_id, room_type_id, number, floor, hk_status, version)
SELECT
  ru.id,
  ru.property_id,
  ru.room_type_id,
  COALESCE(NULLIF(ru.label, ''), 'UNNUM-' || left(ru.id::text, 6)),
  ru.floor_label,
  CASE lower(COALESCE(ru.hk_status, 'clean'))
    WHEN 'dirty' THEN 'dirty'
    WHEN 'inspect' THEN 'inspect'
    WHEN 'ooo' THEN 'ooo'
    WHEN 'oos' THEN 'oos'
    ELSE 'clean'
  END,
  1
FROM public.room_units ru
JOIN public.properties p ON p.id = ru.property_id
WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha')
  AND ru.room_type_id IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
  room_type_id = EXCLUDED.room_type_id,
  number = EXCLUDED.number,
  floor = EXCLUDED.floor,
  hk_status = EXCLUDED.hk_status,
  version = v2.rooms.version + 1;

-- ── Staff (PIN reset required — hashes not migrated) ───────────────
INSERT INTO v2.staff (
  id, property_id, display_name, role, employee_code, pin_hash, active, version,
  can_login, desk_role, home_route, pin_reset_required, pin_set_at
)
SELECT
  s.id,
  s.property_id,
  COALESCE(NULLIF(s.full_name, ''), COALESCE(s.employee_code, 'Staff')),
  COALESCE(NULLIF(s.desk_role, ''), COALESCE(NULLIF(s.access_level, ''), 'employee')),
  s.employee_code,
  NULL, -- never copy v1 Auth password
  COALESCE(s.status, 'active') IN ('active', 'on_leave'),
  1,
  /* Any active staff can join Pin Gateway and set a v2 PIN (SOURCE-MAP reset). */
  COALESCE(s.status, 'active') IN ('active', 'on_leave'),
  s.desk_role,
  CASE lower(COALESCE(s.desk_role, COALESCE(s.access_level, '')))
    WHEN 'fnb' THEN '/pos'
    WHEN 'cashier' THEN '/pos'
    WHEN 'kitchen' THEN '/kds'
    WHEN 'hk' THEN '/housekeeping'
    WHEN 'housekeeping' THEN '/housekeeping'
    WHEN 'owner' THEN '/owner'
    WHEN 'gm' THEN '/owner'
    WHEN 'hr_admin' THEN '/hr'
    WHEN 'front_desk' THEN '/desk'
    WHEN 'employee' THEN '/desk'
    ELSE '/desk'
  END,
  true,
  NULL
FROM public.staff_members s
JOIN public.properties p ON p.id = s.property_id
WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha')
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  role = EXCLUDED.role,
  employee_code = EXCLUDED.employee_code,
  active = EXCLUDED.active,
  can_login = EXCLUDED.can_login,
  desk_role = EXCLUDED.desk_role,
  home_route = EXCLUDED.home_route,
  -- Keep existing pin_hash / pin_reset_required if already set in v2
  pin_reset_required = CASE
    WHEN v2.staff.pin_hash IS NOT NULL THEN v2.staff.pin_reset_required
    ELSE true
  END,
  version = v2.staff.version + 1;

-- Org owner placeholder (auth_user_id filled by ensure-owner script)
INSERT INTO v2.org_members (organization_id, auth_user_id, email, role)
VALUES (
  'a1000000-0000-4000-8000-000000000001'::uuid,
  '00000000-0000-4000-8000-0000000000e1'::uuid,
  'pelbusuites@gmail.com',
  'owner'
)
ON CONFLICT (organization_id, email) DO UPDATE SET
  role = 'owner';

UPDATE v2.etl_runs
SET finished_at = now(),
    notes = notes || jsonb_build_object(
      'properties', (SELECT count(*) FROM v2.properties WHERE organization_id = 'a1000000-0000-4000-8000-000000000001'::uuid),
      'room_types', (SELECT count(*) FROM v2.room_types rt JOIN v2.properties p ON p.id = rt.property_id WHERE p.organization_id = 'a1000000-0000-4000-8000-000000000001'::uuid),
      'rooms', (SELECT count(*) FROM v2.rooms r JOIN v2.properties p ON p.id = r.property_id WHERE p.organization_id = 'a1000000-0000-4000-8000-000000000001'::uuid),
      'staff', (SELECT count(*) FROM v2.staff s JOIN v2.properties p ON p.id = s.property_id WHERE p.organization_id = 'a1000000-0000-4000-8000-000000000001'::uuid),
      'staff_can_login', (SELECT count(*) FROM v2.staff s JOIN v2.properties p ON p.id = s.property_id WHERE p.organization_id = 'a1000000-0000-4000-8000-000000000001'::uuid AND s.can_login)
    )
WHERE id = (SELECT max(id) FROM v2.etl_runs WHERE phase = 'inventory');

COMMIT;

-- Summary (outside txn for visibility)
SELECT 'properties' AS kind, slug, name FROM v2.properties
WHERE organization_id = 'a1000000-0000-4000-8000-000000000001'::uuid
ORDER BY slug;

SELECT p.slug, count(*) AS rooms
FROM v2.rooms r
JOIN v2.properties p ON p.id = r.property_id
WHERE p.organization_id = 'a1000000-0000-4000-8000-000000000001'::uuid
GROUP BY p.slug ORDER BY 1;

SELECT p.slug,
       count(*) AS staff,
       count(*) FILTER (WHERE s.can_login) AS can_login,
       count(*) FILTER (WHERE s.pin_hash IS NOT NULL) AS pin_set
FROM v2.staff s
JOIN v2.properties p ON p.id = s.property_id
WHERE p.organization_id = 'a1000000-0000-4000-8000-000000000001'::uuid
GROUP BY p.slug ORDER BY 1;
