import "server-only";

import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export async function ensureOpenFolio(
  admin: Admin,
  propertyId: string,
  bookingId: string,
  label: string,
): Promise<string> {
  const { data: existingFolio } = await admin
    .from("folios")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("status", "open")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (existingFolio?.id) return existingFolio.id as string;

  const { data: folio, error } = await admin
    .from("folios")
    .insert({
      property_id: propertyId,
      booking_id: bookingId,
      folio_type: "guest",
      label,
      status: "open",
    })
    .select("id")
    .single();

  if (error || !folio) {
    throw new Error("Could not open guest folio.");
  }
  return folio.id as string;
}
