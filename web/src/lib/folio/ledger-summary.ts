/**
 * Folio ledger strip totals (eZee Manage Folio muscle memory):
 * Rate · Ext · Discount · Payment · Balance.
 */

import { classifyBillLine } from "@/lib/folio/bill-kinds";

export type LedgerLineLike = {
  source_type: string;
  description?: string | null;
  total_btn: number;
  status?: string | null;
};

export type LedgerStripSummary = {
  rateBtn: number;
  extBtn: number;
  discountBtn: number;
  /** Payments + deposits taken as positive Nu collected. */
  paymentBtn: number;
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

/** Build Manage Folio strip from posted lines (voided ignored). */
export function buildLedgerStripSummary(
  lines: LedgerLineLike[],
): LedgerStripSummary {
  let rateBtn = 0;
  let extBtn = 0;
  let discountBtn = 0;
  let paymentBtn = 0;
  let balanceBtn = 0;

  for (const l of lines) {
    if ((l.status ?? "posted") !== "posted") continue;
    const amt = Number(l.total_btn ?? 0);
    balanceBtn += amt;
    const st = (l.source_type ?? "").toLowerCase();
    if (isPaymentLine(st)) {
      // Payments are typically negative on folio; show positive collected
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
