"use server";

import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { loadBookingDetail, type BookingDetailData } from "@/lib/booking-detail";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type FetchBookingDetailState = {
  ok: boolean;
  data?: BookingDetailData;
  error?: string;
};

export async function fetchBookingDetail(
  bookingId: string,
): Promise<FetchBookingDetailState> {
  if (!(await isDeskAuthenticated())) {
    return { ok: false, error: "Not signed in" };
  }

  try {
    const admin = createSupabaseAdminClient();
    const propertyId = await requireDeskPropertyId();
    const data = await loadBookingDetail(admin, propertyId, bookingId);
    if (!data) return { ok: false, error: "Booking not found" };
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not load booking",
    };
  }
}
