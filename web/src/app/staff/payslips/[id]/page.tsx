import { PrintButton } from "@/components/erp/PrintButton";
import {
  PayslipDocument,
  type PayslipLine,
} from "@/components/erp/PayslipDocument";
import { Button } from "@/components/ui/button";
import { requireStaffSession } from "@/lib/staff-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Payslip | Pelbu Staff",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StaffPayslipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireStaffSession();
  const { id } = await params;
  const admin = createSupabaseAdminClient();

  const { data: item } = await admin
    .from("payroll_run_items")
    .select(
      "id, employee_code, full_name, department, position_title, bank_name, bank_account_number, provident_fund_number, tax_identifier, basic_wage_btn, lines, gross_btn, employee_pf_btn, employer_pf_btn, pit_btn, other_deductions_btn, net_btn, employer_cost_btn, payment_status, payment_reference, payroll_runs!inner(status, property_id, payroll_periods(label, period_start, period_end, pay_date))",
    )
    .eq("id", id)
    .eq("staff_id", session.staffId)
    .eq("payroll_runs.status", "finalized")
    .maybeSingle();
  if (!item) notFound();

  const run = Array.isArray(item.payroll_runs)
    ? item.payroll_runs[0]
    : item.payroll_runs;
  const period = Array.isArray(run?.payroll_periods)
    ? run?.payroll_periods[0]
    : run?.payroll_periods;

  const { data: property } = await admin
    .from("properties")
    .select("name, legal_name, address, phone, tax_id")
    .eq("id", run?.property_id as string)
    .maybeSingle();

  return (
    <div className="space-y-4 print:space-y-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href="/staff/payslips">← Payslips</Link>
        </Button>
        <PrintButton label="Print" />
      </div>
      <PayslipDocument
        property={{
          name: (property?.name as string) ?? "Hotel",
          legal_name: (property?.legal_name as string | null) ?? null,
          address: (property?.address as string | null) ?? null,
          phone: (property?.phone as string | null) ?? null,
          tax_id: (property?.tax_id as string | null) ?? null,
        }}
        data={{
          itemId: item.id as string,
          employeeCode: (item.employee_code as string | null) ?? null,
          fullName: item.full_name as string,
          department: (item.department as string | null) ?? null,
          positionTitle: (item.position_title as string | null) ?? null,
          bankName: (item.bank_name as string | null) ?? null,
          bankAccountNumber:
            (item.bank_account_number as string | null) ?? null,
          providentFundNumber:
            (item.provident_fund_number as string | null) ?? null,
          taxIdentifier: (item.tax_identifier as string | null) ?? null,
          periodLabel: (period?.label as string) ?? "Payroll",
          periodStart: (period?.period_start as string) ?? "",
          periodEnd: (period?.period_end as string) ?? "",
          payDate: (period?.pay_date as string | null) ?? null,
          basicWage: Number(item.basic_wage_btn ?? 0),
          lines: (item.lines as PayslipLine[] | null) ?? [],
          gross: Number(item.gross_btn ?? 0),
          employeePf: Number(item.employee_pf_btn ?? 0),
          employerPf: Number(item.employer_pf_btn ?? 0),
          pit: Number(item.pit_btn ?? 0),
          otherDeductions: Number(item.other_deductions_btn ?? 0),
          net: Number(item.net_btn ?? 0),
          employerCost: Number(item.employer_cost_btn ?? 0),
          paymentStatus: item.payment_status as string,
          paymentReference:
            (item.payment_reference as string | null) ?? null,
        }}
      />
    </div>
  );
}
