"use client";

import { upsertPerformanceTarget } from "@/app/actions/erp-kitchen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionState } from "react";

const initial = { ok: false } as const;

export function PerformanceTargetForm({ yearKey }: { yearKey: string }) {
  const [state, action] = useActionState(upsertPerformanceTarget, initial);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="period_kind" value="year" />
      <input type="hidden" name="period_key" value={yearKey} />
      <div className="space-y-1">
        <Label htmlFor="metric">Metric</Label>
        <select
          id="metric"
          name="metric"
          className="h-9 rounded-md border px-2 text-sm"
          defaultValue="revenue"
        >
          <option value="revenue">Total revenue</option>
          <option value="occupancy">Occupancy %</option>
          <option value="adr">ADR</option>
          <option value="revpar">RevPAR</option>
          <option value="fnb_sales">F&B sales</option>
          <option value="food_cost_pct">Food cost %</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="target_value">Target value</Label>
        <Input
          id="target_value"
          name="target_value"
          type="number"
          min={0}
          step="0.01"
          required
        />
      </div>
      <Button type="submit">Save target</Button>
      {state.message ? <p className="w-full text-xs text-emerald-600">{state.message}</p> : null}
      {state.error ? <p className="w-full text-xs text-destructive">{state.error}</p> : null}
    </form>
  );
}
