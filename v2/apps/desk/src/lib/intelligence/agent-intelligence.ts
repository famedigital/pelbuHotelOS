/**
 * Agent production intelligence — top-N by room-nights, patterns, outlook, offer cues.
 * Type-only stay/agent imports so unit tests stay Vite-free.
 */
import type { Agent, RateCell, Season } from "../commercial-store";
import type { Stay } from "../front-office-store";
import {
  averageArrivalGapDays,
  buildOfferCues,
  buildOutlook,
  bumpMix,
  mixSorted,
  monthKey,
  monthLabel,
  nightsBetween,
  type MixRow,
  type OfferCues,
  type OutlookBlock,
} from "./outlook";

export type AgentIntelStaySlice = Pick<
  Stay,
  | "id"
  | "status"
  | "guestName"
  | "nationality"
  | "agencyName"
  | "source"
  | "typeCode"
  | "mealPlan"
  | "checkIn"
  | "checkOut"
  | "nightlyNet"
  | "folioLines"
  | "stayFlags"
  | "notes"
>;

function agencyToken(name: string): string {
  return name.split(" ")[0]?.toLowerCase() ?? name.toLowerCase();
}

export function stayMatchesAgent(stay: AgentIntelStaySlice, agent: Agent): boolean {
  if (stay.source !== "agent" && !stay.agencyName) return false;
  const token = agencyToken(agent.name);
  const hay = (stay.agencyName ?? "").toLowerCase();
  return (
    hay.includes(token) ||
    token.includes(hay.split(" ")[0] ?? "") ||
    (stay.agencyName?.includes(agent.code) ?? false)
  );
}

function stayRevenue(stay: AgentIntelStaySlice): { charged: number; paid: number; balance: number } {
  const open = stay.folioLines.filter((l) => !l.voided && l.stream === "master");
  const charges = open.filter((l) => l.kind !== "payment");
  const payments = open.filter((l) => l.kind === "payment");
  const charged = charges.reduce((s, l) => s + l.totalAmount, 0);
  const paid = Math.abs(payments.reduce((s, l) => s + l.totalAmount, 0));
  const balance = open.reduce((s, l) => s + l.totalAmount, 0);
  const fallback =
    charged > 0
      ? charged
      : Math.round(nightsBetween(stay.checkIn, stay.checkOut) * stay.nightlyNet);
  return {
    charged: charged > 0 ? charged : fallback,
    paid,
    balance: Math.max(0, balance),
  };
}

export type AgentIntelligenceRow = {
  agentId: string;
  agentName: string;
  agentCode: string;
  roomNights: number;
  stayCount: number;
  revenue: number;
  paid: number;
  unpaid: number;
  adr: number;
  avgGapDays: number | null;
  nationalityMix: MixRow[];
  mealMix: MixRow[];
  roomMix: MixRow[];
  monthPattern: { key: string; label: string; nights: number; stays: number }[];
  outlook: OutlookBlock;
  cues: OfferCues;
};

export type AgentIntelligenceReport = {
  from: string;
  to: string;
  asOf: string;
  top: AgentIntelligenceRow[];
  all: AgentIntelligenceRow[];
};

function mouRates(
  agent: Agent,
  cells: RateCell[] | undefined,
  season: Season | undefined,
): { single: number | null; double: number | null } {
  if (!cells?.length) return { single: null, double: null };
  const seasonKey = season ?? "peak";
  const mapCell = cells.find(
    (c) =>
      c.rateCardId === agent.rateCardId &&
      c.season === seasonKey &&
      c.mealPlan === "MAP",
  );
  const cp = cells.find(
    (c) =>
      c.rateCardId === agent.rateCardId &&
      c.season === seasonKey &&
      c.mealPlan === "CP",
  );
  const cell = mapCell ?? cp ?? cells.find((c) => c.rateCardId === agent.rateCardId);
  if (!cell) return { single: null, double: null };
  return { single: cell.singleNet, double: cell.doubleNet ?? cell.netAmount };
}

