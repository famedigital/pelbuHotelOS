import type { JournalLineInput } from "@/lib/accounting/types";
import { assertBalancedLines } from "@/lib/accounting/balance";
import { roundBtn } from "@/lib/pricing";

/**
 * Edge journal shapes auditors expect: folio charge, payment, void reverse, comp, laundry.
 * Pure builders + balance proof — no DB. Production UAT initials stay in docs/FINANCE-UAT.md.
 */

export type EdgeJournalKind =
  | "folio_charge"
  | "folio_payment"
  | "void_reverse"
  | "comp"
  | "laundry"
  | "pos_walk_in"
  | "payroll_payout"
  | "agent_ar_charge";

export function buildEdgeJournalLines(
  kind: EdgeJournalKind,
  amountBtn: number,
): JournalLineInput[] {
  const amount = roundBtn(Math.abs(amountBtn));
  if (!(amount > 0)) throw new Error("Amount must be positive.");

  switch (kind) {
    case "folio_charge":
      return [
        {
          accountId: "ar",
          debitBtn: amount,
          creditBtn: 0,
          description: "Guest folio charge",
        },
        {
          accountId: "room_rev",
          debitBtn: 0,
          creditBtn: amount,
          description: "Room revenue",
        },
      ];
    case "folio_payment":
      return [
        {
          accountId: "cash",
          debitBtn: amount,
          creditBtn: 0,
          description: "Cash / bank receipt",
        },
        {
          accountId: "ar",
          debitBtn: 0,
          creditBtn: amount,
          description: "Settle guest AR",
        },
      ];
    case "void_reverse":
      return [
        {
          accountId: "room_rev",
          debitBtn: amount,
          creditBtn: 0,
          description: "Reverse voided charge",
        },
        {
          accountId: "ar",
          debitBtn: 0,
          creditBtn: amount,
          description: "Clear AR on void",
        },
      ];
    case "comp":
      return [
        {
          accountId: "comp_exp",
          debitBtn: amount,
          creditBtn: 0,
          description: "Complimentary",
        },
        {
          accountId: "ar",
          debitBtn: 0,
          creditBtn: amount,
          description: "Comp clears AR",
        },
      ];
    case "laundry":
      return [
        {
          accountId: "ar",
          debitBtn: amount,
          creditBtn: 0,
          description: "Laundry charge",
        },
        {
          accountId: "laundry_rev",
          debitBtn: 0,
          creditBtn: amount,
          description: "Laundry revenue",
        },
      ];
    case "pos_walk_in":
      return [
        {
          accountId: "cash",
          debitBtn: amount,
          creditBtn: 0,
          description: "Walk-in POS cash",
        },
        {
          accountId: "fb_rev",
          debitBtn: 0,
          creditBtn: amount,
          description: "F&B revenue",
        },
      ];
    case "payroll_payout":
      return [
        {
          accountId: "payroll_payable",
          debitBtn: amount,
          creditBtn: 0,
          description: "Clear payroll payable",
        },
        {
          accountId: "bank",
          debitBtn: 0,
          creditBtn: amount,
          description: "Hotel bank payout",
        },
      ];
    case "agent_ar_charge":
      return [
        {
          accountId: "ar_agent",
          debitBtn: amount,
          creditBtn: 0,
          description: "Agent bill-to AR",
        },
        {
          accountId: "room_rev",
          debitBtn: 0,
          creditBtn: amount,
          description: "Room revenue",
        },
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
  return kinds;
}
