import "server-only";

import { postFolioCharge } from "@/lib/folio/post-charge";
import { roundBtn } from "@/lib/pricing";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/**
 * Post one idempotent meal-plan folio line when booking snapshot amount > 0.
 * Skips EP / label-only stays.
 */
export async function postMealPlanFolioLine(
  admin: Admin,
  propertyId: string,
  args: {
    folioId: string;
    bookingId: string;
    mealPlanCode: string;
    mealPlanName: string;
    mealPlanAmountBtn: number;
    businessDate?: string;
  },
): Promise<{ posted: boolean; skipped: boolean }> {
  const businessDate =
    args.businessDate ?? new Date().toISOString().slice(0, 10);

  const { data: existing } = await admin
    .from("folio_lines")
    .select("id")
    .eq("folio_id", args.folioId)
    .eq("booking_id", args.bookingId)
    .eq("source_type", "meal_plan")
    .eq("status", "posted")
    .maybeSingle();

  if (existing) {
    return { posted: false, skipped: true };
  }

  const { data: property } = await admin
    .from("properties")
    .select("gst_rate, service_charge_rate, service_charge_default_on")
    .eq("id", propertyId)
    .maybeSingle();

  // Apply stay-level promo % snapshot on meal plan when present
  const { data: bookingPromo } = await admin
    .from("bookings")
    .select("promo_discount_pct")
    .eq("id", args.bookingId)
    .maybeSingle();
  let amountBtn = roundBtn(args.mealPlanAmountBtn);
  const promoPct = Number(bookingPromo?.promo_discount_pct ?? 0);
  if (promoPct > 0) {
    amountBtn = roundBtn(amountBtn * (1 - Math.min(100, promoPct) / 100));
  }
  if (!(amountBtn > 0)) {
    return { posted: false, skipped: true };
  }

  const gstRate = Number(property?.gst_rate ?? 0.07);
  const serviceChargeApplied = Boolean(property?.service_charge_default_on);
  const serviceChargeRate = serviceChargeApplied
    ? Number(property?.service_charge_rate ?? 0)
    : 0;
  const serviceChargeBtn = roundBtn(amountBtn * serviceChargeRate);
  const gstBase = amountBtn + serviceChargeBtn;
  const gstBtn = roundBtn(gstBase * gstRate);
  const totalBtn = roundBtn(amountBtn + serviceChargeBtn + gstBtn);

  const promoNote = promoPct > 0 ? ` · promo −${promoPct}%` : "";
  const description = `Meal plan ${args.mealPlanCode} · ${args.mealPlanName}${promoNote}`;

  try {
    await postFolioCharge(admin, propertyId, {
      folio_id: args.folioId,
      booking_id: args.bookingId,
      source_type: "meal_plan",
      source_id: args.bookingId,
      description,
      qty: 1,
      unit_price_btn: amountBtn,
      amount_btn: amountBtn,
      service_charge_rate: serviceChargeRate,
      service_charge_btn: serviceChargeBtn,
      service_charge_applied: serviceChargeApplied,
      gst_applicable: gstBtn > 0,
      gst_btn: gstBtn,
      total_btn: totalBtn,
      business_date: businessDate,
      journal_date: businessDate,
    });
    return { posted: true, skipped: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "post failed";
    if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("23505")) {
      return { posted: false, skipped: true };
    }
    throw e;
  }
}
