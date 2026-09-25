/**
 * FO-facing settlement vocabulary.
 * Maps booking `payment_mode` + folio tenders to desk language without renaming DB enums.
 */

export type FoPaymentMode = "cash" | "prepaid" | "partial" | "on_credit";

export type FoPaymentModeOption = {
  value: FoPaymentMode;
  /** Short label for selects / chips */
  label: string;
  /** One-line FO hint under the control */
  hint: string;
};

/** Booking commercial intent at book / check-in. */
export const FO_PAYMENT_MODE_OPTIONS: FoPaymentModeOption[] = [
  {
    value: "cash",
    label: "Guest pays at leave",
    hint: "Collect on Folio → Collect at checkout (cash / QR / bank / card).",
  },
  {
    value: "prepaid",
    label: "Already prepaid",
    hint: "Stay paid before arrival — only extras need collection.",
  },
  {
    value: "partial",
    label: "Deposit / partial",
    hint: "Token or deposit on file — balance due before or at leave.",
  },
  {
    value: "on_credit",
    label: "Agent on credit (guide signs)",
    hint: "Charge agent AR; guide signs settlement paper at checkout.",
  },
];

const MODE_BY_VALUE = Object.fromEntries(
  FO_PAYMENT_MODE_OPTIONS.map((o) => [o.value, o]),
) as Record<FoPaymentMode, FoPaymentModeOption>;

export function isFoPaymentMode(raw: string | null | undefined): raw is FoPaymentMode {
  const key = (raw ?? "").trim().toLowerCase();
  return key === "cash" || key === "prepaid" || key === "partial" || key === "on_credit";
}

/** FO label for booking payment_mode (not folio tender). */
export function foPaymentModeLabel(mode: string | null | undefined): string {
  if (!mode?.trim()) return "Unset";
  const key = mode.trim().toLowerCase();
  if (isFoPaymentMode(key)) return MODE_BY_VALUE[key].label;
  return mode.replace(/_/g, " ");
}

export function foPaymentModeHint(mode: string | null | undefined): string | null {
  const key = (mode ?? "").trim().toLowerCase();
  if (!isFoPaymentMode(key)) return null;
  return MODE_BY_VALUE[key].hint;
}

/** Compact chip for StayHub rail / headers. */
export function foPaymentModeShort(mode: string | null | undefined): string {
  const key = (mode ?? "").trim().toLowerCase();
  if (key === "on_credit") return "Agent credit";
  if (key === "prepaid") return "Prepaid";
  if (key === "partial") return "Partial";
  if (key === "cash") return "Pay at leave";
  if (!key) return "";
  return mode!.replace(/_/g, " ");
}

/** Folio Collect tender labels (actual money movement). */
export const FO_TENDER_LABELS: Record<string, string> = {
  cash: "Cash",
  bank: "Bank transfer",
  bank_qr: "Bank QR",
  pay_bt: "Pay.bt",
  card: "Card",
  deposit: "Apply deposit",
  agent_credit: "Agent AR book (agent owes)",
};

export function foTenderLabel(method: string | null | undefined): string {
  const key = (method ?? "").trim().toLowerCase();
  return FO_TENDER_LABELS[key] ?? (method ? method.replace(/_/g, " ") : "—");
}

export type StayStoryInput = {
  status?: string | null;
  roomLabel?: string | null;
  hkStatus?: string | null;
  dueBtn?: number | null;
  paymentMode?: string | null;
  agentName?: string | null;
};

/**
 * One FO sentence under the guest name — journey truth, not a chip salad.
 * e.g. "Confirmed · Room 204 dirty · Balance Nu 4,200 · Agent on credit"
 */
export function buildStayStoryLine(input: StayStoryInput): string {
  const parts: string[] = [];

  const status = (input.status ?? "").toLowerCase();
  if (status === "checked_in") parts.push("In-house");
  else if (status === "checked_out") parts.push("Checked out");
  else if (status === "confirmed") parts.push("Confirmed");
  else if (status === "held" || status === "pending") parts.push("Hold");
  else if (status === "cancelled") parts.push("Cancelled");
  else if (status === "no_show") parts.push("No-show");
  else if (status) parts.push(status.replace(/_/g, " "));

  const room = input.roomLabel?.trim();
  const hk = input.hkStatus?.trim().toLowerCase();
  if (room) {
    parts.push(hk && hk !== "clean" ? `Room ${room} ${hk}` : `Room ${room}`);
  } else if (status !== "checked_out" && status !== "cancelled") {
    parts.push("Unassigned");
  }

  const due = input.dueBtn;
  if (due != null && Number.isFinite(due)) {
    if (Math.abs(due) <= 0.5) parts.push("Balance clear");
    else {
      const rounded = Math.round(due);
      parts.push(
        `Balance Nu ${rounded.toLocaleString("en-BT", { maximumFractionDigits: 0 })}`,
      );
    }
  }

  const pay = foPaymentModeShort(input.paymentMode);
  if (pay) {
    if (input.agentName?.trim() && (input.paymentMode ?? "").toLowerCase() === "on_credit") {
      parts.push("Agent on credit");
    } else {
      parts.push(pay);
    }
  } else if (input.agentName?.trim()) {
    parts.push(input.agentName.trim());
  }

  return parts.join(" · ");
}

/** Arrival-day playbook micro-steps for Today / Arrivals. */
export type ArrivalPlaybookStepId = "assign" | "check_in" | "reg" | "settle";

export type ArrivalPlaybookStep = {
  id: ArrivalPlaybookStepId;
  label: string;
  done: boolean;
  current: boolean;
};

export function buildArrivalPlaybook(input: {
  status: string;
  hasRoomAssigned: boolean;
  hasRegCard?: boolean;
  balanceBtn?: number;
}): ArrivalPlaybookStep[] {
  const status = (input.status ?? "").toLowerCase();
  const checkedIn = status === "checked_in" || status === "checked_out";
  const assigned = Boolean(input.hasRoomAssigned);
  const regDone = Boolean(input.hasRegCard) || status === "checked_out";
  const settled =
    input.balanceBtn == null || Math.abs(Number(input.balanceBtn) || 0) <= 0.5;

  let current: ArrivalPlaybookStepId = "assign";
  if (!assigned) current = "assign";
  else if (!checkedIn) current = "check_in";
  else if (!regDone) current = "reg";
  else current = "settle";

  const defs: Array<{ id: ArrivalPlaybookStepId; label: string; done: boolean }> = [
    { id: "assign", label: "Assign", done: assigned },
    { id: "check_in", label: "CI", done: checkedIn },
    { id: "reg", label: "Reg", done: regDone },
    {
      id: "settle",
      label: "Settle",
      done: checkedIn && settled && status === "checked_out",
    },
  ];

  return defs.map((d) => ({
    ...d,
    current: d.id === current && status !== "checked_out",
  }));
}
