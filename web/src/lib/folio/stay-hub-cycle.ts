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
  /** Booking check-in YYYY-MM-DD */
  checkInDate?: string | null;
  /** Property open business date YYYY-MM-DD */
  openBusinessDate?: string | null;
};

const LABELS: Record<StayHubStepId, { label: string; short: string }> = {
  reserve: { label: "Book", short: "Book" },
  confirm: { label: "Confirm", short: "Cfm" },
  arrival: { label: "Ready", short: "Rdy" },
  check_in: { label: "Check-in", short: "CI" },
  stay_money: { label: "Settle", short: "Pay" },
  check_out: { label: "Checkout", short: "Out" },
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

/** True when booking arrival is after the open hotel business day. */
export function isStayHubArrivalTooFar(
  checkInDate: string | null | undefined,
  openBusinessDate: string | null | undefined,
  status?: string | null,
): boolean {
  const s = (status ?? "").toLowerCase();
  if (s === "checked_in" || s === "checked_out") return false;
  if (stayHubTerminal(s)) return false;
  const checkInDay = (checkInDate ?? "").slice(0, 10);
  const openBiz = (openBusinessDate ?? "").slice(0, 10);
  return Boolean(checkInDay) && Boolean(openBiz) && checkInDay > openBiz;
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
  const checkInDay = (input.checkInDate ?? "").slice(0, 10);
  const openBiz = (input.openBusinessDate ?? "").slice(0, 10);
  const arrivalTooFar =
    Boolean(checkInDay) &&
    Boolean(openBiz) &&
    checkInDay > openBiz &&
    !checkedIn &&
    !checkedOut &&
    !terminal;

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
    else if (status === "confirmed" && arrivalReady && arrivalTooFar)
      // Future arrival — keep FO on Ready/Details, not Check-in.
      currentIdx = ORDER.indexOf("arrival");
    else if (status === "confirmed" && arrivalReady)
      currentIdx = ORDER.indexOf("check_in");
    // In-house domain focus is Folio (bill/collect). Checkout is explicit leave —
    // never promote Check-out as auto-current just because balance ≈ 0.
    else if (status === "checked_in")
      currentIdx = ORDER.indexOf("stay_money");
    else if (checkedOut) currentIdx = ORDER.length - 1;
  } else if (input.forceCurrent && !terminal) {
    // Held/pending: never treat check_out as current even if forced from board/URL.
    if (holdActive && input.forceCurrent === "check_out") {
      currentIdx = ORDER.indexOf("confirm");
    } else if (
      arrivalTooFar &&
      (input.forceCurrent === "check_in" || input.forceCurrent === "check_out")
    ) {
      currentIdx = ORDER.indexOf("arrival");
    } else {
      const forced = ORDER.indexOf(input.forceCurrent);
      if (forced >= 0) currentIdx = forced;
    }
  }

  return ORDER.map((id, i) => {
    let locked =
      !terminal &&
      !doneMap[id] &&
      i > currentIdx &&
      !(id === "stay_money" && checkedIn) &&
      !(id === "check_out" && checkedIn);
    let lockReason: string | undefined;

    // Future arrival: check-in (and checkout) stay locked until hotel day.
    if (arrivalTooFar && (id === "check_in" || id === "check_out") && !doneMap[id]) {
      locked = true;
      lockReason =
        id === "check_in"
          ? `Arrival ${checkInDay} — business day is ${openBiz}`
          : "Check in on arrival day first";
    }

    if (locked && !lockReason) {
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

  // In-house land Folio for money work. Checkout only via explicit step hint.
  if (status === "checked_in") return "stay_money";
  if (status === "checked_out") return "check_out";

  const board = input.board ?? "auto";
  if (board === "arrivals") {
    const checkInDay = (input.checkInDate ?? "").slice(0, 10);
    const openBiz = (input.openBusinessDate ?? "").slice(0, 10);
    if (
      checkInDay &&
      openBiz &&
      checkInDay > openBiz &&
      ["pending", "confirmed"].includes(status)
    ) {
      return "arrival";
    }
    if (["pending", "confirmed"].includes(status)) return "check_in";
    return "check_in";
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

export type StayHubBoard =
  | "arrivals"
  | "in_house"
  | "departures"
  | "reservations"
  | "auto";

/** Desk board path for deep-link re-open of StayHub. */
export function stayHubBoardPath(
  board: StayHubBoard | string | null | undefined,
): string {
  switch ((board ?? "").toLowerCase()) {
    case "arrivals":
      return "/erp/arrivals";
    case "departures":
      return "/erp/departures";
    case "reservations":
      return "/erp/reservations";
    case "in_house":
      return "/erp/in-house";
    case "today":
    default:
      return "/erp/today";
  }
}

export function parseStayHubBoard(
  raw: string | null | undefined,
): StayHubBoard {
  const v = (raw ?? "").toLowerCase().replace(/-/g, "_");
  if (v === "arrivals") return "arrivals";
  if (v === "departures") return "departures";
  if (v === "reservations") return "reservations";
  if (v === "in_house" || v === "inhouse") return "in_house";
  return "auto";
}

/**
 * Board URL that re-opens StayHub on a booking + panel
 * (StayHubProvider hydrates `?booking=` / `?step=`).
 */
export function buildStayHubReopenHref(opts: {
  bookingId: string;
  panel?: StayHubStepId | null;
  board?: StayHubBoard | string | null;
}): string {
  const path = stayHubBoardPath(opts.board);
  const params = new URLSearchParams();
  params.set("booking", opts.bookingId.trim());
  if (opts.panel) params.set("step", opts.panel);
  return `${path}?${params.toString()}`;
}

/**
 * Full folio page (or receipt/statement) with optional StayHub return context.
 * Receipt usually omits stay= so it can open in a new tab without forcing return chrome.
 */
export function buildFolioPageHref(opts: {
  folioId: string;
  /** When true and bookingId set: ?stay=1&booking=&panel=&board= */
  stayReturn?: boolean;
  bookingId?: string | null;
  panel?: StayHubStepId | null;
  board?: StayHubBoard | string | null;
  pathSuffix?: "" | "/receipt" | "/statement";
}): string {
  const base = `/erp/folios/${opts.folioId}${opts.pathSuffix ?? ""}`;
  if (!opts.stayReturn || !opts.bookingId?.trim()) return base;
  const params = new URLSearchParams();
  params.set("stay", "1");
  params.set("booking", opts.bookingId.trim());
  if (opts.panel) params.set("panel", opts.panel);
  const board = parseStayHubBoard(opts.board ?? null);
  if (board !== "auto") params.set("board", board);
  return `${base}?${params.toString()}`;
}

/**
 * Desk staff back-nav target for the current panel.
 * Walks reverse along desk progression — never closes the modal.
 *
 * check_out → stay_money · stay_money → check_in (or Details pre-stay)
 * check_in / arrival → confirm (holds) or reserve (Details) · confirm → reserve
 */
export function previousStayHubPanel(
  panel: StayHubStepId,
  status: string,
): StayHubStepId | null {
  const s = (status ?? "").toLowerCase();
  const hold = s === "held" || s === "pending";
  const preStay = !["checked_in", "checked_out"].includes(s);

  switch (panel) {
    case "check_out":
      return "stay_money";
    case "stay_money":
      // Pre-stay rarely lands here; still step back into the CI / Details lane.
      return preStay ? "reserve" : "check_in";
    case "check_in":
    case "arrival":
      return hold ? "confirm" : "reserve";
    case "confirm":
      return "reserve";
    case "reserve":
    default:
      return null;
  }
}

/** Short destination label for Back affordances (aria / button text). */
export function stayHubBackTargetLabel(
  target: StayHubStepId,
  status: string,
): string {
  const s = (status ?? "").toLowerCase();
  const inStay = s === "checked_in" || s === "checked_out";
  if (target === "stay_money") return inStay ? "Folio" : LABELS.stay_money.label;
  if (target === "reserve") return "Details";
  if (target === "check_in") return "Check-in";
  if (target === "confirm") return "Confirm";
  if (target === "arrival") return "Ready";
  if (target === "check_out") return "Checkout";
  return "previous step";
}

/**
 * Whether staff may jump to `id` from the progress strip while viewing `panel`.
 * Completed and earlier steps stay navigable even if the domain marks them locked.
 */
export function canNavigateStayHubStep(input: {
  targetId: StayHubStepId;
  panel: StayHubStepId;
  step: StayHubStep | undefined;
  status: string;
}): boolean {
  const { targetId, panel, step, status } = input;
  if (!step) return false;
  if (stayHubTerminal(status)) return false;
  if (step.done || step.current || targetId === panel) return true;
  if (!step.locked) return true;
  // Reverse along full order — always allow going to an earlier step.
  const ti = ORDER.indexOf(targetId);
  const pi = ORDER.indexOf(panel);
  if (ti >= 0 && pi >= 0 && ti < pi) return true;
  const s = (status ?? "").toLowerCase();
  // In-house path stays open; thin Details (reserve) is always jumpable.
  if (
    (s === "checked_in" || s === "checked_out") &&
    (targetId === "stay_money" ||
      targetId === "check_out" ||
      targetId === "check_in" ||
      targetId === "reserve")
  ) {
    return true;
  }
  return false;
}

/**
 * Desk FO hierarchy — vertical left rail (or mobile strip).
 * Pre-stay: Details · Check-in.
 * In-house: Details · Check-in · Folio · Checkout.
 * Maps reserve/confirm→Details, check_in→Check-in, stay_money→Folio, check_out→Checkout.
 * Engine still has 6 underlying steps; this maps FO labels only.
 */
export function deskFocusedSteps(
  steps: StayHubStep[],
  status: string,
): StayHubStep[] {
  const s = (status ?? "").toLowerCase();
  const inStay = s === "checked_in" || s === "checked_out";
  const confirmStep = steps.find((st) => st.id === "confirm");
  const reserveStep = steps.find((st) => st.id === "reserve");
  const checkInStep = steps.find((st) => st.id === "check_in");

  if (inStay) {
    const out: StayHubStep[] = [];
    if (reserveStep) {
      out.push({
        ...reserveStep,
        label: "Details",
        shortLabel: "Det",
        // Never domain-"current" for FO — Folio/Checkout own in-stay focus
        current: false,
        locked: false,
      });
    }
    if (checkInStep) {
      out.push({
        ...checkInStep,
        label: "Check-in",
        shortLabel: "CI",
        current: false,
        locked: false,
      });
    }
    for (const st of steps) {
      if (st.id === "stay_money") {
        out.push({ ...st, label: "Folio", shortLabel: "Folio" });
      } else if (st.id === "check_out") {
        out.push({ ...st, label: "Checkout", shortLabel: "Out" });
      }
    }
    return out;
  }

  return steps
    .filter((st) =>
      (["reserve", "check_in"] as StayHubStepId[]).includes(st.id),
    )
    .map((st) => {
      if (st.id === "reserve") {
        const confirmDone = confirmStep?.done ?? true;
        const confirmCurrent = confirmStep?.current ?? false;
        return {
          ...st,
          label: "Details",
          shortLabel: "Det",
          done: st.done && confirmDone,
          current: st.current || confirmCurrent,
          locked: st.locked && (confirmStep?.locked ?? false),
        };
      }
      if (st.id === "check_in") {
        return { ...st, label: "Check-in", shortLabel: "CI" };
      }
      return st;
    });
}

