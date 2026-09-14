import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvResponse(filename: string, header: string[], rows: string[][]) {
  const csv =
    [header.join(","), ...rows.map((r) => r.join(","))].join("\n") + "\n";
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/**
 * Payroll compliance / finance exports for a single finalized run.
 * kind = bank | pit | pf | register
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isDeskAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: runId } = await context.params;
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "bank";

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);

  const { data: run } = await admin
    .from("payroll_runs")
    .select(
      "id, status, sequence, payroll_periods(label, period_start, period_end, pay_date)",
    )
    .eq("id", runId)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  if (run.status !== "finalized" && kind !== "register") {
    return NextResponse.json(
      { error: "Export available after the run is finalized." },
      { status: 400 },
    );
  }

  const period = Array.isArray(run.payroll_periods)
    ? run.payroll_periods[0]
    : run.payroll_periods;
  const periodLabel = String(period?.label ?? "payroll")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

  const { data: items } = await admin
    .from("payroll_run_items")
    .select(
      "employee_code, full_name, department, bank_name, bank_account_number, provident_fund_number, tax_identifier, basic_wage_btn, gross_btn, taxable_btn, employee_pf_btn, employer_pf_btn, pit_btn, other_deductions_btn, net_btn, employer_cost_btn, payment_status, payment_reference",
    )
    .eq("run_id", runId)
    .order("full_name");

  const list = items ?? [];

  if (kind === "bank") {
    const header = [
      "employee_code",
      "full_name",
      "bank_name",
      "bank_account_number",
      "net_btn",
      "payment_reference",
      "period_label",
      "pay_date",
    ];
    const rows = list.map((r) =>
      [
        r.employee_code,
        r.full_name,
        r.bank_name,
        r.bank_account_number,
        r.net_btn,
        r.payment_reference,
        period?.label,
        period?.pay_date,
      ].map(csvEscape),
    );
    return csvResponse(`pelbu-payroll-bank-${periodLabel}.csv`, header, rows);
  }

  if (kind === "pit") {
    const header = [
      "employee_code",
      "full_name",
      "tax_identifier",
      "taxable_btn",
      "pit_tds_btn",
      "period_start",
      "period_end",
    ];
    const rows = list.map((r) =>
      [
        r.employee_code,
        r.full_name,
        r.tax_identifier,
        r.taxable_btn,
        r.pit_btn,
        period?.period_start,
        period?.period_end,
      ].map(csvEscape),
    );
    return csvResponse(`pelbu-payroll-pit-${periodLabel}.csv`, header, rows);
  }

  if (kind === "pf") {
    const header = [
      "employee_code",
      "full_name",
      "provident_fund_number",
      "basic_wage_btn",
      "employee_pf_btn",
      "employer_pf_btn",
      "total_pf_btn",
      "period_start",
      "period_end",
    ];
    const rows = list.map((r) =>
      [
        r.employee_code,
        r.full_name,
        r.provident_fund_number,
        r.basic_wage_btn,
        r.employee_pf_btn,
        r.employer_pf_btn,
        Number(r.employee_pf_btn ?? 0) + Number(r.employer_pf_btn ?? 0),
        period?.period_start,
        period?.period_end,
      ].map(csvEscape),
    );
    return csvResponse(`pelbu-payroll-pf-${periodLabel}.csv`, header, rows);
  }

  // Full payroll register (available even before finalize for review).
  const header = [
    "employee_code",
    "full_name",
    "department",
    "basic_wage_btn",
    "gross_btn",
    "taxable_btn",
    "employee_pf_btn",
    "employer_pf_btn",
    "pit_btn",
    "other_deductions_btn",
    "net_btn",
    "employer_cost_btn",
    "payment_status",
  ];
  const rows = list.map((r) => header.map((h) => csvEscape((r as Record<string, unknown>)[h])));
  return csvResponse(`pelbu-payroll-register-${periodLabel}.csv`, header, rows);
}
