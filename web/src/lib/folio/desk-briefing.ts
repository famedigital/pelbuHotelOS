/**
 * Shared “what’s next / why locked” copy for Today, StayHub strip, and header.
 */

export type DeskBriefingInput = {
  status: string;
  balanceBtn?: number | null;
  hasRoomAssigned?: boolean;
  roomUnready?: boolean;
  sdfIncomplete?: boolean;
  depositIncomplete?: boolean;
  openLaundryCount?: number;
  checkOutToday?: boolean;
  lockReason?: string | null;
};

/** One-line desk briefing for FO intelligence (deterministic). */
export function deskBriefingLine(input: DeskBriefingInput): string {
  if (input.lockReason?.trim()) return input.lockReason.trim();

  const status = (input.status ?? "").toLowerCase();
  const balance = Number(input.balanceBtn ?? 0);
  const laundry = Number(input.openLaundryCount ?? 0);

  if (status === "checked_in" && input.checkOutToday) {
    if (laundry > 0) {
      return `Due out — ${laundry} open laundry before checkout`;
    }
    if (Math.abs(balance) > 0.5) {
      return "Due out — collect balance before checkout";
    }
    return "Balance clear — ready for checkout";
  }

  if (["pending", "confirmed", "held"].includes(status)) {
    const bits: string[] = [];
    if (!input.hasRoomAssigned) bits.push("assign room");
    else if (input.roomUnready) bits.push("HK not ready");
    if (input.sdfIncomplete) bits.push("docs / SDF");
    if (input.depositIncomplete) bits.push("deposit");
    if (bits.length) return `Arrival — need ${bits.join(", ")}`;
    return "Arrival — ready to check in";
  }

  if (status === "checked_in") {
    if (Math.abs(balance) > 0.5) return "In-house — open folio balance";
    return "In-house — folio clear";
  }

  if (status === "checked_out") return "Checked out";
  return "Open stay";
}

/** Default Folio tool tab from job context. */
export function defaultFolioToolTab(input: {
  step: string;
  balanceBtn?: number | null;
  checkOutToday?: boolean;
}): "bill" | "collect" | "advanced" {
  const balance = Math.abs(Number(input.balanceBtn ?? 0));
  if (input.step === "check_out") return "bill";
  if (input.checkOutToday && balance > 0.5) return "collect";
  if (input.step === "stay_money" && balance > 0.5) return "collect";
  return "bill";
}

/** Default Check-in tool tab. */
export function defaultCheckInToolTab(input: {
  hasRoomAssigned?: boolean;
}): "room" | "guest" | "more" {
  return input.hasRoomAssigned ? "guest" : "room";
}
