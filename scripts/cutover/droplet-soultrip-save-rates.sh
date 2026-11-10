#!/usr/bin/env bash
# SOULTRIPS contract rates (Pelbu Suites Olakha) — incl. 10% S.C. package tariffs.
# CP:  single 3600 / double 4200
# MAP: single 4200 / double 5600
set -euo pipefail

docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

WITH
  prop AS (SELECT id FROM public.properties WHERE slug = 'pelbu-olakha' LIMIT 1),
  agent AS (SELECT id FROM public.agents WHERE login_code = 'SOULTRIPS' LIMIT 1)
DELETE FROM public.room_rates rr
USING prop, agent
WHERE rr.property_id = prop.id
  AND rr.agent_id = agent.id
  AND rr.label IN ('SOULTRIPS CP', 'SOULTRIPS MAP');

INSERT INTO public.room_rates (
  property_id, room_type_id, season_kind, rate_tier,
  label, agent_id, guest_label,
  amount_btn, amount_single_btn, currency, active
)
SELECT
  p.id,
  rt.id,
  s.season_kind,
  'agents',
  t.label,
  a.id,
  NULL,
  t.amount_btn,
  t.amount_single_btn,
  'BTN',
  true
FROM public.properties p
CROSS JOIN public.agents a
JOIN public.room_types rt
  ON rt.property_id = p.id
 AND rt.code IN ('deluxe_twin', 'deluxe_king', 'deluxe_queen')
CROSS JOIN (VALUES ('peak'), ('lean'), ('off')) AS s(season_kind)
CROSS JOIN (VALUES
  ('SOULTRIPS CP',  4200::numeric, 3600::numeric),
  ('SOULTRIPS MAP', 5600::numeric, 4200::numeric)
) AS t(label, amount_btn, amount_single_btn)
WHERE p.slug = 'pelbu-olakha'
  AND a.login_code = 'SOULTRIPS';

UPDATE public.agent_property_links apl
SET notes = 'Contract 2026 · Deluxe CP S3600/D4200 · MAP S4200/D5600 · incl 10% SC',
    updated_at = now()
FROM public.agents a, public.properties p
WHERE apl.agent_id = a.id
  AND apl.property_id = p.id
  AND a.login_code = 'SOULTRIPS'
  AND p.slug = 'pelbu-olakha';

COMMIT;

SELECT rt.code, rr.label, rr.season_kind,
       rr.amount_single_btn AS single_btn, rr.amount_btn AS double_btn
FROM public.room_rates rr
JOIN public.room_types rt ON rt.id = rr.room_type_id
JOIN public.agents a ON a.id = rr.agent_id
JOIN public.properties p ON p.id = rr.property_id
WHERE a.login_code = 'SOULTRIPS' AND p.slug = 'pelbu-olakha'
ORDER BY rr.label, rt.code, rr.season_kind;

SELECT count(*) AS soultrip_rate_rows
FROM public.room_rates rr
JOIN public.agents a ON a.id = rr.agent_id
JOIN public.properties p ON p.id = rr.property_id
WHERE a.login_code = 'SOULTRIPS' AND p.slug = 'pelbu-olakha'
  AND rr.label IN ('SOULTRIPS CP', 'SOULTRIPS MAP');
SQL
