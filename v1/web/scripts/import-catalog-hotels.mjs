/**
 * Import catalog hotels (reference only) from touritinerary hotels.json.
 *
 * Usage (from web/):
 *   node --env-file=.env.local scripts/import-catalog-hotels.mjs
 *   node --env-file=.env.local scripts/import-catalog-hotels.mjs --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_JSON = resolve(
  __dirname,
  "../../../touritinerary creation/data/html-references/bhutan-ops-catalog/hotels.json",
);
const FALLBACK_JSON = resolve(__dirname, "../data/catalog-hotels.seed.json");
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
    : DEFAULT_JSON;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!existsSync(JSON_PATH)) {
  console.error("Hotels JSON not found:", JSON_PATH);
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const rows = JSON.parse(readFileSync(JSON_PATH, "utf8"));
console.log(`Loaded ${rows.length} hotels from ${JSON_PATH}`);
if (DRY_RUN) {
  console.log("Dry run — first:", rows[0]);
  process.exit(0);
}

let upserted = 0;
const batch = 40;
for (let i = 0; i < rows.length; i += batch) {
  const chunk = rows.slice(i, i + batch).map((h) => ({
    name: String(h.name ?? "").trim(),
    city: h.city ? String(h.city) : null,
    star_rating: h.star_rating != null ? Number(h.star_rating) : null,
    category: h.category ? String(h.category) : null,
    phone: h.phone ? String(h.phone) : null,
    email: h.email ? String(h.email) : null,
    image_url: h.image_url ? String(h.image_url) : null,
    source: "touritinerary",
  }));

  const { error } = await admin.from("catalog_hotels").upsert(chunk, {
    onConflict: "name,city",
  });
  if (error) {
    console.error("Upsert failed at offset", i, error.message);
    process.exit(1);
  }
  upserted += chunk.length;
  console.log(`Upserted ${upserted}/${rows.length}`);
}

console.log("Done. These are reference only — not tenants / login codes.");
