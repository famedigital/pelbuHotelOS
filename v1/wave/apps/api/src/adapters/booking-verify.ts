import type { AdapterCtx } from "./types.js";

/**
 * Look up a stay row by confirmation code within the JWT property.
 * Uses real `bookings` columns only (no invented schema).
 */
export async function getBookingByConfirmationCode(
  ctx: AdapterCtx,
  rawCode: string,
) {
  const code = rawCode.trim();
  if (!code) {
    throw new Error("Confirmation code is required");
  }

  const { data, error } = await ctx.admin
    .from("bookings")
    .select(
      "id, confirmation_code, contact_name, contact_phone, status, check_in, check_out, quoted_total_btn, guest_origin, source",
    )
    .eq("property_id", ctx.jwt.propertyId)
    .ilike("confirmation_code", code)
    .limit(5);
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) {
    return { booking: null as null };
  }
  if (rows.length > 1) {
    throw new Error("Multiple bookings match — narrow the confirmation code");
  }
  return { booking: rows[0] as Record<string, unknown> };
}
