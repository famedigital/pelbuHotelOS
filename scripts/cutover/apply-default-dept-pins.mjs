/**
 * Upsert department desk PINs on every v2 property (Pelbu + defaults for others).
 *
 * 9999 Reservation · 1111 FO · 2222 FNB · 3333 HK · 4444 Kitchen · 0000 OWNER
 *
 * Usage (droplet, with DATABASE_URL or via docker exec node against supabase):
 *   node scripts/cutover/apply-default-dept-pins.mjs
 * Or generate SQL only:
 *   node scripts/cutover/apply-default-dept-pins.mjs --sql > /tmp/dept-pins.sql
 */
import { randomBytes, scryptSync } from "node:crypto";
import { writeFileSync } from "node:fs";

const PIN_PREFIX = "scrypt$";

function hashPin(pin) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 32).toString("hex");
  return `${PIN_PREFIX}${salt}$${hash}`;
}

const DEPTS = [
  {
    code: "DEPT-RES",
    name: "Reservation",
    deskRole: "reservations",
    home: "/reservations",
    pin: "9999",
    role: "reservations",
  },
  {
    code: "DEPT-FO",
    name: "Front Office",
    deskRole: "fo",
    home: "/desk",
    pin: "1111",
    role: "fo",
  },
  {
    code: "DEPT-FNB",
    name: "F&B",
    deskRole: "fnb",
    home: "/pos",
    pin: "2222",
    role: "fnb",
  },
  {
    code: "DEPT-HK",
    name: "Housekeeping",
    deskRole: "hk",
    home: "/housekeeping",
    pin: "3333",
    role: "hk",
  },
  {
    code: "DEPT-KIT",
    name: "Kitchen",
    deskRole: "kitchen",
    home: "/kds",
    pin: "4444",
    role: "kitchen",
  },
  {
    code: "DEPT-OWN",
    name: "Owner",
    deskRole: "owner",
    home: "/owner",
    pin: "0000",
    role: "owner",
  },
];

