import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolvePublicPropertyId } from "@/lib/tenant/resolve-public-property";

export type PublicPropertyProfile = {
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  whatsapp: string | null;
  mapsUrl: string | null;
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
};

/** Instagram is stored as a handle; render it as a profile URL. */
function instagramUrl(handle: string | null): string | null {
  if (!handle) return null;
  const clean = handle.trim().replace(/^@/, "");
  if (!clean) return null;
  return clean.startsWith("http")
    ? clean
    : `https://instagram.com/${encodeURIComponent(clean)}`;
}

/** Public NAP fields only — never invent missing contact values. */
export async function loadPublicPropertyProfile(): Promise<PublicPropertyProfile | null> {
  const propertyId = await resolvePublicPropertyId();
  if (!propertyId) return null;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("properties")
    .select(
      "name, phone, email, address, whatsapp, maps_url, instagram_handle, facebook_url, tiktok_url",
    )
    .eq("id", propertyId)
    .maybeSingle();

  if (!data) return null;

  return {
    name: (data.name as string) || "Pelbu Suites",
    phone: (data.phone as string | null) ?? null,
    email: (data.email as string | null) ?? null,
    address: (data.address as string | null) ?? null,
    whatsapp: (data.whatsapp as string | null) ?? null,
    mapsUrl: (data.maps_url as string | null) ?? null,
    instagram: instagramUrl((data.instagram_handle as string | null) ?? null),
    facebook: (data.facebook_url as string | null) ?? null,
    tiktok: (data.tiktok_url as string | null) ?? null,
  };
}
