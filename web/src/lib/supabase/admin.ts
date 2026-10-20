import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl, requireEnv } from "./env";

/**
 * Service-role client for trusted server actions / RSC only (SEC-01).
 * Never import into Client Components — use staff-scoped browser client instead.
 */
export function createSupabaseAdminClient() {
  return createClient(
    getSupabaseUrl(),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
