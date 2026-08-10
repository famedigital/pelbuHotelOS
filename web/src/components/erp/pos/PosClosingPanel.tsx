"use client";

import {
  closePosShift,
  openPosShift,
  type PosShiftState,
} from "@/app/actions/erp-pos";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionToast } from "@/hooks/use-action-toast";
import { orderRef } from "@/lib/order-ref";
import type { OpenPosTicket, PosShift, PosShiftCloseSummary } from "@/lib/pos";
import { tenderMethodLabel } from "@/lib/pos";
import { formatBtn, roundBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

const initial: PosShiftState = { ok: false };

function methodLabel(method: string): string {
  return tenderMethodLabel(method);
}

type Props = {
  shift: PosShift | null;
  /** Live shift Z-preview; null when no open shift / not loaded. */
  closeSummary?: PosShiftCloseSummary | null;
  onSettleTicket?: (orderId: string) => void;
  onVoidTicket?: (orderId: string) => void;
};

export function PosClosingPanel({
  shift,
  closeSummary = null,
  onSettleTicket,
  onVoidTicket,
}: Props) {
  const [openState, openAction, opening] = useActionState(openPosShift, initial);
  const [closeState, closeAction, closing] = useActionState(
    closePosShift,
    initial,
  );
  useActionToast(openState, { successMessage: "POS shift opened" });
  useActionToast(closeState, { successMessage: "POS shift closed" });

  const [countedCash, setCountedCash] = useState("");

  if (!shift) {
    return (
      <section className="mx-auto w-full max-w-xl space-y-4">
        <header className="rounded-xl border bg-card p-5">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Cash drawer
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">
            Open POS shift
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Count the starting cash before taking guest payments. Shift open/close
            is not night audit.
          </p>
        </header>

        {openState.error ? (
          <Alert variant="destructive">
            <AlertDescription>{openState.error}</AlertDescription>
          </Alert>
        ) : null}

        <form
          action={openAction}
          className="space-y-4 rounded-xl border bg-card p-5"
        >
          <div className="space-y-1.5">
            <Label htmlFor="opening_float_btn">Opening float (Nu)</Label>
            <Input
              id="opening_float_btn"
              name="opening_float_btn"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              defaultValue="0"
              required
              className="h-11 text-base tabular-nums"
            />
            <p className="text-xs text-muted-foreground">
              Physical cash in the drawer at open. Included in expected cash at
              close.
            </p>
          </div>
          <Button
            type="submit"
            variant="citrus"
            className="h-11 w-full sm:w-auto"
            disabled={opening}
          >
            {opening ? "Opening…" : "Open shift"}
          </Button>
        </form>
      </section>
    );
  }

  const openTickets = closeSummary?.openTickets ?? [];
  const hasOpen = openTickets.length > 0;
  const expectedCash = closeSummary?.expectedCashBtn ?? shift.opening_float_btn;
  const countedNum = Number(countedCash);
  const hasCounted =
    countedCash.trim() !== "" && Number.isFinite(countedNum) && countedNum >= 0;
  const variance = hasCounted
    ? roundBtn(countedNum - expectedCash)
    : null;

  return (
    <section className="mx-auto w-full max-w-2xl space-y-4">
      <header className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
              Cash drawer
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              Close POS shift
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Opened by {shift.opened_by_name} ·{" "}
              {new Date(shift.opened_at).toLocaleString("en-BT")}
              {shift.business_date ? ` · ${shift.business_date}` : null}
            </p>
          </div>
          <Badge
            variant={hasOpen ? "destructive" : "secondary"}
            className="shrink-0"
          >
            {hasOpen
              ? `${openTickets.length} open ticket${openTickets.length === 1 ? "" : "s"}`
              : "Ready to close"}
          </Badge>
        </div>
      </header>

      <ShiftSummaryCards summary={closeSummary} shift={shift} />

      <XReportPrintBlock shift={shift} summary={closeSummary} />

      <OpenTicketsBlock
        tickets={openTickets}
        onSettle={onSettleTicket}
        onVoid={onVoidTicket}
      />

      {closeState.error ? (
        <Alert variant="destructive">
          <AlertDescription>{closeState.error}</AlertDescription>
        </Alert>
      ) : null}
      {closeState.ok && closeState.message ? (
        <Alert>
          <AlertDescription>{closeState.message}</AlertDescription>
        </Alert>
      ) : null}

      <form
        action={closeAction}
        className="space-y-4 rounded-xl border bg-card p-5"
      >
        <input type="hidden" name="shift_id" value={shift.id} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="counted_cash_btn">Counted drawer cash (Nu)</Label>
            <Input
              id="counted_cash_btn"
              name="counted_cash_btn"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              required
              value={countedCash}
              onChange={(e) => setCountedCash(e.target.value)}
              className="h-11 text-base tabular-nums"
              disabled={hasOpen}
              placeholder={String(expectedCash)}
            />
            <p className="text-xs text-muted-foreground">
              Include the opening float. Expected drawer = float + cash tenders
              only.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Variance (live)</Label>
            <div
              className={cn(
                "flex h-11 items-center rounded-md border px-3 text-base font-semibold tabular-nums",
                variance == null && "bg-secondary/30 text-muted-foreground",
                variance != null &&
                  Math.abs(variance) < 0.005 &&
                  "border-emerald-500/40 bg-emerald-500/10 text-emerald-900",
                variance != null &&
                  Math.abs(variance) >= 0.005 &&
                  "border-amber-500/40 bg-amber-500/10 text-amber-950",
              )}
              aria-live="polite"
            >
              {variance == null
                ? "Enter counted cash"
                : `${variance > 0 ? "+" : ""}${formatBtn(variance)}`}
            </div>
            <p className="text-xs text-muted-foreground">
              Variance = counted − expected ({formatBtn(expectedCash)}).
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="manager_pin">Manager PIN</Label>
            <Input
              id="manager_pin"
              name="manager_pin"
              type="password"
              autoComplete="off"
              required
              disabled={hasOpen}
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              Desk PIN,{" "}
              <code className="text-[11px]">POS_MANAGER_PIN</code>, or owner/GM
              staff PIN.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="close_notes">Handover notes</Label>
            <Textarea
              id="close_notes"
              name="notes"
              maxLength={500}
              rows={3}
              disabled={hasOpen}
              className="min-h-[2.75rem] resize-y"
              placeholder="Optional notes for night audit"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            This is the cashier <strong>X/Z</strong> (shift close). Hotel day roll
            remains{" "}
            <Link
              href="/erp/night-audit"
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              Night audit
            </Link>
            . F&amp;B flash:{" "}
            <Link
              href="/erp/kitchen/day-pack"
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              Restaurant day pack
            </Link>
            .
          </p>
          <Button
            type="submit"
            variant={hasOpen ? "secondary" : "citrus"}
            className="h-11 w-full sm:w-auto sm:min-w-[12rem]"
            disabled={closing || hasOpen}
          >
            {closing
              ? "Reconciling…"
              : hasOpen
                ? "Settle open tickets first"
                : "Close shift"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function ShiftSummaryCards({
  summary,
  shift,
}: {
  summary: PosShiftCloseSummary | null;
  shift: PosShift;
}) {
  const float = summary?.openingFloatBtn ?? shift.opening_float_btn;
  const cash = summary?.cashTendersBtn ?? 0;
  const expected = summary?.expectedCashBtn ?? float;
  const sales = summary?.salesTotalBtn ?? 0;
  const settled = summary?.settledCount ?? 0;
  const voided = summary?.voidedCount ?? 0;
  const voidTotal = summary?.voidTotalBtn ?? 0;
  const tenderLines = summary?.tenderLines ?? [];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Opening float" value={formatBtn(float)} />
        <StatTile label="Cash tenders" value={formatBtn(cash)} tone="accent" />
        <StatTile
          label="Expected drawer"
          value={formatBtn(expected)}
          tone="strong"
        />
        <StatTile label="All tenders" value={formatBtn(sales)} />
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Payment mix this shift
          </p>
          <p className="text-xs text-muted-foreground">
            {settled} settled
            {voided > 0 ? ` · ${voided} voided (${formatBtn(voidTotal)})` : null}
          </p>
        </div>
        {tenderLines.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No settlements yet. Expected drawer is the opening float only.
          </p>
        ) : (
          <ul className="mt-3 divide-y">
            {tenderLines.map((line) => (
              <li
                key={line.method}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="text-foreground">
                  {methodLabel(line.method)}
                </span>
                <span className="font-medium tabular-nums">
                  {formatBtn(line.amountBtn)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Expected cash = float + cash only. Card, bank, room charge, and QR do
          not go in the drawer.
        </p>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "accent" | "strong";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-3",
        tone === "default" && "bg-card",
        tone === "accent" && "border-accent/30 bg-accent/5",
        tone === "strong" && "border-sky-500/25 bg-sky-500/5",
      )}
    >
      <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums tracking-tight sm:text-base">
        {value}
      </p>
    </div>
  );
}

function OpenTicketsBlock({
  tickets,
  onSettle,
  onVoid,
}: {
  tickets: OpenPosTicket[];
  onSettle?: (orderId: string) => void;
  onVoid?: (orderId: string) => void;
}) {
  const totalOpen = useMemo(
    () => roundBtn(tickets.reduce((s, t) => s + Number(t.total_btn), 0)),
    [tickets],
  );

  if (tickets.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
          No open tickets on this shift
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Kitchen-served tickets that still need payment also count as open. You
          can close when the drawer is counted.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-amber-900/80 uppercase dark:text-amber-200/90">
            Block close · {tickets.length} ticket
            {tickets.length === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Settle or void each ticket ({formatBtn(totalOpen)} open total).
            Includes served, unpaid bills that no longer show on the kitchen
            board.
          </p>
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {tickets.map((t) => (
          <li
            key={t.id}
            className="rounded-lg border border-border/80 bg-card p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate text-sm font-medium">
                    {t.customer_name?.trim() || "Walk-in"}
                  </p>
                  <Badge variant="secondary" className="capitalize">
                    {t.kot_status}
                  </Badge>
                  {t.is_parked ? (
                    <Badge variant="outline">Parked</Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  <span className="font-mono">{orderRef(t.id)}</span>
                  {` · ${t.outlet}`}
                  {t.covers ? ` · ${t.covers} covers` : ""}
                </p>
              </div>
              <p className="text-sm font-semibold tabular-nums">
                {formatBtn(t.total_btn)}
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="citrus"
                size="sm"
                className="h-9"
                disabled={!onSettle}
                onClick={() => onSettle?.(t.id)}
              >
                Settle
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                disabled={!onVoid}
                onClick={() => onVoid?.(t.id)}
              >
                Void
              </Button>
              <Button asChild type="button" variant="ghost" size="sm" className="h-9">
                <Link href={`/erp/orders/${t.id}/slip`}>Slip</Link>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Printable tender sheet — X report while shift open; becomes Z after close. */
function XReportPrintBlock({
  shift,
  summary,
}: {
  shift: PosShift;
  summary: PosShiftCloseSummary | null;
}) {
  return (
    <div
      id="pos-x-report"
      className="rounded-xl border bg-card p-5 print:border-black"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            X report · shift tenders
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {shift.business_date} · opened {shift.opened_by_name} ·{" "}
            {new Date(shift.opened_at).toLocaleString("en-BT")}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="print:hidden"
          onClick={() => window.print()}
        >
          Print tender sheet
        </Button>
      </div>
      <ul className="mt-4 space-y-1.5 text-sm">
        {(summary?.tenderLines ?? []).map((line) => (
          <li key={line.method} className="flex justify-between tabular-nums">
            <span>{methodLabel(line.method)}</span>
            <span>{formatBtn(line.amountBtn)}</span>
          </li>
        ))}
        {!(summary?.tenderLines?.length) ? (
          <li className="text-muted-foreground">No tenders yet this shift.</li>
        ) : null}
      </ul>
      <div className="mt-4 grid gap-2 border-t pt-3 text-sm sm:grid-cols-2">
        <p>
          Sales total:{" "}
          <strong className="tabular-nums">
            {formatBtn(summary?.salesTotalBtn ?? 0)}
          </strong>
        </p>
        <p>
          Expected cash:{" "}
          <strong className="tabular-nums">
            {formatBtn(summary?.expectedCashBtn ?? shift.opening_float_btn)}
          </strong>
        </p>
        <p>
          Voids: {summary?.voidedCount ?? 0} ·{" "}
          {formatBtn(summary?.voidTotalBtn ?? 0)}
        </p>
        <p>Open tickets blocking close: {summary?.openCount ?? 0}</p>
      </div>
      <div className="mt-6 grid gap-6 sm:grid-cols-2 print:mt-10">
        <div className="border-t pt-8 text-xs text-muted-foreground">
          Cashier sign / initial
        </div>
        <div className="border-t pt-8 text-xs text-muted-foreground">
          Manager sign / initial
        </div>
      </div>
    </div>
  );
}
