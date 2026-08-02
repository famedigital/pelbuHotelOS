/**
 * Server-only desk property helpers.
 * Keep this separate from `@/lib/erp-lists` so pure date formatters stay
 * safe for Client Components (Stay Hub, POS UI, etc.).
 */
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveActivePropertyId } from "@/lib/property-context";

export async function requireDeskPropertyId(): Promise<string> {
  const admin = createSupabaseAdminClient();
  return resolveActivePropertyId(admin);
}
