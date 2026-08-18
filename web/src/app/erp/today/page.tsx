import { DeskListShell } from "@/components/erp/DeskListShell";
import { FoTodayWorklist } from "@/components/erp/FoTodayWorklist";
import { FrontDeskLiveRefresh } from "@/components/erp/FrontDeskLiveRefresh";
import { Button } from "@/components/ui/button";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { loadFoTodaySnapshot } from "@/lib/erp/fo-today";
import { fmtDate } from "@/lib/erp-lists";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Today | Pelbu OS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function FoTodayPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const snap = await loadFoTodaySnapshot(admin, propertyId);

  return (
    <DeskListShell
      heading={`Today · ${fmtDate(snap.wallToday)}`}
      subtitle="One recommended job per row. Open it — do not hunt lists."
      filters={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <FrontDeskLiveRefresh />
          <Link
            href="/erp/calendar"
            className="text-sm text-accent underline-offset-4 hover:underline"
          >
            Stay View
          </Link>
        </div>
      }
    >
      {snap.nightAuditStale ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
          <p className="text-sm text-foreground">
            Working date is still{" "}
            <span className="font-medium tabular-nums">{snap.businessDate}</span>
            . Close the prior day before new check-ins.
          </p>
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/erp/night-audit">Night Audit</Link>
          </Button>
        </div>
      ) : null}

      <FoTodayWorklist actions={snap.actions} />

      <p className="mt-4 text-xs text-muted-foreground">
        Lists (Arrival List, Guest Ledger, Departure List, Reservation List)
        stay under More · Ctrl+K.
      </p>
    </DeskListShell>
  );
}
