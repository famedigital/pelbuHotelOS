export const LAUNDRY_STATUSES = [
  "requested",
  "received",
  "washing",
  "drying",
  "ironing",
  "quality_check",
  "ready",
  "delivered",
  "exception",
  "cancelled",
] as const;

export type LaundryStatus = (typeof LAUNDRY_STATUSES)[number];

export const LAUNDRY_STATUS_LABEL: Record<LaundryStatus, string> = {
  requested: "To collect",
  received: "Received",
  washing: "Washing",
  drying: "Drying",
  ironing: "Ironing",
  quality_check: "Quality check",
  ready: "Ready",
  delivered: "Delivered",
  exception: "Needs attention",
  cancelled: "Cancelled",
};

/** Linear processing chain — no stage skips; cancel only via dedicated desk action. */
export const LAUNDRY_TRANSITIONS: Record<LaundryStatus, LaundryStatus[]> = {
  requested: ["received", "exception"],
  received: ["washing", "exception"],
  washing: ["drying", "exception"],
  drying: ["ironing", "exception"],
  ironing: ["quality_check", "exception"],
  quality_check: ["ready", "exception"],
  ready: ["delivered", "exception"],
  delivered: [],
  exception: ["received", "washing", "quality_check", "ready"],
  cancelled: [],
};

export type LaundryCatalogItem = {
  id: string;
  name: string;
  category: string;
  unit_label: string;
  price_btn: number;
  gst_applicable: boolean;
  turnaround_hours: number;
  is_active: boolean;
  sort_order: number;
};

export type LaundryOrderItem = {
  id: string;
  catalog_item_id: string;
  name_snapshot: string;
  unit_label_snapshot: string;
  requested_qty: number;
  confirmed_qty: number | null;
  unit_price_btn: number | null;
  line_total_btn: number | null;
};

export type LaundryOrder = {
  id: string;
  booking_id: string;
  room_unit_id: string;
  guest_name: string;
  room_label_snapshot: string;
  source: "guest" | "front_desk" | "staff" | "walk_in";
  guest_phone?: string | null;
  status: LaundryStatus;
  assigned_staff_id: string | null;
  requested_notes: string | null;
  condition_notes: string | null;
  exception_notes: string | null;
  intake_photo_public_ids: string[];
  completion_photo_public_ids: string[];
  total_btn: number | null;
  requested_at: string;
  received_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  billed_at: string | null;
  laundry_order_items: LaundryOrderItem[];
};

export function normalizeGuestName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function isLaundryPhotoId(value: string, propertyId: string): boolean {
  return (
    value.startsWith(`pelbu/laundry/${propertyId}/`) &&
    /^[a-zA-Z0-9/_-]+$/.test(value)
  );
}

/** Who may operate the laundry maid board (kept out of "use server" files). */
export function canWorkLaundry(session: {
  department: string | null;
  roleLabel: string;
  accessLevel: string;
}): boolean {
  const dept = (session.department ?? "").toLowerCase();
  const role = session.roleLabel.toLowerCase();
  return (
    ["laundry", "housekeeping", "front_desk", "reception", "front office"].includes(
      dept,
    ) ||
    [
      "laundry",
      "housekeeping",
      "laundry maid",
      "reception",
      "front desk",
      "front office",
    ].includes(role) ||
    ["supervisor", "hr_admin", "owner"].includes(session.accessLevel)
  );
}

export const LAUNDRY_BAG_STATUSES = [
  "open",
  "in_process",
  "ready",
  "delivered",
  "voided",
] as const;

export type LaundryBagStatus = (typeof LAUNDRY_BAG_STATUSES)[number];

export const LAUNDRY_BAG_STATUS_LABEL: Record<LaundryBagStatus, string> = {
  open: "Open",
  in_process: "In process",
  ready: "Ready",
  delivered: "Delivered",
  voided: "Voided",
};

export const LAUNDRY_BAG_TRANSITIONS: Record<
  LaundryBagStatus,
  LaundryBagStatus[]
