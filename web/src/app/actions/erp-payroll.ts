"use server";

import { writeAuditEvent } from "@/lib/audit";
import { postExpense, postPayrollPayout } from "@/lib/accounting/posting";
import { isDeskAuthenticated, requireMoneyDesk } from "@/lib/desk-auth";
import { assertDeskProperty } from "@/lib/desk/property-guard";
import {
  computePayrollItem,
  ruleSetFromRow,
  round2,
  type PayComponent,
  type PayrollItemInput,
} from "@/lib/payroll/engine";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { optionalTrim, trimRequired } from "@/lib/validation";
import { revalidatePath } from "next/cache";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type PayrollActionState = {
  ok: boolean;
  error?: string;
  message?: string;
};

async function requireDesk() {
  if (!(await isDeskAuthenticated())) {
    throw new Error("Desk session expired. Sign in again.");
  }
}

function revalidatePayroll(runId?: string) {
  revalidatePath("/erp/hr/payroll");
  if (runId) revalidatePath(`/erp/hr/payroll/${runId}`);
  revalidatePath("/erp/hr");
}

function fail(error: string): PayrollActionState {
  return { ok: false, error };
}

/** Resolve the active rule set effective on/before the given date. */
async function activeRuleSet(admin: Admin, propertyId: string, onDate: string) {
  const { data, error } = await admin
    .from("payroll_rule_sets")
    .select("*")
    .eq("property_id", propertyId)
    .eq("is_active", true)
    .lte("effective_from", onDate)
    .or(`effective_to.is.null,effective_to.gte.${onDate}`)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("rule set lookup failed", error);
    throw new Error("Could not load a payroll rule set.");
  }
  return data;
}

// ---------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------
export async function createPayrollPeriod(
  _prev: PayrollActionState,
  formData: FormData,
): Promise<PayrollActionState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);

    const label = trimRequired(formData.get("label"), "Label");
    const periodStart = trimRequired(formData.get("period_start"), "Start date");
    const periodEnd = trimRequired(formData.get("period_end"), "End date");
    const payDate = optionalTrim(formData.get("pay_date"));
    if (periodEnd < periodStart) {
      return fail("End date must be on or after the start date.");
    }

    const { data, error } = await admin
      .from("payroll_periods")
      .insert({
        property_id: propertyId,
        label,
        period_start: periodStart,
        period_end: periodEnd,
        pay_date: payDate,
      })
      .select("id")
      .single();
    if (error || !data) {
      if (error?.code === "23505") {
        return fail("A period with these dates already exists.");
      }
      console.error("payroll period insert failed", error);
      return fail("Could not create the payroll period.");
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "payroll.period.create",
      entityType: "payroll_periods",
      entityId: data.id as string,
      summary: `Created payroll period ${label}`,
      meta: { periodStart, periodEnd },
    });

    revalidatePayroll();
    return { ok: true, message: `Period ${label} created.` };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Something went wrong.");
  }
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------
export async function createPayrollRun(
  _prev: PayrollActionState,
  formData: FormData,
): Promise<PayrollActionState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);

    const periodId = trimRequired(formData.get("period_id"), "Period");
    const { data: period, error: periodError } = await admin
      .from("payroll_periods")
      .select("id, property_id, period_end, status, label")
      .eq("id", periodId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (periodError || !period) return fail("Payroll period not found.");
    if (period.status === "closed") {
      return fail("This period is closed. Reopen it to run payroll.");
    }

    const ruleSet = await activeRuleSet(
      admin,
      propertyId,
      period.period_end as string,
    );
    if (!ruleSet) {
      return fail(
        "No active payroll rule set found. Create one before running payroll.",
      );
    }

    const { count } = await admin
      .from("payroll_runs")
      .select("id", { count: "exact", head: true })
      .eq("period_id", periodId);
    const sequence = (count ?? 0) + 1;

    const { data: run, error } = await admin
      .from("payroll_runs")
      .insert({
        property_id: propertyId,
        period_id: periodId,
        rule_set_id: ruleSet.id,
        sequence,
        status: "draft",
        rule_snapshot: ruleSet,
      })
      .select("id")
      .single();
    if (error || !run) {
      console.error("payroll run insert failed", error);
      return fail("Could not create the payroll run.");
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "payroll.run.create",
      entityType: "payroll_runs",
      entityId: run.id as string,
      summary: `Created payroll run #${sequence} for ${period.label}`,
      meta: { periodId, ruleSetId: ruleSet.id },
    });

    revalidatePayroll(run.id as string);
    return { ok: true, message: "Payroll run created. Calculate it next." };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Something went wrong.");
  }
}

