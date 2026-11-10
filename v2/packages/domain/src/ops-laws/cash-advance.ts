/**
 * Cash Drawer Sync Law — Centenary Farmers Market advances.
 * Cash payment mode on a purchase bill requires a linked open advance;
 * reconcile: spent + changeReturned === advance.amount.
 */

export type CashAdvance = {
  id: string;
  amountBtn: number;
  spentBtn: number;
  changeReturnedBtn: number;
  status: "open" | "reconciled" | "void";
};

export type AdvanceIssueInput = {
  amountBtn: number;
  tillBalanceBtn: number;
};

export type AdvanceIssueResult =
  | { ok: true; tillAfterBtn: number }
  | { ok: false; error: string };

export function canIssueCashAdvance(input: AdvanceIssueInput): AdvanceIssueResult {
  if (!(input.amountBtn > 0)) {
    return { ok: false, error: "ADVANCE_AMOUNT_INVALID" };
  }
  if (input.tillBalanceBtn < input.amountBtn) {
    return { ok: false, error: "TILL_SHORT" };
  }
  return { ok: true, tillAfterBtn: round2(input.tillBalanceBtn - input.amountBtn) };
}

export type ReconcileInput = {
  advance: CashAdvance;
  spentBtn: number;
  changeReturnedBtn: number;
};

export type ReconcileResult =
  | {
      ok: true;
      tillCreditBtn: number;
      advance: CashAdvance;
    }
  | { ok: false; error: string };

/** Law: spent + change must equal issued advance (within Nu 0.01). */
export function reconcileCashAdvance(input: ReconcileInput): ReconcileResult {
  if (input.advance.status !== "open") {
    return { ok: false, error: "ADVANCE_NOT_OPEN" };
  }
  if (input.spentBtn < 0 || input.changeReturnedBtn < 0) {
    return { ok: false, error: "RECONCILE_AMOUNTS_INVALID" };
  }
  const sum = round2(input.spentBtn + input.changeReturnedBtn);
  const issued = round2(input.advance.amountBtn);
  if (Math.abs(sum - issued) > 0.01) {
    return { ok: false, error: "ADVANCE_MISMATCH" };
  }
  return {
    ok: true,
    tillCreditBtn: round2(input.changeReturnedBtn),
    advance: {
      ...input.advance,
      spentBtn: round2(input.spentBtn),
      changeReturnedBtn: round2(input.changeReturnedBtn),
      status: "reconciled",
    },
  };
}

/** Cash bills must attach an open advance — never mark Cash in isolation. */
export function assertCashBillHasAdvance(args: {
  paymentMode: string;
  advanceId: string | null | undefined;
  advance: CashAdvance | null | undefined;
}): { ok: true } | { ok: false; error: string } {
  if (args.paymentMode !== "cash") return { ok: true };
  if (!args.advanceId || !args.advance) {
    return { ok: false, error: "CASH_REQUIRES_ADVANCE" };
  }
  if (args.advance.status !== "open") {
    return { ok: false, error: "ADVANCE_NOT_OPEN" };
  }
  return { ok: true };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
