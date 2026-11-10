import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Migrations live in repo-root `supabase/migrations/` (shared with Innora v1). */

export type HotelOsSupabase = SupabaseClient;

export function createServiceClient(
  url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
): HotelOsSupabase {
  if (!url?.trim() || !serviceRoleKey?.trim()) {
    throw new Error(
      "@hotel-os/db: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }
  return createClient(url.trim(), serviceRoleKey.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createAnonClient(
  url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
): HotelOsSupabase {
  if (!url?.trim() || !anonKey?.trim()) {
    throw new Error(
      "@hotel-os/db: SUPABASE_URL and SUPABASE_ANON_KEY are required",
    );
  }
  return createClient(url.trim(), anonKey.trim(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const DEFAULT_PROPERTY_SLUG =
  process.env.DEFAULT_PROPERTY_SLUG?.trim() || "pelbu-olakha";