export async function calculatePayrollRun(
  _prev: PayrollActionState,
  formData: FormData,
): Promise<PayrollActionState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const runId = trimRequired(formData.get("run_id"), "Run");

    const { data: run, error: runError } = await admin
      .from("payroll_runs")
      .select("id, property_id, period_id, status, rule_snapshot")
      .eq("id", runId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (runError || !run) return fail("Payroll run not found.");
    if (run.status === "finalized" || run.status === "cancelled") {
      return fail("This run is locked and cannot be recalculated.");
    }
    if (!run.rule_snapshot) return fail("Run has no rule snapshot.");

    const rules = ruleSetFromRow(
      run.rule_snapshot as Parameters<typeof ruleSetFromRow>[0],
    );

    // Active staff with a pay basis.
    const { data: staff, error: staffError } = await admin
      .from("staff_members")
      .select(
        "id, employee_code, full_name, department, position_title, status",
      )
      .eq("property_id", propertyId)
      .in("status", ["active", "on_leave"]);
    if (staffError) {
      console.error("staff load failed", staffError);
      return fail("Could not load staff for payroll.");
    }
    const staffList = staff ?? [];
    if (staffList.length === 0) {
      return fail("No active staff to run payroll for.");
    }

    const staffIds = staffList.map((s) => s.id as string);

    const { data: profiles } = await admin
      .from("staff_private_profiles")
      .select(
        "staff_id, base_wage_btn, bank_name, bank_account_number, provident_fund_number, tax_identifier, health_contribution_btn, service_charge_eligible, service_charge_share_btn",
      )
      .in("staff_id", staffIds);
    const profileByStaff = new Map(
      (profiles ?? []).map((p) => [p.staff_id as string, p]),
    );

    const { data: recurring } = await admin
      .from("staff_pay_components")
      .select("staff_id, kind, code, label, amount_btn, taxable")
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .in("staff_id", staffIds);
    const recurringByStaff = new Map<string, typeof recurring>();
    for (const row of recurring ?? []) {
      const key = row.staff_id as string;
      const list = recurringByStaff.get(key) ?? [];
      list.push(row);
      recurringByStaff.set(key, list);
    }

    const { data: adjustments } = await admin
      .from("payroll_adjustments")
      .select("staff_id, kind, code, label, amount_btn, taxable")
      .eq("period_id", run.period_id)
      .in("staff_id", staffIds);
    const adjByStaff = new Map<string, typeof adjustments>();
    for (const adj of adjustments ?? []) {
      const key = adj.staff_id as string;
      const list = adjByStaff.get(key) ?? [];
      list.push(adj);
      adjByStaff.set(key, list);
    }

    let headcount = 0;
    let grossTotal = 0;
    let deductionTotal = 0;
    let employeePfTotal = 0;
    let employerPfTotal = 0;
    let pitTotal = 0;
    let netTotal = 0;
    let employerCostTotal = 0;

    // Rebuild items from scratch for a deterministic recalculation.
    await admin.from("payroll_run_items").delete().eq("run_id", runId);

    const rows: Record<string, unknown>[] = [];
    for (const member of staffList) {
      const profile = profileByStaff.get(member.id as string);
      const basicWage = Number(profile?.base_wage_btn ?? 0);
      if (!basicWage || basicWage <= 0) continue; // skip staff without a wage

      const earnings: PayComponent[] = [];
      const deductions: PayComponent[] = [];

      for (const row of recurringByStaff.get(member.id as string) ?? []) {
        const component: PayComponent = {
          code: row.code as string,
          label: row.label as string,
          amount: Number(row.amount_btn ?? 0),
          taxable: Boolean(row.taxable),
        };
        if (row.kind === "earning") earnings.push(component);
        else deductions.push({ ...component, taxable: false });
      }

      // Health contribution (HC) and optional fixed service-charge share (SC).
      const hc = Number(profile?.health_contribution_btn ?? 0);
      if (hc > 0) {
        deductions.push({
          code: "HC",
          label: "Health contribution",
          amount: hc,
          taxable: false,
        });
      }
      if (
        profile?.service_charge_eligible &&
        Number(profile.service_charge_share_btn ?? 0) > 0
      ) {
        earnings.push({
          code: "SC_SHARE",
          label: "Service charge share",
          amount: Number(profile.service_charge_share_btn),
          taxable: true,
        });
      }

      for (const adj of adjByStaff.get(member.id as string) ?? []) {
        const component: PayComponent = {
          code: adj.code as string,
          label: adj.label as string,
          amount: Number(adj.amount_btn ?? 0),
          taxable: Boolean(adj.taxable),
        };
        if (adj.kind === "earning") earnings.push(component);
        else deductions.push({ ...component, taxable: false });
      }

      const input: PayrollItemInput = { basicWage, earnings, deductions };
      const result = computePayrollItem(input, rules);

      headcount += 1;
      grossTotal = round2(grossTotal + result.gross);
      deductionTotal = round2(
        deductionTotal + (result.gross - result.net),
      );
      employeePfTotal = round2(employeePfTotal + result.employeePf);
      employerPfTotal = round2(employerPfTotal + result.employerPf);
      pitTotal = round2(pitTotal + result.pit);
      netTotal = round2(netTotal + result.net);
      employerCostTotal = round2(employerCostTotal + result.employerCost);

      rows.push({
        run_id: runId,
        property_id: propertyId,
        staff_id: member.id,
        employee_code: member.employee_code,
        full_name: member.full_name,
        department: member.department,
        position_title: member.position_title,
        bank_name: profile?.bank_name ?? null,
        bank_account_number: profile?.bank_account_number ?? null,
        provident_fund_number: profile?.provident_fund_number ?? null,
        tax_identifier: profile?.tax_identifier ?? null,
        basic_wage_btn: round2(basicWage),
        inputs: input,
        lines: result.lines,
        gross_btn: result.gross,
        taxable_btn: result.taxable,
        employee_pf_btn: result.employeePf,
        employer_pf_btn: result.employerPf,
        pit_btn: result.pit,
        other_deductions_btn: result.otherDeductions,
        net_btn: result.net,
        employer_cost_btn: result.employerCost,
      });
    }

    if (rows.length === 0) {
      return fail(
        "No staff have a base wage set. Add wages in private profiles first.",
      );
    }

    const { error: itemsError } = await admin
      .from("payroll_run_items")
      .insert(rows);
    if (itemsError) {
      console.error("payroll items insert failed", itemsError);
      return fail("Could not save payslip lines.");
    }

    const { error: updateError } = await admin
      .from("payroll_runs")
      .update({
        status: "calculated",
        headcount,
        gross_total_btn: grossTotal,
        deduction_total_btn: deductionTotal,
        employee_pf_total_btn: employeePfTotal,
        employer_pf_total_btn: employerPfTotal,
        pit_total_btn: pitTotal,
        net_total_btn: netTotal,
        employer_cost_total_btn: employerCostTotal,
        calculated_at: new Date().toISOString(),
        calculated_by: "desk",
      })
      .eq("id", runId);
    if (updateError) {
      console.error("payroll run update failed", updateError);
      return fail("Could not update run totals.");
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "payroll.run.calculate",
      entityType: "payroll_runs",
      entityId: runId,
      summary: `Calculated payroll for ${headcount} staff`,
      meta: { headcount, grossTotal, netTotal, pitTotal, employeePfTotal },
    });

    revalidatePayroll(runId);
    return {
      ok: true,
      message: `Calculated ${headcount} payslips. Net Nu ${netTotal.toLocaleString("en-BT")}.`,
    };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Something went wrong.");
  }
}

