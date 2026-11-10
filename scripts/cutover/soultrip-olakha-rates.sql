-- SOULTRIPS contract rates · Pelbu Suites Olakha · 2026
-- Incl. 10% S.C. package tariffs (GST not charged at present).
--
--   CP:  single 3,600 · double 4,200
--   MAP: single 4,200 · double 5,600
--
-- Re-runnable. Desk draws offers labeled "SOULTRIPS CP" / "SOULTRIPS MAP".

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
