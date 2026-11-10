"use client";

import {
  registerFixedAsset,
  type InvState,
} from "@/app/actions/erp-inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { formatBtn } from "@/lib/pricing";
import { useActionState } from "react";

const initial: InvState = { ok: false };

export function RegisterAssetForm() {
  const [state, action, pending] = useActionState(registerFixedAsset, initial);
  useActionToast(state, { successMessage: "Asset registered" });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="erp space-y-3 rounded-lg border bg-card p-4">
      <h2 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
        Register asset
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="asset_code">Code</Label>
          <Input id="asset_code" name="asset_code" required placeholder="EQ-001" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="asset_name">Name</Label>
          <Input id="asset_name" name="name" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="asset_category">Category</Label>
          <Input id="asset_category" name="category" defaultValue="equipment" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="purchase_date">Purchase date</Label>
          <Input id="purchase_date" name="purchase_date" type="date" defaultValue={today} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cost_btn">Cost (Nu)</Label>
          <Input id="cost_btn" name="cost_btn" type="number" min="0.01" step="0.01" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="useful_life_months">Useful life (months)</Label>
          <Input id="useful_life_months" name="useful_life_months" type="number" defaultValue="60" min="1" />
        </div>
      </div>
      <Button type="submit" disabled={pending} className="h-10">
        {pending ? "Saving…" : "Register"}
      </Button>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}

export type AssetRow = {
  id: string;
  asset_code: string;
  name: string;
  category: string;
  purchase_date: string;
  cost_btn: number;
  status: string;
};

export function AssetTable({ assets }: { assets: AssetRow[] }) {
  if (assets.length === 0) {
    return (
      <p className="rounded-lg border bg-card px-4 py-8 text-sm text-muted-foreground">
        No fixed assets registered yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="min-w-[640px] w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            {["Code", "Name", "Category", "Purchased", "Cost", "Status"].map((h) => (
              <th
                key={h}
                className="h-10 px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => (
            <tr key={a.id} className="border-t">
              <td className="px-3 py-2.5 font-mono text-xs">{a.asset_code}</td>
              <td className="px-3 py-2.5">{a.name}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{a.category}</td>
              <td className="px-3 py-2.5">{a.purchase_date}</td>
              <td className="px-3 py-2.5 tabular-nums">{formatBtn(a.cost_btn)}</td>
              <td className="px-3 py-2.5 uppercase text-xs">{a.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
