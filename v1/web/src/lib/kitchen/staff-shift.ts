import type { AttendanceKind } from "@/lib/attendance-types";
import { formatShiftOutlet } from "@/lib/shift-outlets";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/** Outlets shown on the kitchen / F&B ops board (matches rota sections). */
export const FNB_SHIFT_OUTLETS = [
  "cafe",
  "pastry",
  "restaurant",
  "bar",
  "other",
] as const;

/** Outlets that should have at least one person rostered on a service day. */
export const FNB_CORE_OUTLETS = ["restaurant", "cafe", "bar"] as const;

export type KitchenStaffPresence =
  | "present"
  | "on_break"
  | "absent"
  | "off_duty"
  | "on_leave";

export type KitchenStaffRow = {
  shiftId: string;
  staffId: string;
  fullName: string;
  roleLabel: string;
  outlet: string;
  startsAt: string;
  endsAt: string;
  presence: KitchenStaffPresence;
  lastPunchAt: string | null;
  lastEventKind: AttendanceKind | null;
};

export type KitchenStaffBoard = {
  tone: "green" | "amber" | "red";
  rostered: number;
  present: number;
  absent: number;
  onLeave: number;
  offDuty: number;
  outletGaps: string[];
  rows: KitchenStaffRow[];
};

function addDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function presenceFromEvent(
  eventKind: AttendanceKind | null,
  onLeave: boolean,
): KitchenStaffPresence {
  if (onLeave) return "on_leave";
  if (!eventKind) return "absent";
  if (eventKind === "clock_in" || eventKind === "break_end") return "present";
  if (eventKind === "break_start") return "on_break";
  return "off_duty";
}

function boardTone(input: {
  rostered: number;
  absent: number;
  outletGaps: string[];
}): KitchenStaffBoard["tone"] {
  if (input.rostered === 0 && input.outletGaps.length >= FNB_CORE_OUTLETS.length) {
    return "red";
  }
  if (input.absent > 0 || input.outletGaps.length > 0) {
    return input.absent >= Math.max(1, Math.ceil(input.rostered / 2))
      ? "red"
      : "amber";
  }
  if (input.rostered === 0) return "amber";
  return "green";
}

/** Published F&B shifts for today with clock-in presence and outlet gaps. */
export async function computeKitchenStaffBoard(
  admin: Admin,
  propertyId: string,
  businessDate: string,
): Promise<KitchenStaffBoard> {
  const dayStart = `${businessDate}T00:00:00+06:00`;
  const dayEnd = `${addDay(businessDate)}T00:00:00+06:00`;

  const [{ data: shifts }, { data: events }, { data: leaveRows }] =
    await Promise.all([
      admin
        .from("staff_shifts")
        .select(
          "id, staff_id, outlet, starts_at, ends_at, staff_members(full_name, role_label)",
        )
        .eq("property_id", propertyId)
        .eq("shift_date", businessDate)
        .eq("status", "published")
        .in("outlet", [...FNB_SHIFT_OUTLETS])
        .order("starts_at"),
      admin
        .from("staff_attendance_events")
        .select("staff_id, event_kind, occurred_at")
        .eq("property_id", propertyId)
        .is("voided_at", null)
        .gte("occurred_at", dayStart)
        .lt("occurred_at", dayEnd)
        .order("occurred_at", { ascending: false }),
      admin
        .from("staff_leave")
        .select("staff_id")
        .eq("property_id", propertyId)
        .eq("status", "approved")
        .lte("starts_on", businessDate)
        .gte("ends_on", businessDate),
    ]);

  const latestByStaff = new Map<
    string,
    { event_kind: AttendanceKind; occurred_at: string }
  >();
  for (const event of events ?? []) {
    const staffId = event.staff_id as string;
    if (!latestByStaff.has(staffId)) {
      latestByStaff.set(staffId, {
        event_kind: event.event_kind as AttendanceKind,
        occurred_at: event.occurred_at as string,
      });
    }
  }

  const onLeaveIds = new Set(
    (leaveRows ?? []).map((row) => row.staff_id as string),
  );

  const rows: KitchenStaffRow[] = (shifts ?? []).map((shift) => {
    const staffId = shift.staff_id as string;
    const staff = shift.staff_members as {
      full_name?: string;
      role_label?: string;
    } | null;
    const latest = latestByStaff.get(staffId);
    const onLeave = onLeaveIds.has(staffId);
    const lastEventKind = latest?.event_kind ?? null;

    return {
      shiftId: shift.id as string,
      staffId,
      fullName: staff?.full_name ?? "Staff",
      roleLabel: staff?.role_label ?? "—",
      outlet: (shift.outlet as string) ?? "other",
      startsAt: String(shift.starts_at).slice(0, 5),
      endsAt: String(shift.ends_at).slice(0, 5),
      presence: presenceFromEvent(lastEventKind, onLeave),
      lastPunchAt: latest?.occurred_at ?? null,
      lastEventKind,
    };
  });

  const outletsWithStaff = new Set(rows.map((row) => row.outlet));
  const outletGaps = FNB_CORE_OUTLETS.filter(
    (outlet) => !outletsWithStaff.has(outlet),
  ).map((outlet) => formatShiftOutlet(outlet));

  const present = rows.filter(
    (row) => row.presence === "present" || row.presence === "on_break",
  ).length;
  const absent = rows.filter((row) => row.presence === "absent").length;
  const onLeave = rows.filter((row) => row.presence === "on_leave").length;
  const offDuty = rows.filter((row) => row.presence === "off_duty").length;

  return {
    tone: boardTone({ rostered: rows.length, absent, outletGaps }),
    rostered: rows.length,
    present,
    absent,
    onLeave,
    offDuty,
    outletGaps,
    rows,
  };
}
