/**
 * Canonical front-desk StayHub progress: six steps for one modal surface.
 *
 * Reserve → Confirm → Arrival → Check-in → Stay/Money → Check-out
 */

import {
  buildStayMoneySteps,
  type StayMoneyCycleInput,
  type StayMoneyStep,
} from "@/lib/folio/stay-money-cycle";

export type StayHubStepId =
  | "reserve"
  | "confirm"
  | "arrival"
  | "check_in"
  | "stay_money"
  | "check_out";

export type StayHubStep = {
  id: StayHubStepId;
  label: string;
  shortLabel: string;
  done: boolean;
  current: boolean;
  /** Future step locked until prerequisites met */
  locked: boolean;
  lockReason?: string;
};

export type StayHubCycleInput = {
  status: string;
  /** Physical room assigned for sellable stay */
  hasRoomAssigned?: boolean;
  /** SDF / guest docs incomplete */
  sdfIncomplete?: boolean;
  hasFolio?: boolean;
  hasCharges?: boolean;
  hasInvoice?: boolean;
  balanceBtn?: number;
  /** Board can force a preferred current for open (visual only if viewer picks panel) */
  forceCurrent?: StayHubStepId | null;
};

const LABELS: Record<StayHubStepId, { label: string; short: string }> = {
  reserve: { label: "Reserve", short: "Rsv" },
  confirm: { label: "Confirm", short: "Cfm" },
  arrival: { label: "Arrival", short: "Arr" },
  check_in: { label: "Check-in", short: "CI" },
  stay_money: { label: "Stay / Money", short: "Money" },
  check_out: { label: "Check-out", short: "CO" },
};

const ORDER: StayHubStepId[] = [
  "reserve",
  "confirm",
  "arrival",
  "check_in",
  "stay_money",
  "check_out",
];

export type StayHubTerminal =
  | "cancelled"
  | "no_show"
  | "expired"
  | null;

export function stayHubTerminal(status: string): StayHubTerminal {
  const s = (status ?? "").toLowerCase();
  if (s === "cancelled") return "cancelled";
  if (s === "no_show") return "no_show";
  if (s === "expired") return "expired";
  return null;
}

/**
 * Visual truth for progress strip. Does not steal the open panel —
 * callers must only apply recommended panel on booking open, not rehydrate.
 */
