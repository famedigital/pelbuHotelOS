/**
 * Enterprise B2B portfolio aggregations — shared by Partner Portal (agency)
 * and Agents desk (hotel). Pure functions over MoU + commercial + FO + fiscal.
 */
import type { Agent, RateCard, RateCell, MealPlan, Season } from "./commercial-store";
import { cellsForCard, rateCardById } from "./commercial-store";
import type { FiscalDoc } from "./extras-store";
import type { Stay } from "./front-office-store";
import { folioBalance } from "./front-office-store";
import type { AllotmentBlock } from "./ecosystem-store";
import type { MouLink, MouStatus } from "./mou-store";

export type ConnectedHotelRow = {
  propertyId: string;
  propertyName: string;
  mouStatus: MouStatus;
  creditLimitBtn: number;
  rateCardId: string | null;
  rateCardCode: string;
  doubleNet: number | null;
  offerCount: number;
  staysHeld: number;
  staysInHouse: number;
  staysArriving: number;
  arOutstanding: number;
  paidTotal: number;
  mouId: string;
};

export type PartneredAgentRow = {
  agentId: string;
  name: string;
  code: string;
  active: boolean;
  creditHold: boolean;
  mouStatus: MouStatus | "none";
  mouPending: boolean;
  rateCardCode: string;
  doubleNet: number | null;
  creditLimit: number;
  usedCredit: number;
  headroom: number;
  utilPct: number;
  aging90: number;
  arOutstanding: number;
  paidTotal: number;
  depositAwaiting: number;
  staysHeld: number;
  staysInHouse: number;
  staysArriving: number;
};

export type FoPulse = {
  businessDate: string;
  arriving: number;
  inHouse: number;
  departing: number;
  held: number;
  ownBalance: number;
};

export type AgencyOfferRow = {
  id: string;
  propertyId: string;
  propertyName: string;
  typeCode: string;
  from: string;
  to: string;
  netRateBtn: number;
  mouCode: string;
  kind: "allotment";
};

function agencyToken(name: string): string {
  return name.split(" ")[0]?.toLowerCase() ?? name.toLowerCase();
}

function stayMatchesAgent(stay: Stay, agent: Agent): boolean {
  if (stay.source !== "agent" && !stay.agencyName) return false;
  const token = agencyToken(agent.name);
  const hay = (stay.agencyName ?? "").toLowerCase();
  return (
    hay.includes(token) ||
    token.includes(hay.split(" ")[0] ?? "") ||
    (stay.agencyName?.includes(agent.code) ?? false)
  );
}

function bandDouble(
  cells: RateCell[],
  rateCardId: string,
  season: Season,
  mealPlan: MealPlan,
): number | null {
  const rows = cellsForCard(cells, rateCardId, season, mealPlan);
  const dlx = rows.find(
    (r) =>
      r.typeCode === "deluxe_twin" ||
      r.typeCode === "deluxe_king" ||
      r.typeCode === "deluxe_queen" ||
      r.typeCode.startsWith("deluxe") ||
      r.typeCode.startsWith("DLX"),
  );
  const any = dlx ?? rows[0];
  if (!any) return null;
  return any.doubleNet ?? any.netAmount ?? null;
}

export function buildFoPulse(input: {
  businessDate: string;
  stays: Stay[];
  agent: Agent | null;
}): FoPulse {
  const day = input.businessDate;
  const mine = input.agent
    ? input.stays.filter((s) => stayMatchesAgent(s, input.agent!))
    : [];
  const live = mine.filter((s) => !["cancelled", "no_show"].includes(s.status));
  return {
    businessDate: day,
    arriving: live.filter((s) => s.checkIn === day && s.status !== "checked_in").length,
    inHouse: live.filter((s) => s.status === "checked_in").length,
    departing: live.filter((s) => s.checkOut === day && s.status === "checked_in").length,
    held: live.filter((s) => s.status === "held").length,
    ownBalance: live.reduce((n, s) => n + folioBalance(s), 0),
  };
}

