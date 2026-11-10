/** Dual-folio checkout gate: personal (guest) balance must be ≤ Nu 0.50. */

export const PERSONAL_CHECKOUT_GATE_BTN = 0.5;

export type FolioBalanceSlice = {
  payerType: "guest" | "agent" | "company" | string;
  balanceBtn: number;
};

export type CheckoutGateResult =
  | { ok: true }
  | { ok: false; error: "CHECKOUT_PERSONAL_BALANCE"; personalBalanceBtn: number };

export function assertPersonalFolioCleared(
  folios: FolioBalanceSlice[],
): CheckoutGateResult {
  // guest = personal stream; "personal" accepted for desk stream ↔ API payerType align.
  const personal = folios
    .filter((f) => f.payerType === "guest" || f.payerType === "personal")
    .reduce((s, f) => s + f.balanceBtn, 0);
  const bal = Math.round(personal * 100) / 100;
  if (bal > PERSONAL_CHECKOUT_GATE_BTN) {
    return {
      ok: false,
      error: "CHECKOUT_PERSONAL_BALANCE",
      personalBalanceBtn: bal,
    };
  }
  return { ok: true };
}
