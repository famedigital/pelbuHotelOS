/**
 * Client-safe POS tender constants/labels (no server-only deps).
 * Server pos loaders re-export these; client UI must import from here.
 */
export const POS_TENDER_METHODS = [
  "cash",
  "bank",
  "card",
  "agent_credit",
  "bank_qr",
  "pay_bt",
  "mbob",
  "mpay",
  "deposit",
  "room_charge",
  "comp",
  "staff_meal",
  "owner_meal",
  "nc",
] as const;

/** Bhutan-friendly labels for tenders + comps. */
export const POS_TENDER_LABELS: Record<string, string> = {
  cash: "Cash",
  bank: "Bank transfer",
  card: "Card",
  agent_credit: "Charge agent (invoice later)",
  bank_qr: "Bank QR",
  pay_bt: "Pay.bt",
  mbob: "mBoB",
  mpay: "mPay",
  deposit: "Deposit",
  room_charge: "Room charge",
  comp: "Comp",
  staff_meal: "Staff meal",
  owner_meal: "Owner meal",
  nc: "NC",
};

export function tenderMethodLabel(method: string): string {
  return POS_TENDER_LABELS[method] ?? method.replace(/_/g, " ");
}

export type PosTenderMethod = (typeof POS_TENDER_METHODS)[number];
