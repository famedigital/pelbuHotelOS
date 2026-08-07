import "server-only";
import type { PeriodGuardOptions } from "@/lib/accounting/period-guard";
import { netFolioBalance } from "@/lib/folio/balance";
import { postFolioCharge } from "@/lib/folio/post-charge";
import {
  GUEST_RATE_ADJ_DESCRIPTION,
  guestRateAbsorbBtn,
  isGuestRateAdjDescription,
  roundBtn,
  roundGuestWholeBtn,
} from "@/lib/pricing";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export { GUEST_RATE_ADJ_DESCRIPTION, isGuestRateAdjDescription };

/**
 * One-shot: absorb leftover pennies on open folio charges so net charges
 * land on a whole Nu (hotel-funded rate adj).
 */
export async function postOpenFolioGuestRateRoundAdj(
  admin: Admin,
  propertyId: string,
  args: {
    folioId: string;
    bookingId?: string | null;
    period_guard?: PeriodGuardOptions;
  },
): Promise<{
  lineId: string | null;
  absorbBtn: number;
  chargesSumBtn: number;
  targetBtn: number;
}> {
  const { data: lines, error } = await admin
    .from("folio_lines")
    .select(
      "id, total_btn, status, source_type, reverses_line_id, description",
    )
    .eq("folio_id", args.folioId);
  if (error) throw new Error("Could not load folio lines.");

  const all = lines ?? [];
  // Net balance already excludes voided originals + their reversals.
  // For rate adj we only want charge side: exclude payments/deposits.
  const chargeSide = all.filter((l) => {
    const st = (l.source_type as string) ?? "";
    return st !== "payment" && st !== "deposit";
  });
  const chargesSumBtn = roundBtn(
    netFolioBalance(
      chargeSide.map((l) => ({
        id: l.id as string,
        status: l.status as string,
        total_btn: Number(l.total_btn),
        reverses_line_id: (l.reverses_line_id as string | null) ?? null,
      })),
    ),
  );

  const targetBtn = roundGuestWholeBtn(Math.max(0, chargesSumBtn));
  const absorbBtn = guestRateAbsorbBtn(Math.max(0, chargesSumBtn));

  if (absorbBtn >= -0.009) {
    return {
      lineId: null,
      absorbBtn: 0,
      chargesSumBtn,
      targetBtn: chargesSumBtn,
    };
  }

  const posted = all.filter((l) => (l.status as string) === "posted");
  const existing = posted.find(
    (l) =>
      isGuestRateAdjDescription(l.description as string) &&
      Math.abs(Number(l.total_btn) - absorbBtn) < 0.01,
  );
  if (existing) {
    return {
      lineId: existing.id as string,
      absorbBtn: Number(existing.total_btn),
      chargesSumBtn,
      targetBtn,
    };
  }

  const result = await postFolioCharge(admin, propertyId, {
    folio_id: args.folioId,
    booking_id: args.bookingId ?? null,
    source_type: "adjustment",
    source_id: args.folioId,
    description: GUEST_RATE_ADJ_DESCRIPTION,
    qty: 1,
    unit_price_btn: absorbBtn,
    amount_btn: absorbBtn,
    gst_applicable: false,
    gst_btn: 0,
    total_btn: absorbBtn,
    skip_guest_rate_adj: true,
    period_guard: args.period_guard,
  });

  return {
    lineId: result.lineId,
    absorbBtn,
    chargesSumBtn,
    targetBtn,
  };
}