function esc(s) {
  return String(s).replace(/'/g, "''");
}

function buildSql() {
  const hashes = Object.fromEntries(DEPTS.map((d) => [d.pin, hashPin(d.pin)]));
  const lines = [];
  lines.push("-- Default department desk PINs (all properties)");
  lines.push("BEGIN;");
  lines.push("");
  lines.push(`/* Fix Pelbu live FO role drift before PIN map */`);
  lines.push(`UPDATE v2.staff s`);
  lines.push(`SET desk_role = 'reservations',`);
  lines.push(`    home_route = '/reservations',`);
  lines.push(`    version = s.version + 1`);
  lines.push(`FROM v2.properties p`);
  lines.push(`WHERE s.property_id = p.id`);
  lines.push(`  AND p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha')`);
  lines.push(`  AND s.employee_code IN ('SAL-01', 'EMP-003')`);
  lines.push(`  AND coalesce(s.desk_role, s.role) IS DISTINCT FROM 'reservations';`);
  lines.push("");
  lines.push(`UPDATE v2.staff s`);
  lines.push(`SET desk_role = 'fo',`);
  lines.push(`    home_route = '/desk',`);
  lines.push(`    version = s.version + 1`);
  lines.push(`FROM v2.properties p`);
  lines.push(`WHERE s.property_id = p.id`);
  lines.push(`  AND p.slug IN ('pelbu-olakha', 'pelbu-suites-olakha')`);
  lines.push(`  AND s.employee_code IN ('MGR-01', 'MGR-02', 'FO-02')`);
  lines.push(`  AND coalesce(s.desk_role, s.role) IS DISTINCT FROM 'fo';`);
  lines.push("");

  for (const d of DEPTS) {
    const hash = hashes[d.pin];
    lines.push(`-- ${d.pin} → ${d.name}`);
    lines.push(`INSERT INTO v2.staff (`);
    lines.push(`  property_id, display_name, role, employee_code, tip_points,`);
    lines.push(`  pin_hash, active, can_login, desk_role, home_route,`);
    lines.push(`  pin_reset_required, pin_set_at, version`);
    lines.push(`)`);
    lines.push(`SELECT`);
    lines.push(`  p.id,`);
    lines.push(`  '${esc(d.name)}',`);
    lines.push(`  '${esc(d.role)}',`);
    lines.push(`  '${esc(d.code)}',`);
    lines.push(`  '2.0',`);
    lines.push(`  '${esc(hash)}',`);
    lines.push(`  true,`);
    lines.push(`  true,`);
    lines.push(`  '${esc(d.deskRole)}',`);
    lines.push(`  '${esc(d.home)}',`);
    lines.push(`  false,`);
    lines.push(`  now(),`);
    lines.push(`  1`);
    lines.push(`FROM v2.properties p`);
    lines.push(`WHERE NOT EXISTS (`);
    lines.push(`  SELECT 1 FROM v2.staff s`);
    lines.push(`  WHERE s.property_id = p.id AND s.employee_code = '${esc(d.code)}'`);
    lines.push(`);`);
    lines.push("");
    lines.push(`UPDATE v2.staff`);
    lines.push(`SET display_name = '${esc(d.name)}',`);
    lines.push(`    role = '${esc(d.role)}',`);
    lines.push(`    desk_role = '${esc(d.deskRole)}',`);
    lines.push(`    home_route = '${esc(d.home)}',`);
    lines.push(`    pin_hash = '${esc(hash)}',`);
    lines.push(`    pin_reset_required = false,`);
    lines.push(`    pin_set_at = now(),`);
    lines.push(`    can_login = true,`);
    lines.push(`    active = true,`);
    lines.push(`    version = version + 1`);
    lines.push(`WHERE employee_code = '${esc(d.code)}';`);
    lines.push("");
  }

  /* Align named staff PINs by desk_role (same dept defaults). */
  const rolePinCases = [
    [
      ["reservations", "reservation", "sales", "res"],
      "9999",
      "/reservations",
      "reservations",
    ],
    [
      ["fo", "fo_agent", "fo_manager", "front_desk", "front_office"],
      "1111",
      "/desk",
      "fo",
    ],
    [
      ["fnb", "cashier", "waiter", "fnb_captain", "fb_manager"],
      "2222",
      "/pos",
      "fnb",
    ],
    [
      ["hk", "housekeeping", "hk_attendant", "hk_supervisor"],
      "3333",
      "/housekeeping",
      "hk",
    ],
    [["kitchen", "chef", "cook"], "4444", "/kds", "kitchen"],
    [["owner", "gm", "admin"], "0000", "/owner", null],
  ];

  for (const [roles, pin, home, forceDesk] of rolePinCases) {
    const inList = roles.map((r) => `'${r}'`).join(", ");
    const hash = hashes[pin];
    lines.push(`-- Named staff → PIN ${pin}`);
    lines.push(`UPDATE v2.staff`);
    lines.push(`SET pin_hash = '${esc(hash)}',`);
    lines.push(`    pin_reset_required = false,`);
    lines.push(`    pin_set_at = now(),`);
    lines.push(`    can_login = true,`);
    lines.push(`    active = true,`);
    if (forceDesk) {
      lines.push(`    desk_role = coalesce(desk_role, '${forceDesk}'),`);
    }
    lines.push(`    home_route = '${esc(home)}',`);
    lines.push(`    version = version + 1`);
    lines.push(`WHERE employee_code NOT LIKE 'DEPT-%'`);
    lines.push(`  AND lower(replace(coalesce(desk_role, role), ' ', '_')) IN (${inList});`);
    lines.push("");
  }

  lines.push(`SELECT p.slug, s.employee_code, s.display_name, s.desk_role, s.home_route`);
  lines.push(`FROM v2.staff s`);
  lines.push(`JOIN v2.properties p ON p.id = s.property_id`);
  lines.push(`WHERE s.employee_code LIKE 'DEPT-%'`);
  lines.push(`ORDER BY p.slug, s.employee_code;`);
  lines.push("");
  lines.push("COMMIT;");
  return lines.join("\n");
}

const sql = buildSql();
const outIdx = process.argv.indexOf("--out");
if (outIdx >= 0 && process.argv[outIdx + 1]) {
  writeFileSync(process.argv[outIdx + 1], sql, "utf8");
  console.error(`Wrote ${process.argv[outIdx + 1]}`);
} else if (process.argv.includes("--sql")) {
  process.stdout.write(sql);
} else {
  writeFileSync("/tmp/hos-default-dept-pins.sql", sql, "utf8");
  console.log("Wrote /tmp/hos-default-dept-pins.sql");
  console.log("Apply: psql … -f /tmp/hos-default-dept-pins.sql");
}
