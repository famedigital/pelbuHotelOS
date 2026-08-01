"use server";

import { requireMoneyDesk } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { postFolioCharge } from "@/lib/folio/post-charge";
import { roundBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { trimRequired, optionalTrim } from "@/lib/validation";
import { revalidatePath } from "next/cache";

export type FolioDamageState = {
  ok: boolean;
  error?: string;
  message?: string;
};

export async function postDamageCharge(
  _prev: FolioDamageState,
  formData: FormData,
): Promise<FolioDamageState> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const pid = await resolveActivePropertyId(admin);
    const folioId = trimRequired(formData.get("folio_id"), "Folio");
    const itemId = trimRequired(formData.get("damage_item_id"), "Damage item");
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
      .from("property_damage_items")
      .select("id, label, amount_btn, is_active")
      .eq("id", itemId)
      .eq("property_id", pid)
      .maybeSingle();
    if (!item || !item.is_active) throw new Error("Damage item not found.");

    let amountBtn = item.amount_btn == null ? null : Number(item.amount_btn);
    if (overrideRaw) {
      const override = Number(overrideRaw);
      if (!Number.isFinite(override) || override <= 0) {
        throw new Error("Override amount must be a positive number.");
      }
      amountBtn = roundBtn(override);
    }
    if (amountBtn == null || amountBtn <= 0) {
      throw new Error("Enter an override amount — this item has no fixed Nu.");
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

    await postFolioCharge(admin, pid, {
      folio_id: folioId,
      booking_id: folio.booking_id as string | null,
      source_type: "damage",
      source_id: itemId,
      description: `Damage · ${item.label as string}`,
      qty: 1,
      unit_price_btn: amountBtn,
      amount_btn: amountBtn,
      service_charge_rate: serviceChargeRate,
      service_charge_btn: serviceChargeBtn,
      service_charge_applied: serviceChargeApplied,
      gst_applicable: gstBtn > 0,
      gst_btn: gstBtn,
      total_btn: totalBtn,
    });

    revalidatePath(`/erp/folios/${folioId}`);
    return { ok: true, message: `Posted ${item.label} — Nu ${amountBtn}.` };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not post damage charge.",
    };
  }
}