function buildAgentRow(
  agent: Agent,
  stays: AgentIntelStaySlice[],
  from: string,
  to: string,
  asOf: string,
  cells?: RateCell[],
  season?: Season,
): AgentIntelligenceRow | null {
  const mine = stays.filter((s) => {
    if (["cancelled", "no_show"].includes(s.status)) return false;
    if (!stayMatchesAgent(s, agent)) return false;
    const anchor = (s.checkOut || s.checkIn).slice(0, 10);
    return anchor >= from && anchor <= to;
  });
  if (mine.length === 0) return null;

  let roomNights = 0;
  let revenue = 0;
  let paid = 0;
  let unpaid = 0;
  const nat = new Map<string, MixRow>();
  const meal = new Map<string, MixRow>();
  const room = new Map<string, MixRow>();
  const months = new Map<string, { key: string; label: string; nights: number; stays: number }>();
  const arrivals: string[] = [];
  const checkouts: string[] = [];
  const nightByMonth = new Map<string, number>();
  const flags: string[] = [];
  const notes: string[] = [];

  for (const s of mine) {
    const nts = nightsBetween(s.checkIn, s.checkOut);
    const money = stayRevenue(s);
    roomNights += nts;
    revenue += money.charged;
    paid += money.paid;
    unpaid += money.balance;
    arrivals.push(s.checkIn.slice(0, 10));
    checkouts.push((s.checkOut || s.checkIn).slice(0, 10));
    const natKey = (s.nationality || "Unknown").trim() || "Unknown";
    bumpMix(nat, natKey, nts, money.charged);
    bumpMix(meal, s.mealPlan, nts, money.charged);
    bumpMix(room, String(s.typeCode), nts, money.charged);
    const mk = monthKey(s.checkIn);
    const m = months.get(mk) ?? { key: mk, label: monthLabel(mk), nights: 0, stays: 0 };
    m.nights += nts;
    m.stays += 1;
    months.set(mk, m);
    nightByMonth.set(mk, (nightByMonth.get(mk) ?? 0) + nts);
    if (s.stayFlags) flags.push(...s.stayFlags);
    if (s.notes?.trim()) notes.push(s.notes.trim());
  }

  const rates = mouRates(agent, cells, season);
  const mealMix = mixSorted(meal);
  const roomMix = mixSorted(room);
  const outlook = buildOutlook({
    arrivalDates: arrivals,
    checkoutDates: checkouts,
    nightByMonth,
    asOf,
  });
  const cues = buildOfferCues({
    mealMix,
    roomMix,
    singleNet: rates.single,
    doubleNet: rates.double,
    stayFlags: flags,
    stayNotes: notes,
  });

  return {
    agentId: agent.id,
    agentName: agent.name,
    agentCode: agent.code,
    roomNights,
    stayCount: mine.length,
    revenue,
    paid,
    unpaid,
    adr: roomNights > 0 ? Math.round(revenue / roomNights) : 0,
    avgGapDays: averageArrivalGapDays(arrivals),
    nationalityMix: mixSorted(nat),
    mealMix,
    roomMix,
    monthPattern: [...months.values()].sort((a, b) => a.key.localeCompare(b.key)),
    outlook,
    cues,
  };
}

export function buildAgentIntelligence(input: {
  agents: Agent[];
  stays: AgentIntelStaySlice[];
  from: string;
  to: string;
  asOf?: string;
  topN?: number;
  cells?: RateCell[];
  season?: Season;
}): AgentIntelligenceReport {
  const asOf = input.asOf ?? new Date().toISOString().slice(0, 10);
  const topN = input.topN ?? 10;
  const rows: AgentIntelligenceRow[] = [];
  for (const agent of input.agents.filter((a) => a.active !== false)) {
    const row = buildAgentRow(
      agent,
      input.stays,
      input.from,
      input.to,
      asOf,
      input.cells,
      input.season,
    );
    if (row) rows.push(row);
  }
  rows.sort((a, b) => b.roomNights - a.roomNights || b.revenue - a.revenue);
  return {
    from: input.from,
    to: input.to,
    asOf,
    top: rows.slice(0, topN),
    all: rows,
  };
}

export function exportAgentIntelligenceCsv(rows: AgentIntelligenceRow[]): string[][] {
  return [
    [
      "Rank",
      "Code",
      "Agent",
      "RoomNights",
      "Stays",
      "Revenue",
      "Paid",
      "Unpaid",
      "ADR",
      "AvgGapDays",
      "TopNationality",
      "PreferredMeal",
      "PreferredRoom",
      "NextLikelyArrival",
      "ProjectedNights90d",
    ],
    ...rows.map((r, i) => [
      String(i + 1),
      r.agentCode,
      r.agentName,
      String(r.roomNights),
      String(r.stayCount),
      String(Math.round(r.revenue)),
      String(Math.round(r.paid)),
      String(Math.round(r.unpaid)),
      String(r.adr),
      r.avgGapDays == null ? "" : String(r.avgGapDays),
      r.nationalityMix[0]?.key ?? "",
      r.cues.preferredMealPlan ?? "",
      r.cues.preferredRoomType ?? "",
      r.outlook.nextLikelyArrival ?? "",
      String(r.outlook.projectedNights90d),
    ]),
  ];
}
