"use client";

import {
  InventoryDamageForm,
  InventoryReceiveForm,
  InventoryTransferForm,
  type InvItemRow,
  type InvLocationOption,
} from "@/components/erp/InventoryOpsForms";
import {
  DeskRowActions,
  type DeskRowAction,
} from "@/components/erp/DeskRowActions";
import { Input } from "@/components/ui/input";
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

type Panel = "receive" | "damage" | "transfer" | null;

export function InventoryDesk({
  items,
  locations,
  movements,
  lowCount,
  stockValue,
}: {
  items: InvItemRow[];
  locations: InvLocationOption[];
  movements: MovementRow[];
  lowCount: number;
  stockValue: number;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>();
  const [panel, setPanel] = useState<Panel>(null);

  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category));
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((i) => {
      if (category !== "all" && i.category !== category) return false;
      if (locationFilter !== "all" && i.default_location_id !== locationFilter) {
        return false;
      }
      if (!needle) return true;
      return [i.sku, i.name, i.category].some((v) => v.toLowerCase().includes(needle));
    });
  }, [category, items, locationFilter, query]);

  function openPanel(kind: Panel, itemId: string) {
    setSelectedItemId(itemId);
    setPanel(kind);
  }

  function rowActions(item: InvItemRow): DeskRowAction[] {
    return [
      {
        id: "receive",
        label: "Receive",
        onSelect: () => openPanel("receive", item.id),
      },
      {
        id: "damage",
        label: "Record damage",
        onSelect: () => openPanel("damage", item.id),
      },
      {
        id: "transfer",
        label: "Transfer",
        onSelect: () => openPanel("transfer", item.id),
      },
    ];
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Stock snapshot
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link
              href="/erp/inventory/audits"
              className="rounded-md border px-3 py-2 text-foreground hover:bg-muted"
            >
              Audit history →
            </Link>
            <Link
              href="/erp/inventory/purchase-orders"
              className="rounded-md border px-3 py-2 text-foreground hover:bg-muted"
            >
              Purchase orders →
            </Link>
            <Link
              href="/erp/inventory/assets"
              className="rounded-md border px-3 py-2 text-foreground hover:bg-muted"
            >
              Asset register →
            </Link>
          </div>
        </div>
        <dl className="grid gap-3 sm:grid-cols-3">
          <Stat label="SKUs" value={String(items.length)} />
          <Stat label="Below reorder" value={String(lowCount)} />
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
            <option key={c} value={c}>
              {c}
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
      </section>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="min-w-[880px] w-full text-sm">
          <caption className="sr-only">Inventory on hand</caption>
          <thead className="bg-muted/40">
            <tr className="hover:bg-transparent">
              {["SKU", "Name", "Category", "Qty", "By location", "Unit price", "Amount", ""].map((h) => (
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
                <td colSpan={8} className="px-3 py-8 text-muted-foreground">
                  No items match filters.
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
                    <td className="px-3 py-2.5 text-muted-foreground">{i.category}</td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {qty} {i.unit}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {locs.length === 0 ? (
                        "—"
                      ) : (
                        <span className="block max-w-[180px] truncate" title={locs.map((l) => `${l.code}: ${l.qty}`).join(" · ")}>
                          {locs.map((l) => `${l.code} ${l.qty}`).join(" · ")}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{formatBtn(i.unit_cost_btn)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{formatBtn(amount)}</td>
                    <td className="px-3 py-2.5">
                      <DeskRowActions
                        label={i.sku}
                        menuLabel="Stock"
                        actions={rowActions(i)}
                        className="opacity-100 sm:opacity-0"
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className={panel === "receive" || panel === null ? "" : "hidden lg:block lg:opacity-40"}>
          <InventoryReceiveForm
            items={items}
            locations={locations}
            selectedItemId={panel === "receive" ? selectedItemId : undefined}
          />
        </div>
        <div className={panel === "damage" || panel === null ? "" : "hidden lg:block lg:opacity-40"}>
          <InventoryDamageForm
            items={items}
            locations={locations}
            selectedItemId={panel === "damage" ? selectedItemId : undefined}
          />
        </div>
        <div className={panel === "transfer" || panel === null ? "" : "hidden lg:block lg:opacity-40"}>
          <InventoryTransferForm
            items={items}
            locations={locations}
            selectedItemId={panel === "transfer" ? selectedItemId : undefined}
          />
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Recent movements
        </h2>
        {movements.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No movements yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-[640px] w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  {["When", "Kind", "SKU", "Qty", "Amount", "Location"].map((h) => (
                    <th key={h} scope="col" className="px-2 py-2 font-semibold uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="px-2 py-2 text-muted-foreground">
                      {m.created_at.slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="px-2 py-2">{m.movement_kind}</td>
                    <td className="px-2 py-2 font-mono text-xs">{m.sku}</td>
                    <td className="px-2 py-2 tabular-nums">
                      {m.qty_delta > 0 ? "+" : ""}
                      {m.qty_delta}
                    </td>
                    <td className="px-2 py-2 tabular-nums">
                      {m.total_amount_btn != null
                        ? formatBtn(m.total_amount_btn)
                        : m.unit_cost_btn
                          ? formatBtn(Math.abs(m.qty_delta) * m.unit_cost_btn)
                          : "—"}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">
                      {m.location_name ?? "—"}
                      {m.reference ? ` · ${m.reference}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card px-5 py-4">
      <dt className="text-[10px] font-semibold tracking-[0.18em] text-accent uppercase">
        {label}
      </dt>
      <dd className="mt-2 text-lg font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
