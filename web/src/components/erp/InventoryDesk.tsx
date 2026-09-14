"use client";

import {
  InventoryItemActionSheet,
  type ItemActionKind,
} from "@/components/erp/inventory/InventoryItemActionSheet";
import { InventoryBulkAddSheet } from "@/components/erp/inventory/InventoryBulkAddSheet";
import {
  DeskRowActions,
  type DeskRowAction,
} from "@/components/erp/DeskRowActions";
import type { InvItemRow, InvLocationOption } from "@/components/erp/InventoryOpsForms";
import { Input } from "@/components/ui/input";
import {
  categoryNameMap,
  formatInventoryCategory,
  type InventoryCategoryRow,
} from "@/lib/inventory-catalog";
import { formatBtn } from "@/lib/pricing";
import Link from "next/link";
import { useMemo, useState } from "react";

export type MovementRow = {
  id: string;
  movement_kind: string;
  qty_delta: number;
  unit_cost_btn: number | null;
  total_amount_btn: number | null;
  reference: string | null;
  created_at: string;
  sku: string;
  name: string;
  location_name: string | null;
};

export function InventoryDesk({
  items,
  locations,
  categories,
  lowCount,
  stockValue,
}: {
  items: InvItemRow[];
  locations: InvLocationOption[];
  categories: InventoryCategoryRow[];
  lowCount: number;
  stockValue: number;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [belowParOnly, setBelowParOnly] = useState(false);
  const [actionKind, setActionKind] = useState<ItemActionKind | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>();

  const catNames = useMemo(() => categoryNameMap(categories), [categories]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((i) => {
      if (category !== "all" && i.category !== category) return false;
      if (locationFilter !== "all" && i.default_location_id !== locationFilter) {
        return false;
      }
      if (belowParOnly && i.qty_on_hand > i.reorder_level) return false;
      if (!needle) return true;
      return [i.sku, i.name, i.category, formatInventoryCategory(i.category, catNames)]
        .some((v) => v.toLowerCase().includes(needle));
    });
  }, [belowParOnly, catNames, category, items, locationFilter, query]);

  function openAction(kind: ItemActionKind, itemId: string) {
    setSelectedItemId(itemId);
    setActionKind(kind);
  }

  function rowActions(item: InvItemRow): DeskRowAction[] {
    return [
      {
        id: "receive",
        label: "Receive",
        onSelect: () => openAction("receive", item.id),
      },
      {
        id: "damage",
        label: "Damage",
        onSelect: () => openAction("damage", item.id),
      },
      {
        id: "transfer",
        label: "Transfer",
        onSelect: () => openAction("transfer", item.id),
      },
      {
        id: "history",
        label: "History",
        href: `/erp/inventory/moves?sku=${encodeURIComponent(item.sku)}`,
      },
    ];
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Stock snapshot
          </p>
          <InventoryBulkAddSheet categories={categories} locations={locations} />
        </div>
        <dl className="grid gap-3 sm:grid-cols-3">
          <Stat label="SKUs" value={String(items.length)} />
          <Stat
            label="Below par"
            value={String(lowCount)}
            warn={lowCount > 0}
          />
          <Stat label="Est. stock value" value={formatBtn(stockValue)} />
        </dl>
      </section>

      <section className="flex flex-wrap gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search SKU or name…"
          className="h-9 max-w-[220px]"
          aria-label="Search inventory"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          aria-label="Filter by category"
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          aria-label="Filter by location"
        >
          <option value="all">All locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <label className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
          <input
            type="checkbox"
            checked={belowParOnly}
            onChange={(e) => setBelowParOnly(e.target.checked)}
            className="size-4 rounded border-input"
          />
          Below par
        </label>
      </section>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="min-w-[960px] w-full text-sm">
          <caption className="sr-only">Inventory on hand</caption>
          <thead className="bg-muted/40">
            <tr className="hover:bg-transparent">
              {[
                "SKU",
                "Name",
                "Category",
                "Location(s)",
                "Qty",
                "Unit price",
                "Stock value",
                "Par",
                "",
              ].map((h) => (
                <th
                  key={h || "actions"}
                  scope="col"
                  className="h-10 px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-muted-foreground">
                  No items match filters.{" "}
                  <Link href="/erp/inventory" className="text-accent underline-offset-4 hover:underline">
                    Add items
                  </Link>{" "}
                  to start the catalog.
                </td>
              </tr>
            ) : (
              filtered.map((i) => {
                const qty = i.qty_on_hand;
                const amount = qty * i.unit_cost_btn;
                const warn = qty <= i.reorder_level;
                const locs = i.location_balances ?? [];
                return (
                  <tr key={i.id} className="group border-t">
                    <td className="px-3 py-2.5 font-mono text-xs">{i.sku}</td>
                    <td className="px-3 py-2.5 font-medium text-foreground">
                      {i.name}
                      {warn ? (
                        <span className="ml-2 text-[10px] font-semibold uppercase text-destructive">
                          low
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {formatInventoryCategory(i.category, catNames)}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {locs.length === 0 ? (
                        "—"
                      ) : (
                        <span
                          className="block max-w-[180px] truncate"
                          title={locs.map((l) => `${l.code}: ${l.qty}`).join(" · ")}
                        >
                          {locs.map((l) => `${l.code} ${l.qty}`).join(" · ")}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {qty} {i.unit}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{formatBtn(i.unit_cost_btn)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{formatBtn(amount)}</td>
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                      {i.reorder_level}
                    </td>
                    <td className="px-3 py-2.5">
                      <DeskRowActions
                        label={i.sku}
                        menuLabel="Stock"
                        actions={rowActions(i)}
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <InventoryItemActionSheet
        kind={actionKind}
        itemId={selectedItemId}
        items={items}
        locations={locations}
        onClose={() => {
          setActionKind(null);
          setSelectedItemId(undefined);
        }}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card px-5 py-4">
      <dt className="text-[10px] font-semibold tracking-[0.18em] text-accent uppercase">
        {label}
      </dt>
      <dd
        className={`mt-2 text-lg font-semibold tabular-nums ${
          warn ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
