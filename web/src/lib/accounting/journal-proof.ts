import type { JournalLineInput } from "@/lib/accounting/types";
import { assertBalancedLines } from "@/lib/accounting/balance";
import { roundBtn } from "@/lib/pricing";

/**
 * Edge journal shapes auditors expect: folio charge, payment, void reverse, comp, laundry.
 * Pure builders + balance proof — no DB. Production UAT initials stay in docs/FINANCE-UAT.md.
 *
 * Account ids here are logical system keys (not COA UUIDs). Production maps via
 * accounting_posting_rules → system keys (ar_guest, rev_rooms, …).
 */

export type EdgeJournalKind =
  | "folio_charge"
  | "folio_charge_gst"
  | "folio_payment"
  | "void_reverse"
  | "comp"
  | "laundry"
  | "laundry_gst"
  | "pos_walk_in"
  | "pos_walk_in_gst"
  | "payroll_payout"
  | "agent_ar_charge";

function line(
  accountId: string,
  debitBtn: number,
  creditBtn: number,
  description: string,
): JournalLineInput {
  return { accountId, debitBtn, creditBtn, description };
}

/** Flip debits ↔ credits — same shape as reverseJournal production path. */
export function reverseLines(lines: JournalLineInput[]): JournalLineInput[] {
  return lines.map((l) => ({
    accountId: l.accountId,
    departmentId: l.departmentId ?? null,
    description: `Reversal: ${l.description ?? ""}`.trim(),
    debitBtn: roundBtn(l.creditBtn),
    creditBtn: roundBtn(l.debitBtn),
  }));
}

/**
 * Net original + reverse on each account must be zero (void fully unwinds AR/rev).
 */
export function assertReversalNetsToZero(
  original: JournalLineInput[],
  reversal: JournalLineInput[],
): void {
  assertBalancedLines(original);
  assertBalancedLines(reversal);
  const net = new Map<string, number>();
  for (const l of [...original, ...reversal]) {
    const delta = roundBtn(l.debitBtn - l.creditBtn);
    net.set(l.accountId, roundBtn((net.get(l.accountId) ?? 0) + delta));
  }
  for (const [accountId, balance] of net) {
    if (balance !== 0) {
      throw new Error(
        `Reversal incomplete for ${accountId}: residual ${balance}`,
      );
    }
  }
}

export function buildEdgeJournalLines(
  kind: EdgeJournalKind,
  amountBtn: number,
  gstBtn = 0,
): JournalLineInput[] {
  const amount = roundBtn(Math.abs(amountBtn));
  if (!(amount > 0)) throw new Error("Amount must be positive.");
  const gst = roundBtn(Math.max(0, gstBtn));
  const net = roundBtn(Math.max(amount - gst, 0));

  switch (kind) {
    case "folio_charge":
      return [
        line("ar", amount, 0, "Guest folio charge"),
        line("room_rev", 0, amount, "Room revenue"),
      ];
    case "folio_charge_gst": {
      if (!(gst > 0) || net <= 0) {
        throw new Error("GST folio charge needs positive net and GST.");
      }
      return [
        line("ar", amount, 0, "Guest folio charge (gross)"),
        line("room_rev", 0, net, "Room revenue (net)"),
        line("gst_output", 0, gst, "GST output"),
      ];
    }
    case "folio_payment":
      return [
        line("cash", amount, 0, "Cash / bank receipt"),
        line("ar", 0, amount, "Settle guest AR"),
      ];
    case "void_reverse":
      return [
        line("room_rev", amount, 0, "Reverse voided charge"),
        line("ar", 0, amount, "Clear AR on void"),
      ];
    case "comp":
      return [
        line("comp_exp", amount, 0, "Complimentary"),
        line("ar", 0, amount, "Comp clears AR"),
      ];
    case "laundry":
      return [
        line("ar", amount, 0, "Laundry charge"),
        line("laundry_rev", 0, amount, "Laundry revenue"),
      ];
    case "laundry_gst": {
      if (!(gst > 0) || net <= 0) {
        throw new Error("GST laundry needs positive net and GST.");
      }
      return [
        line("ar", amount, 0, "Laundry charge (gross)"),
        line("laundry_rev", 0, net, "Laundry revenue (net)"),
        line("gst_output", 0, gst, "GST output"),
      ];
    }
    case "pos_walk_in":
      return [
        line("cash", amount, 0, "Walk-in POS cash"),
        line("fb_rev", 0, amount, "F&B revenue"),
      ];
    case "pos_walk_in_gst": {
      if (!(gst > 0) || net <= 0) {
        throw new Error("GST POS walk-in needs positive net and GST.");
      }
      return [
        line("cash", amount, 0, "Walk-in POS cash (gross)"),
        line("fb_rev", 0, net, "F&B revenue (net)"),
        line("gst_output", 0, gst, "GST output"),
      ];
    }
    case "payroll_payout":
      return [
        line("payroll_payable", amount, 0, "Clear payroll payable"),
        line("bank", 0, amount, "Hotel bank payout"),
      ];
    case "agent_ar_charge":
      return [
        line("ar_agent", amount, 0, "Agent bill-to AR"),
        line("room_rev", 0, amount, "Room revenue"),
      ];
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Unknown edge kind: ${_exhaustive}`);
    }
  }
}

/** Assert every edge shape balances (XOR debit/credit per line). */
export function proveEdgeJournals(amountBtn = 1070): EdgeJournalKind[] {
  const kinds: EdgeJournalKind[] = [
    "folio_charge",
    "folio_payment",
    "void_reverse",
    "comp",
    "laundry",
    "pos_walk_in",
    "payroll_payout",
    "agent_ar_charge",
  ];
  for (const kind of kinds) {
    assertBalancedLines(buildEdgeJournalLines(kind, amountBtn));
  }

  // GST-aware sales (gross AR / cash, net rev, GST output) — mirrors postSimpleEvent
  const gross = amountBtn;
  const gst = roundBtn(gross * 0.07);
  for (const kind of [
    "folio_charge_gst",
    "laundry_gst",
    "pos_walk_in_gst",
  ] as const) {
    assertBalancedLines(buildEdgeJournalLines(kind, gross, gst));
  }

  // Void must reverse original (including GST split)
  const charge = buildEdgeJournalLines("folio_charge_gst", gross, gst);
  assertReversalNetsToZero(charge, reverseLines(charge));

  const laundry = buildEdgeJournalLines("laundry", amountBtn);
  assertReversalNetsToZero(laundry, reverseLines(laundry));

  return [
    ...kinds,
    "folio_charge_gst",
    "laundry_gst",
    "pos_walk_in_gst",
  ];
}
