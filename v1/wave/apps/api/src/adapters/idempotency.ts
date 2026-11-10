import type { HotelOsSupabase } from "@hotel-os/db";

export async function loadIdempotent(
  admin: HotelOsSupabase,
  propertyId: string,
  key: string,
): Promise<Record<string, unknown> | null> {
  const { data } = await admin
    .from("idempotency_keys")
    .select("response")
    .eq("property_id", propertyId)
    .eq("idempotency_key", key)
    .maybeSingle();
  return (data?.response as Record<string, unknown>) ?? null;
}

export async function saveIdempotent(
  admin: HotelOsSupabase,
  propertyId: string,
  key: string,
  operation: string,
  response: Record<string, unknown>,
): Promise<void> {
  await admin.from("idempotency_keys").upsert(
    {
      property_id: propertyId,
      idempotency_key: key,
      operation,
      response,
    },
    { onConflict: "property_id,idempotency_key" },
  );
}
