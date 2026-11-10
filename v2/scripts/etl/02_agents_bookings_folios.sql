-- public → v2 operational ETL (agents, guests, active bookings, lines, assignments, folios).
-- Scope: confirmed | held | checked_in for pelbu-olakha + pelbu-suites-olakha.
-- Re-runnable. Preserves public UUIDs where possible.
-- SOURCE-MAP 7.6: open folios → opening-balance lines when copying; rates already net/incl SC as stored.

BEGIN;

INSERT INTO v2.etl_runs (phase, mode, notes)
VALUES (
  'ops_bookings',
  coalesce(nullif(current_setting('hos.etl_mode', true), ''), 'apply'),
  jsonb_build_object('statuses', ARRAY['confirmed','held','checked_in'])
);

CREATE TABLE IF NOT EXISTS v2.etl_id_map (
  entity text NOT NULL,
  public_id uuid NOT NULL,
  property_id uuid NOT NULL,
  v2_id uuid NOT NULL,
  PRIMARY KEY (entity, public_id, property_id)
);

-- Agents: one v2 row per property link (Olakha keeps public agent id; DEMO gets mapped id).
-- Upsert only — never DELETE (bookings/folios/groups FK to v2.agents after first load).
INSERT INTO v2.agents (id, property_id, name, code, credit_limit, credit_hold, version)
SELECT
  CASE
    WHEN p.slug = 'pelbu-olakha' THEN a.id
    ELSE (
      substr(md5(a.id::text || apl.property_id::text), 1, 8) || '-' ||
      substr(md5(a.id::text || apl.property_id::text), 9, 4) || '-4' ||
      substr(md5(a.id::text || apl.property_id::text), 13, 3) || '-a' ||
      substr(md5(a.id::text || apl.property_id::text), 16, 3) || '-' ||
      substr(md5(a.id::text || apl.property_id::text), 19, 12)
    )::uuid
  END,
  apl.property_id,
  COALESCE(NULLIF(a.company_name, ''), COALESCE(a.login_code, 'AGENT')),
  COALESCE(NULLIF(a.login_code, ''), 'A-' || left(a.id::text, 8)),
  COALESCE(apl.credit_limit, a.credit_limit, 0),
  false,
  1
