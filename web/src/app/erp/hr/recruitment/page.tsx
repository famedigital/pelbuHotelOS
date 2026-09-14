import {
  ProvisionStaffForm,
  ProvisionalDecisionForm,
} from "@/components/erp/RecruitmentForms";
import { PrintButton } from "@/components/erp/PrintButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { fmtDate, thimphuToday } from "@/lib/erp-lists";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Recruitment | Hotel OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ErpHrRecruitmentPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const today = thimphuToday();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [
    { data: provisional },
    { data: recentEvents },
    { data: staffDepartments },
  ] = await Promise.all([
    admin
      .from("staff_members")
      .select(
        "id, employee_code, full_name, role_label, department, position_title, employment_type, phone, hired_on, probation_ends_on, notes, created_at",
      )
      .eq("property_id", propertyId)
      .eq("status", "provisional")
      .order("hired_on", { ascending: true, nullsFirst: false })
      .limit(200),
    admin
      .from("staff_employment_events")
      .select(
        "id, event_type, effective_on, summary, created_at, staff_id, staff_members(full_name, employee_code)",
      )
      .eq("property_id", propertyId)
      .in("event_type", ["provisional", "confirmation", "termination", "hire"])
      .gte("effective_on", monthStart)
      .order("effective_on", { ascending: false })
      .limit(60),
    admin
      .from("staff_members")
      .select("department")
      .eq("property_id", propertyId)
      .not("department", "is", null)
      .limit(500),
  ]);

  const departments = Array.from(
    new Set(
      (staffDepartments ?? [])
        .map((r) => r.department as string | null)
        .filter((d): d is string => Boolean(d?.trim())),
    ),
  ).sort();

  const overdue = (provisional ?? []).filter(
    (row) =>
      row.probation_ends_on &&
      (row.probation_ends_on as string) < today,
  ).length;

  return (
    <div className="erp mx-auto w-full max-w-[1100px] space-y-8 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
            HR · Recruitment
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Provision → Hire or terminate
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Onboard staff as provisional. After probation, confirm hire (active)
            or terminate — with a printable report pack for the property.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/erp/hr">← Staff directory</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/erp/hr/recruitment/print?kind=pipeline">
              Print pipeline
            </Link>
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link
              href={`/erp/hr/recruitment/print?kind=movements&from=${monthStart}&to=${today}`}
            >
              Print month report
            </Link>
          </Button>
        </div>
      </header>

      <section
        className="grid gap-4 sm:grid-cols-3"
        aria-label="Recruitment overview"
      >
        <Card className="gap-2 py-5">
          <CardContent>
            <p className="text-sm text-muted-foreground">In pipeline</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {(provisional ?? []).length}
            </p>
          </CardContent>
        </Card>
        <Card className="gap-2 py-5">
          <CardContent>
            <p className="text-sm text-muted-foreground">Probation overdue</p>
            <p
              className={`mt-1 text-3xl font-semibold tabular-nums ${
                overdue > 0 ? "text-destructive" : ""
              }`}
            >
              {overdue}
            </p>
          </CardContent>
        </Card>
        <Card className="gap-2 py-5">
          <CardContent>
            <p className="text-sm text-muted-foreground">Events this month</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {(recentEvents ?? []).length}
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Provision new staff</CardTitle>
          <CardDescription>
            Creates a provisional record (not on active headcount until confirmed).
            Complete dossiers, PIN, and pay on Staff after hire.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProvisionStaffForm departments={departments} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Provisional pipeline</CardTitle>
            <CardDescription>
              Confirm hire or terminate when probation (or offer period) ends.
            </CardDescription>
          </div>
          <PrintButton label="Print this list" />
        </CardHeader>
        <CardContent className="space-y-6">
          {(provisional ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No provisional staff. Provision a hire above to start the pipeline.
            </p>
          ) : (
            (provisional ?? []).map((row) => {
              const probation = row.probation_ends_on as string | null;
              const pastDue = Boolean(probation && probation < today);
              return (
                <article
                  key={row.id as string}
                  className="space-y-3 border-b pb-6 last:border-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">
                          {row.full_name as string}
                        </h3>
                        <Badge variant="outline">
                          {row.employee_code as string}
                        </Badge>
                        <Badge variant="secondary">provisional</Badge>
                        {pastDue ? (
                          <Badge variant="destructive">probation overdue</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {(row.position_title as string | null) ||
                          (row.role_label as string)}
                        {row.department
                          ? ` · ${row.department as string}`
                          : ""}
                        {" · "}
                        {(row.employment_type as string).replaceAll("_", " ")}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Provisioned {fmtDate(row.hired_on as string | null)}
                        {probation
                          ? ` · probation ends ${fmtDate(probation)}`
                          : ""}
                        {row.phone ? ` · ${row.phone as string}` : ""}
                      </p>
                      {row.notes ? (
                        <p className="mt-2 text-sm whitespace-pre-wrap text-foreground">
                          {row.notes as string}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="print:hidden">
                    <ProvisionalDecisionForm
                      staffId={row.id as string}
                      staffName={row.full_name as string}
                    />
                  </div>
                </article>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>This month’s movements</CardTitle>
          <CardDescription>
            Provision, confirmation (hire), and termination events — use month
            report for a clean printout.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(recentEvents ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recruitment events for {today.slice(0, 7)} yet.
            </p>
          ) : (
            <ul className="divide-y">
              {(recentEvents ?? []).map((ev) => {
                const sm = Array.isArray(ev.staff_members)
                  ? ev.staff_members[0]
                  : ev.staff_members;
                const name =
                  (sm as { full_name?: string } | null)?.full_name ?? "Staff";
                const code =
                  (sm as { employee_code?: string } | null)?.employee_code ?? "";
                return (
                  <li
                    key={ev.id as string}
                    className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm first:pt-0"
                  >
                    <div>
                      <span className="font-medium">{name}</span>
                      {code ? (
                        <span className="text-muted-foreground"> · {code}</span>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        {ev.summary as string}
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <Badge variant="outline" className="mb-1">
                        {ev.event_type as string}
                      </Badge>
                      <p className="tabular-nums">
                        {fmtDate(ev.effective_on as string)}
                      </p>
                    </div>
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
