/**
 * Front-desk stay money cycle steps (shared by folio, calendar modal, booking panel).
 *
 * Cycle: Book / rates → Check-in (folio) → Post charges → Invoice → Pay → Checkout
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
  charges: "Charges posted",
  invoice: "Invoice",
  paid: "Paid",
  checkout: "Checkout",
};

/**
 * Process strip: Booked → Checked in → Charges posted → Invoice → Paid → Checkout
 */
export function buildStayMoneySteps(input: StayMoneyCycleInput): StayMoneyStep[] {
  const status = (input.status ?? "").toLowerCase();
  const checkedOut = status === "checked_out";
  const checkedIn =
    status === "checked_in" || checkedOut;
  const booked = !["cancelled", "no_show", "expired"].includes(status);
  const hasFolio = Boolean(input.hasFolio) || checkedIn;
  const hasCharges = Boolean(input.hasCharges);
  const hasInvoice = Boolean(input.hasInvoice);
  const balance = Number(input.balanceBtn ?? 0);
  const settled =
    hasCharges && Math.abs(balance) <= 0.5
      ? true
      : checkedOut && Math.abs(balance) <= 0.5;

  const doneMap: Record<StayMoneyStepId, boolean> = {
    booked,
    checked_in: checkedIn && hasFolio,
    charges: hasCharges,
    invoice: hasInvoice || (hasCharges && settled),
    paid: settled || checkedOut,
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
    title: "Invoice / pay",
    body: "Issue tax invoice. Print Master bill + Room bill + F&B bill. Guest totals are whole Nu ending in 0 or 5 (hotel absorbs remainder). Collect payment or deposit link.",
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