export function buildConnectedHotels(input: {
  agentId: string;
  links: MouLink[];
  rateCards: RateCard[];
  cells: RateCell[];
  season: Season;
  mealPlan: MealPlan;
  stays: Stay[];
  fiscalDocs: FiscalDoc[];
  allotments: AllotmentBlock[];
  agent: Agent | null;
  /** Property that owns unscoped desk FO/fiscal rows (single-tenant sim). */
  moneyPropertyId?: string;
}): ConnectedHotelRow[] {
  const { agent } = input;
  const mine = input.links.filter((l) => l.agentId === input.agentId);
  const byProperty = new Map<string, MouLink>();
  for (const l of mine) {
    const prev = byProperty.get(l.propertyId);
    if (!prev || statusRank(l.status) > statusRank(prev.status)) {
      byProperty.set(l.propertyId, l);
    }
  }
  const ranked = [...byProperty.values()].sort(
    (a, b) => statusRank(b.status) - statusRank(a.status) || a.propertyName.localeCompare(b.propertyName),
  );
  /** Desk FO/fiscal seeds are property-agnostic — attribute once to money hotel. */
  const moneyPid =
    input.moneyPropertyId ??
    ranked.find((l) => l.status === "active")?.propertyId ??
    ranked[0]?.propertyId ??
    "";

  const token = agent ? agencyToken(agent.name) : "";
  const agentStays = agent
    ? input.stays.filter((s) => stayMatchesAgent(s, agent))
    : [];
  const live = agentStays.filter((s) => !["cancelled", "no_show"].includes(s.status));
  const fiscal = input.fiscalDocs.filter(
    (d) =>
      d.partyType === "agent" &&
      (d.party.toLowerCase().includes(token) ||
        (agent?.name.toLowerCase().includes(d.party.toLowerCase().split(" ")[0] ?? "") ??
          false)),
  );
  const arOutstanding = fiscal
    .filter((d) => d.status !== "paid" && d.status !== "void")
    .reduce((n, d) => n + d.amount, 0);
  const paidTotal = fiscal
    .filter((d) => d.status === "paid")
    .reduce((n, d) => n + d.amount, 0);
  const staysHeld = live.filter((s) => s.status === "held").length;
  const staysInHouse = live.filter((s) => s.status === "checked_in").length;
  const staysArriving = live.filter(
    (s) => s.status === "confirmed" || s.status === "held",
  ).length;

  return ranked
    .map((link) => {
      const cardId = link.rateCardId ?? agent?.rateCardId ?? null;
      const card = cardId ? rateCardById(input.rateCards, cardId) : undefined;
      const ownsMoney = link.propertyId === moneyPid;
      const offers = input.allotments.filter(
        (a) =>
          a.mouCode.toLowerCase().includes((card?.code ?? "mou").toLowerCase()) ||
          a.mouCode.toLowerCase().includes("yap") ||
          a.mouCode.toLowerCase().includes("demo"),
      );
      return {
        propertyId: link.propertyId,
        propertyName: link.propertyName,
        mouStatus: link.status,
        creditLimitBtn: link.creditLimitBtn,
        rateCardId: cardId,
        rateCardCode: card?.code ?? "—",
        doubleNet: cardId
          ? bandDouble(input.cells, cardId, input.season, input.mealPlan)
          : null,
        offerCount: ownsMoney ? offers.length : 0,
        staysHeld: ownsMoney ? staysHeld : 0,
        staysInHouse: ownsMoney ? staysInHouse : 0,
        staysArriving: ownsMoney ? staysArriving : 0,
        arOutstanding: ownsMoney ? arOutstanding : 0,
        paidTotal: ownsMoney ? paidTotal : 0,
        mouId: link.id,
      };
    })
    .sort((a, b) => a.propertyName.localeCompare(b.propertyName));
}

