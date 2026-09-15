import { DeskListShell } from "@/components/erp/DeskListShell";
import { FoTodayLiveBoard } from "@/components/erp/FoTodayLiveBoard";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { loadFoTodaySnapshot } from "@/lib/erp/fo-today";
import { fmtDate } from "@/lib/erp-lists";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Today",
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
    >
      <FoTodayLiveBoard initial={snap} />

      <p className="mt-4 text-xs text-muted-foreground">
        Lists (Arrival List, Guest Ledger, Departure List, Reservation List)
        stay under More · Ctrl+K.
      </p>
    </DeskListShell>
  );
}
