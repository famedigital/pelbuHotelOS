import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { thimphuToday, fmtDate } from "@/lib/erp-lists";
import { computeMealCovers } from "@/lib/kitchen/covers";
import { loadProperty } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { KitchenBriefingPrintPass } from "@/components/erp/kitchen/KitchenBriefingPrintPass";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kitchen Morning Briefing Pass (A4) | Hotel OS Bhutan",
  description: "Printable 07:30 AM Daily Morning Standup Briefing Pass for Kitchen & F&B",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ErpKitchenPassPage() {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login");
  }

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const today = thimphuToday();

  const [covers, property] = await Promise.all([
    computeMealCovers(admin, propertyId, today),
    loadProperty(admin, propertyId),
  ]);

  return (
    <KitchenBriefingPrintPass
      covers={covers}
      propertyTitle={property?.name || "Hotel OS Bhutan"}
      todayDate={fmtDate(today)}
    />
  );
}
