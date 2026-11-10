"use client";

import { openMasterBillPrint } from "@/app/actions/erp-folio-ops";
import type { StayHubMoneyPayload } from "@/app/actions/stay-hub";
import {
  billBlockText,
  departureBillBlocks,
  billStreams,
} from "@/lib/folio/bill-block";
import { StayBillAddons } from "@/components/erp/stay-hub/StayBillAddons";
import { Button } from "@/components/ui/button";
import { formatGuestBtn } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type BillPrint = "room" | "fnb" | "master" | "group";

export function StayHubCashierStrip({
  status,
  hasDoor,
  money,
  onPrinted,
  bookingId,
  guestName,
  roomUnitId,
  roomLabel,
}: {
  status: string;
  hasDoor: boolean;
  money: StayHubMoneyPayload | null;
  onPrinted?: () => void;
  bookingId?: string | null;
  guestName?: string | null;
  roomUnitId?: string | null;
  roomLabel?: string | null;
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
    const href = `${result.href}?bill=${kind}`;
    if (kind === "master" && result.docNo) {
      toast.success(`Master bill issued ${result.docNo}`);
    }
    onPrinted?.();
    window.open(href, "_blank", "noopener,noreferrer");
  }

  async function printGroup() {
    const block = blocks[0];
    if (block) {
      toast.error(billBlockText(block.code));
      return;
    }
    const folioId = money?.folioId;
    if (!folioId) return;
    setPending("group");
    const result = await openMasterBillPrint(folioId);
    setPending(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onPrinted?.();
    window.open(`${result.href}?pack=stay`, "_blank", "noopener,noreferrer");
  }

  const due = streams.master;
  const dueHot = due > 0.5;
  const canAdd =
    status === "checked_in" && Boolean(money?.folioId) && Boolean(bookingId);

  return (
    <section aria-label="Print" className="space-y-2">
      {!money ? (
        <p className="text-sm text-muted-foreground">Loading the bill…</p>
      ) : null}
      <dl className="grid grid-cols-2 gap-1.5 text-sm sm:grid-cols-4">
        <Row label="Room" value={formatGuestBtn(streams.room)} tone="room" />
        <Row label="Food" value={formatGuestBtn(streams.food)} tone="food" />
        <Row label="Services" value={formatGuestBtn(streams.services)} tone="services" />
        <Row label="Due" value={formatGuestBtn(due)} tone={dueHot ? "due" : "clear"} />
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
        <PrintButton
          label="Print group"
          busy={pending === "group"}
          onClick={() => printGroup()}
        />
      </div>
      {canAdd && money?.folioId && bookingId ? (
        <StayBillAddons
          folioId={money.folioId}
          bookingId={bookingId}
          guestName={guestName ?? ""}
          roomUnitId={roomUnitId ?? null}
          roomLabel={roomLabel ?? null}
          onPosted={onPrinted}
        />
      ) : null}
    </section>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "room" | "food" | "services" | "due" | "clear";
}) {
  const toneClass =
    tone === "due"
      ? "border-rose-200 bg-rose-50 text-rose-950"
      : tone === "clear"
        ? "border-emerald-200 bg-emerald-50 text-emerald-950"
        : tone === "food"
          ? "border-[var(--brass-hairline)] bg-[var(--gold-soft)]/40 text-[var(--espresso)]"
          : tone === "services"
            ? "border-[var(--brass-hairline)] bg-[var(--ivory-deep)] text-[var(--espresso)]"
            : "border-[var(--brass-hairline)] bg-white text-[var(--espresso)]";
  return (
    <div className={cn("rounded-md border px-2 py-1.5", toneClass)}>
      <dt className="text-[10px] font-semibold tracking-wide uppercase opacity-70">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums">{value}</dd>
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
      className="border-[var(--brass-hairline)] bg-white text-[var(--espresso)] hover:bg-[var(--ivory-deep)]"
      onClick={onClick}
      disabled={busy}
    >
      {busy ? "Opening…" : label}
    </Button>
  );
}
