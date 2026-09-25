import { netFolioBalance } from "@/lib/folio/balance";
import {
  foActionFromDirtyRoom,
  foActionFromStay,
  recommendFoStayJob,
  sortFoNextActions,
  type FoNextAction,
  type FoStayFacts,
} from "@/lib/erp/fo-next-action";
import { thimphuToday } from "@/lib/erp-lists";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type FoTodaySnapshot = {
  businessDate: string;
  wallToday: string;
  nightAuditStale: boolean;
  actions: FoNextAction[];
};

function roomLabelFromAssigns(assigns: unknown): string | null {
  const labels: string[] = [];
  if (!Array.isArray(assigns)) return null;
  for (const a of assigns) {
    const raw = (a as { room_units?: unknown }).room_units;
    const unit = Array.isArray(raw) ? raw[0] : raw;
    const label = (unit as { label?: string } | null)?.label;
    if (label) labels.push(label);
  }
  return labels.length ? labels.join(", ") : null;
}

function folioBalance(
  folios:
    | Array<{
        status?: string;
        folio_lines?: Array<{
          id?: string;
          total_btn?: number;
          status?: string;
          reverses_line_id?: string | null;
        }> | null;
      }>
    | null,
): number {
  const open = (folios ?? []).find((f) => f.status === "open") ?? folios?.[0];
  if (!open?.folio_lines) return 0;
  return netFolioBalance(
    open.folio_lines.map((l) => ({
      id: l.id ?? "",
      status: l.status ?? "posted",
      total_btn: Number(l.total_btn ?? 0),
      reverses_line_id: l.reverses_line_id ?? null,
    })),
  );
}

const STAY_SELECT = `
  id, contact_name, confirmation_code, status, check_in, check_out,
  token_required_btn, token_received_btn, deposit_due_on, guest_origin, guide_number,
  room_assignments(room_units(label, hk_status, room_types(inventory_kind))),
  folios(status, folio_lines(id, total_btn, status, reverses_line_id))
`;

function roomUnreadyFromAssigns(assigns: unknown): boolean {
  if (!Array.isArray(assigns) || assigns.length === 0) return false;
  for (const a of assigns) {
    const raw = (a as { room_units?: unknown }).room_units;
    const unit = Array.isArray(raw) ? raw[0] : raw;
    if (!unit) continue;
    const hk = (unit as { hk_status?: string }).hk_status ?? "";
    const rtRaw = (unit as { room_types?: unknown }).room_types;
    const rt = Array.isArray(rtRaw) ? rtRaw[0] : rtRaw;
    const kind =
      ((rt as { inventory_kind?: string } | null)?.inventory_kind ??
        "sellable_guest") === "sellable_guest";
    if (
      kind &&
      !["clean", "inspect", "occupied"].includes(hk)
    ) {
      return true;
    }
  }
  return false;
}

