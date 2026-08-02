import {
  DeleteAdjustmentButton,
  MarkPaidForm,
  PayrollAdjustmentForm,
  PayrollRunActions,
} from "@/components/erp/PayrollForms";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { formatBtn } from "@/lib/pricing";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Payroll run | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type PayLine = {
  kind: "earning" | "deduction" | "employer_cost";
  code: string;
  label: string;
  amount: number;
  taxable: boolean;
};

export default async function PayrollRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);

  const { data: run } = await admin
    .from("payroll_runs")
    .select(
      "id, sequence, status, headcount, gross_total_btn, deduction_total_btn, net_total_btn, pit_total_btn, employee_pf_total_btn, employer_pf_total_btn, employer_cost_total_btn, calculated_at, approved_at, finalized_at, period_id, payroll_periods(label, period_start, period_end, pay_date)",
    )
    .eq("id", id)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (!run) notFound();

  const periodId = run.period_id as string;
  const periodInfo = Array.isArray(run.payroll_periods)
    ? run.payroll_periods[0]
    : run.payroll_periods;

  const [{ data: items }, { data: adjustments }, { data: staff }] =
    await Promise.all([
      admin
        .from("payroll_run_items")
        .select(
          "id, full_name, employee_code, department, gross_btn, employee_pf_btn, pit_btn, other_deductions_btn, net_btn, employer_cost_btn, payment_status, payment_reference, lines",
        )
        .eq("run_id", id)
        .order("full_name"),
      admin
        .from("payroll_adjustments")
        .select("id, staff_id, kind, label, amount_btn, taxable")
        .eq("period_id", periodId)
        .order("created_at", { ascending: false }),
      admin
        .from("staff_members")
        .select("id, full_name, employee_code")
        .eq("property_id", propertyId)
        .in("status", ["active", "on_leave"])
        .order("full_name"),
    ]);

  const itemList = items ?? [];
  const adjustmentList = adjustments ?? [];
  const staffOptions = (staff ?? []).map((s) => ({
    id: s.id as string,
    label: `${s.full_name}${s.employee_code ? ` (${s.employee_code})` : ""}`,
  }));
  const staffNameById = new Map(
    (staff ?? []).map((s) => [s.id as string, s.full_name as string]),
  );

  const status = run.status as string;
  const editable = status === "draft" || status === "calculated";
  const finalized = status === "finalized";

  return (
    <div className="erp mx-auto w-full max-w-[1200px] space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Link
            href="/erp/hr/payroll"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            ← All payroll
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {periodInfo?.label ?? "Payroll run"}{" "}
            <span className="text-base text-muted-foreground">
              #{run.sequence as number}
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {periodInfo?.period_start} → {periodInfo?.period_end}
            {periodInfo?.pay_date ? ` · pay ${periodInfo.pay_date}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge variant={finalized ? "default" : "secondary"}>{status}</Badge>
          <PayrollRunActions runId={id} status={status} />
          <div className="flex flex-wrap justify-end gap-2 text-xs">
            <a
              className="underline-offset-4 hover:underline"
              href={`/api/erp/hr/payroll/${id}/export?kind=register`}
            >
              Register CSV
            </a>
            {finalized ? (
              <>
                <a
                  className="underline-offset-4 hover:underline"
                  href={`/api/erp/hr/payroll/${id}/export?kind=bank`}
                >
                  Bank transfer
                </a>
                <a
                  className="underline-offset-4 hover:underline"
                  href={`/api/erp/hr/payroll/${id}/export?kind=pit`}
                >
                  PIT / TDS
                </a>
                <a
                  className="underline-offset-4 hover:underline"
                  href={`/api/erp/hr/payroll/${id}/export?kind=pf`}
                >
                  NPPF schedule
                </a>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        {[
          ["Staff", String(run.headcount ?? 0)],
          ["Gross", formatBtn(Number(run.gross_total_btn ?? 0))],
          ["Employee PF", formatBtn(Number(run.employee_pf_total_btn ?? 0))],
          ["PIT (TDS)", formatBtn(Number(run.pit_total_btn ?? 0))],
          ["Net pay", formatBtn(Number(run.net_total_btn ?? 0))],
          ["Employer PF", formatBtn(Number(run.employer_pf_total_btn ?? 0))],
          ["Employer cost", formatBtn(Number(run.employer_cost_total_btn ?? 0))],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-lg font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payslips</CardTitle>
          <CardDescription>
            {itemList.length} staff · line breakdown snapshotted at calculation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {itemList.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No payslips yet. Calculate the run to generate them.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">PF</TableHead>
                  <TableHead className="text-right">PIT</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead>Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemList.map((item) => {
                  const lines = (item.lines as PayLine[] | null) ?? [];
                  return (
                    <TableRow key={item.id as string}>
                      <TableCell>
                        <div className="font-medium">
                          {item.full_name as string}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {(item.employee_code as string) ?? "—"}
                          {item.department ? ` · ${item.department}` : ""}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {lines
                            .filter((l) => l.kind !== "employer_cost")
                            .map((l, i) => (
                              <span
                                key={`${l.code}-${i}`}
                                className="rounded bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground"
                                title={l.label}
                              >
                                {l.kind === "deduction" ? "−" : "+"}
                                {formatBtn(l.amount)}
                              </span>
                            ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatBtn(Number(item.gross_btn ?? 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatBtn(Number(item.employee_pf_btn ?? 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatBtn(Number(item.pit_btn ?? 0))}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        <div>{formatBtn(Number(item.net_btn ?? 0))}</div>
                        <Link
                          href={`/erp/hr/payroll/${id}/payslip/${item.id}`}
                          className="text-xs font-normal text-muted-foreground underline-offset-4 hover:underline"
                        >
                          View payslip
                        </Link>
                      </TableCell>
                      <TableCell>
                        {item.payment_status === "paid" ? (
                          <span className="text-xs text-emerald-700">
                            Paid{" "}
                            {item.payment_reference
                              ? `· ${item.payment_reference}`
                              : ""}
                          </span>
                        ) : finalized ? (
                          <MarkPaidForm itemId={item.id as string} />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Pending
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editable ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Add adjustment</CardTitle>
              <CardDescription>
                One-off bonuses, allowances, deductions or advance repayments for
                this period. Recalculate to apply.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PayrollAdjustmentForm periodId={periodId} staff={staffOptions} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Period adjustments</CardTitle>
              <CardDescription>
                {adjustmentList.length} applied to this period.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {adjustmentList.length === 0 ? (
                <p className="text-sm text-muted-foreground">None yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adjustmentList.map((adj) => (
                      <TableRow key={adj.id as string}>
                        <TableCell>
                          {staffNameById.get(adj.staff_id as string) ?? "—"}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {adj.kind as string}
                          </span>
                          <div>{adj.label as string}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatBtn(Number(adj.amount_btn ?? 0))}
                        </TableCell>
                        <TableCell className="text-right">
                          <DeleteAdjustmentButton id={adj.id as string} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
