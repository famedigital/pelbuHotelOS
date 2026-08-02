import {
  StaffShiftForm,
  type StaffOption,
} from "@/components/erp/OpsForms";
import {
  AnnouncementCreateForm,
  LeaveReviewForm,
  StaffCsvImportForm,
} from "@/components/erp/HrFoundationForms";
import { NoticeReminderButton } from "@/components/erp/NoticeReminderButton";
import { CopyForWhatsAppButton } from "@/components/erp/CopyForWhatsAppButton";
import {
  StaffDirectoryTable,
} from "@/components/erp/StaffDirectoryTable";
import { StaffInlineAddTable } from "@/components/erp/StaffInlineAddTable";
import type {
  ManagerOption,
  StaffConductRow,
  StaffDocumentRow,
  StaffDossierMember,
  StaffPayComponentRow,
  StaffPrivateProfile,
} from "@/components/erp/StaffDossierDialog";
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
    { data: privateRows },
    { data: payRows },
    { data: docRows },
    { data: conductRows },
  ] = await Promise.all([
    admin
      .from("staff_members")
      .select(
        "id, employee_code, full_name, role_label, department, position_title, employment_type, phone, email, status, hired_on, probation_ends_on, contract_ends_on, notes, manager_id, access_level, desk_role, can_access_desk, can_login, pin_set_at, last_login_at",
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
    admin
      .from("staff_private_profiles")
      .select(
        "staff_id, cid_number, date_of_birth, address, emergency_contact_name, emergency_contact_phone, bank_name, bank_account_number, tax_identifier, provident_fund_number, base_wage_btn, health_contribution_btn, service_charge_eligible, service_charge_share_btn, photo_public_id, pay_schedule",
      )
      .eq("property_id", propertyId),
    admin
      .from("staff_pay_components")
      .select("id, staff_id, kind, code, label, amount_btn, taxable, is_active")
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .order("code"),
    admin
      .from("staff_documents")
      .select(
        "id, staff_id, doc_type, title, cloudinary_public_id, resource_type, notes",
      )
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false })
      .limit(500),
    admin
      .from("staff_conduct_records")
      .select("id, staff_id, kind, severity, title, body, recorded_on")
      .eq("property_id", propertyId)
      .order("recorded_on", { ascending: false })
      .limit(500),
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
  const staffDirectory: StaffDossierMember[] = (staffRows ?? []).map((row) => ({
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
    hiredOn: (row.hired_on as string | null) ?? null,
    probationEndsOn: (row.probation_ends_on as string | null) ?? null,
    contractEndsOn: (row.contract_ends_on as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    managerId: (row.manager_id as string | null) ?? null,
    accessLevel: (row.access_level as string) ?? "employee",
    deskRole: (row.desk_role as string | null) ?? null,
    canAccessDesk: Boolean(row.can_access_desk),
    canLogin: Boolean(row.can_login),
    pinSetAt: (row.pin_set_at as string | null) ?? null,
    lastLoginAt: (row.last_login_at as string | null) ?? null,
  }));
  const managers: ManagerOption[] = staffDirectory.map((row) => ({
    id: row.id,
    fullName: row.fullName,
    employeeCode: row.employeeCode,
  }));
  const privateProfiles: StaffPrivateProfile[] = (privateRows ?? []).map((row) => ({
    staffId: row.staff_id as string,
    cidNumber: (row.cid_number as string | null) ?? null,
    dateOfBirth: (row.date_of_birth as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    emergencyContactName: (row.emergency_contact_name as string | null) ?? null,
    emergencyContactPhone: (row.emergency_contact_phone as string | null) ?? null,
    bankName: (row.bank_name as string | null) ?? null,
    bankAccountNumber: (row.bank_account_number as string | null) ?? null,
    taxIdentifier: (row.tax_identifier as string | null) ?? null,
    providentFundNumber: (row.provident_fund_number as string | null) ?? null,
    baseWageBtn:
      row.base_wage_btn != null ? Number(row.base_wage_btn) : null,
    healthContributionBtn:
      row.health_contribution_btn != null
        ? Number(row.health_contribution_btn)
        : null,
    serviceChargeEligible: Boolean(row.service_charge_eligible),
    serviceChargeShareBtn:
      row.service_charge_share_btn != null
        ? Number(row.service_charge_share_btn)
        : null,
    photoPublicId: (row.photo_public_id as string | null) ?? null,
    paySchedule: (row.pay_schedule as string) ?? "monthly",
  }));
  const payComponents: StaffPayComponentRow[] = (payRows ?? []).map((row) => ({
    id: row.id as string,
    staffId: row.staff_id as string,
    kind: row.kind as string,
    code: row.code as string,
    label: row.label as string,
    amountBtn: Number(row.amount_btn ?? 0),
    taxable: Boolean(row.taxable),
    isActive: Boolean(row.is_active),
  }));
  const documents: StaffDocumentRow[] = (docRows ?? []).map((row) => ({
    id: row.id as string,
    staffId: row.staff_id as string,
    docType: row.doc_type as string,
    title: row.title as string,
    cloudinaryPublicId: row.cloudinary_public_id as string,
    resourceType: (row.resource_type as string) ?? "image",
    notes: (row.notes as string | null) ?? null,
  }));
  const conduct: StaffConductRow[] = (conductRows ?? []).map((row) => ({
    id: row.id as string,
    staffId: row.staff_id as string,
    kind: row.kind as string,
    severity: row.severity as string,
    title: row.title as string,
    body: (row.body as string | null) ?? null,
    recordedOn: row.recorded_on as string,
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
    <div className="erp mx-auto w-full max-w-[1440px] space-y-8 p-4 md:p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <header>
        <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
          People operations
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Hotel workforce</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Personnel dossiers, company notices, shift planning, and leave —
          property-scoped for the desk.
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
          <TabsTrigger value="people" className="min-h-11">
            People
            <Badge variant="secondary">{staffChoices.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="notices" className="min-h-11">
            Notices
            <Badge variant="secondary">{(announcements ?? []).length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="scheduling" className="min-h-11">
            Scheduling
            {draftShifts > 0 ? (
              <Badge variant="secondary">{draftShifts} draft</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="leave" className="min-h-11">
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
              <CardDescription>
                All staff show a pass photo (or initials). Tap a person to open
                their dossier — profile, access, pay, docs, and conduct.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StaffDirectoryTable
                data={staffDirectory}
                privateProfiles={privateProfiles}
                payComponents={payComponents}
                documents={documents}
                conduct={conduct}
                managers={managers}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add staff</CardTitle>
              <CardDescription>
                Editable hire table (desktop) or stacked cards (mobile). Sheet
                import for bulk.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="table" className="gap-4">
                <TabsList>
                  <TabsTrigger value="table" className="min-h-11">
                    Table
                  </TabsTrigger>
                  <TabsTrigger value="sheet" className="min-h-11">
                    CSV
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="table" className="mt-4">
                  <StaffInlineAddTable />
                </TabsContent>
                <TabsContent value="sheet" className="mt-4">
                  <StaffCsvImportForm />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
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
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <NoticeReminderButton announcementId={notice.id as string} />
                          <CopyForWhatsAppButton
                            title={notice.title as string}
                            body={notice.body as string}
                            category={notice.category as string}
                            priority={notice.priority as string}
                          />
                        </div>
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
                  board. Overlaps are blocked.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <StaffShiftForm staff={staff} />
                <Button asChild variant="outline" className="h-11">
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
                  Leave policies and Bhutan payroll (NPPF + PIT + HC/SC from
                  personnel files).
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button asChild variant="outline" className="h-11">
                  <Link href="/erp/hr/leave">Leave management</Link>
                </Button>
                <Button asChild variant="outline" className="h-11">
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
