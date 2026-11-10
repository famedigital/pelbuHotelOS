/** Runs inside hos-v2-api container — uses postgres-js from workspace if present, else raw TCP via child. */
import { randomBytes, scryptSync } from "node:crypto";
import { spawnSync } from "node:child_process";

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

function sqlEscape(s) {
  return String(s).replace(/'/g, "''");
}

function psql(sql) {
  const r = spawnSync(
    "node",
    [
      "-e",
      `
const postgres = require('/app/node_modules/postgres/cjs/src/index.js');
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
(async () => {
  try {
    await sql.unsafe(process.env.SEED_SQL);
    console.log('OK');
    await sql.end({ timeout: 2 });
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
`,
    ],
    {
      env: { ...process.env, DATABASE_URL: url, SEED_SQL: sql },
      encoding: "utf8",
    },
  );
  if (r.status !== 0) {
    // fallback: try workspace path
    const r2 = spawnSync(
      "psql",
      [url, "-v", "ON_ERROR_STOP=1", "-c", sql],
      { encoding: "utf8" },
    );
    if (r2.status !== 0) {
      console.error(r.stdout, r.stderr, r2.stdout, r2.stderr);
      process.exit(1);
    }
  }
}

const deskHash = hashPin(DESK_CODE);
const portalHash = hashPin(PORTAL_PIN);

psql(`
UPDATE v2.properties
SET desk_access_code_hash = '${sqlEscape(deskHash)}',
    desk_access_code_hint = 'Owner desk code (rotated at cutover)'
WHERE slug IN ('pelbu-olakha', 'pelbu-suites-olakha');
`);

psql(`
INSERT INTO v2.portal_accounts
  (property_id, role, subject_id, login_code, display_name, pin_hash, pin_reset_required, home_route)
SELECT a.property_id, 'agent', a.id, upper(a.code), a.name,
       '${sqlEscape(portalHash)}', true, '/partner'
FROM v2.agents a
JOIN v2.properties p ON p.id = a.property_id
WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha')
ON CONFLICT (property_id, role, login_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  subject_id = EXCLUDED.subject_id,
  pin_hash = EXCLUDED.pin_hash,
  pin_reset_required = true,
  updated_at = now();
`);

psql(`
INSERT INTO v2.portal_accounts
  (property_id, role, subject_id, login_code, display_name, pin_hash, pin_reset_required, home_route)
SELECT g.property_id, 'guide', g.id, upper(left(coalesce(g.tcr_license_no, g.id::text), 24)), g.full_name,
       '${sqlEscape(portalHash)}', true, '/guide'
FROM v2.tour_guides g
JOIN v2.properties p ON p.id = g.property_id
WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha') AND g.active
ON CONFLICT (property_id, role, login_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  pin_hash = EXCLUDED.pin_hash,
  pin_reset_required = true,
  updated_at = now();
`);

psql(`
INSERT INTO v2.portal_accounts
  (property_id, role, subject_id, login_code, display_name, pin_hash, pin_reset_required, home_route)
SELECT v.property_id, 'driver', v.id, upper(replace(v.plate, ' ', '')), coalesce(v.driver_name, v.plate),
       '${sqlEscape(portalHash)}', true, '/driver'
FROM v2.fleet_vehicles v
JOIN v2.properties p ON p.id = v.property_id
WHERE p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha') AND v.active
ON CONFLICT (property_id, role, login_code) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  pin_hash = EXCLUDED.pin_hash,
  pin_reset_required = true,
  updated_at = now();
`);

console.log("SEED OK desk+portal (first portal PIN requires confirm on login)");
