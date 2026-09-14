"use client";

import type { MovementRow } from "@/components/erp/InventoryDesk";
import { Input } from "@/components/ui/input";
import { formatBtn } from "@/lib/pricing";
import { useMemo, useState } from "react";

export function InventoryMovesTable({
  movements,
  initialSku,
}: {
  movements: MovementRow[];
  initialSku?: string;
}) {
  const [query, setQuery] = useState(initialSku ?? "");
  const [kind, setKind] = useState("all");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return movements.filter((m) => {
      if (kind !== "all" && m.movement_kind !== kind) return false;
      if (!needle) return true;
      return [m.sku, m.name, m.reference, m.location_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [kind, movements, query]);

  const kinds = useMemo(() => {
    const set = new Set(movements.map((m) => m.movement_kind));
    return Array.from(set).sort();
  }, [movements]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search SKU, ref…"
          className="h-9 max-w-[220px]"
          aria-label="Search movements"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          aria-label="Filter by kind"
        >
          <option value="all">All kinds</option>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="min-w-[720px] w-full text-sm">
          <caption className="sr-only">Inventory movement ledger</caption>
          <thead className="bg-muted/40">
            <tr>
              {["When", "Kind", "SKU", "Item", "Qty", "Amount", "Location / ref"].map((h) => (
                <th
                  key={h}
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
                <td colSpan={7} className="px-3 py-8 text-muted-foreground">
                  No movements match filters.
                </td>
              </tr>
            ) : (
              filtered.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {m.created_at.slice(0, 16).replace("T", " ")}
                  </td>
                  <td className="px-3 py-2.5 uppercase text-xs">{m.movement_kind}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{m.sku}</td>
                  <td className="px-3 py-2.5">{m.name}</td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {m.qty_delta > 0 ? "+" : ""}
                    {m.qty_delta}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {m.total_amount_btn != null
                      ? formatBtn(m.total_amount_btn)
                      : m.unit_cost_btn
                        ? formatBtn(Math.abs(m.qty_delta) * m.unit_cost_btn)
                        : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {m.location_name ?? "—"}
                    {m.reference ? ` · ${m.reference}` : ""}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
