import { thimphuToday } from "@/lib/erp-lists";
import type { MenuItem } from "@/lib/menu";
import type { TableStatus } from "@/lib/pos-tables";
import { roundBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type { TableStatus };

export type PrepStation = "kitchen" | "bar" | "pastry" | "grill" | "cold";

export type DiningTable = {
  id: string;
  name: string;
  area: string;
  /** Outlet this table belongs to. Null = shared across every outlet. */
  outlet: string | null;
  seats: number;
  status: TableStatus;
  pos_x: number | null;
  pos_y: number | null;
  sort_order: number;
};

export type PosStaffOption = {
  id: string;
  full_name: string;
  role_label: string;
};

export type PosShift = {
  id: string;
  business_date: string;
  status: "open" | "closed";
  opening_float_btn: number;
  opened_by_name: string;
  opened_at: string;
};

/** Live Z-preview for an open shift — tenders, voids, and tickets that block close. */
export type PosShiftCloseSummary = {
  shiftId: string;
  openingFloatBtn: number;
  settledCount: number;
  voidedCount: number;
  openCount: number;
  voidTotalBtn: number;
  /** Ordered for display (cash first when present). */
  tenderLines: { method: string; amountBtn: number }[];
  cashTendersBtn: number;
  /** opening float + cash tenders only. */
  expectedCashBtn: number;
  /** Sum of all settlement tenders this shift. */
  salesTotalBtn: number;
  openTickets: OpenPosTicket[];
};

/** Kot statuses still on the payment path (matches open board + close blockers). */
export const POS_OPEN_KOT_STATUSES = [
  "new",
  "preparing",
  "ready",
  "served",
  "cancelled",
] as const;

export type ModifierOption = {
  id: string;
  name: string;
  price_btn: number;
  gst_applicable: boolean;
  prep_station: PrepStation | null;
  is_default: boolean;
  sort_order: number;
};

export type ModifierGroup = {
  id: string;
  menu_item_id: string;
  label: string;
  min_sel: number;
  max_sel: number;
  is_required: boolean;
  sort_order: number;
  options: ModifierOption[];
};

export type PosMenuItem = MenuItem & {
  is_popular: boolean;
  prep_station: PrepStation;
};

export type PosTenderLine = {
  method: string;
  amount_btn: number;
};

export type OpenPosTicket = {
  id: string;
  customer_name: string;
  phone: string;
  outlet: string;
  total_btn: number;
  kot_status: string;
  is_parked: boolean;
  table_id: string | null;
  covers: number | null;
  created_at: string;
  /** "public" = guest online order; "desk" / "room_charge" = entered at POS. */
  order_source: string;
  delivery_type: string;
  delivery_area: string | null;
  /** Null when a public order is still pending desk confirmation. */
  confirmed_at: string | null;
  confirmed_by_staff: string | null;
  /** Null until the desk records the guest's transfer — KOT fires from this. */
  payment_recorded_at: string | null;
  payment_journal_no: string | null;
  settled_at: string | null;
  posted_to_folio_at: string | null;
  folio_id: string | null;
  booking_id: string | null;
  /** Sum of order_tenders.amount_btn (desk settle / room charge). */
  amount_tendered_btn: number;
  tenders: PosTenderLine[];
  order_items: {
    name_snapshot: string;
    qty: number;
    course_no: number;
    prep_station: string;
  }[];
};

/** Settled / closed tickets for the business-day history lane. */
export type SettledPosTicket = OpenPosTicket;

export {
  POS_VOID_REASON_CODES,
  type PosVoidReasonCode,
} from "@/lib/pos-void-reasons";

export const POS_TENDER_METHODS = [
  "cash",
  "bank",
  "card",
  "agent_credit",
  "bank_qr",
  "pay_bt",
  "deposit",
  "room_charge",
  "nc",
] as const;

export type PosTenderMethod = (typeof POS_TENDER_METHODS)[number];

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export async function loadOpenPosShift(admin?: Admin): Promise<PosShift | null> {
  const client = admin ?? createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(client);
  const { data } = await client
    .from("pos_shifts")
    .select(
      "id, business_date, status, opening_float_btn, opened_by_name, opened_at",
    )
    .eq("property_id", propertyId)
    .eq("status", "open")
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    business_date: data.business_date as string,
    status: data.status as "open",
    opening_float_btn: Number(data.opening_float_btn),
    opened_by_name: data.opened_by_name as string,
    opened_at: data.opened_at as string,
  };
}

