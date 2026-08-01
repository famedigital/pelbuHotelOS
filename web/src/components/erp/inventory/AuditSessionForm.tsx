"use client";

import {
  postInventoryAudit,
  saveInventoryAuditCounts,
  startInventoryAudit,
  type InvState,
} from "@/app/actions/erp-inventory";
import type { InvLocationOption } from "@/components/erp/InventoryOpsForms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { useActionState } from "react";

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

export type AuditLineRow = {
  id: string;
  item_id: string;
  sku: string;
  name: string;
  unit: string;
  expected_qty: number;
  counted_qty: number | null;
};

export type OpenAudit = {
  id: string;
  business_date: string;
  location_name: string | null;
  lines: AuditLineRow[];
};

export function StartAuditForm({ locations }: { locations: InvLocationOption[] }) {
  const [state, action, pending] = useActionState(startInventoryAudit, initial);
  useActionToast(state, { successMessage: "Audit started" });
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="erp space-y-3 rounded-lg border bg-card p-4">
      <h2 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
        Start count
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="audit_location">Location</Label>
          <select id="audit_location" name="location_id" className={selectClass} defaultValue="">
            <option value="">All locations (combined)</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit_date">Business date</Label>
          <Input id="audit_date" name="business_date" type="date" defaultValue={today} />
        </div>
      </div>
      <Button type="submit" disabled={pending} className="h-10 w-full sm:w-auto">
        {pending ? "Starting…" : "Start audit session"}
      </Button>
      <Flash state={state} />
    </form>
  );
}

export function AuditCountForm({ audit }: { audit: OpenAudit }) {
  const [saveState, saveAction, savePending] = useActionState(
    saveInventoryAuditCounts,
    initial,
  );
  const [postState, postAction, postPending] = useActionState(postInventoryAudit, initial);
  useActionToast(saveState, { successMessage: "Counts saved" });
  useActionToast(postState, { successMessage: "Audit posted" });

  return (
    <section className="space-y-4 rounded-lg border border-accent/30 bg-card p-4">
      <header>
        <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
          Open audit · {audit.business_date}
        </p>
        <p className="text-sm text-muted-foreground">
          {audit.location_name ?? "All locations"} · enter physical counts on phone or desktop
        </p>
      </header>

      <form action={saveAction} className="space-y-3">
        <input type="hidden" name="audit_id" value={audit.id} />
        <div className="max-h-[420px] space-y-2 overflow-y-auto">
          {audit.lines.map((line) => (
            <div
              key={line.id}
              className="grid grid-cols-[1fr_72px_72px] items-center gap-2 border-b pb-2 text-sm sm:grid-cols-[1fr_88px_88px_88px]"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-xs">{line.sku}</p>
                <p className="truncate text-muted-foreground">{line.name}</p>
              </div>
              <div className="text-right tabular-nums text-muted-foreground">
                <span className="text-[10px] uppercase">Exp</span>
                <p>
                  {line.expected_qty} {line.unit}
                </p>
              </div>
              <div>
                <input type="hidden" name="line_id" value={line.id} />
                <Input
                  name="counted_qty"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  defaultValue={line.counted_qty ?? ""}
                  placeholder="Count"
                  className="h-10 text-right tabular-nums"
                  aria-label={`Count ${line.sku}`}
                />
              </div>
              <div className="hidden text-right tabular-nums text-xs sm:block">
                {line.counted_qty != null
                  ? (line.counted_qty - line.expected_qty).toFixed(2)
                  : "—"}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="outline" disabled={savePending} className="h-10">
            {savePending ? "Saving…" : "Save counts"}
          </Button>
        </div>
        <Flash state={saveState} />
      </form>

      <form action={postAction} className="border-t pt-4">
        <input type="hidden" name="audit_id" value={audit.id} />
        <p className="mb-2 text-xs text-muted-foreground">
          Post applies variances to stock. Save counts first.
        </p>
        <Button type="submit" disabled={postPending} className="h-10">
          {postPending ? "Posting…" : "Post audit → adjust stock"}
        </Button>
        <Flash state={postState} />
      </form>
    </section>
  );
}
