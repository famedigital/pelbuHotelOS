import { guideRequired, sdfRequired, type GuestOrigin } from "@/lib/checkin-rules";

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

/**
 * Statuses the check-in screen can actually act on. Anything else routed there
 * lands on a dead end, so it belongs on the booking detail page instead.
 */
const CHECKIN_STATUSES = new Set(["pending", "confirmed", "checked_in"]);

export function boardActionLabel(status: string | null): string {
  if (status === "checked_in") return "Check out";
  if (status === "pending" || status === "confirmed") return "Check in";
  if (status === "held") return "Confirm token";
  return "View";
}

export function boardActionHref(status: string | null, id: string): string {
  if (status === "checked_in") return `/erp/check-out?id=${id}`;
  return CHECKIN_STATUSES.has(status ?? "")
    ? `/erp/check-in?id=${id}`
    : `/erp/bookings/${id}`;
}
