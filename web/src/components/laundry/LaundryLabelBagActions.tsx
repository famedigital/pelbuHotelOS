"use client";

import { voidDeskLaundryBag } from "@/app/actions/erp-laundry";
import {
  voidLaundryBag,
  type LaundryBagState,
} from "@/app/actions/laundry-bags";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LAUNDRY_BAG_STATUS_LABEL, type LaundryBagStatus } from "@/lib/laundry";
import { useActionState } from "react";

const initial: LaundryBagState = { ok: false };

export function LaundryLabelBagActions({
  bags,
  mode,
}: {
  bags: {
    id: string;
    bag_seq: number;
    public_code: string;
    status: LaundryBagStatus;
    garment_count: number;
  }[];
  mode: "desk" | "staff";
}) {
  if (!bags.length) return null;

  return (
    <section className="rounded-xl border bg-card p-4 print:hidden">
      <h2 className="font-display text-lg">Active bags</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Void a misprinted label before reprinting. Delivered bags cannot be voided.
      </p>
      <ul className="mt-3 space-y-3">
        {bags.map((bag) => (
          <li
            key={bag.id}
            className="rounded-lg border px-3 py-3 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                Bag {bag.bag_seq} · {bag.public_code}
              </span>
              <span className="text-muted-foreground">
                {bag.garment_count} pcs ·{" "}
                {LAUNDRY_BAG_STATUS_LABEL[bag.status]}
              </span>
            </div>
            {bag.status !== "voided" && bag.status !== "delivered" ? (
              <VoidBagInline bagId={bag.id} bagCode={bag.public_code} mode={mode} />
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function VoidBagInline({
  bagId,
  bagCode,
  mode,
}: {
  bagId: string;
  bagCode: string;
  mode: "desk" | "staff";
}) {
  const action = mode === "desk" ? voidDeskLaundryBag : voidLaundryBag;
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-muted-foreground">
        Void bag {bagCode}
      </summary>
      <form action={formAction} className="mt-2 space-y-2">
        <input type="hidden" name="bag_id" value={bagId} />
        <Input
          name="reason"
          placeholder="Void reason"
          maxLength={200}
          required
          className="h-9"
        />
        {state.error ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        {state.message ? (
          <Alert>
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}
        <Button
          type="submit"
          size="sm"
          variant="destructive"
          disabled={pending}
        >
          {pending ? "Voiding…" : "Void bag label"}
        </Button>
      </form>
    </details>
  );
}
