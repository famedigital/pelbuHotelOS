/**
 * Pure helpers for Agents desk — booking gate, filter, sort, export.
 */
import type { PartneredAgentRow } from "./b2b-portfolio";

export type AgentListSegment = "with_bookings" | "directory";

export type AgentListFilter =
  | "all"
  | "unpaid"
  | "overdue"
  | "active"
  | "in_house"
  | "arriving";

export type AgentListSort =
  | "name"
  | "unpaid"
  | "paid"
  | "in_house"
  | "arriving"
  | "code";

export function agentHasBookings(row: PartneredAgentRow): boolean {
  return (
    row.staysHeld + row.staysInHouse + row.staysArriving > 0 ||
    row.arOutstanding > 0.5 ||
    row.paidTotal > 0.5
  );
}

export function filterAgentRows(input: {
  rows: PartneredAgentRow[];
  segment: AgentListSegment;
  query: string;
  filter: AgentListFilter;
  sort: AgentListSort;
}): PartneredAgentRow[] {
  const q = input.query.trim().toLowerCase();
  let list = input.rows.filter((r) => {
    const booked = agentHasBookings(r);
    if (input.segment === "with_bookings" && !booked) return false;
    if (input.segment === "directory" && booked) return false;
    if (input.filter === "unpaid" && r.arOutstanding <= 0.5) return false;
    if (input.filter === "overdue" && r.aging90 <= 0.5) return false;
    if (input.filter === "active" && !r.active) return false;
    if (input.filter === "in_house" && r.staysInHouse <= 0) return false;
    if (input.filter === "arriving" && r.staysArriving <= 0) return false;
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      r.code.toLowerCase().includes(q)
    );
  });

  list = [...list].sort((a, b) => {
    if (input.sort === "unpaid") return b.arOutstanding - a.arOutstanding;
    if (input.sort === "paid") return b.paidTotal - a.paidTotal;
    if (input.sort === "in_house") return b.staysInHouse - a.staysInHouse;
    if (input.sort === "arriving") return b.staysArriving - a.staysArriving;
    if (input.sort === "code") return a.code.localeCompare(b.code);
    return a.name.localeCompare(b.name);
  });
  return list;
}

export function agentRowsToCsv(rows: PartneredAgentRow[]): string {
  const header =
    "Agent,Code,Unpaid,Paid,InHouse,Arriving,Held,Overdue";
  const lines = rows.map((r) =>
    [
      csvEscape(r.name),
      csvEscape(r.code),
      r.arOutstanding.toFixed(2),
      r.paidTotal.toFixed(2),
      String(r.staysInHouse),
      String(r.staysArriving),
      String(r.staysHeld),
      r.aging90.toFixed(2),
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
