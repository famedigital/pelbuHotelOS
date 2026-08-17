import { KitchenDisplayBoard } from "@/components/erp/kds/KitchenDisplayBoard";
import { getDeskRole, isDeskAuthenticated, isKotBoardRole } from "@/lib/desk-auth";
import { loadOpenPosTickets } from "@/lib/pos";
import { loadProperty, resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Kitchen Display | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ErpKdsPage() {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login?next=/erp/kds");
  }
  if (!isKotBoardRole(await getDeskRole())) {
    redirect("/erp");
  }

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const [tickets, property] = await Promise.all([
    loadOpenPosTickets(admin),
    loadProperty(admin, propertyId),
  ]);

  return (
    <KitchenDisplayBoard
      initialTickets={tickets}
      propertyName={property?.name ?? "Pelbu Suites"}
      role="kitchen"
    />
  );
}
