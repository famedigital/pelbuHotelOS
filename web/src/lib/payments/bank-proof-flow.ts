/** Bank QR / NEFT proof status machine — pure helpers for desk + pay page. */

export const BANK_PROOF_PENDING = "pending_bank" as const;
export const BANK_PROOF_CONFIRMED = "confirmed" as const;

export type PaymentConfirmationStatus =
  | typeof BANK_PROOF_PENDING
  | typeof BANK_PROOF_CONFIRMED;

export type DepositLinkStatus =
  | "open"
  | typeof BANK_PROOF_PENDING
  | "paid"
  | "expired"
  | "cancelled";

/** Guest or desk may upload proof when link is open. */
export function canSubmitDepositProof(status: string): boolean {
  return status === "open";
}

/** Desk confirms after proof review. */
export function canConfirmDepositLink(status: string): boolean {
  return status === BANK_PROOF_PENDING;
}

/** Desk posts proof against an open folio. */
export function canSubmitFolioBankProof(folioStatus: string): boolean {
  return folioStatus === "open";
}

/** Finance queue — only pending_bank rows appear. */
export function canConfirmBankPayment(
  confirmationStatus: string | null | undefined,
): boolean {
  return confirmationStatus === BANK_PROOF_PENDING;
}

/** pending_bank skips folio line + GL until confirmed. */
export function skipsLedgerUntilConfirmed(
  confirmationStatus: PaymentConfirmationStatus | undefined,
): boolean {
  return confirmationStatus === BANK_PROOF_PENDING;
}