FROM public.agents a
JOIN public.agent_property_links apl ON apl.agent_id = a.id AND apl.status = 'approved'
JOIN public.properties p ON p.id = apl.property_id
WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha')
ON CONFLICT (property_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  credit_limit = EXCLUDED.credit_limit,
  version = v2.agents.version + 1;

INSERT INTO v2.etl_id_map (entity, public_id, property_id, v2_id)
SELECT 'agent', a.id, apl.property_id, va.id
FROM public.agents a
JOIN public.agent_property_links apl ON apl.agent_id = a.id AND apl.status = 'approved'
JOIN public.properties p ON p.id = apl.property_id
JOIN v2.agents va ON va.property_id = apl.property_id
  AND va.code = COALESCE(NULLIF(a.login_code, ''), 'A-' || left(a.id::text, 8))
WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha')
ON CONFLICT (entity, public_id, property_id) DO UPDATE SET v2_id = EXCLUDED.v2_id;

-- ── Guests (primary booking_guests for active bookings) ────────────
INSERT INTO v2.guests (id, property_id, full_name, email, phone, nationality, vip, version)
SELECT
  bg.id,
  b.property_id,
  COALESCE(NULLIF(bg.full_name, ''), 'Guest'),
  NULL,
  NULL,
  bg.nationality,
  false,
  1
FROM public.booking_guests bg
JOIN public.bookings b ON b.id = bg.booking_id
JOIN public.properties p ON p.id = b.property_id
WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha')
  AND b.status IN ('confirmed', 'held', 'checked_in')
  AND COALESCE(bg.sort_order, 0) = (
    SELECT MIN(COALESCE(g2.sort_order, 0))
    FROM public.booking_guests g2
    WHERE g2.booking_id = bg.booking_id
  )
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  nationality = EXCLUDED.nationality,
  version = v2.guests.version + 1;

-- Fallback guest row per booking with no booking_guests
INSERT INTO v2.guests (id, property_id, full_name, version)
SELECT
  (
    'b0000000-0000-4000-8000-' || substr(replace(b.id::text, '-', ''), 1, 12)
  )::uuid,
  b.property_id,
  COALESCE(b.confirmation_code, 'Guest'),
  1
FROM public.bookings b
JOIN public.properties p ON p.id = b.property_id
WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha')
  AND b.status IN ('confirmed', 'held', 'checked_in')
  AND NOT EXISTS (SELECT 1 FROM public.booking_guests bg WHERE bg.booking_id = b.id)
ON CONFLICT (id) DO NOTHING;

-- ── Bookings ───────────────────────────────────────────────────────
INSERT INTO v2.bookings (
  id, property_id, confirmation_no, status, guest_id, agent_id,
  check_in, check_out, source, notes, version, created_at
)
SELECT
  b.id,
  b.property_id,
  COALESCE(NULLIF(b.confirmation_code, ''), 'BK-' || left(b.id::text, 8)),
  b.status,
  COALESCE(
    (SELECT bg.id FROM public.booking_guests bg
     WHERE bg.booking_id = b.id
     ORDER BY COALESCE(bg.sort_order, 0) ASC LIMIT 1),
    ('b0000000-0000-4000-8000-' || substr(replace(b.id::text, '-', ''), 1, 12))::uuid
  ),
  (SELECT m.v2_id FROM v2.etl_id_map m
   WHERE m.entity = 'agent' AND m.public_id = b.agent_id AND m.property_id = b.property_id),
  b.check_in::date,
  b.check_out::date,
  CASE WHEN b.agent_id IS NOT NULL THEN 'agent_portal' ELSE 'desk' END,
  NULL,
  1,
  now()
FROM public.bookings b
JOIN public.properties p ON p.id = b.property_id
WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha')
  AND b.status IN ('confirmed', 'held', 'checked_in')
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  guest_id = EXCLUDED.guest_id,
  agent_id = EXCLUDED.agent_id,
  check_in = EXCLUDED.check_in,
  check_out = EXCLUDED.check_out,
  version = v2.bookings.version + 1;

-- ── Booking lines from booking_rooms ───────────────────────────────
INSERT INTO v2.booking_lines (
  id, property_id, booking_id, room_type_id, rate_plan_id,
  net_amount, meal_plan, version
)
SELECT
  br.id,
  b.property_id,
  br.booking_id,
  br.room_type_id,
  NULL,
  COALESCE(br.agreed_nightly_rate_btn, b.agreed_nightly_rate_btn, br.sheet_nightly_rate_btn),
  COALESCE(NULLIF(br.meal_plan_code, ''), NULLIF(b.meal_plan_code, ''), 'EP'),
  1
FROM public.booking_rooms br
JOIN public.bookings b ON b.id = br.booking_id
JOIN public.properties p ON p.id = b.property_id
WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha')
  AND b.status IN ('confirmed', 'held', 'checked_in')
  AND EXISTS (SELECT 1 FROM v2.room_types rt WHERE rt.id = br.room_type_id)
ON CONFLICT (id) DO UPDATE SET
  room_type_id = EXCLUDED.room_type_id,
  net_amount = EXCLUDED.net_amount,
  meal_plan = EXCLUDED.meal_plan,
  version = v2.booking_lines.version + 1;

-- Synthetic line when booking_rooms missing but room type can be inferred later — skip

-- ── Room assignments: expand from_date..to_date-1 into nightly rows ─
-- Clear prior ETL nightly rows for these bookings (idempotent rebuild)
DELETE FROM v2.room_assignments ra
WHERE ra.booking_line_id IN (
  SELECT bl.id FROM v2.booking_lines bl
  JOIN v2.bookings b ON b.id = bl.booking_id
  JOIN v2.properties p ON p.id = b.property_id
  WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha')
    AND b.status IN ('confirmed', 'held', 'checked_in')
);

INSERT INTO v2.room_assignments (
  id, property_id, booking_line_id, room_id, stay_date, active, version
)
SELECT
  gen_random_uuid(),
  ra.property_id,
  bl.id,
  ra.room_unit_id,
  d::date,
  true,
  1
FROM public.room_assignments ra
JOIN public.bookings b ON b.id = ra.booking_id
JOIN public.properties p ON p.id = b.property_id
JOIN v2.booking_lines bl ON bl.booking_id = b.id
JOIN v2.rooms r ON r.id = ra.room_unit_id
CROSS JOIN LATERAL generate_series(ra.from_date::date, (ra.to_date::date - 1), interval '1 day') AS d
WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha')
  AND b.status IN ('confirmed', 'held', 'checked_in')
  AND ra.to_date > ra.from_date
  -- pick first booking line if multiple
  AND bl.id = (
    SELECT bl2.id FROM v2.booking_lines bl2
    WHERE bl2.booking_id = b.id
    ORDER BY bl2.id LIMIT 1
  );

-- ── Folios ─────────────────────────────────────────────────────────
INSERT INTO v2.folios (
  id, property_id, booking_id, payer_type, guest_id, agent_id, currency, status, version
)
SELECT
  f.id,
  f.property_id,
  f.booking_id,
  CASE
    WHEN lower(coalesce(f.folio_type, '')) IN ('agent', 'agency', 'master') THEN 'agent'
    ELSE 'guest'
  END,
  b.guest_id,
  (SELECT m.v2_id FROM v2.etl_id_map m
   WHERE m.entity = 'agent' AND m.public_id = f.agent_id AND m.property_id = f.property_id),
  'BTN',
  CASE WHEN f.status IN ('open', 'closed', 'settled') THEN f.status ELSE 'open' END,
  1
FROM public.folios f
JOIN v2.bookings b ON b.id = f.booking_id
JOIN public.properties p ON p.id = f.property_id
WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha')
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  payer_type = EXCLUDED.payer_type,
  agent_id = EXCLUDED.agent_id,
  version = v2.folios.version + 1;

-- Opening-balance line = sum of non-voided v1 lines (SOURCE-MAP open folios)
DELETE FROM v2.folio_lines fl
WHERE fl.description LIKE 'Cutover opening balance%'
  AND fl.property_id IN (SELECT id FROM v2.properties WHERE slug IN ('pelbu-olakha','pelbu-suites-olakha'));

INSERT INTO v2.folio_lines (
  id, property_id, folio_id, kind, description,
  net_amount, sc_amount, gst_amount, total_amount,
  idempotency_key, created_at
)
SELECT
  gen_random_uuid(),
  f.property_id,
  f.id,
  'opening_balance',
  'Cutover opening balance from Innora folio',
  coalesce(sum(CASE WHEN fl.voided_at IS NULL THEN fl.amount_btn ELSE 0 END), 0),
  coalesce(sum(CASE WHEN fl.voided_at IS NULL THEN fl.service_charge_btn ELSE 0 END), 0),
  coalesce(sum(CASE WHEN fl.voided_at IS NULL THEN fl.gst_btn ELSE 0 END), 0),
  coalesce(sum(CASE WHEN fl.voided_at IS NULL THEN fl.total_btn ELSE 0 END), 0),
  gen_random_uuid(),
  now()
FROM public.folios f
JOIN v2.folios vf ON vf.id = f.id
LEFT JOIN public.folio_lines fl ON fl.folio_id = f.id
GROUP BY f.id, f.property_id
HAVING coalesce(sum(CASE WHEN fl.voided_at IS NULL THEN fl.total_btn ELSE 0 END), 0) <> 0;

-- ── Fiscal sequences (continue from v1; collapse duplicate kind maps) ─
INSERT INTO v2.property_sequences (property_id, kind, year, last_value)
SELECT property_id, kind, year, max(last_value)
FROM (
  SELECT
    ps.property_id,
    CASE
      WHEN ps.kind LIKE 'invoice:%' THEN 'INV'
      WHEN ps.kind LIKE 'folio_fn:%' THEN 'PSBN'
      WHEN ps.kind LIKE 'booking_conf:%' THEN 'CONF'
      WHEN ps.kind LIKE 'booking_bk:%' THEN 'BK'
      WHEN ps.kind LIKE 'journal:%' THEN 'JRN'
      WHEN ps.kind = 'master_bn' THEN 'MASTER_BN'
      WHEN ps.kind = 'booking_confirmation' THEN 'CONF_LEGACY'
      ELSE upper(replace(split_part(ps.kind, ':', 1), ' ', '_'))
    END AS kind,
    CASE
      WHEN ps.kind ~ ':[0-9]{4}$' THEN substring(ps.kind from ':([0-9]{4})$')::int
      WHEN ps.kind ~ ':[0-9]{6}$' THEN left(substring(ps.kind from ':([0-9]{6})$'), 4)::int
      ELSE EXTRACT(YEAR FROM now())::int
    END AS year,
    ps.last_value
  FROM public.property_sequences ps
  JOIN public.properties p ON p.id = ps.property_id
  WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha')
) s
GROUP BY property_id, kind, year
ON CONFLICT (property_id, kind, year) DO UPDATE SET
  last_value = GREATEST(v2.property_sequences.last_value, EXCLUDED.last_value);

UPDATE v2.etl_runs
SET finished_at = now(),
    notes = notes || jsonb_build_object(
      'agents', (SELECT count(*) FROM v2.agents a JOIN v2.properties p ON p.id=a.property_id WHERE p.slug IN ('pelbu-olakha','pelbu-suites-olakha')),
      'bookings', (SELECT count(*) FROM v2.bookings b JOIN v2.properties p ON p.id=b.property_id WHERE p.slug IN ('pelbu-olakha','pelbu-suites-olakha')),
      'lines', (SELECT count(*) FROM v2.booking_lines bl JOIN v2.properties p ON p.id=bl.property_id WHERE p.slug IN ('pelbu-olakha','pelbu-suites-olakha')),
      'assignments', (SELECT count(*) FROM v2.room_assignments ra JOIN v2.properties p ON p.id=ra.property_id WHERE p.slug IN ('pelbu-olakha','pelbu-suites-olakha') AND ra.active),
      'folios', (SELECT count(*) FROM v2.folios f JOIN v2.properties p ON p.id=f.property_id WHERE p.slug IN ('pelbu-olakha','pelbu-suites-olakha')),
      'folio_lines', (SELECT count(*) FROM v2.folio_lines fl JOIN v2.properties p ON p.id=fl.property_id WHERE p.slug IN ('pelbu-olakha','pelbu-suites-olakha'))
    )
WHERE id = (SELECT max(id) FROM v2.etl_runs WHERE phase = 'ops_bookings');

COMMIT;

-- Shadow summary
SELECT 'bookings' AS k, p.slug, count(*)::int AS n
FROM v2.bookings b JOIN v2.properties p ON p.id=b.property_id
WHERE p.slug IN ('pelbu-olakha','pelbu-suites-olakha')
GROUP BY 2
UNION ALL
SELECT 'assignments', p.slug, count(*)::int
FROM v2.room_assignments ra JOIN v2.properties p ON p.id=ra.property_id
WHERE p.slug IN ('pelbu-olakha','pelbu-suites-olakha') AND ra.active
GROUP BY 2
UNION ALL
SELECT 'folios', p.slug, count(*)::int
FROM v2.folios f JOIN v2.properties p ON p.id=f.property_id
WHERE p.slug IN ('pelbu-olakha','pelbu-suites-olakha')
GROUP BY 2
ORDER BY 1,2;
