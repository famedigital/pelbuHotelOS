"use server";

import { writeAuditEvent } from "@/lib/audit";
import { postFolioLine, postPayment } from "@/lib/accounting/posting";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import {
  POS_TENDER_METHODS,
  POS_VOID_REASON_CODES,
  verifyPosManagerPin,
  voidManagerThresholdBtn,
  type PosTenderMethod,
  type PosVoidReasonCode,
} from "@/lib/pos";
import { DEFAULT_GST_RATE, percentToRate } from "@/lib/property-settings";
import { calculateOrderTotals, roundBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { getStaffSession } from "@/lib/staff-auth";
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
const VOID_REASONS = new Set<string>(POS_VOID_REASON_CODES);
const TENDER_METHODS = new Set<string>(POS_TENDER_METHODS);
const TABLE_STATUSES = new Set(["free", "occupied", "reserved", "dirty"]);

type Admin = ReturnType<typeof createSupabaseAdminClient>;

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

async function propertyId(admin: Admin) {
  return resolveActivePropertyId(admin);
}

async function loadPropertyPricing(admin: Admin): Promise<{
  propertyId: string;
  gstRate: number;
  serviceChargeRate: number;
  serviceChargeDefaultOn: boolean;
}> {
  const activePropertyId = await propertyId(admin);
  const { data } = await admin
    .from("properties")
    .select("gst_rate, service_charge_rate, service_charge_default_on")
    .eq("id", activePropertyId)
    .maybeSingle();
  return {
    propertyId: activePropertyId,
    gstRate: Number(data?.gst_rate ?? DEFAULT_GST_RATE),
    serviceChargeRate: Number(data?.service_charge_rate ?? 0),
    serviceChargeDefaultOn: Boolean(data?.service_charge_default_on),
  };
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

type CartModifierInput = {
  groupId: string;
  optionId: string;
  qty?: number;
};

type CartLineInput = {
  menuItemId: string;
  qty: number;
  modifiers?: CartModifierInput[];
  courseNo?: number;
  seatNo?: number;
  lineNotes?: string;
};

type ModifierSnapshot = {
  groupId: string;
  optionId: string;
  name: string;
  qty: number;
  priceBtn: number;
  gstApplicable: boolean;
};

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
    const courseNo = (item as CartLineInput).courseNo;
    if (
      courseNo != null &&
      (!Number.isInteger(courseNo) || courseNo < 1 || courseNo > 12)
    ) {
      throw new Error("Course number must be between 1 and 12.");
    }
    const seatNo = (item as CartLineInput).seatNo;
    if (
      seatNo != null &&
      (!Number.isInteger(seatNo) || seatNo < 1 || seatNo > 40)
    ) {
      throw new Error("Seat number must be between 1 and 40.");
    }
    const modifiersRaw = (item as CartLineInput).modifiers;
    const modifiers: CartModifierInput[] = [];
    if (modifiersRaw != null) {
      if (!Array.isArray(modifiersRaw)) {
        throw new Error("Cart modifiers are invalid.");
      }
      for (const mod of modifiersRaw) {
        if (
          !mod ||
          typeof mod !== "object" ||
          typeof (mod as CartModifierInput).groupId !== "string" ||
          typeof (mod as CartModifierInput).optionId !== "string"
        ) {
          throw new Error("Cart modifiers are invalid.");
        }
        const mQty = (mod as CartModifierInput).qty ?? 1;
        if (!Number.isInteger(mQty) || mQty < 1 || mQty > 20) {
          throw new Error("Modifier quantity must be between 1 and 20.");
        }
        modifiers.push({
          groupId: (mod as CartModifierInput).groupId,
          optionId: (mod as CartModifierInput).optionId,
          qty: mQty,
        });
      }
    }
    const lineNotes = (item as CartLineInput).lineNotes;
    lines.push({
      menuItemId: (item as CartLineInput).menuItemId,
      qty,
      modifiers: modifiers.length ? modifiers : undefined,
      courseNo: courseNo ?? 1,
      seatNo: seatNo ?? undefined,
      lineNotes:
        typeof lineNotes === "string" && lineNotes.trim()
          ? lineNotes.trim().slice(0, 280)
          : undefined,
    });
  }
  return lines;
}

async function resolveModifiers(
  admin: Admin,
  property_id: string,
  cart: CartLineInput[],
): Promise<Map<number, ModifierSnapshot[]>> {
  const byLine = new Map<number, ModifierSnapshot[]>();
  const optionIds = [
    ...new Set(
      cart.flatMap((line) => (line.modifiers ?? []).map((m) => m.optionId)),
    ),
  ];

  const itemIds = [...new Set(cart.map((l) => l.menuItemId))];
  const { data: allGroups } = await admin
    .from("menu_modifier_groups")
    .select("id, menu_item_id, min_sel, max_sel, is_required")
    .eq("property_id", property_id)
    .in("menu_item_id", itemIds);

  const groupsByItem = new Map<string, typeof allGroups>();
  for (const g of allGroups ?? []) {
    const list = groupsByItem.get(g.menu_item_id as string) ?? [];
    list.push(g);
    groupsByItem.set(g.menu_item_id as string, list);
  }

  if (optionIds.length === 0) {
    for (let idx = 0; idx < cart.length; idx++) {
      const required = (groupsByItem.get(cart[idx].menuItemId) ?? []).filter(
        (g) => Boolean(g.is_required) || Number(g.min_sel) > 0,
      );
      if (required.length > 0) {
        throw new Error("Required modifiers are missing.");
      }
    }
    return byLine;
  }

  const { data: options, error } = await admin
    .from("menu_modifier_options")
    .select("id, group_id, name, price_btn, gst_applicable")
    .in("id", optionIds);

  if (error || !options) {
    throw new Error("Could not load modifiers.");
  }

  const optionById = new Map(
    options.map((row) => [row.id as string, row]),
  );
  const groupById = new Map(
    (allGroups ?? []).map((g) => [g.id as string, g]),
  );

  cart.forEach((line, idx) => {
    const mods = line.modifiers ?? [];
    const snapshots: ModifierSnapshot[] = [];
    const countByGroup = new Map<string, number>();

    for (const mod of mods) {
      const opt = optionById.get(mod.optionId);
      if (!opt) throw new Error("One or more modifiers are invalid.");
      if ((opt.group_id as string) !== mod.groupId) {
        throw new Error("Modifier group mismatch.");
      }
      const g = groupById.get(mod.groupId);
      if (!g || (g.menu_item_id as string) !== line.menuItemId) {
        throw new Error("Modifier does not belong to this menu item.");
      }
      const qty = mod.qty ?? 1;
      countByGroup.set(mod.groupId, (countByGroup.get(mod.groupId) ?? 0) + qty);
      snapshots.push({
        groupId: mod.groupId,
        optionId: opt.id as string,
        name: opt.name as string,
        qty,
        priceBtn: Number(opt.price_btn),
        gstApplicable: Boolean(opt.gst_applicable),
      });
    }

    for (const g of groupsByItem.get(line.menuItemId) ?? []) {
      const count = countByGroup.get(g.id as string) ?? 0;
      const minSel = Number(g.min_sel);
      const maxSel = Number(g.max_sel);
      if (Boolean(g.is_required) || minSel > 0) {
        if (count < minSel || count > maxSel) {
          throw new Error(
            `Modifier group requires ${minSel}–${maxSel} selection(s).`,
          );
        }
      } else if (count > maxSel) {
        throw new Error(`Modifier group allows at most ${maxSel} selection(s).`);
      }
    }

    if (snapshots.length) byLine.set(idx, snapshots);
  });

  return byLine;
}

