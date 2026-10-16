/**
 * Folio ledger strip totals for StayHub / Open bills.
 * Balance always uses guest-visible lines (void originals + their reversals excluded).
 */

import { guestVisibleBalanceLines } from "@/lib/folio/balance";
import { classifyBillLine } from "@/lib/folio/bill-kinds";

export type LedgerLineLike = {
  id?: string;
  source_type: string;
  description?: string | null;
  total_btn: number;
  status?: string | null;
  reverses_line_id?: string | null;
};

export type LedgerStripSummary = {
  rateBtn: number;
  extBtn: number;
  discountBtn: number;
  /** Payments + deposits taken as positive Nu collected. */
  paymentBtn: number;
  /** Guest-visible due (netFolioBalance). */
  balanceBtn: number;
};

export type LedgerFilterKind =
  | "all"
  | "room"
  | "extra"
  | "payment"
  | "agent";

export function isPaymentLine(sourceType: string): boolean {
  const st = (sourceType ?? "").toLowerCase();
  return st === "payment" || st === "deposit";
}

export function isRoomRateLine(sourceType: string): boolean {
  const st = (sourceType ?? "").toLowerCase();
  return ["room", "meal_plan", "extra_bed"].includes(st);
}

/** Build Manage Folio strip from lines; due ignores void + reversal pairs. */
export function buildLedgerStripSummary(
  lines: LedgerLineLike[],
): LedgerStripSummary {
  let rateBtn = 0;
  let extBtn = 0;
  let discountBtn = 0;
  let paymentBtn = 0;

  const forBalance = lines.map((l, i) => ({
    id: l.id ?? `tmp-${i}`,
    status: l.status ?? "posted",
    total_btn: Number(l.total_btn ?? 0),
    reverses_line_id: l.reverses_line_id ?? null,
    source_type: l.source_type,
    description: l.description,
  }));
  const visible = guestVisibleBalanceLines(forBalance);
  const balanceBtn = visible.reduce(
    (sum, line) => sum + Number(line.total_btn),
    0,
  );

  for (const l of visible) {
    const amt = Number(l.total_btn ?? 0);
    const st = (l.source_type ?? "").toLowerCase();
    if (isPaymentLine(st)) {
      paymentBtn += Math.abs(amt);
      continue;
    }
    if (amt < -0.005) {
      discountBtn += Math.abs(amt);
      continue;
    }
    const group = classifyBillLine({
      source_type: st,
      description: l.description,
    });
    if (group === "room" || isRoomRateLine(st)) {
      rateBtn += amt;
    } else if (group === "hotel_adj") {
      if (amt < 0) discountBtn += Math.abs(amt);
      else extBtn += amt;
    } else {
      extBtn += amt;
    }
  }

  return {
    rateBtn,
    extBtn,
    discountBtn,
    paymentBtn,
    balanceBtn,
  };
}

export function lineMatchesLedgerFilter(
  line: LedgerLineLike & { bill_to?: string | null },
  filter: LedgerFilterKind,
): boolean {
  if (filter === "all") return true;
  if (filter === "agent") return (line.bill_to ?? "guest") === "agent";
  if (filter === "payment") return isPaymentLine(line.source_type);
  if (filter === "room") {
    return (
      !isPaymentLine(line.source_type) &&
      (isRoomRateLine(line.source_type) ||
        classifyBillLine(line) === "room" ||
        classifyBillLine(line) === "hotel_adj")
    );
  }
  // extra
  const group = classifyBillLine(line);
  return (
    !isPaymentLine(line.source_type) &&
    !isRoomRateLine(line.source_type) &&
    group !== "room" &&
    group !== "hotel_adj"
  );
}
