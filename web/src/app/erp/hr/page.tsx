import {
  StaffShiftForm,
  type StaffOption,
} from "@/components/erp/OpsForms";
import {
  AnnouncementCreateForm,
  LeaveReviewForm,
  StaffCreateForm,
  StaffCsvImportForm,
  StaffStatusForm,
} from "@/components/erp/HrFoundationForms";
import { StaffPinProvisionForm } from "@/components/erp/StaffAuthForms";
import { NoticeReminderButton } from "@/components/erp/NoticeReminderButton";
import {
  StaffDirectoryTable,
  type StaffDirectoryRow,
} from "@/components/erp/StaffDirectoryTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "HR | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ErpHrPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);

  const [
    { data: staffRows },
    { data: shifts },
    { data: leave },
    { data: announcements },
  ] = await Promise.all([
    admin
      .from("staff_members")
      .select(
        "id, employee_code, full_name, role_label, department, position_title, employment_type, phone, email, status, hired_on, can_login, pin_set_at, last_login_at",
      )
      .eq("property_id", propertyId)
      .order("full_name")
      .limit(500),
    admin
      .from("staff_shifts")
      .select(
        "id, shift_date, starts_at, ends_at, outlet, status, staff_id, staff_members(full_name)",
      )
      .eq("property_id", propertyId)
      .order("shift_date", { ascending: false })
      .limit(40),
    admin
      .from("staff_leave")
      .select(
        "id, leave_type, starts_on, ends_on, status, notes, decision_notes, staff_id, staff_members(full_name)",
      )
      .eq("property_id", propertyId)
      .order("starts_on", { ascending: false })
      .limit(40),
    admin
      .from("hr_announcements")
      .select(
        "id, title, body, category, priority, status, audience_kind, audience_value, requires_acknowledgement, is_pinned, published_at, created_at, hr_announcement_recipients(count)",
      )
      .eq("property_id", propertyId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const staff: StaffOption[] = (staffRows ?? []).map((s) => ({
    id: s.id as string,
    full_name: s.full_name as string,
    role_label: s.role_label as string,
  }));
  const staffChoices = (staffRows ?? []).map((row) => ({
    id: row.id as string,
    employeeCode: row.employee_code as string,
    name: row.full_name as string,
    role: row.role_label as string,
  }));
  const staffDirectory: StaffDirectoryRow[] = (staffRows ?? []).map((row) => ({
    id: row.id as string,
    employeeCode: row.employee_code as string,
    fullName: row.full_name as string,
    role: row.role_label as string,
    department: (row.department as string | null) ?? null,
    positionTitle: (row.position_title as string | null) ?? null,
    employmentType: row.employment_type as string,
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    status: row.status as string,
    canLogin: Boolean(row.can_login),
    lastLoginAt: (row.last_login_at as string | null) ?? null,
  }));
  const departments = Array.from(
    new Set(
      (staffRows ?? [])
        .map((row) => row.department as string | null)
        .filter((department): department is string => Boolean(department)),
    ),
  ).sort();
  const activeStaff = (staffRows ?? []).filter((row) =>
    ["active", "on_leave"].includes(row.status as string),
  ).length;
  const pendingLeave = (leave ?? []).filter((row) => row.status === "requested").length;
  const draftShifts = (shifts ?? []).filter((row) => row.status === "draft").length;

  return (
    <div className="erp mx-auto w-full max-w-[1440px] space-y-8 p-4 md:p-6">
      <header>
        <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
          People operations
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Hotel workforce</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Manage staff records, publish company information, prepare shifts, and
          review leave without mixing properties.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="HR overview">
        {(
          [
            ["Active staff", activeStaff, "/erp/hr"],
            ["Pending leave", pendingLeave, "/erp/hr/leave"],
            ["Draft shifts", draftShifts, "/erp/hr/rota"],
            [
              "Published notices",
              (announcements ?? []).filter((n) => n.status === "published").length,
              "/erp/hr",
            ],
          ] as const
        ).map(([label, value, href]) => (
          <Link
            key={label}
            href={href}
            className="group block rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            <Card className="gap-2 py-5 transition-colors group-hover:border-accent/40 group-hover:bg-muted/40">
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {label}
                  <span className="ml-1 text-accent opacity-0 transition-opacity group-hover:opacity-100">
                    →
                  </span>
                </p>
                <p className="mt-1 text-3xl font-semibold">{value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      <Tabs defaultValue="people" className="gap-6">
        <TabsList className="h-auto max-w-full flex-wrap justify-start">
          <TabsTrigger value="people">
            People
            <Badge variant="secondary">{staffChoices.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="notices">
            Notices
            <Badge variant="secondary">{(announcements ?? []).length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="scheduling">
            Scheduling
            {draftShifts > 0 ? (
              <Badge variant="secondary">{draftShifts} draft</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="leave">
            Leave &amp; payroll
            {pendingLeave > 0 ? (
              <Badge variant="destructive">{pendingLeave}</Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="people" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Staff directory</CardTitle>
              <CardDescription>{staffChoices.length} staff records</CardDescription>
            </CardHeader>
            <CardContent>
              <StaffDirectoryTable data={staffDirectory} />
            </CardContent>
          </Card>

          <section className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Add staff member</CardTitle>
                <CardDescription>
                  Employee code is the permanent import and future staff-login
                  identifier.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StaffCreateForm />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Bulk staff upload</CardTitle>
                <CardDescription>
                  Validate first, then create or update the complete CSV batch.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StaffCsvImportForm />
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Staff lifecycle</CardTitle>
                <CardDescription>
                  Deactivate, suspend, or terminate without deleting operational
                  history.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StaffStatusForm staff={staffChoices} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Staff portal PIN</CardTitle>
                <CardDescription>
                  Enable employee-code + PIN login. Desk-capable staff can open
                  the Work ERP; others land on the staff PWA at{" "}
                  <code className="font-mono text-xs">/staff</code>. PINs are
                  stored only in Supabase Auth. Shared DESK_PIN remains valid.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StaffPinProvisionForm staff={staffChoices} />
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="notices" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>HR and company notice board</CardTitle>
              <CardDescription>
                Target the whole hotel or a team. Published notices create
                auditable recipient and notification records.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AnnouncementCreateForm
                staff={staffChoices}
                departments={departments}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notice history</CardTitle>
              <CardDescription>
                Draft, published, and pinned communication.
              </CardDescription>
            </CardHeader>
            <CardContent>
            {(announcements ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No notices yet.</p>
            ) : (
              <div className="divide-y">
                {(announcements ?? []).map((notice) => {
                  const count =
                    (
                      notice.hr_announcement_recipients as
                        | Array<{ count?: number }>
                        | null
                    )?.[0]?.count ?? 0;
                  return (
                    <article key={notice.id as string} className="py-4 first:pt-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">{notice.title as string}</h3>
                        <Badge variant="outline">{notice.category as string}</Badge>
                        {notice.priority !== "normal" ? (
                          <Badge variant="destructive">{notice.priority as string}</Badge>
                        ) : null}
                        {notice.is_pinned ? <Badge>pinned</Badge> : null}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {notice.body as string}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {notice.status as string} · {notice.audience_kind as string}
                        {notice.audience_value
                          ? `: ${notice.audience_value as string}`
                          : ""}
                        {notice.status === "published" ? ` · ${count} recipients` : ""}
                        {notice.requires_acknowledgement ? " · acknowledgement required" : ""}
                      </p>
                      {notice.status === "published" ? (
                        <NoticeReminderButton announcementId={notice.id as string} />
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduling" className="space-y-6">
          <section className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Create draft shift</CardTitle>
                <CardDescription>
                  Drafts stay internal until the week is published from the rota
                  board.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <StaffShiftForm staff={staff} />
                <Button asChild variant="outline">
                  <Link href="/erp/hr/rota">Open rota board</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent shifts</CardTitle>
                <CardDescription>
                  Latest {(shifts ?? []).length} scheduled shifts.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(shifts ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No shifts scheduled.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {(shifts ?? []).map((row) => {
                      const name =
                        (row.staff_members as { full_name?: string } | null)
                          ?.full_name ?? "—";
                      return (
                        <li key={row.id as string} className="py-3 text-sm">
                          <p className="font-medium text-foreground">
                            {row.shift_date as string} · {name}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {String(row.starts_at).slice(0, 5)}–
                            {String(row.ends_at).slice(0, 5)}
                            {row.outlet ? ` · ${row.outlet as string}` : ""}
                            {` · ${row.status as string}`}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="leave" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pending leave review</CardTitle>
              <CardDescription>
                New leave is requested first; it is never silently approved.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(leave ?? []).filter((row) => row.status === "requested")
                .length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No leave requests awaiting review.
                </p>
              ) : (
                <div className="divide-y">
                  {(leave ?? [])
                    .filter((row) => row.status === "requested")
                    .map((row) => {
                      const name =
                        (row.staff_members as { full_name?: string } | null)
                          ?.full_name ?? "Unknown staff";
                      return (
                        <div key={row.id as string} className="py-4 first:pt-0">
                          <p className="font-medium">
                            {name} · {row.leave_type as string}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.starts_on as string} → {row.ends_on as string}
                          </p>
                          {row.notes ? (
                            <p className="mt-1 text-sm">{row.notes as string}</p>
                          ) : null}
                          <LeaveReviewForm leaveId={row.id as string} />
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>

          <section className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Leave history</CardTitle>
                <CardDescription>
                  Latest {(leave ?? []).length} requests across all statuses.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(leave ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No leave recorded.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {(leave ?? []).map((row) => {
                      const name =
                        (row.staff_members as { full_name?: string } | null)
                          ?.full_name ?? "—";
                      return (
                        <li key={row.id as string} className="py-3 text-sm">
                          <p className="font-medium text-foreground">
                            {name} · {row.leave_type as string}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {row.starts_on as string} → {row.ends_on as string} ·{" "}
                            {row.status as string}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Policies &amp; payroll</CardTitle>
                <CardDescription>
                  Leave policies, balances and coverage checks, plus versioned
                  Bhutan payroll runs (NPPF + PIT) that post to finance on
                  finalize.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href="/erp/hr/leave">Leave management</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/erp/hr/payroll">Payroll</Link>
                </Button>
              </CardContent>
            </Card>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
