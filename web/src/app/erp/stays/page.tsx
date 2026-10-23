import { BookingBoardTable } from "@/components/erp/BookingBoardTable";
import { StaysHub } from "@/components/erp/stays/StaysHub";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import {
  dayOpsRowToBoardRaw,
  loadStayRegister,
  type DayOpsRow,
} from "@/lib/erp/day-ops-board";
import { fmtDate, thimphuToday } from "@/lib/erp-lists";
import type { BoardKind } from "@/components/erp/BookingsTable";
import { loadProperty } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Stays",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function roomsSold(rows: DayOpsRow[]): number {
  return rows.reduce((sum, row) => sum + Math.max(0, row.rooms), 0);
}

function StaySection({
  title,
  rows,
  board,
  empty,
}: {
  title: string;
  rows: DayOpsRow[];
  board: BoardKind;
  empty: string;
}) {
  const detail =
    rows.length === 0
      ? "None"
      : `${rows.length} ${rows.length === 1 ? "stay" : "stays"} · ${roomsSold(rows)} ${roomsSold(rows) === 1 ? "room" : "rooms"}`;

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs tabular-nums text-muted-foreground">{detail}</p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <BookingBoardTable rows={rows.map(dayOpsRowToBoardRaw)} board={board} />
      )}
    </section>
  );
}

export default async function StaysHubPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const property = await loadProperty(admin, propertyId);
  const businessDate =
    property?.current_business_date?.slice(0, 10) || thimphuToday();
  const register = await loadStayRegister(admin, propertyId, businessDate);

  return (
    <StaysHub>
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Business date {fmtDate(businessDate)}
        </p>
        <StaySection
          title="Arrived today"
          rows={register.arrived}
          board="arrivals"
          empty="No arrivals on this business date."
        />
        <StaySection
          title="In house from earlier"
          rows={register.staying}
          board="in_house"
          empty="No one is still in house from an earlier arrival."
        />
        <StaySection
          title="Left today"
          rows={register.left}
          board="departures"
          empty="No departures on this business date."
        />
      </div>
    </StaysHub>
  );
}
