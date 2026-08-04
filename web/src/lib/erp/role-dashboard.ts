import type { DeskRole } from "@/lib/desk-auth";
import {
  loadGuestForecast,
  type GuestForecast,
} from "@/lib/erp/guest-forecast";
import { thimphuToday } from "@/lib/erp-lists";
import { computeMealCovers, type MealCovers } from "@/lib/kitchen/covers";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type DashboardView =
  | "owner"
  | "gm"
  | "front_desk"
  | "fnb"
  | "kitchen"
  | "hk"
  | "laundry"
  | "cashier";

export const DASHBOARD_VIEWS: Array<{
  id: DashboardView;
  label: string;
  blurb: string;
}> = [
  { id: "owner", label: "Owner", blurb: "Compliance, revenue posture, night audit" },
  { id: "gm", label: "Manager", blurb: "Cross-department duty manager board" },
  { id: "front_desk", label: "Front desk", blurb: "Arrivals, holds, in-house, folio" },
  { id: "fnb", label: "F&B", blurb: "POS tickets, service, banquet bills" },
  { id: "kitchen", label: "Kitchen", blurb: "Meal pax, KOT, set menus, events" },
  { id: "hk", label: "Housekeeping", blurb: "Room status board" },
  { id: "laundry", label: "Laundry", blurb: "Bags in pipeline" },
  { id: "cashier", label: "Cashier", blurb: "POS shift path + F&B settle" },
];

export function deskRoleToDashboardView(role: DeskRole): DashboardView {
  if (role === "owner") return "owner";
  if (role === "gm") return "gm";
  if (role === "front_desk") return "front_desk";
  if (role === "fnb") return "fnb";
  if (role === "kitchen") return "kitchen";
  if (role === "hk") return "hk";
  if (role === "laundry") return "laundry";
  if (role === "cashier") return "cashier";
  return "front_desk";
}

export function canPreviewDashboards(role: DeskRole | null): boolean {
  return role === "owner" || role === "gm";
}

export function parseDashboardView(
  raw: string | null | undefined,
): DashboardView | null {
  if (!raw) return null;
  const id = raw.toLowerCase() as DashboardView;
  return DASHBOARD_VIEWS.some((v) => v.id === id) ? id : null;
}

export type DashRoomCounts = {
  dirty: number;
  inspect: number;
  clean: number;
  occupied: number;
  ooo: number;
  total: number;
};

export type DashLaundryCounts = {
  requested: number;
  received: number;
  washing: number;
  ready: number;
  other: number;
  open: number;
};

export type DashEventRow = {
  id: string;
  title: string;
  covers: number;
  serviceTime: string | null;
  menuNote: string | null;
  venue: string | null;
  packageTotalBtn: number | null;
  billingStatus: string;
};

export type DashHoldRow = {
  id: string;
  contactName: string;
  contactPhone: string | null;
  checkIn: string;
  checkOut: string;
  tokenRequiredBtn: number;
};

export type DashTicketRow = {
  id: string;
  customerName: string;
  kotStatus: string;
  totalBtn: number;
  outlet: string | null;
  itemCount: number;
};

export type RoleDashboardSnapshot = {
  businessDate: string;
  propertyName: string | null;
  setupComplete: boolean;
  arrivalsToday: number;
  departuresToday: number;
  inHouse: number;
  holdsCount: number;
  folioBalanceBtn: number;
  pendingBankProofs: number;
  nightAuditCurrent: boolean;
  openKot: number;
  kotByStatus: { new: number; preparing: number; ready: number };
  mealCovers: MealCovers;
  todayEvents: DashEventRow[];
  eventPaxToday: number;
  rooms: DashRoomCounts;
  laundry: DashLaundryCounts;
  holds: DashHoldRow[];
  openTickets: DashTicketRow[];
  lowStockSkus: number;
  gasFull: number;
  tpnOnFile: boolean;
  bankOnFile: boolean;
  gstFiledThisMonth: boolean;
  /** Weekly + calendar-month guest/room forecast for all department boards. */
  guestForecast: GuestForecast;
};