function requireVoidManagerPin(
  amountBtn: number,
  reasonCode: string,
  formData: FormData,
) {
  const needsPin =
    amountBtn >= voidManagerThresholdBtn() ||
    reasonCode === "comp" ||
    reasonCode === "manager_comp";
  if (!needsPin) return;
  const pin = optionalTrim(formData.get("manager_pin"));
  if (!pin || !verifyPosManagerPin(pin)) {
    throw new Error("Manager PIN required for this void.");
  }
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
    const tableId = optionalTrim(formData.get("table_id"));
    const coversRaw = optionalTrim(formData.get("covers"));
    const covers = coversRaw ? Number(coversRaw) : null;
    if (
      covers != null &&
      (!Number.isInteger(covers) || covers < 1 || covers > 40)
    ) {
      throw new Error("Covers must be between 1 and 40.");
    }
    const courseCountRaw = optionalTrim(formData.get("course_count"));
    const courseCount = courseCountRaw ? Number(courseCountRaw) : 1;
    if (
      !Number.isInteger(courseCount) ||
      courseCount < 1 ||
      courseCount > 12
    ) {
      throw new Error("Course count must be between 1 and 12.");
    }
    const serverStaffId = optionalTrim(formData.get("server_staff_id"));
    const parkOnCreate = formData.get("is_parked") === "1";

    const admin = createSupabaseAdminClient();
    const property = await loadPropertyPricing(admin);
    const property_id = property.propertyId;
    const serviceChargeApplied = formData.get("service_charge_applied") === "1";
    const serviceChargeRateRaw = optionalTrim(formData.get("service_charge_rate"));
    const serviceChargeRate = serviceChargeRateRaw
      ? percentToRate(serviceChargeRateRaw)
      : property.serviceChargeRate;
    const serviceChargeReason = optionalTrim(formData.get("service_charge_reason"));

    let tableOutlet: string | null = null;
    if (tableId) {
      const { data: table } = await admin
        .from("dining_tables")
        .select("id, outlet")
        .eq("id", tableId)
        .eq("property_id", property_id)
        .maybeSingle();
      if (!table) throw new Error("Table not found.");
      tableOutlet = (table.outlet as string | null) ?? null;
    }

    if (serverStaffId) {
      const { data: staff } = await admin
        .from("staff_members")
        .select("id")
        .eq("id", serverStaffId)
        .eq("property_id", property_id)
        .maybeSingle();
      if (!staff) throw new Error("Server staff not found.");
    }

    const ids = [...new Set(cart.map((line) => line.menuItemId))];
    const { data: menuRows, error: menuError } = await admin
      .from("menu_items")
      .select("id, name, price_btn, gst_applicable, outlet, is_available")
      .in("id", ids)
      .eq("property_id", property_id)
      .eq("is_available", true);

    if (menuError || !menuRows || menuRows.length !== ids.length) {
      throw new Error("One or more menu items are unavailable.");
    }

    // Derive a primary outlet for the order row (KOT label only — the cart can
    // mix outlets). Priority: table's outlet if set, else cafe > pastry >
    // restaurant > bar from the cart.
    const cartOutlets = new Set(menuRows.map((row) => row.outlet as string));
    const outlet =
      tableOutlet ??
      (cartOutlets.has("cafe")
        ? "cafe"
        : cartOutlets.has("pastry")
          ? "pastry"
          : cartOutlets.has("restaurant")
            ? "restaurant"
            : cartOutlets.has("bar")
              ? "bar"
              : "cafe");

    const modifiersByLine = await resolveModifiers(admin, property_id, cart);
    const byId = new Map(menuRows.map((row) => [row.id as string, row]));
    const priced = cart.map((line, idx) => {
      const item = byId.get(line.menuItemId);
      if (!item) throw new Error("Menu item missing.");
      const modifiers = modifiersByLine.get(idx) ?? [];
      return {
        menuItemId: line.menuItemId,
        qty: line.qty,
        name: item.name as string,
        unitPriceBtn: Number(item.price_btn),
        gstApplicable: Boolean(item.gst_applicable),
        modifiers,
        courseNo: line.courseNo ?? 1,
        seatNo: line.seatNo ?? null,
        lineNotes: line.lineNotes ?? null,
      };
    });

    const { subtotalBtn, serviceChargeBtn, gstBtn, totalBtn } = calculateOrderTotals(
      priced.map((line) => ({
        qty: line.qty,
        unitPriceBtn: line.unitPriceBtn,
        gstApplicable: line.gstApplicable,
        modifiers: line.modifiers.map((m) => ({
          priceBtn: m.priceBtn,
          qty: m.qty,
          gstApplicable: m.gstApplicable,
        })),
      })),
      {
        gstRate: property.gstRate,
        serviceChargeRate,
        applyServiceCharge: serviceChargeApplied,
      },
    );

    let folioId: string | null = null;
    if (settleMode === "room_charge" && bookingId) {
      folioId = await ensureOpenFolio(admin, property_id, bookingId);
    }

    const nowIso = new Date().toISOString();
    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        property_id,
        outlet,
        customer_name: customerName,
        phone,
        delivery_type: "pickup",
        notes,
        status: parkOnCreate ? "received" : "received",
        kot_status: parkOnCreate ? "new" : "new",
        order_source: settleMode === "room_charge" ? "room_charge" : "desk",
        booking_id: bookingId,
        folio_id: folioId,
        table_id: tableId,
        covers,
        server_staff_id: serverStaffId,
        course_count: courseCount,
        is_parked: parkOnCreate,
        parked_at: parkOnCreate ? nowIso : null,
        subtotal_btn: subtotalBtn,
        service_charge_rate: serviceChargeApplied ? serviceChargeRate : 0,
        service_charge_btn: serviceChargeBtn,
        service_charge_applied: serviceChargeApplied,
        service_charge_reason: serviceChargeReason,
        gst_btn: gstBtn,
        total_btn: totalBtn,
        posted_to_folio_at:
          settleMode === "room_charge" ? nowIso : null,
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
        modifiers: line.modifiers,
        course_no: line.courseNo,
        seat_no: line.seatNo,
        line_notes: line.lineNotes,
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
      const { data: folioLine, error: lineError } = await admin
        .from("folio_lines")
        .insert({
          folio_id: folioId,
          booking_id: bookingId,
          source_type: "order",
          source_id: order.id,
          description: `Desk ${outlet}: ${description}`,
          qty: 1,
          unit_price_btn: subtotalBtn,
          amount_btn: subtotalBtn,
          service_charge_rate: serviceChargeApplied ? serviceChargeRate : 0,
          service_charge_btn: serviceChargeBtn,
          service_charge_applied: serviceChargeApplied,
          service_charge_reason: serviceChargeReason,
          gst_applicable: gstBtn > 0,
          gst_btn: gstBtn,
          total_btn: totalBtn,
          status: "posted",
        })
        .select("id, source_type, description, total_btn, gst_btn, created_at")
        .single();
      if (lineError || !folioLine) {
        console.error("createDeskOrder folio line failed", lineError);
      } else {
        await postFolioLine(admin, property_id, {
          id: folioLine.id as string,
          source_type: "order",
          description: folioLine.description as string | null,
          total_btn: Number(folioLine.total_btn),
          gst_btn: Number(folioLine.gst_btn),
          created_at: folioLine.created_at as string,
        });
        await admin.from("order_tenders").insert({
          order_id: order.id,
          method: "room_charge",
          amount_btn: totalBtn,
          folio_id: folioId,
          booking_id: bookingId,
        });
      }
    }

    if (tableId) {
      await admin
        .from("dining_tables")
        .update({ status: "occupied" })
        .eq("id", tableId)
        .eq("property_id", property_id);
    }

    await writeAuditEvent(admin, {
      propertyId: property_id,
      action: "pos.order.create",
      entityType: "orders",
      entityId: order.id as string,
      summary: `POS ${outlet} · ${formatShort(totalBtn)}${parkOnCreate ? " · parked" : ""}`,
      meta: { outlet, settleMode, tableId, parkOnCreate, totalBtn },
    });

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

