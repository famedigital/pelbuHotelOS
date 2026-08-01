import { headers } from "next/headers";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolvePropertyIdFromHost } from "@/lib/tenant/resolve-host";

/**
 * Public site property id: prefer middleware Host resolution
 * (`x-pelbu-property-id`), else resolve from the request Host, then flagship.
 * Safe for Olakha on localhost (no host match → flagship).
 */
export async function resolvePublicPropertyId(): Promise<string | null> {
  const admin = createSupabaseAdminClient();

  try {
    const h = await headers();
    const fromHost = h.get("x-pelbu-property-id")?.trim();
    if (fromHost) {
      const { data } = await admin
        .from("properties")
        .select("id")
        .eq("id", fromHost)
        .maybeSingle();
      if (data?.id) return data.id as string;
    }

    const hostHeader = h.get("host");
    if (hostHeader && !hostHeader.includes("localhost")) {
      const resolved = await resolvePropertyIdFromHost(hostHeader);
      return resolved.propertyId;
    }
  } catch {
    // headers() unavailable outside a request
  }

  const { data } = await admin
    .from("properties")
    .select("id")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
