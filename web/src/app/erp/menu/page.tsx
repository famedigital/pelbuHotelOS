import { DeskPageTitle } from "@/components/erp/DeskShell";
import { MenuAdminGrid } from "@/components/erp/menu/MenuAdminGrid";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { loadAllMenuItems } from "@/lib/menu-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Menu | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ErpMenuPage() {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login");
  }

  const admin = createSupabaseAdminClient();
  const items = await loadAllMenuItems(admin);

  return (
    <div className="erp mx-auto w-full max-w-[1200px] space-y-6 p-4 md:p-6">
      <DeskPageTitle
        eyebrow="F&B"
        title="Menu"
        description="Dishes and drinks across cafe, pastry, restaurant, and bar. Changes go live to the public site, online order page, and POS immediately."
      />
      <MenuAdminGrid items={items} />
    </div>
  );
}
