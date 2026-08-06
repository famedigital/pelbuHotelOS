"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  canAdvanceBagStatus,
  canWorkLaundry,
  laundryBagScanPath,
  makeLaundryBagPublicCode,
  validateBagAllocations,
  type LaundryBag,
  type LaundryBagDraft,
  type LaundryBagStatus,
  type LaundryOrder,
} from "@/lib/laundry";
import {
  createLaundryToken,
  hashLaundryToken,
} from "@/lib/laundry-session";
import { requireStaffSession, type StaffSession } from "@/lib/staff-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";

export type LaundryBagState = {
  ok: boolean;
  message?: string;
  error?: string;
  orderId?: string;
  bags?: {
    id: string;
    bagSeq: number;
    publicCode: string;
    rawToken: string;
    scanPath: string;
  }[];
};

async function requireLaundryStaff() {
  const session = await requireStaffSession();
  if (!canWorkLaundry(session)) {
    throw new Error("Your staff account is not assigned to laundry.");
  }
  return session;
}

function refreshBags(orderId?: string) {
  revalidatePath("/staff/laundry");
  revalidatePath("/erp/laundry");
  if (orderId) {
    revalidatePath(`/erp/laundry/orders/${orderId}/labels`);
    revalidatePath(`/staff/laundry/bags`);
  }
}

function parseBagDrafts(value: FormDataEntryValue | null): LaundryBagDraft[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(value ?? "[]"));
  } catch {
    throw new Error("Bag allocation payload is invalid.");
  }
  if (!Array.isArray(parsed)) throw new Error("Add at least one bag.");
  return parsed.map((row, index) => {
    if (!row || typeof row !== "object") {
      throw new Error(`Bag ${index + 1} is invalid.`);
    }
    const itemsRaw =
      "items" in row && Array.isArray(row.items) ? row.items : [];
    const notes =
      "notes" in row && row.notes != null ? String(row.notes).trim() : undefined;
    const items = itemsRaw.flatMap((line: unknown) => {
      if (!line || typeof line !== "object") return [];
      const orderItemId =
        "orderItemId" in line
          ? String(line.orderItemId)
          : "order_item_id" in line
            ? String(line.order_item_id)
            : "";
      const qty = "qty" in line ? Number(line.qty) : 0;
      return orderItemId && Number.isInteger(qty) && qty >= 1
        ? [{ orderItemId, qty }]
        : [];
    });
    return { items, notes: notes || undefined };
  });
}

export async function prepareLaundryBags(
  _prev: LaundryBagState,
  formData: FormData,
): Promise<LaundryBagState> {
  try {
    const session = await requireLaundryStaff();
    const orderId = trimRequired(formData.get("order_id"), "Laundry order");
    const drafts = parseBagDrafts(formData.get("bags"));
    const requireFull = formData.get("require_full") !== "0";
    const admin = createSupabaseAdminClient();
    const { data: order } = await admin
      .from("laundry_orders")
      .select(
        "id, status, laundry_order_items(id, confirmed_qty, requested_qty)",
      )
      .eq("id", orderId)
      .eq("property_id", session.propertyId)
      .maybeSingle();
    if (!order) throw new Error("Laundry order not found.");
    const items = (order.laundry_order_items ?? []) as {
      id: string;
      confirmed_qty: number | null;
      requested_qty: number;
    }[];
    const validation = validateBagAllocations(items, drafts, { requireFull });
    if (!validation.ok) throw new Error(validation.error);

    const prepared = drafts.map((draft, index) => {
      const id = randomUUID();
      const rawToken = createLaundryToken();
      return {
        id,
        bagSeq: index + 1,
        publicCode: makeLaundryBagPublicCode(orderId, index + 1),
        rawToken,
        tokenHash: hashLaundryToken(rawToken),
        notes: draft.notes,
        items: draft.items,
      };
    });

    const { data: result, error } = await admin.rpc("laundry_prepare_bags", {
      p_order_id: orderId,
      p_staff_id: session.staffId,
      p_bags: prepared.map((bag) => ({
        id: bag.id,
        token_hash: bag.tokenHash,
        public_code: bag.publicCode,
        notes: bag.notes ?? null,
        items: bag.items.map((item) => ({
          order_item_id: item.orderItemId,
          qty: item.qty,
        })),
      })),
      p_actor_kind: "staff",
    });
    if (error) throw new Error(error.message);

    const { sealPreparedBagTokens } = await import(
      "@/lib/laundry-issue-labels"
    );
    await sealPreparedBagTokens(
      admin,
      session.propertyId,
      prepared.map((bag) => ({ id: bag.id, rawToken: bag.rawToken })),
    );

    refreshBags(orderId);
    return {
      ok: true,
      orderId,
      message: `Prepared ${Number((result as { bag_count?: number } | null)?.bag_count ?? prepared.length)} bag label(s).`,
      bags: prepared.map((bag) => ({
        id: bag.id,
        bagSeq: bag.bagSeq,
        publicCode: bag.publicCode,
        rawToken: bag.rawToken,
        scanPath: laundryBagScanPath(bag.id, bag.rawToken),
      })),
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not prepare bags.",
    };
  }
}