export async function approvePayrollRun(
  _prev: PayrollActionState,
  formData: FormData,
): Promise<PayrollActionState> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const runId = trimRequired(formData.get("run_id"), "Run");

    const { data: run } = await admin
      .from("payroll_runs")
      .select("id, status, headcount, property_id")
      .eq("id", runId)
      .maybeSingle();
    if (!run) return fail("Payroll run not found.");
    assertDeskProperty(propertyId, run.property_id as string, "Payroll run");
    if (run.status !== "calculated") {
      return fail("Only a calculated run can be approved.");
    }

    const { error } = await admin
      .from("payroll_runs")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: "desk",
      })
      .eq("id", runId);
    if (error) return fail("Could not approve the run.");

    await writeAuditEvent(admin, {
      propertyId,
      action: "payroll.run.approve",
      entityType: "payroll_runs",
      entityId: runId,
      summary: `Approved payroll run (${run.headcount} staff)`,
    });

    revalidatePayroll(runId);
    return { ok: true, message: "Payroll approved. Finalize to lock it." };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Something went wrong.");
  }
}

export async function finalizePayrollRun(
  _prev: PayrollActionState,
  formData: FormData,
): Promise<PayrollActionState> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const runId = trimRequired(formData.get("run_id"), "Run");

    const { data: run } = await admin
      .from("payroll_runs")
      .select(
        "id, status, headcount, net_total_btn, employer_cost_total_btn, period_id, property_id",
      )
      .eq("id", runId)
      .maybeSingle();
    if (!run) return fail("Payroll run not found.");
    assertDeskProperty(propertyId, run.property_id as string, "Payroll run");
    if (run.status !== "approved") {
      return fail("Only an approved run can be finalized.");
    }

    const { data: period } = await admin
      .from("payroll_periods")
      .select("label, pay_date, period_end")
      .eq("id", run.period_id)
      .maybeSingle();
    const expenseDate =
      (period?.pay_date as string | null) ??
      (period?.period_end as string | null) ??
      new Date().toISOString().slice(0, 10);

    // Post the employer cost to finance as a payroll expense.
    const employerCost = Number(run.employer_cost_total_btn ?? 0);
    let financeExpenseId: string | null = null;
    if (employerCost > 0) {
      const { data: expense, error: expenseError } = await admin
        .from("expenses")
        .insert({
          property_id: propertyId,
          category: "payroll",
          description: `Payroll ${period?.label ?? ""} (${run.headcount} staff)`.trim(),
          amount_btn: employerCost,
          gst_btn: 0,
          expense_date: expenseDate,
          payment_method: "bank",
          reference: `PAYRUN-${runId.slice(0, 8)}`,
          notes: "Auto-posted from finalized payroll run.",
        })
        .select("id")
        .single();
      if (expenseError) {
        console.error("payroll finance expense failed", expenseError);
        return fail("Could not post payroll to finance.");
      }
      financeExpenseId = expense?.id as string;
      if (financeExpenseId) {
        await postExpense(admin, propertyId, {
          id: financeExpenseId,
          category: "payroll",
          description: `Payroll ${period?.label ?? ""}`.trim(),
          amount_btn: employerCost,
          gst_btn: 0,
          expense_date: expenseDate,
          payment_method: "bank",
        });
      }
    }

    const { error } = await admin
      .from("payroll_runs")
      .update({
        status: "finalized",
        finalized_at: new Date().toISOString(),
        finalized_by: "desk",
        finance_expense_id: financeExpenseId,
      })
      .eq("id", runId);
    if (error) {
      console.error("payroll finalize failed", error);
      return fail("Could not finalize the run.");
    }

    await admin
      .from("payroll_periods")
      .update({ status: "closed" })
      .eq("id", run.period_id);

    // Notify staff that their payslip is ready (in-app + push + email).
    const { data: payslips } = await admin
      .from("payroll_run_items")
      .select("id, staff_id, full_name, net_btn")
      .eq("run_id", runId);
    const staffIds = (payslips ?? []).map((p) => p.staff_id as string);
    if (staffIds.length) {
      const { data: staffRows } = await admin
        .from("staff_members")
        .select("id, email")
        .in("id", staffIds);
      const emailById = new Map(
        (staffRows ?? []).map((s) => [
          s.id as string,
          (s.email as string | null) ?? null,
        ]),
      );
      const batch = Date.now();
      const outboxRows = (payslips ?? []).flatMap((item) => {
        const email = emailById.get(item.staff_id as string);
        const base = {
          property_id: propertyId,
          staff_id: item.staff_id as string,
          announcement_id: null,
          event_type: "payslip.ready",
          payload: {
            title: `Payslip ready — ${period?.label ?? "payroll"}`,
            body: `Net pay Nu ${Number(item.net_btn ?? 0).toLocaleString("en-BT")}`,
            category: "payroll",
            url: `/staff/payslips/${item.id}`,
          } as Record<string, unknown>,
        };
        return [
          {
            ...base,
            channel: "in_app",
            idempotency_key: `payslip:${runId}:${item.staff_id}:in_app:${batch}`,
          },
          {
            ...base,
            channel: "web_push",
            idempotency_key: `payslip:${runId}:${item.staff_id}:web_push:${batch}`,
          },
          ...(email
            ? [
                {
                  ...base,
                  channel: "email",
                  idempotency_key: `payslip:${runId}:${item.staff_id}:email:${batch}`,
                  payload: { ...base.payload, email },
                },
              ]
            : []),
        ];
      });
      if (outboxRows.length) {
        await admin.from("hr_notification_outbox").insert(outboxRows);
      }
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "payroll.run.finalize",
      entityType: "payroll_runs",
      entityId: runId,
      summary: `Finalized payroll (${run.headcount} staff, net Nu ${Number(
        run.net_total_btn,
      ).toLocaleString("en-BT")})`,
      meta: { financeExpenseId, employerCost },
    });

    revalidatePayroll(runId);
    revalidatePath("/erp/finance");
    return {
      ok: true,
      message: "Payroll finalized and posted to finance. Payslips are locked.",
    };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Something went wrong.");
  }
}

