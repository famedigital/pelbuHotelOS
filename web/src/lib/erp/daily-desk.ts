/**
 * FO Daily Desk — one business-date snapshot for check-in / check-out /
 * in-house boards, agent pay follow-up, today's rota, and store shortcuts.
 */

import {
  loadDayOpsBoard,
  mapDayOpsRawRow,
  type DayOpsBoard,
  type DayOpsRow,
} from "@/lib/erp/day-ops-board";
import { loadFoTodaySnapshot, type FoTodaySnapshot } from "@/lib/erp/fo-today";
import { loadTomorrowArrivals, type TomorrowArrival } from "@/lib/erp/tomorrow-arrivals";
import {
  loadTomorrowDepartures,
  type TomorrowDeparture,
} from "@/lib/erp/tomorrow-departures";
import {
  loadEmptyRoomBreakdown,
  loadIssuedInvoiceByFolio,
  mealPlanBuckets,
  type EmptyRoomBreakdown,
  type MealPlanBucket,
} from "@/lib/erp/fo-ops-blocks";
import {
  loadMissingGuideScans,
  type MissingGuideScan,
} from "@/lib/erp/missing-guide-scans";
import { thimphuToday } from "@/lib/erp-lists";
import { addDaysIso } from "@/lib/stay-dates";
import { computeMealCovers } from "@/lib/kitchen/covers";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/** Instant FO / kitchen glance — pax, meal covers, HK clean counts. */
export type DayOpsPulse = {
  inHousePax: number;
  breakfast: number;
  lunch: number;
  dinner: number;
  roomsClean: number;
  roomsDirty: number;
  roomsOccupied: number;
  roomsTotal: number;
};

export type AgentPayStatus = "paid" | "unpaid" | "agent_ar_open";

export type AgentPayFollowupRow = {
  bookingId: string;
  confirmationCode: string | null;
  guestName: string;
  agentId: string | null;
  agentName: string | null;
  roomLabels: string | null;
  rooms: number;
  mealPlan: string;
  folioId: string | null;
  balanceBtn: number;
  payStatus: AgentPayStatus;
  bookingStatus: string;
  checkOut: string;
  guideNumber: string | null;
  packSealed: boolean;
  paymentMode: string | null;
};

export type DailyRotaShift = {
  id: string;
  staffName: string;
  outlet: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
};

export type DailyDeskTools = {
  rotaToday: DailyRotaShift[];
  openPurchaseOrders: number;
  issueMovesToday: number;
};

export type DailyDeskSnapshot = FoTodaySnapshot & {
  dayOps: DayOpsBoard;
  agentFollowup: AgentPayFollowupRow[];
  agentUnpaidCount: number;
  agentPaidCount: number;
  tools: DailyDeskTools;
  tomorrowArrivals: TomorrowArrival[];
  tomorrowDepartures: TomorrowDeparture[];
  missingGuideScans: MissingGuideScan[];
  dayOpsPulse: DayOpsPulse;
  arrivalMealBuckets: MealPlanBucket[];
  inHouseMealBuckets: MealPlanBucket[];
  emptyRooms: EmptyRoomBreakdown;
  /** folioId → issued INV for today's departures */
  departureInvoices: Record<string, { id: string; docNo: string }>;
  /** Wall date + 1. Departures that morning, even when the business date is already ahead. */
  tomorrowDepartureDate: string;
  tomorrowDepartureRows: DayOpsRow[];
  tomorrowDepartureInvoices: Record<string, { id: string; docNo: string }>;
  /** Named guests on today's in-house stays, grouped by nationality. */
  nationalityCounts: NationalityCount[];
};

export type NationalityCount = { label: string; guests: number };

function isAgentBillMode(mode: string | null | undefined): boolean {
  const m = (mode ?? "").toLowerCase();
  return (
    m.includes("agent") ||
    m === "credit" ||
    m === "on_account" ||
    m === "bill_to_agent"
  );
}

export function deriveAgentPayStatus(opts: {
  balanceBtn: number;
  paymentMode: string | null;
}): AgentPayStatus {
  if (Math.abs(opts.balanceBtn) < 0.5) return "paid";
  if (isAgentBillMode(opts.paymentMode)) return "agent_ar_open";
  return "unpaid";
}

function followupFromDayOps(
  row: DayOpsRow,
  packSealed: boolean,
): AgentPayFollowupRow {
  const balance = Number(row.folio_balance_btn ?? 0);
  return {
    bookingId: row.id,
    confirmationCode: row.confirmation_code,
    guestName: row.contact_name ?? "Guest",
    agentId: row.agent_id,
    agentName: row.agent_name,
    roomLabels: row.room_labels,
    rooms: row.rooms,
    mealPlan: row.meal_plan_code,
    folioId: row.folio_id,
    balanceBtn: balance,
    payStatus: deriveAgentPayStatus({
      balanceBtn: balance,
      paymentMode: row.payment_mode,
    }),
    bookingStatus: row.status ?? "",
    checkOut: row.check_out ?? "",
    guideNumber: row.guide_number,
    packSealed,
    paymentMode: row.payment_mode,
  };
}

