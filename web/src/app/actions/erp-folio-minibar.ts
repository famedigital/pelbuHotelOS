"use server";

import { requireMoneyDesk } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { postFolioCharge } from "@/lib/folio/post-charge";
import { roundBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { trimRequired, optionalTrim } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type FolioMinibarState = {
  ok: boolean;
  error?: string;
  message?: string;
};

/** Quick minibar / amenity charge without a POS ticket. */
export async function postMinibarCharge(
  _prev: FolioMinibarState,
  formData: FormData,
): Promise<FolioMinibarState> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const pid = await resolveActivePropertyId(admin);
    const folioId = trimRequired(formData.get("folio_id"), "Folio");
    const itemId = trimRequired(formData.get("minibar_item_id"), "Item");
    const qtyRaw = optionalTrim(formData.get("qty")) ?? "1";
    const qty = Math.max(1, Math.floor(Number(qtyRaw) || 1));
    const overrideRaw = optionalTrim(formData.get("amount_override"));

    const { data: folio } = await admin
      .from("folios")
      .select("id, booking_id, status, property_id")
      .eq("id", folioId)
      .single();
    if (!folio) throw new Error("Folio not found.");
    assertDeskProperty(pid, folio.property_id as string, "Folio");
    if ((folio.status as string) !== "open") throw new Error("Folio is not open.");

    const { data: item } = await admin
      .from("property_minibar_items")
      .select("id, label, amount_btn, category, is_active")
      .eq("id", itemId)
      .eq("property_id", pid)
      .maybeSingle();
    if (!item || !item.is_active) throw new Error("Minibar item not found.");

    let unitBtn = roundBtn(Number(item.amount_btn));
    if (overrideRaw) {
      const override = Number(overrideRaw);
      if (!Number.isFinite(override) || override < 0) {
        throw new Error("Override amount must be non-negative.");
      }
      unitBtn = roundBtn(override);
    }
    if (unitBtn < 0) throw new Error("Amount must be non-negative.");

    let amountBtn = roundBtn(unitBtn * qty);
    const promoCode = optionalTrim(formData.get("promo_code"));
    if (promoCode && amountBtn > 0) {
      const { redeemPromoCode } = await import("@/lib/marketing/promo");
      const redeemed = await redeemPromoCode(admin, {
        propertyId: pid,
        code: promoCode,
        channel: "desk_folio",
        domain: "pos",
        preDiscountBtn: amountBtn,
        bookingId: folio.booking_id as string | null,
        folioId,
      });
      if (!redeemed.ok) {
        throw new Error(redeemed.error ?? "Promo rejected.");
      }
      amountBtn = Number(redeemed.post_discount_btn ?? amountBtn);
      unitBtn = qty > 0 ? roundBtn(amountBtn / qty) : amountBtn;
    }

    const { data: property } = await admin
      .from("properties")
      .select("gst_rate, service_charge_rate, service_charge_default_on")
      .eq("id", pid)
      .maybeSingle();

    const gstRate = Number(property?.gst_rate ?? 0.07);
    const serviceChargeApplied = Boolean(property?.service_charge_default_on);
    const serviceChargeRate = serviceChargeApplied
      ? Number(property?.service_charge_rate ?? 0)
      : 0;
    const serviceChargeBtn = roundBtn(amountBtn * serviceChargeRate);
    const gstBase = amountBtn + serviceChargeBtn;
    const gstBtn = roundBtn(gstBase * gstRate);
    const totalBtn = roundBtn(amountBtn + serviceChargeBtn + gstBtn);
    const category = (item.category as string) || "minibar";
    const prefix = category === "amenity" ? "Amenity" : "Minibar";

    await postFolioCharge(admin, pid, {
      folio_id: folioId,
      booking_id: folio.booking_id as string | null,
      source_type: "service",
      source_id: itemId,
      description: `${prefix} · ${item.label as string}${qty > 1 ? ` × ${qty}` : ""}`,
      qty,
      unit_price_btn: unitBtn,
      amount_btn: amountBtn,
      service_charge_rate: serviceChargeRate,
      service_charge_btn: serviceChargeBtn,
      service_charge_applied: serviceChargeApplied,
      gst_applicable: gstBtn > 0,
      gst_btn: gstBtn,
      total_btn: totalBtn,
    });

    revalidatePath(`/erp/folios/${folioId}`);
    return {
      ok: true,
      message: `Posted ${item.label} × ${qty} — Nu ${totalBtn}.`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not post minibar charge.",
    };
  }
}
