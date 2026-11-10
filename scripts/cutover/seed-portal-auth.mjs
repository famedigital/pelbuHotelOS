/**
 * Seed hotel desk access codes + portal accounts from existing agents/guides/fleet.
 * Usage: node scripts/cutover/seed-portal-auth.mjs
 * Requires DATABASE_URL (postgres://v2_app:...@...).
 */
import { createHash, randomBytes, scryptSync } from "node:crypto";
import pg from "pg";

const PIN_PREFIX = "scrypt$";
function hashPin(pin) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 32).toString("hex");
  return `${PIN_PREFIX}${salt}$${hash}`;
}

const DESK_CODE = process.env.SEED_DESK_CODE || "PELBU2026";
const PORTAL_PIN = process.env.SEED_PORTAL_PIN || "2468";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

const deskHash = hashPin(DESK_CODE);
await client.query(
  `UPDATE v2.properties
   SET desk_access_code_hash = $1,
       desk_access_code_hint = 'Owner desk code (rotated at cutover)'
   WHERE slug IN ('pelbu-olakha', 'pelbu-suites-olakha')`,
  [deskHash],
);
console.log("desk codes set for Olakha + DEMO (code env SEED_DESK_CODE)");

const portalHash = hashPin(PORTAL_PIN);

const agents = await client.query(
  `SELECT a.id, a.property_id, a.code, a.name
   FROM v2.agents a
   JOIN v2.properties p ON p.id = a.property_id
   WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha')`,
);
for (const a of agents.rows) {
  await client.query(
    `INSERT INTO v2.portal_accounts
       (property_id, role, subject_id, login_code, display_name, pin_hash, pin_reset_required, home_route)
     VALUES ($1, 'agent', $2, $3, $4, $5, true, '/partner')
     ON CONFLICT (property_id, role, login_code) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       subject_id = EXCLUDED.subject_id,
       pin_hash = EXCLUDED.pin_hash,
       pin_reset_required = true,
       version = v2.portal_accounts.version + 1,
       updated_at = now()`,
    [a.property_id, a.id, String(a.code).toUpperCase(), a.name, portalHash],
  );
}
console.log(`agents portal rows: ${agents.rowCount}`);

const guides = await client.query(
  `SELECT g.id, g.property_id, g.tcr_license_no, g.full_name
   FROM v2.tour_guides g
   JOIN v2.properties p ON p.id = g.property_id
   WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha') AND g.active`,
);
for (const g of guides.rows) {
  const code = String(g.tcr_license_no || g.id).slice(0, 24).toUpperCase();
  await client.query(
    `INSERT INTO v2.portal_accounts
       (property_id, role, subject_id, login_code, display_name, pin_hash, pin_reset_required, home_route)
     VALUES ($1, 'guide', $2, $3, $4, $5, true, '/guide')
     ON CONFLICT (property_id, role, login_code) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       pin_hash = EXCLUDED.pin_hash,
       pin_reset_required = true,
       updated_at = now()`,
    [g.property_id, g.id, code, g.full_name, portalHash],
  );
}
console.log(`guides portal rows: ${guides.rowCount}`);

const fleet = await client.query(
  `SELECT v.id, v.property_id, v.plate, coalesce(v.driver_name, v.plate) AS display_name
   FROM v2.fleet_vehicles v
   JOIN v2.properties p ON p.id = v.property_id
   WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha') AND v.active`,
);
for (const v of fleet.rows) {
  const code = String(v.plate).replace(/\s+/g, "").toUpperCase();
  await client.query(
    `INSERT INTO v2.portal_accounts
       (property_id, role, subject_id, login_code, display_name, pin_hash, pin_reset_required, home_route)
     VALUES ($1, 'driver', $2, $3, $4, $5, true, '/driver')
     ON CONFLICT (property_id, role, login_code) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       pin_hash = EXCLUDED.pin_hash,
       pin_reset_required = true,
       updated_at = now()`,
    [v.property_id, v.id, code, v.display_name, portalHash],
  );
}
console.log(`drivers portal rows: ${fleet.rowCount}`);

await client.end();
console.log("SEED OK — desk code + portal first PIN require reset on login");
console.log(`fingerprint ${createHash("sha256").update(DESK_CODE).digest("hex").slice(0, 8)}`);
