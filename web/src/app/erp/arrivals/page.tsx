import { BookingBoardTable } from "@/components/erp/BookingBoardTable";
import { FoMetricCard } from "@/components/erp/FoCommandDesk";
import { StayMoneyCycleLegend } from "@/components/erp/StayMoneyCycleLegend";
import { StaysHub } from "@/components/erp/stays/StaysHub";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import {
  dayOpsRowToBoardRaw,
  loadDayOpsBoard,
} from "@/lib/erp/day-ops-board";
import { thimphuToday } from "@/lib/erp-lists";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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
    <StaysHub>
      <div className="mb-3">
        <StayMoneyCycleLegend compact />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <FoMetricCard
          label="Arrival bookings"
          value={String(summary.bookings)}
        />
        <FoMetricCard
          label="Expected guests"
          value={String(summary.guests)}
        />
        <FoMetricCard label="Rooms booked" value={String(summary.rooms)} />
        <FoMetricCard
          label="Ready to check in"
          value={String(summary.ready)}
          hint={
            summary.bookings > summary.ready
              ? `${summary.bookings - summary.ready} need room or HK`
              : "All arrivals ready"
          }
          percent={
            summary.bookings
              ? Math.round((summary.ready / summary.bookings) * 100)
              : 0
          }
          barClassName="bg-emerald-500"
        />
      </div>

      {dayOps.overdueArrivals.length > 0 ? (
        <div className="fo-glass mb-3 space-y-2 p-3">
          <h2 className="text-sm font-semibold text-white">Still to check in</h2>
          <p className="text-xs text-slate-400">
            These stays are from before today. Open each one and confirm.
          </p>
          <BookingBoardTable
            rows={dayOps.overdueArrivals.map(dayOpsRowToBoardRaw)}
            board="arrivals"
          />
        </div>
      ) : null}

      <div className="fo-glass space-y-2 p-3">
        <BookingBoardTable rows={boardRows} board="arrivals" />
        {boardRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/15 px-4 py-6 text-sm text-slate-400">
            No arrivals today. Scan departures for late checkout, confirm
            tomorrow&apos;s holds on Reservations, and keep housekeeping ahead.
          </p>
        ) : null}
      </div>
    </StaysHub>
  );
}
