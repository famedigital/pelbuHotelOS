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
import { tenderMethodLabel } from "@/lib/pos";
import { TriangleAlertIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useActionState } from "react";
import type { PosBookingOption, TenderDraft } from "./types";

const initial: SplitSettleState = { ok: false };

/** Opens a same-named shell so we can navigate it after settle without popup-block. */
function openReceiptShell(): Window | null {
  try {
    const w = window.open("about:blank", "posReceiptPrint");
    if (!w) return null;
    w.document.open();
    w.document.write(
      `<!doctype html><html><head><title>Printing…</title></head>` +
        `<body style="font:14px system-ui;padding:24px;color:#111">` +
        `Settling — preparing guest receipt…</body></html>`,
    );
    w.document.close();
    return w;
  } catch {
    return null;
  }
}

function routeReceiptToWindow(orderId: string, shell: Window | null) {
  const url = `/erp/orders/${orderId}/receipt?print=1`;
  if (shell && !shell.closed) {
    try {
      shell.location.href = url;
      shell.focus();
      return true;
    } catch {
      /* fall through */
    }
  }
  window.location.assign(url);
  return false;
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank: "Bank transfer",
  card: "Card",
  agent_credit: "Agent credit",
  bank_qr: "Bank QR",
  pay_bt: "Pay.bt",
  mbob: "mBoB",
  mpay: "mPay",
  deposit: "Deposit",
  room_charge: "Charge to room",
  comp: "Comp (manager)",
  staff_meal: "Staff meal",
  owner_meal: "Owner meal",
  nc: "Non-chargeable (NC)",
};

function methodLabel(m: string): string {
  return METHOD_LABELS[m] ?? tenderMethodLabel(m);
}

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
  useActionToast(state, {
    // Success opens print dialog — avoid toast fighting the print UI.
    silentSuccess: true,
  });

  const printShellRef = useRef<Window | null>(null);
  const handledOrderRef = useRef<string | null>(null);

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
    handledOrderRef.current = null;
    printShellRef.current = null;
  }, [open, orderId]);

  // On settle success → auto-open paid receipt and trigger browser print.
  useEffect(() => {
    if (!state.ok || !state.orderId) return;
    if (handledOrderRef.current === state.orderId) return;
    handledOrderRef.current = state.orderId;

    const shell = printShellRef.current;
    printShellRef.current = null;
    onOpenChange(false);
    routeReceiptToWindow(state.orderId, shell);
  }, [state.ok, state.orderId, onOpenChange]);

  // Close blank shell if settle fails so cashier isn't stuck with an extra tab.
  useEffect(() => {
    if (!state.error) return;
    const shell = printShellRef.current;
    if (shell && !shell.closed) {
      try {
        shell.close();
      } catch {
        /* ignore */
      }
    }
    printShellRef.current = null;
  }, [state.error]);

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

        <form
          action={action}
          className="space-y-4"
          onSubmit={() => {
            // Open during the click gesture so browsers allow the print window.
            printShellRef.current = openReceiptShell();
          }}
        >
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
                        {methodLabel(m)}
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
                      Reference / slip no
                    </Label>
                    <Input
                      id={`ref_${t.key}`}
                      type="text"
                      value={t.reference ?? ""}
                      onChange={(e) =>
                        updateTender(t.key, { reference: e.target.value })
                      }
                      placeholder={
                        t.method === "cash"
                          ? "Optional"
                          : "Txn, slip, or last 4 digits"
                      }
                      className="h-9"
                    />
                    {t.method !== "cash" && t.method !== "room_charge" ? (
                      <p className="text-[10px] text-muted-foreground">
                        Bank / card / QR transfer id or receipt number for
                        recon.
                      </p>
                    ) : null}
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
                      In-house guest (folio)
                    </Label>
                    <select
                      id={`book_${t.key}`}
                      className={fieldClass}
                      value={t.bookingId ?? ""}
                      onChange={(e) =>
                        updateTender(t.key, { bookingId: e.target.value })
                      }
                      required
                    >
                      <option value="">Select in-house guest</option>
                      {bookings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {(b.rooms.map((r) => r.label).join(", ") || "Room") +
                            " · "}
                          {b.contact_name ?? "Guest"} · {b.check_in} →{" "}
                          {b.check_out} ·{" "}
                          {nightsBetween(b.check_in, b.check_out)}n
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-muted-foreground">
                      Posts to the guest folio now. Guest settles at checkout.
                    </p>
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
                + {methodLabel(m)}
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
              Charge-to-room posts to the guest folio on settle. Tax invoices
              (INV-…) are issued later from that folio, not from this dialog.
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
                  ? "Settle & print"
                  : "Balance the tenders"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