export async function loadFoTodaySnapshot(
  admin: Admin,
  propertyId: string,
): Promise<FoTodaySnapshot> {
  const wallToday = thimphuToday();
  const [{ data: property }, arrivals, departures, holds, dirtyUnits, occAssigns, laundryRows] =
    await Promise.all([
      admin
        .from("properties")
        .select("current_business_date")
        .eq("id", propertyId)
        .maybeSingle(),
      admin
        .from("bookings")
        .select(STAY_SELECT)
        .eq("property_id", propertyId)
        .eq("check_in", wallToday)
        .in("status", ["pending", "confirmed", "held"])
        .order("contact_name")
        .limit(80),
      admin
        .from("bookings")
        .select(STAY_SELECT)
        .eq("property_id", propertyId)
        .eq("check_out", wallToday)
        .eq("status", "checked_in")
        .order("contact_name")
        .limit(80),
      admin
        .from("bookings")
        .select(STAY_SELECT)
        .eq("property_id", propertyId)
        .in("status", ["pending", "held"])
        .neq("check_in", wallToday)
        .order("check_in")
        .limit(40),
      admin
        .from("room_units")
        .select("id, label, hk_status, room_types!inner(inventory_kind)")
        .eq("property_id", propertyId)
        .eq("hk_status", "dirty")
        .eq("room_types.inventory_kind", "sellable_guest")
        .order("label")
        .limit(80),
      admin
        .from("room_assignments")
        .select("room_unit_id, from_date, to_date, bookings!inner(status, property_id)")
        .eq("bookings.property_id", propertyId)
        .eq("bookings.status", "checked_in")
        .lte("from_date", wallToday)
        .gt("to_date", wallToday)
        .limit(200),
      admin
        .from("laundry_orders")
        .select("booking_id, status")
        .eq("property_id", propertyId)
        .not("status", "in", "(delivered,cancelled)")
        .limit(300),
    ]);

  const laundryByBooking = new Map<string, number>();
  for (const row of laundryRows.data ?? []) {
    const bid = row.booking_id as string;
    if (!bid) continue;
    laundryByBooking.set(bid, (laundryByBooking.get(bid) ?? 0) + 1);
  }

  const businessDate =
    (property?.current_business_date as string | null)?.slice(0, 10) ||
    wallToday;
  const nightAuditStale = businessDate < wallToday;

  const occupied = new Set<string>();
  for (const row of occAssigns.data ?? []) {
    const id = (row as { room_unit_id?: string }).room_unit_id;
    if (id) occupied.add(id);
  }

  const seen = new Set<string>();
  const actions: FoNextAction[] = [];

  const pushStay = (row: Record<string, unknown>) => {
    const id = row.id as string;
    if (!id || seen.has(`stay:${id}`)) return;
    const facts: FoStayFacts = {
      bookingId: id,
      guestName: (row.contact_name as string) ?? "Guest",
      roomLabel: roomLabelFromAssigns(row.room_assignments),
      status: (row.status as string) ?? "",
      checkIn: (row.check_in as string) ?? "",
      checkOut: (row.check_out as string) ?? "",
      businessDate,
      balanceBtn: folioBalance(
        row.folios as Parameters<typeof folioBalance>[0],
      ),
      hasRoomAssigned: Boolean(
        Array.isArray(row.room_assignments) &&
          (row.room_assignments as unknown[]).length > 0,
      ),
      tokenRequiredBtn:
        row.token_required_btn != null
          ? Number(row.token_required_btn)
          : null,
      tokenReceivedBtn:
        row.token_received_btn != null
          ? Number(row.token_received_btn)
          : null,
      depositDueOn: (row.deposit_due_on as string | null) ?? null,
      roomUnready: roomUnreadyFromAssigns(row.room_assignments),
      sdfIncomplete:
        ((row.guest_origin as string | null) ?? "").toLowerCase() ===
          "international" &&
        !(row.guide_number as string | null)?.trim(),
      openLaundryCount: laundryByBooking.get(id) ?? 0,
    };
    const kind = recommendFoStayJob(facts);
    if (!kind) return;
    const action = foActionFromStay(facts, kind);
    seen.add(action.id);
    actions.push(action);
  };

  for (const row of (arrivals.data ?? []) as Record<string, unknown>[]) {
    pushStay(row);
  }
  for (const row of (departures.data ?? []) as Record<string, unknown>[]) {
    pushStay(row);
  }
  for (const row of (holds.data ?? []) as Record<string, unknown>[]) {
    pushStay(row);
  }

  for (const unit of dirtyUnits.data ?? []) {
    const roomUnitId = unit.id as string;
    const action = foActionFromDirtyRoom({
      roomUnitId,
      roomLabel: (unit.label as string) ?? "Room",
      occupied: occupied.has(roomUnitId),
    });
    if (!action || seen.has(action.id)) continue;
    seen.add(action.id);
    actions.push(action);
  }

  return {
    businessDate,
    wallToday,
    nightAuditStale,
    actions: sortFoNextActions(actions),
  };
}