export async function issueLaundryBagLabelTokens(
  orderId: string,
  options?: { rotate?: boolean },
): Promise<LaundryBagState> {
  try {
    const session = await requireLaundryStaff();
    const admin = createSupabaseAdminClient();
    const { issueOrderBagLabelTokens } = await import(
      "@/lib/laundry-issue-labels"
    );
    const issued = await issueOrderBagLabelTokens(admin, {
      propertyId: session.propertyId,
      orderId,
      staffId: session.staffId,
      actorKind: "staff",
      rotate: options?.rotate === true,
    });
    refreshBags(orderId);
    return {
      ok: true,
      orderId,
      message: issued.message,
      bags: issued.bags,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not issue label codes.",
    };
  }
}

export async function recordLaundryBagScan(
  bagId: string,
  rawToken: string,
  clientEventId?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await requireLaundryStaff();
    const admin = createSupabaseAdminClient();
    const tokenHash = hashLaundryToken(rawToken);
    const { data: bag } = await admin
      .from("laundry_order_bags")
      .select("id, order_id, status, scan_token_hash, property_id")
      .eq("id", bagId)
      .eq("property_id", session.propertyId)
      .maybeSingle();
    if (!bag || bag.status === "voided") {
      throw new Error("Bag label is voided or not found.");
    }
    if (bag.scan_token_hash !== tokenHash) {
      throw new Error("Scan code does not match this bag label.");
    }
    const now = new Date().toISOString();
    await admin
      .from("laundry_order_bags")
      .update({
        last_scanned_at: now,
        last_scanned_by: session.staffId,
        updated_at: now,
      })
      .eq("id", bagId);
    const { error } = await admin.from("laundry_bag_events").insert({
      property_id: session.propertyId,
      bag_id: bagId,
      order_id: bag.order_id,
      event_type: "scanned",
      notes: "Staff scanned bag QR",
      actor_kind: "staff",
      actor_staff_id: session.staffId,
      client_event_id: clientEventId ?? null,
    });
    if (error && !error.message.includes("duplicate")) {
      throw new Error("Could not record scan.");
    }
    refreshBags(bag.order_id as string);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Scan failed.",
    };
  }
}

export async function advanceLaundryBagStatus(
  _prev: LaundryBagState,
  formData: FormData,
): Promise<LaundryBagState> {
  try {
    const session = await requireLaundryStaff();
    const bagId = trimRequired(formData.get("bag_id"), "Bag");
    const next = trimRequired(
      formData.get("next_status"),
      "Next status",
    ) as LaundryBagStatus;
    const notes = optionalTrim(formData.get("notes"));
    const admin = createSupabaseAdminClient();
    const { data: bag } = await admin
      .from("laundry_order_bags")
      .select("id, order_id, status")
      .eq("id", bagId)
      .eq("property_id", session.propertyId)
      .maybeSingle();
    if (!bag || bag.status === "voided") throw new Error("Bag not found.");
    const current = bag.status as LaundryBagStatus;
    if (!canAdvanceBagStatus(current, next)) {
      throw new Error(`Cannot move bag from ${current} to ${next}.`);
    }
    const { error } = await admin
      .from("laundry_order_bags")
      .update({
        status: next,
        updated_at: new Date().toISOString(),
        last_scanned_at: new Date().toISOString(),
        last_scanned_by: session.staffId,
      })
      .eq("id", bagId)
      .eq("status", current);
    if (error) throw new Error("Could not update bag status.");
    await admin.from("laundry_bag_events").insert({
      property_id: session.propertyId,
      bag_id: bagId,
      order_id: bag.order_id,
      event_type: "status_changed",
      from_status: current,
      to_status: next,
      notes,
      actor_kind: "staff",
      actor_staff_id: session.staffId,
      client_event_id: optionalTrim(formData.get("client_event_id")),
    });
    refreshBags(bag.order_id as string);
    return { ok: true, message: `Bag marked ${next.replace("_", " ")}.` };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not update bag.",
    };
  }
}

