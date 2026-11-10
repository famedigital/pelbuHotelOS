import type { AdapterCtx } from "./types.js";

/**
 * HR read models. Real tables: staff_members, staff_shifts (rota),
 * staff_leave, staff_attendance_events, payroll_runs + payroll_run_items +
 * payroll_periods. PINs live in Supabase Auth — never select or expose them.
 */
export async function listStaff(ctx: AdapterCtx) {
  const { data, error } = await ctx.admin
    .from("staff_members")
    .select(
      "id, full_name, employee_code, role_label, position_title, department, desk_role, status, phone, email, can_login, can_access_desk",
    )
    .eq("property_id", ctx.jwt.propertyId)
    .order("full_name");
  if (error) throw error;
  return {
    staff: (data ?? []).map((s) => ({
      id: s.id,
      fullName: s.full_name,
      employeeCode: s.employee_code,
      role: s.position_title || s.role_label || s.desk_role,
      deskRole: s.desk_role,
      isActive: s.status === "active" || s.status === "on_leave",
      status: s.status,
      phone: s.phone,
      email: s.email,
      department: s.department,
      canLogin: s.can_login,
    })),
  };
}

export async function getHrBoard(ctx: AdapterCtx) {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Thimphu",
  });
  const [rota, leave, attendance] = await Promise.all([
    ctx.admin
      .from("staff_shifts")
      .select("id, staff_id, shift_date, starts_at, ends_at, outlet, status, notes")
      .eq("property_id", ctx.jwt.propertyId)
      .gte("shift_date", today)
      .order("shift_date")
      .limit(200),
    ctx.admin
      .from("staff_leave")
      .select(
        "id, staff_id, leave_type, starts_on, ends_on, status, approval_stage, requested_days, notes",
      )
      .eq("property_id", ctx.jwt.propertyId)
      .gte("ends_on", today)
      .in("status", ["requested", "approved"])
      .order("starts_on")
      .limit(100),
    ctx.admin
      .from("staff_attendance_events")
      .select("id, staff_id, event_kind, source, occurred_at")
      .eq("property_id", ctx.jwt.propertyId)
      .is("voided_at", null)
      .gte("occurred_at", `${today}T00:00:00+06:00`)
      .order("occurred_at")
      .limit(500),
  ]);
  if (rota.error) throw rota.error;
  if (leave.error) throw leave.error;
  if (attendance.error) throw attendance.error;

  return {
    today,
    rota: rota.data ?? [],
    leave: leave.data ?? [],
    attendance: attendance.data ?? [],
  };
}

/** Payslips = finalized/approved payroll run items. */
export async function listPayslips(ctx: AdapterCtx, staffId?: string) {
  let q = ctx.admin
    .from("payroll_run_items")
    .select(
      `id, staff_id, full_name, employee_code, gross_btn, net_btn, pit_btn,
       employee_pf_btn, other_deductions_btn, payment_status, paid_at, created_at,
       payroll_runs!inner(id, status, finalized_at, payroll_periods(label, period_start, period_end, pay_date))`,
    )
    .eq("property_id", ctx.jwt.propertyId)
    .in("payroll_runs.status", ["approved", "finalized"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (staffId) q = q.eq("staff_id", staffId);
  const { data, error } = await q;
  if (error) throw error;
  return {
    payslips: (data ?? []).map((it) => {
      const run = Array.isArray(it.payroll_runs) ? it.payroll_runs[0] : it.payroll_runs;
      const periodRaw = (run as { payroll_periods?: unknown } | null)?.payroll_periods;
      const period = (Array.isArray(periodRaw) ? periodRaw[0] : periodRaw) as
        | { label?: string; period_start?: string; period_end?: string }
        | null;
      return {
        ...it,
        payroll_runs: undefined,
        run_status: (run as { status?: string } | null)?.status ?? null,
        period_label: period?.label ?? null,
        period_start: period?.period_start ?? null,
        period_end: period?.period_end ?? null,
      };
    }),
  };
}
