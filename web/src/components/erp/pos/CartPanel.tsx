"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDownIcon, MinusIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CartLine } from "./types";

type Totals = {
  subtotalBtn: number;
  serviceChargeBtn: number;
  gstBtn: number;
  totalBtn: number;
};

type Props = {
  cart: CartLine[];
  totals: Totals;
  lineCount: number;
  pending: boolean;
  gstRate: number;
  servicePercent: string;
  serviceReason: string;
  applyServiceCharge: boolean;
  /** Default from property settings — used to auto-open the service disclosure on override. */
  serviceChargeDefaultOn?: boolean;
  onApplyServiceChargeChange: (v: boolean) => void;
  onServicePercentChange: (v: string) => void;
  onServiceReasonChange: (v: string) => void;
  onInc: (key: string) => void;
  onDec: (key: string) => void;
  onRemove: (key: string) => void;
  onClear: () => void;
  onEditLine: (key: string) => void;
  /**
   * The panel renders twice (desktop aside + mobile sheet) inside the same
   * form, so every control id needs a unique prefix.
   */
  idPrefix: string;
};

function lineUnit(line: CartLine): number {
  const modTotal = line.modifierSnapshots.reduce(
    (s, m) => s + m.priceBtn * m.qty,
    0,
  );
  return line.unitPriceBtn + modTotal;
}

