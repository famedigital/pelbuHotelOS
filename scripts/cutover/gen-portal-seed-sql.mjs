/** Emit SQL with scrypt hashes for desk + portal seed. */
import { randomBytes, scryptSync } from "node:crypto";
import { writeFileSync } from "node:fs";

const PIN_PREFIX = "scrypt$";
function hashPin(pin) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 32).toString("hex");
  return `${PIN_PREFIX}${salt}$${hash}`;
}
function esc(s) {
  return String(s).replace(/'/g, "''");
}

const DESK_CODE = process.env.SEED_DESK_CODE || "PELBU2026";
const PORTAL_PIN = process.env.SEED_PORTAL_PIN || "2468";
const deskHash = hashPin(DESK_CODE);
const portalHash = hashPin(PORTAL_PIN);

const sql = `-- generated portal seed
UPDATE v2.properties
SET desk_access_code_hash = '${esc(deskHash)}',
    desk_access_code_hint = 'Owner desk code (rotated at cutover)'
WHERE slug IN ('pelbu-olakha', 'pelbu-suites-olakha');

INSERT INTO v2.portal_accounts
  (property_id, role, subject_id, login_code, display_name, pin_hash, pin_reset_required, home_route)
SELECT a.property_id, 'agent', a.id, upper(a.code), a.name,
       '${esc(portalHash)}', true, '/partner'
FROM v2.agents a
JOIN v2.properties p ON p.id = a.property_id
WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha')
ON CONFLICT (property_id, role, login_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  subject_id = EXCLUDED.subject_id,
  pin_hash = EXCLUDED.pin_hash,
  pin_reset_required = true,
  updated_at = now();

INSERT INTO v2.portal_accounts
  (property_id, role, subject_id, login_code, display_name, pin_hash, pin_reset_required, home_route)
SELECT g.property_id, 'guide', g.id, upper(left(coalesce(g.tcr_license_no, g.id::text), 24)), g.full_name,
       '${esc(portalHash)}', true, '/guide'
FROM v2.tour_guides g
JOIN v2.properties p ON p.id = g.property_id
WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha') AND g.active
ON CONFLICT (property_id, role, login_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  pin_hash = EXCLUDED.pin_hash,
  pin_reset_required = true,
  updated_at = now();

INSERT INTO v2.portal_accounts
  (property_id, role, subject_id, login_code, display_name, pin_hash, pin_reset_required, home_route)
SELECT v.property_id, 'driver', v.id, upper(replace(v.plate, ' ', '')), coalesce(v.driver_name, v.plate),
       '${esc(portalHash)}', true, '/driver'
FROM v2.fleet_vehicles v
JOIN v2.properties p ON p.id = v.property_id
WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha') AND v.active
ON CONFLICT (property_id, role, login_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  pin_hash = EXCLUDED.pin_hash,
  pin_reset_required = true,
  updated_at = now();
`;

const out = process.argv[2] || "portal-seed.sql";
writeFileSync(out, sql);
console.log(`wrote ${out} (desk=${DESK_CODE} portalPin=${PORTAL_PIN} — rotate after first login)`);
