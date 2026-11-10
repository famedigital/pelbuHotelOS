import {
  PayrollPeriodForm,
  PayrollRunCreateForm,
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
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Payroll",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "outline",
  calculated: "secondary",
  approved: "default",
  finalized: "default",
  cancelled: "destructive",
};

export default async function PayrollPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);

  const [{ data: periods }, { data: runs }, { data: ruleSets }] =
    await Promise.all([
      admin
        .from("payroll_periods")
        .select("id, label, period_start, period_end, pay_date, status")
        .eq("property_id", propertyId)
        .order("period_start", { ascending: false })
        .limit(24),
      admin
        .from("payroll_runs")
        .select(
          "id, sequence, status, headcount, gross_total_btn, net_total_btn, pit_total_btn, employee_pf_total_btn, employer_cost_total_btn, created_at, payroll_periods(label)",
        )
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false })
        .limit(24),
      admin
        .from("payroll_rule_sets")
        .select(
          "id, name, effective_from, effective_to, pf_employee_rate, pf_employer_rate, is_active",
        )
        .eq("property_id", propertyId)
        .order("effective_from", { ascending: false }),
    ]);

  const periodList = periods ?? [];
  const runList = runs ?? [];
  const ruleList = ruleSets ?? [];

  const periodLabel = (value: unknown): string => {
    if (Array.isArray(value))
      return (value[0] as { label?: string } | undefined)?.label ?? "—";
    return (value as { label?: string } | null)?.label ?? "—";
  };

  return (
    <div className="erp mx-auto w-full max-w-[1200px] space-y-6 p-4 md:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
        <p className="text-sm text-muted-foreground">
          Versioned Bhutan payroll — NPPF 5% + 5%, PIT 2025 slabs. Runs are
          immutable once finalized and post to finance automatically.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>New period</CardTitle>
            <CardDescription>
              Define the pay period, then create a run against it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PayrollPeriodForm />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Payroll runs</CardTitle>
            <CardDescription>
              <PayrollRunCreateForm periods={periodList} />
            </CardDescription>
          </CardHeader>
          <CardContent>
            {runList.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No runs yet. Create a period and start a run.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Staff</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runList.map((run) => (
                    <TableRow key={run.id as string}>
                      <TableCell className="font-medium">
                        {periodLabel(run.payroll_periods)}
                        <span className="ml-1 text-xs text-muted-foreground">
                          #{run.sequence as number}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            STATUS_TONE[run.status as string] ?? "outline"
                          }
                        >
                          {run.status as string}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {run.headcount as number}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatBtn(Number(run.gross_total_btn ?? 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatBtn(Number(run.net_total_btn ?? 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/erp/hr/payroll/${run.id}`}
                          className="text-sm font-medium text-ink underline-offset-4 hover:underline"
                        >
                          Open
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rule sets</CardTitle>
          <CardDescription>
            Effective-dated statutory rules. Finalized runs snapshot the rule set
            in force, so history stays reproducible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Effective</TableHead>
                <TableHead className="text-right">Employee PF</TableHead>
                <TableHead className="text-right">Employer PF</TableHead>
                <TableHead>State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ruleList.map((rule) => (
                <TableRow key={rule.id as string}>
                  <TableCell className="font-medium">
                    {rule.name as string}
                  </TableCell>
                  <TableCell>
                    {rule.effective_from as string}
                    {rule.effective_to ? ` → ${rule.effective_to}` : " → open"}
                  </TableCell>
                  <TableCell className="text-right">
                    {(Number(rule.pf_employee_rate) * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right">
                    {(Number(rule.pf_employer_rate) * 100).toFixed(1)}%
                  </TableCell>
                  <TableCell>
                    <Badge variant={rule.is_active ? "default" : "outline"}>
                      {rule.is_active ? "active" : "retired"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
