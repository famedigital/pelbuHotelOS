/**
 * Import national guides from touritinerary bhutan-ops-catalog/guides.json
 * into national_guides (verified).
 *
 * Usage (from web/):
 *   node --env-file=.env.local scripts/import-national-guides.mjs
 *   node --env-file=.env.local scripts/import-national-guides.mjs --dry-run
 *   node --env-file=.env.local scripts/import-national-guides.mjs --json="C:/GitHub/touritinerary creation/data/html-references/bhutan-ops-catalog/guides.json"
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_JSON = resolve(
  __dirname,
  "../../../touritinerary creation/data/html-references/bhutan-ops-catalog/guides.json",
);
const FALLBACK_JSON = join(__dirname, "../data/national-guides.seed.json");
const DRY_RUN = process.argv.includes("--dry-run");

function argValue(prefix) {
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

const jsonArg = argValue("--json=");
const JSON_PATH = jsonArg
  ? resolve(process.cwd(), jsonArg)
  : existsSync(FALLBACK_JSON)
    ? FALLBACK_JSON
    : existsSync(DEFAULT_JSON)
      ? DEFAULT_JSON
      : FALLBACK_JSON;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (!existsSync(JSON_PATH)) {
  console.error("Guides JSON not found:", JSON_PATH);
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const rows = JSON.parse(readFileSync(JSON_PATH, "utf8"));
if (!Array.isArray(rows)) {
  console.error("Expected array in", JSON_PATH);
  process.exit(1);
}

console.log(`Loaded ${rows.length} guides from ${JSON_PATH}`);
if (DRY_RUN) {
  console.log("Dry run — first row:", rows[0]);
  process.exit(0);
}

let upserted = 0;
const batch = 40;
for (let i = 0; i < rows.length; i += batch) {
  const chunk = rows.slice(i, i + batch).map((g) => ({
    license_no: String(g.license_no ?? g.id ?? "").trim() || `UNK-${g.id}`,
    full_name: String(g.name ?? g.full_name ?? "Unknown").trim(),
    phone: g.phone ? String(g.phone) : null,
    city: g.city ? String(g.city) : null,
    languages: Array.isArray(g.languages) ? g.languages : ["English"],
    guide_type: g.guide_type ? String(g.guide_type) : null,
    gender: g.gender && g.gender !== "unknown" ? String(g.gender) : null,
    status: "verified",
    cost_per_day_inr: g.cost_per_day_inr != null ? Number(g.cost_per_day_inr) : null,
    cost_per_day_usd: g.cost_per_day_usd != null ? Number(g.cost_per_day_usd) : null,
    source: "touritinerary",
    verified_at: new Date().toISOString(),
    verified_by_email: "import@innora.local",
    updated_at: new Date().toISOString(),
  }));

  const { error } = await admin.from("national_guides").upsert(chunk, {
    onConflict: "license_no",
  });
  if (error) {
    console.error("Upsert failed at offset", i, error.message);
    process.exit(1);
  }
  upserted += chunk.length;
  console.log(`Upserted ${upserted}/${rows.length}`);
}

console.log("Done.");
