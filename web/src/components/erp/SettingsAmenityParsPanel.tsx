"use client";

import { updateRoomAmenityPar, type InvState } from "@/app/actions/erp-inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { formatBtn } from "@/lib/pricing";
import { useActionState } from "react";

const initial: InvState = { ok: false };

export type AmenityParRow = {
  id: string;
  par_qty: number;
  sort_order: number;
  is_active: boolean;
  sku: string;
  name: string;
  unit: string;
  qty_on_hand: number;
  reorder_level: number;
  unit_cost_btn: number;
};

function ParRowForm({ row }: { row: AmenityParRow }) {
  const [state, action, pending] = useActionState(updateRoomAmenityPar, initial);
  useActionToast(state, { successMessage: "Par saved" });

  return (
    <form
      action={action}
      className="erp grid gap-3 border-t py-3 first:border-t-0 md:grid-cols-[1fr_auto_auto_auto_auto] md:items-end"
    >
      <input type="hidden" name="par_id" value={row.id} />
      <div>
        <p className="font-mono text-xs text-muted-foreground">{row.sku}</p>
        <p className="font-medium text-foreground">{row.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Stock {row.qty_on_hand} {row.unit}
          {row.qty_on_hand <= row.reorder_level ? (
            <span className="text-destructive"> · low</span>
          ) : null}
          {" · "}
          {formatBtn(row.unit_cost_btn)}/ea
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`par-${row.id}`} className="text-xs text-muted-foreground">
          Par per turnover
        </Label>
        <Input
          id={`par-${row.id}`}
          name="par_qty"
          type="number"
          step="0.001"
          min="0.001"
          defaultValue={row.par_qty}
          required
          className="h-9 w-24 tabular-nums"
        />
      </div>
      <label className="flex h-9 items-center gap-2 text-xs text-foreground">
        <input
          type="checkbox"
          name="is_active"
          defaultChecked={row.is_active}
          className="size-4 accent-accent"
        />
        Active
      </label>
      <Button type="submit" size="sm" disabled={pending} className="h-9">
        {pending ? "Saving…" : "Save"}
      </Button>
      {state.error ? (
        <p className="text-xs text-destructive md:col-span-5" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function SettingsAmenityParsPanel({ rows }: { rows: AmenityParRow[] }) {
  return (
    <section className="rounded-xl border bg-card p-5 md:p-6">
      <div className="mb-4 space-y-1">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Housekeeping
        </p>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Room amenity par levels
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Qty restocked per room turnover when HK completes the amenities checklist.
          Stock deducts from inventory SKUs — edit par without SQL.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No amenity par rows seeded yet. Run the HK amenities migration.
        </p>
      ) : (
        <div className="divide-y rounded-lg border px-4">
          {rows.map((row) => (
            <ParRowForm key={row.id} row={row} />
          ))}
        </div>
      )}
    </section>
  );
}
