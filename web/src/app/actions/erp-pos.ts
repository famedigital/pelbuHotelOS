"use server";

import { writeAuditEvent } from "@/lib/audit";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { calculateOrderTotals, roundBtn } from "@/lib/pricing";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertPhone,
  optionalTrim,
  trimRequired,
} from "@/lib/validation";
import { revalidatePath } from "next/cache";

const KOT_STATUSES = new Set(["new", "preparing", "ready", "served", "cancelled"]);
const OUTLETS = new Set(["cafe", "pastry", "restaurant", "bar"]);
const PAY_METHODS = new Set([
  "cash",
  "bank",
  "card",
  "agent_credit",
  "bank_qr",
  "pay_bt",
  "deposit",
]);
const GUEST_SERVICES = new Set(["taxi", "shop", "other"]);

type Admin = ReturnType<typeof createSupabaseAdminClient>;

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

async function propertyId(admin: Admin) {
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

async function ensureOpenFolio(
  admin: Admin,
  property_id: string,
  bookingId: string,
): Promise<string> {
  const { data: existingFolio } = await admin
    .from("folios")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("status", "open")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (existingFolio?.id) {
    return existingFolio.id as string;
  }

  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .select("id, contact_name, check_in")
    .eq("id", bookingId)
    .eq("property_id", property_id)
    .single();

  if (bookingError || !booking) {
    throw new Error("Booking not found.");
  }

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
  return folio.id as string;
}

type CartLineInput = { menuItemId: string; qty: number };

function parseCart(raw: FormDataEntryValue | null): CartLineInput[] {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("Cart is empty.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Cart data is invalid.");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Cart is empty.");
  }
  const lines: CartLineInput[] = [];
  for (const item of parsed) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof (item as CartLineInput).menuItemId !== "string" ||
      typeof (item as CartLineInput).qty !== "number"
    ) {
      throw new Error("Cart data is invalid.");
    }
    const qty = (item as CartLineInput).qty;
    if (!Number.isInteger(qty) || qty < 1 || qty > 40) {
      throw new Error("Each item quantity must be between 1 and 40.");
    }
    lines.push({
      menuItemId: (item as CartLineInput).menuItemId,
      qty,
    });
  }
  return lines;
}

export type DeskPosState = {
  ok: boolean;
  orderId?: string;
  folioId?: string;
  totalBtn?: number;
  error?: string;
};