> = {
  open: ["in_process", "voided"],
  in_process: ["ready", "voided"],
  ready: ["delivered", "voided"],
  delivered: [],
  voided: [],
};

export function canAdvanceBagStatus(
  from: LaundryBagStatus,
  to: LaundryBagStatus,
): boolean {
  return LAUNDRY_BAG_TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextBagStatuses(
  current: LaundryBagStatus,
): LaundryBagStatus[] {
  return (LAUNDRY_BAG_TRANSITIONS[current] ?? []).filter(
    (status) => status !== "voided",
  );
}

export type LaundryBagItem = {
  id: string;
  order_item_id: string;
  qty: number;
  name_snapshot?: string;
  unit_label_snapshot?: string;
};

export type LaundryBag = {
  id: string;
  order_id: string;
  bag_seq: number;
  public_code: string;
  status: LaundryBagStatus;
  notes: string | null;
  garment_count: number;
  label_printed_at: string | null;
  last_scanned_at: string | null;
  created_at: string;
  laundry_bag_items: LaundryBagItem[];
};

export type LaundryBagDraftItem = {
  orderItemId: string;
  qty: number;
};

export type LaundryBagDraft = {
  items: LaundryBagDraftItem[];
  notes?: string;
};

/** Cap for allocation: confirmed count after receipt, else guest/desk request. */
export function laundryItemCap(item: {
  confirmed_qty: number | null;
  requested_qty: number;
}): number {
  return item.confirmed_qty ?? item.requested_qty;
}

/**
 * Validate draft bags: every bag has items, no over-allocation vs caps,
 * and optionally require full allocation of all positive caps.
 */
export function validateBagAllocations(
  items: { id: string; confirmed_qty: number | null; requested_qty: number }[],
  bags: LaundryBagDraft[],
  options?: { requireFull?: boolean },
): { ok: true } | { ok: false; error: string } {
  if (!bags.length) return { ok: false, error: "Add at least one bag." };
  if (bags.length > 50) return { ok: false, error: "Maximum 50 bags per order." };

  const caps = new Map(
    items.map((item) => [item.id, laundryItemCap(item)] as const),
  );
  const allocated = new Map<string, number>();

  for (let i = 0; i < bags.length; i += 1) {
    const bag = bags[i];
    if (!bag.items.length) {
      return { ok: false, error: `Bag ${i + 1} needs at least one garment.` };
    }
    const seen = new Set<string>();
    for (const line of bag.items) {
      if (!caps.has(line.orderItemId)) {
        return {
          ok: false,
          error: `Bag ${i + 1} references an unknown garment line.`,
        };
      }
      if (seen.has(line.orderItemId)) {
        return {
          ok: false,
          error: `Bag ${i + 1} lists the same garment twice.`,
        };
      }
      seen.add(line.orderItemId);
      if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > 200) {
        return {
          ok: false,
          error: `Bag ${i + 1} has an invalid quantity.`,
        };
      }
      allocated.set(
        line.orderItemId,
        (allocated.get(line.orderItemId) ?? 0) + line.qty,
      );
    }
  }

  for (const [itemId, qty] of allocated) {
    const cap = caps.get(itemId) ?? 0;
    if (qty > cap) {
      return {
        ok: false,
        error: `Allocated ${qty} exceeds available ${cap} for a garment.`,
      };
    }
  }

  if (options?.requireFull) {
    for (const [itemId, cap] of caps) {
      if (cap <= 0) continue;
      if ((allocated.get(itemId) ?? 0) !== cap) {
        return {
          ok: false,
          error: "Every confirmed garment must be assigned to a bag.",
        };
      }
    }
  }

  return { ok: true };
}

/** Short human code for stickers, e.g. PLB-A7K2. */
export function makeLaundryBagPublicCode(orderId: string, bagSeq: number): string {
  const seed = orderId.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `PLB-${seed}${bagSeq}`;
}

export function laundryBagScanPath(bagId: string, rawToken: string): string {
  return `/staff/laundry/bags/${bagId}?t=${encodeURIComponent(rawToken)}`;
}