export function buildAgencyOffers(input: {
  allotments: AllotmentBlock[];
  links: MouLink[];
  agentId: string;
}): AgencyOfferRow[] {
  const activeProps = new Set(
    input.links
      .filter((l) => l.agentId === input.agentId && l.status === "active")
      .map((l) => l.propertyId),
  );
  const names = new Map(
    input.links.map((l) => [l.propertyId, l.propertyName] as const),
  );
  return input.allotments.map((a) => {
    const propertyId =
      [...activeProps][0] ??
      input.links.find((l) => l.agentId === input.agentId)?.propertyId ??
      "";
    return {
      id: a.id,
      propertyId,
      propertyName: names.get(propertyId) ?? "Connected hotel",
      typeCode: a.typeCode,
      from: a.from,
      to: a.to,
      netRateBtn: a.netRateBtn,
      mouCode: a.mouCode,
      kind: "allotment" as const,
    };
  });
}

export function buildPartneredAgentRows(input: {
  agents: Agent[];
  links: MouLink[];
  rateCards: RateCard[];
  cells: RateCell[];
  season: Season;
  mealPlan: MealPlan;
  stays: Stay[];
  fiscalDocs: FiscalDoc[];
  depositAwaitingByAgent: Record<string, number>;
  businessDate: string;
  /** When set (hotel desk), MoU status is scoped to this property only. */
  propertyId?: string;
}): PartneredAgentRow[] {
  return input.agents.map((agent) => {
    const links = input.links.filter(
      (l) =>
        l.agentId === agent.id &&
        (!input.propertyId || l.propertyId === input.propertyId),
    );
    const active = links.find((l) => l.status === "active");
    const pending = links.some((l) => l.status === "pending_counterparty");
    const mouStatus: MouStatus | "none" = active
      ? "active"
      : pending
        ? "pending_counterparty"
        : links[0]?.status ?? "none";
    const cardId = active?.rateCardId ?? agent.rateCardId;
    const card = rateCardById(input.rateCards, cardId);
    const mine = input.stays.filter((s) => stayMatchesAgent(s, agent));
    const live = mine.filter((s) => !["cancelled", "no_show"].includes(s.status));
    const token = agencyToken(agent.name);
    const fiscal = input.fiscalDocs.filter(
      (d) =>
        d.partyType === "agent" &&
        (d.party.toLowerCase().includes(token) ||
          agent.name.toLowerCase().includes(d.party.toLowerCase().split(" ")[0] ?? "")),
    );
    const headroom = Math.max(0, agent.creditLimit - agent.usedCredit);
    const utilPct =
      agent.creditLimit > 0
        ? Math.round((agent.usedCredit / agent.creditLimit) * 100)
        : 0;
    return {
      agentId: agent.id,
      name: agent.name,
      code: agent.code,
      active: agent.active,
      creditHold: Boolean(agent.creditHold),
      mouStatus,
      mouPending: pending,
      rateCardCode: card?.code ?? "—",
      doubleNet: bandDouble(input.cells, cardId, input.season, input.mealPlan),
      creditLimit: agent.creditLimit,
      usedCredit: agent.usedCredit,
      headroom,
      utilPct,
      aging90: agent.aging.d90,
      arOutstanding: fiscal
        .filter((d) => d.status !== "paid" && d.status !== "void")
        .reduce((n, d) => n + d.amount, 0),
      paidTotal: fiscal
        .filter((d) => d.status === "paid")
        .reduce((n, d) => n + d.amount, 0),
      depositAwaiting: input.depositAwaitingByAgent[agent.id] ?? 0,
      staysHeld: live.filter((s) => s.status === "held").length,
      staysInHouse: live.filter((s) => s.status === "checked_in").length,
      staysArriving: live.filter(
        (s) =>
          s.checkIn === input.businessDate &&
          !["checked_in", "checked_out", "cancelled"].includes(s.status),
      ).length,
    };
  });
}

function statusRank(s: MouStatus): number {
  switch (s) {
    case "active":
      return 5;
    case "pending_counterparty":
      return 4;
    case "draft":
      return 3;
    case "suspended":
      return 2;
    case "expired":
      return 1;
    case "rejected":
      return 0;
    default:
      return 0;
  }
}
