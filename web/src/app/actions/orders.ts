"use server";

import { postFolioCharge } from "@/lib/folio/post-charge";
import {
  assertActiveGuestRoomSession,
  openGuestRoomSession,
} from "@/lib/guest-room-auth";
import { isValidThimphuArea } from "@/lib/delivery-areas";
import { notifyNewOrder } from "@/lib/notify";
import { loadMenuStockMap } from "@/lib/menu-stock";
import { calculateOrderTotals } from "@/lib/pricing";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertPhone,
  optionalTrim,
  trimRequired,
} from "@/lib/validation";
import { headers } from "next/headers";

export type OrderActionState = {
  ok: boolean;
  orderId?: string;
  totalBtn?: number;
  /** True when charge posted to in-house folio. */
  chargedToRoom?: boolean;
  roomLabel?: string;
  error?: string;
};

type CartLineInput = {
  menuItemId: string;
  qty: number;
};

function parseCart(raw: FormDataEntryValue | null): CartLineInput[] {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("Your cart is empty.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Cart data is invalid. Refresh and try again.");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Your cart is empty.");
  }

  const lines: CartLineInput[] = [];
  for (const item of parsed) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof (item as CartLineInput).menuItemId !== "string" ||
      typeof (item as CartLineInput).qty !== "number"
    ) {
      throw new Error("Cart data is invalid. Refresh and try again.");
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

  if (lines.length > 40) {
    throw new Error("Too many line items. Split into separate orders.");
  }

  return lines;
}

async function ensureOpenFolioForBooking(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  propertyId: string,
  bookingId: string,
  label: string,
): Promise<string> {
  const { data: existing } = await admin
    .from("folios")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("property_id", propertyId)
    .eq("status", "open")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: folio, error } = await admin
    .from("folios")
    .insert({
      property_id: propertyId,
      booking_id: bookingId,
      folio_type: "guest",
      label,
      status: "open",
    })
    .select("id")
    .single();
  if (error || !folio) {
    throw new Error("Could not open a room folio. Please call the desk.");
  }
  return folio.id as string;
}

