/**
 * Pure helpers for Reservations workbench — filter / sort / money / export.
 */
export type ResStayLike = {
  id: string;
  guestName: string;
  confirmationNo: string;
  roomNumber: string | null;
  roomId: string | null;
  groupName: string | null;
  guestPhone: string;
  agencyName: string | null;
  source: string;
  status: string;
  checkIn: string;
  checkOut: string;
  nationality?: string;
  mealPlan?: string;
  typeCode?: string;
};

export type ResStatusTab =
  | "all"
  | "confirmed"
  | "held"
  | "checked_in"
  | "checked_out"
  | "cancelled";

export type ResSortKey =
  | "arrival"
  | "departure"
  | "guest"
  | "balance"
  | "conf";

export type ResMoneyChip =
  | "none"
  | "balance_due"
  | "follow_up"
  | "agent_only"
  | "unassigned";

export function stayOverlapsResRange(
  stay: Pick<ResStayLike, "checkIn" | "checkOut">,
  fromDate: string,
  toDate: string,
): boolean {
  if (!fromDate && !toDate) return true;
  const from = fromDate || "0000-01-01";
  const to = toDate || "9999-12-31";
  return stay.checkIn <= to && stay.checkOut >= from;
}

export function matchesResStatus(stay: ResStayLike, tab: ResStatusTab): boolean {
  if (tab === "all") return true;
  if (tab === "held") return stay.status === "held";
  return stay.status === tab;
}

export function matchesResSearch(stay: ResStayLike, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    stay.guestName.toLowerCase().includes(q) ||
    stay.confirmationNo.toLowerCase().includes(q) ||
    (stay.roomNumber ?? "").toLowerCase().includes(q) ||
    (stay.groupName ?? "").toLowerCase().includes(q) ||
    stay.guestPhone.toLowerCase().includes(q) ||
    (stay.agencyName ?? "").toLowerCase().includes(q)
  );
}

export function isCheckoutUnpaid(stay: ResStayLike, balance: number): boolean {
  return stay.status === "checked_out" && balance > 0.5;
}

export function isUnassignedLive(stay: ResStayLike): boolean {
  if (stay.roomId || stay.roomNumber) return false;
  return stay.status === "confirmed" || stay.status === "held";
}

export function filterReservations(input: {
  stays: ResStayLike[];
  balances: Record<string, number>;
  status: ResStatusTab;
  source: string;
  agent: string;
  query: string;
  fromDate: string;
  toDate: string;
  moneyChip: ResMoneyChip;
  sort: ResSortKey;
}): ResStayLike[] {
  const agentQ = input.agent.trim().toLowerCase();
  let list = input.stays.filter((s) => {
    if (!matchesResStatus(s, input.status)) return false;
    if (input.source !== "all" && s.source !== input.source) return false;
    if (agentQ && agentQ !== "all") {
      const agency = (s.agencyName ?? "").toLowerCase();
      if (!agency.includes(agentQ)) return false;
    }
    if (!matchesResSearch(s, input.query)) return false;
    if (!stayOverlapsResRange(s, input.fromDate, input.toDate)) return false;
    const bal = input.balances[s.id] ?? 0;
    if (input.moneyChip === "balance_due" && bal <= 0.5) return false;
    if (input.moneyChip === "follow_up" && !isCheckoutUnpaid(s, bal)) return false;
    if (input.moneyChip === "agent_only" && s.source !== "agent" && !s.agencyName)
      return false;
    if (input.moneyChip === "unassigned" && !isUnassignedLive(s)) return false;
    return true;
  });

  list = [...list].sort((a, b) => {
    const balA = input.balances[a.id] ?? 0;
    const balB = input.balances[b.id] ?? 0;
    if (input.sort === "departure") return a.checkOut.localeCompare(b.checkOut);
    if (input.sort === "guest") return a.guestName.localeCompare(b.guestName);
    if (input.sort === "balance") return balB - balA;
    if (input.sort === "conf") return a.confirmationNo.localeCompare(b.confirmationNo);
    return (
      a.checkIn.localeCompare(b.checkIn) || a.guestName.localeCompare(b.guestName)
    );
  });
  return list;
}

export function sumUnpaidNow(
  stays: ResStayLike[],
  balances: Record<string, number>,
): number {
  return stays
    .filter((s) => s.status === "checked_in" || s.status === "confirmed")
    .reduce((n, s) => n + Math.max(0, balances[s.id] ?? 0), 0);
}

export function countFollowUp(
  stays: ResStayLike[],
  balances: Record<string, number>,
): number {
  return stays.filter((s) => isCheckoutUnpaid(s, balances[s.id] ?? 0)).length;
}

export function agencyOptions(stays: ResStayLike[]): string[] {
  const set = new Set<string>();
  for (const s of stays) {
    const name = s.agencyName?.trim();
    if (name) set.add(name);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function reservationsToCsv(
  stays: ResStayLike[],
  balances: Record<string, number>,
  paidById: Record<string, number>,
): string {
  const header =
    "Conf,Guest,Status,CheckIn,CheckOut,Room,Source,Agent,Paid,Balance";
  const rows = stays.map((s) => {
    const bal = Math.max(0, balances[s.id] ?? 0);
    const paid = Math.max(0, paidById[s.id] ?? 0);
    const cells = [
      s.confirmationNo,
      s.guestName,
      s.status,
      s.checkIn,
      s.checkOut,
      s.roomNumber ?? "",
      s.source,
      s.agencyName ?? "",
      paid.toFixed(2),
      bal.toFixed(2),
    ];
    return cells.map(csvEscape).join(",");
  });
  return [header, ...rows].join("\n");
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