export function CartPanel({
  cart,
  totals,
  lineCount,
  pending,
  gstRate,
  servicePercent,
  serviceReason,
  applyServiceCharge,
  serviceChargeDefaultOn = true,
  onApplyServiceChargeChange,
  onServicePercentChange,
  onServiceReasonChange,
  onInc,
  onDec,
  onRemove,
  onClear,
  onEditLine,
  idPrefix,
}: Props) {
  const gstPct = Math.round(gstRate * 10000) / 100;
  const servicePct = servicePercent || "0";
  const applyId = `${idPrefix}_apply_service`;
  const pctId = `${idPrefix}_service_pct`;
  const reasonId = `${idPrefix}_service_reason`;
  const dense = cart.length >= 6;
  const listRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(cart.length);

  const serviceOverridden =
    Boolean(serviceReason.trim()) ||
    applyServiceCharge !== serviceChargeDefaultOn;

  const [serviceOpen, setServiceOpen] = useState(serviceOverridden);

  useEffect(() => {
    if (serviceOverridden) setServiceOpen(true);
  }, [serviceOverridden]);

  useEffect(() => {
    const grew = cart.length > prevCountRef.current;
    prevCountRef.current = cart.length;
    if (!grew || cart.length === 0) return;
    const root = listRef.current;
    if (!root) return;
    const last = root.querySelector("li:last-child");
    if (last instanceof HTMLElement) {
      last.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [cart.length]);

  return (
    <div className="erp flex max-h-[calc(85dvh-2rem)] w-full flex-col overflow-hidden rounded-xl border bg-card lg:max-h-[calc(100dvh-1.5rem)]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Ticket
          </p>
          <span className="text-xs text-muted-foreground">
            {lineCount > 0 ? `${lineCount} items` : "Empty"}
          </span>
        </div>
        {cart.length > 0 ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Trash2Icon className="size-3.5" />
            Clear
          </button>
        ) : null}
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">No items yet</p>
            <p className="text-xs text-muted-foreground">
              Tap menu tiles to build the ticket.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {cart.map((line) => {
              const unit = lineUnit(line);
              return (
                <li
                  key={line.key}
                  className={dense ? "px-3 py-1.5" : "px-3 py-2"}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onEditLine(line.key)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-medium text-foreground hover:text-accent">
                        {line.name}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        Course {line.courseNo}
                        {line.seatNo ? ` · Seat ${line.seatNo}` : ""}
                        {` · ${unit.toLocaleString("en-BT", {
                          maximumFractionDigits: 2,
                        })} Nu each`}
                      </p>
                    </button>

                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => onDec(line.key)}
                        className="inline-flex size-8 items-center justify-center rounded-md border border-input text-foreground transition-colors hover:bg-secondary"
                        aria-label={`Decrease ${line.name}`}
                      >
                        <MinusIcon className="size-3.5" />
                      </button>
                      <span
                        className="w-6 text-center text-sm tabular-nums text-foreground"
                        aria-live="polite"
                      >
                        {line.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => onInc(line.key)}
                        className="inline-flex size-8 items-center justify-center rounded-md border border-input text-foreground transition-colors hover:bg-secondary"
                        aria-label={`Increase ${line.name}`}
                      >
                        <PlusIcon className="size-3.5" />
                      </button>
                    </div>

                    <span className="w-16 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
                      {(unit * line.qty).toLocaleString("en-BT", {
                        maximumFractionDigits: 2,
                      })}
                    </span>

                    <button
                      type="button"
                      onClick={() => onRemove(line.key)}
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/5"
                      aria-label={`Remove ${line.name}`}
                      title="Remove"
                    >
                      <Trash2Icon className="size-3.5" />
                    </button>
                  </div>

                  {line.modifierSnapshots.length > 0 ? (
                    <ul className="mt-1 flex flex-wrap gap-1">
                      {line.modifierSnapshots.map((m) => (
                        <li
                          key={`${m.groupId}:${m.optionId}`}
                          className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {m.qty > 1 ? `${m.qty}× ` : ""}
                          {m.name}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {line.lineNotes && !dense ? (
                    <p className="mt-1 text-[11px] italic text-muted-foreground">
                      “{line.lineNotes}”
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="shrink-0 space-y-2.5 border-t bg-card px-3 py-3">
        <div className="rounded-md border bg-muted/30">
          <button
            type="button"
            onClick={() => setServiceOpen((v) => !v)}
            className="flex h-9 w-full items-center justify-between gap-2 px-3 text-left text-sm text-foreground"
            aria-expanded={serviceOpen}
          >
            <span>
              {applyServiceCharge
                ? `Service ${servicePct}%`
                : "Service waived"}
              {serviceReason.trim() ? (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  · {serviceReason.trim()}
                </span>
              ) : null}
            </span>
            <ChevronDownIcon
              className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                serviceOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {serviceOpen ? (
            <div className="space-y-2 border-t px-3 py-2.5">
              <div className="flex h-9 items-center gap-2">
                <Checkbox
                  id={applyId}
                  checked={applyServiceCharge}
                  onCheckedChange={(v) =>
                    onApplyServiceChargeChange(Boolean(v))
                  }
                />
                <Label htmlFor={applyId} className="text-sm text-foreground">
                  Apply service charge
                </Label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label
                    htmlFor={pctId}
                    className="text-[11px] text-muted-foreground"
                  >
                    Service %
                  </Label>
                  <Input
                    id={pctId}
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={servicePercent}
                    onChange={(e) => onServicePercentChange(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor={reasonId}
                    className="text-[11px] text-muted-foreground"
                  >
                    Reason / note
                  </Label>
                  <Input
                    id={reasonId}
                    type="text"
                    value={serviceReason}
                    onChange={(e) => onServiceReasonChange(e.target.value)}
                    placeholder={
                      applyServiceCharge ? "Override reason" : "Waiver note"
                    }
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-1 text-sm">
          <Row label="Subtotal" value={totals.subtotalBtn} />
          <Row
            label={`Service${applyServiceCharge ? ` (${servicePct}%)` : " (waived)"}`}
            value={totals.serviceChargeBtn}
          />
          <Row label={`GST (${gstPct}%)`} value={totals.gstBtn} />
          <div className="mt-1 flex justify-between border-t pt-2 text-base font-semibold text-foreground">
            <span>Total</span>
            <span className="tabular-nums">
              {totals.totalBtn.toLocaleString("en-BT", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}{" "}
              Nu
            </span>
          </div>
        </div>

        <div className="grid gap-2">
          <Button
            type="submit"
            name="is_parked"
            value="0"
            variant="citrus"
            size="lg"
            disabled={pending || cart.length === 0}
            className="w-full"
          >
            {pending
              ? "Sending…"
              : cart.length === 0
                ? "Add items to send"
                : "Send to kitchen"}
          </Button>
          <Button
            type="submit"
            name="is_parked"
            value="1"
            variant="outline"
            size="lg"
            disabled={pending || cart.length === 0}
            className="w-full"
          >
            {pending ? "Parking…" : "Park ticket"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">
        {value.toLocaleString("en-BT", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })}{" "}
        Nu
      </span>
    </div>
  );
}
