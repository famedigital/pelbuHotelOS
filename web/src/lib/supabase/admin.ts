import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl, requireEnv } from "./env";

/**
 * Service-role client for trusted server actions only.
 * Never import this into Client Components.
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
