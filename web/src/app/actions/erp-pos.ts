"use server";

import { isDeskAuthenticated } from "@/lib/desk-auth";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

const KOT_STATUSES = new Set(["new", "preparing", "ready", "served", "cancelled"]);

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

async function propertyId(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data: property, error } = await admin
    .from("properties")
    .select("id")
    .eq("slug", PELBU_PROPERTY_SLUG)
    .single();
  if (error || !property) {
    throw new Error("Hotel property is not configured.");
  }
  return property.id as string;
}

export async function updateOrderKotStatus(formData: FormData): Promise<void> {
  await requireDesk();

  const orderId = trimRequired(formData.get("order_id"), "Order");
  const nextStatus = trimRequired(formData.get("kot_status"), "Status");
  if (!KOT_STATUSES.has(nextStatus)) {
    throw new Error("Invalid KOT status.");
  }

  const admin = createSupabaseAdminClient();
  const patch: Record<string, unknown> = {
    kot_status: nextStatus,
    status: nextStatus === "served" ? "completed" : nextStatus === "cancelled" ? "cancelled" : "preparing",
  };
  if (nextStatus === "served") {
    patch.settled_at = new Date().toISOString();
  }

  const { error } = await admin.from("orders").update(patch).eq("id", orderId);
  if (error) {
    throw new Error("Could not update order status.");
  }

  revalidatePath("/erp");
}

export async function postOrderToBookingFolio(formData: FormData): Promise<void> {
  await requireDesk();

  const orderId = trimRequired(formData.get("order_id"), "Order");
  const bookingId = trimRequired(formData.get("booking_id"), "Booking");

  const admin = createSupabaseAdminClient();
  const property_id = await propertyId(admin);

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, customer_name, subtotal_btn, gst_btn, total_btn, folio_id, posted_to_folio_at, booking_id")
    .eq("id", orderId)
    .eq("property_id", property_id)
    .single();

  if (orderError || !order) {
    throw new Error("Order not found.");
  }
  if (order.posted_to_folio_at) {
    throw new Error("Order is already posted to a folio.");
  }

  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .select("id, contact_name, check_in, check_out")
    .eq("id", bookingId)
    .eq("property_id", property_id)
    .single();

  if (bookingError || !booking) {
    throw new Error("Booking not found.");
  }

  let folioId: string | null = null;
  const { data: existingFolio } = await admin
    .from("folios")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("status", "open")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (existingFolio?.id) {
    folioId = existingFolio.id as string;
  } else {
    const { data: folio, error: folioError } = await admin
      .from("folios")
      .insert({
        property_id,
        booking_id: bookingId,
        folio_type: "guest",
        label: `${(booking.contact_name as string) ?? "Guest"} · ${booking.check_in as string}`,
        status: "open",
      })
      .select("id")
      .single();

    if (folioError || !folio) {
      throw new Error("Could not create folio.");
    }
    folioId = folio.id as string;
  }

  const { data: items } = await admin
    .from("order_items")
    .select("name_snapshot, qty, unit_price_btn, gst_applicable")
    .eq("order_id", orderId);

  const description =
    (items ?? [])
      .map((item) => `${item.qty}× ${item.name_snapshot as string}`)
      .join(", ") || `Order ${(order.customer_name as string) ?? "guest"}`;

  const { error: lineError } = await admin.from("folio_lines").insert({
    folio_id: folioId,
    booking_id: bookingId,
    source_type: "order",
    source_id: orderId,
    description,
    qty: 1,
    unit_price_btn: Number(order.subtotal_btn),
    amount_btn: Number(order.subtotal_btn),
    gst_applicable: Number(order.gst_btn) > 0,
    gst_btn: Number(order.gst_btn),
    total_btn: Number(order.total_btn),
    status: "posted",
  });

  if (lineError) {
    throw new Error("Could not post order to folio.");
  }

  const { error: patchError } = await admin
    .from("orders")
    .update({
      booking_id: bookingId,
      folio_id: folioId,
      order_source: "room_charge",
      posted_to_folio_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (patchError) {
    throw new Error("Folio saved, but order linkage failed.");
  }

  revalidatePath("/erp");
}