export async function loadDiningTables(
  admin?: Admin,
): Promise<DiningTable[]> {
  const client = admin ?? createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(client);
  const { data } = await client
    .from("dining_tables")
    .select("id, name, area, outlet, seats, status, pos_x, pos_y, sort_order")
    .eq("property_id", propertyId)
    .order("sort_order")
    .order("name");

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    area: (row.area as string) ?? "main",
    outlet: (row.outlet as string | null) ?? null,
    seats: Number(row.seats),
    status: row.status as TableStatus,
    pos_x: row.pos_x == null ? null : Number(row.pos_x),
    pos_y: row.pos_y == null ? null : Number(row.pos_y),
    sort_order: Number(row.sort_order ?? 0),
  }));
}

/** Active staff who can be assigned as the POS server on a ticket. */
export async function loadPosStaff(admin?: Admin): Promise<PosStaffOption[]> {
  const client = admin ?? createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(client);
  const { data } = await client
    .from("staff_members")
    .select("id, full_name, role_label")
    .eq("property_id", propertyId)
    .eq("status", "active")
    .order("full_name");

  return (data ?? []).map((row) => ({
    id: row.id as string,
    full_name: row.full_name as string,
    role_label: (row.role_label as string) ?? "other",
  }));
}

export async function loadModifierGroupsForItems(
  menuItemIds: string[],
  admin?: Admin,
): Promise<ModifierGroup[]> {
  if (menuItemIds.length === 0) return [];
  const client = admin ?? createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(client);

  const { data: groups } = await client
    .from("menu_modifier_groups")
    .select("id, menu_item_id, label, min_sel, max_sel, is_required, sort_order")
    .eq("property_id", propertyId)
    .in("menu_item_id", menuItemIds)
    .order("sort_order");

  if (!groups?.length) return [];

  const groupIds = groups.map((g) => g.id as string);
  const { data: options } = await client
    .from("menu_modifier_options")
    .select(
      "id, group_id, name, price_btn, gst_applicable, prep_station, is_default, sort_order",
    )
    .in("group_id", groupIds)
    .order("sort_order");

  const byGroup = new Map<string, ModifierOption[]>();
  for (const opt of options ?? []) {
    const list = byGroup.get(opt.group_id as string) ?? [];
    list.push({
      id: opt.id as string,
      name: opt.name as string,
      price_btn: Number(opt.price_btn),
      gst_applicable: Boolean(opt.gst_applicable),
      prep_station: (opt.prep_station as PrepStation | null) ?? null,
      is_default: Boolean(opt.is_default),
      sort_order: Number(opt.sort_order ?? 0),
    });
    byGroup.set(opt.group_id as string, list);
  }

  return groups.map((g) => ({
    id: g.id as string,
    menu_item_id: g.menu_item_id as string,
    label: g.label as string,
    min_sel: Number(g.min_sel),
    max_sel: Number(g.max_sel),
    is_required: Boolean(g.is_required),
    sort_order: Number(g.sort_order ?? 0),
    options: byGroup.get(g.id as string) ?? [],
  }));
}

const POS_TICKET_SELECT =
  "id, customer_name, phone, outlet, total_btn, kot_status, is_parked, table_id, covers, created_at, order_source, delivery_type, delivery_area, confirmed_at, confirmed_by, payment_recorded_at, payment_journal_no, settled_at, posted_to_folio_at, folio_id, booking_id, order_tenders(method, amount_btn), order_items(name_snapshot, qty, course_no, menu_items(prep_station))";

type RawOrderTicketRow = {
  id: string;
  customer_name: string;
  phone: string;
  outlet: string;
  total_btn: number;
  kot_status: string;
  is_parked: boolean;
  table_id: string | null;
  covers: number | null;
  created_at: string;
  order_source: string | null;
  delivery_type: string | null;
  delivery_area: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  payment_recorded_at: string | null;
  payment_journal_no: string | null;
  settled_at: string | null;
  posted_to_folio_at: string | null;
  folio_id: string | null;
  booking_id: string | null;
  order_tenders:
    | { method: string; amount_btn: number }[]
    | null;
  order_items:
    | {
        name_snapshot: string;
        qty: number;
        course_no: number;
        menu_items:
          | { prep_station: string | null }
          | { prep_station: string | null }[]
          | null;
      }[]
    | null;
};

