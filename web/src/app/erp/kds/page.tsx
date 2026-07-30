import { KitchenDisplayBoard } from "@/components/erp/kds/KitchenDisplayBoard";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { loadOpenPosTickets } from "@/lib/pos";
import { loadProperty, resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Kitchen Display | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Kitchen TV board. Runs fullscreen on a wall display wired to a mini-PC /
 * tablet via HDMI. Auth-gated but bypasses the DeskShell layout (see
 * `erp/layout.tsx`) so the TV gets a clean, chrome-free surface.
 */
export default async function ErpKdsPage() {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login?next=/erp/kds");
  }

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const [tickets, property] = await Promise.all([
    loadOpenPosTickets(admin),
    loadProperty(admin, propertyId),
  ]);

  return (
    <KitchenDisplayBoard
      tickets={tickets}
      propertyName={property?.name ?? "Pelbu Suites"}
    />
  );
}
