"use client";

import { openMasterBillPrint } from "@/app/actions/erp-folio-ops";
import type { StayHubMoneyPayload } from "@/app/actions/stay-hub";
import {
  billBlockText,
  departureBillBlocks,
  billStreams,
} from "@/lib/folio/bill-block";
import { Button } from "@/components/ui/button";
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
    <section aria-label="Print" className="space-y-2">
      {!money ? (
        <p className="text-sm text-muted-foreground">Loading the bill…</p>
      ) : null}
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <Row label="Room" value={formatGuestBtn(streams.room)} />
        <Row label="Food" value={formatGuestBtn(streams.food)} />
        <Row label="Due" value={formatGuestBtn(streams.master)} strong />
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
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
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
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={busy}
    >
      {busy ? "Opening…" : label}
    </Button>
  );
}
