"use client";

import { openMasterBillPrint } from "@/app/actions/erp-folio-ops";
import type { StayHubMoneyPayload } from "@/app/actions/stay-hub";
import {
  billBlockText,
  departureBillBlocks,
  billStreams,
} from "@/lib/folio/bill-block";
import { formatGuestBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type BillPrint = "room" | "fnb" | "master";

export function StayHubCashierStrip({
  status,
  hasDoor,
  money,
  onPrinted,
}: {
  status: string;
  hasDoor: boolean;
  money: StayHubMoneyPayload | null;
  onPrinted?: () => void;
}) {
  const streams = billStreams(money?.lines ?? []);
  const paid = Math.abs(Number(money?.ledgerSummary.paymentBtn ?? 0));
  const blocks = money
    ? departureBillBlocks({
        folioId: money.folioId,
        status,
        hasDoor,
        roomTotal: streams.room,
        foodTotal: streams.food,
        openFoodOrders: money.roomPosOrders?.length ?? 0,
      })
    : [];
  const toasted = useRef("");
  const [pending, setPending] = useState<BillPrint | null>(null);

  useEffect(() => {
    const line = blocks[0] ? billBlockText(blocks[0].code) : "";
    if (!line) {
      toasted.current = "";
      return;
    }
    if (line === toasted.current) return;
    toasted.current = line;
    toast.error(line);
  }, [blocks]);

  async function printBill(kind: BillPrint) {
    const block = blocks[0];
    if (block) {
      const line = billBlockText(block.code);
      toast.error(line);
      return;
    }
    const folioId = money?.folioId;
    if (!folioId) return;
    setPending(kind);
    const result = await openMasterBillPrint(folioId);
    setPending(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const href = result.href.replace(/bill=[^&]+/, `bill=${kind}`);
    if (kind === "master" && result.docNo) {
      toast.success(`Master bill issued ${result.docNo}`);
    }
    onPrinted?.();
    window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <section
      className="mb-3 rounded-md border border-border bg-card p-3"
      aria-label="Cashier"
    >
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        Cashier
      </p>
      {!money ? (
        <p className="mt-2 text-sm text-muted-foreground">Loading the bill…</p>
      ) : null}
      <p className="mt-1 text-xs text-muted-foreground">
        Room, food, and master for this stay. Paid stays 0 until a payment is
        recorded.
      </p>
      <dl className="mt-2 space-y-1 text-sm">
        <Row label="Room bill" value={formatGuestBtn(streams.room)} />
        <Row label="Food bill" value={formatGuestBtn(streams.food)} />
        <Row label="Master due" value={formatGuestBtn(streams.master)} strong />
        <Row label="Paid" value={formatGuestBtn(paid)} />
      </dl>
      {blocks.map((block) => (
        <p
          key={block.code}
          className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-foreground"
          role="alert"
        >
          <span className="font-semibold">{block.code}</span>
          {" — "}
          {block.message} {block.next}
        </p>
      ))}
      <div className="mt-3 flex flex-wrap gap-2">
        <PrintButton
          label="Print room"
          busy={pending === "room"}
          onClick={() => printBill("room")}
        />
        <PrintButton
          label="Print food"
          busy={pending === "fnb"}
          onClick={() => printBill("fnb")}
        />
        <PrintButton
          label="Print master"
          busy={pending === "master"}
          onClick={() => printBill("master")}
        />
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("tabular-nums", strong && "font-semibold")}>{value}</dd>
    </div>
  );
}

function PrintButton({
  label,
  busy,
  onClick,
}: {
  label: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex h-8 items-center rounded-md border border-border bg-background px-2.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
    >
      {busy ? "Opening…" : label}
    </button>
  );
}
