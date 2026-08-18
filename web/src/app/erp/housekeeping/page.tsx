import { HousekeepingBoard } from "@/components/erp/HousekeepingBoard";
import { FrontDeskLiveRefresh } from "@/components/erp/FrontDeskLiveRefresh";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { fmtDate, thimphuToday } from "@/lib/erp-lists";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { buildHousekeepingBoardRows } from "@/lib/hk/board";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Housekeeping | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

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
    { data: inHouse },
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
    admin
      .from("bookings")
      .select("id, check_out, room_assignments(room_unit_id)")
      .eq("property_id", propertyId)
      .eq("status", "checked_in")
      .neq("check_out", today)
      .limit(200),
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

  const stayoverRoomIds = new Set<string>();
  for (const booking of inHouse ?? []) {
    for (const assignment of (booking.room_assignments as
      | { room_unit_id: string }[]
      | null) ?? []) {
      stayoverRoomIds.add(assignment.room_unit_id);
    }
  }

  const unitSnapshots = (units ?? []).map((unit) => ({
    id: unit.id as string,
    label: unit.label as string,
    hk_status: (unit.hk_status as string) ?? "",
    service_requested_at: (unit.service_requested_at as string | null) ?? null,
  }));

  const assignmentSnapshots = (assignments ?? []).map((assignment) => {
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

    return {
      id: assignment.id as string,
      room_unit_id: assignment.room_unit_id as string,
      status: assignment.status as string,
      notes: (assignment.notes as string | null) ?? null,
      staff_id: (assignment.staff_id as string | null) ?? null,
      checklist_clean_ok: Boolean(assignment.checklist_clean_ok),
      checklist_linen_ok: Boolean(assignment.checklist_linen_ok),
      checklist_amenities_ok: Boolean(assignment.checklist_amenities_ok),
      room_label: roomRow?.label ?? null,
      staff_name: staffName ?? null,
    };
  });

  const boardRows = buildHousekeepingBoardRows({
    units: unitSnapshots,
    assignments: assignmentSnapshots,
    arrivalRoomIds,
    departureRoomIds,
    stayoverRoomIds,
  });

  return (
    <DeskListShell
      eyebrow="Housekeeping"
      heading={`Assignments · ${fmtDate(today)}`}
      blurb="Due out · Stayovers · Dirty · Clean ready. Open work is the turn list — assign and checklist from each row."
      headerAside={<FrontDeskLiveRefresh />}
    >
      <HousekeepingBoard
        rows={boardRows}
        today={today}
        units={unitSnapshots.map((unit) => ({
          id: unit.id,
          label: unit.label,
        }))}
        staff={(staff ?? []).map((member) => ({
          id: member.id as string,
          full_name: member.full_name as string,
        }))}
      />
    </DeskListShell>
  );
}
