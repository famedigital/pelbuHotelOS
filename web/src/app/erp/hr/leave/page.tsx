import { LeaveAccrualRefreshButton } from "@/components/erp/LeaveAccrualRefreshButton";
import { LeaveBlackoutForm } from "@/components/erp/LeaveBlackoutForm";
import { LeavePolicyVersionForm } from "@/components/erp/LeavePolicyVersionForm";
import { LeaveReviewForm } from "@/components/erp/HrFoundationForms";
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
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Leave",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type StaffEmbed = {
  full_name: string;
  employee_code: string;
  department: string | null;
};

function oneStaff(value: unknown): StaffEmbed | null {
  if (Array.isArray(value)) return (value[0] as StaffEmbed | undefined) ?? null;
  return (value as StaffEmbed | null) ?? null;
}

export default async function ErpLeavePage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: policies },
    { data: pending },
    { data: balances },
    { data: departmentRows },
    { data: blackouts },
  ] =
    await Promise.all([
      admin
        .from("hr_leave_policies")
        .select(
          "id, code, name, unit, accrual_frequency, accrual_days, minimum_service_months, starts_after_probation, allow_half_day, paid_rate, notice_days, evidence_after_days, encashable, effective_from",
        )
        .eq("property_id", propertyId)
        .eq("is_active", true)
        .lte("effective_from", today)
        .or(`effective_to.is.null,effective_to.gte.${today}`)
        .order("name"),
      admin
        .from("staff_leave")
        .select(
          "id, leave_type, requested_days, starts_on, ends_on, start_period, end_period, approval_stage, notes, supervisor_notes, coverage_warnings, payroll_impact, staff_members(full_name, employee_code, department), hr_leave_attachments(id, file_name, storage_path)",
        )
        .eq("property_id", propertyId)
        .eq("status", "requested")
        .order("starts_on"),
      admin
        .from("hr_leave_balances")
        .select(
          "balance_days, staff_members(full_name, employee_code), hr_leave_policies(name, code)",
        )
        .eq("property_id", propertyId)
        .order("balance_days", { ascending: true }),
      admin
        .from("staff_members")
        .select("department")
        .eq("property_id", propertyId)
        .in("status", ["active", "on_leave"])
        .not("department", "is", null),
      admin
        .from("hr_leave_blackouts")
        .select("id, name, starts_on, ends_on, department, reason, is_hard_block")
        .eq("property_id", propertyId)
        .gte("ends_on", today)
        .order("starts_on"),
    ]);

  const attachmentPaths = (pending ?? []).flatMap((request) =>
    (
      request.hr_leave_attachments as
        | Array<{ storage_path?: string }>
        | null
    )?.flatMap((attachment) =>
      attachment.storage_path ? [attachment.storage_path] : [],
    ) ?? [],
  );
  const signedAttachmentUrls = new Map<string, string>();
  if (attachmentPaths.length) {
    const { data: signed } = await admin.storage
      .from("hr-private")
      .createSignedUrls(attachmentPaths, 10 * 60);
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl) {
        signedAttachmentUrls.set(item.path, item.signedUrl);
      }
    }
  }
  const departments = Array.from(
    new Set(
      (departmentRows ?? [])
        .map((row) => row.department as string | null)
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort();

  return (
    <div className="erp mx-auto w-full max-w-[1200px] space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/erp/hr" className="hover:underline">
              HR
            </Link>{" "}
            / Leave
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Leave management</h1>
          <p className="text-sm text-muted-foreground">
            Bhutan policy balances, coverage checks, supervisor review, and HR
            final approval.
          </p>
        </div>
        <LeaveAccrualRefreshButton />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Pending approvals</CardTitle>
          <CardDescription>
            Supervisor approval advances a request to HR. HR approval posts the
            immutable balance ledger.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(pending ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending requests.</p>
          ) : (
            <div className="divide-y">
              {(pending ?? []).map((request) => {
                const staff = oneStaff(request.staff_members);
                const warnings = Array.isArray(request.coverage_warnings)
                  ? request.coverage_warnings
                  : [];
                const attachments =
                  (request.hr_leave_attachments as
                    | Array<{
                        id?: string;
                        file_name?: string;
                        storage_path?: string;
                      }>
                    | null) ?? [];
                return (
                  <article key={request.id as string} className="space-y-2 py-4 first:pt-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium">
                        {staff?.full_name ?? "Unknown staff"} ·{" "}
                        {String(request.leave_type).replaceAll("_", " ")}
                      </h2>
                      <Badge variant="outline">
                        {String(request.approval_stage).replaceAll("_", " ")}
                      </Badge>
                      <Badge variant="secondary">
                        {Number(request.requested_days ?? 0).toFixed(1)} days
                      </Badge>
                      {attachments.length ? (
                        <Badge variant="outline">
                          {attachments.length} attachment
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {staff?.employee_code} · {staff?.department ?? "No department"} ·{" "}
                      {request.starts_on as string} → {request.ends_on as string} ·{" "}
                      {request.payroll_impact as string}
                    </p>
                    {request.notes ? (
                      <p className="text-sm">{request.notes as string}</p>
                    ) : null}
                    {request.supervisor_notes ? (
                      <p className="text-sm">
                        Supervisor note: {request.supervisor_notes as string}
                      </p>
                    ) : null}
                    {warnings.map((warning) => (
                      <p key={String(warning)} className="text-xs text-amber-700">
                        Coverage: {String(warning)}
                      </p>
                    ))}
                    {attachments.length ? (
                      <div className="flex flex-wrap gap-2">
                        {attachments.map((attachment) => {
                          const url = attachment.storage_path
                            ? signedAttachmentUrls.get(attachment.storage_path)
                            : null;
                          return url ? (
                            <a
                              key={attachment.id ?? attachment.storage_path}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-medium text-accent underline"
                            >
                              {attachment.file_name ?? "View evidence"}
                            </a>
                          ) : null;
                        })}
                      </div>
                    ) : null}
                    <LeaveReviewForm leaveId={request.id as string} />
                  </article>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coverage blackout periods</CardTitle>
          <CardDescription>
            Apply to all staff, a department, or a leave type. Soft blackouts
            warn reviewers; hard blackouts stop submission.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <LeaveBlackoutForm
            policies={(policies ?? []).map((policy) => ({
              id: policy.id as string,
              name: policy.name as string,
            }))}
            departments={departments}
          />
          {(blackouts ?? []).length ? (
            <div className="divide-y">
              {(blackouts ?? []).map((blackout) => (
                <div key={blackout.id as string} className="py-2 text-sm">
                  <span className="font-medium">{blackout.name as string}</span>{" "}
                  <span className="text-muted-foreground">
                    {blackout.starts_on as string} → {blackout.ends_on as string}
                    {blackout.department
                      ? ` · ${blackout.department as string}`
                      : " · all departments"}
                    {blackout.is_hard_block ? " · hard block" : " · warning"}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {blackout.reason as string}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Effective policies</CardTitle>
          <CardDescription>
            Versioned statutory minimums sourced from Bhutan&apos;s Regulation on
            Working Conditions 2022. More advantageous hotel policies can be
            added as later effective versions.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Policy</TableHead>
                <TableHead>Accrual / entitlement</TableHead>
                <TableHead>Eligibility</TableHead>
                <TableHead>Rules</TableHead>
                <TableHead>Version</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(policies ?? []).map((policy) => (
                <TableRow key={policy.id as string}>
                  <TableCell>
                    <p className="font-medium">{policy.name as string}</p>
                    <p className="text-xs text-muted-foreground">
                      {policy.code as string} · from {policy.effective_from as string}
                    </p>
                  </TableCell>
                  <TableCell>
                    {policy.accrual_frequency === "none"
                      ? "Discretionary"
                      : `${Number(policy.accrual_days)} days · ${policy.accrual_frequency as string}`}
                  </TableCell>
                  <TableCell>
                    {policy.starts_after_probation
                      ? "After probation"
                      : Number(policy.minimum_service_months) > 0
                        ? `${Number(policy.minimum_service_months)} months’ service`
                        : "From employment"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {Number(policy.paid_rate) * 100}% paid
                    {policy.allow_half_day ? " · half-days" : ""}
                    {Number(policy.notice_days) > 0
                      ? ` · ${Number(policy.notice_days)} days’ notice`
                      : ""}
                    {policy.encashable ? " · encashable" : ""}
                  </TableCell>
                  <TableCell>
                    <LeavePolicyVersionForm
                      policy={{
                        id: policy.id as string,
                        name: policy.name as string,
                        accrualDays: Number(policy.accrual_days),
                        noticeDays: Number(policy.notice_days),
                        paidRate: Number(policy.paid_rate),
                        allowHalfDay: Boolean(policy.allow_half_day),
                        encashable: Boolean(policy.encashable),
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current balances</CardTitle>
          <CardDescription>
            Accrual and approved leave are derived from the append-only ledger.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {(balances ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No balances yet. Refresh statutory accruals to initialize eligible staff.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Policy</TableHead>
                  <TableHead className="text-right">Available days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(balances ?? []).map((balance, index) => {
                  const staff = oneStaff(balance.staff_members);
                  const policyValue = Array.isArray(balance.hr_leave_policies)
                    ? balance.hr_leave_policies[0]
                    : balance.hr_leave_policies;
                  const policy = policyValue as
                    | { name?: string; code?: string }
                    | null;
                  return (
                    <TableRow key={`${staff?.employee_code ?? "staff"}-${policy?.code ?? index}`}>
                      <TableCell>
                        {staff?.full_name ?? "Unknown"}{" "}
                        <span className="text-xs text-muted-foreground">
                          {staff?.employee_code}
                        </span>
                      </TableCell>
                      <TableCell>{policy?.name ?? "Policy"}</TableCell>
                      <TableCell className="text-right font-medium">
                        {Number(balance.balance_days).toFixed(1)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
