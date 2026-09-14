import { KitchenDisplayBoard } from "@/components/erp/kds/KitchenDisplayBoard";
import { getDeskRole, isDeskAuthenticated, isKotBoardRole } from "@/lib/desk-auth";
import { loadOpenPosTickets } from "@/lib/pos";
import { loadProperty, resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Pass / Expo Display | Hotel OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * F&B pass / expo TV — only Ready tickets. Waiters/FO mark Served when food leaves.
 * Separates cook line (`/erp/kds`) from service so the kitchen is not blocking
 * on "Mark served".
 */
export default async function ErpKdsPassPage() {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login?next=/erp/kds/pass");
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
      propertyName={property?.name ?? "Hotel"}
      role="pass"
    />
  );
}
