import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  laundryBagScanPath,
  laundryItemCap,
  makeLaundryBagPublicCode,
  validateBagAllocations,
} from "@/lib/laundry";
import {
  createLaundryToken,
  hashLaundryToken,
} from "@/lib/laundry-session";

export type PreparedBagLabel = {
  id: string;
  bagSeq: number;
  publicCode: string;
  rawToken: string;
  scanPath: string;
};

/** First active laundry/housekeeping staff for audit when desk/guest auto-prepares. */
export async function resolveDefaultLaundryStaffId(
  admin: SupabaseClient,
  propertyId: string,
): Promise<string | null> {
  const { data: staffRows } = await admin
    .from("staff_members")
    .select("id, department, role_label, access_level")
    .eq("property_id", propertyId)
    .in("status", ["active", "on_leave"])
    .order("full_name");
  const staff = staffRows ?? [];
  type StaffPick = (typeof staff)[number];
  const isLaundryOrHk = (member: StaffPick) => {
    const dept = String(member.department ?? "").toLowerCase();
    const role = String(member.role_label ?? "").toLowerCase();
    return (
      ["laundry", "housekeeping"].includes(dept) ||
      ["laundry", "housekeeping", "laundry maid"].includes(role) ||
      ["supervisor", "hr_admin", "owner"].includes(String(member.access_level))
    );
  };
  const isFrontDesk = (member: StaffPick) => {
    const dept = String(member.department ?? "").toLowerCase();
    const role = String(member.role_label ?? "").toLowerCase();
    return (
      ["front_desk", "reception", "front office"].includes(dept) ||
      ["reception", "front desk", "front office"].includes(role)
    );
  };
  const match =
    staff.find(isLaundryOrHk) ??
    staff.find(isFrontDesk) ??
    staff[0];
  return (match?.id as string | undefined) ?? null;
}

/**
 * Auto-create one bag with full garment allocation (default happy path).
 * Skips if active bags already exist for the order.
 */
export async function autoPrepareDefaultBag(
  admin: SupabaseClient,
  propertyId: string,
  orderId: string,
  actorKind: "front_desk" | "staff",
  staffId?: string | null,
): Promise<{ ok: true; bags: PreparedBagLabel[] } | { ok: false; error: string }> {
  const { count: existingCount } = await admin
    .from("laundry_order_bags")
    .select("id", { count: "exact", head: true })
    .eq("order_id", orderId)
    .eq("property_id", propertyId)
    .neq("status", "voided");
  if ((existingCount ?? 0) > 0) {
    return { ok: true, bags: [] };
  }

  const resolvedStaffId =
    staffId ?? (await resolveDefaultLaundryStaffId(admin, propertyId));
  if (!resolvedStaffId) {
    return {
      ok: false,
      error:
        "No staff on file for bag prep — add a staff member under HR, then print bag labels from the order board.",
    };
  }

  const { data: order } = await admin
    .from("laundry_orders")
    .select(
      "id, status, laundry_order_items(id, confirmed_qty, requested_qty)",
    )
    .eq("id", orderId)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (!order) return { ok: false, error: "Laundry order not found." };
  if (["delivered", "cancelled"].includes(order.status as string)) {
    return { ok: false, error: "Cannot prepare bags for closed laundry." };
  }

  const items = (order.laundry_order_items ?? []) as {
    id: string;
    confirmed_qty: number | null;
    requested_qty: number;
  }[];
  const draft = {
    items: items
      .map((item) => ({
        orderItemId: item.id,
        qty: laundryItemCap(item),
      }))
      .filter((line) => line.qty > 0),
  };
  const validation = validateBagAllocations(items, [draft], {
    requireFull: true,
  });
  if (!validation.ok) return { ok: false, error: validation.error };

  const id = randomUUID();
  const rawToken = createLaundryToken();
  const prepared = {
    id,
    bagSeq: 1,
    publicCode: makeLaundryBagPublicCode(orderId, 1),
    rawToken,
    tokenHash: hashLaundryToken(rawToken),
    items: draft.items,
  };

  const { error } = await admin.rpc("laundry_prepare_bags", {
    p_order_id: orderId,
    p_staff_id: resolvedStaffId,
    p_bags: [
      {
        id: prepared.id,
        token_hash: prepared.tokenHash,
        public_code: prepared.publicCode,
        notes: null,
        items: prepared.items.map((item) => ({
          order_item_id: item.orderItemId,
          qty: item.qty,
        })),
      },
    ],
    p_actor_kind: actorKind,
  });
  if (error) return { ok: false, error: error.message };

  const { sealPreparedBagTokens } = await import("@/lib/laundry-issue-labels");
  await sealPreparedBagTokens(admin, propertyId, [
    { id: prepared.id, rawToken: prepared.rawToken },
  ]);

  return {
    ok: true,
    bags: [
      {
        id: prepared.id,
        bagSeq: prepared.bagSeq,
        publicCode: prepared.publicCode,
        rawToken: prepared.rawToken,
        scanPath: laundryBagScanPath(prepared.id, prepared.rawToken),
      },
    ],
  };
}
