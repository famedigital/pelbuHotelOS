/**
 * Shared day-ops payload for FO / F&B / Kitchen / HK / Laundry boards.
 * One business-date snapshot: arrivals, departures, in-house.
 */

import type { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { LAUNDRY_STATUSES, type LaundryStatus } from "@/lib/laundry";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/** Open laundry = not yet delivered / cancelled. */
const OPEN_LAUNDRY = new Set<string>(
  LAUNDRY_STATUSES.filter(
    (s) => s !== "delivered" && s !== "cancelled",
  ) as LaundryStatus[],
);

export const DAY_OPS_BOARD_SELECT = `
  id, confirmation_code, contact_name, contact_phone, check_in, check_out, status,
  adults, children, rooms, meal_plan_code,
  source, guest_origin, guide_number, payment_mode, agent_id,
  token_required_btn, token_received_btn,
  agents(company_name, contact_phone),
  guides(full_name, phone, guide_number),
  drivers(full_name, phone),
  booking_drivers(full_name, phone),
  room_assignments(
    room_units(label, hk_status, room_types(inventory_kind))
  ),
  folios(id, status, folio_lines(total_btn, status))
`;

export type DayOpsSlice = "arrivals" | "departures" | "in_house";

export type DayOpsRow = {
  id: string;
  confirmation_code: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  check_in: string | null;
  check_out: string | null;
  status: string | null;
  adults: number;
  children: number;
  /** adults + children */
  pax: number;
  rooms: number;
  meal_plan_code: string;
  source: string | null;
  guest_origin: string | null;
  guide_number: string | null;
  payment_mode: string | null;
  agent_id: string | null;
  agent_name: string | null;
  agent_phone: string | null;
  guide_name: string | null;
  guide_phone: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  room_labels: string | null;
  assigned_count: number;
  dirty_or_ooo: boolean;
  has_unready_guest_room: boolean;
  folio_id: string | null;
  folio_balance_btn: number | null;
  open_laundry_count: number;
  open_laundry_statuses: string[];
  token_required_btn: number | null;
  token_received_btn: number | null;
  /** Raw nested rows for BookingBoardTable badge computation. */
  raw: Record<string, unknown>;
};

export type DayOpsBoard = {
  businessDate: string;
  arrivals: DayOpsRow[];
  departures: DayOpsRow[];
  inHouse: DayOpsRow[];
  /** Arriving guests on a meal plan (heads). */
  arrivingMealPax: number;
  /** In-house guests on a meal plan (heads). */
  inHouseMealPax: number;
  /** Due-out with open laundry. */
  departuresWithLaundry: number;
};

type MaybeList<T> = T | T[] | null;

function firstOf<T>(value: MaybeList<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function roomMeta(
  assigns:
    | Array<{
        room_units?: MaybeList<{
          label?: string;
          hk_status?: string;
          room_types?: MaybeList<{ inventory_kind?: string }>;
        }>;
      }>
    | null
    | undefined,
): {
  labels: string[];
  dirty_or_ooo: boolean;
  has_unready_guest_room: boolean;
} {
  const labels: string[] = [];
  let dirty_or_ooo = false;
  let has_unready_guest_room = false;
  for (const a of assigns ?? []) {
    const unit = firstOf(a.room_units ?? null);
    if (!unit) continue;
    if (unit.label) labels.push(unit.label);
    const hk = unit.hk_status ?? "";
    if (hk === "dirty" || hk === "ooo" || hk === "inspect") {
      dirty_or_ooo = true;
    }
    const rt = firstOf(unit.room_types ?? null);
    if (
      (rt?.inventory_kind ?? "sellable_guest") === "sellable_guest" &&
      !["clean", "inspect", "occupied"].includes(hk)
    ) {
      has_unready_guest_room = true;
    }
  }
  return { labels, dirty_or_ooo, has_unready_guest_room };
}

function folioMeta(
  folios:
    | Array<{
        id?: string;
        status?: string;
        folio_lines?: Array<{ total_btn?: number; status?: string }> | null;
      }>
    | null
    | undefined,
): { folio_id: string | null; folio_balance_btn: number | null } {
  const open = (folios ?? []).find((f) => f.status === "open") ?? folios?.[0];
  if (!open) return { folio_id: null, folio_balance_btn: null };
  const balance = (open.folio_lines ?? [])
    .filter((l) => l.status === "posted")
    .reduce((sum, l) => sum + Number(l.total_btn ?? 0), 0);
  return {
    folio_id: (open.id as string | undefined) ?? null,
    folio_balance_btn: balance,
  };
}

export function mapDayOpsRawRow(
  r: Record<string, unknown>,
  laundryByBooking: Map<string, { count: number; statuses: string[] }>,
): DayOpsRow {
  const agent = firstOf(
    r.agents as MaybeList<{
      company_name?: string;
      contact_phone?: string | null;
    }>,
  );
  const guide = firstOf(
    r.guides as MaybeList<{
      full_name?: string | null;
      phone?: string | null;
      guide_number?: string | null;
    }>,
  );
  const driverMaster = firstOf(
    r.drivers as MaybeList<{
      full_name?: string | null;
      phone?: string | null;
    }>,
  );
  const bookingDriver = firstOf(
    r.booking_drivers as MaybeList<{
      full_name?: string | null;
      phone?: string | null;
    }>,
  );

  const assigns =
    (r.room_assignments as
      | Array<{
          room_units?: MaybeList<{
            label?: string;
            hk_status?: string;
            room_types?: MaybeList<{ inventory_kind?: string }>;
          }>;
        }>
      | null) ?? [];
  const rooms = roomMeta(assigns);
  const folio = folioMeta(
    r.folios as
      | Array<{
          id?: string;
          status?: string;
          folio_lines?: Array<{ total_btn?: number; status?: string }> | null;
        }>
      | null,
  );

  const adults = Math.max(0, Number(r.adults ?? 0));
  const children = Math.max(0, Number(r.children ?? 0));
  const laundry = laundryByBooking.get(r.id as string) ?? {
    count: 0,
    statuses: [],
  };

  const guideNumber =
    ((r.guide_number as string | null) ?? guide?.guide_number ?? null)?.trim() ||
    null;

  return {
    id: r.id as string,
    confirmation_code: (r.confirmation_code as string | null) ?? null,
    contact_name: (r.contact_name as string | null) ?? null,
    contact_phone: (r.contact_phone as string | null) ?? null,
    check_in: (r.check_in as string | null) ?? null,
    check_out: (r.check_out as string | null) ?? null,
    status: (r.status as string | null) ?? null,
    adults,
    children,
    pax: adults + children,
    rooms: Math.max(0, Number(r.rooms ?? 0)),
    meal_plan_code: (
      ((r.meal_plan_code as string | null) ?? "EP") as string
    ).toUpperCase(),
    source: (r.source as string | null) ?? null,
    guest_origin: (r.guest_origin as string | null) ?? null,
    guide_number: guideNumber,
    payment_mode: (r.payment_mode as string | null) ?? null,
    agent_id: (r.agent_id as string | null) ?? null,
    agent_name: agent?.company_name ?? null,
    agent_phone: agent?.contact_phone?.trim() || null,
    guide_name: guide?.full_name?.trim() || null,
    guide_phone: guide?.phone?.trim() || null,
    driver_name:
      driverMaster?.full_name?.trim() ||
      bookingDriver?.full_name?.trim() ||
      null,
    driver_phone:
      driverMaster?.phone?.trim() || bookingDriver?.phone?.trim() || null,
    room_labels: rooms.labels.length ? rooms.labels.join(", ") : null,
    assigned_count: assigns.length,
    dirty_or_ooo: rooms.dirty_or_ooo,
    has_unready_guest_room: rooms.has_unready_guest_room,
    folio_id: folio.folio_id,
    folio_balance_btn: folio.folio_balance_btn,
    open_laundry_count: laundry.count,
    open_laundry_statuses: laundry.statuses,
    token_required_btn:
      r.token_required_btn != null ? Number(r.token_required_btn) : null,
    token_received_btn:
      r.token_received_btn != null ? Number(r.token_received_btn) : null,
    raw: r,
  };
}

/** Convert DayOpsRow back to the nested shape BookingBoardTable expects. */
export function dayOpsRowToBoardRaw(row: DayOpsRow): Record<string, unknown> {
  return {
    ...row.raw,
    meal_plan_code: row.meal_plan_code,
    children: row.children,
    adults: row.adults,
    agent_id: row.agent_id,
    // Flattened extras consumed by BookingBoardTable mapper
    _day_ops: {
      agent_phone: row.agent_phone,
      guide_name: row.guide_name,
      guide_phone: row.guide_phone,
      driver_name: row.driver_name,
      driver_phone: row.driver_phone,
      open_laundry_count: row.open_laundry_count,
      open_laundry_statuses: row.open_laundry_statuses,
      pax: row.pax,
      folio_id: row.folio_id,
    },
  };
}

async function loadOpenLaundryByBooking(
  admin: Admin,
  propertyId: string,
  bookingIds: string[],
): Promise<Map<string, { count: number; statuses: string[] }>> {
  const map = new Map<string, { count: number; statuses: string[] }>();
  if (bookingIds.length === 0) return map;

  const { data } = await admin
    .from("laundry_orders")
    .select("booking_id, status")
    .eq("property_id", propertyId)
    .in("booking_id", bookingIds)
    .limit(500);

  for (const row of data ?? []) {
    const status = (row.status as string) ?? "";
    if (!OPEN_LAUNDRY.has(status)) continue;
    const bid = row.booking_id as string;
    const cur = map.get(bid) ?? { count: 0, statuses: [] };
    cur.count += 1;
    if (!cur.statuses.includes(status)) cur.statuses.push(status);
    map.set(bid, cur);
  }
  return map;
}

function mealPax(rows: DayOpsRow[]): number {
  return rows.reduce((sum, r) => {
    const plan = r.meal_plan_code;
    if (plan === "EP") return sum;
    return sum + r.pax;
  }, 0);
}

/**
 * Load arrivals / departures / in-house for a business date with meal,
 * agent/guide/driver contacts, folio balance, and open laundry.
 */
export async function loadDayOpsBoard(
  admin: Admin,
  propertyId: string,
  businessDate: string,
): Promise<DayOpsBoard> {
  const [
    { data: arrivalRows },
    { data: departureRows },
    { data: inHouseRows },
  ] = await Promise.all([
    admin
      .from("bookings")
      .select(DAY_OPS_BOARD_SELECT)
      .eq("property_id", propertyId)
      .eq("check_in", businessDate)
      .in("status", ["pending", "confirmed"])
      .order("contact_name")
      .limit(150),
    admin
      .from("bookings")
      .select(DAY_OPS_BOARD_SELECT)
      .eq("property_id", propertyId)
      .eq("check_out", businessDate)
      .not("status", "in", '("cancelled","no_show")')
      .order("contact_name")
      .limit(150),
    admin
      .from("bookings")
      .select(DAY_OPS_BOARD_SELECT)
      .eq("property_id", propertyId)
      .or(
        `status.eq.checked_in,and(status.eq.confirmed,check_in.lte.${businessDate},check_out.gte.${businessDate})`,
      )
      .order("check_out")
      .limit(200),
  ]);

  const allIds = [
    ...new Set(
      [
        ...(arrivalRows ?? []),
        ...(departureRows ?? []),
        ...(inHouseRows ?? []),
      ].map((r) => r.id as string),
    ),
  ];
  const laundryByBooking = await loadOpenLaundryByBooking(
    admin,
    propertyId,
    allIds,
  );

  const arrivals = ((arrivalRows as Record<string, unknown>[]) ?? []).map((r) =>
    mapDayOpsRawRow(r, laundryByBooking),
  );
  const departures = ((departureRows as Record<string, unknown>[]) ?? []).map(
    (r) => mapDayOpsRawRow(r, laundryByBooking),
  );
  const inHouse = ((inHouseRows as Record<string, unknown>[]) ?? []).map((r) =>
    mapDayOpsRawRow(r, laundryByBooking),
  );

  return {
    businessDate,
    arrivals,
    departures,
    inHouse,
    arrivingMealPax: mealPax(arrivals),
    inHouseMealPax: mealPax(inHouse),
    departuresWithLaundry: departures.filter((d) => d.open_laundry_count > 0)
      .length,
  };
}
