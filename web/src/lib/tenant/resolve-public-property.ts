import { cache } from "react";
import { headers } from "next/headers";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolvePropertyIdFromHost } from "@/lib/tenant/resolve-host";
import {
  flagshipPropertyIdFromEnv,
  isFlagshipHost,
} from "@/lib/free-tier";

/**
 * Public site property id: prefer middleware Host resolution
 * (`x-pelbu-property-id`), else resolve from the request Host, then flagship.
 * Request-deduped via React.cache.
 */
export const resolvePublicPropertyId = cache(
  async (): Promise<string | null> => {
    try {
      const h = await headers();
      const fromHost = h.get("x-pelbu-property-id")?.trim();
      const via = h.get("x-pelbu-tenant-via")?.trim();
      const hostHeader = h.get("host");

      // Middleware already resolved flagship (env id or host map) — trust it.
      if (
        fromHost &&
        (via === "flagship" ||
          fromHost === flagshipPropertyIdFromEnv() ||
          isFlagshipHost(hostHeader))
      ) {
        return fromHost;
      }

      if (fromHost) {
        const admin = createSupabaseAdminClient();
        const { data } = await admin
          .from("properties")
          .select("id")
          .eq("id", fromHost)
          .maybeSingle();
        if (data?.id) return data.id as string;
      }

      if (hostHeader && !hostHeader.includes("localhost")) {
        const resolved = await resolvePropertyIdFromHost(hostHeader);
        return resolved.propertyId;
      }
    } catch {
      // headers() unavailable outside a request
    }

    const envId = flagshipPropertyIdFromEnv();
    if (envId) return envId;

    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("properties")
      .select("id")
      .eq("slug", PELBU_PROPERTY_SLUG)
      .maybeSingle();
    return (data?.id as string | undefined) ?? null;
  },
);
