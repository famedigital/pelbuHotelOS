import { StaffAppShell } from "@/components/erp/StaffAppShell";
import { StaffAttendanceCard } from "@/components/erp/StaffAttendanceCard";
import { StaffPushToggle } from "@/components/erp/StaffPushToggle";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStaffSession } from "@/lib/staff-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AttendanceKind } from "@/lib/attendance-types";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Home | Pelbu Staff",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StaffHomePage() {
  const session = await getStaffSession();
  if (!session) redirect("/staff/login");

  const admin = createSupabaseAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: shifts },
    { data: notices },
    { data: leave },
    { data: latestAttendance },
  ] = await Promise.all([
    admin
      .from("staff_shifts")
      .select("id, shift_date, starts_at, ends_at, outlet, status")
      .eq("property_id", session.propertyId)
      .eq("staff_id", session.staffId)
      .gte("shift_date", today)
      .order("shift_date")
      .limit(7),
    admin
      .from("hr_announcement_recipients")
      .select(
        "read_at, acknowledged_at, hr_announcements(id, title, category, priority, body, requires_acknowledgement, published_at, is_pinned)",
      )
      .eq("property_id", session.propertyId)
      .eq("staff_id", session.staffId)
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("staff_leave")
      .select("id, leave_type, starts_on, ends_on, status")
      .eq("property_id", session.propertyId)
      .eq("staff_id", session.staffId)
      .order("starts_on", { ascending: false })
      .limit(5),
    admin
      .from("staff_attendance_events")
      .select("event_kind, occurred_at")
      .eq("property_id", session.propertyId)
      .eq("staff_id", session.staffId)
      .is("voided_at", null)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const unread = (notices ?? []).filter((row) => !row.read_at).length;

  return (
    <StaffAppShell session={session}>
      <div className="space-y-6">
        <section>
          <p className="text-sm text-muted-foreground">
            {session.employeeCode}
            {session.department ? ` · ${session.department}` : ` · ${session.roleLabel}`}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Hello, {session.fullName.split(" ")[0]}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Add this page to your home screen for the staff PWA. Clock-in and
            offline punch sync arrive in the next attendance phase.
          </p>
          <div className="mt-3">
            <StaffPushToggle />
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            ["Upcoming shifts", (shifts ?? []).length],
            ["Unread notices", unread],
            ["Leave records", (leave ?? []).length],
          ].map(([label, value]) => (
            <Card key={label as string} className="gap-2 py-4">
              <CardContent>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <StaffAttendanceCard
          initialKind={
            (latestAttendance?.event_kind as AttendanceKind | undefined) ?? null
          }
          initialOccurredAt={
            (latestAttendance?.occurred_at as string | undefined) ?? null
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>Upcoming shifts</CardTitle>
          </CardHeader>
          <CardContent>
            {(shifts ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No published or draft shifts assigned yet.
              </p>
            ) : (
              <ul className="divide-y">
                {(shifts ?? []).map((shift) => (
                  <li key={shift.id as string} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-medium">{shift.shift_date as string}</p>
                      <p className="text-xs text-muted-foreground">
                        {String(shift.starts_at).slice(0, 5)}–
                        {String(shift.ends_at).slice(0, 5)}
                        {shift.outlet ? ` · ${shift.outlet as string}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline">{shift.status as string}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notice board</CardTitle>
          </CardHeader>
          <CardContent>
            {(notices ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No notices assigned to you yet.</p>
            ) : (
              <div className="divide-y">
                {(notices ?? []).map((row) => {
                  const notice = row.hr_announcements as {
                    id?: string;
                    title?: string;
                    category?: string;
                    priority?: string;
                    body?: string;
                    requires_acknowledgement?: boolean;
                    is_pinned?: boolean;
                  } | null;
                  if (!notice?.id) return null;
                  return (
                    <Link
                      key={notice.id}
                      href={`/staff/notices/${notice.id}`}
                      className="block space-y-2 py-4 first:pt-0 hover:bg-muted/40"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-medium">{notice.title}</h2>
                        {!row.read_at ? <Badge>new</Badge> : null}
                        {notice.is_pinned ? <Badge variant="outline">pinned</Badge> : null}
                        {notice.priority && notice.priority !== "normal" ? (
                          <Badge variant="destructive">{notice.priority}</Badge>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {notice.body}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {notice.category}
                        {notice.requires_acknowledgement
                          ? row.acknowledged_at
                            ? " · acknowledged"
                            : " · acknowledgement required"
                          : ""}
                      </p>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your leave</CardTitle>
          </CardHeader>
          <CardContent>
            {(leave ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No leave history yet.</p>
            ) : (
              <ul className="divide-y">
                {(leave ?? []).map((row) => (
                  <li key={row.id as string} className="flex justify-between gap-3 py-3 text-sm">
                    <span>
                      {row.leave_type as string} · {row.starts_on as string} →{" "}
                      {row.ends_on as string}
                    </span>
                    <Badge variant="outline">{row.status as string}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </StaffAppShell>
  );
}
