import type { MenuItem } from "@/lib/menu";
import type { TableStatus } from "@/lib/pos-tables";
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
  order_items: {
    name_snapshot: string;
    qty: number;
    course_no: number;
    prep_station: string;
  }[];
};

export const POS_VOID_REASON_CODES = [
  "guest_change",
  "kitchen_error",
  "wrong_item",
  "comp",
  "manager_comp",
  "duplicate",
  "training",
  "other",
] as const;

export type PosVoidReasonCode = (typeof POS_VOID_REASON_CODES)[number];

export const POS_TENDER_METHODS = [
  "cash",
  "bank",
  "card",
  "agent_credit",
  "bank_qr",
  "pay_bt",
  "deposit",
  "room_charge",
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

export async function loadOpenPosTickets(
  admin?: Admin,
): Promise<OpenPosTicket[]> {
  const client = admin ?? createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(client);

  const { data } = await client
    .from("orders")
    .select(
      "id, customer_name, phone, outlet, total_btn, kot_status, is_parked, table_id, covers, created_at, order_source, delivery_type, delivery_area, confirmed_at, confirmed_by, payment_recorded_at, payment_journal_no, order_items(name_snapshot, qty, course_no, menu_items(prep_station))",
    )
    .eq("property_id", propertyId)
    .is("voided_at", null)
    .in("kot_status", ["new", "preparing", "ready"])
    .order("created_at", { ascending: false })
    .limit(60);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    customer_name: row.customer_name as string,
    phone: row.phone as string,
    outlet: row.outlet as string,
    total_btn: Number(row.total_btn),
    kot_status: row.kot_status as string,
    is_parked: Boolean(row.is_parked),
    table_id: (row.table_id as string | null) ?? null,
    covers: row.covers == null ? null : Number(row.covers),
    created_at: row.created_at as string,
    order_source: (row.order_source as string | null) ?? "desk",
    delivery_type: (row.delivery_type as string | null) ?? "pickup",
    delivery_area: (row.delivery_area as string | null) ?? null,
    confirmed_at: (row.confirmed_at as string | null) ?? null,
    confirmed_by_staff: (row.confirmed_by as string | null) ?? null,
    payment_recorded_at: (row.payment_recorded_at as string | null) ?? null,
    payment_journal_no: (row.payment_journal_no as string | null) ?? null,
    order_items: (
      (row.order_items as
        | {
            name_snapshot: string;
            qty: number;
            course_no: number;
            menu_items:
              | { prep_station: string | null }
              | { prep_station: string | null }[]
              | null;
          }[]
        | null) ?? []
    ).map((i) => {
      const mi = i.menu_items as
        | { prep_station: string | null }
        | { prep_station: string | null }[]
        | null;
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
  }));
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
