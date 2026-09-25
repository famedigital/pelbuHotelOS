import { BookingBoardTable } from "@/components/erp/BookingBoardTable";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { FrontDeskLiveRefresh } from "@/components/erp/FrontDeskLiveRefresh";
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
  title: "Departures",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function DeparturesPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const today = thimphuToday();

  const dayOps = await loadDayOpsBoard(admin, propertyId, today);
  const boardRows = dayOps.departures.map(dayOpsRowToBoardRaw);

  return (
    <DeskListShell
      eyebrow="Today"
      heading={`Departures · ${fmtDate(today)}`}
      blurb="Due out today. Open StayHub at Stay / Money (open balance) or Check-out (settled). Check-out marks rooms dirty for housekeeping. Open laundry flags must clear before CO."
      filters={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex items-center gap-3">
            <FrontDeskLiveRefresh />
            <Link
              href={`/erp/calendar/day-sheet?date=${today}`}
              className="text-sm text-accent underline-offset-4 hover:underline"
            >
              Day sheet
            </Link>
          </div>
        </div>
      }
    >
      <p className="text-xs text-muted-foreground">
        {dayOps.departures.length} shown
        {dayOps.departuresWithLaundry > 0
          ? ` · ${dayOps.departuresWithLaundry} with open laundry`
          : ""}
      </p>
      <BookingBoardTable rows={boardRows} board="departures" />
    </DeskListShell>
  );
}
