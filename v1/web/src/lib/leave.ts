import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type LeavePolicy = {
  id: string;
  property_id: string;
  code: string;
  name: string;
  unit: "working_day" | "calendar_day";
  accrual_frequency: "monthly" | "annual" | "event" | "none";
  accrual_days: number;
  minimum_service_months: number;
  starts_after_probation: boolean;
  allow_half_day: boolean;
  paid_rate: number;
  notice_days: number;
  evidence_after_days: number | null;
  lifetime_occurrence_limit: number | null;
};

export function addMonths(iso: string, months: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

export function eachMonth(startIso: string, endIso: string): string[] {
  const months: string[] = [];
  const cursor = new Date(`${startIso.slice(0, 7)}-01T00:00:00.000Z`);
  const end = new Date(`${endIso.slice(0, 7)}-01T00:00:00.000Z`);
  while (cursor <= end) {
    months.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function calendarDates(startIso: string, endIso: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startIso}T00:00:00.000Z`);
  const end = new Date(`${endIso}T00:00:00.000Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export async function calculateRequestedLeaveDays(
  admin: Admin,
  input: {
    propertyId: string;
    staffId: string;
    policy: LeavePolicy;
    startsOn: string;
    endsOn: string;
    startPeriod: "full" | "am" | "pm";
    endPeriod: "full" | "am" | "pm";
  },
): Promise<number> {
  const dates = calendarDates(input.startsOn, input.endsOn);
  if (!dates.length) throw new Error("Leave dates are invalid.");

  let countedDates = dates;
  if (input.policy.unit === "working_day") {
    const [{ data: shifts }, { data: holidays }] = await Promise.all([
      admin
        .from("staff_shifts")
        .select("shift_date")
        .eq("property_id", input.propertyId)
        .eq("staff_id", input.staffId)
        .eq("status", "published")
        .gte("shift_date", input.startsOn)
        .lte("shift_date", input.endsOn),
      admin
        .from("hr_holidays")
        .select("holiday_date")
        .eq("property_id", input.propertyId)
        .gte("holiday_date", input.startsOn)
        .lte("holiday_date", input.endsOn),
    ]);

    const scheduled = new Set((shifts ?? []).map((row) => row.shift_date as string));
    const holidayDates = new Set(
      (holidays ?? []).map((row) => row.holiday_date as string),
    );
    countedDates =
      scheduled.size > 0
        ? dates.filter((date) => scheduled.has(date))
        : dates.filter((date) => {
            const day = new Date(`${date}T00:00:00Z`).getUTCDay();
            return day !== 0 && day !== 6 && !holidayDates.has(date);
          });
  }

  let days = countedDates.length;
  if (input.policy.allow_half_day && countedDates.length > 0) {
    if (input.startPeriod !== "full" && countedDates.includes(input.startsOn)) {
      days -= 0.5;
    }
    if (
      input.endsOn !== input.startsOn &&
      input.endPeriod !== "full" &&
      countedDates.includes(input.endsOn)
    ) {
      days -= 0.5;
    }
  }

  if (days <= 0) throw new Error("The selected dates contain no working leave days.");
  return days;
}

export async function leaveCoverageWarnings(
  admin: Admin,
  input: {
    propertyId: string;
    staffId: string;
    policyId: string;
    department: string | null;
    startsOn: string;
    endsOn: string;
  },
): Promise<string[]> {
  const [ownOverlap, blackouts, departmentRows, affectedShifts] = await Promise.all([
    admin
      .from("staff_leave")
      .select("id")
      .eq("property_id", input.propertyId)
      .eq("staff_id", input.staffId)
      .in("status", ["requested", "approved"])
      .lte("starts_on", input.endsOn)
      .gte("ends_on", input.startsOn)
      .limit(1),
    admin
      .from("hr_leave_blackouts")
      .select("name, reason, is_hard_block, department, leave_policy_id")
      .eq("property_id", input.propertyId)
      .lte("starts_on", input.endsOn)
      .gte("ends_on", input.startsOn),
    input.department
      ? admin
          .from("staff_leave")
          .select("id, staff_members!inner(department)")
          .eq("property_id", input.propertyId)
          .in("status", ["requested", "approved"])
          .neq("staff_id", input.staffId)
          .lte("starts_on", input.endsOn)
          .gte("ends_on", input.startsOn)
          .eq("staff_members.department", input.department)
      : Promise.resolve({ data: [] }),
    admin
      .from("staff_shifts")
      .select("id")
      .eq("property_id", input.propertyId)
      .eq("staff_id", input.staffId)
      .eq("status", "published")
      .gte("shift_date", input.startsOn)
      .lte("shift_date", input.endsOn),
  ]);

  if (ownOverlap.data?.length) {
    throw new Error("This request overlaps an existing leave request.");
  }

  const warnings: string[] = [];
  for (const blackout of blackouts.data ?? []) {
    if (
      blackout.department &&
      blackout.department !== input.department
    ) {
      continue;
    }
    if (
      blackout.leave_policy_id &&
      blackout.leave_policy_id !== input.policyId
    ) {
      continue;
    }
    const message = `${blackout.name as string}: ${blackout.reason as string}`;
    if (blackout.is_hard_block) throw new Error(message);
    warnings.push(message);
  }
  const departmentCount = departmentRows.data?.length ?? 0;
  if (departmentCount > 0) {
    warnings.push(
      `${departmentCount} other ${input.department ?? "department"} staff request overlaps these dates.`,
    );
  }
  const shiftCount = affectedShifts.data?.length ?? 0;
  if (shiftCount > 0) {
    warnings.push(`${shiftCount} published shift${shiftCount === 1 ? "" : "s"} need coverage.`);
  }
  return warnings;
}

export async function currentPolicy(
  admin: Admin,
  propertyId: string,
  policyId: string,
  onDate: string,
): Promise<LeavePolicy> {
  const { data } = await admin
    .from("hr_leave_policies")
    .select(
      "id, property_id, code, name, unit, accrual_frequency, accrual_days, minimum_service_months, starts_after_probation, allow_half_day, paid_rate, notice_days, evidence_after_days, lifetime_occurrence_limit",
    )
    .eq("id", policyId)
    .eq("property_id", propertyId)
    .eq("is_active", true)
    .lte("effective_from", onDate)
    .or(`effective_to.is.null,effective_to.gte.${onDate}`)
    .maybeSingle();
  if (!data) throw new Error("Leave policy is not active for these dates.");
  return {
    ...(data as unknown as LeavePolicy),
    accrual_days: Number(data.accrual_days),
    paid_rate: Number(data.paid_rate),
    evidence_after_days:
      data.evidence_after_days == null ? null : Number(data.evidence_after_days),
  };
}
