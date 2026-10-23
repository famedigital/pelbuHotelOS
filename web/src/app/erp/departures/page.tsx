import { BookingBoardTable } from "@/components/erp/BookingBoardTable";
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
    <StaysHub>
      <p className="mb-2 text-xs text-muted-foreground">
        Departures. Open a stay for the room bill, food bill, and master bill.
        {" "}
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