export function buildStayHubSteps(input: StayHubCycleInput): StayHubStep[] {
  const status = (input.status ?? "").toLowerCase();
  const terminal = stayHubTerminal(status);
  const checkedOut = status === "checked_out";
  const checkedIn = status === "checked_in" || checkedOut;
  const confirmedOrLater = [
    "confirmed",
    "checked_in",
    "checked_out",
  ].includes(status);
  const holdActive = status === "held" || status === "pending";
  const hasRoom = input.hasRoomAssigned !== false;
  const docsOk = input.sdfIncomplete !== true;
  const arrivalReady = confirmedOrLater && hasRoom && docsOk;
  const hasFolio = Boolean(input.hasFolio) || checkedIn;
  const balance = Number(input.balanceBtn ?? 0);
  const settled = Math.abs(balance) <= 0.5;

  const doneMap: Record<StayHubStepId, boolean> = {
    reserve: !terminal,
    confirm: confirmedOrLater || checkedIn || checkedOut,
    arrival: arrivalReady || checkedIn || checkedOut,
    check_in: checkedIn || checkedOut,
    stay_money:
      checkedOut || (checkedIn && hasFolio && settled && Boolean(input.hasCharges)),
    check_out: checkedOut,
  };

  // Soft arrival: confirmed with missing docs still shows arrival incomplete
  if (checkedIn || checkedOut) {
    doneMap.arrival = true;
    doneMap.confirm = true;
  }
  if (checkedOut) {
    doneMap.stay_money = true;
  }
  if (terminal) {
    for (const id of ORDER) doneMap[id] = false;
  }

  let currentIdx = ORDER.findIndex((id) => !doneMap[id]);
  if (terminal) currentIdx = -1;
  else if (currentIdx < 0) currentIdx = ORDER.length - 1;

  // Domain auto-current (can be overridden for visual “preferred open” mapping)
  if (!terminal && !input.forceCurrent) {
    if (holdActive) currentIdx = ORDER.indexOf("confirm");
    else if (status === "confirmed" && !arrivalReady)
      currentIdx = ORDER.indexOf("arrival");
    else if (status === "confirmed" && arrivalReady)
      currentIdx = ORDER.indexOf("check_in");
    else if (status === "checked_in" && !settled)
      currentIdx = ORDER.indexOf("stay_money");
    else if (status === "checked_in" && settled)
      currentIdx = ORDER.indexOf("check_out");
    else if (checkedOut) currentIdx = ORDER.length - 1;
  } else if (input.forceCurrent && !terminal) {
    // Held/pending: never treat check_out as current even if forced from board/URL.
    if (holdActive && input.forceCurrent === "check_out") {
      currentIdx = ORDER.indexOf("confirm");
    } else {
      const forced = ORDER.indexOf(input.forceCurrent);
      if (forced >= 0) currentIdx = forced;
    }
  }

  return ORDER.map((id, i) => {
    const locked =
      !terminal &&
      !doneMap[id] &&
      i > currentIdx &&
      !(id === "stay_money" && checkedIn) &&
      !(id === "check_out" && checkedIn);
    let lockReason: string | undefined;
    if (locked) {
      if (id === "check_in" && !docsOk)
        lockReason = "Finish guest docs first";
      else if (id === "check_in" && !hasRoom)
        lockReason = "Assign a room first";
      else if (id === "check_out" && !settled)
        lockReason = "Settle open balance first";
      else lockReason = "Complete earlier steps first";
    }
    return {
      id,
      label: LABELS[id].label,
      shortLabel: LABELS[id].short,
      done: terminal ? false : doneMap[id],
      current: !terminal && i === currentIdx,
      locked: Boolean(terminal) ? true : locked,
      lockReason,
    };
  });
}

/** Recommended open panel for boards — only used at open boundary. */
export function recommendStayHubStep(
  input: StayHubCycleInput & {
    board?: "arrivals" | "in_house" | "departures" | "reservations" | "auto";
  },
): StayHubStepId {
  const status = (input.status ?? "").toLowerCase();
  if (stayHubTerminal(status)) return "reserve";
  // Hold is always Confirm — boards must not land on check-out/money.
  if (status === "held" || status === "pending") return "confirm";

  const board = input.board ?? "auto";
  if (board === "in_house") return "stay_money";
  if (board === "departures") {
    const settled = Math.abs(Number(input.balanceBtn ?? 0)) <= 0.5;
    return settled ? "check_out" : "stay_money";
  }
  if (board === "arrivals") {
    if (status === "checked_in") return "stay_money";
    if (status === "checked_out") return "check_out";
    const steps = buildStayHubSteps(input);
    const cur = steps.find((s) => s.current);
    if (cur?.id === "check_in" || cur?.id === "arrival") return cur.id;
    return "arrival";
  }

  const steps = buildStayHubSteps(input);
  return steps.find((s) => s.current)?.id ?? "reserve";
}

/** Map panel id used in UI to step. */
export function stepToPanel(step: StayHubStepId): StayHubStepId {
  return step;
}

/** Money sub-progress for step 5. */
export function buildStayMoneySubline(
  input: StayMoneyCycleInput,
): StayMoneyStep[] {
  return buildStayMoneySteps(input);
}

/** Safe step parse from query string. */
export function parseStayHubStep(
  raw: string | null | undefined,
): StayHubStepId | null {
  if (!raw) return null;
  const v = raw.toLowerCase().replace(/-/g, "_");
  if ((ORDER as string[]).includes(v)) return v as StayHubStepId;
  // aliases
  if (v === "money" || v === "stay") return "stay_money";
  if (v === "checkin" || v === "ci") return "check_in";
  if (v === "checkout" || v === "co") return "check_out";
  if (v === "guest" || v === "docs") return "arrival";
  return null;
}

export const STAY_HUB_STEP_ORDER = ORDER;
