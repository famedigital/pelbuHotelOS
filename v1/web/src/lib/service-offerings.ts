import { cloudinaryUrl } from "@/lib/cloudinary";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ServiceOffering = {
  id: string;
  kind: "spa" | "steam" | "meeting";
  code: string;
  name: string;
  description: string | null;
  durationMinutes: number | null;
  capacity: number | null;
  priceBtn: number | null;
  imageSrc: string | null;
};

export async function loadServiceOfferings(
  kinds: ServiceOffering["kind"][],
): Promise<ServiceOffering[]> {
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);

  const { data, error } = await admin
    .from("service_offerings")
    .select(
      "id, kind, code, name, description, duration_minutes, capacity, price_btn, image_public_id",
    )
    .eq("property_id", propertyId)
    .eq("is_active", true)
    .in("kind", kinds)
    .order("sort_order");

  if (error) {
    console.error("loadServiceOfferings failed", error);
    return [];
  }

  return (data ?? []).map((row) => {
    const imagePublicId = (row.image_public_id as string | null) ?? null;
    return {
      id: row.id as string,
      kind: row.kind as ServiceOffering["kind"],
      code: row.code as string,
      name: row.name as string,
      description: (row.description as string | null) ?? null,
      durationMinutes:
        row.duration_minutes == null ? null : Number(row.duration_minutes),
      capacity: row.capacity == null ? null : Number(row.capacity),
      priceBtn: row.price_btn == null ? null : Number(row.price_btn),
      imageSrc: imagePublicId
        ? cloudinaryUrl(imagePublicId, { width: 720, crop: "fill" })
        : null,
    };
  });
}