function formatShort(amount: number): string {
  return `Nu ${amount.toLocaleString("en-BT", { maximumFractionDigits: 2 })}`;
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
  const property = await loadPropertyPricing(admin);
  const property_id = property.propertyId;

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select(
      "id, customer_name, subtotal_btn, service_charge_rate, service_charge_btn, service_charge_applied, service_charge_reason, gst_btn, total_btn, folio_id, posted_to_folio_at, booking_id",
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

  const { data: folioLine, error: lineError } = await admin
    .from("folio_lines")
    .insert({
      folio_id: folioId,
      booking_id: bookingId,
      source_type: "order",
      source_id: orderId,
      description,
      qty: 1,
      unit_price_btn: Number(order.subtotal_btn),
      amount_btn: Number(order.subtotal_btn),
      service_charge_rate: Number(order.service_charge_rate ?? 0),
      service_charge_btn: Number(order.service_charge_btn ?? 0),
      service_charge_applied: Boolean(order.service_charge_applied),
      service_charge_reason: (order.service_charge_reason as string | null) ?? null,
      gst_applicable: Number(order.gst_btn) > 0,
      gst_btn: Number(order.gst_btn),
      total_btn: Number(order.total_btn),
      status: "posted",
    })
    .select("id, source_type, description, total_btn, gst_btn, created_at")
    .single();

  if (lineError || !folioLine) {
    throw new Error("Could not post order to folio.");
  }

  await postFolioLine(admin, property_id, {
    id: folioLine.id as string,
    source_type: "order",
    description: folioLine.description as string | null,
    total_btn: Number(folioLine.total_btn),
    gst_btn: Number(folioLine.gst_btn),
    created_at: folioLine.created_at as string,
  });

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
    const gstApplicable = formData.get("gst_applicable") === "1";
    const notes = optionalTrim(formData.get("notes"));
    const serviceChargeApplied = formData.get("service_charge_applied") === "1";

    const admin = createSupabaseAdminClient();
    const property = await loadPropertyPricing(admin);
    const property_id = property.propertyId;
    const serviceChargeRateRaw = optionalTrim(formData.get("service_charge_rate"));
    const serviceChargeRate = serviceChargeRateRaw
      ? percentToRate(serviceChargeRateRaw)
      : property.serviceChargeRate;
    const serviceChargeBtn = serviceChargeApplied
      ? roundBtn(amountBtn * serviceChargeRate)
      : 0;
    const gstBase = gstApplicable ? amountBtn + serviceChargeBtn : 0;
    const gstBtn = gstApplicable ? roundBtn(gstBase * property.gstRate) : 0;
    const totalBtn = roundBtn(amountBtn + serviceChargeBtn + gstBtn);
    const folioId = await ensureOpenFolio(admin, property_id, bookingId);

    const { data: folioLine, error } = await admin
      .from("folio_lines")
      .insert({
        folio_id: folioId,
        booking_id: bookingId,
        source_type: "guest_service",
        description: `${kind}: ${description}${notes ? ` · ${notes}` : ""}`,
        qty: 1,
        unit_price_btn: amountBtn,
        amount_btn: amountBtn,
        service_charge_rate: serviceChargeApplied ? serviceChargeRate : 0,
        service_charge_btn: serviceChargeBtn,
        service_charge_applied: serviceChargeApplied,
        service_charge_reason: notes,
        gst_applicable: gstApplicable,
        gst_btn: gstBtn,
        total_btn: totalBtn,
        status: "posted",
      })
      .select("id, source_type, description, total_btn, gst_btn, created_at")
      .single();
    if (error || !folioLine) {
      throw new Error("Could not post guest service to folio.");
    }
    await postFolioLine(admin, property_id, {
      id: folioLine.id as string,
      source_type: "guest_service",
      description: folioLine.description as string | null,
      total_btn: Number(folioLine.total_btn),
      gst_btn: Number(folioLine.gst_btn),
      created_at: folioLine.created_at as string,
    });

    revalidatePath("/erp");
    revalidatePath(`/erp/folios/${folioId}`);
    revalidatePath("/erp/finance");
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

    await postPayment(admin, property_id, {
      id: payment.id as string,
      method,
      kind: "settlement",
      amount_btn: amountBtn,
      notes,
    });

    revalidatePath("/erp");
    revalidatePath(`/erp/folios/${folioId}`);
    revalidatePath("/erp/reports");
    revalidatePath("/erp/finance");
    return { ok: true, paymentId: payment.id as string };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

export type PosActionState = {
  ok: boolean;
  error?: string;
  orderId?: string;
};

export async function parkOrder(
  _prev: PosActionState,
  formData: FormData,
): Promise<PosActionState> {
  try {
    await requireDesk();
    const orderId = trimRequired(formData.get("order_id"), "Order");
    const admin = createSupabaseAdminClient();
    const property_id = await propertyId(admin);

    const { data: order, error } = await admin
      .from("orders")
      .select("id, voided_at, is_parked")
      .eq("id", orderId)
      .eq("property_id", property_id)
      .single();
    if (error || !order) throw new Error("Order not found.");
    if (order.voided_at) throw new Error("Cannot park a voided order.");

    const { error: patchError } = await admin
      .from("orders")
      .update({ is_parked: true, parked_at: new Date().toISOString() })
      .eq("id", orderId);
    if (patchError) throw new Error("Could not park order.");

    await writeAuditEvent(admin, {
      propertyId: property_id,
      action: "pos.order.park",
      entityType: "orders",
      entityId: orderId,
      summary: `Parked order ${orderId.slice(0, 8)}`,
    });

    revalidatePath("/erp");
    revalidatePath("/erp/pos");
    return { ok: true, orderId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

export async function unparkOrder(
  _prev: PosActionState,
  formData: FormData,
): Promise<PosActionState> {
  try {
    await requireDesk();
    const orderId = trimRequired(formData.get("order_id"), "Order");
    const admin = createSupabaseAdminClient();
    const property_id = await propertyId(admin);

    const { data: order, error } = await admin
      .from("orders")
      .select("id, voided_at")
      .eq("id", orderId)
      .eq("property_id", property_id)
      .single();
    if (error || !order) throw new Error("Order not found.");
    if (order.voided_at) throw new Error("Cannot unpark a voided order.");

    const { error: patchError } = await admin
      .from("orders")
      .update({ is_parked: false, parked_at: null })
      .eq("id", orderId);
    if (patchError) throw new Error("Could not unpark order.");

    await writeAuditEvent(admin, {
      propertyId: property_id,
      action: "pos.order.unpark",
      entityType: "orders",
      entityId: orderId,
      summary: `Unparked order ${orderId.slice(0, 8)}`,
    });

    revalidatePath("/erp");
    revalidatePath("/erp/pos");
    return { ok: true, orderId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

export async function voidOrder(
  _prev: PosActionState,
  formData: FormData,
): Promise<PosActionState> {
  try {
    await requireDesk();
    const orderId = trimRequired(formData.get("order_id"), "Order");
    const reasonCode = trimRequired(formData.get("reason_code"), "Reason");
    if (!VOID_REASONS.has(reasonCode)) {
      throw new Error("Invalid void reason.");
    }
    const reasonText = optionalTrim(formData.get("reason_text"));
    const managerStaffId = optionalTrim(formData.get("manager_staff_id"));

    const admin = createSupabaseAdminClient();
    const property_id = await propertyId(admin);

    const { data: order, error } = await admin
      .from("orders")
      .select("id, total_btn, voided_at, table_id")
      .eq("id", orderId)
      .eq("property_id", property_id)
      .single();
    if (error || !order) throw new Error("Order not found.");
    if (order.voided_at) throw new Error("Order is already voided.");

    const amountBtn = Number(order.total_btn);
    requireVoidManagerPin(amountBtn, reasonCode, formData);

    const nowIso = new Date().toISOString();
    const { error: patchError } = await admin
      .from("orders")
      .update({
        voided_at: nowIso,
        void_reason: reasonText ?? reasonCode,
        void_by: "desk",
        kot_status: "cancelled",
        status: "cancelled",
        is_parked: false,
      })
      .eq("id", orderId);
    if (patchError) throw new Error("Could not void order.");

    await admin.from("order_items").update({
      voided_at: nowIso,
      void_reason: reasonText ?? reasonCode,
    }).eq("order_id", orderId).is("voided_at", null);

    const { error: voidInsertError } = await admin.from("pos_voids").insert({
      property_id,
      order_id: orderId,
      reason_code: reasonCode as PosVoidReasonCode,
      reason_text: reasonText,
      manager_staff_id: managerStaffId,
      amount_btn: amountBtn,
      created_by: "desk",
    });
    if (voidInsertError) {
      console.error("pos_voids insert failed", voidInsertError);
    }

    if (order.table_id) {
      await admin
        .from("dining_tables")
        .update({ status: "dirty" })
        .eq("id", order.table_id as string);
    }

    await writeAuditEvent(admin, {
      propertyId: property_id,
      action: "pos.order.void",
      entityType: "orders",
      entityId: orderId,
      summary: `Voided order · ${reasonCode} · ${formatShort(amountBtn)}`,
      meta: { reasonCode, amountBtn },
    });

    revalidatePath("/erp");
    revalidatePath("/erp/pos");
    return { ok: true, orderId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

export async function voidOrderItem(
  _prev: PosActionState,
  formData: FormData,
): Promise<PosActionState> {
  try {
    await requireDesk();
    const orderId = trimRequired(formData.get("order_id"), "Order");
    const itemId = trimRequired(formData.get("order_item_id"), "Order item");
    const reasonCode = trimRequired(formData.get("reason_code"), "Reason");
    if (!VOID_REASONS.has(reasonCode)) {
      throw new Error("Invalid void reason.");
    }
    const reasonText = optionalTrim(formData.get("reason_text"));
    const managerStaffId = optionalTrim(formData.get("manager_staff_id"));

    const admin = createSupabaseAdminClient();
    const property_id = await propertyId(admin);

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, voided_at, gst_btn, total_btn, subtotal_btn, service_charge_rate, service_charge_applied, service_charge_btn")
      .eq("id", orderId)
      .eq("property_id", property_id)
      .single();
    if (orderError || !order) throw new Error("Order not found.");
    if (order.voided_at) throw new Error("Order is already voided.");

    const { data: item, error: itemError } = await admin
      .from("order_items")
      .select(
        "id, order_id, qty, unit_price_btn, gst_applicable, modifiers, voided_at, name_snapshot",
      )
      .eq("id", itemId)
      .eq("order_id", orderId)
      .single();
    if (itemError || !item) throw new Error("Order item not found.");
    if (item.voided_at) throw new Error("Item is already voided.");

    const mods = (item.modifiers as ModifierSnapshot[] | null) ?? [];
    const lineAmount = calculateOrderTotals(
      [
        {
          qty: Number(item.qty),
          unitPriceBtn: Number(item.unit_price_btn),
          gstApplicable: Boolean(item.gst_applicable),
          modifiers: mods.map((m) => ({
            priceBtn: Number(m.priceBtn),
            qty: Number(m.qty ?? 1),
            gstApplicable: Boolean(m.gstApplicable),
          })),
        },
      ],
      { applyServiceCharge: false },
    ).subtotalBtn;

    requireVoidManagerPin(lineAmount, reasonCode, formData);

    const nowIso = new Date().toISOString();
    const { error: patchItemError } = await admin
      .from("order_items")
      .update({
        voided_at: nowIso,
        void_reason: reasonText ?? reasonCode,
      })
      .eq("id", itemId);
    if (patchItemError) throw new Error("Could not void item.");

    // Recalculate order totals from remaining live lines
    const { data: liveItems } = await admin
      .from("order_items")
      .select("qty, unit_price_btn, gst_applicable, modifiers")
      .eq("order_id", orderId)
      .is("voided_at", null);

    const property = await loadPropertyPricing(admin);
    const serviceChargeApplied = Boolean(order.service_charge_applied);
    const serviceChargeRate = Number(order.service_charge_rate ?? 0);
    const totals = calculateOrderTotals(
      (liveItems ?? []).map((row) => {
        const rowMods = (row.modifiers as ModifierSnapshot[] | null) ?? [];
        return {
          qty: Number(row.qty),
          unitPriceBtn: Number(row.unit_price_btn),
          gstApplicable: Boolean(row.gst_applicable),
          modifiers: rowMods.map((m) => ({
            priceBtn: Number(m.priceBtn),
            qty: Number(m.qty ?? 1),
            gstApplicable: Boolean(m.gstApplicable),
          })),
        };
      }),
      {
        gstRate: property.gstRate,
        serviceChargeRate,
        applyServiceCharge: serviceChargeApplied,
      },
    );

    await admin
      .from("orders")
      .update({
        subtotal_btn: totals.subtotalBtn,
        service_charge_btn: totals.serviceChargeBtn,
        gst_btn: totals.gstBtn,
        total_btn: totals.totalBtn,
      })
      .eq("id", orderId);

    await admin.from("pos_voids").insert({
      property_id,
      order_id: orderId,
      order_item_id: itemId,
      reason_code: reasonCode as PosVoidReasonCode,
      reason_text: reasonText,
      manager_staff_id: managerStaffId,
      amount_btn: lineAmount,
      created_by: "desk",
    });

    await writeAuditEvent(admin, {
      propertyId: property_id,
      action: "pos.item.void",
      entityType: "order_items",
      entityId: itemId,
      summary: `Voided line ${item.name_snapshot as string} · ${reasonCode}`,
      meta: { orderId, lineAmount, reasonCode },
    });

    revalidatePath("/erp");
    revalidatePath("/erp/pos");
    return { ok: true, orderId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

type TenderInput = {
  method: PosTenderMethod;
  amountBtn: number;
  reference?: string;
  bookingId?: string;
};

function parseTenders(raw: FormDataEntryValue | null): TenderInput[] {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error("Tenders are required.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Tenders data is invalid.");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Add at least one tender.");
  }
  const tenders: TenderInput[] = [];
  for (const row of parsed) {
    if (!row || typeof row !== "object") {
      throw new Error("Tenders data is invalid.");
    }
    const method = (row as { method?: string }).method;
    const amount = Number((row as { amountBtn?: number }).amountBtn);
    if (!method || !TENDER_METHODS.has(method)) {
      throw new Error("Invalid tender method.");
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Each tender amount must be greater than zero.");
    }
    const reference = (row as { reference?: string }).reference;
    const bookingId = (row as { bookingId?: string }).bookingId;
    tenders.push({
      method: method as PosTenderMethod,
      amountBtn: roundBtn(amount),
      reference:
        typeof reference === "string" && reference.trim()
          ? reference.trim().slice(0, 120)
          : undefined,
      bookingId:
        typeof bookingId === "string" && bookingId.trim()
          ? bookingId.trim()
          : undefined,
    });
  }
  return tenders;
}

export type SplitSettleState = {
  ok: boolean;
  orderId?: string;
  error?: string;
};

export async function splitSettle(
  _prev: SplitSettleState,
  formData: FormData,
): Promise<SplitSettleState> {
  try {
    await requireDesk();
    const orderId = trimRequired(formData.get("order_id"), "Order");
    const tenders = parseTenders(formData.get("tenders"));

    const admin = createSupabaseAdminClient();
    const property_id = await propertyId(admin);

    const { data: order, error } = await admin
      .from("orders")
      .select(
        "id, total_btn, voided_at, settled_at, customer_name, outlet, table_id, folio_id, booking_id, posted_to_folio_at, subtotal_btn, service_charge_rate, service_charge_btn, service_charge_applied, service_charge_reason, gst_btn",
      )
      .eq("id", orderId)
      .eq("property_id", property_id)
      .single();
    if (error || !order) throw new Error("Order not found.");
    if (order.voided_at) throw new Error("Cannot settle a voided order.");
    if (order.settled_at) throw new Error("Order is already settled.");

    const tenderSum = roundBtn(
      tenders.reduce((sum, t) => sum + t.amountBtn, 0),
    );
    const totalBtn = Number(order.total_btn);
    if (Math.abs(tenderSum - totalBtn) > 0.01) {
      throw new Error(
        `Tenders (${tenderSum}) must equal order total (${totalBtn}).`,
      );
    }

    const { data: existingTenders } = await admin
      .from("order_tenders")
      .select("id")
      .eq("order_id", orderId)
      .limit(1);
    if (existingTenders && existingTenders.length > 0) {
      throw new Error("Order already has tenders. Use recall first.");
    }

    let folioId: string | null = (order.folio_id as string | null) ?? null;
    for (const tender of tenders) {
      let tenderFolioId: string | null = null;
      const tenderBookingId: string | null = tender.bookingId ?? null;

      if (tender.method === "room_charge") {
        if (!tenderBookingId) {
          throw new Error("Room-charge tender requires a booking.");
        }
        tenderFolioId = await ensureOpenFolio(
          admin,
          property_id,
          tenderBookingId,
        );
        folioId = tenderFolioId;

        const { data: folioLine, error: lineError } = await admin
          .from("folio_lines")
          .insert({
            folio_id: tenderFolioId,
            booking_id: tenderBookingId,
            source_type: "order",
            source_id: orderId,
            description: `POS split · ${order.outlet as string} · ${order.customer_name as string}`,
            qty: 1,
            unit_price_btn: tender.amountBtn,
            amount_btn: tender.amountBtn,
            service_charge_rate: 0,
            service_charge_btn: 0,
            service_charge_applied: false,
            gst_applicable: false,
            gst_btn: 0,
            total_btn: tender.amountBtn,
            status: "posted",
          })
          .select("id, source_type, description, total_btn, gst_btn, created_at")
          .single();
        if (lineError || !folioLine) {
          throw new Error("Could not post room-charge tender to folio.");
        }
        await postFolioLine(admin, property_id, {
          id: folioLine.id as string,
          source_type: "order",
          description: folioLine.description as string | null,
          total_btn: Number(folioLine.total_btn),
          gst_btn: Number(folioLine.gst_btn),
          created_at: folioLine.created_at as string,
        });
      }

      const { error: tenderError } = await admin.from("order_tenders").insert({
        order_id: orderId,
        method: tender.method,
        amount_btn: tender.amountBtn,
        reference: tender.reference ?? null,
        folio_id: tenderFolioId,
        booking_id: tenderBookingId,
      });
      if (tenderError) {
        throw new Error("Could not save tender.");
      }

      if (tender.method !== "room_charge" && tender.method !== "agent_credit") {
        // Non-room cash/card tenders: optional payment row when folio exists
        if (folioId) {
          const { data: payment } = await admin
            .from("payments")
            .insert({
              property_id,
              folio_id: folioId,
              booking_id: tenderBookingId ?? order.booking_id,
              method: tender.method === "bank_qr" ? "bank_qr" : tender.method,
              amount_btn: tender.amountBtn,
              reference: tender.reference ?? null,
              notes: `POS tender · order ${orderId.slice(0, 8)}`,
            })
            .select("id")
            .single();
          if (payment?.id) {
            await postPayment(admin, property_id, {
              id: payment.id as string,
              method: tender.method,
              kind: "settlement",
              amount_btn: tender.amountBtn,
              notes: tender.reference ?? null,
            });
          }
        }
      }
    }

    const nowIso = new Date().toISOString();
    const hasRoom = tenders.some((t) => t.method === "room_charge");
    const roomBookingId =
      tenders.find((t) => t.method === "room_charge")?.bookingId ?? null;

    const { error: patchError } = await admin
      .from("orders")
      .update({
        settled_at: nowIso,
        is_parked: false,
        parked_at: null,
        folio_id: folioId,
        booking_id: roomBookingId ?? order.booking_id,
        order_source: hasRoom ? "room_charge" : "desk",
        posted_to_folio_at: hasRoom
          ? ((order.posted_to_folio_at as string | null) ?? nowIso)
          : order.posted_to_folio_at,
        status: "completed",
      })
      .eq("id", orderId);

    if (patchError) {
      throw new Error("Tenders saved, but order settle failed.");
    }

    if (order.table_id) {
      await admin
        .from("dining_tables")
        .update({ status: "dirty" })
        .eq("id", order.table_id as string);
    }

    await writeAuditEvent(admin, {
      propertyId: property_id,
      action: "pos.order.settle",
      entityType: "orders",
      entityId: orderId,
      summary: `Settled · ${formatShort(totalBtn)} · ${tenders.length} tender(s)`,
      meta: { tenders, totalBtn },
    });

    revalidatePath("/erp");
    revalidatePath("/erp/pos");
    if (folioId) revalidatePath(`/erp/folios/${folioId}`);
    revalidatePath("/erp/finance");
    return { ok: true, orderId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

export async function recallOrder(
  _prev: PosActionState,
  formData: FormData,
): Promise<PosActionState> {
  try {
    await requireDesk();
    const orderId = trimRequired(formData.get("order_id"), "Order");
    const admin = createSupabaseAdminClient();
    const property_id = await propertyId(admin);

    const { data: order, error } = await admin
      .from("orders")
      .select("id, voided_at, settled_at, kot_status")
      .eq("id", orderId)
      .eq("property_id", property_id)
      .single();
    if (error || !order) throw new Error("Order not found.");
    if (order.voided_at) throw new Error("Cannot recall a voided order.");

    const { error: patchError } = await admin
      .from("orders")
      .update({
        settled_at: null,
        status: "preparing",
        kot_status:
          order.kot_status === "cancelled" ? "new" : order.kot_status,
        is_parked: false,
      })
      .eq("id", orderId);
    if (patchError) throw new Error("Could not recall order.");

    await writeAuditEvent(admin, {
      propertyId: property_id,
      action: "pos.order.recall",
      entityType: "orders",
      entityId: orderId,
      summary: `Recalled order ${orderId.slice(0, 8)}`,
    });

    revalidatePath("/erp");
    revalidatePath("/erp/pos");
    return { ok: true, orderId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

export type DiningTableState = {
  ok: boolean;
  tableId?: string;
  error?: string;
};

export async function saveDiningTable(
  _prev: DiningTableState,
  formData: FormData,
): Promise<DiningTableState> {
  try {
    await requireDesk();

    const tableId = optionalTrim(formData.get("table_id"));
    const name = trimRequired(formData.get("name"), "Table name");
    if (name.length > 24) {
      throw new Error("Table name must be 24 characters or fewer.");
    }
    const area = optionalTrim(formData.get("area")) || "main";
    const outlet = optionalTrim(formData.get("outlet"));
    if (outlet && !OUTLETS.has(outlet)) {
      throw new Error("Choose cafe, pastry, restaurant, or bar.");
    }

    const seatsRaw = trimRequired(formData.get("seats"), "Seats");
    const seats = Number(seatsRaw);
    if (!Number.isInteger(seats) || seats < 1 || seats > 40) {
      throw new Error("Seats must be between 1 and 40.");
    }

    const status = optionalTrim(formData.get("status")) || "free";
    if (!TABLE_STATUSES.has(status)) {
      throw new Error("Invalid table status.");
    }

    const sortRaw = optionalTrim(formData.get("sort_order"));
    const sortOrder = sortRaw ? Number(sortRaw) : 0;
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) {
      throw new Error("Sort order must be between 0 and 9999.");
    }

    const admin = createSupabaseAdminClient();
    const property_id = await propertyId(admin);

    const payload = {
      property_id,
      name,
      area,
      outlet: outlet || null,
      seats,
      status,
      sort_order: sortOrder,
    };

    if (tableId) {
      const { error } = await admin
        .from("dining_tables")
        .update(payload)
        .eq("id", tableId)
        .eq("property_id", property_id);
      if (error) {
        throw new Error(
          error.code === "23505"
            ? "A table with that name already exists."
            : "Could not update table.",
        );
      }
      await writeAuditEvent(admin, {
        propertyId: property_id,
        action: "pos.table.update",
        entityType: "dining_tables",
        entityId: tableId,
        summary: `Table ${name} updated`,
        meta: payload,
      });
      revalidatePath("/erp/pos");
      return { ok: true, tableId };
    }

    const { data: created, error } = await admin
      .from("dining_tables")
      .insert(payload)
      .select("id")
      .single();
    if (error || !created) {
      throw new Error(
        error?.code === "23505"
          ? "A table with that name already exists."
          : "Could not create table.",
      );
    }

    await writeAuditEvent(admin, {
      propertyId: property_id,
      action: "pos.table.create",
      entityType: "dining_tables",
      entityId: created.id as string,
      summary: `Table ${name} created`,
      meta: payload,
    });

    revalidatePath("/erp/pos");
    return { ok: true, tableId: created.id as string };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

export async function saveTablePosition(
  formData: FormData,
): Promise<void> {
  try {
    await requireDesk();
    const tableId = trimRequired(formData.get("table_id"), "Table");
    const xRaw = Number(formData.get("pos_x"));
    const yRaw = Number(formData.get("pos_y"));
    if (!Number.isFinite(xRaw) || !Number.isFinite(yRaw)) return;
    const pos_x = Math.max(0, Math.min(100, xRaw));
    const pos_y = Math.max(0, Math.min(100, yRaw));

    const admin = createSupabaseAdminClient();
    const activePropertyId = await propertyId(admin);

    await admin
      .from("dining_tables")
      .update({ pos_x, pos_y })
      .eq("id", tableId)
      .eq("property_id", activePropertyId);
  } catch (err) {
    console.error("saveTablePosition failed", err);
  }
}

export async function deleteDiningTable(
  _prev: DiningTableState,
  formData: FormData,
): Promise<DiningTableState> {
  try {
    await requireDesk();
    const tableId = trimRequired(formData.get("table_id"), "Table");

    const admin = createSupabaseAdminClient();
    const property_id = await propertyId(admin);

    const { data: table, error } = await admin
      .from("dining_tables")
      .select("id, name")
      .eq("id", tableId)
      .eq("property_id", property_id)
      .maybeSingle();
    if (error || !table) throw new Error("Table not found.");

    const { data: liveOrders } = await admin
      .from("orders")
      .select("id")
      .eq("property_id", property_id)
      .eq("table_id", tableId)
      .is("voided_at", null)
      .is("settled_at", null)
      .limit(1);
    if (liveOrders && liveOrders.length > 0) {
      throw new Error("Table has an open ticket. Settle or void it first.");
    }

    const { error: delError } = await admin
      .from("dining_tables")
      .delete()
      .eq("id", tableId)
      .eq("property_id", property_id);
    if (delError) throw new Error("Could not delete table.");

    await writeAuditEvent(admin, {
      propertyId: property_id,
      action: "pos.table.delete",
      entityType: "dining_tables",
      entityId: tableId,
      summary: `Table ${table.name as string} deleted`,
    });

    revalidatePath("/erp/pos");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

export async function updateTableStatus(
  _prev: PosActionState,
  formData: FormData,
): Promise<PosActionState> {
  try {
    await requireDesk();
    const tableId = trimRequired(formData.get("table_id"), "Table");
    const status = trimRequired(formData.get("status"), "Status");
    if (!TABLE_STATUSES.has(status)) {
      throw new Error("Invalid table status.");
    }

    const admin = createSupabaseAdminClient();
    const property_id = await propertyId(admin);

    const { data: table, error } = await admin
      .from("dining_tables")
      .select("id")
      .eq("id", tableId)
      .eq("property_id", property_id)
      .maybeSingle();
    if (error || !table) throw new Error("Table not found.");

    const { error: patchError } = await admin
      .from("dining_tables")
      .update({ status })
      .eq("id", tableId);
    if (patchError) throw new Error("Could not update table.");

    await writeAuditEvent(admin, {
      propertyId: property_id,
      action: "pos.table.status",
      entityType: "dining_tables",
      entityId: tableId,
      summary: `Table status → ${status}`,
      meta: { status },
    });

    revalidatePath("/erp/pos");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

export type ConfirmOrderState = {
  ok: boolean;
  orderId?: string;
  error?: string;
};

/**
 * Step 1 of the online order flow — desk acknowledges the order.
 *
 * Public orders land as `status='received'`, `kot_status='new'`,
 * `confirmed_at=null`. Confirming stamps `confirmed_at` / `confirmed_by` and
 * nothing else: the kitchen must not fire yet, because the guest has not paid.
 * The desk opens the confirmation slip (`/erp/orders/[id]/slip`), sends the
 * screenshot to the guest from their own WhatsApp, and waits for the transfer.
 * Payment is captured in `recordOnlineOrderPayment`, which is what releases
 * the KOT. No messaging API is involved anywhere in this path.
 *
 * Already-confirmed orders no-op so the action stays idempotent across the
 * desk's live refresh.
 */
export async function confirmPublicOrder(
  _prev: ConfirmOrderState,
  formData: FormData,
): Promise<ConfirmOrderState> {
  try {
    await requireDesk();
    // POS runs on the shared desk PIN; a personal staff session is a bonus we
    // stamp when present, never a requirement.
    const staff = await getStaffSession();
    const orderId = trimRequired(formData.get("order_id"), "Order");

    const admin = createSupabaseAdminClient();
    const property_id = await propertyId(admin);

    const { data: order, error } = await admin
      .from("orders")
      .select(
        "id, property_id, status, kot_status, order_source, voided_at, confirmed_at, customer_name, phone, delivery_type, delivery_area, total_btn, outlet",
      )
      .eq("id", orderId)
      .maybeSingle();
    if (error || !order) throw new Error("Order not found.");
    if (order.property_id !== property_id) {
      throw new Error("Order belongs to a different property.");
    }
    if (order.voided_at) throw new Error("Order was cancelled.");
    if ((order.order_source as string) !== "public") {
      throw new Error("Only public online orders need confirmation.");
    }
    if (order.confirmed_at) {
      return { ok: true, orderId };
    }

    const { error: patchError } = await admin
      .from("orders")
      .update({
        confirmed_at: new Date().toISOString(),
        confirmed_by: staff?.staffId ?? null,
      })
      .eq("id", orderId)
      .is("confirmed_at", null);
    if (patchError) throw new Error("Could not confirm order.");

    await writeAuditEvent(admin, {
      propertyId: property_id,
      action: "pos.order.confirm",
      entityType: "orders",
      entityId: orderId,
      summary: `Confirmed public order ${orderId.slice(0, 8)} (${order.customer_name ?? "guest"}) — awaiting payment`,
      meta: {
        staffId: staff?.staffId ?? null,
        staffName: staff?.fullName ?? null,
        totalBtn: Number(order.total_btn ?? 0),
      },
      actor: staff?.fullName ?? "desk",
    });

    revalidatePath("/erp");
    revalidatePath("/erp/pos");
    revalidatePath(`/erp/orders/${orderId}/slip`);
    return { ok: true, orderId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

/**
 * Plain-form-action wrapper around `confirmPublicOrder` for the desk dashboard
 * where there's no `useActionState` to thread the previous state through.
 */
export async function confirmPublicOrderAction(formData: FormData): Promise<void> {
  await confirmPublicOrder({ ok: false }, formData);
}

const ONLINE_PAY_METHODS = new Set([
  "mbob",
  "bnb_mpay",
  "bank_transfer",
  "cash",
  "card",
  "other",
]);

/**
 * Step 2 of the online order flow — desk records the guest's transfer.
 *
 * The guest pays by mobile banking and WhatsApps the journal number to the
 * desk. Recording it here stamps the payment columns and only then advances
 * `kot_status` to 'preparing', which is the moment the ticket appears on the
 * kitchen display. Idempotent: a second submit on an already-paid order
 * returns ok without overwriting the original journal number.
 */
export async function recordOnlineOrderPayment(
  _prev: ConfirmOrderState,
  formData: FormData,
): Promise<ConfirmOrderState> {
  try {
    await requireDesk();
    const staff = await getStaffSession();
    const orderId = trimRequired(formData.get("order_id"), "Order");
    const journalNo = trimRequired(
      formData.get("payment_journal_no"),
      "Journal number",
    );
    if (journalNo.length < 4 || journalNo.length > 64) {
      throw new Error("Journal number looks wrong. Copy it from the transfer.");
    }
    const method = optionalTrim(formData.get("payment_method")) ?? "mbob";
    if (!ONLINE_PAY_METHODS.has(method)) {
      throw new Error("Unknown payment method.");
    }

    const admin = createSupabaseAdminClient();
    const property_id = await propertyId(admin);

    const { data: order, error } = await admin
      .from("orders")
      .select(
        "id, property_id, order_source, voided_at, confirmed_at, payment_recorded_at, customer_name, total_btn, outlet",
      )
      .eq("id", orderId)
      .maybeSingle();
    if (error || !order) throw new Error("Order not found.");
    if (order.property_id !== property_id) {
      throw new Error("Order belongs to a different property.");
    }
    if (order.voided_at) throw new Error("Order was cancelled.");
    if ((order.order_source as string) !== "public") {
      throw new Error("Only public online orders are paid this way.");
    }
    if (!order.confirmed_at) {
      throw new Error("Confirm the order before recording payment.");
    }
    if (order.payment_recorded_at) {
      return { ok: true, orderId };
    }

    const { error: patchError } = await admin
      .from("orders")
      .update({
        payment_journal_no: journalNo,
        payment_method: method,
        payment_recorded_at: new Date().toISOString(),
        payment_recorded_by: staff?.staffId ?? null,
        kot_status: "preparing",
        status: "preparing",
      })
      .eq("id", orderId)
      .is("payment_recorded_at", null);
    if (patchError) throw new Error("Could not record payment.");

    await writeAuditEvent(admin, {
      propertyId: property_id,
      action: "pos.order.payment",
      entityType: "orders",
      entityId: orderId,
      summary: `Payment recorded for online order ${orderId.slice(0, 8)} — journal ${journalNo}, sent to kitchen`,
      meta: {
        staffId: staff?.staffId ?? null,
        staffName: staff?.fullName ?? null,
        journalNo,
        method,
        totalBtn: Number(order.total_btn ?? 0),
      },
      actor: staff?.fullName ?? "desk",
    });

    revalidatePath("/erp");
    revalidatePath("/erp/pos");
    revalidatePath("/erp/kds");
    revalidatePath(`/erp/orders/${orderId}/slip`);
    return { ok: true, orderId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}

/** Plain-form-action wrapper for the desk dashboard. */
export async function recordOnlineOrderPaymentAction(
  formData: FormData,
): Promise<void> {
  await recordOnlineOrderPayment({ ok: false }, formData);
}
