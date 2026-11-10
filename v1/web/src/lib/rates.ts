import { DEFAULT_PROPERTY_SLUG } from "@/lib/property";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Rate-sheet lookups moved to `@hotel-os/core/rates` (shared with Hotel OS v2
 * room-night posting). Innora-only property bootstrap stays here.
 */
export * from "@hotel-os/core/rates";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export async function pelbuPropertyId(admin: Admin): Promise<string> {
  const { data: property, error } = await admin
    .from("properties")
    .select("id")
    .eq("slug", DEFAULT_PROPERTY_SLUG)
    .single();
  if (error || !property) {
    throw new Error("Hotel property is not configured.");
  }
  return property.id as string;
}
