#!/usr/bin/env node
/**
 * public → v2 inventory ETL runner (dry-run | apply).
 * Usage:
 *   DATABASE_URL=postgres://... node v2/scripts/etl/run-etl.mjs --dry-run
 *   DATABASE_URL=postgres://... node v2/scripts/etl/run-etl.mjs --apply
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false });

const countsSql = `
SELECT 'public_properties' AS k, count(*)::int AS n FROM public.properties WHERE slug IN ('pelbu-olakha','pelbu-suites-olakha')
UNION ALL SELECT 'public_room_types', count(*)::int FROM public.room_types rt JOIN public.properties p ON p.id=rt.property_id WHERE p.slug IN ('pelbu-olakha','pelbu-suites-olakha')
UNION ALL SELECT 'public_rooms', count(*)::int FROM public.room_units ru JOIN public.properties p ON p.id=ru.property_id WHERE p.slug IN ('pelbu-olakha','pelbu-suites-olakha')
UNION ALL SELECT 'public_staff_login', count(*)::int FROM public.staff_members s JOIN public.properties p ON p.id=s.property_id WHERE p.slug IN ('pelbu-olakha','pelbu-suites-olakha') AND (s.can_login OR s.can_access_desk)
UNION ALL SELECT 'v2_properties', count(*)::int FROM v2.properties WHERE slug IN ('pelbu-olakha','pelbu-suites-olakha')
UNION ALL SELECT 'v2_rooms', count(*)::int FROM v2.rooms r JOIN v2.properties p ON p.id=r.property_id WHERE p.slug IN ('pelbu-olakha','pelbu-suites-olakha')
UNION ALL SELECT 'v2_staff_login', count(*)::int FROM v2.staff s JOIN v2.properties p ON p.id=s.property_id WHERE p.slug IN ('pelbu-olakha','pelbu-suites-olakha') AND s.can_login
ORDER BY 1;
`;

try {
  console.log(`=== ETL mode=${mode} ===`);
  const before = await sql.unsafe(countsSql);
  console.table(before);

  if (mode === "dry-run") {
    console.log("Dry-run only — no writes. Re-run with --apply.");
    process.exit(0);
  }

  await sql.unsafe(`SELECT set_config('hos.etl_mode', 'apply', false)`);
  const body = readFileSync(join(__dirname, "01_org_properties_rooms_staff.sql"), "utf8");
  await sql.unsafe(body);

  const after = await sql.unsafe(countsSql);
  console.log("=== after ===");
  console.table(after);
  console.log("ETL apply OK — staff must set PIN on first Pin Gateway unlock.");
} catch (err) {
  console.error("ETL failed:", err);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
