import { DeskPageTitle } from "@/components/erp/DeskShell";
import { BarPackPanel } from "@/components/erp/menu/BarPackPanel";
import { MenuAdminGrid } from "@/components/erp/menu/MenuAdminGrid";
import { MenuCategoryManager } from "@/components/erp/menu/MenuCategoryManager";
import { MenuStockManager } from "@/components/erp/menu/MenuStockManager";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import {
  loadAllMenuItems,
  loadMenuCategories,
} from "@/lib/menu-admin";
import { loadPropertyOutlets } from "@/lib/outlets";
import { resolveActivePropertyId } from "@/lib/property-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PrinterIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Menu | Hotel OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ErpMenuPage() {
  if (!(await isDeskAuthenticated())) {
    redirect("/erp/login");
  }

  const admin = createSupabaseAdminClient();
  const propertyId = await resolveActivePropertyId(admin);
  const [
    items,
    outlets,
    categories,
    { data: inventory },
    { data: recipes },
    { data: property },
  ] = await Promise.all([
    loadAllMenuItems(admin),
    loadPropertyOutlets(admin, propertyId),
    loadMenuCategories(admin),
    admin
      .from("inventory_items")
      .select(
        "id, sku, name, unit, qty_on_hand, bottle_size_ml, bottles_per_case, standard_pour_ml, bar_kind",
      )
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .order("name"),
    admin
      .from("menu_recipe_items")
      .select("menu_item_id, inventory_item_id, qty_per_sale")
      .eq("property_id", propertyId),
    admin
      .from("properties")
      .select("bar_standard_pour_ml")
      .eq("id", propertyId)
      .maybeSingle(),
  ]);

  const invRows = (inventory ?? []).map((row) => ({
    id: row.id as string,
    sku: row.sku as string,
    name: row.name as string,
    unit: row.unit as string,
    qty_on_hand: Number(row.qty_on_hand),
    bottle_size_ml:
      row.bottle_size_ml != null ? Number(row.bottle_size_ml) : null,
    bottles_per_case:
      row.bottles_per_case != null ? Number(row.bottles_per_case) : null,
    standard_pour_ml:
      row.standard_pour_ml != null ? Number(row.standard_pour_ml) : null,
    bar_kind: (row.bar_kind as string | null) ?? null,
  }));

  const barInventory = invRows.filter(
    (row) =>
      Boolean(row.bar_kind) ||
      row.bottle_size_ml != null ||
      row.bottles_per_case != null,
  );

  const defaultPourMl = Number(property?.bar_standard_pour_ml ?? 30);

  return (
    <div className="erp mx-auto w-full max-w-[1200px] space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <DeskPageTitle
          eyebrow="F&B"
          title="Menu"
          description="Dishes and drinks across your outlets. Spirit packs share stock between pek and bottle; changes go live to POS immediately."
        />
        <Button variant="outline" size="sm" className="shrink-0 gap-1.5" asChild>
          <Link href="/erp/menu/print">
            <PrinterIcon className="size-3.5" />
            Print menu
          </Link>
        </Button>
      </div>
      <Tabs defaultValue="catalog">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="bar">Bar packs</TabsTrigger>
          <TabsTrigger value="stock">Stock & recipes</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>
        <TabsContent value="catalog" className="mt-5">
          <MenuAdminGrid
            items={items}
            outlets={outlets}
            categories={categories.filter((c) => c.is_active)}
          />
        </TabsContent>
        <TabsContent value="bar" className="mt-5">
          <BarPackPanel
            outlets={outlets}
            categories={categories.filter((c) => c.is_active)}
            barInventory={barInventory}
            defaultPourMl={defaultPourMl}
          />
        </TabsContent>
        <TabsContent value="stock" className="mt-5">
          <MenuStockManager
            items={items}
            inventory={invRows.map((row) => ({
              id: row.id,
              sku: row.sku,
              name: row.name,
              unit: row.unit,
              qty_on_hand: row.qty_on_hand,
            }))}
            recipes={(recipes ?? []).map((row) => ({
              menu_item_id: row.menu_item_id as string,
              inventory_item_id: row.inventory_item_id as string,
              qty_per_sale: Number(row.qty_per_sale),
            }))}
          />
        </TabsContent>
        <TabsContent value="categories" className="mt-5">
          <MenuCategoryManager categories={categories} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
