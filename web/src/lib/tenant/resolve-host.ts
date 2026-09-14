import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_PROPERTY_SLUG } from "@/lib/property";

/**
 * Resolve property id from request Host header.
 * Falls back to flagship slug when no public_host / desk_host match.
 *
 * Prefer a single round-trip when host is set (or-filter) then flagship —
 * still used from pages when middleware skips headers on deadline.
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
    // Quote host for PostgREST (dots in domain names).
    const q = `"${host.replace(/"/g, "")}"`;
    const { data: matches, error } = await admin
      .from("properties")
      .select("id, slug, public_host, desk_host")
      .or(`public_host.ilike.${q},desk_host.ilike.${q}`)
      .limit(4);

    if (!error && matches?.length) {
      const exact = matches.find(
        (row) =>
          (row.public_host as string | null)?.toLowerCase() === host ||
          (row.desk_host as string | null)?.toLowerCase() === host,
      );
      const hit = exact ?? matches[0];
      if (hit?.id) {
        return {
          propertyId: hit.id as string,
          slug: hit.slug as string,
          via: "host",
        };
      }
    }
  }

  const { data: flagship } = await admin
    .from("properties")
    .select("id, slug")
    .eq("slug", DEFAULT_PROPERTY_SLUG)
    .maybeSingle();
  if (!flagship?.id) {
    throw new Error("Flagship property is not configured.");
  }
  return {
    propertyId: flagship.id as string,
    slug: flagship.slug as string,
    via: "flagship",
  };
}
