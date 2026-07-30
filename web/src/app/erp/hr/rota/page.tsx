import { RotaBoard, type RotaShift, type RotaStaff } from "@/components/erp/RotaBoard";
import { RotaWeekControls } from "@/components/erp/RotaWeekControls";
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
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Rota | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Monday (ISO date) for the week containing `iso`. */
function mondayOf(iso: string): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function thimphuToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Thimphu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function ErpRotaPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const { week } = await searchParams;
  const seed = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : thimphuToday();
  const weekStart = mondayOf(seed);
  const weekEnd = addDays(weekStart, 7);
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);

  const [{ data: staffRows }, { data: shiftRows }] = await Promise.all([
    admin
      .from("staff_members")
      .select("id, full_name, role_label, department")
      .eq("property_id", propertyId)
      .in("status", ["active", "on_leave"])
      .order("full_name")
      .limit(500),
    admin
      .from("staff_shifts")
      .select("id, staff_id, shift_date, starts_at, ends_at, outlet, status, notes")
      .eq("property_id", propertyId)
      .gte("shift_date", weekStart)
      .lt("shift_date", weekEnd)
      .order("starts_at"),
  ]);

  const staff = (staffRows ?? []) as RotaStaff[];
  const shifts = (shiftRows ?? []) as RotaShift[];
  const draftCount = shifts.filter((shift) => shift.status === "draft").length;
  const publishedCount = shifts.filter((shift) => shift.status === "published").length;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/erp/hr" className="hover:underline">
              HR
            </Link>{" "}
            / Rota
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Weekly rota</h1>
          <p className="text-sm text-muted-foreground">
            Plan drafts, then publish the week to alert staff by app push and
            email — free of cost.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/erp/hr/rota?week=${prevWeek}`}
            className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
          >
            ← Prev
          </Link>
          <Link
            href="/erp/hr/rota"
            className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
          >
            This week
          </Link>
          <Link
            href={`/erp/hr/rota?week=${nextWeek}`}
            className="rounded-md border px-3 py-2 text-sm hover:bg-muted"
          >
            Next →
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>
              Week of {weekStart} → {addDays(weekStart, 6)}
            </CardTitle>
            <CardDescription>
              {draftCount} draft · {publishedCount} published
            </CardDescription>
          </div>
          <RotaWeekControls weekStart={weekStart} prevWeekStart={prevWeek} />
        </CardHeader>
        <CardContent>
          <RotaBoard staff={staff} shifts={shifts} days={days} />
        </CardContent>
      </Card>
    </div>
  );
}
