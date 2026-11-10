/**
 * Loads Supabase and optional DB URL keys from `web/.env.local` when `apps/api`
 * is run without its own `.env`. Innora and v2 share the same droplet project;
 * this mirrors those values into `process.env` for `@hotel-os/db` (without
 * printing secrets).
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function findWebEnvLocalPath(): string | null {
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, "web", ".env.local");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** Keys copied from Innora local env when unset on the API process. */
const KEYS_FROM_WEB = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "DATABASE_URL",
  "DEFAULT_PROPERTY_SLUG",
  "FLAGSHIP_PROPERTY_SLUG",
  "HOTEL_OS_JWT_SECRET",
] as const;

function parseEnvFile(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
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

export function loadWebEnvLocalIfPresent(): void {
  const path = findWebEnvLocalPath();
  if (!path) return;
  try {
    const parsed = parseEnvFile(readFileSync(path, "utf8"));
    for (const k of KEYS_FROM_WEB) {
      const v = parsed[k];
      if (v && !String(process.env[k] ?? "").trim()) {
        process.env[k] = v;
      }
    }
    if (!String(process.env.SUPABASE_URL ?? "").trim() && parsed.NEXT_PUBLIC_SUPABASE_URL) {
      process.env.SUPABASE_URL = parsed.NEXT_PUBLIC_SUPABASE_URL;
    }
    if (!String(process.env.SUPABASE_ANON_KEY ?? "").trim() && parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      process.env.SUPABASE_ANON_KEY = parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    }
    if (!String(process.env.DEFAULT_PROPERTY_SLUG ?? "").trim() && parsed.FLAGSHIP_PROPERTY_SLUG?.trim()) {
      process.env.DEFAULT_PROPERTY_SLUG = parsed.FLAGSHIP_PROPERTY_SLUG.trim();
    }
  } catch (err) {
    console.warn("[hotel-os/api] could not read web/.env.local", err);
  }
}

loadWebEnvLocalIfPresent();
