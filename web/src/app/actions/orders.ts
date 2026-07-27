"use server";

import { notifyNewOrder } from "@/lib/notify";
import { calculateOrderTotals } from "@/lib/pricing";
import { PELBU_PROPERTY_SLUG } from "@/lib/property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertPhone,
  optionalTrim,
  trimRequired,
} from "@/lib/validation";

export type OrderActionState = {
  ok: boolean;
  orderId?: string;
  totalBtn?: number;
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

export async function createOrder(
  _prev: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  try {
    const customerName = trimRequired(formData.get("customer_name"), "Full name");
    const phone = trimRequired(formData.get("phone"), "Phone");
    assertPhone(phone);

    const deliveryTypeRaw = trimRequired(
      formData.get("delivery_type"),
      "Delivery option",
    );
    if (deliveryTypeRaw !== "pickup" && deliveryTypeRaw !== "taxi") {
      throw new Error("Choose pickup or taxi delivery.");
    }

    const deliveryAddress = optionalTrim(formData.get("delivery_address"));
    if (deliveryTypeRaw === "taxi" && !deliveryAddress) {
      throw new Error("Taxi delivery needs an address or landmark in Thimphu.");
    }

    const notes = optionalTrim(formData.get("notes"));
    const cart = parseCart(formData.get("cart"));

    const admin = createSupabaseAdminClient();

    const { data: property, error: propertyError } = await admin
      .from("properties")
      .select("id")
      .eq("slug", PELBU_PROPERTY_SLUG)
      .single();

    if (propertyError || !property) {
      throw new Error("Hotel property is not configured. Please call the cafe.");
    }

    const ids = [...new Set(cart.map((line) => line.menuItemId))];
    const { data: menuRows, error: menuError } = await admin
      .from("menu_items")
      .select("id, name, price_btn, gst_applicable, outlet, is_available, property_id")
      .in("id", ids)
      .eq("property_id", property.id)
      .eq("is_available", true);

    if (menuError || !menuRows) {
      console.error("createOrder menu fetch failed", menuError);
      throw new Error("Could not load menu prices. Please try again.");
    }

    if (menuRows.length !== ids.length) {
      throw new Error("One or more items are no longer available. Refresh the menu.");
    }

    const byId = new Map(menuRows.map((row) => [row.id as string, row]));
    const outlets = new Set(menuRows.map((row) => row.outlet as string));
    // Cafe + pastry share one public order flow; pick primary outlet for KOT routing.
    const outlet = outlets.has("cafe")
      ? "cafe"
      : outlets.has("pastry")
        ? "pastry"
        : (menuRows[0].outlet as string);

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

    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        property_id: property.id,
        outlet,
        customer_name: customerName,
        phone,
        delivery_type: deliveryTypeRaw,
        delivery_address: deliveryTypeRaw === "taxi" ? deliveryAddress : null,
        notes,
        status: "received",
        subtotal_btn: subtotalBtn,
        gst_btn: gstBtn,
        total_btn: totalBtn,
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

    const itemSummary = priced
      .map((line) => `${line.qty}× ${line.name}`)
      .join(", ");

    await notifyNewOrder({
      orderId: order.id,
      customerName,
      phone,
      deliveryType: deliveryTypeRaw,
      deliveryAddress,
      outlet,
      totalBtn,
      itemSummary,
      notes,
    });

    return { ok: true, orderId: order.id, totalBtn };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong. Please try again.";
    return { ok: false, error: message };
  }
}
