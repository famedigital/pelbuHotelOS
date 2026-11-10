"use client";

import {
  setPartnerDiscount,
  type PartnerDiscountState,
} from "@/app/actions/erp-partners";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActionToast } from "@/hooks/use-action-toast";
import { useActionState } from "react";

const initial: PartnerDiscountState = { ok: false };

export function PartnerDiscountForm({
  kind,
  partnerId,
  discountPct,
}: {
  kind: "guide" | "driver";
  partnerId: string;
  discountPct: number;
}) {
  const [state, action, pending] = useActionState(setPartnerDiscount, initial);
  useActionToast(state, { successMessage: "Discount saved" });

  return (
    <form action={action} className="flex items-center gap-1">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="partner_id" value={partnerId} />
      <Input
        name="discount_pct"
        type="number"
        min={0}
        max={100}
        step={0.5}
        defaultValue={discountPct}
        aria-label="Discount percent"
        className="h-8 w-16 text-xs tabular-nums"
      />
      <span className="text-[10px] text-muted-foreground">%</span>
      <Button type="submit" size="sm" variant="ghost" disabled={pending} className="h-8 px-2 text-xs">
        {pending ? "…" : "Save"}
      </Button>
    </form>
  );
}
