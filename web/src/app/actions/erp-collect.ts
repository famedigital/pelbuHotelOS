"use server";

import { requireMoneyDesk } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { postFolioPaymentRecord } from "@/lib/folio/post-payment";
import { roundBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

const METHODS = new Set(["cash", "bank", "bank_qr", "card"]);

export type CollectPaymentState = {
  ok: boolean;
  error?: string;
  message?: string;
};

/** Record money received on a stay. Works after checkout, when the folio is already closed. */
export async function recordStayCollection(
  _prev: CollectPaymentState,
  formData: FormData,
): Promise<CollectPaymentState> {
  try {
    await requireMoneyDesk();
    const folioId = String(formData.get("folio_id") ?? "").trim();
    const bookingId = String(formData.get("booking_id") ?? "").trim();
    const method = String(formData.get("method") ?? "bank").trim();
    const amount = Number(String(formData.get("amount_btn") ?? "").replace(/,/g, ""));
    if (!folioId) return { ok: false, error: "This stay has no folio yet." };
    if (!METHODS.has(method)) return { ok: false, error: "Choose cash, bank, card, or QR." };
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: "Enter the amount received." };
    }

    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const { data: folio, error } = await admin
      .from("folios")
      .select("id, property_id, booking_id, status")
      .eq("id", folioId)
      .maybeSingle();
    if (error || !folio) return { ok: false, error: "Folio not found." };
    assertDeskProperty(propertyId, folio.property_id as string, "Folio");
    const status = folio.status as string;
    if (!["open", "closed", "settled"].includes(status)) {
      return { ok: false, error: "This folio cannot take a payment." };
    }

    const amountBtn = roundBtn(amount);
    await postFolioPaymentRecord(admin, {
      property_id: propertyId,
      folio_id: folioId,
      booking_id: (folio.booking_id as string | null) ?? (bookingId || null),
      method,
      amount_btn: amountBtn,
      kind: "settlement",
      reference: "Desk collection",
      notes: "Recorded on Bills → To collect",
      folio_line_source: "payment",
    });

    revalidatePath("/erp/bills");
    revalidatePath(`/erp/folios/${folioId}`);
    return { ok: true, message: "Payment recorded." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not record the payment.",
    };
  }
}
