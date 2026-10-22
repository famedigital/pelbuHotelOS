import { BookingBoardTable } from "@/components/erp/BookingBoardTable";
import { FrontDeskLiveRefresh } from "@/components/erp/FrontDeskLiveRefresh";
import { StaysHub } from "@/components/erp/stays/StaysHub";
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

  const dayOps = await loadDayOpsBoard(admin, propertyId, today, {
    slices: ["departures"],
  });
  const boardRows = dayOps.departures.map(dayOpsRowToBoardRaw);

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
      <p className="mb-2 text-xs text-muted-foreground">
        {dayOps.departures.length} shown
        {dayOps.departuresWithLaundry > 0
          ? ` · ${dayOps.departuresWithLaundry} with open laundry`
          : ""}
      </p>
      <div className="fo-glass p-3">
        <BookingBoardTable rows={boardRows} board="departures" />
      </div>
    </StaysHub>
  );
}
