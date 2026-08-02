import {
  LiveDutyBoard,
  type DutyBoardRow,
} from "@/components/erp/LiveDutyBoard";
import { AttendanceDeviceForm } from "@/components/erp/AttendanceDeviceForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AttendanceKind } from "@/lib/attendance-types";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Attendance | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function thimphuDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Thimphu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export default async function AttendancePage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const today = thimphuDate();
  const tomorrow = addDay(today);
  const dayStart = `${today}T00:00:00+06:00`;
  const dayEnd = `${tomorrow}T00:00:00+06:00`;

  const [{ data: staff }, { data: events }, { data: shifts }, { data: devices }] =
    await Promise.all([
      admin
        .from("staff_members")
        .select("id, employee_code, full_name, department, role_label")
        .eq("property_id", propertyId)
        .in("status", ["active", "on_leave"])
        .order("full_name"),
      admin
        .from("staff_attendance_events")
        .select("staff_id, event_kind, occurred_at, source")
        .eq("property_id", propertyId)
        .is("voided_at", null)
        .gte("occurred_at", dayStart)
        .lt("occurred_at", dayEnd)
        .order("occurred_at", { ascending: false }),
      admin
        .from("staff_shifts")
        .select("staff_id, starts_at, ends_at, outlet")
        .eq("property_id", propertyId)
        .eq("shift_date", today)
        .eq("status", "published")
        .order("starts_at"),
      admin
        .from("attendance_devices")
        .select("id, device_type, is_active, last_seen_at")
        .eq("property_id", propertyId),
    ]);

  const latestByStaff = new Map<
    string,
    { event_kind: string; occurred_at: string; source: string }
  >();
  for (const event of events ?? []) {
    const staffId = event.staff_id as string;
    if (!latestByStaff.has(staffId)) {
      latestByStaff.set(staffId, {
        event_kind: event.event_kind as string,
        occurred_at: event.occurred_at as string,
        source: event.source as string,
      });
    }
  }

  const shiftsByStaff = new Map<string, string[]>();
  for (const shift of shifts ?? []) {
    const label = `${String(shift.starts_at).slice(0, 5)}–${String(
      shift.ends_at,
    ).slice(0, 5)}${shift.outlet ? ` · ${shift.outlet as string}` : ""}`;
    const staffId = shift.staff_id as string;
    shiftsByStaff.set(staffId, [...(shiftsByStaff.get(staffId) ?? []), label]);
  }

  const rows: DutyBoardRow[] = (staff ?? []).map((member) => {
    const latest = latestByStaff.get(member.id as string);
    return {
      id: member.id as string,
      employeeCode: member.employee_code as string,
      fullName: member.full_name as string,
      department: (member.department as string | null) ?? null,
      role: member.role_label as string,
      eventKind: (latest?.event_kind as AttendanceKind | undefined) ?? null,
      occurredAt: latest?.occurred_at ?? null,
      source: latest?.source ?? null,
      shiftLabel: shiftsByStaff.get(member.id as string)?.join(", ") ?? null,
    };
  });

  const onDuty = rows.filter(
    (row) => row.eventKind === "clock_in" || row.eventKind === "break_end",
  ).length;
  const onBreak = rows.filter((row) => row.eventKind === "break_start").length;
  const activeDevices = (devices ?? []).filter((device) => device.is_active).length;

  return (
    <div className="erp mx-auto w-full max-w-[1200px] space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/erp/hr" className="hover:underline">
              HR
            </Link>{" "}
            / Attendance
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Live duty board</h1>
          <p className="text-sm text-muted-foreground">
            Today, {today} · updates automatically from mobile, kiosk, and
            biometric devices.
          </p>
        </div>
        <Link
          href="/erp/hr/attendance/kiosk"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Open attendance kiosk
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["On duty", onDuty],
          ["On break", onBreak],
          ["Active devices", activeDevices],
        ].map(([label, value]) => (
          <Card key={label as string} className="py-4">
            <CardContent>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Staff status</CardTitle>
          <CardDescription>
            Realtime punch status alongside today&apos;s published shift.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LiveDutyBoard data={rows} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Biometric and device integration</CardTitle>
          <CardDescription>
            Register a fingerprint/face clock or vendor connector. The device
            posts signed punches to the attendance API; Pelbu stores no biometric
            templates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AttendanceDeviceForm />
        </CardContent>
      </Card>
    </div>
  );
}