export async function loadRoleDashboardSnapshot(
  admin: Admin,
  propertyId: string,
): Promise<RoleDashboardSnapshot> {
  const today = thimphuToday();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [
    mealCovers,
    guestForecast,
    { data: property },
    { data: bookings },
    { data: orders },
    { data: units },
    { data: laundry },
    { data: events },
    { data: gstPack },
    { data: pendingBank },
    { data: lowStock },
    { data: gasRows },
    { data: nightAudit },
    { data: openFolios },
  ] = await Promise.all([
    computeMealCovers(admin, propertyId, today),
    loadGuestForecast(admin, propertyId),
    admin
      .from("properties")
      .select("name, setup_completed_at, tax_id, bank_accounts")
      .eq("id", propertyId)
      .maybeSingle(),
    admin
      .from("bookings")
      .select(
        "id, contact_name, contact_phone, check_in, check_out, adults, rooms, status, token_required_btn",
      )
      .eq("property_id", propertyId)
      .in("status", ["held", "checked_in", "pending", "confirmed"])
      .order("created_at", { ascending: false })
      .limit(150),
    admin
      .from("orders")
      .select(
        "id, customer_name, outlet, total_btn, kot_status, order_items(qty)",
      )
      .eq("property_id", propertyId)
      .in("kot_status", ["new", "preparing", "ready"])
      .is("voided_at", null)
      .order("created_at", { ascending: false })
      .limit(40),
    admin
      .from("room_units")
      .select("hk_status")
      .eq("property_id", propertyId),
    admin
      .from("laundry_orders")
      .select("id, status")
      .eq("property_id", propertyId)
      .not("status", "in", "(delivered,cancelled,voided,closed)")
      .limit(200),
    admin
      .from("kitchen_events")
      .select(
        "id, title, covers, service_time, menu_note, venue, package_total_btn, rate_per_pax_btn, billing_status, status",
      )
      .eq("property_id", propertyId)
      .eq("event_date", today)
      .neq("status", "cancelled")
      .order("service_time", { ascending: true })
      .limit(20),
    admin
      .from("gst_return_packs")
      .select("id, status")
      .eq("property_id", propertyId)
      .eq("period_month", monthStart)
      .maybeSingle(),
    admin
      .from("payments")
      .select("id")
      .eq("property_id", propertyId)
      .eq("confirmation_status", "pending_bank")
      .limit(20),
    admin
      .from("inventory_items")
      .select("id, qty_on_hand, reorder_level")
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .limit(300),
    admin
      .from("inventory_items")
      .select("sku, qty_on_hand")
      .eq("property_id", propertyId)
      .eq("sku", "LPG-FULL")
      .maybeSingle(),
    admin
      .from("night_audits")
      .select("business_date")
      .eq("property_id", propertyId)
      .order("business_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("folios")
      .select("id, status, folio_lines(total_btn, status)")
      .eq("property_id", propertyId)
      .eq("status", "open")
      .limit(80),
  ]);

  const bookingRows = bookings ?? [];
  const holds = bookingRows.filter((b) => b.status === "held");
  const inHouse = bookingRows.filter((b) => b.status === "checked_in");
  const arrivalsToday = bookingRows.filter(
    (b) =>
      b.check_in === today &&
      ["pending", "confirmed"].includes(b.status as string),
  ).length;
  const departuresToday = bookingRows.filter(
    (b) =>
      b.check_out === today &&
      ["checked_in", "confirmed"].includes(b.status as string),
  ).length;

  const kotByStatus = { new: 0, preparing: 0, ready: 0 };
  const openTickets: DashTicketRow[] = (orders ?? []).map((row) => {
    const st = (row.kot_status as string) ?? "new";
    if (st === "new") kotByStatus.new += 1;
    else if (st === "preparing") kotByStatus.preparing += 1;
    else if (st === "ready") kotByStatus.ready += 1;
    const items =
      (row.order_items as { qty?: number }[] | null) ?? [];
    return {
      id: row.id as string,
      customerName: (row.customer_name as string | null) ?? "Walk-in",
      kotStatus: st,
      totalBtn: Number(row.total_btn ?? 0),
      outlet: (row.outlet as string | null) ?? null,
      itemCount: items.reduce((s, i) => s + Number(i.qty ?? 0), 0),
    };
  });

  const rooms: DashRoomCounts = {
    dirty: 0,
    inspect: 0,
    clean: 0,
    occupied: 0,
    ooo: 0,
    total: (units ?? []).length,
  };
  for (const u of units ?? []) {
    const st = ((u.hk_status as string) ?? "").toLowerCase();
    if (st === "dirty") rooms.dirty += 1;
    else if (st === "inspect") rooms.inspect += 1;
    else if (st === "clean") rooms.clean += 1;
    else if (st === "occupied") rooms.occupied += 1;
    else if (st === "ooo" || st === "out_of_order") rooms.ooo += 1;
  }

  const laundryCounts: DashLaundryCounts = {
    requested: 0,
    received: 0,
    washing: 0,
    ready: 0,
    other: 0,
    open: 0,
  };
  for (const row of laundry ?? []) {
    laundryCounts.open += 1;
    const st = ((row.status as string) ?? "").toLowerCase();
    if (st === "requested" || st === "pending") laundryCounts.requested += 1;
    else if (st === "received" || st === "intake") laundryCounts.received += 1;
    else if (st === "washing" || st === "processing" || st === "in_progress")
      laundryCounts.washing += 1;
    else if (st === "ready") laundryCounts.ready += 1;
    else laundryCounts.other += 1;
  }

  const todayEvents: DashEventRow[] = (events ?? []).map((ev) => {
    const covers = Number(ev.covers ?? 0);
    let packageTotal =
      ev.package_total_btn == null ? null : Number(ev.package_total_btn);
    const rate =
      ev.rate_per_pax_btn == null ? null : Number(ev.rate_per_pax_btn);
    if (
      (packageTotal == null || !(packageTotal > 0)) &&
      rate != null &&
      rate > 0 &&
      covers > 0
    ) {
      packageTotal = rate * covers;
    }
    return {
      id: ev.id as string,
      title: ev.title as string,
      covers,
      serviceTime: (ev.service_time as string | null) ?? null,
      menuNote: (ev.menu_note as string | null) ?? null,
      venue: (ev.venue as string | null) ?? null,
      packageTotalBtn: packageTotal,
      billingStatus: (ev.billing_status as string) ?? "none",
    };
  });
  const eventPaxToday = todayEvents.reduce((s, e) => s + e.covers, 0);

  const folioBalanceBtn = (openFolios ?? []).reduce((sum, f) => {
    const bal = (
      (f.folio_lines as { total_btn: number; status: string }[] | null) ?? []
    )
      .filter((l) => l.status === "posted")
      .reduce((s, l) => s + Number(l.total_btn ?? 0), 0);
    return sum + bal;
  }, 0);

  const lowStockSkus = (lowStock ?? []).filter(
    (i) => Number(i.qty_on_hand) <= Number(i.reorder_level),
  ).length;

  const bankAccounts = property?.bank_accounts as unknown[] | null;
  const naDate = nightAudit?.business_date as string | undefined;

  return {
    businessDate: today,
    propertyName: (property?.name as string | null) ?? null,
    setupComplete: Boolean(property?.setup_completed_at),
    arrivalsToday,
    departuresToday,
    inHouse: inHouse.length,
    holdsCount: holds.length,
    folioBalanceBtn,
    pendingBankProofs: (pendingBank ?? []).length,
    nightAuditCurrent: Boolean(naDate && String(naDate) >= today),
    openKot: openTickets.length,
    kotByStatus,
    mealCovers,
    todayEvents,
    eventPaxToday,
    rooms,
    laundry: laundryCounts,
    holds: holds.slice(0, 8).map((h) => ({
      id: h.id as string,
      contactName: (h.contact_name as string | null) ?? "Guest",
      contactPhone: (h.contact_phone as string | null) ?? null,
      checkIn: h.check_in as string,
      checkOut: h.check_out as string,
      tokenRequiredBtn: Number(h.token_required_btn ?? 0),
    })),
    openTickets,
    lowStockSkus,
    gasFull: Number(gasRows?.qty_on_hand ?? 0),
    tpnOnFile: Boolean((property?.tax_id as string | null)?.trim()),
    bankOnFile: Array.isArray(bankAccounts) && bankAccounts.length > 0,
    gstFiledThisMonth: gstPack?.status === "filed",
    guestForecast,
  };
}
