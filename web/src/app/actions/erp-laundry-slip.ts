"use server";

import { revalidatePath } from "next/cache";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { postFolioCharge } from "@/lib/folio/post-charge";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { trimRequired } from "@/lib/validation";

export type LaundrySlipLine = {
  catalogItemId: string;
  qty: number;
};

const SPEED = {
  same_day: { label: "Same day", factor: 1 },
  overnight: { label: "Overnight", factor: 1.5 },
  express: { label: "Express", factor: 2 },
} as const;

export async function postGuestLaundrySlip(
  _prev: { ok: boolean; error?: string; printUrl?: string },
  formData: FormData,
): Promise<{ ok: boolean; error?: string; printUrl?: string }> {
  try {
    if (!(await isDeskAuthenticated())) {
      return { ok: false, error: "Sign in to the desk." };
    }
    const bookingId = trimRequired(formData.get("booking_id"), "Stay");
    const roomUnitId = trimRequired(formData.get("room_unit_id"), "Room");
    const guestName = trimRequired(formData.get("guest_name"), "Guest");
    const speedKey = String(formData.get("speed") ?? "same_day");
    const speed = SPEED[speedKey as keyof typeof SPEED] ?? SPEED.same_day;
    const raw = String(formData.get("lines") ?? "[]");
    const lines = (JSON.parse(raw) as LaundrySlipLine[]).filter(
      (line) => line.catalogItemId && Math.floor(Number(line.qty) || 0) > 0,
    );
    if (!lines.length) return { ok: false, error: "Enter a quantity." };

    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const ids = [...new Set(lines.map((line) => line.catalogItemId))];
    const { data: catalog, error: catalogError } = await admin
      .from("laundry_catalog_items")
      .select("id, name, category, price_btn, is_active")
      .eq("property_id", propertyId)
      .in("id", ids);
    if (catalogError) return { ok: false, error: "Could not read laundry prices." };
    const priced = new Map(
      (catalog ?? [])
        .filter((item) => item.is_active)
        .map((item) => [item.id as string, item]),
    );
    if (priced.size !== ids.length) {
      return { ok: false, error: "That laundry item is not on the price list." };
    }
    const { data: folio } = await admin
      .from("folios")
      .select("id, status")
      .eq("booking_id", bookingId)
      .eq("property_id", propertyId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!folio?.id) return { ok: false, error: "This stay has no open folio." };

    const { data: unit } = await admin
      .from("room_units")
      .select("label")
      .eq("id", roomUnitId)
      .eq("property_id", propertyId)
      .maybeSingle();
    const room = (unit?.label as string | undefined) ?? "Room";

    let amount = 0;
    const detail: string[] = [];
    for (const line of lines) {
      const item = priced.get(line.catalogItemId);
      if (!item) return { ok: false, error: "That laundry item is not on the price list." };
      const qty = Math.floor(Number(line.qty) || 0);
      const price = Number(item.price_btn);
      amount += Math.round(price * qty * speed.factor * 100) / 100;
      const section = (item.category as string | null)?.trim() || "Laundry";
      detail.push(`${section} ${item.name as string} × ${qty}`);
    }
    amount = Math.round(amount * 100) / 100;
    const service = Math.round(amount * 0.1 * 100) / 100;
    const total = Math.round((amount + service) * 100) / 100;
    const description = `Laundry · ${speed.label} · ${detail.join(", ")}`;

    const { data: order, error: orderError } = await admin
      .from("laundry_orders")
      .insert({
        property_id: propertyId,
        booking_id: bookingId,
        room_unit_id: roomUnitId,
        guest_name: guestName,
        room_label_snapshot: room,
        source: "front_desk",
        requested_notes: description,
        total_btn: total,
        status: "received",
        received_at: new Date().toISOString(),
        billed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (orderError || !order) {
      return { ok: false, error: "Could not save the laundry slip." };
    }

    let charge: { lineId: string };
    try {
      charge = await postFolioCharge(admin, propertyId, {
      folio_id: folio.id as string,
      booking_id: bookingId,
      source_type: "laundry",
      source_id: order.id as string,
      description,
      qty: 1,
      unit_price_btn: amount,
      amount_btn: amount,
      service_charge_rate: 0.1,
      service_charge_btn: service,
      service_charge_applied: true,
      gst_applicable: false,
      gst_btn: 0,
      total_btn: total,
      room_unit_id: roomUnitId,
    });
    } catch (chargeError) {
      await admin.from("laundry_orders").delete().eq("id", order.id);
      throw chargeError;
    }

    await admin
      .from("laundry_orders")
      .update({
        folio_id: folio.id,
        folio_line_id: charge.lineId,
      })
      .eq("id", order.id);

    revalidatePath("/erp/laundry");
    revalidatePath("/erp/day");
    return { ok: true, printUrl: `/erp/laundry/slip/${order.id}/print` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not post the laundry slip.",
    };
  }
}
