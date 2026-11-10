/**
 * Apply additive v2 migrations (20261107000100–00400) when DATABASE_URL is set.
 * Reads DATABASE_URL from process.env or from repo `web/.env.local` (same as apps/api).
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const WEB_ENV = join(REPO_ROOT, "web", ".env.local");

const MIGRATIONS = [
  "20261107000100_v2_till_expenses_saas_marketplace.sql",
  "20261107000200_v2_night_audit_rpc_shim.sql",
  "20261107000300_v2_post_folio_payment_atomic.sql",
  "20261107000400_v2_registry_write_atomic.sql",
];

function parseEnvFile(contents) {
  const out = {};
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadDatabaseUrl() {
  const fromProc = process.env.DATABASE_URL?.trim();
  if (fromProc) return fromProc;
  if (!existsSync(WEB_ENV)) return "";
  try {
    const parsed = parseEnvFile(readFileSync(WEB_ENV, "utf8"));
    return parsed.DATABASE_URL?.trim() || "";
  } catch {
    return "";
  }
}

const databaseUrl = loadDatabaseUrl();
if (!databaseUrl) {
  console.error(
    "[apply-v2-migrations] Set DATABASE_URL (postgresql://...) in web/.env.local or env to apply SQL migrations.",
  );
  process.exit(1);
}

const psql = spawnSync("where", ["psql"], {
  encoding: "utf8",
  shell: true,
});
if (psql.status !== 0 || !psql.stdout?.trim()) {
  console.error(
    "[apply-v2-migrations] psql not found on PATH. Install PostgreSQL client tools or run each file with psql manually (see supabase/README.md).",
  );
  process.exit(1);
}

let failed = false;
for (const name of MIGRATIONS) {
  const file = join(REPO_ROOT, "supabase", "migrations", name);
  if (!existsSync(file)) {
    console.error(`[apply-v2-migrations] missing file: ${file}`);
    failed = true;
    break;
  }
  const r = spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", file], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  if (r.status !== 0) {
    console.error(`[apply-v2-migrations] FAILED ${name}`);
    if (r.stderr) console.error(r.stderr);
    if (r.stdout) console.error(r.stdout);
    failed = true;
    break;
  }
  console.log(`[apply-v2-migrations] OK ${name}`);
}

if (failed) process.exit(1);
