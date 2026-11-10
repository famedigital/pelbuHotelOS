import { PrintButton } from "@/components/erp/PrintButton";
import {
  PayslipDocument,
  type PayslipLine,
} from "@/components/erp/PayslipDocument";
import { Button } from "@/components/ui/button";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Payslip",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DeskPayslipPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { id, itemId } = await params;
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);

  const [{ data: item }, { data: run }, { data: property }] = await Promise.all([
    admin
      .from("payroll_run_items")
      .select(
        "id, run_id, employee_code, full_name, department, position_title, bank_name, bank_account_number, provident_fund_number, tax_identifier, basic_wage_btn, lines, gross_btn, employee_pf_btn, employer_pf_btn, pit_btn, other_deductions_btn, net_btn, employer_cost_btn, payment_status, payment_reference",
      )
      .eq("id", itemId)
      .eq("run_id", id)
      .eq("property_id", propertyId)
      .maybeSingle(),
    admin
      .from("payroll_runs")
      .select(
        "id, status, payroll_periods(label, period_start, period_end, pay_date)",
      )
      .eq("id", id)
      .eq("property_id", propertyId)
      .maybeSingle(),
    admin
      .from("properties")
      .select("name, legal_name, address, phone, tax_id")
      .eq("id", propertyId)
      .maybeSingle(),
  ]);

  if (!item || !run || !property) notFound();

  const period = Array.isArray(run.payroll_periods)
    ? run.payroll_periods[0]
    : run.payroll_periods;

  return (
    <div className="erp mx-auto w-full max-w-[1200px] space-y-4 p-4 md:p-6 print:max-w-none print:space-y-0 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/erp/hr/payroll/${id}`}>← Back to run</Link>
        </Button>
        <PrintButton label="Print payslip" />
      </div>
      <PayslipDocument
        property={{
          name: (property.name as string) ?? "Hotel",
          legal_name: (property.legal_name as string | null) ?? null,
          address: (property.address as string | null) ?? null,
          phone: (property.phone as string | null) ?? null,
          tax_id: (property.tax_id as string | null) ?? null,
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
