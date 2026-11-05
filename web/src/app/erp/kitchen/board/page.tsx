import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { thimphuToday, fmtDate } from "@/lib/erp-lists";
import { computeMealCovers } from "@/lib/kitchen/covers";
import { loadOpenPosTickets } from "@/lib/pos";
import { loadProperty } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GlanceableKitchenBoard } from "@/components/erp/kitchen/GlanceableKitchenBoard";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kitchen Glanceable Wallboard | Hotel OS Bhutan",
  description: "Glanceable covers headcounts, dietary warnings, and live KOT orders for kitchen ops",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ErpKitchenBoardPage() {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login");
  }

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();
  const today = thimphuToday();

  const [covers, tickets, property] = await Promise.all([
    computeMealCovers(admin, propertyId, today),
    loadOpenPosTickets(admin),
    loadProperty(admin, propertyId),
  ]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <GlanceableKitchenBoard
        covers={covers}
        tickets={tickets}
        propertyTitle={property?.name || "Hotel OS Bhutan"}
        todayDate={fmtDate(today)}
      />
    </div>
  );
}