export async function createDeskOrder(
  _prev: DeskPosState,
  formData: FormData,
): Promise<DeskPosState> {
  try {
    await requireDesk();

    const customerName = trimRequired(formData.get("customer_name"), "Guest name");
    const phone = trimRequired(formData.get("phone"), "Phone");
    assertPhone(phone);

    const outlet = trimRequired(formData.get("outlet"), "Outlet");
    if (!OUTLETS.has(outlet)) {
      throw new Error("Choose cafe, pastry, restaurant, or bar.");
    }

    const settleMode = trimRequired(formData.get("settle_mode"), "Settle mode");
    if (settleMode !== "cash" && settleMode !== "room_charge") {
      throw new Error("Choose cash or room charge.");
    }

    const bookingId = optionalTrim(formData.get("booking_id"));
    if (settleMode === "room_charge" && !bookingId) {
      throw new Error("Select a booking for room charge.");
    }

    const notes = optionalTrim(formData.get("notes"));
    const cart = parseCart(formData.get("cart"));

    const admin = createSupabaseAdminClient();
    const property_id = await propertyId(admin);

    const ids = [...new Set(cart.map((line) => line.menuItemId))];
    const { data: menuRows, error: menuError } = await admin
      .from("menu_items")
      .select("id, name, price_btn, gst_applicable, outlet, is_available")
      .in("id", ids)
      .eq("property_id", property_id)
      .eq("is_available", true)
      .eq("outlet", outlet);

    if (menuError || !menuRows || menuRows.length !== ids.length) {
      throw new Error("One or more menu items are unavailable for this outlet.");
    }

    const byId = new Map(menuRows.map((row) => [row.id as string, row]));
    const priced = cart.map((line) => {
      const item = byId.get(line.menuItemId);
      if (!item) throw new Error("Menu item missing.");
      return {
        menuItemId: line.menuItemId,
        qty: line.qty,
        name: item.name as string,
        unitPriceBtn: Number(item.price_btn),
        gstApplicable: Boolean(item.gst_applicable),
      };
    });

    const { subtotalBtn, gstBtn, totalBtn } = calculateOrderTotals(
      priced.map((line) => ({
        qty: line.qty,
        unitPriceBtn: line.unitPriceBtn,
        gstApplicable: line.gstApplicable,
      })),
    );

    let folioId: string | null = null;
    if (settleMode === "room_charge" && bookingId) {
      folioId = await ensureOpenFolio(admin, property_id, bookingId);
    }

    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        property_id,
        outlet,
        customer_name: customerName,
        phone,
        delivery_type: "pickup",
        notes,
        status: "received",
        kot_status: "new",
        order_source: settleMode === "room_charge" ? "room_charge" : "desk",
        booking_id: bookingId,
        folio_id: folioId,
        subtotal_btn: subtotalBtn,
        gst_btn: gstBtn,
        total_btn: totalBtn,
        posted_to_folio_at:
          settleMode === "room_charge" ? new Date().toISOString() : null,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      console.error("createDeskOrder failed", orderError);
      throw new Error("Could not save desk order.");
    }

    const { error: itemsError } = await admin.from("order_items").insert(
      priced.map((line) => ({
        order_id: order.id,
        menu_item_id: line.menuItemId,
        name_snapshot: line.name,
        qty: line.qty,
        unit_price_btn: line.unitPriceBtn,
        gst_applicable: line.gstApplicable,
      })),
    );

    if (itemsError) {
      await admin.from("orders").delete().eq("id", order.id);
      throw new Error("Could not save order items.");
    }

    if (settleMode === "room_charge" && folioId && bookingId) {
      const description = priced
        .map((line) => `${line.qty}× ${line.name}`)
        .join(", ");
      const { error: lineError } = await admin.from("folio_lines").insert({
        folio_id: folioId,
        booking_id: bookingId,
        source_type: "order",
        source_id: order.id,
        description: `Desk ${outlet}: ${description}`,
        qty: 1,
        unit_price_btn: subtotalBtn,
        amount_btn: subtotalBtn,
        gst_applicable: gstBtn > 0,
        gst_btn: gstBtn,
        total_btn: totalBtn,
        status: "posted",
      });
      if (lineError) {
        console.error("createDeskOrder folio line failed", lineError);
      }
    }

    revalidatePath("/erp");
    revalidatePath("/erp/pos");
    return {
      ok: true,
      orderId: order.id as string,
      folioId: folioId ?? undefined,
      totalBtn,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
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
    status:
      nextStatus === "served"
        ? "completed"
        : nextStatus === "cancelled"
          ? "cancelled"
          : "preparing",
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
    .select(
      "id, customer_name, subtotal_btn, gst_btn, total_btn, folio_id, posted_to_folio_at, booking_id",
    )
    .eq("id", orderId)
    .eq("property_id", property_id)
    .single();

  if (orderError || !order) {
    throw new Error("Order not found.");
  }
  if (order.posted_to_folio_at) {
    throw new Error("Order is already posted to a folio.");
  }

  const folioId = await ensureOpenFolio(admin, property_id, bookingId);

  const { data: items } = await admin
    .from("order_items")
    .select("name_snapshot, qty")
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
  revalidatePath(`/erp/folios/${folioId}`);
}

export type GuestServiceState = {
  ok: boolean;
  folioId?: string;
  error?: string;
};

export async function postGuestServiceCharge(
  _prev: GuestServiceState,
  formData: FormData,
): Promise<GuestServiceState> {
  try {
    await requireDesk();

    const bookingId = trimRequired(formData.get("booking_id"), "Booking");
    const kind = trimRequired(formData.get("service_kind"), "Service kind");
    if (!GUEST_SERVICES.has(kind)) {
      throw new Error("Choose taxi, shop, or other.");
    }

    const description = trimRequired(formData.get("description"), "Description");
    const amountRaw = trimRequired(formData.get("amount_btn"), "Amount");
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Amount must be greater than zero.");
    }
    const amountBtn = roundBtn(amount);
    const gstApplicable = formData.get("gst_applicable") === "on";
    const gstBtn = gstApplicable ? roundBtn(amountBtn * 0.07) : 0;
    const totalBtn = roundBtn(amountBtn + gstBtn);
    const notes = optionalTrim(formData.get("notes"));

    const admin = createSupabaseAdminClient();
    const property_id = await propertyId(admin);
    const folioId = await ensureOpenFolio(admin, property_id, bookingId);

    const { error } = await admin.from("folio_lines").insert({
      folio_id: folioId,
      booking_id: bookingId,
      source_type: "guest_service",
      description: `${kind}: ${description}${notes ? ` · ${notes}` : ""}`,
      qty: 1,
      unit_price_btn: amountBtn,
      amount_btn: amountBtn,
      gst_applicable: gstApplicable,
      gst_btn: gstBtn,
      total_btn: totalBtn,
      status: "posted",
    });

    if (error) {
      throw new Error("Could not post guest service charge.");
    }

    revalidatePath("/erp");
    revalidatePath(`/erp/folios/${folioId}`);
    return { ok: true, folioId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

export type PaymentState = {
  ok: boolean;
  paymentId?: string;
  error?: string;
};

export async function postFolioPayment(
  _prev: PaymentState,
  formData: FormData,
): Promise<PaymentState> {
  try {
    await requireDesk();

    const folioId = trimRequired(formData.get("folio_id"), "Folio");
    const method = trimRequired(formData.get("method"), "Payment method");
    if (!PAY_METHODS.has(method)) {
      throw new Error("Choose cash, bank, card, QR, Pay.bt, deposit, or agent credit.");
    }

    const amountRaw = trimRequired(formData.get("amount_btn"), "Amount");
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Amount must be greater than zero.");
    }
    const amountBtn = roundBtn(amount);
    const reference = optionalTrim(formData.get("reference"));
    const notes = optionalTrim(formData.get("notes"));

    const admin = createSupabaseAdminClient();
    const property_id = await propertyId(admin);

    const { data: folio, error: folioError } = await admin
      .from("folios")
      .select("id, booking_id, status")
      .eq("id", folioId)
      .eq("property_id", property_id)
      .single();

    if (folioError || !folio) {
      throw new Error("Folio not found.");
    }
    if ((folio.status as string) !== "open") {
      throw new Error("Folio is not open.");
    }

    const { data: payment, error: payError } = await admin
      .from("payments")
      .insert({
        property_id,
        folio_id: folioId,
        booking_id: folio.booking_id,
        method,
        amount_btn: amountBtn,
        reference,
        notes,
      })
      .select("id")
      .single();

    if (payError || !payment) {
      throw new Error("Could not save payment.");
    }

    const { error: lineError } = await admin.from("folio_lines").insert({
      folio_id: folioId,
      booking_id: folio.booking_id,
      source_type: "payment",
      source_id: payment.id,
      description: `Payment · ${method}${reference ? ` · ${reference}` : ""}`,
      qty: 1,
      unit_price_btn: -amountBtn,
      amount_btn: -amountBtn,
      gst_applicable: false,
      gst_btn: 0,
      total_btn: -amountBtn,
      status: "posted",
    });

    if (lineError) {
      await admin.from("payments").delete().eq("id", payment.id);
      throw new Error("Could not post payment to folio.");
    }

    await writeAuditEvent(admin, {
      propertyId: property_id,
      action: "payment.create",
      entityType: "payments",
      entityId: payment.id as string,
      summary: `Payment ${amountBtn} Nu · ${method}`,
      meta: { folioId, method, amountBtn },
    });

    revalidatePath("/erp");
    revalidatePath(`/erp/folios/${folioId}`);
    revalidatePath("/erp/reports");
    return { ok: true, paymentId: payment.id as string };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}
