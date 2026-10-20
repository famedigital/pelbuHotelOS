import { BookingBoardTable } from "@/components/erp/BookingBoardTable";
import { FrontDeskLiveRefresh } from "@/components/erp/FrontDeskLiveRefresh";
import { StayMoneyCycleLegend } from "@/components/erp/StayMoneyCycleLegend";
import { StaysHub } from "@/components/erp/stays/StaysHub";
import { Card, CardContent } from "@/components/ui/card";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import {
  dayOpsRowToBoardRaw,
  loadDayOpsBoard,
} from "@/lib/erp/day-ops-board";
import { fmtDate, thimphuToday } from "@/lib/erp-lists";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Arrivals",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function ArrivalsPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const today = thimphuToday();

  const dayOps = await loadDayOpsBoard(admin, propertyId, today, {
    slices: ["arrivals"],
  });
  const boardRows = dayOps.arrivals.map(dayOpsRowToBoardRaw);
  const summary = {
    bookings: dayOps.arrivals.length,
    guests: dayOps.arrivals.reduce((s, r) => s + r.pax, 0),
    rooms: dayOps.arrivals.reduce((s, r) => s + r.rooms, 0),
    ready: dayOps.arrivals.filter(
      (r) =>
        r.rooms > 0 &&
        r.assigned_count >= r.rooms &&
        !r.has_unready_guest_room,
    ).length,
  };

  return (
    <StaysHub
      filters={
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted-foreground">{fmtDate(today)}</span>
          <FrontDeskLiveRefresh />
          <Link
            href={`/erp/calendar/day-sheet?date=${today}`}
            className="text-sm text-accent underline-offset-4 hover:underline"
          >
            Day sheet
          </Link>
        </div>
      }
    >
      <div className="mb-3">
        <StayMoneyCycleLegend compact />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <ArrivalStat label="Arrival bookings" value={summary.bookings} />
        <ArrivalStat label="Expected guests" value={summary.guests} />
        <ArrivalStat label="Rooms booked" value={summary.rooms} />
        <ArrivalStat
          label="Ready to check in"
          value={summary.ready}
          hint={
            summary.bookings > summary.ready
              ? `${summary.bookings - summary.ready} need room or HK action`
              : "All arrivals ready"
          }
        />
      </div>

      <div className="space-y-2">
        <BookingBoardTable rows={boardRows} board="arrivals" />
        {boardRows.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
            No arrivals today. Scan departures for late CO, confirm
            tomorrow&apos;s holds on Reservations, and keep HK ahead.
          </p>
        ) : null}
      </div>
    </StaysHub>
  );
}

function ArrivalStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
          {value}
        </p>
        {hint ? (
          <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
