import { FoAssistantBoard } from "@/components/erp/FoAssistantBoard";
import { DeskListShell } from "@/components/erp/DeskListShell";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { loadDailyDeskSnapshot } from "@/lib/erp/daily-desk";
import { fmtDate } from "@/lib/erp-lists";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { loadProperty } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "StayView",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * FO assistant desk home — Do / Report / Check. Every Do row opens Hub.
 * Rack is the alternate StayView mode.
 */
export default async function StayViewPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");
  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const [snap, property] = await Promise.all([
    loadDailyDeskSnapshot(admin, propertyId),
    loadProperty(admin, propertyId),
  ]);

  return (
    <DeskListShell
      heading={`StayView · ${fmtDate(snap.wallToday)}`}
      subtitle="Do · Report · Check — your FO assistant. Tap a job to open Hub."
      wide
    >
      <FoAssistantBoard
        initial={snap}
        propertyId={propertyId}
        propertyName={property?.name ?? "Hotel"}
      />
    </DeskListShell>
  );
}
