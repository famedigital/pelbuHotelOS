"use server";

import { revalidatePath } from "next/cache";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { parseGuestRequests, writeGuestRequests } from "@/lib/erp/guest-requests";
import { postFolioCharge } from "@/lib/folio/post-charge";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Sign in to the desk.");
  }
}

function refresh() {
  revalidatePath("/erp/day");
  revalidatePath("/erp/housekeeping");
  revalidatePath("/erp/kitchen");
  revalidatePath("/erp/fnb/day");
}

export async function recordGuestRequest(formData: FormData): Promise<void> {
  await requireDesk();
  const bookingId = trimRequired(formData.get("booking_id"), "Stay");
  const text = trimRequired(formData.get("request"), "Request");
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const { data: booking, error } = await admin
    .from("bookings")
    .select("id, notes")
    .eq("id", bookingId)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (error || !booking) throw new Error("Stay not found.");
  const lines = parseGuestRequests(booking.notes as string | null);
  lines.push({ text, done: false });
  const { error: updateError } = await admin
    .from("bookings")
    .update({ notes: writeGuestRequests(booking.notes as string | null, lines) })
    .eq("id", bookingId)
    .eq("property_id", propertyId);
  if (updateError) throw new Error("Could not save the request.");
  refresh();
}

export async function recordExtraMeal(formData: FormData): Promise<void> {
  await requireDesk();
  const bookingId = trimRequired(formData.get("booking_id"), "Stay");
  const meal = trimRequired(formData.get("meal"), "Meal");
  const heads = Math.max(1, Math.min(40, Number(formData.get("heads")) || 1));
  const night = optionalTrim(formData.get("night")) ?? "";
  const amountRaw = optionalTrim(formData.get("amount"));
  const amount = amountRaw ? Number(amountRaw) : 0;
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const { data: booking } = await admin
    .from("bookings")
    .select("id, notes, contact_name")
    .eq("id", bookingId)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (!booking) throw new Error("Stay not found.");

  const label = `${meal} for ${heads}${night ? `, ${night}` : ""}`;
  if (Number.isFinite(amount) && amount > 0) {
    const { data: folio } = await admin
      .from("folios")
      .select("id")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!folio?.id) throw new Error("This stay has no folio yet.");
    const service = Math.round(amount * 0.1 * 100) / 100;
    const total = Math.round((amount + service) * 100) / 100;
    await postFolioCharge(admin, propertyId, {
      folio_id: folio.id as string,
      booking_id: bookingId,
      source_type: "guest_service",
      description: label,
      qty: heads,
      unit_price_btn: Math.round((amount / heads) * 100) / 100,
      amount_btn: amount,
      service_charge_rate: 0.1,
      service_charge_btn: service,
      service_charge_applied: true,
      gst_applicable: false,
      gst_btn: 0,
      total_btn: total,
    });
  }

  const lines = parseGuestRequests(booking.notes as string | null);
  lines.push({
    text: amount > 0 ? `${label} · Nu ${amount}` : `${label} · amount not set`,
    done: false,
  });
  await admin
    .from("bookings")
    .update({ notes: writeGuestRequests(booking.notes as string | null, lines) })
    .eq("id", bookingId)
    .eq("property_id", propertyId);
  refresh();
}