function mapPosTicketRow(row: RawOrderTicketRow): OpenPosTicket {
  const tenders = (row.order_tenders ?? []).map((t) => ({
    method: t.method,
    amount_btn: Number(t.amount_btn),
  }));
  const amountTendered = tenders.reduce((s, t) => s + t.amount_btn, 0);

  return {
    id: row.id,
    customer_name: row.customer_name,
    phone: row.phone,
    outlet: row.outlet,
    total_btn: Number(row.total_btn),
    kot_status: row.kot_status,
    is_parked: Boolean(row.is_parked),
    table_id: row.table_id ?? null,
    covers: row.covers == null ? null : Number(row.covers),
    created_at: row.created_at,
    order_source: row.order_source ?? "desk",
    delivery_type: row.delivery_type ?? "pickup",
    delivery_area: row.delivery_area ?? null,
    confirmed_at: row.confirmed_at ?? null,
    confirmed_by_staff: row.confirmed_by ?? null,
    payment_recorded_at: row.payment_recorded_at ?? null,
    payment_journal_no: row.payment_journal_no ?? null,
    settled_at: row.settled_at ?? null,
    posted_to_folio_at: row.posted_to_folio_at ?? null,
    folio_id: row.folio_id ?? null,
    booking_id: row.booking_id ?? null,
    amount_tendered_btn: amountTendered,
    tenders,
    order_items: (row.order_items ?? []).map((i) => {
      const mi = i.menu_items;
      const prepFromJoin = Array.isArray(mi)
        ? (mi[0]?.prep_station as string | null)
        : (mi?.prep_station as string | null);
      return {
        name_snapshot: i.name_snapshot,
        qty: Number(i.qty),
        course_no: Number(i.course_no ?? 1),
        prep_station: prepFromJoin ?? "kitchen",
      };
    }),
  };
}

/** Desk payment badge for list/detail UIs. */
export function posTicketPayLabel(ticket: OpenPosTicket): {
  label: string;
  tone: "unpaid" | "cash" | "room" | "online" | "settled";
} {
  if (ticket.posted_to_folio_at || ticket.tenders.some((t) => t.method === "room_charge")) {
    return { label: "On room", tone: "room" };
  }
  if (ticket.settled_at && ticket.amount_tendered_btn > 0) {
    return { label: "Settled", tone: "cash" };
  }
  if (ticket.settled_at) {
    return { label: "Settled", tone: "settled" };
  }
  if (ticket.order_source === "public") {
    if (ticket.payment_recorded_at) {
      return { label: "Online paid", tone: "online" };
    }
    return { label: "Unpaid", tone: "unpaid" };
  }
  return { label: "Unpaid", tone: "unpaid" };
}

/**
 * Unsettled desk tickets still on the payment path.
 *
 * Includes `served` (kitchen done, guest not paid yet). Previously the board
 * only listed new/preparing/ready — marking served hid the ticket while shift
 * close still required settle/void, which blocked close with no visible tickets.
 * KDS columns still only show new/preparing/ready.
 */
export async function loadOpenPosTickets(
  admin?: Admin,
): Promise<OpenPosTicket[]> {
  const client = admin ?? createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(client);

  const { data } = await client
    .from("orders")
    .select(POS_TICKET_SELECT)
    .eq("property_id", propertyId)
    .is("voided_at", null)
    .is("settled_at", null)
    .in("kot_status", [...POS_OPEN_KOT_STATUSES])
    .order("created_at", { ascending: false })
    .limit(80);

  return ((data ?? []) as RawOrderTicketRow[]).map(mapPosTicketRow);
}

/**
 * Cashier close preview for one open shift: tender mix, expected drawer cash,
 * voids, and open tickets that still block close.
 */
