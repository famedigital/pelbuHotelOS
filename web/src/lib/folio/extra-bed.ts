import "server-only";

import { postFolioCharge } from "@/lib/folio/post-charge";
import { loadExtraBedPolicy } from "@/lib/meal-plans";
import { roundBtn } from "@/lib/pricing";
import { effectiveGstRate } from "@/lib/property-settings";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/**
 * Post one idempotent extra-bed folio line when booking snapshot amount > 0.
 */
export async function postExtraBedFolioLine(
  admin: Admin,
  propertyId: string,
  args: {
    folioId: string;
    bookingId: string;
    extraBeds: number;
    extraBedAmountBtn: number;
    businessDate?: string;
  },
): Promise<{ posted: boolean; skipped: boolean }> {
  const amountBtn = roundBtn(args.extraBedAmountBtn);
  if (!(amountBtn > 0)) {
    return { posted: false, skipped: true };
  }

  const businessDate =
    args.businessDate ?? new Date().toISOString().slice(0, 10);

  const { data: existing, error: existingError } = await admin
    .from("folio_lines")
    .select("id")
    .eq("folio_id", args.folioId)
    .eq("booking_id", args.bookingId)
    .eq("source_type", "extra_bed")
    .eq("source_id", args.bookingId)
    .eq("status", "posted")
    .limit(1);

  if (existingError) throw new Error(existingError.message);
  if (existing && existing.length > 0) {
    return { posted: false, skipped: true };
  }

  const { data: property } = await admin
    .from("properties")
    .select(
      "gst_enabled, gst_rate, service_charge_rate, service_charge_default_on",
    )
    .eq("id", propertyId)
    .maybeSingle();

  const gstRate = effectiveGstRate(property);
  const serviceChargeApplied = Boolean(property?.service_charge_default_on);
  const serviceChargeRate = serviceChargeApplied
    ? Number(property?.service_charge_rate ?? 0)
    : 0;
  const serviceChargeBtn = roundBtn(amountBtn * serviceChargeRate);
  const gstBase = amountBtn + serviceChargeBtn;
  const gstBtn = roundBtn(gstBase * gstRate);
  const totalBtn = roundBtn(amountBtn + serviceChargeBtn + gstBtn);

  const qty = Math.max(1, args.extraBeds);
  const description =
    qty === 1
      ? "Extra bed"
      : `Extra beds × ${qty}`;

  try {
    await postFolioCharge(admin, propertyId, {
      folio_id: args.folioId,
      booking_id: args.bookingId,
      source_type: "extra_bed",
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

/**
 * Another mattress on an in-house stay. Does not replace the check-in extra-bed line.
 * Amount is quantity times the property extra-bed rate.
 */
export async function postStayExtraMattress(
  admin: Admin,
  propertyId: string,
  args: {
    folioId: string;
    bookingId: string;
    qty: number;
    businessDate?: string;
  },
): Promise<{ lineId: string; totalBtn: number }> {
  const policy = await loadExtraBedPolicy(admin, propertyId);
  const rate = policy.ratePerNight;
  if (!policy.sellable || rate == null || !(rate > 0)) {
    throw new Error("Set the extra mattress rate in hotel settings.");
  }

  const qty = Math.max(1, Math.min(10, Math.floor(args.qty) || 1));
  const unit = roundBtn(rate);
  const amountBtn = roundBtn(unit * qty);
  const businessDate =
    args.businessDate ?? new Date().toISOString().slice(0, 10);

  const { data: property } = await admin
    .from("properties")
    .select(
      "gst_enabled, gst_rate, service_charge_rate, service_charge_default_on",
    )
    .eq("id", propertyId)
    .maybeSingle();

  const gstRate = effectiveGstRate(property);
  const serviceChargeApplied = Boolean(property?.service_charge_default_on);
  const serviceChargeRate = serviceChargeApplied
    ? Number(property?.service_charge_rate ?? 0)
    : 0;
  const serviceChargeBtn = roundBtn(amountBtn * serviceChargeRate);
  const gstBase = amountBtn + serviceChargeBtn;
  const gstBtn = roundBtn(gstBase * gstRate);
  const totalBtn = roundBtn(amountBtn + serviceChargeBtn + gstBtn);

  const posted = await postFolioCharge(admin, propertyId, {
    folio_id: args.folioId,
    booking_id: args.bookingId,
    source_type: "extra_bed",
    source_id: null,
    description: "Extra mattress",
    qty,
    unit_price_btn: unit,
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

  return { lineId: posted.lineId, totalBtn };
}
