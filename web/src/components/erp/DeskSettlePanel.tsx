"use client";

import type { StayHubMoneyPayload } from "@/app/actions/stay-hub";
import { CheckOutForm } from "@/components/erp/CheckInForm";
import {
  IssueInvoiceButton,
  PostCheckInChargesForm,
  VoidLineButton,
} from "@/components/erp/FolioOpsForms";
import { FolioPaymentForm } from "@/components/erp/FolioPaymentForm";
import { FolioRoomPosItemsPanel } from "@/components/erp/FolioRoomPosItemsPanel";
import { Button } from "@/components/ui/button";
import {
  classifyBillLine,
  type BillKind,
} from "@/lib/folio/bill-kinds";
import { formatGuestBtn, roundGuestWholeBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useMemo, useState } from "react";

export type DeskSettlePanelProps = {
  bookingId: string;
  status: string;
  money: StayHubMoneyPayload | null;
  checkIn: string;
  earlyCheckoutFeeBtn?: number | null;
  lateCheckoutFeeBtn?: number | null;
  hasInvoice: boolean;
  onMoneyChanged: () => void;
  onCheckedOut?: () => void;
};

type TabId = "room" | "pos";

/**
 * Tabbed settle: Room | POS · Master footer pay/print/checkout.
 */
export function DeskSettlePanel({
  bookingId,
  status,
  money,
  checkIn,
  earlyCheckoutFeeBtn,
  lateCheckoutFeeBtn,
  hasInvoice,
  onMoneyChanged,
}: DeskSettlePanelProps) {
  const [tab, setTab] = useState<TabId>("room");
  const folioId = money?.folioId ?? null;
  const dues = Number(money?.balanceBtn ?? 0);
  const guestDue = roundGuestWholeBtn(
    Math.max(0, Number(money?.guestVisibleBalanceBtn ?? dues)),
  );
  const isInHouse = status === "checked_in";
  const isCheckedOut = status === "checked_out";

  const lines = money?.lines ?? [];
  const roomLines = useMemo(
    () =>
      lines.filter((l) => {
        if ((l.status ?? "posted") !== "posted") return false;
        const g = classifyBillLine(l);
        return g === "room" || g === "hotel_adj" || g === "other";
      }),
    [lines],
  );
  const posLines = useMemo(
    () =>
      lines.filter((l) => {
        if ((l.status ?? "posted") !== "posted") return false;
        return classifyBillLine(l) === "fnb";
      }),
    [lines],
  );

  const roomTotal = roomLines.reduce((s, l) => s + Number(l.total_btn ?? 0), 0);
  const posTotal = posLines.reduce((s, l) => s + Number(l.total_btn ?? 0), 0);
  const agentRoom = Number(money?.agentChargesBtn ?? 0);
  const paymentMode = (money?.paymentMode ?? "").toLowerCase();

  if (!folioId) {
    return (
      <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
        Folio opens at check-in. Room rent posts day-1; F&B when charged to room.
      </div>
    );
  }

  if (isCheckedOut) {
    return (
      <div className="space-y-3 rounded-lg border bg-card p-4">
        <p className="text-sm font-medium">Guest checked out</p>
        <p className="text-xs text-muted-foreground">
          Level 4 correction (invoice / reopen) — manager / accounts only. Do not
          invent amount edits.
        </p>
        {money?.invoiceDocId ? (
          <Button asChild variant="outline" className="min-h-11">
            <Link
              href={`/erp/invoices/${money.invoiceDocId}/print?bill=master`}
              target="_blank"
            >
              Reprint master invoice
            </Link>
          </Button>
        ) : null}
        <Button asChild variant="ghost" className="min-h-11">
          <Link href={`/erp/folios/${folioId}`}>Open folio / city ledger</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border bg-card p-3 sm:p-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Balance due
          </p>
          <p
            className={cn(
              "mt-0.5 text-2xl font-semibold tabular-nums",
              dues > 0.5 && "text-maroon",
            )}
          >
            {dues > 0.5 ? formatGuestBtn(dues) : "Clear"}
          </p>
          {money?.agentName ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Agent {money.agentName}
              {paymentMode ? ` · ${paymentMode.replace(/_/g, " ")}` : ""}
              {agentRoom > 0.5
                ? ` · rooms on agent ~${formatGuestBtn(agentRoom)}`
                : ""}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>Room {formatGuestBtn(roomTotal)}</span>
          <span aria-hidden>·</span>
          <span>POS {formatGuestBtn(posTotal)}</span>
        </div>
      </div>

      <div
        className="flex gap-1 rounded-lg border bg-muted/30 p-1"
        role="tablist"
      >
        {(
          [
            { id: "room" as const, label: "Room" },
            { id: "pos" as const, label: "POS / other" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "min-h-11 flex-1 rounded-md px-3 text-sm font-medium transition-colors duration-150",
              tab === t.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "room" ? (
        <div className="space-y-4 duration-150 animate-in fade-in">
          {!money?.hasCharges ? (
            <PostCheckInChargesForm
              folioId={folioId}
              defaultDate={checkIn}
            />
          ) : null}
          <LineList
            lines={roomLines}
            empty="No room charges yet."
            onVoided={onMoneyChanged}
          />
          <section className="space-y-2">
            <p className="text-sm font-medium">Collect (room / guest)</p>
            <FolioPaymentForm folioId={folioId} suggestedAmount={guestDue} />
          </section>
          <div className="flex flex-wrap gap-2">
            <PrintBillLinks
              folioId={folioId}
              invoiceDocId={money?.invoiceDocId}
              bill="room"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4 duration-150 animate-in fade-in">
          <LineList
            lines={posLines}
            empty="No F&B / POS on this stay."
            onVoided={onMoneyChanged}
          />
          <FolioRoomPosItemsPanel
            orders={money?.roomPosOrders ?? []}
            onChanged={onMoneyChanged}
          />
          {posLines.length > 0 || (money?.roomPosOrders?.length ?? 0) > 0 ? (
            <section className="space-y-2">
              <p className="text-sm font-medium">Get paid (POS / other)</p>
              <FolioPaymentForm
                folioId={folioId}
                suggestedAmount={Math.max(
                  0,
                  roundGuestWholeBtn(posTotal > 0 ? posTotal : dues),
                )}
              />
            </section>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <PrintBillLinks
              folioId={folioId}
              invoiceDocId={money?.invoiceDocId}
              bill="fnb"
            />
          </div>
        </div>
      )}

      <div className="sticky bottom-0 z-[1] space-y-3 rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur-sm sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Master · room + POS
            </p>
            <p className="text-lg font-semibold tabular-nums">
              {formatGuestBtn(dues)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <IssueInvoiceButton
              folioId={folioId}
              invoiceNo={money?.invoiceNo}
              invoiceDocId={money?.invoiceDocId}
            />
            <PrintBillLinks
              folioId={folioId}
              invoiceDocId={money?.invoiceDocId}
              bill="master"
            />
            <Button asChild variant="outline" className="min-h-11">
              <Link href={`/erp/folios/${folioId}/receipt`}>Receipt</Link>
            </Button>
          </div>
        </div>

        {isInHouse ? (
          <div className="space-y-2 border-t pt-3">
            {agentRoom > 0.5 &&
            Number(money?.guestVisibleBalanceBtn ?? 0) <= 0.5 ? (
              <p className="text-xs text-muted-foreground">
                Guest extras clear — remaining agent room AR can stay open at
                checkout.
              </p>
            ) : null}
            {hasInvoice ? (
              <p className="text-xs text-muted-foreground">
                Tax invoice issued — void/credit note needs manager (L4).
              </p>
            ) : null}
            <CheckOutForm
              bookingId={bookingId}
              rooms={money?.roomLabels ?? []}
              folioBalance={dues}
              earlyFeeDefaultBtn={earlyCheckoutFeeBtn}
              lateFeeDefaultBtn={lateCheckoutFeeBtn}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LineList({
  lines,
  empty,
  onVoided,
}: {
  lines: NonNullable<StayHubMoneyPayload["lines"]>;
  empty: string;
  onVoided: () => void;
}) {
  if (!lines.length) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="divide-y rounded-lg border">
      {lines.map((l) => (
        <li key={l.id} className="space-y-1 px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {l.description || l.source_type}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {l.source_type}
                {l.bill_to ? ` · bill ${l.bill_to}` : ""}
              </p>
            </div>
            <p className="shrink-0 tabular-nums text-sm font-medium">
              {formatGuestBtn(Number(l.total_btn ?? 0))}
            </p>
          </div>
          {l.source_type !== "payment" && Number(l.total_btn ?? 0) > 0 ? (
            <div
              onSubmitCapture={() => {
                window.setTimeout(onVoided, 600);
              }}
            >
              <VoidLineButton
                lineId={l.id}
                description={l.description ?? undefined}
              />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function PrintBillLinks({
  invoiceDocId,
  bill,
}: {
  folioId: string;
  invoiceDocId?: string | null;
  bill: BillKind;
}) {
  if (!invoiceDocId) {
    return (
      <span className="text-xs text-muted-foreground">
        {bill === "master" ? "Master" : bill === "room" ? "Room" : "F&B"} print
        after issue
      </span>
    );
  }
  const label =
    bill === "master"
      ? "Master invoice"
      : bill === "room"
        ? "Room invoice"
        : "F&B invoice";
  return (
    <Button asChild variant="outline" className="min-h-11">
      <Link
        href={`/erp/invoices/${invoiceDocId}/print?bill=${bill}`}
        target="_blank"
      >
        {label}
      </Link>
    </Button>
  );
}
