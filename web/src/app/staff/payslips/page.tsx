import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatBtn } from "@/lib/pricing";
import { requireStaffSession } from "@/lib/staff-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Payslips | Pelbu Staff",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StaffPayslipsPage() {
  const session = await requireStaffSession();
  const admin = createSupabaseAdminClient();

  const { data: items } = await admin
    .from("payroll_run_items")
    .select(
      "id, run_id, net_btn, gross_btn, payment_status, created_at, payroll_runs!inner(status, finalized_at, payroll_periods(label, period_start, period_end))",
    )
    .eq("staff_id", session.staffId)
    .eq("payroll_runs.status", "finalized")
    .order("created_at", { ascending: false })
    .limit(36);

  const list = items ?? [];

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Payslips</h1>
        <p className="text-sm text-muted-foreground">
          Finalized payslips for your account. Open any row to view or print.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>
            {list.length === 0
              ? "No finalized payslips yet."
              : `${list.length} payslip${list.length === 1 ? "" : "s"}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? null : (
            <ul className="divide-y">
              {list.map((item) => {
                const run = Array.isArray(item.payroll_runs)
                  ? item.payroll_runs[0]
                  : item.payroll_runs;
                const period = Array.isArray(run?.payroll_periods)
                  ? run?.payroll_periods[0]
                  : run?.payroll_periods;
                return (
                  <li key={item.id as string} className="py-3">
                    <Link
                      href={`/staff/payslips/${item.id}`}
                      className="flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-medium">
                          {(period?.label as string) ?? "Payslip"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {period?.period_start} → {period?.period_end}
                          {item.payment_status === "paid" ? " · paid" : ""}
                        </p>
                      </div>
                      <p className="font-semibold">
                        {formatBtn(Number(item.net_btn ?? 0))}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
