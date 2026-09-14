"use client";

import {
  bulkCreateInventoryItems,
  createInventoryCategory,
  type InvState,
} from "@/app/actions/erp-inventory";
import type { InvLocationOption } from "@/components/erp/InventoryOpsForms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useActionToast } from "@/hooks/use-action-toast";
import type { InventoryCategoryRow } from "@/lib/inventory-catalog";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";

const initial: InvState = { ok: false };

type DraftRow = {
  key: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  par: string;
  unit_cost_btn: string;
  default_location_id: string;
};

function blankRow(categories: InventoryCategoryRow[], locations: InvLocationOption[]): DraftRow {
  const store = locations.find((l) => l.code === "STORE")?.id ?? locations[0]?.id ?? "";
  return {
    key: crypto.randomUUID(),
    sku: "",
    name: "",
    category: categories[0]?.slug ?? "other",
    unit: "ea",
    par: "0",
    unit_cost_btn: "0",
    default_location_id: store,
  };
}

export function InventoryBulkAddSheet({
  categories,
  locations,
}: {
  categories: InventoryCategoryRow[];
  locations: InvLocationOption[];
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<DraftRow[]>(() => [blankRow(categories, locations)]);
  const [bulkState, bulkAction, bulkPending] = useActionState(
    bulkCreateInventoryItems,
    initial,
  );
  const [catState, catAction, catPending] = useActionState(createInventoryCategory, initial);

  useActionToast(bulkState, { successMessage: "Items saved" });
  useActionToast(catState, { successMessage: "Category added" });

  useEffect(() => {
    if (bulkState.ok) {
      setOpen(false);
      setRows([blankRow(categories, locations)]);
    }
  }, [bulkState.ok, categories, locations]);

  const rowsJson = useMemo(
    () =>
      JSON.stringify(
        rows
          .filter((r) => r.sku.trim() && r.name.trim())
          .map((r) => ({
            sku: r.sku.trim(),
            name: r.name.trim(),
            category: r.category,
            unit: r.unit,
            reorder_level: Number(r.par) || 0,
            unit_cost_btn: Number(r.unit_cost_btn) || 0,
            default_location_id: r.default_location_id || null,
          })),
      ),
    [rows],
  );

  const selectClass =
    "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm">Add items</Button>
      </SheetTrigger>
      <SheetContent side="right" className="erp w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Add catalog items</SheetTitle>
          <SheetDescription>
            One SKU per row — qty starts at zero; receive stock after saving.
          </SheetDescription>
        </SheetHeader>

        <form action={catAction} className="mt-4 flex flex-wrap items-end gap-2 border-b pb-4">
          <div className="min-w-[180px] flex-1 space-y-1">
            <Label htmlFor="cat_name" className="text-xs text-muted-foreground">
              New category
            </Label>
            <Input id="cat_name" name="name" placeholder="e.g. Spa supplies" required />
          </div>
          <Button type="submit" variant="outline" size="sm" disabled={catPending}>
            {catPending ? "Adding…" : "Add category"}
          </Button>
        </form>

        <form action={bulkAction} className="mt-4 space-y-4">
          <input type="hidden" name="rows_json" value={rowsJson} readOnly />
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-[640px] w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  {["SKU", "Name", "Category", "Unit", "Par", "Unit Nu", "Location", ""].map(
                    (h) => (
                      <th
                        key={h || "x"}
                        scope="col"
                        className="h-9 px-2 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.key} className="border-t">
                    <td className="px-2 py-1.5">
                      <Input
                        value={row.sku}
                        onChange={(e) => {
                          const next = [...rows];
                          next[idx] = { ...row, sku: e.target.value.toUpperCase() };
                          setRows(next);
                        }}
                        placeholder="SKU"
                        className="h-8 font-mono text-xs"
                        aria-label={`SKU row ${idx + 1}`}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        value={row.name}
                        onChange={(e) => {
                          const next = [...rows];
                          next[idx] = { ...row, name: e.target.value };
                          setRows(next);
                        }}
                        placeholder="Name"
                        className="h-8"
                        aria-label={`Name row ${idx + 1}`}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={row.category}
                        onChange={(e) => {
                          const next = [...rows];
                          next[idx] = { ...row, category: e.target.value };
                          setRows(next);
                        }}
                        className={selectClass}
                        aria-label={`Category row ${idx + 1}`}
                      >
                        {categories.map((c) => (
                          <option key={c.slug} value={c.slug}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={row.unit}
                        onChange={(e) => {
                          const next = [...rows];
                          next[idx] = { ...row, unit: e.target.value };
                          setRows(next);
                        }}
                        className={selectClass}
                        aria-label={`Unit row ${idx + 1}`}
                      >
                        {["ea", "kg", "g", "l", "ml", "case"].map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={row.par}
                        onChange={(e) => {
                          const next = [...rows];
                          next[idx] = { ...row, par: e.target.value };
                          setRows(next);
                        }}
                        className="h-8 w-16 tabular-nums"
                        aria-label={`Par row ${idx + 1}`}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.unit_cost_btn}
                        onChange={(e) => {
                          const next = [...rows];
                          next[idx] = { ...row, unit_cost_btn: e.target.value };
                          setRows(next);
                        }}
                        className="h-8 w-20 tabular-nums"
                        aria-label={`Unit price row ${idx + 1}`}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={row.default_location_id}
                        onChange={(e) => {
                          const next = [...rows];
                          next[idx] = { ...row, default_location_id: e.target.value };
                          setRows(next);
                        }}
                        className={selectClass}
                        aria-label={`Location row ${idx + 1}`}
                      >
                        {locations.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.code}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={rows.length <= 1}
                        onClick={() => setRows(rows.filter((r) => r.key !== row.key))}
                        aria-label="Remove row"
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRows([...rows, blankRow(categories, locations)])}
            >
              <PlusIcon className="mr-1 size-4" />
              Add row
            </Button>
            <Button type="submit" disabled={bulkPending}>
              {bulkPending ? "Saving…" : "Save items"}
            </Button>
          </div>
          {bulkState.error ? (
            <p className="text-sm text-destructive" role="alert">
              {bulkState.error}
            </p>
          ) : null}
        </form>
      </SheetContent>
    </Sheet>
  );
}
