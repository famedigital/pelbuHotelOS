import { cancelOwnLeave } from "@/app/actions/staff-leave";
import { StaffAppShell } from "@/components/erp/StaffAppShell";
import {
  StaffLeaveRequestForm,
  type StaffLeavePolicyOption,
} from "@/components/erp/StaffLeaveRequestForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getStaffSession } from "@/lib/staff-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Leave | Pelbu Staff",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StaffLeavePage() {
  const session = await getStaffSession();
  if (!session) redirect("/staff/login");

  const admin = createSupabaseAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: policies }, { data: balances }, { data: requests }] =
    await Promise.all([
      admin
        .from("hr_leave_policies")
        .select(
          "id, code, name, allow_half_day, notice_days, evidence_after_days, accrual_frequency",
        )
        .eq("property_id", session.propertyId)
        .eq("is_active", true)
        .lte("effective_from", today)
        .or(`effective_to.is.null,effective_to.gte.${today}`)
        .order("name"),
      admin
        .from("hr_leave_balances")
        .select("leave_policy_id, balance_days")
        .eq("property_id", session.propertyId)
        .eq("staff_id", session.staffId),
      admin
        .from("staff_leave")
        .select(
          "id, leave_type, starts_on, ends_on, requested_days, status, approval_stage, decision_notes, coverage_warnings, created_at",
        )
        .eq("property_id", session.propertyId)
        .eq("staff_id", session.staffId)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  const balanceByPolicy = new Map(
    (balances ?? []).map((row) => [
      row.leave_policy_id as string,
      Number(row.balance_days),
    ]),
  );
  const policyOptions: StaffLeavePolicyOption[] = (policies ?? []).map((policy) => ({
    id: policy.id as string,
    code: policy.code as string,
    name: policy.name as string,
    allowHalfDay: Boolean(policy.allow_half_day),
    noticeDays: Number(policy.notice_days),
    evidenceAfterDays:
      policy.evidence_after_days == null ? null : Number(policy.evidence_after_days),
    balanceDays:
      ["event", "none"].includes(policy.accrual_frequency as string)
        ? null
        : (balanceByPolicy.get(policy.id as string) ?? 0),
  }));

  return (
    <StaffAppShell session={session}>
      <div className="space-y-5">
        <div>
          <Link href="/staff" className="text-sm text-muted-foreground hover:underline">
            ← Back to home
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Leave</h1>
          <p className="text-sm text-muted-foreground">
            Request leave, attach evidence, and follow supervisor and HR review.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>New request</CardTitle>
            <CardDescription>
              Working days use your published rota when available; otherwise
              weekdays and configured public holidays.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StaffLeaveRequestForm policies={policyOptions} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your requests</CardTitle>
          </CardHeader>
          <CardContent>
            {(requests ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No leave requests yet.</p>
            ) : (
              <div className="divide-y">
                {(requests ?? []).map((request) => {
                  const warnings = Array.isArray(request.coverage_warnings)
                    ? request.coverage_warnings
                    : [];
                  return (
                    <article key={request.id as string} className="space-y-2 py-4 first:pt-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium capitalize">
                          {String(request.leave_type).replaceAll("_", " ")} ·{" "}
                          {request.requested_days == null
                            ? "Pending calculation"
                            : `${Number(request.requested_days).toFixed(1)} day(s)`}
                        </p>
                        <Badge variant={request.status === "approved" ? "default" : "outline"}>
                          {request.status as string}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {request.starts_on as string} → {request.ends_on as string}
                        {request.status === "requested"
                          ? ` · ${String(request.approval_stage).replaceAll("_", " ")}`
                          : ""}
                      </p>
                      {request.decision_notes ? (
                        <p className="text-sm">{request.decision_notes as string}</p>
                      ) : null}
                      {warnings.map((warning) => (
                        <p key={String(warning)} className="text-xs text-amber-700">
                          Coverage: {String(warning)}
                        </p>
                      ))}
                      {request.status === "requested" ? (
                        <form action={cancelOwnLeave}>
                          <input
                            type="hidden"
                            name="leave_id"
                            value={request.id as string}
                          />
                          <Button type="submit" variant="outline" size="sm">
                            Cancel request
                          </Button>
                        </form>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </StaffAppShell>
  );
}
