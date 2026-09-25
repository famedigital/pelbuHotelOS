import { DayOpsGuestPanel } from "@/components/erp/DayOpsGuestPanel";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { FrontDeskLiveRefresh } from "@/components/erp/FrontDeskLiveRefresh";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { loadDayOpsBoard } from "@/lib/erp/day-ops-board";
import { fmtDate, thimphuToday } from "@/lib/erp-lists";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "F&B day board",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function FnbDayBoardPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const today = thimphuToday();
  const dayOps = await loadDayOpsBoard(admin, propertyId, today);

  const arrivingMeals = dayOps.arrivals.filter((r) => r.meal_plan_code !== "EP");
  const inHouseMeals = dayOps.inHouse.filter((r) => r.meal_plan_code !== "EP");
  const dueOutMeals = dayOps.departures.filter((r) => r.meal_plan_code !== "EP");

  return (
    <DeskListShell
      eyebrow="F&B"
      heading={`F&B day · ${fmtDate(today)}`}
      blurb="Guest × meal × room for today’s arrivals, in-house, and due-out. Click a row for agent / guide / driver contacts. Sell and settle stays on POS."
      filters={
        <div className="flex items-center gap-3">
          <FrontDeskLiveRefresh />
          <Link
            href="/erp/pos"
            className="text-sm text-accent underline-offset-4 hover:underline"
          >
            POS →
          </Link>
          <Link
            href="/erp/kitchen"
            className="text-sm text-accent underline-offset-4 hover:underline"
          >
            Kitchen →
          </Link>
        </div>
      }
    >
      <div className="grid gap-8">
        <DayOpsGuestPanel
          title={`Arrivals on meal plan · ${dayOps.arrivingMealPax} pax`}
          blurb="Confirm meal counts before first service."
          rows={arrivingMeals}
          emptyMessage="No arriving guests on BB / MAP / AP today."
        />
        <DayOpsGuestPanel
          title={`In-house meal plans · ${dayOps.inHouseMealPax} pax`}
          blurb="Active stays with breakfast / lunch / dinner inclusion."
          rows={inHouseMeals}
          emptyMessage="No in-house meal-plan guests."
        />
        <DayOpsGuestPanel
          title="Due out (last meal)"
          blurb="Departing stays still on a meal plan — check final BF before CO."
          rows={dueOutMeals}
          showFolio
          emptyMessage="No meal-plan departures today."
        />
      </div>
    </DeskListShell>
  );
}