async function loadSealedPackBookingIds(
  admin: Admin,
  propertyId: string,
  bookingIds: string[],
): Promise<Set<string>> {
  const sealed = new Set<string>();
  if (bookingIds.length === 0) return sealed;
  const { data } = await admin
    .from("booking_settlement_packs")
    .select("booking_id")
    .eq("property_id", propertyId)
    .in("booking_id", bookingIds)
    .limit(300);
  for (const row of data ?? []) {
    const id = row.booking_id as string | null;
    if (id) sealed.add(id);
  }
  return sealed;
}

/** Recent agent checkouts (not only due-out today) for pay follow-up. */
async function loadRecentAgentCheckouts(
  admin: Admin,
  propertyId: string,
  wallToday: string,
  already: Set<string>,
): Promise<DayOpsRow[]> {
  const from = new Date(`${wallToday}T12:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 14);
  const fromIso = from.toISOString().slice(0, 10);

  const { data } = await admin
    .from("bookings")
    .select(
      `
  id, confirmation_code, contact_name, contact_phone, check_in, check_out, status,
  adults, children, rooms, meal_plan_code,
  source, guest_origin, guide_number, payment_mode, agent_id,
  token_required_btn, token_received_btn,
  agents(company_name, contact_phone),
  guides(full_name, phone, guide_number),
  drivers(full_name, phone),
  booking_drivers(full_name, phone),
  room_assignments(room_units(label, hk_status, room_types(inventory_kind))),
  folios(id, status, folio_lines(id, total_btn, status, reverses_line_id))
`,
    )
    .eq("property_id", propertyId)
    .eq("status", "checked_out")
    .not("agent_id", "is", null)
    .gte("check_out", fromIso)
    .lte("check_out", wallToday)
    .order("check_out", { ascending: false })
    .limit(80);

  const rows: DayOpsRow[] = [];
  for (const raw of data ?? []) {
    const id = raw.id as string;
    if (!id || already.has(id)) continue;
    rows.push(mapDayOpsRawRow(raw as Record<string, unknown>, new Map()));
  }
  return rows;
}

async function loadDailyTools(
  admin: Admin,
  propertyId: string,
  wallToday: string,
): Promise<DailyDeskTools> {
  const empty: DailyDeskTools = {
    rotaToday: [],
    openPurchaseOrders: 0,
    issueMovesToday: 0,
  };
  try {
    const [{ data: shiftRows }, { count: openPoCount }, { count: issueCount }] =
      await Promise.all([
        admin
          .from("staff_shifts")
          .select(
            "id, starts_at, ends_at, outlet, status, staff_members(full_name)",
          )
          .eq("property_id", propertyId)
          .eq("shift_date", wallToday)
          .order("starts_at")
          .limit(80),
        admin
          .from("inventory_purchase_orders")
          .select("*", { count: "exact", head: true })
          .eq("property_id", propertyId)
          .in("status", ["draft", "ordered", "partial"]),
        admin
          .from("inventory_movements")
          .select("*", { count: "exact", head: true })
          .eq("property_id", propertyId)
          .eq("movement_kind", "issue")
          .gte("created_at", `${wallToday}T00:00:00+06:00`)
          .lt("created_at", `${wallToday}T23:59:59.999+06:00`),
      ]);

    const rotaToday: DailyRotaShift[] = (shiftRows ?? []).map((s) => {
      const staff = s.staff_members as
        | { full_name?: string }
        | { full_name?: string }[]
        | null;
      const name = Array.isArray(staff)
        ? staff[0]?.full_name
        : staff?.full_name;
      return {
        id: s.id as string,
        staffName: name?.trim() || "Staff",
        outlet: (s.outlet as string | null) ?? null,
        startsAt: String(s.starts_at ?? ""),
        endsAt: String(s.ends_at ?? ""),
        status: String(s.status ?? "published"),
      };
    });

    return {
      rotaToday,
      openPurchaseOrders: openPoCount ?? 0,
      issueMovesToday: issueCount ?? 0,
    };
  } catch (e) {
    console.error("loadDailyTools failed", e);
    return empty;
  }
}

export async function loadDailyDeskSnapshot(
  admin: Admin,
  propertyId: string,
): Promise<DailyDeskSnapshot> {
  const wallToday = thimphuToday();
  const tomorrowDepartureDate = addDaysIso(wallToday, 1);
  const [
    fo,
    dayOps,
    tools,
    tomorrowArrivals,
    tomorrowDepartures,
    missingGuideScans,
    mealCovers,
    hkUnits,
    emptyRooms,
    tomorrowBoard,
  ] = await Promise.all([
    loadFoTodaySnapshot(admin, propertyId),
    loadDayOpsBoard(admin, propertyId, wallToday),
    loadDailyTools(admin, propertyId, wallToday),
    loadTomorrowArrivals(admin, propertyId, wallToday),
    loadTomorrowDepartures(admin, propertyId, wallToday),
    loadMissingGuideScans(admin, propertyId),
    computeMealCovers(admin, propertyId, wallToday),
    admin.from("room_units").select("hk_status").eq("property_id", propertyId),
    loadEmptyRoomBreakdown(admin, propertyId, wallToday),
    loadDayOpsBoard(admin, propertyId, tomorrowDepartureDate, {
      slices: ["departures"],
      catchUp: false,
    }),
  ]);

  const departureIds = new Set(dayOps.departures.map((r) => r.id));
  const folioIds = dayOps.departures
    .map((r) => r.folio_id)
    .filter((id): id is string => Boolean(id));
  const tomorrowFolioIds = tomorrowBoard.departures
    .map((r) => r.folio_id)
    .filter((id): id is string => Boolean(id));
  const [recent, nationalityCounts, invMap, tomorrowInvMap] = await Promise.all([
    loadRecentAgentCheckouts(admin, propertyId, wallToday, departureIds),
    loadInHouseNationalities(
      admin,
      dayOps.inHouse.map((row) => row.id),
    ),
    loadIssuedInvoiceByFolio(admin, propertyId, folioIds),
    loadIssuedInvoiceByFolio(admin, propertyId, tomorrowFolioIds),
  ]);

  /** Follow-up pool: today's departures with an agent, plus recent agent COs. */
  const pool: DayOpsRow[] = [
    ...dayOps.departures.filter((r) => r.agent_id),
    ...recent,
  ];

  /** Also surface unpaid walk-in / cash departures today (no agent). */
  for (const r of dayOps.departures) {
    if (r.agent_id) continue;
    const bal = Number(r.folio_balance_btn ?? 0);
    if (Math.abs(bal) >= 0.5) pool.push(r);
  }

  const sealed = await loadSealedPackBookingIds(
    admin,
    propertyId,
    pool.map((r) => r.id),
  );

  const agentFollowup = pool
    .map((r) => followupFromDayOps(r, sealed.has(r.id)))
    .sort((a, b) => {
      const rank = (s: AgentPayStatus) =>
        s === "unpaid" ? 0 : s === "agent_ar_open" ? 1 : 2;
      const d = rank(a.payStatus) - rank(b.payStatus);
      if (d !== 0) return d;
      return b.balanceBtn - a.balanceBtn;
    });

  const agentUnpaidCount = agentFollowup.filter(
    (r) => r.payStatus !== "paid",
  ).length;
  const agentPaidCount = agentFollowup.filter(
    (r) => r.payStatus === "paid",
  ).length;

  const inHousePax = dayOps.inHouse.reduce(
    (sum, row) => sum + Math.max(0, Number(row.pax ?? row.adults ?? 0)),
    0,
  );

  let roomsClean = 0;
  let roomsDirty = 0;
  let roomsOccupied = 0;
  const hkRows = hkUnits.data ?? [];
  for (const u of hkRows) {
    const hk = String(u.hk_status ?? "");
    if (hk === "clean") roomsClean += 1;
    else if (hk === "dirty" || hk === "inspect") roomsDirty += 1;
    else if (hk === "occupied") roomsOccupied += 1;
  }

  const dayOpsPulse: DayOpsPulse = {
    inHousePax,
    breakfast: mealCovers.breakfast,
    lunch: mealCovers.lunch,
    dinner: mealCovers.dinner,
    roomsClean,
    roomsDirty,
    roomsOccupied,
    roomsTotal: hkRows.length,
  };

  const departureInvoices: Record<string, { id: string; docNo: string }> = {};
  for (const [fid, inv] of invMap) {
    departureInvoices[fid] = inv;
  }
  const tomorrowDepartureInvoices: Record<string, { id: string; docNo: string }> =
    {};
  for (const [fid, inv] of tomorrowInvMap) {
    tomorrowDepartureInvoices[fid] = inv;
  }

  return {
    ...fo,
    dayOps,
    agentFollowup,
    agentUnpaidCount,
    agentPaidCount,
    tools,
    tomorrowArrivals,
    tomorrowDepartures,
    missingGuideScans,
    dayOpsPulse,
    arrivalMealBuckets: mealPlanBuckets(dayOps.arrivals),
    inHouseMealBuckets: mealPlanBuckets(dayOps.inHouse),
    emptyRooms,
    departureInvoices,
    tomorrowDepartureDate,
    tomorrowDepartureRows: tomorrowBoard.departures,
    tomorrowDepartureInvoices,
    nationalityCounts,
  };
}

async function loadInHouseNationalities(
  admin: Admin,
  bookingIds: string[],
): Promise<NationalityCount[]> {
  if (bookingIds.length === 0) return [];
  try {
    const { data, error } = await admin
      .from("booking_guests")
      .select("nationality")
      .in("booking_id", bookingIds);
    if (error || !data?.length) return [];
    const map = new Map<string, number>();
    for (const row of data) {
      const raw = String(row.nationality ?? "").trim();
      const label = raw || "Not recorded";
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([label, guests]) => ({ label, guests }))
      .sort(
        (a, b) => b.guests - a.guests || a.label.localeCompare(b.label),
      );
  } catch (e) {
    console.error("loadInHouseNationalities failed", e);
    return [];
  }
}
