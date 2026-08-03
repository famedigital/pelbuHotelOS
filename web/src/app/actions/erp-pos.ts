"use server";

import { writeAuditEvent } from "@/lib/audit";
import { postPosWalkInTender } from "@/lib/accounting/posting";
import { periodGuardFromForm } from "@/lib/accounting/period-guard-form";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import { isDeskAuthenticated, requireMoneyDesk } from "@/lib/desk-auth";
import { thimphuToday } from "@/lib/erp-lists";
import { allocateSplitGst, postFolioCharge } from "@/lib/folio/post-charge";
import { postFolioPaymentRecord } from "@/lib/folio/post-payment";
import {
  applyDiscountPct,
  resolveBookingPartnerDiscountPct,
} from "@/lib/partners/discount";
import { verifyManagerPinForProperty } from "@/lib/manager-pin";
import { orderRef } from "@/lib/order-ref";
import {
  POS_TENDER_METHODS,
  POS_VOID_REASON_CODES,
  voidManagerThresholdBtn,
  type PosTenderMethod,
  type PosVoidReasonCode,
} from "@/lib/pos";
import { DEFAULT_GST_RATE, percentToRate } from "@/lib/property-settings";
import { calculateOrderTotals, roundBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { assertPropertyOutlet } from "@/lib/outlets";
import { resolveDeskActor } from "@/lib/desk/actor";
import { getStaffSession } from "@/lib/staff-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assertPhone,
  optionalTrim,
  trimRequired,
} from "@/lib/validation";
import { revalidatePath } from "next/cache";

const KOT_STATUSES = new Set(["new", "preparing", "ready", "served", "cancelled"]);
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

