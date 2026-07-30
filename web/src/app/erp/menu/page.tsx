import { DeskPageTitle } from "@/components/erp/DeskShell";
import { MenuAdminGrid } from "@/components/erp/menu/MenuAdminGrid";
import { MenuStockManager } from "@/components/erp/menu/MenuStockManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { loadAllMenuItems } from "@/lib/menu-admin";
import { loadPropertyOutlets } from "@/lib/outlets";
import { resolveActivePropertyId } from "@/lib/property-context";
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
  const propertyId = await resolveActivePropertyId(admin);
  const [items, outlets, { data: inventory }, { data: recipes }] =
    await Promise.all([
      loadAllMenuItems(admin),
      loadPropertyOutlets(admin, propertyId),
      admin
        .from("inventory_items")
        .select("id, sku, name, unit, qty_on_hand")
        .eq("property_id", propertyId)
        .eq("is_active", true)
        .order("name"),
      admin
        .from("menu_recipe_items")
        .select("menu_item_id, inventory_item_id, qty_per_sale")
        .eq("property_id", propertyId),
    ]);

  return (
    <div className="erp mx-auto w-full max-w-[1200px] space-y-6 p-4 md:p-6">
      <DeskPageTitle
        eyebrow="F&B"
        title="Menu"
        description="Dishes and drinks across your outlets. Changes go live to the public site, online order page, and POS immediately."
      />
      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="stock">Stock & recipes</TabsTrigger>
        </TabsList>
        <TabsContent value="catalog" className="mt-5">
          <MenuAdminGrid items={items} outlets={outlets} />
        </TabsContent>
        <TabsContent value="stock" className="mt-5">
          <MenuStockManager
            items={items}
            inventory={(inventory ?? []).map((row) => ({
              id: row.id as string,
              sku: row.sku as string,
              name: row.name as string,
              unit: row.unit as string,
              qty_on_hand: Number(row.qty_on_hand),
            }))}
            recipes={(recipes ?? []).map((row) => ({
              menu_item_id: row.menu_item_id as string,
              inventory_item_id: row.inventory_item_id as string,
              qty_per_sale: Number(row.qty_per_sale),
            }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
