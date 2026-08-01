"use client";

import {
  approvePurchaseOrder,
  createPurchaseOrder,
  receivePurchaseOrder,
  type InvState,
} from "@/app/actions/erp-inventory";
import type { InvItemRow, InvLocationOption } from "@/components/erp/InventoryOpsForms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { formatBtn } from "@/lib/pricing";
import { useActionState, useMemo, useState } from "react";

const initial: InvState = { ok: false };

const selectClass =
  "mt-1.5 flex h-9 w-full items-center rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

function Flash({ state }: { state: InvState }) {
  if (!state.ok && !state.error) return null;
  return (
    <p
      className={`erp mt-2 text-sm ${state.ok ? "text-foreground" : "text-destructive"}`}
      role="status"
    >
      {state.ok ? state.message : state.error}
    </p>
  );
}

export type PoLineRow = {
  id: string;
  item_id: string | null;
  sku_snapshot: string | null;
  name_snapshot: string;
  qty_ordered: number;
  qty_received: number;
  unit_cost_btn: number;
};

export type PoRow = {
  id: string;
  po_number: string;
  vendor_name: string | null;
  status: string;
  notes: string | null;
  receive_location_id: string | null;
  lines: PoLineRow[];
};

export function CreatePurchaseOrderForm({
  items,
  locations,
}: {
  items: InvItemRow[];
  locations: InvLocationOption[];
}) {
  const [state, action, pending] = useActionState(createPurchaseOrder, initial);
  useActionToast(state, { successMessage: "PO created" });
  const [rows, setRows] = useState([{ itemId: items[0]?.id ?? "", qty: "1", cost: "" }]);
  const storeId = locations.find((l) => l.code === "STORE")?.id ?? locations[0]?.id ?? "";

  return (
    <form action={action} className="erp space-y-4 rounded-lg border bg-card p-4">
      <h2 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
        New purchase order
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="po_vendor">Vendor</Label>
          <Input id="po_vendor" name="vendor_name" required placeholder="Supplier name" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="po_location">Receive into</Label>
          <select
            id="po_location"
            name="receive_location_id"
            defaultValue={storeId}
            className={selectClass}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="po_notes">Notes</Label>
        <Input id="po_notes" name="notes" placeholder="Optional" />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Line items</p>
        {rows.map((row, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_80px_100px]">
            <select
              name="line_item_id"
              required
              defaultValue={row.itemId}
              className={selectClass}
              onChange={(e) => {
                const next = [...rows];
                next[i] = { ...next[i], itemId: e.target.value };
                setRows(next);
              }}
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku} · {item.name}
                </option>
              ))}
            </select>
            <Input name="line_qty" type="number" min="0.001" step="any" defaultValue={row.qty} required placeholder="Qty" />
            <Input name="line_unit_cost" type="number" min="0" step="0.01" placeholder="Unit Nu" />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setRows([...rows, { itemId: items[0]?.id ?? "", qty: "1", cost: "" }])
          }
        >
          + Line
        </Button>
      </div>

      <Button type="submit" disabled={pending || items.length === 0} className="h-10">
        {pending ? "Saving…" : "Create draft PO"}
      </Button>
      <Flash state={state} />
    </form>
  );
}

export function PurchaseOrderDetail({
  po,
}: {
  po: PoRow;
}) {
  const [approveState, approveAction, approvePending] = useActionState(
    approvePurchaseOrder,
    initial,
  );
  const [receiveState, receiveAction, receivePending] = useActionState(
    receivePurchaseOrder,
    initial,
  );
  useActionToast(approveState, { successMessage: "PO approved" });
  useActionToast(receiveState, { successMessage: "Stock received" });

  const canApprove = po.status === "draft";
  const canReceive = po.status === "ordered" || po.status === "partial";
  const totalOrdered = useMemo(
    () => po.lines.reduce((s, l) => s + l.qty_ordered * l.unit_cost_btn, 0),
    [po.lines],
  );

  return (
    <article className="rounded-lg border bg-card p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-sm font-semibold">{po.po_number}</p>
          <p className="text-sm text-muted-foreground">{po.vendor_name ?? "—"}</p>
        </div>
        <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase">
          {po.status}
        </span>
      </header>

      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {["SKU", "Qty ord", "Rcvd", "Unit", "Receive"].map((h) => (
              <th key={h} className="py-2 pr-2 font-semibold uppercase">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {po.lines.map((l) => {
            const remaining = l.qty_ordered - l.qty_received;
            return (
              <tr key={l.id} className="border-t">
                <td className="py-2 pr-2">
                  <span className="font-mono text-xs">{l.sku_snapshot}</span>
                  <span className="block text-muted-foreground">{l.name_snapshot}</span>
                </td>
                <td className="py-2 pr-2 tabular-nums">{l.qty_ordered}</td>
                <td className="py-2 pr-2 tabular-nums">{l.qty_received}</td>
                <td className="py-2 pr-2 tabular-nums">{formatBtn(l.unit_cost_btn)}</td>
                <td className="py-2 pr-2">
                  {canReceive && remaining > 0 ? (
                    <span className="text-xs text-muted-foreground">↓ form</span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">
        Est. total {formatBtn(totalOrdered)}
      </p>

      {canApprove ? (
        <form action={approveAction} className="mt-4">
          <input type="hidden" name="po_id" value={po.id} />
          <Button type="submit" disabled={approvePending} variant="outline" className="h-9">
            {approvePending ? "Approving…" : "Approve → ordered"}
          </Button>
          <Flash state={approveState} />
        </form>
      ) : null}

      {canReceive ? (
        <form action={receiveAction} className="mt-4 space-y-3 border-t pt-4">
          <input type="hidden" name="po_id" value={po.id} />
          <p className="text-xs font-medium text-muted-foreground">Receive into stock</p>
          {po.lines
            .filter((l) => l.qty_ordered - l.qty_received > 0)
            .map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="line_id" value={l.id} />
                <span className="min-w-[120px] font-mono text-xs">{l.sku_snapshot}</span>
                <Input
                  name="receive_qty"
                  type="number"
                  min="0"
                  max={l.qty_ordered - l.qty_received}
                  step="any"
                  placeholder={`Max ${l.qty_ordered - l.qty_received}`}
                  className="h-8 w-28"
                />
              </div>
            ))}
          <Button type="submit" disabled={receivePending} className="h-9">
            {receivePending ? "Receiving…" : "Receive selected"}
          </Button>
          <Flash state={receiveState} />
        </form>
      ) : null}
    </article>
  );
}
