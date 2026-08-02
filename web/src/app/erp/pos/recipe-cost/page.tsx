import { DeskListShell } from "@/components/erp/DeskListShell";
import { isDeskAuthenticated } from "@/lib/desk-auth";
import { requireDeskPropertyId } from "@/lib/desk-property";
import { formatBtn, roundBtn } from "@/lib/pricing";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Recipe cost | Pelbu OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * F&amp;B margin report: sell price vs recipe ingredient cost from inventory unit costs.
 */
export default async function RecipeCostPage() {
  if (!(await isDeskAuthenticated())) redirect("/erp/login");

  const admin = createSupabaseAdminClient();
  const propertyId = await requireDeskPropertyId();

  const [{ data: profiles }, { data: recipes }, { data: menu }] = await Promise.all([
    admin
      .from("menu_stock_profiles")
      .select("menu_item_id, stock_mode")
      .eq("property_id", propertyId)
      .eq("stock_mode", "recipe"),
    admin
      .from("menu_recipe_items")
      .select("menu_item_id, qty_per_sale, inventory_item_id")
      .eq("property_id", propertyId),
    admin
      .from("menu_items")
      .select("id, name, price_btn, outlet")
      .eq("property_id", propertyId)
      .eq("is_available", true),
  ]);

  const recipeMenuIds = new Set(
    (profiles ?? []).map((p) => p.menu_item_id as string),
  );
  const invIds = [
    ...new Set(
      (recipes ?? [])
        .filter((r) => recipeMenuIds.has(r.menu_item_id as string))
        .map((r) => r.inventory_item_id as string),
    ),
  ];

  const { data: inv } =
    invIds.length > 0
      ? await admin
          .from("inventory_items")
          .select("id, name, unit_cost_btn, unit")
          .eq("property_id", propertyId)
          .in("id", invIds)
      : { data: [] as { id: string; name: string; unit_cost_btn: number; unit: string }[] };

  const costByInv = new Map(
    (inv ?? []).map((i) => [i.id as string, Number(i.unit_cost_btn ?? 0)]),
  );
  const nameByInv = new Map(
    (inv ?? []).map((i) => [i.id as string, i.name as string]),
  );

  const costByMenu = new Map<string, number>();
  const missingCost = new Map<string, string[]>();
  for (const row of recipes ?? []) {
    const menuId = row.menu_item_id as string;
    if (!recipeMenuIds.has(menuId)) continue;
    const invId = row.inventory_item_id as string;
    const unitCost = costByInv.get(invId);
    if (unitCost == null || !Number.isFinite(unitCost)) {
      const list = missingCost.get(menuId) ?? [];
      list.push(nameByInv.get(invId) ?? invId.slice(0, 8));
      missingCost.set(menuId, list);
      continue;
    }
    const line = roundBtn(Number(row.qty_per_sale) * unitCost);
    costByMenu.set(menuId, roundBtn((costByMenu.get(menuId) ?? 0) + line));
  }

  const rows = (menu ?? [])
    .filter((m) => recipeMenuIds.has(m.id as string))
    .map((m) => {
      const sell = Number(m.price_btn ?? 0);
      const cost = costByMenu.get(m.id as string) ?? 0;
      const margin = roundBtn(sell - cost);
      const marginPct = sell > 0 ? Math.round((margin / sell) * 1000) / 10 : 0;
      return {
        id: m.id as string,
        name: m.name as string,
        outlet: m.outlet as string,
        sell,
        cost,
        margin,
        marginPct,
        missing: missingCost.get(m.id as string) ?? [],
      };
    })
    .sort((a, b) => a.outlet.localeCompare(b.outlet) || a.name.localeCompare(b.name));

  const outletRollup = new Map<
    string,
    { sell: number; cost: number; margin: number; items: number }
  >();
  for (const r of rows) {
    const cur = outletRollup.get(r.outlet) ?? {
      sell: 0,
      cost: 0,
      margin: 0,
      items: 0,
    };
    cur.sell = roundBtn(cur.sell + r.sell);
    cur.cost = roundBtn(cur.cost + r.cost);
    cur.margin = roundBtn(cur.margin + r.margin);
    cur.items += 1;
    outletRollup.set(r.outlet, cur);
  }
  const outletRows = [...outletRollup.entries()]
    .map(([outlet, v]) => ({
      outlet,
      ...v,
      marginPct: v.sell > 0 ? Math.round((v.margin / v.sell) * 1000) / 10 : 0,
    }))
    .sort((a, b) => a.outlet.localeCompare(b.outlet));

  return (
    <DeskListShell
      eyebrow="POS"
      heading="Recipe cost"
      blurb="Multi-outlet margin: sell price vs ingredient cost from inventory unit costs. Outlet rollup below, then item detail."
      filters={
        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            href="/erp/menu"
            className="inline-flex h-9 items-center rounded-md border px-3 hover:bg-muted"
          >
            Menu
          </Link>
          <Link
            href="/erp/inventory"
            className="inline-flex h-9 items-center rounded-md border px-3 hover:bg-muted"
          >
            Stock
          </Link>
        </div>
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No recipe-mode menu items yet. On Menu, set stock mode to{" "}
          <strong className="font-medium text-foreground">recipe</strong> and add ingredients.
        </p>
      ) : (
        <div className="space-y-6">
          <section className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2">Outlet</th>
                  <th className="px-3 py-2 text-right">Items</th>
                  <th className="px-3 py-2 text-right">Sell</th>
                  <th className="px-3 py-2 text-right">Cost</th>
                  <th className="px-3 py-2 text-right">Margin</th>
                  <th className="px-3 py-2 text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {outletRows.map((o) => (
                  <tr key={o.outlet}>
                    <td className="px-3 py-2 capitalize font-medium">{o.outlet}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{o.items}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatBtn(o.sell)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatBtn(o.cost)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        o.margin < 0 ? "text-destructive" : ""
                      }`}
                    >
                      {formatBtn(o.margin)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {o.marginPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Outlet</th>
                  <th className="px-3 py-2 text-right">Sell</th>
                  <th className="px-3 py-2 text-right">Cost</th>
                  <th className="px-3 py-2 text-right">Margin</th>
                  <th className="px-3 py-2 text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-foreground">{r.name}</p>
                      {r.missing.length > 0 ? (
                        <p className="mt-0.5 text-[11px] text-destructive">
                          Missing cost: {r.missing.join(", ")}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 capitalize text-muted-foreground">
                      {r.outlet}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatBtn(r.sell)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatBtn(r.cost)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        r.margin < 0 ? "text-destructive" : "text-foreground"
                      }`}
                    >
                      {formatBtn(r.margin)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {r.marginPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DeskListShell>
  );
}
