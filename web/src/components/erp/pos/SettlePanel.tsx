"use client";

import { splitSettle, type SplitSettleState } from "@/app/actions/erp-pos";
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
import type { OpenPosTicket, PosTenderMethod } from "@/lib/pos";
import { TriangleAlertIcon } from "lucide-react";
import { useEffect, useMemo, useState, useActionState } from "react";
import type { PosBookingOption, TenderDraft } from "./types";

const initial: SplitSettleState = { ok: false };

const METHOD_LABELS: Record<TenderDraft["method"], string> = {
  cash: "Cash",
  bank: "Bank transfer",
  card: "Card",
  agent_credit: "Agent credit",
  bank_qr: "Bank QR",
  pay_bt: "Pay.bt",
  deposit: "Deposit",
  room_charge: "Room charge",
};

const fieldClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

function nextKey(): string {
  return Math.random().toString(36).slice(2, 9);
}

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(`${checkIn}T00:00:00`).getTime();
  const b = new Date(`${checkOut}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 86_400_000);
}

type Props = {
  orderId: string | null;
  onOpenChange: (open: boolean) => void;
  bookings: PosBookingOption[];
  liveTickets: OpenPosTicket[];
  tenderMethods: readonly PosTenderMethod[];
};

export function SettlePanel({
  orderId,
  onOpenChange,
  bookings,
  liveTickets,
  tenderMethods,
}: Props) {
  const open = orderId !== null;
  const [state, action, pending] = useActionState(splitSettle, initial);
  useActionToast(state, { successMessage: "Order settled" });

  const ticket = useMemo(
    () => liveTickets.find((t) => t.id === orderId) ?? null,
    [liveTickets, orderId],
  );

  const total = ticket?.total_btn ?? 0;
  const [tenders, setTenders] = useState<TenderDraft[]>([]);
  const [cashBuffer, setCashBuffer] = useState<string>("");

  // Reset tenders when the dialog opens for a new order
  useEffect(() => {
    if (!open) return;
    setTenders([{ key: nextKey(), method: "cash", amountBtn: 0 }]);
    setCashBuffer("");
  }, [open, orderId]);

  // Close on success
  useEffect(() => {
    if (state.ok && open) {
      onOpenChange(false);
    }
  }, [state.ok, open, onOpenChange]);

  const tenderSum = useMemo(
    () => tenders.reduce((s, t) => s + (Number(t.amountBtn) || 0), 0),
    [tenders],
  );
  const delta = total - tenderSum;
  const over = delta < -0.01;
  const balanced = Math.abs(delta) <= 0.01;
  const outstanding = Math.abs(delta);

  function addTender(method: TenderDraft["method"]) {
    setTenders((prev) => [
      ...prev,
      { key: nextKey(), method, amountBtn: 0 },
    ]);
  }

  function removeTender(key: string) {
    setTenders((prev) => prev.filter((t) => t.key !== key));
  }

  function updateTender(key: string, patch: Partial<TenderDraft>) {
    setTenders((prev) =>
      prev.map((t) => (t.key === key ? { ...t, ...patch } : t)),
    );
  }

  function applyCashBuffer(key: string) {
    const amount = Number(cashBuffer) || 0;
    if (amount <= 0) return;
    updateTender(key, { amountBtn: Math.round(amount * 100) / 100 });
    setCashBuffer("");
  }

  function addCashDenom(denom: number, key: string) {
    const current = Number(cashBuffer) || 0;
    const next = current + denom;
    setCashBuffer(String(next));
    updateTender(key, { amountBtn: Math.round(next * 100) / 100 });
  }

  const hasRoomCharge = tenders.some((t) => t.method === "room_charge");

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="erp max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settle order</DialogTitle>
          <DialogDescription>
            {ticket ? (
              <>
                <span className="font-mono">{ticket.id.slice(0, 8)}</span>
                {` · ${ticket.customer_name || "Walk-in"}`}
                {` · ${ticket.outlet}`}
              </>
            ) : (
              "Add tenders that sum to the order total."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md bg-muted/40 px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Order total</span>
            <span className="text-xl font-semibold tabular-nums text-foreground">
              {total.toLocaleString("en-BT", { maximumFractionDigits: 2 })} Nu
            </span>
          </div>
        </div>

        {state.error ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <form action={action} className="space-y-4">
          <input type="hidden" name="order_id" value={orderId ?? ""} />
          <input
            type="hidden"
            name="tenders"
            value={JSON.stringify(
              tenders
                .filter((t) => Number(t.amountBtn) > 0)
                .map((t) => ({
                  method: t.method,
                  amountBtn: Number(t.amountBtn),
                  reference: t.reference || undefined,
                  bookingId: t.bookingId || undefined,
                })),
            )}
          />

          <ul className="space-y-3">
            {tenders.map((t) => (
              <li
                key={t.key}
                className="space-y-2 rounded-md border bg-card p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <select
                    className={fieldClass}
                    value={t.method}
                    onChange={(e) =>
                      updateTender(t.key, {
                        method: e.target.value as TenderDraft["method"],
                      })
                    }
                  >
                    {tenderMethods.map((m) => (
                      <option key={m} value={m}>
                        {METHOD_LABELS[m]}
                      </option>
                    ))}
                  </select>
                  {tenders.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 shrink-0"
                      onClick={() => removeTender(t.key)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label
                      htmlFor={`amt_${t.key}`}
                      className="text-[11px] text-muted-foreground"
                    >
                      Amount (Nu)
                    </Label>
                    <Input
                      id={`amt_${t.key}`}
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={t.amountBtn || ""}
                      onChange={(e) =>
                        updateTender(t.key, {
                          amountBtn: Number(e.target.value) || 0,
                        })
                      }
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor={`ref_${t.key}`}
                      className="text-[11px] text-muted-foreground"
                    >
                      Reference
                    </Label>
                    <Input
                      id={`ref_${t.key}`}
                      type="text"
                      value={t.reference ?? ""}
                      onChange={(e) =>
                        updateTender(t.key, { reference: e.target.value })
                      }
                      placeholder="Optional"
                      className="h-9"
                    />
                  </div>
                </div>

                {t.method === "cash" ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {[100, 500, 1000].map((denom) => (
                        <button
                          key={denom}
                          type="button"
                          onClick={() => addCashDenom(denom, t.key)}
                          className="min-h-9 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
                        >
                          + {denom}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setCashBuffer("");
                          updateTender(t.key, { amountBtn: 0 });
                        }}
                        className="min-h-9 rounded-md border border-border bg-card px-3 text-xs text-muted-foreground transition-colors hover:bg-secondary"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateTender(t.key, {
                            amountBtn: Math.round(total * 100) / 100,
                          })
                        }
                        className="min-h-9 rounded-md border border-citrus/40 bg-citrus-tint/60 px-3 text-xs font-medium text-foreground transition-colors hover:bg-citrus-tint"
                      >
                        Exact
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Tap denominations to build the cash amount. Current
                      buffer:{" "}
                      <span className="tabular-nums">
                        {(Number(cashBuffer) || 0).toLocaleString("en-BT")}
                      </span>{" "}
                      Nu
                    </p>
                  </div>
                ) : null}

                {t.method === "room_charge" ? (
                  <div className="space-y-1">
                    <Label
                      htmlFor={`book_${t.key}`}
                      className="text-[11px] text-muted-foreground"
                    >
                      Booking folio
                    </Label>
                    <select
                      id={`book_${t.key}`}
                      className={fieldClass}
                      value={t.bookingId ?? ""}
                      onChange={(e) =>
                        updateTender(t.key, { bookingId: e.target.value })
                      }
                    >
                      <option value="">Select booking</option>
                      {bookings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {(b.contact_name ?? "Guest")} · {b.check_in} →{" "}
                          {b.check_out} · {nightsBetween(b.check_in, b.check_out)}
                          n
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-1.5">
            {tenderMethods.filter(
              (m) => !tenders.some((t) => t.method === m),
            ).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => addTender(m)}
                className="min-h-9 rounded-md border border-dashed border-border px-3 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                + {METHOD_LABELS[m]}
              </button>
            ))}
          </div>

          <div
            className={`flex items-center justify-between rounded-md px-4 py-2.5 text-sm ${
              over
                ? "bg-destructive/5 text-destructive"
                : balanced
                  ? "bg-citrus-tint/60 text-foreground"
                  : "bg-muted/40 text-muted-foreground"
            }`}
          >
            <span>
              {balanced ? "Balanced" : over ? "Over by" : "Remaining"}
            </span>
            <span className="font-semibold tabular-nums">
              {(balanced ? total : outstanding).toLocaleString("en-BT", {
                maximumFractionDigits: 2,
              })}{" "}
              Nu
            </span>
          </div>

          {hasRoomCharge ? (
            <p className="text-[11px] text-muted-foreground">
              Room-charge tenders post to the selected booking folio immediately
              on settle.
            </p>
          ) : null}

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
              variant="citrus"
              disabled={pending || !balanced}
            >
              {pending
                ? "Settling…"
                : balanced
                  ? "Settle"
                  : "Balance the tenders"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
