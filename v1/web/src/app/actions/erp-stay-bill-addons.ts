"use server";

import { revalidatePath } from "next/cache";
import { isDeskAuthenticated, requireMoneyDesk } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { postStayExtraMattress } from "@/lib/folio/extra-bed";
import type { LaundryCatalogItem } from "@/lib/laundry";
import { loadExtraBedPolicy } from "@/lib/meal-plans";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { trimRequired } from "@/lib/validation";

export type StayServiceItem = {
  id: string;
  label: string;
  amountBtn: number;
  category: string;
};

export type StayBillAddons = {
  extraBedRateBtn: number | null;
  extraBedSellable: boolean;
  laundry: LaundryCatalogItem[];
  services: StayServiceItem[];
};

export async function loadStayBillAddons(): Promise<
  { ok: true; data: StayBillAddons } | { ok: false; error: string }
> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Sign in to the desk." };
    }
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const [policy, catalogResult, serviceResult] = await Promise.all([
      loadExtraBedPolicy(admin, propertyId),
      admin
        .from("laundry_catalog_items")
        .select(
          "id, name, category, unit_label, price_btn, gst_applicable, turnaround_hours, is_active, sort_order",
        )
        .eq("property_id", propertyId)
        .eq("is_active", true)
        .order("sort_order")
        .order("name"),
      admin
        .from("property_minibar_items")
        .select("id, label, amount_btn, category, is_active")
        .eq("property_id", propertyId)
        .eq("is_active", true)
        .order("label"),
    ]);
    if (catalogResult.error) {
      return { ok: false, error: "Could not read laundry prices." };
    }
    if (serviceResult.error) {
      return { ok: false, error: "Could not read other services." };
    }
    return {
      ok: true,
      data: {
        extraBedRateBtn: policy.ratePerNight,
        extraBedSellable: policy.sellable,
        laundry: (catalogResult.data ?? []).map((row) => ({
          ...row,
          price_btn: Number(row.price_btn),
          turnaround_hours: Number(row.turnaround_hours),
          gst_applicable: Boolean(row.gst_applicable),
          is_active: Boolean(row.is_active),
          sort_order: Number(row.sort_order ?? 0),
        })) as LaundryCatalogItem[],
        services: (serviceResult.data ?? []).map((row) => ({
          id: row.id as string,
          label: row.label as string,
          amountBtn: Number(row.amount_btn),
          category: (row.category as string) || "minibar",
        })),
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not load add-ons.",
    };
  }
}

export async function postStayExtraMattressAction(
  _prev: { ok: boolean; error?: string; message?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string; message?: string; at?: number }> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const folioId = trimRequired(formData.get("folio_id"), "Folio");
    const bookingId = trimRequired(formData.get("booking_id"), "Stay");
    const qty = Math.floor(Number(formData.get("qty")) || 0);
    if (qty < 1) return { ok: false, error: "Enter a quantity." };

    const { data: folio } = await admin
      .from("folios")
      .select("id, booking_id, status, property_id")
      .eq("id", folioId)
      .maybeSingle();
    if (!folio) return { ok: false, error: "Folio not found." };
    assertDeskProperty(propertyId, folio.property_id as string, "Folio");
    if ((folio.status as string) !== "open") {
      return { ok: false, error: "Folio is not open." };
    }
    if ((folio.booking_id as string) !== bookingId) {
      return { ok: false, error: "That folio is for a different stay." };
    }

    const { data: property } = await admin
      .from("properties")
      .select("current_business_date")
      .eq("id", propertyId)
      .maybeSingle();
    const businessDate =
      (property?.current_business_date as string | null)?.slice(0, 10) ||
      new Date().toISOString().slice(0, 10);

    const posted = await postStayExtraMattress(admin, propertyId, {
      folioId,
      bookingId,
      qty,
      businessDate,
    });

    revalidatePath(`/erp/folios/${folioId}`);
    revalidatePath("/erp/day");
    return {
      ok: true,
      at: Date.now(),
      message: `Extra mattress × ${qty} posted — Nu ${posted.totalBtn}.`,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not post the extra mattress.",
    };
  }
}
