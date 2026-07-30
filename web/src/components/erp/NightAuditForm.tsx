"use client";

import { runNightAudit, type ErpFolioOpsState } from "@/app/actions/erp-folio-ops";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { useActionState } from "react";

const initial: ErpFolioOpsState = { ok: false };

export function NightAuditForm({ defaultDate }: { defaultDate: string }) {
  const [state, action, pending] = useActionState(runNightAudit, initial);
  useActionToast(state, { successMessage: "Night audit complete" });
  return (
    <form action={action} className="erp space-y-3 rounded-lg border bg-card p-4">
      <h3 className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
        Run night audit
      </h3>
      <p className="text-xs text-muted-foreground">
        Snapshots occupancy (sellable vs comp), folio charges/payments for the
        business date. One run per date.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="business_date" className="text-xs text-muted-foreground">
          Business date
        </Label>
        <Input
          id="business_date"
          type="date"
          name="business_date"
          defaultValue={defaultDate}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes" className="text-xs text-muted-foreground">
          Notes
        </Label>
        <Input id="notes" name="notes" />
      </div>
      <Button type="submit" variant="citrus" disabled={pending} className="h-10 w-full">
        {pending ? "Running…" : "Complete night audit"}
      </Button>
      {state.ok || state.error ? (
        <p
          className={`text-sm ${state.ok ? "text-foreground" : "text-destructive"}`}
          role="status"
        >
          {state.ok ? state.message : state.error}
        </p>
      ) : null}
    </form>
  );
}
