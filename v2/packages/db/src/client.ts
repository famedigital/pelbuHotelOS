/**
 * Drizzle + postgres.js client for schema `v2`.
 * Hard-law paths must call requireDb() — no silent memory fallback.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type Db = ReturnType<typeof createDb>;

let singleton: Db | null = null;
let sqlClient: ReturnType<typeof postgres> | null = null;

export function getDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL?.trim();
  return url || undefined;
}

export function createDb(url: string) {
  const client = postgres(url, { max: 10, prepare: false });
  return drizzle(client, { schema });
}

/** Bind process-wide singleton from DATABASE_URL. Returns null when unset. */
export function initDbFromEnv(): Db | null {
  const url = getDatabaseUrl();
  if (!url) {
    singleton = null;
    sqlClient = null;
    return null;
  }
  sqlClient = postgres(url, { max: 10, prepare: false });
  singleton = drizzle(sqlClient, { schema });
  return singleton;
}

export function getDb(): Db | null {
  return singleton;
}

export type RequireDbResult =
  | { ok: true; db: Db }
  | { ok: false; error: "DATABASE_REQUIRED" };

export function requireDb(): RequireDbResult {
  if (!singleton) return { ok: false, error: "DATABASE_REQUIRED" };
  return { ok: true, db: singleton };
}

/** Raw SQL runner for ADR-001 public.bookings guard. */
export async function queryRaw(sqlText: string): Promise<unknown> {
  if (!sqlClient) {
    throw new Error("DATABASE_REQUIRED");
  }
  return sqlClient.unsafe(sqlText);
}

export async function closeDb(): Promise<void> {
  if (sqlClient) {
    await sqlClient.end({ timeout: 5 });
  }
  sqlClient = null;
  singleton = null;
}
