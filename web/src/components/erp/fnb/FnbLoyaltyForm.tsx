"use client";

import type { FnbLogState } from "@/app/actions/erp-fnb-ops";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import { useActionState } from "react";

const initial: FnbLogState = { ok: false };

export function FnbLoyaltyForm({
  action,
}: {
  action: (prev: FnbLogState, fd: FormData) => Promise<FnbLogState>;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  useActionToast(state, { successMessage: state.message ?? "Updated" });
  return (
    <form action={formAction} className="space-y-3 rounded-xl border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" required className="h-9" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="guest_name">Name</Label>
          <Input id="guest_name" name="guest_name" className="h-9" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="stamps">Stamps to add</Label>
          <Input
            id="stamps"
            name="stamps"
            type="number"
            min={1}
            defaultValue={1}
            className="h-9"
          />
        </div>
      </div>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add stamp"}
      </Button>
    </form>
  );
}
