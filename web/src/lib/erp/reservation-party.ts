/**
 * Party / group rollup for the reservations board (PMS-style rooming list).
 *
 * Industry pattern (Opera / Cloudbeds / Mews / Apaleo):
 * - Formal group master (`booking_groups`) always rolls up child bookings.
 * - Soft party suggestion when multiple ungrouped bookings share:
 *   agent, agent company name, or the same lead/party contact name
 *   on matching stay dates (common multi-room imports like "Brazilian march Group").
 * - Singleton bookings stay alone until linked.
 */

import type { BookingRow } from "@/components/erp/BookingsTable";

export type PartyKind = "group" | "suggested" | "single";

export type BookingGroupMembership = {
  bookingId: string;
  groupId: string;
  groupName: string;
  groupStatus: string | null;
};

export type ReservationParty = {
  /** Stable accordion value / React key. */
  id: string;
  kind: PartyKind;
  groupId: string | null;
  label: string;
  agentId: string | null;
  agentName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  members: BookingRow[];
  roomsSold: number;
  assignedCount: number;
  roomLabels: string[];
  /** Most advanced non-terminal status among members, else first. */
  primaryStatus: string | null;
};

const STATUS_RANK: Record<string, number> = {
  checked_in: 50,
  confirmed: 40,
  pending: 30,
  held: 20,
  checked_out: 10,
  cancelled: 0,
  no_show: 0,
  expired: 0,
};

const GENERIC_CONTACTS = new Set([
  "guest",
  "walk-in",
  "walk in",
  "tba",
  "tbd",
  "n/a",
  "na",
  "unknown",
  "test",
]);

function normalizePartyToken(raw: string | null | undefined): string {
  return (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s.\-_/&]/gu, "");
}

/**
 * Soft-party key for multi-room rollup (not yet formal group members).
 * Prefer agent id, then agent company, then phone / shared party contact.
 */
export function softPartyKey(row: BookingRow): string | null {
  if (!row.check_in) return null;

  if (row.agent_id) {
    const out = row.check_out ?? "";
    return `soft:agent:${row.agent_id}:${row.check_in}:${out}`;
  }

  const agentName = normalizePartyToken(row.agent_name);
  if (agentName.length >= 3) {
    const out = row.check_out ?? "";
    return `soft:agentname:${agentName}:${row.check_in}:${out}`;
  }

  // Shared mobile on multi-room agent/client imports (e.g. same tour contact).
  // Use last 8 digits so +975-17-112-107 matches 17112107.
  const phoneDigits = (row.contact_phone ?? "").replace(/\D/g, "");
  const phone =
    phoneDigits.length > 8 ? phoneDigits.slice(-8) : phoneDigits;
  if (phone.length >= 7) {
    return `soft:phone:${phone}:${row.check_in}`;
  }

  const contact = normalizePartyToken(row.contact_name);
  if (contact.length >= 4 && !GENERIC_CONTACTS.has(contact)) {
    // Same party name + arrival (check-out may differ per room on imports).
    return `soft:contact:${contact}:${row.check_in}`;
  }

  return null;
}

function pickPrimaryStatus(members: BookingRow[]): string | null {
  let best: string | null = null;
  let bestRank = -1;
  for (const m of members) {
    const s = m.status ?? "";
    const rank = STATUS_RANK[s] ?? 5;
    if (rank > bestRank) {
      bestRank = rank;
      best = s;
    }
  }
  return best;
}

function partyLabelFor(members: BookingRow[]): string {
  const head = members[0]!;
  const base =
    head.agent_name?.trim() ||
    head.contact_name?.trim() ||
    "Party";
  const n = members.reduce((s, m) => s + Math.max(1, Number(m.rooms ?? 1)), 0);
  return `${base} · multi-room · ${n}`;
}

function aggregateParty(
  id: string,
  kind: PartyKind,
  members: BookingRow[],
  opts: {
    groupId: string | null;
    label: string;
  },
): ReservationParty {
  const labels = new Set<string>();
  let roomsSold = 0;
  let assigned = 0;
  for (const m of members) {
    roomsSold += Math.max(1, Number(m.rooms ?? 1));
    assigned += Number(m.assigned_count ?? 0);
    const parts = (m.room_labels ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const p of parts) labels.add(p);
  }
  const sortedLabels = [...labels].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  const head = members[0]!;
  return {
    id,
    kind,
    groupId: opts.groupId,
    label: opts.label,
    agentId: head.agent_id ?? null,
    agentName: head.agent_name ?? null,
    checkIn: head.check_in,
    checkOut: head.check_out,
    members: members.slice().sort((a, b) => {
      const aLab = a.room_labels ?? "";
      const bLab = b.room_labels ?? "";
      if (aLab !== bLab) {
        return aLab.localeCompare(bLab, undefined, { numeric: true });
      }
      return (a.contact_name ?? "").localeCompare(b.contact_name ?? "");
    }),
    roomsSold,
    assignedCount: assigned,
    roomLabels: sortedLabels,
    primaryStatus: pickPrimaryStatus(members),
  };
}

/**
 * Roll bookings into party cards for the reservations board.
 * Membership takes priority over soft-party heuristics.
 */
export function buildReservationParties(
  rows: BookingRow[],
  memberships: BookingGroupMembership[],
): ReservationParty[] {
  const byBooking = new Map(
    memberships.map((m) => [m.bookingId, m] as const),
  );
  const formalBuckets = new Map<
    string,
    { meta: BookingGroupMembership; members: BookingRow[] }
  >();
  const softBuckets = new Map<string, BookingRow[]>();
  const singles: BookingRow[] = [];

  for (const row of rows) {
    const mem = byBooking.get(row.id);
    if (mem) {
      const bucket = formalBuckets.get(mem.groupId) ?? {
        meta: mem,
        members: [],
      };
      bucket.members.push(row);
      formalBuckets.set(mem.groupId, bucket);
      continue;
    }

    const key = softPartyKey(row);
    if (key) {
      const list = softBuckets.get(key) ?? [];
      list.push(row);
      softBuckets.set(key, list);
      continue;
    }

    singles.push(row);
  }

  const parties: ReservationParty[] = [];

  for (const [groupId, bucket] of formalBuckets) {
    parties.push(
      aggregateParty(`group:${groupId}`, "group", bucket.members, {
        groupId,
        label: bucket.meta.groupName?.trim() || "Group",
      }),
    );
  }

  for (const [key, members] of softBuckets) {
    if (members.length >= 2) {
      parties.push(
        aggregateParty(key, "suggested", members, {
          groupId: null,
          label: partyLabelFor(members),
        }),
      );
    } else if (members[0]) {
      singles.push(members[0]);
    }
  }

  for (const row of singles) {
    parties.push(
      aggregateParty(`single:${row.id}`, "single", [row], {
        groupId: null,
        label: row.contact_name?.trim() || "Reservation",
      }),
    );
  }

  // Preserve board sort by primary arrival (desc already applied on members' parent list)
  parties.sort((a, b) => {
    const da = a.checkIn ?? "";
    const db = b.checkIn ?? "";
    if (da !== db) return db.localeCompare(da);
    // Multi-room parties above singles on same date
    const ma = a.members.length;
    const mb = b.members.length;
    if (ma !== mb) return mb - ma;
    return a.label.localeCompare(b.label);
  });

  return parties;
}

export function partyRoomFit(
  party: ReservationParty,
): "none" | "partial" | "full" | "n_a" {
  if (party.roomsSold <= 0) return "n_a";
  if (party.assignedCount <= 0) return "none";
  if (party.assignedCount < party.roomsSold) return "partial";
  return "full";
}
