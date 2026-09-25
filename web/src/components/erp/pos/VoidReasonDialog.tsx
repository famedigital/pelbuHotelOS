"use client";

import {
  voidOrderOrItem,
  type PosActionState,
} from "@/app/actions/erp-pos";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/hooks/use-action-toast";
import type {
  OpenPosTicket,
  PosVoidReasonCode,
} from "@/lib/pos";
import { TriangleAlertIcon } from "lucide-react";
import { useEffect, useMemo, useState, useActionState } from "react";

const initial: PosActionState = { ok: false };

const REASON_LABELS: Record<string, string> = {
  guest_change: "Guest changed mind",
  kitchen_error: "Kitchen error",
  wrong_item: "Wrong item",
  comp: "Comp (manager)",
  manager_comp: "Manager comp",
  duplicate: "Duplicate",
  training: "Training",
  other: "Other",
};

const fieldClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type Props = {
  orderId: string | null;
  onOpenChange: (open: boolean) => void;
  /** Optional ticket context to surface amount and gate manager PIN. */
  ticket?: OpenPosTicket | null;
  /** When set, voids this line only instead of the whole ticket. */
  orderItemId?: string | null;
  voidReasonCodes: readonly PosVoidReasonCode[];
  voidManagerThresholdBtn: number;
};

export function VoidReasonDialog({
  orderId,
  onOpenChange,
  ticket,
  orderItemId = null,
  voidReasonCodes,
  voidManagerThresholdBtn,
}: Props) {
  const open = orderId !== null;
  const lineMode = Boolean(orderItemId);
  const line = lineMode
    ? (ticket?.order_items.find((i) => i.id === orderItemId) ?? null)
    : null;
  const [state, action, pending] = useActionState(voidOrderOrItem, initial);
  useActionToast(state, {
    successMessage: lineMode ? "Item taken off the bill" : "Order voided",
  });

  const [reasonCode, setReasonCode] = useState<string>("guest_change");
  const [needsPin, setNeedsPin] = useState(false);

  const amount = line
    ? line.unit_price_btn * line.qty
    : (ticket?.total_btn ?? 0);

  useEffect(() => {
    if (open) {
      setReasonCode("guest_change");
    }
  }, [open, orderId]);

  useEffect(() => {
    if (!open) return;
    const requires =
      amount >= voidManagerThresholdBtn ||
      reasonCode === "comp" ||
      reasonCode === "manager_comp";
    setNeedsPin(requires);
  }, [open, amount, reasonCode, voidManagerThresholdBtn]);

  // Parent remounts this dialog (key) on each open so ok does not stick true.
  useEffect(() => {
    if (state.ok && open) {
      onOpenChange(false);
    }
  }, [state.ok, open, onOpenChange]);

  const resolvedTicket = useMemo(() => ticket ?? null, [ticket]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="erp sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {lineMode ? "Void line" : "Void order"}
          </DialogTitle>
          <DialogDescription>
            {resolvedTicket ? (
              <>
                <span className="font-mono">
                  {resolvedTicket.id.slice(0, 8)}
                </span>
                {` · ${resolvedTicket.customer_name || "Walk-in"}`}
                {line
                  ? ` · ${line.qty}× ${line.name_snapshot}`
                  : ` · ${resolvedTicket.total_btn.toLocaleString("en-BT", {
                      maximumFractionDigits: 2,
                    })} Nu`}
              </>
            ) : (
              "Select a reason. Manager PIN is required for comps or large amounts."
            )}
          </DialogDescription>
        </DialogHeader>

        {state.error ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        {needsPin ? (
          <Alert variant="warning">
            <TriangleAlertIcon />
            <AlertDescription>
              Manager PIN required — high amount or comp reason selected.
            </AlertDescription>
          </Alert>
        ) : null}

        <form action={action} className="space-y-4">
          <input type="hidden" name="order_id" value={orderId ?? ""} />
          {orderItemId ? (
            <input type="hidden" name="order_item_id" value={orderItemId} />
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="void_reason_code">Reason</Label>
            <select
              id="void_reason_code"
              name="reason_code"
              className={fieldClass}
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
            >
              {voidReasonCodes.map((code) => (
                <option key={code} value={code}>
                  {REASON_LABELS[code] ?? code}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="void_reason_text">Note (optional)</Label>
            <Input
              id="void_reason_text"
              type="text"
              name="reason_text"
              placeholder="Add context for audit log"
            />
          </div>

          {needsPin ? (
            <div className="space-y-1.5">
              <Label htmlFor="void_manager_pin">Manager PIN</Label>
              <Input
                id="void_manager_pin"
                type="password"
                name="manager_pin"
                inputMode="numeric"
                autoComplete="off"
                required
              />
            </div>
          ) : null}

          <input type="hidden" name="manager_staff_id" value="" />

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={pending}
            >
              {pending ? "Voiding…" : `Void ${lineMode ? "line" : "order"}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