export async function cancelPayrollRun(
  _prev: PayrollActionState,
  formData: FormData,
): Promise<PayrollActionState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const runId = trimRequired(formData.get("run_id"), "Run");

    const { data: run } = await admin
      .from("payroll_runs")
      .select("id, status")
      .eq("id", runId)
      .eq("property_id", propertyId)
      .maybeSingle();
    if (!run) return fail("Payroll run not found.");
    if (run.status === "finalized") {
      return fail("Finalized runs are immutable and cannot be cancelled.");
    }

    const { error } = await admin
      .from("payroll_runs")
      .update({ status: "cancelled" })
      .eq("id", runId);
    if (error) return fail("Could not cancel the run.");

    await writeAuditEvent(admin, {
      propertyId,
      action: "payroll.run.cancel",
      entityType: "payroll_runs",
      entityId: runId,
      summary: "Cancelled payroll run",
    });

    revalidatePayroll(runId);
    return { ok: true, message: "Payroll run cancelled." };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Something went wrong.");
  }
}

// ---------------------------------------------------------------------------
// Adjustments
// ---------------------------------------------------------------------------
export async function savePayrollAdjustment(
  _prev: PayrollActionState,
  formData: FormData,
): Promise<PayrollActionState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);

    const periodId = trimRequired(formData.get("period_id"), "Period");
    const staffId = trimRequired(formData.get("staff_id"), "Staff");
    const kind = trimRequired(formData.get("kind"), "Type");
    if (!["earning", "deduction", "advance_repayment"].includes(kind)) {
      return fail("Invalid adjustment type.");
    }
    const label = trimRequired(formData.get("label"), "Label");
    const amount = Number(
      String(formData.get("amount_btn") ?? "").replace(/,/g, "").trim(),
    );
    if (!Number.isFinite(amount) || amount < 0) {
      return fail("Amount must be zero or positive.");
    }
    const taxable = formData.get("taxable") === "on";
    const code =
      optionalTrim(formData.get("code")) ??
      label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

    const { error } = await admin.from("payroll_adjustments").insert({
      property_id: propertyId,
      period_id: periodId,
      staff_id: staffId,
      kind,
      code: code || "adjustment",
      label,
      amount_btn: round2(amount),
      taxable: kind === "earning" ? taxable : false,
      notes: optionalTrim(formData.get("notes")),
      created_by: "desk",
    });
    if (error) {
      console.error("adjustment insert failed", error);
      return fail("Could not save the adjustment.");
    }

    await writeAuditEvent(admin, {
      propertyId,
      action: "payroll.adjustment.create",
      entityType: "payroll_adjustments",
      entityId: staffId,
      summary: `Added ${kind} ${label} (Nu ${amount})`,
      meta: { periodId, staffId, kind, amount },
    });

    revalidatePayroll();
    return { ok: true, message: "Adjustment saved. Recalculate the run." };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Something went wrong.");
  }
}