export async function loadPosShiftCloseSummary(
  shift: PosShift,
  admin?: Admin,
): Promise<PosShiftCloseSummary> {
  const client = admin ?? createSupabaseAdminClient();

  const { data: shiftOrders } = await client
    .from("orders")
    .select("id, total_btn, voided_at, settled_at")
    .eq("pos_shift_id", shift.id);

  const rows = shiftOrders ?? [];
  const openIds = rows
    .filter((o) => !o.voided_at && !o.settled_at)
    .map((o) => o.id as string);
  const settledCount = rows.filter(
    (o) => Boolean(o.settled_at) && !o.voided_at,
  ).length;
  const voidedIds = rows
    .filter((o) => Boolean(o.voided_at))
    .map((o) => o.id as string);
  const orderIds = rows.map((o) => o.id as string);

  const [{ data: openRows }, { data: tenders }, { data: voids }] =
    await Promise.all([
      openIds.length > 0
        ? client
            .from("orders")
            .select(POS_TICKET_SELECT)
            .in("id", openIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as RawOrderTicketRow[] }),
      orderIds.length > 0
        ? client
            .from("order_tenders")
            .select("method, amount_btn")
            .in("order_id", orderIds)
        : Promise.resolve({ data: [] as { method: string; amount_btn: number }[] }),
      voidedIds.length > 0
        ? client
            .from("pos_voids")
            .select("amount_btn")
            .in("order_id", voidedIds)
        : Promise.resolve({ data: [] as { amount_btn: number }[] }),
    ]);

  const totals: Record<string, number> = {};
  for (const tender of tenders ?? []) {
    const method = tender.method as string;
    totals[method] = roundBtn(
      (totals[method] ?? 0) + Number(tender.amount_btn),
    );
  }
  const cashTendersBtn = totals.cash ?? 0;
  const salesTotalBtn = roundBtn(
    Object.values(totals).reduce((sum, n) => sum + n, 0),
  );
  const voidTotalBtn = roundBtn(
    (voids ?? []).reduce((sum, row) => sum + Number(row.amount_btn ?? 0), 0),
  );

  const methodOrder = [
    "cash",
    "card",
    "bank",
    "bank_qr",
    "pay_bt",
    "agent_credit",
    "deposit",
    "room_charge",
  ];
  const tenderLines = Object.entries(totals)
    .map(([method, amountBtn]) => ({ method, amountBtn }))
    .sort((a, b) => {
      const ia = methodOrder.indexOf(a.method);
      const ib = methodOrder.indexOf(b.method);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

  return {
    shiftId: shift.id,
    openingFloatBtn: shift.opening_float_btn,
    settledCount,
    voidedCount: voidedIds.length,
    openCount: openIds.length,
    voidTotalBtn,
    tenderLines,
    cashTendersBtn,
    expectedCashBtn: roundBtn(shift.opening_float_btn + cashTendersBtn),
    salesTotalBtn,
    openTickets: ((openRows ?? []) as RawOrderTicketRow[]).map(mapPosTicketRow),
  };
}

/**
 * Settled orders for Thimphu business date (for Closed today lane).
 * Includes room-charge and cash/card desks that closed today.
 */
export async function loadSettledPosTickets(
  admin?: Admin,
  limit = 40,
): Promise<SettledPosTicket[]> {
  const client = admin ?? createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(client);
  const dayStart = `${thimphuToday()}T00:00:00+06:00`;

  const { data } = await client
    .from("orders")
    .select(POS_TICKET_SELECT)
    .eq("property_id", propertyId)
    .is("voided_at", null)
    .not("settled_at", "is", null)
    .gte("settled_at", dayStart)
    .order("settled_at", { ascending: false })
    .limit(limit);

  return ((data ?? []) as RawOrderTicketRow[]).map(mapPosTicketRow);
}

/** Human label for tender method codes. */
export function tenderMethodLabel(method: string): string {
  const map: Record<string, string> = {
    cash: "Cash",
    bank: "Bank",
    card: "Card",
    agent_credit: "Agent credit",
    bank_qr: "Bank QR",
    pay_bt: "Pay.bt",
    deposit: "Deposit",
    room_charge: "Room charge",
  };
  return map[method] ?? method.replace(/_/g, " ");
}

/** Nu threshold above which void requires manager PIN (env override). */
export function voidManagerThresholdBtn(): number {
  const raw = process.env.POS_VOID_MANAGER_THRESHOLD_BTN?.trim();
  const n = raw ? Number(raw) : 500;
  return Number.isFinite(n) && n >= 0 ? n : 500;
}

/** Env-only manager PIN check. Prefer verifyManagerPinForProperty for desk flows. */
export function verifyPosManagerPin(pin: string): boolean {
  const expected =
    process.env.POS_MANAGER_PIN?.trim() || process.env.DESK_PIN?.trim();
  if (!expected) return process.env.NODE_ENV !== "production";
  return pin.trim() === expected;
}
