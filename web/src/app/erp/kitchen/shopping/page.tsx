import { FnbSectionHeader } from "@/components/erp/fnb/FnbSectionHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildShoppingList } from "@/lib/fnb/shopping-list";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ShoppingListPage() {
  const lines = await buildShoppingList();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 print:p-2">
      <FnbSectionHeader
        title="Market shopping list"
        description="Items at or below reorder level. Print for the market run."
      />
      <div className="flex gap-3 print:hidden">
        <Link href="/erp/inventory" className="text-sm text-muted-foreground">
          ← Inventory
        </Link>
        <Link href="/erp/kitchen" className="text-sm text-muted-foreground">
          Kitchen
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {lines.length} item{lines.length === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Item</th>
                <th className="py-2">On hand</th>
                <th className="py-2">Reorder at</th>
                <th className="py-2">Buy</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.inventoryItemId} className="border-b border-border/40">
                  <td className="py-2 font-medium">{l.name}</td>
                  <td className="py-2 tabular-nums">
                    {l.onHand} {l.unit}
                  </td>
                  <td className="py-2 tabular-nums">
                    {l.reorderAt} {l.unit}
                  </td>
                  <td className="py-2 font-semibold tabular-nums">
                    {l.suggestedQty} {l.unit}
                  </td>
                </tr>
              ))}
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-muted-foreground">
                    Nothing below reorder. Set reorder levels on inventory items.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
