import { guideRequired, sdfRequired, type GuestOrigin } from "@/lib/checkin-rules";
import type { StayHubStepId } from "@/lib/folio/stay-hub-cycle";
import { recommendStayHubStep } from "@/lib/folio/stay-hub-cycle";

export type ArrivalBadge = {
  key: string;
  label: string;
  tone: "ok" | "warn" | "danger" | "info";
};

export type ArrivalBoardInput = {
  status: string | null;
  guest_origin: string | null;
  guide_number: string | null;
  payment_mode: string | null;
  token_required_btn: number | null;
  token_received_btn: number | null;
  rooms: number | null;
  assigned_count: number;
  room_labels: string[];
  dirty_or_ooo: boolean;
  has_unready_guest_room: boolean;
  folio_balance_btn?: number | null;
};

export function computeArrivalBadges(row: ArrivalBoardInput): ArrivalBadge[] {
  const badges: ArrivalBadge[] = [];
  const origin = (row.guest_origin ?? "international") as GuestOrigin;
  const needed = Math.max(1, Number(row.rooms ?? 1));

  if (["pending", "confirmed"].includes(row.status ?? "")) {
    if (row.assigned_count < needed) {
      badges.push({
        key: "unassigned",
        label: row.assigned_count === 0 ? "No rooms" : "Partial rooms",
        tone: "danger",
      });
    } else {
      badges.push({
        key: "rooms",
        label: row.room_labels.slice(0, 3).join(", ") || "Rooms ready",
        tone: "ok",
      });
    }

    if (row.has_unready_guest_room || row.dirty_or_ooo) {
      badges.push({
        key: "hk",
        label: "HK not ready",
        tone: "warn",
      });
    }

    if (guideRequired(origin) && !row.guide_number?.trim()) {
      badges.push({ key: "guide", label: "Guide #", tone: "warn" });
    }

    if (sdfRequired(origin)) {
      badges.push({ key: "sdf", label: "SDF", tone: "info" });
    }

    if (row.payment_mode === "on_credit") {
      badges.push({ key: "credit", label: "On credit", tone: "info" });
    }

    const required = Number(row.token_required_btn ?? 0);
    const received = Number(row.token_received_btn ?? 0);
    if (required > 0 && received + 0.009 < required) {
      badges.push({
        key: "deposit",
        label: "Deposit due",
        tone: "danger",
      });
    }
  }

  if (row.status === "checked_in") {
    if (row.room_labels.length) {
      badges.push({
        key: "rooms",
        label: row.room_labels.slice(0, 3).join(", "),
        tone: "ok",
      });
    }
    const bal = Number(row.folio_balance_btn ?? 0);
    if (Math.abs(bal) > 0.009) {
      badges.push({
        key: "balance",
        label: `Bal Nu ${bal.toFixed(0)}`,
        tone: bal > 0 ? "warn" : "ok",
      });
    } else if (row.folio_balance_btn != null) {
      badges.push({ key: "settled", label: "Settled", tone: "ok" });
    }
  }

  return badges;
}

export function boardActionLabel(status: string | null): string {
  if (status === "checked_in") return "Open stay";
  if (status === "pending" || status === "confirmed") return "Open stay";
  if (status === "held") return "Confirm token";
  return "Open stay";
}

/**
 * StayHub deep link on FO list routes (?booking=&step=). Prefer modal over
 * full-page check-in / check-out forms.
 */
export function boardActionHref(
  status: string | null,
  id: string,
  board:
    | "arrivals"
    | "in_house"
    | "departures"
    | "reservations"
    | "auto" = "auto",
): string {
  const step = recommendStayHubStep({
    status: status ?? "confirmed",
    board,
    balanceBtn: 0,
    hasRoomAssigned: true,
    sdfIncomplete: false,
  });
  const base =
    board === "in_house"
      ? "/erp/in-house"
      : board === "departures"
        ? "/erp/departures"
        : board === "reservations"
          ? "/erp/reservations"
          : board === "arrivals"
            ? "/erp/arrivals"
            : status === "checked_in"
              ? "/erp/in-house"
              : ["pending", "confirmed"].includes(status ?? "")
                ? "/erp/arrivals"
                : "/erp/reservations";
  return `${base}?booking=${encodeURIComponent(id)}&step=${step}`;
}

export function stayHubHref(
  id: string,
  step?: StayHubStepId | null,
  listPath = "/erp/reservations",
): string {
  const params = new URLSearchParams({ booking: id });
  if (step) params.set("step", step);
  return `${listPath}?${params.toString()}`;
}
