import {
  LiveDutyBoard,
  type DutyBoardRow,
} from "@/components/erp/LiveDutyBoard";
import { NetworkClockPanel } from "@/components/erp/NetworkClockPanel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { loadProperty, resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AttendanceKind } from "@/lib/attendance-types";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Attendance",
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

function clockTime(iso: string | null, timeZone: string): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

function whenLabel(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

function clockServerAddress(value: string): string {
  return value.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();
}

export default async function AttendancePage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const today = thimphuDate();
  const tomorrow = addDay(today);
  const dayStart = `${today}T00:00:00+06:00`;
  const dayEnd = `${tomorrow}T00:00:00+06:00`;

  const [
    headerList,
    property,
    { data: staff },
    { data: events },
    { data: shifts },
    { data: devices },
    { data: unmatched },
  ] = await Promise.all([
    headers(),
    loadProperty(admin, propertyId),
    admin
      .from("staff_members")
      .select(
        "id, employee_code, full_name, department, role_label, biometric_user_id",
      )
      .eq("property_id", propertyId)
      .in("status", ["active", "on_leave"])
      .order("full_name"),
    admin
      .from("staff_attendance_events")
      .select("staff_id, event_kind, occurred_at")
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
      .select("id, name, external_ref, is_active, last_seen_at")
      .eq("property_id", propertyId)
      .eq("is_active", true),
    admin
      .from("attendance_unmatched_punches")
      .select("id, biometric_user_id, occurred_at")
      .eq("property_id", propertyId)
      .order("occurred_at", { ascending: false })
      .limit(20),
  ]);

  const timeZone = property?.timezone || "Asia/Thimphu";
  const requestHost = (
    headerList.get("x-forwarded-host") ??
    headerList.get("host") ??
    ""
  )
    .split(",")[0]
    ?.trim()
    .replace(/:\d+$/, "");
  const clockHost =
    clockServerAddress(property?.desk_host?.trim() || requestHost || "") ||
    "this server";

  const latestByStaff = new Map<
    string,
    { event_kind: string; occurred_at: string }
  >();
  const dayMarks = new Map<string, { arrivedAt: string | null; leftAt: string | null }>();
  for (const event of events ?? []) {
    const staffId = event.staff_id as string;
    const at = event.occurred_at as string;
    if (!latestByStaff.has(staffId)) {
      latestByStaff.set(staffId, {
        event_kind: event.event_kind as string,
        occurred_at: at,
      });
    }
    const slot = dayMarks.get(staffId) ?? { arrivedAt: null, leftAt: null };
    if (event.event_kind === "clock_in") slot.arrivedAt = at;
    if (event.event_kind === "clock_out" && !slot.leftAt) slot.leftAt = at;
    dayMarks.set(staffId, slot);
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
    const marks = dayMarks.get(member.id as string);
    return {
      id: member.id as string,
      employeeCode: member.employee_code as string,
      fullName: member.full_name as string,
      department: (member.department as string | null) ?? null,
      role: member.role_label as string,
      eventKind: (latest?.event_kind as AttendanceKind | undefined) ?? null,
      arrivedLabel: clockTime(marks?.arrivedAt ?? null, timeZone),
      leftLabel: clockTime(marks?.leftAt ?? null, timeZone),
      shiftLabel: shiftsByStaff.get(member.id as string)?.join(", ") ?? null,
    };
  });

  const arrived = rows.filter((row) => row.arrivedLabel).length;
  const stillHere = rows.filter(
    (row) =>
      row.eventKind === "clock_in" ||
      row.eventKind === "break_start" ||
      row.eventKind === "break_end",
  ).length;
  const left = rows.filter((row) => row.eventKind === "clock_out").length;
  const nowMs = Date.now();
  const clockDevices = (devices ?? []).map((device) => {
    const seenAt = (device.last_seen_at as string | null) ?? null;
    const online =
      seenAt != null && nowMs - new Date(seenAt).getTime() < 10 * 60_000;
    return {
      id: device.id as string,
      name: device.name as string,
      serial: (device.external_ref as string | null) ?? null,
      lastSeenLabel: online
        ? `Online · ${whenLabel(seenAt as string, timeZone)}`
        : seenAt
          ? `Last seen ${whenLabel(seenAt, timeZone)}`
          : "Not connected yet",
    };
  });
  const clockStaff = (staff ?? []).map((member) => ({
    id: member.id as string,
    fullName: member.full_name as string,
    employeeCode: member.employee_code as string,
    biometricUserId: (member.biometric_user_id as string | null) ?? null,
  }));
  const suggestionSet = new Set<string>();
  const unmatchedRows = (unmatched ?? []).map((row) => {
    const pin = row.biometric_user_id as string;
    suggestionSet.add(pin);
    return {
      id: row.id as string,
      pin,
      whenLabel: whenLabel(row.occurred_at as string, timeZone),
    };
  });

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
            Today, {today}. Arrived and left update from the network clock, the
            kiosk, and the staff phone.
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
          ["Arrived", arrived],
          ["Still here", stillHere],
          ["Left", left],
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
            First arrival and latest departure today, next to the published shift.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LiveDutyBoard data={rows} />
        </CardContent>
      </Card>

      <NetworkClockPanel
        clockHost={clockHost}
        devices={clockDevices}
        staff={clockStaff}
        suggestions={[...suggestionSet]}
        unmatched={unmatchedRows}
      />
    </div>
  );
}