export async function deletePayrollAdjustment(
  _prev: PayrollActionState,
  formData: FormData,
): Promise<PayrollActionState> {
  try {
    await requireDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const id = trimRequired(formData.get("adjustment_id"), "Adjustment");

    const { error } = await admin
      .from("payroll_adjustments")
      .delete()
      .eq("id", id)
      .eq("property_id", propertyId);
    if (error) return fail("Could not remove the adjustment.");

    revalidatePayroll();
    return { ok: true, message: "Adjustment removed. Recalculate the run." };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Something went wrong.");
  }
}

export async function markPayrollItemPaid(
  _prev: PayrollActionState,
  formData: FormData,
): Promise<PayrollActionState> {
  try {
    await requireMoneyDesk();
    const admin = createSupabaseAdminClient();
    const propertyId = await resolveActivePropertyId(admin);
    const itemId = trimRequired(formData.get("item_id"), "Payslip");
    const reference = optionalTrim(formData.get("payment_reference"));

    const { data: item } = await admin
      .from("payroll_run_items")
      .select(
        "id, run_id, full_name, property_id, net_btn, payment_status",
      )
      .eq("id", itemId)
      .maybeSingle();
    if (!item) return fail("Payslip not found.");
    assertDeskProperty(propertyId, item.property_id as string, "Payslip");
    if ((item.payment_status as string) === "paid") {
      return { ok: true, message: "Already marked as paid." };
    }

    const netBtn = Number(item.net_btn ?? 0);
    if (netBtn > 0) {
      const paidOn = new Date().toISOString().slice(0, 10);
      const gl = await postPayrollPayout(admin, propertyId, {
        id: itemId,
        net_btn: netBtn,
        full_name: item.full_name as string | null,
        paid_on: paidOn,
        reference: reference ?? undefined,
      });
      if (!gl.ok) {
        return fail(gl.error ?? "Could not post payroll payout to ledger.");
      }
    }

    const { error } = await admin
      .from("payroll_run_items")
      .update({
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        payment_reference: reference,
      })
      .eq("id", itemId);
    if (error) return fail("Could not mark as paid.");

    await writeAuditEvent(admin, {
      propertyId,
      action: "payroll.item.paid",
      entityType: "payroll_run_items",
      entityId: itemId,
      summary: `Marked payslip paid for ${item.full_name}`,
      meta: { reference, netBtn },
    });

    revalidatePayroll(item.run_id as string);
    revalidatePath("/erp/finance");
    revalidatePath("/erp/finance/expenses");
    return { ok: true, message: "Marked as paid · bank ledger updated." };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Something went wrong.");
  }
}
