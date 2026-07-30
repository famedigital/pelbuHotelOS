"use server";

import { isValidThimphuArea } from "@/lib/delivery-areas";
import { notifyNewOrder } from "@/lib/notify";
import { loadMenuStockMap } from "@/lib/menu-stock";
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

    const deliveryArea = optionalTrim(formData.get("delivery_area"));
    const deliveryAddress = optionalTrim(formData.get("delivery_address"));
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

    const stock = await loadMenuStockMap(admin, property.id as string, ids);
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
    // Cafe + pastry share a public ticket; restaurant routes to its own KOT.
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

    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        property_id: property.id,
        outlet,
        customer_name: customerName,
        phone,
        delivery_type: deliveryTypeRaw,
        delivery_area: deliveryTypeRaw === "taxi" ? deliveryArea : null,
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
      deliveryArea: deliveryTypeRaw === "taxi" ? deliveryArea : null,
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
