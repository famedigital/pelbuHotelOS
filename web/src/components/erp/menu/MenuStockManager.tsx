"use client";

import {
  receiveMenuStock,
  saveMenuStockProfile,
  type MenuStockState,
} from "@/app/actions/erp-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActionToast } from "@/hooks/use-action-toast";
import type { MenuItem } from "@/lib/menu";
import { PlusIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

const initial: MenuStockState = { ok: false };

export type InventoryOption = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  qty_on_hand: number;
};

export type RecipeRow = {
  menu_item_id: string;
  inventory_item_id: string;
  qty_per_sale: number;
};

type IngredientDraft = { inventoryItemId: string; qtyPerSale: string };

export function MenuStockManager({
  items,
  inventory,
  recipes,
}: {
  items: MenuItem[];
  inventory: InventoryOption[];
  recipes: RecipeRow[];
}) {
  const [configureState, configureAction, configurePending] = useActionState(
    saveMenuStockProfile,
    initial,
  );
  const [receiveState, receiveAction, receivePending] = useActionState(
    receiveMenuStock,
    initial,
  );
  useActionToast(configureState, { successMessage: "Stock settings saved" });
  useActionToast(receiveState, { successMessage: "Stock received" });

  const [menuItemId, setMenuItemId] = useState(items[0]?.id ?? "");
  const selected = items.find((item) => item.id === menuItemId) ?? null;
  const [mode, setMode] = useState<string>(selected?.stock_mode ?? "untracked");
  const [inventoryItemId, setInventoryItemId] = useState(
    selected?.stock_inventory_item_id ?? "",
  );
  const [qtyPerSale, setQtyPerSale] = useState(
    String(selected?.stock_qty_per_sale ?? 1),
  );
  const [ingredients, setIngredients] = useState<IngredientDraft[]>(() =>
    recipes
      .filter((row) => row.menu_item_id === menuItemId)
      .map((row) => ({
        inventoryItemId: row.inventory_item_id,
        qtyPerSale: String(row.qty_per_sale),
      })),
  );

  const purchasedItems = useMemo(
    () => items.filter((item) => item.stock_mode === "finished_good"),
    [items],
  );

  function chooseMenuItem(id: string) {
    setMenuItemId(id);
    const item = items.find((candidate) => candidate.id === id);
    setMode(item?.stock_mode ?? "untracked");
    setInventoryItemId(item?.stock_inventory_item_id ?? "");
    setQtyPerSale(String(item?.stock_qty_per_sale ?? 1));
    setIngredients(
      recipes
        .filter((row) => row.menu_item_id === id)
        .map((row) => ({
          inventoryItemId: row.inventory_item_id,
          qtyPerSale: String(row.qty_per_sale),
        })),
    );
  }

  const recipeJson = JSON.stringify(
    ingredients
      .filter((row) => row.inventoryItemId && Number(row.qtyPerSale) > 0)
      .map((row) => ({
        inventoryItemId: row.inventoryItemId,
        qtyPerSale: Number(row.qtyPerSale),
      })),
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
      <section className="rounded-xl border bg-card p-4 md:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
          Stock policy
        </p>
        <h2 className="mt-1 text-lg font-semibold">Link menu to stock</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pastries use finished units. Cocktails use recipe ingredients (spirit
          ml + mixers). Prefer the same spirit SKU as a pek pack so pours and
          cocktails share one bottle inventory.
        </p>

        {configureState.error ? (
          <Alert variant="destructive" className="mt-4">
            <TriangleAlertIcon />
            <AlertDescription>{configureState.error}</AlertDescription>
          </Alert>
        ) : null}

        <form action={configureAction} className="mt-5 space-y-4">
          <input type="hidden" name="menu_item_id" value={menuItemId} />
          <input type="hidden" name="stock_mode" value={mode} />
          <input
            type="hidden"
            name="inventory_item_id"
            value={inventoryItemId}
          />
          <input type="hidden" name="recipe_json" value={recipeJson} />
          <input type="hidden" name="auto_disable" value="1" />

          <div className="space-y-1.5">
            <Label>Menu item</Label>
            <Select value={menuItemId} onValueChange={chooseMenuItem}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose menu item" />
              </SelectTrigger>
              <SelectContent>
                {items.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} · {item.outlet}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Stock mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="untracked">Untracked</SelectItem>
                <SelectItem value="finished_good">
                  Purchased finished item
                </SelectItem>
                <SelectItem value="recipe">Prepared from recipe</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "finished_good" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Inventory SKU</Label>
                <Select
                  value={inventoryItemId || "__auto__"}
                  onValueChange={(value) =>
                    setInventoryItemId(value === "__auto__" ? "" : value)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__auto__">
                      Create automatically
                    </SelectItem>
                    {inventory.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} · {item.qty_on_hand} {item.unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stock_qty_per_sale">Units per sale</Label>
                <Input
                  id="stock_qty_per_sale"
                  name="qty_per_sale"
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={qtyPerSale}
                  onChange={(event) => setQtyPerSale(event.target.value)}
                />
              </div>
            </div>
          ) : null}

          {mode === "recipe" ? (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <Label>Ingredients per one sale</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setIngredients((current) => [
                      ...current,
                      { inventoryItemId: "", qtyPerSale: "1" },
                    ])
                  }
                >
                  <PlusIcon className="size-4" />
                  Ingredient
                </Button>
              </div>
              {ingredients.map((ingredient, index) => (
                <div
                  key={`${index}-${ingredient.inventoryItemId}`}
                  className="grid grid-cols-[minmax(0,1fr)_100px_36px] gap-2"
                >
                  <Select
                    value={ingredient.inventoryItemId}
                    onValueChange={(value) =>
                      setIngredients((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, inventoryItemId: value }
                            : row,
                        ),
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ingredient" />
                    </SelectTrigger>
                    <SelectContent>
                      {inventory.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} ({item.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    aria-label="Quantity per sale"
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={ingredient.qtyPerSale}
                    onChange={(event) =>
                      setIngredients((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, qtyPerSale: event.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove ingredient"
                    onClick={() =>
                      setIngredients((current) =>
                        current.filter((_, rowIndex) => rowIndex !== index),
                      )
                    }
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              ))}
              {ingredients.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Add the ingredients consumed by one sold item.
                </p>
              ) : null}
            </div>
          ) : null}

          {mode !== "finished_good" ? (
            <input type="hidden" name="qty_per_sale" value="1" />
          ) : null}
          <Button type="submit" variant="citrus" disabled={configurePending}>
            {configurePending ? "Saving…" : "Save stock policy"}
          </Button>
        </form>
      </section>

      <section className="rounded-xl border bg-card p-4 md:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
          Receive
        </p>
        <h2 className="mt-1 text-lg font-semibold">Purchased menu items</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Record pastries, bottled drinks, or other finished items bought from
          outside.
        </p>

        {receiveState.error ? (
          <Alert variant="destructive" className="mt-4">
            <TriangleAlertIcon />
            <AlertDescription>{receiveState.error}</AlertDescription>
          </Alert>
        ) : null}

        <form action={receiveAction} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label>Purchased menu item</Label>
            <Select name="menu_item_id" required>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose finished item" />
              </SelectTrigger>
              <SelectContent>
                {purchasedItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} · {item.stock_on_hand ?? 0} on hand
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="receive_qty">Quantity received</Label>
              <Input
                id="receive_qty"
                name="qty"
                type="number"
                min="0.001"
                step="0.001"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="receive_cost">Unit cost (Nu)</Label>
              <Input
                id="receive_cost"
                name="unit_cost_btn"
                type="number"
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="receive_ref">Supplier / invoice</Label>
              <Input id="receive_ref" name="reference" maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="receive_batch">Batch</Label>
              <Input id="receive_batch" name="batch_ref" maxLength={80} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="receive_expiry">Expiry date</Label>
            <Input id="receive_expiry" name="expires_on" type="date" />
          </div>
          <Button
            type="submit"
            variant="citrus"
            disabled={receivePending || purchasedItems.length === 0}
          >
            {receivePending ? "Receiving…" : "Receive stock"}
          </Button>
          {purchasedItems.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              First configure a menu item as “Purchased finished item”.
            </p>
          ) : null}
        </form>
      </section>
    </div>
  );
}
