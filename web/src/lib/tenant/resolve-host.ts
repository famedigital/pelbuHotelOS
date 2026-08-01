import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";

/**
 * Resolve property id from request Host header.
 * Falls back to flagship slug when no public_host / desk_host match.
 */
export async function resolvePropertyIdFromHost(
  hostHeader: string | null,
): Promise<{ propertyId: string; slug: string; via: "host" | "flagship" }> {
  const host = (hostHeader ?? "")
    .split(":")[0]
    ?.trim()
    .toLowerCase();
  const admin = createSupabaseAdminClient();

  if (host) {
    const { data: byPublic } = await admin
      .from("properties")
      .select("id, slug")
      .ilike("public_host", host)
      .maybeSingle();
    if (byPublic?.id) {
      return {
        propertyId: byPublic.id as string,
        slug: byPublic.slug as string,
        via: "host",
      };
    }
    const { data: byDesk } = await admin
      .from("properties")
      .select("id, slug")
      .ilike("desk_host", host)
      .maybeSingle();
    if (byDesk?.id) {
      return {
        propertyId: byDesk.id as string,
        slug: byDesk.slug as string,
        via: "host",
      };
    }
  }

  const { data: flagship } = await admin
    .from("properties")
    .select("id, slug")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .single();
  if (!flagship) {
    throw new Error("Flagship property is not configured.");
  }
  return {
    propertyId: flagship.id as string,
    slug: flagship.slug as string,
    via: "flagship",
  };
}
