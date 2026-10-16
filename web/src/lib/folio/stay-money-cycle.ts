/**
 * Front-desk stay money cycle steps (shared by folio, calendar modal, booking panel).
 *
 * Cycle: Booked → Checked-in → Charges open → Invoice optional → Settled → Checkout
 * Never mark Paid while |balance| > 0.5.
 */

export type StayMoneyStepId =
  | "booked"
  | "checked_in"
  | "charges"
  | "invoice"
  | "paid"
  | "checkout";

export type StayMoneyStep = {
  id: StayMoneyStepId;
  label: string;
  done: boolean;
  current: boolean;
};

export type StayMoneyCycleInput = {
  /** booking.status */
  status: string;
  hasFolio: boolean;
  /** Any non-payment posted charge lines (room, meal, POS, etc.) */
  hasCharges: boolean;
  hasInvoice?: boolean;
  /** Net folio balance (charges − payments); 0 means settled */
  balanceBtn?: number;
};

const LABELS: Record<StayMoneyStepId, string> = {
  booked: "Booked",
  checked_in: "Checked in",
  charges: "Charges open",
  invoice: "Invoice",
  paid: "Settled",
  checkout: "Checkout",
};

/**
 * Honest process strip — derived from data only (no aspirational checkmarks).
 */
export function buildStayMoneySteps(input: StayMoneyCycleInput): StayMoneyStep[] {
  const status = (input.status ?? "").toLowerCase();
  const checkedOut = status === "checked_out";
  const checkedIn = status === "checked_in" || checkedOut;
  const booked = !["cancelled", "no_show", "expired"].includes(status);
  const hasFolio = Boolean(input.hasFolio) || checkedIn;
  const hasCharges = Boolean(input.hasCharges);
  const hasInvoice = Boolean(input.hasInvoice);
  const balance = Number(input.balanceBtn ?? 0);
  const balanceClear = Math.abs(balance) <= 0.5;
  /** Settled only when charges exist (or checked out) and due ≈ 0. */
  const settled = balanceClear && (hasCharges || checkedOut);

  const doneMap: Record<StayMoneyStepId, boolean> = {
    booked,
    checked_in: checkedIn && hasFolio,
    charges: hasCharges,
    // Invoice is optional — never mark done just because balance cleared.
    invoice: hasInvoice,
    // Never mark Settled/Paid while due remains.
    paid: settled && balanceClear,
    checkout: checkedOut,
  };

  const order: StayMoneyStepId[] = [
    "booked",
    "checked_in",
    "charges",
    "invoice",
    "paid",
    "checkout",
  ];

  let currentIdx = order.findIndex((id) => !doneMap[id]);
  if (currentIdx < 0) currentIdx = order.length - 1;

  return order.map((id, i) => ({
    id,
    label: LABELS[id],
    done: doneMap[id],
    current: i === currentIdx,
  }));
}

/** Compact legend copy for desk help. */
export const STAY_MONEY_CYCLE_LEGEND = [
  {
    step: 1,
    title: "Book / assign rates",
    body: "Reserve rooms; rates and meal plan snapshot from the rates sheet.",
  },
  {
    step: 2,
    title: "Check-in (creates folio)",
    body: "Assign physical rooms and open the guest folio.",
  },
  {
    step: 3,
    title: "Post charges",
    body: "Day-1 room rent (and meal plan if priced) posts at check-in. Later nights post at night audit. Use Post room night if anything is missing.",
  },
  {
    step: 4,
    title: "Invoice / collect",
    body: "Issue tax invoice when GST needs it. Collect until guest due is Clear. Invoice is optional — Settled means due ≈ 0, not that INV exists.",
  },
  {
    step: 5,
    title: "Checkout when balance zero",
    body: "Settle any residual F&B/laundry charges, then check out.",
  },
] as const;

/** Best next-action label for desk CTAs. */
export function stayMoneyNextAction(input: StayMoneyCycleInput): {
  label: string;
  hrefHint: "check-in" | "folio" | "check-out" | "view";
} {
  const steps = buildStayMoneySteps(input);
  const current = steps.find((s) => s.current) ?? steps[steps.length - 1];
  switch (current.id) {
    case "booked":
    case "checked_in":
      if (input.status === "held") return { label: "Confirm token", hrefHint: "view" };
      if (["pending", "confirmed"].includes(input.status)) {
        return { label: "Check in", hrefHint: "check-in" };
      }
      return { label: "Open folio", hrefHint: "folio" };
    case "charges":
      return { label: "Post charges", hrefHint: "folio" };
    case "invoice":
      return { label: "Issue invoice", hrefHint: "folio" };
    case "paid":
      return { label: "Collect payment", hrefHint: "folio" };
    case "checkout":
      return { label: "Check out", hrefHint: "check-out" };
    default:
      return { label: "View", hrefHint: "view" };
  }
}
