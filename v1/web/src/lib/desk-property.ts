/**
 * Server-only desk property helpers.
 * Keep this separate from `@/lib/erp-lists` so pure date formatters stay
 * safe for Client Components (Stay Hub, POS UI, etc.).
 */
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveActivePropertyId } from "@/lib/property-context";

const requireDeskPropertyIdCached = cache(async (): Promise<string> => {
  const admin = createSupabaseAdminClient();
  return resolveActivePropertyId(admin);
});

export async function requireDeskPropertyId(): Promise<string> {
  return requireDeskPropertyIdCached();
}
