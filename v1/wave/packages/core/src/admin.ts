import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role database client injected into every core money/ops function.
 *
 * Type-only import: core never constructs a client and never reads env. Innora
 * passes `createSupabaseAdminClient()`; Hotel OS v2 passes
 * `createServiceClient()` from `@hotel-os/db`. Both are supabase-js clients
 * talking to the same droplet Postgres, so posting rules, journals and RPCs
 * are identical across v1 and v2.
 */
export type Admin = SupabaseClient;
