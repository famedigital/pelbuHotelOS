/** Pure guest-CRM money rollups for desk dossiers (no UI / store deps). */

export type GuestStayMoneyInput = {
  checkIn: string;
  checkOut: string;
  charged: number;
  paid: number;
  /** folioBalance — charges + payment credits (payments negative). */
  balance: number;
  guestName: string;
  confirmationNo: string;
  roomNumber: string | null;
  status: string;
  companions?: Array<{ name?: string | null; fullName?: string | null }>;
  notes?: string | null;
  agencyName?: string | null;
  groupName?: string | null;
};

export type GuestMoneyTotals = {
  charged: number;
  paid: number;
  /** Sum of open balances (positive = amount still due). */
  unpaid: number;
  stayCount: number;
};

export function sumGuestStayMoney(stays: GuestStayMoneyInput[]): GuestMoneyTotals {
  let charged = 0;
  let paid = 0;
  let unpaid = 0;
  for (const s of stays) {
    charged += Math.max(0, s.charged);
    paid += Math.max(0, s.paid);
    unpaid += Math.max(0, s.balance);
  }
  return {
    charged: round2(charged),
    paid: round2(paid),
    unpaid: round2(unpaid),
    stayCount: stays.length,
  };
}

/** Inclusive YYYY-MM-DD stay overlap filter. Empty bounds = no bound. */
export function stayOverlapsRange(
  stay: Pick<GuestStayMoneyInput, "checkIn" | "checkOut">,
  from: string,
  to: string,
): boolean {
  const f = from.trim();
  const t = to.trim();
  if (f && stay.checkOut <= f) return false;
  if (t && stay.checkIn > t) return false;
  return true;
}

/** Search dossier + nested stay / companion / group fields. */
export function guestCrmSearchHaystack(input: {
  name: string;
  passportOrCid: string;
  nationality: string;
  phone: string;
  stays: GuestStayMoneyInput[];
}): string {
  const parts = [
    input.name,
    input.passportOrCid,
    input.nationality,
    input.phone,
  ];
  for (const s of input.stays) {
    parts.push(
      s.guestName,
      s.confirmationNo,
      s.roomNumber ?? "",
      s.status,
      s.notes ?? "",
      s.agencyName ?? "",
      s.groupName ?? "",
    );
    for (const c of s.companions ?? []) {
      parts.push(c.name ?? c.fullName ?? "");
    }
  }
  return parts.join(" ").toLowerCase();
}

export function guestCrmMatchesQuery(
  haystack: string,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return needle.split(/\s+/).every((tok) => haystack.includes(tok));
}

export function staysToCsv(stays: GuestStayMoneyInput[]): string {
  const header = [
    "confirmation",
    "guest",
    "check_in",
    "check_out",
    "room",
    "status",
    "charged",
    "paid",
    "balance",
    "agency",
    "group",
  ];
  const rows = stays.map((s) =>
    [
      s.confirmationNo,
      s.guestName,
      s.checkIn,
      s.checkOut,
      s.roomNumber ?? "",
      s.status,
      String(round2(s.charged)),
      String(round2(s.paid)),
      String(round2(s.balance)),
      s.agencyName ?? "",
      s.groupName ?? "",
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

function csvCell(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
