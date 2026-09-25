import { DailyDeskBoard } from "@/components/erp/DailyDeskBoard";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { loadDailyDeskSnapshot } from "@/lib/erp/daily-desk";
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
  const snap = await loadDailyDeskSnapshot(admin, propertyId);

  return (
    <DeskListShell
      heading={`Today · ${fmtDate(snap.wallToday)}`}
      subtitle="Check-in · Check-out · In-house · Agent pay follow-up — daily desk home."
    >
      <DailyDeskBoard initial={snap} />
    </DeskListShell>
  );
}
