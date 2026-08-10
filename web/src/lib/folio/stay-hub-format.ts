import { fmtDate } from "@/lib/erp-lists";
import type { StayHubStepId } from "@/lib/folio/stay-hub-cycle";

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    held: "Held",
    pending: "Pending",
    confirmed: "Confirmed",
    checked_in: "Checked in",
    checked_out: "Checked out",
    cancelled: "Cancelled",
    no_show: "No-show",
    expired: "Expired",
  };
  const key = (status ?? "").toLowerCase();
  return map[key] ?? status.replace(/_/g, " ");
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(`${checkIn.slice(0, 10)}T12:00:00Z`).getTime();
  const b = new Date(`${checkOut.slice(0, 10)}T12:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** e.g. "DELUXE-03 · Deluxe suite · 2 nights · 01 Aug – 03 Aug 2026 · PS-2026-00042" */
export function stayMetaLine(input: {
  roomLabel?: string | null;
  roomTypeName?: string | null;
  checkIn: string;
  checkOut: string;
  bookingId?: string | null;
  /** Prefer over short UUID — e.g. PS-2026-00042 */
  confirmationCode?: string | null;
}): string {
  const nights = nightsBetween(input.checkIn, input.checkOut);
  const room = input.roomLabel?.trim() || "Unassigned";
  const type = input.roomTypeName?.trim();
  const range = `${fmtDate(input.checkIn)} – ${fmtDate(input.checkOut)}`;
  const parts = [
    room,
    type || null,
    nights > 0 ? `${nights} night${nights === 1 ? "" : "s"}` : null,
    range,
  ].filter(Boolean);
  const conf = input.confirmationCode?.trim();
  if (conf) {
    parts.push(conf);
  } else if (input.bookingId) {
    parts.push(`#${input.bookingId.slice(0, 8)}`);
  }
  return parts.join(" · ");
}

export function panelDescription(panel: StayHubStepId): string {
  switch (panel) {
    case "reserve":
      return "Contact, dates, rate. Saves as you type.";
    case "confirm":
      return "Hold token and confirmation.";
    case "arrival":
      return "Guest docs and room assignment.";
    case "check_in":
      return "Docs, room, confirm check-in.";
    case "stay_money":
      return "Review bill and collect.";
    case "check_out":
      return "Release room when balance is ready.";
    default:
      return "";
  }
}

export function paymentModeLabel(mode: string | null | undefined): string {
  if (!mode) return "Unset";
  return mode.replace(/_/g, " ");
}