export async function voidLaundryBag(
  _prev: LaundryBagState,
  formData: FormData,
): Promise<LaundryBagState> {
  try {
    const session = await requireLaundryStaff();
    const bagId = trimRequired(formData.get("bag_id"), "Bag");
    const reason = trimRequired(formData.get("reason"), "Void reason");
    const admin = createSupabaseAdminClient();
    const { data: bag } = await admin
      .from("laundry_order_bags")
      .select("id, order_id, status")
      .eq("id", bagId)
      .eq("property_id", session.propertyId)
      .maybeSingle();
    if (!bag || bag.status === "voided") throw new Error("Bag not found.");
    if (bag.status === "delivered") {
      throw new Error("Delivered bags cannot be voided.");
    }
    const { error } = await admin
      .from("laundry_order_bags")
      .update({
        status: "voided",
        voided_at: new Date().toISOString(),
        voided_by: session.staffId,
        void_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bagId);
    if (error) throw new Error("Could not void bag label.");
    await admin.from("laundry_bag_events").insert({
      property_id: session.propertyId,
      bag_id: bagId,
      order_id: bag.order_id,
      event_type: "voided",
      from_status: bag.status,
      to_status: "voided",
      notes: reason,
      actor_kind: "staff",
      actor_staff_id: session.staffId,
    });
    refreshBags(bag.order_id as string);
    return { ok: true, message: "Bag label voided." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not void bag.",
    };
  }
}

const BAG_SELECT = `
  id, order_id, bag_seq, public_code, status, notes, garment_count,
  label_printed_at, last_scanned_at, created_at,
  laundry_bag_items(
    id, order_item_id, qty,
    laundry_order_items(name_snapshot, unit_label_snapshot)
  )
`;

function mapBag(row: Record<string, unknown>): LaundryBag {
  const items = (row.laundry_bag_items as
    | {
        id: string;
        order_item_id: string;
        qty: number;
        laundry_order_items:
          | { name_snapshot: string; unit_label_snapshot: string }
          | { name_snapshot: string; unit_label_snapshot: string }[]
          | null;
      }[]
    | null) ?? [];
  return {
    id: row.id as string,
    order_id: row.order_id as string,
    bag_seq: Number(row.bag_seq),
    public_code: row.public_code as string,
    status: row.status as LaundryBagStatus,
    notes: (row.notes as string | null) ?? null,
    garment_count: Number(row.garment_count ?? 0),
    label_printed_at: (row.label_printed_at as string | null) ?? null,
    last_scanned_at: (row.last_scanned_at as string | null) ?? null,
    created_at: row.created_at as string,
    laundry_bag_items: items.map((item) => {
      const snap = Array.isArray(item.laundry_order_items)
        ? item.laundry_order_items[0]
        : item.laundry_order_items;
      return {
        id: item.id,
        order_item_id: item.order_item_id,
        qty: Number(item.qty),
        name_snapshot: snap?.name_snapshot,
        unit_label_snapshot: snap?.unit_label_snapshot,
      };
    }),
  };
}

export async function loadLaundryBagsForOrder(
  propertyId: string,
  orderId: string,
): Promise<LaundryBag[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("laundry_order_bags")
    .select(BAG_SELECT)
    .eq("property_id", propertyId)
    .eq("order_id", orderId)
    .neq("status", "voided")
    .order("bag_seq");
  return (data ?? []).map((row) => mapBag(row as Record<string, unknown>));
}

export async function loadLaundryBagsByOrders(
  propertyId: string,
  orderIds: string[],
): Promise<Record<string, LaundryBag[]>> {
  if (!orderIds.length) return {};
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("laundry_order_bags")
    .select(BAG_SELECT)
    .eq("property_id", propertyId)
    .in("order_id", orderIds)
    .neq("status", "voided")
    .order("bag_seq");
  const result: Record<string, LaundryBag[]> = {};
  for (const row of data ?? []) {
    const bag = mapBag(row as Record<string, unknown>);
    (result[bag.order_id] ??= []).push(bag);
  }
  return result;
}

export type LaundryBagDetail = {
  bag: LaundryBag;
  siblings: LaundryBag[];
  order: LaundryOrder & {
    folio_id: string | null;
    subtotal_btn: number | null;
    service_charge_btn: number | null;
    gst_btn: number | null;
  };
  events: {
    id: string;
    event_type: string;
    notes: string | null;
    created_at: string;
    actor_staff_id: string | null;
  }[];
};

export async function loadLaundryBagDetail(
  session: StaffSession,
  bagId: string,
  rawToken: string,
): Promise<LaundryBagDetail | { error: string }> {
  if (!canWorkLaundry(session)) {
    return { error: "Your staff account is not assigned to laundry." };
  }
  const admin = createSupabaseAdminClient();
  const tokenHash = hashLaundryToken(rawToken);
  const { data: bagRow } = await admin
    .from("laundry_order_bags")
    .select(BAG_SELECT)
    .eq("id", bagId)
    .eq("property_id", session.propertyId)
    .maybeSingle();
  if (!bagRow) return { error: "Bag not found for this property." };
  const { data: authBag } = await admin
    .from("laundry_order_bags")
    .select("scan_token_hash, status")
    .eq("id", bagId)
    .eq("property_id", session.propertyId)
    .maybeSingle();
  if (!authBag || authBag.status === "voided") {
    return { error: "This bag label has been voided." };
  }
  if (authBag.scan_token_hash !== tokenHash) {
    return { error: "Scan code does not match. Reprint a fresh label." };
  }
  const bag = mapBag(bagRow as Record<string, unknown>);
  const siblings = await loadLaundryBagsForOrder(session.propertyId, bag.order_id);
  const { data: order } = await admin
    .from("laundry_orders")
    .select(
      "id, booking_id, room_unit_id, guest_name, room_label_snapshot, source, status, assigned_staff_id, requested_notes, condition_notes, exception_notes, intake_photo_public_ids, completion_photo_public_ids, total_btn, subtotal_btn, service_charge_btn, gst_btn, folio_id, requested_at, received_at, ready_at, delivered_at, billed_at, laundry_order_items(id, catalog_item_id, name_snapshot, unit_label_snapshot, requested_qty, confirmed_qty, unit_price_btn, line_total_btn)",
    )
    .eq("id", bag.order_id)
    .eq("property_id", session.propertyId)
    .maybeSingle();
  if (!order) return { error: "Parent laundry order not found." };
  const { data: events } = await admin
    .from("laundry_bag_events")
    .select("id, event_type, notes, created_at, actor_staff_id")
    .eq("bag_id", bagId)
    .order("created_at", { ascending: false })
    .limit(20);

  return {
    bag,
    siblings,
    order: {
      ...order,
      total_btn: order.total_btn == null ? null : Number(order.total_btn),
      subtotal_btn:
        order.subtotal_btn == null ? null : Number(order.subtotal_btn),
      service_charge_btn:
        order.service_charge_btn == null
          ? null
          : Number(order.service_charge_btn),
      gst_btn: order.gst_btn == null ? null : Number(order.gst_btn),
      folio_id: (order.folio_id as string | null) ?? null,
      intake_photo_public_ids:
        (order.intake_photo_public_ids as string[] | null) ?? [],
      completion_photo_public_ids:
        (order.completion_photo_public_ids as string[] | null) ?? [],
      laundry_order_items: (
        (order.laundry_order_items as LaundryOrder["laundry_order_items"]) ?? []
      ).map((item) => ({
        ...item,
        unit_price_btn:
          item.unit_price_btn == null ? null : Number(item.unit_price_btn),
        line_total_btn:
          item.line_total_btn == null ? null : Number(item.line_total_btn),
      })),
    },
    events: (events ?? []).map((event) => ({
      id: event.id as string,
      event_type: event.event_type as string,
      notes: (event.notes as string | null) ?? null,
      created_at: event.created_at as string,
      actor_staff_id: (event.actor_staff_id as string | null) ?? null,
    })),
  };
}