async function openShiftId(admin: Admin, propertyId: string) {
  const { data } = await admin
    .from("pos_shifts")
    .select("id")
    .eq("property_id", propertyId)
    .eq("status", "open")
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
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

async function requireVoidManagerPin(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  propertyId: string,
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
  if (!pin) {
    throw new Error("Manager PIN required for this void.");
  }
  const verified = await verifyManagerPinForProperty(admin, propertyId, pin);
  if (!verified.ok) {
    throw new Error(verified.error);
  }
}

export type DeskPosState = {
  ok: boolean;
  orderId?: string;
  folioId?: string;
  totalBtn?: number;
  settleMode?: "cash" | "room_charge";
  error?: string;
  message?: string;
};

export async function createDeskOrder(
  _prev: DeskPosState,
  formData: FormData,
): Promise<DeskPosState> {
  try {
    await requireMoneyDesk();

    const customerName = trimRequired(formData.get("customer_name"), "Guest name");
    const phoneRaw = optionalTrim(formData.get("phone"));
    const phone = phoneRaw ?? "walk-in";
    if (phoneRaw) assertPhone(phoneRaw);

    const settleMode = trimRequired(formData.get("settle_mode"), "Settle mode");
    if (settleMode !== "cash" && settleMode !== "room_charge") {
      throw new Error("Choose cash or room charge.");
    }

    const bookingId = optionalTrim(formData.get("booking_id"));
    const roomUnitId = optionalTrim(formData.get("room_unit_id"));
    const bookingGuestId = optionalTrim(formData.get("booking_guest_id"));
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
    const posShiftId = await openShiftId(admin, property_id);
    const serviceChargeApplied = formData.get("service_charge_applied") === "1";
    const serviceChargeRateRaw = optionalTrim(formData.get("service_charge_rate"));
    const serviceChargeRate = serviceChargeRateRaw
      ? percentToRate(serviceChargeRateRaw)
      : property.serviceChargeRate;
    const serviceChargeReason = optionalTrim(formData.get("service_charge_reason"));

    if (bookingId) {
      const { data: booking } = await admin
        .from("bookings")
        .select("id")
        .eq("id", bookingId)
        .eq("property_id", property_id)
        .maybeSingle();
      if (!booking) throw new Error("Selected stay was not found.");
    }
    if (roomUnitId) {
      const { data: assignment } = await admin
        .from("room_assignments")
        .select("id")
        .eq("booking_id", bookingId)
        .eq("room_unit_id", roomUnitId)
        .maybeSingle();
      if (!assignment) throw new Error("Room does not belong to this stay.");
    }
    if (bookingGuestId) {
      const { data: guest } = await admin
        .from("booking_guests")
        .select("id")
        .eq("id", bookingGuestId)
        .eq("booking_id", bookingId)
        .maybeSingle();
      if (!guest) throw new Error("Guest does not belong to this stay.");
    }

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
    // mix outlets). Prefer the table's outlet, else the first cart item's outlet.
    const cartOutlets = menuRows.map((row) => row.outlet as string);
    const outlet = tableOutlet ?? cartOutlets[0];
    if (!outlet) {
      throw new Error("Could not determine outlet for this ticket.");
    }

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
        pos_shift_id: posShiftId,
        booking_id: bookingId,
        room_unit_id: roomUnitId,
        booking_guest_id: bookingGuestId,
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
        posted_to_folio_at: null,
        settled_at: null,
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

    if (!parkOnCreate) {
      const { error: stockError } = await admin.rpc("pos_apply_order_stock", {
        p_order_id: order.id,
        p_reverse: false,
      });
      if (stockError) {
        await admin.from("orders").delete().eq("id", order.id);
        throw new Error(
          stockError.message.includes("Insufficient stock")
            ? stockError.message
            : "Could not issue menu stock.",
        );
      }
    }

    if (settleMode === "room_charge" && folioId && bookingId) {
      const description = priced
        .map((line) => `${line.qty}× ${line.name}`)
        .join(", ");
      try {
        const partner = await resolveBookingPartnerDiscountPct(
          admin,
          bookingId,
        );
        const discSubtotal = applyDiscountPct(subtotalBtn, partner.pct);
        const discService = applyDiscountPct(serviceChargeBtn, partner.pct);
        const discGst = applyDiscountPct(gstBtn, partner.pct);
        const discTotal = roundBtn(discSubtotal + discService + discGst);
        const descSuffix =
          partner.pct > 0
            ? ` (−${partner.pct}% ${partner.source ?? "partner"})`
            : "";
        await postFolioCharge(admin, property_id, {
          folio_id: folioId,
          booking_id: bookingId,
          source_type: "order",
          source_id: order.id,
          description: `Desk ${outlet}: ${description}${descSuffix}`,
          qty: 1,
          unit_price_btn: discSubtotal,
          amount_btn: discSubtotal,
          service_charge_rate: serviceChargeApplied ? serviceChargeRate : 0,
          service_charge_btn: discService,
          service_charge_applied: serviceChargeApplied,
          service_charge_reason: serviceChargeReason,
          gst_applicable: discGst > 0,
          gst_btn: discGst,
          total_btn: discTotal,
        });
        const { error: folioLinkError } = await admin
          .from("orders")
          .update({
            posted_to_folio_at: nowIso,
            settled_at: nowIso,
          })
          .eq("id", order.id);
        if (folioLinkError) {
          throw new Error("Folio line posted, but order linkage failed.");
        }
        await admin.from("order_tenders").insert({
          order_id: order.id,
          method: "room_charge",
          amount_btn: totalBtn,
          folio_id: folioId,
          booking_id: bookingId,
        });
      } catch (e) {
        await admin.from("orders").delete().eq("id", order.id);
        throw new Error(
          e instanceof Error ? e.message : "Could not post room charge to folio.",
        );
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
    const message =
      settleMode === "room_charge" && folioId
        ? `Charged to room · ${formatShort(totalBtn)} · guest pays at checkout`
        : parkOnCreate
          ? `Parked · ${formatShort(totalBtn)}`
          : `Ticket saved · ${formatShort(totalBtn)} · settle when ready`;
    return {
      ok: true,
      orderId: order.id as string,
      folioId: folioId ?? undefined,
      totalBtn,
      settleMode,
      message,
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
  const { error } = await admin.from("orders").update(patch).eq("id", orderId);
  if (error) {
    throw new Error("Could not update order status.");
  }

  revalidatePath("/erp");
  revalidatePath("/erp/pos");
  revalidatePath("/erp/kds");
  revalidatePath("/erp/kds/pass");
}

export async function postOrderToBookingFolio(formData: FormData): Promise<void> {
  await requireMoneyDesk();

  const orderId = trimRequired(formData.get("order_id"), "Order");
  const bookingId = trimRequired(formData.get("booking_id"), "Booking");

  const admin = createSupabaseAdminClient();
  const property = await loadPropertyPricing(admin);
  const property_id = property.propertyId;

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select(
      "id, customer_name, outlet, subtotal_btn, service_charge_rate, service_charge_btn, service_charge_applied, service_charge_reason, gst_btn, total_btn, folio_id, posted_to_folio_at, settled_at, voided_at, booking_id, property_id, table_id",
    )
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    throw new Error("Order not found.");
  }
  assertDeskProperty(property_id, order.property_id as string, "Order");
  if (order.voided_at) {
    throw new Error("Cannot post a voided order to a folio.");
  }
  if (order.posted_to_folio_at) {
    throw new Error("Order is already posted to a folio.");
  }
  if (order.settled_at) {
    throw new Error(
      "Order is already settled. Use the existing tenders; do not post again.",
    );
  }

  const { data: booking } = await admin
    .from("bookings")
    .select("id, property_id")
    .eq("id", bookingId)
    .single();
  if (!booking) throw new Error("Booking not found.");
  assertDeskProperty(property_id, booking.property_id as string, "Booking");

  const { data: existingTenders } = await admin
    .from("order_tenders")
    .select("id")
    .eq("order_id", orderId)
    .limit(1);
  if (existingTenders && existingTenders.length > 0) {
    throw new Error(
      "Order already has tenders. Settle is complete or recall first.",
    );
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

  const partner = await resolveBookingPartnerDiscountPct(admin, bookingId);
  const subtotalBtn = Number(order.subtotal_btn);
  const serviceChargeBtn = Number(order.service_charge_btn ?? 0);
  const gstBtn = Number(order.gst_btn);
  const totalBtn = Number(order.total_btn);
  const discSubtotal = applyDiscountPct(subtotalBtn, partner.pct);
  const discService = applyDiscountPct(serviceChargeBtn, partner.pct);
  const discGst = applyDiscountPct(gstBtn, partner.pct);
  const discTotal = roundBtn(discSubtotal + discService + discGst);
  const descSuffix =
    partner.pct > 0
      ? ` (−${partner.pct}% ${partner.source ?? "partner"})`
      : "";
  const outlet = (order.outlet as string | null) ?? "F&B";

  await postFolioCharge(admin, property_id, {
    folio_id: folioId,
    booking_id: bookingId,
    source_type: "order",
    source_id: orderId,
    description: `Desk ${outlet}: ${description}${descSuffix}`,
    qty: 1,
    unit_price_btn: discSubtotal,
    amount_btn: discSubtotal,
    service_charge_rate: Number(order.service_charge_rate ?? 0),
    service_charge_btn: discService,
    service_charge_applied: Boolean(order.service_charge_applied),
    service_charge_reason: (order.service_charge_reason as string | null) ?? null,
    gst_applicable: discGst > 0,
    gst_btn: discGst,
    total_btn: discTotal,
  });

  const nowIso = new Date().toISOString();
  const { error: patchError } = await admin
    .from("orders")
    .update({
      booking_id: bookingId,
      folio_id: folioId,
      order_source: "room_charge",
      posted_to_folio_at: nowIso,
      settled_at: nowIso,
      is_parked: false,
      parked_at: null,
      status: "completed",
    })
    .eq("id", orderId);

  if (patchError) {
    throw new Error("Folio saved, but order linkage failed.");
  }

  const { error: tenderError } = await admin.from("order_tenders").insert({
    order_id: orderId,
    method: "room_charge",
    amount_btn: discTotal > 0 ? discTotal : totalBtn,
    folio_id: folioId,
    booking_id: bookingId,
  });
  if (tenderError) {
    throw new Error("Order posted to folio, but room-charge tender failed.");
  }

  if (order.table_id) {
    await admin
      .from("dining_tables")
      .update({ status: "dirty" })
      .eq("id", order.table_id as string);
  }

  await writeAuditEvent(admin, {
    propertyId: property_id,
    action: "pos.order.post_to_folio",
    entityType: "orders",
    entityId: orderId,
    summary: `Charge to room · ${formatShort(discTotal > 0 ? discTotal : totalBtn)}`,
    meta: { bookingId, folioId },
  });

  revalidatePath("/erp");
  revalidatePath("/erp/pos");
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
    await requireMoneyDesk();

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

    const { data: booking } = await admin
      .from("bookings")
      .select("id, property_id")
      .eq("id", bookingId)
      .single();
    if (!booking) throw new Error("Booking not found.");
    assertDeskProperty(property_id, booking.property_id as string, "Booking");

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

    await postFolioCharge(admin, property_id, {
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
    await requireMoneyDesk();

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
    const clientKey = optionalTrim(formData.get("idempotency_key"));

    const admin = createSupabaseAdminClient();
    const property_id = await propertyId(admin);

    const { data: folio, error: folioError } = await admin
      .from("folios")
      .select("id, booking_id, status, property_id")
      .eq("id", folioId)
      .eq("property_id", property_id)
      .single();

    if (folioError || !folio) {
      throw new Error("Folio not found.");
    }
    assertDeskProperty(property_id, folio.property_id as string, "Folio");
    if ((folio.status as string) !== "open") {
      throw new Error("Folio is not open.");
    }

    const pay = await postFolioPaymentRecord(admin, {
      property_id,
      folio_id: folioId,
      booking_id: folio.booking_id as string | null,
      method,
      amount_btn: amountBtn,
      kind: "settlement",
      reference,
      notes,
      folio_line_source: "payment",
      idempotency_key:
        clientKey ??
        (reference
          ? `folio_payment:${folioId}:${method}:${reference}:${amountBtn}`
          : `folio_payment:${folioId}:${method}:${amountBtn}`),
      period_guard: periodGuardFromForm(formData, property_id),
    });

    if (pay.alreadyExists) {
      return { ok: true, paymentId: pay.paymentId };
    }

    await writeAuditEvent(admin, {
      propertyId: property_id,
      action: "payment.create",
      entityType: "payments",
      entityId: pay.paymentId,
      summary: `Payment ${amountBtn} Nu · ${method}`,
      meta: { folioId, method, amountBtn },
    });

    revalidatePath("/erp");
    revalidatePath(`/erp/folios/${folioId}`);
    revalidatePath("/erp/reports");
    revalidatePath("/erp/finance");
    return { ok: true, paymentId: pay.paymentId };
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

    const { error: stockError } = await admin.rpc("pos_apply_order_stock", {
      p_order_id: orderId,
      p_reverse: false,
    });
    if (stockError) {
      throw new Error(
        stockError.message.includes("Insufficient stock")
          ? stockError.message
          : "Could not issue menu stock.",
      );
    }

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
    await requireMoneyDesk();
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
      .select("id, total_btn, voided_at, table_id, property_id")
      .eq("id", orderId)
      .single();
    if (error || !order) throw new Error("Order not found.");
    assertDeskProperty(property_id, order.property_id as string, "Order");
    if (order.voided_at) throw new Error("Order is already voided.");

    const amountBtn = Number(order.total_btn);
    await requireVoidManagerPin(admin, property_id, amountBtn, reasonCode, formData);

    const { error: stockError } = await admin.rpc("pos_apply_order_stock", {
      p_order_id: orderId,
      p_reverse: true,
    });
    if (stockError) throw new Error("Could not restore order stock.");

    const { actor } = await resolveDeskActor();

    const nowIso = new Date().toISOString();
    const { error: patchError } = await admin
      .from("orders")
      .update({
        voided_at: nowIso,
        void_reason: reasonText ?? reasonCode,
        void_by: actor,
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
      created_by: actor,
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
    await requireMoneyDesk();
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
      .select("id, voided_at, gst_btn, total_btn, subtotal_btn, service_charge_rate, service_charge_applied, service_charge_btn, property_id")
      .eq("id", orderId)
      .single();
    if (orderError || !order) throw new Error("Order not found.");
    assertDeskProperty(property_id, order.property_id as string, "Order");
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

    await requireVoidManagerPin(admin, property_id, lineAmount, reasonCode, formData);

    const { error: stockError } = await admin.rpc(
      "pos_apply_order_item_stock",
      {
        p_order_item_id: itemId,
        p_reverse: true,
      },
    );
    if (stockError) throw new Error("Could not restore item stock.");

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

    const { actor } = await resolveDeskActor();

    await admin.from("pos_voids").insert({
      property_id,
      order_id: orderId,
      order_item_id: itemId,
      reason_code: reasonCode as PosVoidReasonCode,
      reason_text: reasonText,
      manager_staff_id: managerStaffId,
      amount_btn: lineAmount,
      created_by: actor,
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
  folioId?: string;
  totalBtn?: number;
  methods?: string[];
  error?: string;
  message?: string;
};

export async function splitSettle(
  _prev: SplitSettleState,
  formData: FormData,
): Promise<SplitSettleState> {
  try {
    await requireMoneyDesk();
    const orderId = trimRequired(formData.get("order_id"), "Order");
    const tenders = parseTenders(formData.get("tenders"));

    const admin = createSupabaseAdminClient();
    const property_id = await propertyId(admin);
    const posShiftId = await openShiftId(admin, property_id);
    const needsDrawer = tenders.some(
      (tender) =>
        tender.method !== "room_charge" && tender.method !== "agent_credit",
    );
    if (needsDrawer && !posShiftId) {
      throw new Error("Open a POS shift before taking guest payment.");
    }

    const { data: order, error } = await admin
      .from("orders")
      .select(
        "id, total_btn, voided_at, settled_at, customer_name, outlet, table_id, folio_id, booking_id, pos_shift_id, posted_to_folio_at, subtotal_btn, service_charge_rate, service_charge_btn, service_charge_applied, service_charge_reason, gst_btn, property_id",
      )
      .eq("id", orderId)
      .single();
    if (error || !order) throw new Error("Order not found.");
    assertDeskProperty(property_id, order.property_id as string, "Order");
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

        const orderGst = Number(order.gst_btn ?? 0);
        const gstShare = allocateSplitGst(
          tender.amountBtn,
          totalBtn,
          orderGst,
        );
        const netShare = roundBtn(tender.amountBtn - gstShare);

        try {
          await postFolioCharge(admin, property_id, {
            folio_id: tenderFolioId,
            booking_id: tenderBookingId,
            source_type: "order",
            source_id: orderId,
            description: `POS split · ${order.outlet as string} · ${order.customer_name as string}`,
            qty: 1,
            unit_price_btn: netShare,
            amount_btn: netShare,
            service_charge_rate: 0,
            service_charge_btn: 0,
            service_charge_applied: false,
            gst_applicable: orderGst > 0,
            gst_btn: gstShare,
            total_btn: tender.amountBtn,
          });
        } catch (e) {
          throw new Error(
            e instanceof Error
              ? e.message
              : "Could not post room-charge tender to folio.",
          );
        }
      }

      const { data: tenderRow, error: tenderError } = await admin
        .from("order_tenders")
        .insert({
          order_id: orderId,
          method: tender.method,
          amount_btn: tender.amountBtn,
          reference: tender.reference ?? null,
          folio_id: tenderFolioId,
          booking_id: tenderBookingId,
        })
        .select("id")
        .single();
      if (tenderError || !tenderRow) {
        throw new Error("Could not save tender.");
      }

      if (tender.method !== "room_charge" && tender.method !== "agent_credit") {
        // Folio settle → guest AR payment journals. Walk-in (no folio) → cash sale.
        if (folioId) {
          await postFolioPaymentRecord(admin, {
            property_id,
            folio_id: folioId,
            booking_id: (tenderBookingId ?? order.booking_id) as string | null,
            method: tender.method === "bank_qr" ? "bank_qr" : tender.method,
            amount_btn: tender.amountBtn,
            kind: "settlement",
            reference: tender.reference ?? null,
            notes: `POS tender · order ${orderId.slice(0, 8)}`,
            folio_line_source: "payment",
            idempotency_key: `pos_tender:${orderId}:${tender.method}:${tender.amountBtn}:${tender.reference ?? ""}`,
          });
        } else {
          const orderGst = Number(order.gst_btn ?? 0);
          const gstShare = allocateSplitGst(
            tender.amountBtn,
            totalBtn,
            orderGst,
          );
          const gl = await postPosWalkInTender(admin, property_id, {
            id: tenderRow.id as string,
            method: tender.method,
            amount_btn: tender.amountBtn,
            gst_btn: gstShare,
            notes: `POS walk-in · order ${orderId.slice(0, 8)} · ${order.customer_name as string}`,
          });
          if (!gl.ok) {
            throw new Error(gl.error ?? "Could not post walk-in sale to ledger.");
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
        pos_shift_id: posShiftId ?? order.pos_shift_id,
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
    revalidatePath(`/erp/orders/${orderId}/receipt`);
    if (folioId) revalidatePath(`/erp/folios/${folioId}`);
    revalidatePath("/erp/finance");
    const methodList = [...new Set(tenders.map((t) => t.method))];
    const methodText = methodList.join(" + ");
    const message = folioId
      ? `Settled ${formatShort(totalBtn)} · ${methodText} · open folio to issue tax invoice`
      : `Settled ${formatShort(totalBtn)} · ${methodText}`;
    return {
      ok: true,
      orderId,
      folioId: folioId ?? undefined,
      totalBtn,
      methods: methodList,
      message,
    };
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
    if (outlet) {
      await assertPropertyOutlet(admin, property_id, outlet);
    }

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

export type PosShiftState = {
  ok: boolean;
  shiftId?: string;
  message?: string;
  error?: string;
};

export async function openPosShift(
  _prev: PosShiftState,
  formData: FormData,
): Promise<PosShiftState> {
  try {
    await requireMoneyDesk();
    const openingFloat = Number(formData.get("opening_float_btn") ?? 0);
    if (!Number.isFinite(openingFloat) || openingFloat < 0) {
      throw new Error("Opening float cannot be negative.");
    }
    const admin = createSupabaseAdminClient();
    const property_id = await propertyId(admin);
    const existing = await openShiftId(admin, property_id);
    if (existing) throw new Error("A POS shift is already open.");
    const staff = await getStaffSession();
    const { data, error } = await admin
      .from("pos_shifts")
      .insert({
        property_id,
        business_date: thimphuToday(),
        opening_float_btn: roundBtn(openingFloat),
        opened_by: staff?.staffId ?? null,
        opened_by_name: staff?.fullName ?? "desk",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error("Could not open POS shift.");
    await writeAuditEvent(admin, {
      propertyId: property_id,
      action: "pos.shift.open",
      entityType: "pos_shifts",
      entityId: data.id as string,
      summary: `Opened POS shift with Nu ${openingFloat.toFixed(2)} float`,
      actor: staff?.fullName ?? "desk",
    });
    revalidatePath("/erp/pos");
    return { ok: true, shiftId: data.id as string, message: "Shift opened." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not open shift.",
    };
  }
}

export async function closePosShift(
  _prev: PosShiftState,
  formData: FormData,
): Promise<PosShiftState> {
  try {
    await requireMoneyDesk();
    const shiftId = trimRequired(formData.get("shift_id"), "Shift");
    const countedCash = Number(formData.get("counted_cash_btn"));
    if (!Number.isFinite(countedCash) || countedCash < 0) {
      throw new Error("Counted cash cannot be negative.");
    }
    const pin = trimRequired(formData.get("manager_pin"), "Manager PIN");
    const notes = optionalTrim(formData.get("notes"));

    const admin = createSupabaseAdminClient();
    const property_id = await propertyId(admin);
    const verified = await verifyManagerPinForProperty(admin, property_id, pin);
    if (!verified.ok) throw new Error(verified.error);
    const staff = await getStaffSession();

    const { data: shift } = await admin
      .from("pos_shifts")
      .select("id, property_id, opening_float_btn, status, closed_at")
      .eq("id", shiftId)
      .single();
    if (!shift) throw new Error("Shift not found.");
    assertDeskProperty(property_id, shift.property_id as string, "POS shift");
    if (shift.closed_at || shift.status !== "open") {
      throw new Error("Open shift not found.");
    }

    const { data: shiftOrders } = await admin
      .from("orders")
      .select("id, settled_at, voided_at, customer_name, kot_status")
      .eq("pos_shift_id", shiftId);
    const openOrders = (shiftOrders ?? []).filter(
      (order) => !order.voided_at && !order.settled_at,
    );
    if (openOrders.length > 0) {
      const sample = openOrders.slice(0, 5).map((order) => {
        const ref = orderRef(order.id as string);
        const name = ((order.customer_name as string | null) ?? "").trim();
        const kitchen = (order.kot_status as string | null) ?? "new";
        return name ? `${ref} · ${name} (${kitchen})` : `${ref} (${kitchen})`;
      });
      const extra =
        openOrders.length > 5 ? ` +${openOrders.length - 5} more` : "";
      throw new Error(
        `Settle or void ${openOrders.length} open ticket(s) before closing: ${sample.join("; ")}${extra}. Check Open tickets (includes kitchen-served, unpaid).`,
      );
    }
    const orderIds = (shiftOrders ?? []).map((order) => order.id as string);
    const { data: tenders } =
      orderIds.length > 0
        ? await admin
            .from("order_tenders")
            .select("method, amount_btn")
            .in("order_id", orderIds)
        : { data: [] };
    const totals: Record<string, number> = {};
    for (const tender of tenders ?? []) {
      const method = tender.method as string;
      totals[method] = roundBtn(
        (totals[method] ?? 0) + Number(tender.amount_btn),
      );
    }
    const voidedIds = (shiftOrders ?? [])
      .filter((order) => Boolean(order.voided_at))
      .map((order) => order.id as string);
    const { data: voids } =
      voidedIds.length > 0
        ? await admin
            .from("pos_voids")
            .select("amount_btn")
            .in("order_id", voidedIds)
        : { data: [] };
    const voidTotal = roundBtn(
      (voids ?? []).reduce(
        (sum, row) => sum + Number(row.amount_btn ?? 0),
        0,
      ),
    );
    const expectedCash = roundBtn(
      Number(shift.opening_float_btn) + (totals.cash ?? 0),
    );
    const variance = roundBtn(countedCash - expectedCash);
    const nowIso = new Date().toISOString();
    const { error } = await admin
      .from("pos_shifts")
      .update({
        status: "closed",
        expected_cash_btn: expectedCash,
        counted_cash_btn: roundBtn(countedCash),
        variance_btn: variance,
        tender_totals: totals,
        void_total_btn: voidTotal,
        closed_by: staff?.staffId ?? null,
        closed_by_name: staff?.fullName ?? "desk",
        manager_approved_by:
          verified.source === "staff"
            ? verified.staffId
            : (staff?.staffId ?? null),
        closed_at: nowIso,
        notes,
      })
      .eq("id", shiftId)
      .eq("status", "open");
    if (error) throw new Error("Could not close POS shift.");
    await writeAuditEvent(admin, {
      propertyId: property_id,
      action: "pos.shift.close",
      entityType: "pos_shifts",
      entityId: shiftId,
      summary: `Closed POS shift · variance Nu ${variance.toFixed(2)}`,
      meta: { totals, expectedCash, countedCash, variance, voidTotal },
      actor: staff?.fullName ?? "desk",
    });
    revalidatePath("/erp/pos");
    revalidatePath("/erp/night-audit");
    return {
      ok: true,
      shiftId,
      message: `Shift closed. Variance: Nu ${variance.toFixed(2)}.`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not close shift.",
    };
  }
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
    await requireMoneyDesk();
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
    assertDeskProperty(property_id, order.property_id as string, "Order");
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

    const { error: stockError } = await admin.rpc("pos_apply_order_stock", {
      p_order_id: orderId,
      p_reverse: false,
    });
    if (stockError) {
      throw new Error(
        stockError.message.includes("Insufficient stock")
          ? stockError.message
          : "Could not issue menu stock.",
      );
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