export async function createOrder(
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  try {
    const h = await headers();
    const rl = await rateLimit(`order:${clientIp(h)}`, {
      limit: 20,
      windowMs: 60 * 60_000,
    });
    if (!rl.ok) {
      return {
        ok: false,
        error: "Too many orders from this network. Try again later.",
      };
    }

    const deliveryTypeRaw = trimRequired(
      formData.get("delivery_type"),
      "Delivery option",
    );
    if (
      deliveryTypeRaw !== "pickup" &&
      deliveryTypeRaw !== "taxi" &&
      deliveryTypeRaw !== "room"
    ) {
      throw new Error("Choose pickup, room charge, or taxi delivery.");
    }

    const admin = createSupabaseAdminClient();

    const { data: property, error: propertyError } = await admin
      .from("properties")
      .select("id")
      .eq("slug", PELBU_PROPERTY_SLUG)
      .single();

    if (propertyError || !property) {
      throw new Error("Hotel property is not configured. Please call the cafe.");
    }
    const propertyId = property.id as string;

    let customerName = "";
    let phone = "";
    let bookingId: string | null = null;
    let roomUnitId: string | null = null;
    let roomLabel: string | null = null;
    let folioId: string | null = null;
    let notes = optionalTrim(formData.get("notes"));
    let deliveryArea = optionalTrim(formData.get("delivery_area"));
    let deliveryAddress = optionalTrim(formData.get("delivery_address"));

    if (deliveryTypeRaw === "room") {
      const token = trimRequired(
        formData.get("guest_room_token"),
        "Room verification",
      );
      const session = openGuestRoomSession(token);
      if (!session || session.propertyId !== propertyId) {
        throw new Error(
          "Room verification expired or invalid. Verify your room again.",
        );
      }
      const stillActive = await assertActiveGuestRoomSession(admin, session);
      if (!stillActive) {
        throw new Error(
          "That room is no longer checked in. Call the desk if you need help.",
        );
      }

      bookingId = session.bookingId;
      roomUnitId = session.roomUnitId;
      roomLabel = session.roomLabel;

      const { data: booking } = await admin
        .from("bookings")
        .select("contact_name, contact_phone")
        .eq("id", bookingId)
        .eq("property_id", propertyId)
        .maybeSingle();

      // Never trust client-supplied name/phone for room charge — use stay record.
      customerName =
        (booking?.contact_name as string | null)?.trim() || `Room ${roomLabel}`;
      phone = (booking?.contact_phone as string | null)?.trim() || "room";
      deliveryArea = roomLabel;
      deliveryAddress = null;
      notes = notes
        ? `[Room ${roomLabel}] ${notes}`
        : `In-house order · Room ${roomLabel}`;

      folioId = await ensureOpenFolioForBooking(
        admin,
        propertyId,
        bookingId,
        `Room ${roomLabel}`,
      );
    } else {
      customerName = trimRequired(formData.get("customer_name"), "Full name");
      phone = trimRequired(formData.get("phone"), "Phone");
      assertPhone(phone);

      if (deliveryTypeRaw === "taxi") {
        if (!isValidThimphuArea(deliveryArea)) {
          throw new Error(
            "Taxi delivery is Thimphu only. Choose a Thimphu area first.",
          );
        }
        if (!deliveryAddress) {
          throw new Error("Add a landmark or detail address for taxi delivery.");
        }
      }
    }

    const cart = parseCart(formData.get("cart"));

    const ids = [...new Set(cart.map((line) => line.menuItemId))];
    const { data: menuRows, error: menuError } = await admin
      .from("menu_items")
      .select(
        "id, name, price_btn, gst_applicable, outlet, is_available, property_id",
      )
      .in("id", ids)
      .eq("property_id", propertyId)
      .eq("is_available", true);

    if (menuError || !menuRows) {
      console.error("createOrder menu fetch failed", menuError);
      throw new Error("Could not load menu prices. Please try again.");
    }

    if (menuRows.length !== ids.length) {
      throw new Error(
        "One or more items are no longer available. Refresh the menu.",
      );
    }

    const stock = await loadMenuStockMap(admin, propertyId, ids);
    for (const id of ids) {
      const required = cart
        .filter((line) => line.menuItemId === id)
        .reduce((sum, line) => sum + line.qty, 0);
      const snapshot = stock.get(id);
      if (
        snapshot &&
        snapshot.mode !== "untracked" &&
        snapshot.autoDisable &&
        (snapshot.availableSales ?? 0) < required
      ) {
        const row = menuRows.find((item) => item.id === id);
        throw new Error(`${String(row?.name ?? "Item")} is sold out.`);
      }
    }

    const byId = new Map(menuRows.map((row) => [row.id as string, row]));
    const outlets = new Set(menuRows.map((row) => row.outlet as string));
    const allowedOutlets = new Set(["cafe", "pastry", "restaurant"]);
    if ([...outlets].some((outlet) => !allowedOutlets.has(outlet))) {
      throw new Error("One or more items cannot be ordered online.");
    }
    const hasRestaurant = outlets.has("restaurant");
    const hasCafe = outlets.has("cafe") || outlets.has("pastry");
    if (hasRestaurant && hasCafe) {
      throw new Error(
        "Restaurant and cafe items use separate kitchen tickets. Place them as separate orders.",
      );
    }
    const outlet = hasRestaurant
      ? "restaurant"
      : outlets.has("cafe")
        ? "cafe"
        : "pastry";

    const priced = cart.map((line) => {
      const item = byId.get(line.menuItemId);
      if (!item) {
        throw new Error("Menu item missing.");
      }
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

    const nowIso = new Date().toISOString();
    const isRoom = deliveryTypeRaw === "room";

    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        property_id: propertyId,
        outlet,
        customer_name: customerName,
        phone,
        delivery_type: deliveryTypeRaw,
        delivery_area:
          deliveryTypeRaw === "taxi" || deliveryTypeRaw === "room"
            ? deliveryArea
            : null,
        delivery_address: deliveryTypeRaw === "taxi" ? deliveryAddress : null,
        notes,
        status: "received",
        order_source: "public",
        subtotal_btn: subtotalBtn,
        gst_btn: gstBtn,
        total_btn: totalBtn,
        booking_id: bookingId,
        room_unit_id: roomUnitId,
        folio_id: folioId,
        ...(isRoom && folioId
          ? {
              posted_to_folio_at: nowIso,
              settled_at: nowIso,
            }
          : {}),
      })
      .select("id")
      .single();

    if (orderError || !order) {
      console.error("createOrder insert failed", orderError);
      throw new Error("Could not place your order. Please try again.");
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
      console.error("createOrder items insert failed", itemsError);
      await admin.from("orders").delete().eq("id", order.id);
      throw new Error("Could not save order items. Please try again.");
    }

    if (isRoom && folioId && bookingId && totalBtn > 0) {
      const description = priced
        .map((line) => `${line.qty}× ${line.name}`)
        .join(", ");
      try {
        await postFolioCharge(admin, propertyId, {
          folio_id: folioId,
          booking_id: bookingId,
          source_type: "order",
          source_id: order.id as string,
          description: `Room ${roomLabel}: ${description}`,
          qty: 1,
          unit_price_btn: subtotalBtn,
          amount_btn: subtotalBtn,
          gst_applicable: gstBtn > 0,
          gst_btn: gstBtn,
          total_btn: totalBtn,
          room_unit_id: roomUnitId,
          bill_to: "guest",
        });
        await admin.from("order_tenders").insert({
          order_id: order.id,
          method: "room_charge",
          amount_btn: totalBtn,
          folio_id: folioId,
          booking_id: bookingId,
        });
      } catch (e) {
        console.error("createOrder room charge failed", e);
        await admin.from("orders").delete().eq("id", order.id);
        throw new Error(
          e instanceof Error
            ? e.message
            : "Could not charge your room. Please call the desk.",
        );
      }
    }

    const itemSummary = priced
      .map((line) => `${line.qty}× ${line.name}`)
      .join(", ");

    await notifyNewOrder({
      orderId: order.id as string,
      customerName: isRoom ? `Room ${roomLabel}` : customerName,
      phone: isRoom ? `Room ${roomLabel}` : phone,
      deliveryType: deliveryTypeRaw === "room" ? "pickup" : deliveryTypeRaw,
      deliveryArea:
        deliveryTypeRaw === "taxi" || deliveryTypeRaw === "room"
          ? deliveryArea
          : null,
      deliveryAddress,
      outlet,
      totalBtn,
      itemSummary: isRoom
        ? `[ROOM ${roomLabel}] ${itemSummary}`
        : itemSummary,
      notes,
    });

    return {
      ok: true,
      orderId: order.id as string,
      totalBtn,
      chargedToRoom: isRoom,
      roomLabel: roomLabel ?? undefined,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong. Please try again.";
    return { ok: false, error: message };
  }
}
