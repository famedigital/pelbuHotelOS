import { HousekeepingBoard, type HkBoardRow } from "@/components/erp/HousekeepingBoard";
import { FrontDeskLiveRefresh } from "@/components/erp/FrontDeskLiveRefresh";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { fmtDate, requireDeskPropertyId, thimphuToday } from "@/lib/erp-lists";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Housekeeping | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type RoomUnitRow = {
  id: string;
  label: string;
  hk_status: string;
  service_requested_at: string | null;
};

function buildHkCategories(
  roomUnitId: string,
  hkStatus: string,
  serviceRequestedAt: string | null,
  arrivalRoomIds: Set<string>,
  departureRoomIds: Set<string>,
): HkBoardRow["categories"] {
  const categories: HkBoardRow["categories"] = [];
  if (arrivalRoomIds.has(roomUnitId)) categories.push("check_in");
  if (departureRoomIds.has(roomUnitId)) categories.push("checkout");
  if (hkStatus === "dirty") categories.push("dirty");
  if (serviceRequestedAt) categories.push("service");
  return categories;
}

export default async function HousekeepingPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const today = thimphuToday();

  const [
    { data: units },
    { data: staff },
    { data: assignments },
    { data: arrivals },
    { data: departures },
  ] = await Promise.all([
    admin
      .from("room_units")
      .select("id, label, hk_status, service_requested_at")
      .eq("property_id", propertyId)
      .order("label")
      .limit(100),
    admin
      .from("staff_members")
      .select("id, full_name")
      .eq("property_id", propertyId)
      .eq("status", "active")
      .in("role_label", ["housekeeping", "manager", "front_desk"])
      .order("full_name")
      .limit(50),
    admin
      .from("hk_assignments")
      .select(
        `id, business_date, status, notes, staff_id, room_unit_id,
         checklist_clean_ok, checklist_linen_ok, checklist_amenities_ok,
         created_at,
         room_units(label, hk_status, service_requested_at),
         staff_members(full_name)`,
      )
      .eq("property_id", propertyId)
      .eq("business_date", today)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("bookings")
      .select("id, room_assignments(room_unit_id)")
      .eq("property_id", propertyId)
      .eq("check_in", today)
      .in("status", ["confirmed", "checked_in"]),
    admin
      .from("bookings")
      .select("id, room_assignments(room_unit_id)")
      .eq("property_id", propertyId)
      .eq("check_out", today)
      .in("status", ["checked_in", "confirmed"]),
  ]);

  const arrivalRoomIds = new Set<string>();
  for (const booking of arrivals ?? []) {
    for (const assignment of (booking.room_assignments as
      | { room_unit_id: string }[]
      | null) ?? []) {
      arrivalRoomIds.add(assignment.room_unit_id);
    }
  }
  const departureRoomIds = new Set<string>();
  for (const booking of departures ?? []) {
    for (const assignment of (booking.room_assignments as
      | { room_unit_id: string }[]
      | null) ?? []) {
      departureRoomIds.add(assignment.room_unit_id);
    }
  }

  const unitById = new Map<string, RoomUnitRow>(
    (units ?? []).map((unit) => [
      unit.id as string,
      {
        id: unit.id as string,
        label: unit.label as string,
        hk_status: (unit.hk_status as string) ?? "",
        service_requested_at:
          (unit.service_requested_at as string | null) ?? null,
      },
    ]),
  );

  const openAssignmentRoomIds = new Set<string>();
  for (const assignment of assignments ?? []) {
    const status = assignment.status as string;
    if (status === "open" || status === "in_progress") {
      openAssignmentRoomIds.add(assignment.room_unit_id as string);
    }
  }

  const boardRows: HkBoardRow[] = [];

  for (const assignment of assignments ?? []) {
    const room = assignment.room_units as
      | {
          label?: string;
          hk_status?: string;
          service_requested_at?: string | null;
        }
      | {
          label?: string;
          hk_status?: string;
          service_requested_at?: string | null;
        }[]
      | null;
    const roomRow = Array.isArray(room) ? room[0] : room;
    const staffMember = assignment.staff_members as
      | { full_name?: string }
      | { full_name?: string }[]
      | null;
    const staffName = Array.isArray(staffMember)
      ? staffMember[0]?.full_name
      : staffMember?.full_name;
    const roomUnitId = assignment.room_unit_id as string;
    const unit = unitById.get(roomUnitId);
    const hkStatus = roomRow?.hk_status ?? unit?.hk_status ?? "";
    const serviceRequestedAt =
      roomRow?.service_requested_at ?? unit?.service_requested_at ?? null;
    const categories = buildHkCategories(
      roomUnitId,
      hkStatus,
      serviceRequestedAt,
      arrivalRoomIds,
      departureRoomIds,
    );

    boardRows.push({
      id: assignment.id as string,
      roomUnitId,
      isPending: false,
      roomLabel: roomRow?.label ?? unit?.label ?? "—",
      staffName: staffName ?? null,
      staffId: (assignment.staff_id as string | null) ?? null,
      status: assignment.status as string,
      notes: (assignment.notes as string | null) ?? null,
      cleanOk: Boolean(assignment.checklist_clean_ok),
      linenOk: Boolean(assignment.checklist_linen_ok),
      amenitiesOk: Boolean(assignment.checklist_amenities_ok),
      categories,
    });
  }

  for (const unit of unitById.values()) {
    if (openAssignmentRoomIds.has(unit.id)) continue;
    const categories = buildHkCategories(
      unit.id,
      unit.hk_status,
      unit.service_requested_at,
      arrivalRoomIds,
      departureRoomIds,
    );
    if (categories.length === 0) continue;

    boardRows.push({
      id: `pending:${unit.id}`,
      roomUnitId: unit.id,
      isPending: true,
      roomLabel: unit.label,
      staffName: null,
      staffId: null,
      status: "needs_assignment",
      notes: null,
      cleanOk: false,
      linenOk: false,
      amenitiesOk: false,
      categories,
    });
  }

  boardRows.sort((a, b) => {
    const aOpen = a.status !== "done" ? 0 : 1;
    const bOpen = b.status !== "done" ? 0 : 1;
    if (aOpen !== bOpen) return aOpen - bOpen;
    return a.roomLabel.localeCompare(b.roomLabel, undefined, {
      numeric: true,
    });
  });

  return (
    <DeskListShell
      eyebrow="Housekeeping"
      heading={`Assignments · ${fmtDate(today)}`}
      blurb="Open work shows dirty rooms, service requests, and today's check-in/checkout turns. Filters narrow the list — assign and checklist from each row."
      headerAside={<FrontDeskLiveRefresh />}
    >
      <HousekeepingBoard
        rows={boardRows}
        today={today}
        units={(units ?? []).map((unit) => ({
          id: unit.id as string,
          label: unit.label as string,
        }))}
        staff={(staff ?? []).map((member) => ({
          id: member.id as string,
          full_name: member.full_name as string,
        }))}
      />
    </DeskListShell>
  );
}
