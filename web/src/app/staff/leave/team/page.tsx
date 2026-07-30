import { StaffAppShell } from "@/components/erp/StaffAppShell";
import { TeamLeaveReviewForm } from "@/components/erp/TeamLeaveReviewForm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStaffSession } from "@/lib/staff-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Team leave | Pelbu Staff",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type TeamStaff = {
  full_name: string;
  employee_code: string;
  department: string | null;
  manager_id: string | null;
};

export default async function TeamLeavePage() {
  const session = await getStaffSession();
  if (!session) redirect("/staff/login");
  if (!["supervisor", "hr_admin", "owner"].includes(session.accessLevel)) {
    notFound();
  }

  const admin = createSupabaseAdminClient();
  let query = admin
    .from("staff_leave")
    .select(
      "id, leave_type, starts_on, ends_on, requested_days, notes, coverage_warnings, staff_members!inner(full_name, employee_code, department, manager_id)",
    )
    .eq("property_id", session.propertyId)
    .eq("status", "requested")
    .eq("approval_stage", "supervisor_review")
    .order("starts_on");
  if (session.accessLevel === "supervisor") {
    query = query.eq("staff_members.manager_id", session.staffId);
  }
  const { data: requests } = await query;

  return (
    <StaffAppShell session={session}>
      <div className="space-y-5">
        <div>
          <Link
            href="/staff/leave"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Leave
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Team leave</h1>
          <p className="text-sm text-muted-foreground">
            Supervisor review sends approved requests to HR for the final balance
            and payroll decision.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Awaiting your review</CardTitle>
          </CardHeader>
          <CardContent>
            {(requests ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No team requests pending.</p>
            ) : (
              <div className="divide-y">
                {(requests ?? []).map((request) => {
                  const relation = request.staff_members as
                    | TeamStaff
                    | TeamStaff[]
                    | null;
                  const staff = Array.isArray(relation) ? relation[0] : relation;
                  const warnings = Array.isArray(request.coverage_warnings)
                    ? request.coverage_warnings
                    : [];
                  return (
                    <article key={request.id as string} className="py-4 first:pt-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-medium">{staff?.full_name ?? "Unknown"}</h2>
                        <Badge variant="outline">
                          {String(request.leave_type).replaceAll("_", " ")}
                        </Badge>
                        <Badge variant="secondary">
                          {Number(request.requested_days ?? 0).toFixed(1)} days
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {staff?.employee_code} · {staff?.department ?? "No department"} ·{" "}
                        {request.starts_on as string} → {request.ends_on as string}
                      </p>
                      {request.notes ? (
                        <p className="mt-2 text-sm">{request.notes as string}</p>
                      ) : null}
                      {warnings.map((warning) => (
                        <p key={String(warning)} className="mt-1 text-xs text-amber-700">
                          Coverage: {String(warning)}
                        </p>
                      ))}
                      <TeamLeaveReviewForm leaveId={request.id as string} />
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
