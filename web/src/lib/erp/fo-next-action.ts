import type { StayHubStepId } from "@/lib/folio/stay-hub-cycle";
import { deskBriefingLine } from "@/lib/folio/desk-briefing";

/** Ranked FO jobs for the Today worklist (eZee jobs, one CTA each). */
export type FoNextKind =
  | "check_in"
  | "collect"
  | "checkout"
  | "housekeeping"
  | "confirm";

export type FoNextAction = {
  id: string;
  kind: FoNextKind;
  rank: 1 | 2 | 3 | 4 | 5;
  guestName: string;
  roomLabel: string | null;
  why: string;
  cta: string;
  stayHubStep: StayHubStepId | null;
  href: string;
  bookingId: string | null;
  roomUnitId: string | null;
};

export type FoStayFacts = {
  bookingId: string;
  guestName: string;
  roomLabel: string | null;
  status: string;
  checkIn: string;
  checkOut: string;
  businessDate: string;
  balanceBtn: number;
  hasRoomAssigned: boolean;
  tokenRequiredBtn?: number | null;
  tokenReceivedBtn?: number | null;
  depositDueOn?: string | null;
  /** HK / room not ready for CI. */
  roomUnready?: boolean;
  sdfIncomplete?: boolean;
  openLaundryCount?: number;
};

export type FoDirtyRoomFacts = {
  roomUnitId: string;
  roomLabel: string;
  occupied: boolean;
};

const KIND_META: Record<
  FoNextKind,
  { rank: 1 | 2 | 3 | 4 | 5; cta: string; stayHubStep: StayHubStepId | null }
> = {
  check_in: { rank: 1, cta: "Check-in", stayHubStep: "check_in" },
  collect: { rank: 2, cta: "Collect", stayHubStep: "stay_money" },
  checkout: { rank: 3, cta: "Checkout", stayHubStep: "check_out" },
  housekeeping: { rank: 4, cta: "Housekeeping", stayHubStep: null },
  confirm: { rank: 5, cta: "Confirm", stayHubStep: "confirm" },
};

function day(iso: string | null | undefined): string {
  return (iso ?? "").slice(0, 10);
}

function dueOpen(balanceBtn: number): boolean {
  return Math.abs(Number(balanceBtn) || 0) > 0.5;
}

function depositIncomplete(facts: FoStayFacts): boolean {
  const required = Number(facts.tokenRequiredBtn ?? 0);
  const received = Number(facts.tokenReceivedBtn ?? 0);
  if (required > 0.5 && received + 0.5 < required) return true;
  const dueOn = day(facts.depositDueOn);
  const biz = day(facts.businessDate);
  return Boolean(dueOn && biz && dueOn <= biz && required > received + 0.5);
}

/** Highest-priority stay job for Today, or null if the stay is not today’s work. */
export function recommendFoStayJob(facts: FoStayFacts): FoNextKind | null {
  const status = (facts.status ?? "").toLowerCase();
  const biz = day(facts.businessDate);
  const checkIn = day(facts.checkIn);
  const checkOut = day(facts.checkOut);

  if (["cancelled", "no_show", "expired", "checked_out"].includes(status)) {
    return null;
  }

  if (
    checkIn === biz &&
    (status === "pending" || status === "confirmed" || status === "held")
  ) {
    return "check_in";
  }

  if (status === "checked_in" && checkOut === biz) {
    return dueOpen(facts.balanceBtn) ? "collect" : "checkout";
  }

  if (
    (status === "pending" || status === "held") &&
    depositIncomplete(facts)
  ) {
    return "confirm";
  }

  return null;
}

export function foActionFromStay(
  facts: FoStayFacts,
  kind: FoNextKind,
): FoNextAction {
  const meta = KIND_META[kind];
  const why =
    kind === "check_in"
      ? deskBriefingLine({
          status: facts.status,
          hasRoomAssigned: facts.hasRoomAssigned,
          roomUnready: facts.roomUnready,
          sdfIncomplete: facts.sdfIncomplete,
          depositIncomplete: depositIncomplete(facts),
        })
      : kind === "collect"
        ? deskBriefingLine({
            status: facts.status,
            balanceBtn: facts.balanceBtn,
            checkOutToday: true,
            openLaundryCount: facts.openLaundryCount,
          })
        : kind === "checkout"
          ? deskBriefingLine({
              status: facts.status,
              balanceBtn: 0,
              checkOutToday: true,
              openLaundryCount: facts.openLaundryCount,
            })
          : "Hold / deposit due";
  return {
    id: `stay:${facts.bookingId}`,
    kind,
    rank: meta.rank,
    guestName: facts.guestName.trim() || "Guest",
    roomLabel: facts.roomLabel,
    why,
    cta: meta.cta,
    stayHubStep: meta.stayHubStep,
    href: `/erp/today?booking=${encodeURIComponent(facts.bookingId)}&step=${meta.stayHubStep ?? "reserve"}`,
    bookingId: facts.bookingId,
    roomUnitId: null,
  };
}

export function foActionFromDirtyRoom(room: FoDirtyRoomFacts): FoNextAction | null {
  if (room.occupied) return null;
  const meta = KIND_META.housekeeping;
  return {
    id: `hk:${room.roomUnitId}`,
    kind: "housekeeping",
    rank: meta.rank,
    guestName: room.roomLabel,
    roomLabel: room.roomLabel,
    why: "Dirty — not for Walk In",
    cta: meta.cta,
    stayHubStep: null,
    href: "/erp/housekeeping",
    bookingId: null,
    roomUnitId: room.roomUnitId,
  };
}

export function sortFoNextActions(rows: FoNextAction[]): FoNextAction[] {
  return [...rows].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return (a.roomLabel ?? a.guestName).localeCompare(
      b.roomLabel ?? b.guestName,
    );
  });
}
