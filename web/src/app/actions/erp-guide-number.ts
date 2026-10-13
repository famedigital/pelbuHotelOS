"use server";

import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { isPlaceholderGuideNumber } from "@/lib/guide-number";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function saveBookingGuideNumber(input: {
  bookingId: string;
  guideNumber: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await isDeskAuthenticated())) {
    return { ok: false, error: "Not signed in" };
  }
  const guideNumber = input.guideNumber.trim();
  if (isPlaceholderGuideNumber(guideNumber)) {
    return {
      ok: false,
      error: "Enter the guide number, not a phone or a blank.",
    };
  }
  if (guideNumber.length > 40) {
    return { ok: false, error: "Guide number is too long." };
  }
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const { error } = await admin
    .from("bookings")
    .update({ guide_number: guideNumber })
    .eq("id", input.bookingId)
    .eq("property_id", propertyId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/erp");
  revalidatePath("/erp/today");
  revalidatePath("/erp/arrivals");
  return { ok: true };
}
