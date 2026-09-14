import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/** Apply a partner visit discount % to a BTN amount (never below zero). */
export function applyDiscountPct(amountBtn: number, discountPct: number): number {
  const pct = Math.min(100, Math.max(0, Number(discountPct) || 0));
  if (pct <= 0) return amountBtn;
  return Math.round(amountBtn * (1 - pct / 100) * 100) / 100;
}

/**
 * Best discount from guide and/or driver linked to a booking.
 * Returns 0 when neither partner has a configured discount.
 */
export async function resolveBookingPartnerDiscountPct(
  admin: Admin,
  bookingId: string,
): Promise<{ pct: number; source: "guide" | "driver" | null }> {
  const { data: booking } = await admin
    .from("bookings")
    .select("guide_id, driver_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { pct: 0, source: null };

  let guidePct = 0;
  let driverPct = 0;
  if (booking.guide_id) {
    const { data: guide } = await admin
      .from("guides")
      .select("discount_pct")
      .eq("id", booking.guide_id as string)
      .maybeSingle();
    guidePct = Number(guide?.discount_pct ?? 0);
  }
  if (booking.driver_id) {
    const { data: driver } = await admin
      .from("drivers")
      .select("discount_pct")
      .eq("id", booking.driver_id as string)
      .maybeSingle();
    driverPct = Number(driver?.discount_pct ?? 0);
  }

  if (guidePct >= driverPct && guidePct > 0) {
    return { pct: guidePct, source: "guide" };
  }
  if (driverPct > 0) return { pct: driverPct, source: "driver" };
  return { pct: 0, source: null };
}

export async function resolvePartnerDiscountByIds(
  admin: Admin,
  args: { guideId?: string | null; driverId?: string | null },
): Promise<number> {
  let best = 0;
  if (args.guideId) {
    const { data } = await admin
      .from("guides")
      .select("discount_pct")
      .eq("id", args.guideId)
      .maybeSingle();
    best = Math.max(best, Number(data?.discount_pct ?? 0));
  }
  if (args.driverId) {
    const { data } = await admin
      .from("drivers")
      .select("discount_pct")
      .eq("id", args.driverId)
      .maybeSingle();
    best = Math.max(best, Number(data?.discount_pct ?? 0));
  }
  return best;
}
