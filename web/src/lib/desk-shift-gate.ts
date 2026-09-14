/**
 * Optional property gate: restrict hotel desk (/erp) to published staff_shifts.
 * Default OFF — see property_policies.desk_restrict_to_scheduled_shifts.
 * POS pos_shifts are intentionally separate and never consulted here.
 */

import { thimphuDateOffset, todayInTimezone } from "@/lib/erp-lists";
import { localHmInTimezone } from "@/lib/night-audit/close-time";
import { normalizeTime } from "@/lib/rota/overlap";
import type { StaffSession } from "@/lib/staff-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const DESK_OUTSIDE_SHIFT_MESSAGE =
  "Outside scheduled shift. Hotel desk is limited to your published rota window right now. Ask your GM if you need access outside shift.";

const TZ = "Asia/Thimphu";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type StaffShiftWindow = {
  shift_date: string;
  starts_at: string;
  ends_at: string;
};

/** Owner / GM / manager access levels, or desk_role owner|gm|manager. */
export function isDeskShiftBypassStaff(staff: {
  accessLevel?: string | null;
  deskRole?: string | null;
}): boolean {
  const access = (staff.accessLevel ?? "").trim().toLowerCase();
  if (
    access === "owner" ||
    access === "gm" ||
    access === "manager" ||
    access === "supervisor" ||
    access === "hr_admin"
  ) {
    return true;
  }
  const role = (staff.deskRole ?? "").trim().toLowerCase();
  return role === "owner" || role === "gm" || role === "manager";
}

function hmToMinutes(raw: string): number {
  const [h, m] = normalizeTime(raw).split(":");
  return Number(h) * 60 + Number(m);
}

/**
 * True when `now` (property local date + minutes since midnight) falls inside
 * the shift window. Overnight shifts (ends_at <= starts_at) span midnight into
 * the next calendar day.
 */
export function shiftCoversLocalNow(
  shift: StaffShiftWindow,
  localDate: string,
  localMinutes: number,
): boolean {
  const date = shift.shift_date.slice(0, 10);
  const start = hmToMinutes(String(shift.starts_at));
  const end = hmToMinutes(String(shift.ends_at));
  const overnight = end <= start;

  if (date === localDate) {
    if (overnight) {
      return localMinutes >= start;
    }
    return localMinutes >= start && localMinutes < end;
  }

  if (overnight) {
    const nextDay = thimphuDateOffset(date, 1);
    if (localDate === nextDay) {
      return localMinutes < end;
    }
  }

  return false;
}

export function anyShiftCoversLocalNow(
  shifts: StaffShiftWindow[],
  now: Date = new Date(),
  timeZone: string = TZ,
): boolean {
  const localDate = todayInTimezone(timeZone);
  const hm = localHmInTimezone(now, timeZone);
  const localMinutes = hmToMinutes(hm);
  return shifts.some((s) => shiftCoversLocalNow(s, localDate, localMinutes));
}

/**
 * Published shifts for this staff on today and yesterday (for overnight).
 */
export async function loadPublishedShiftsAroundNow(
  admin: Admin,
  propertyId: string,
  staffId: string,
  timeZone: string = TZ,
): Promise<StaffShiftWindow[]> {
  const today = todayInTimezone(timeZone);
  const yesterday = thimphuDateOffset(today, -1);

  const { data, error } = await admin
    .from("staff_shifts")
    .select("shift_date, starts_at, ends_at")
    .eq("property_id", propertyId)
    .eq("staff_id", staffId)
    .eq("status", "published")
    .gte("shift_date", yesterday)
    .lte("shift_date", today);

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    shift_date: String(row.shift_date).slice(0, 10),
    starts_at: String(row.starts_at),
    ends_at: String(row.ends_at),
  }));
}

/** Load policy flag; missing column / row → false (restriction OFF). */
export async function isDeskRestrictToScheduledShifts(
  admin: Admin,
  propertyId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("property_policies")
    .select("desk_restrict_to_scheduled_shifts")
    .eq("property_id", propertyId)
    .maybeSingle();

  if (error) {
    // Column not applied yet → keep free access (default OFF).
    return false;
  }
  return Boolean(
    (data as { desk_restrict_to_scheduled_shifts?: boolean } | null)
      ?.desk_restrict_to_scheduled_shifts,
  );
}

/**
 * When restriction is on and staff is non-management, require a covering
 * published staff_shifts row. PIN sessions bypass elsewhere.
 */
export async function staffSessionSatisfiesDeskShift(
  admin: Admin,
  staff: Pick<StaffSession, "staffId" | "propertyId" | "accessLevel" | "deskRole">,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (isDeskShiftBypassStaff(staff)) {
    return { ok: true };
  }

  const restrict = await isDeskRestrictToScheduledShifts(admin, staff.propertyId);
  if (!restrict) {
    return { ok: true };
  }

  const shifts = await loadPublishedShiftsAroundNow(
    admin,
    staff.propertyId,
    staff.staffId,
  );
  if (anyShiftCoversLocalNow(shifts)) {
    return { ok: true };
  }

  return { ok: false, message: DESK_OUTSIDE_SHIFT_MESSAGE };
}
